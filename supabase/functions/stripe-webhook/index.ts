import { json } from '../_shared/cors.ts';
import { adminClient } from '../_shared/supabase.ts';

function timingSafeEqual(a: string, b: string) {
  if (a.length !== b.length) return false; let diff = 0; for (let i=0;i<a.length;i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i); return diff === 0;
}
async function hmac(secret: string, payload: string) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name:'HMAC', hash:'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload)); return [...new Uint8Array(sig)].map(b=>b.toString(16).padStart(2,'0')).join('');
}
async function verifySignature(raw: string, header: string, secret: string) {
  const parts = Object.fromEntries(header.split(',').map(p => p.split('='))); const t = parts.t; const v1 = parts.v1; if (!t || !v1) return false;
  if (Math.abs(Date.now()/1000 - Number(t)) > 300) return false; return timingSafeEqual(await hmac(secret, `${t}.${raw}`), v1);
}
async function stripeGet(path: string, key: string) { const r=await fetch(`https://api.stripe.com/v1/${path}`,{headers:{Authorization:`Bearer ${key}`}}); return await r.json(); }

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error:'Method not allowed' },405);
  try {
    const secret=Deno.env.get('STRIPE_WEBHOOK_SECRET'); const key=Deno.env.get('STRIPE_SECRET_KEY'); if(!secret||!key) return json({error:'Stripe webhook not configured'},503);
    const raw=await req.text(); const header=req.headers.get('stripe-signature')||''; if(!await verifySignature(raw,header,secret)) return json({error:'Invalid signature'},400);
    const event=JSON.parse(raw); const admin=adminClient(); const obj=event.data?.object || {};
    let userId=obj.metadata?.user_id || obj.client_reference_id; let planId=obj.metadata?.plan_id || 'pro';
    let sub=obj;
    if (event.type==='checkout.session.completed' && obj.subscription) sub=await stripeGet(`subscriptions/${obj.subscription}`,key);
    if (event.type.startsWith('customer.subscription.')) { sub=obj; userId=sub.metadata?.user_id; planId=sub.metadata?.plan_id || 'pro'; }
    if (userId) {
      const active=['active','trialing'].includes(sub.status) || event.type==='checkout.session.completed';
      await admin.from('subscriptions').upsert({ user_id:userId, plan_id:planId, status:active?(sub.status||'active'):(sub.status||'canceled'), provider:'stripe', provider_customer_id:sub.customer || obj.customer || null, provider_subscription_id:sub.id?.startsWith('sub_')?sub.id:(obj.subscription||null), current_period_start:sub.current_period_start?new Date(sub.current_period_start*1000).toISOString():null, current_period_end:sub.current_period_end?new Date(sub.current_period_end*1000).toISOString():null, cancel_at_period_end:Boolean(sub.cancel_at_period_end), updated_at:new Date().toISOString() }, { onConflict:'user_id' });
    }
    return json({ received:true });
  } catch(e){ return json({error:e instanceof Error?e.message:'Webhook failed'},500); }
});
