import { corsHeaders, json } from '../_shared/cors.ts';
import { requireUser } from '../_shared/supabase.ts';
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const { user, admin } = await requireUser(req); const stripeKey = Deno.env.get('STRIPE_SECRET_KEY');
    if (!stripeKey) return json({ error: 'Stripe is not configured' }, 503);
    const { data: sub } = await admin.from('subscriptions').select('provider_customer_id').eq('user_id', user.id).maybeSingle();
    if (!sub?.provider_customer_id) return json({ error: 'No billing customer found' }, 404);
    const params = new URLSearchParams(); params.set('customer', sub.provider_customer_id); params.set('return_url', `${Deno.env.get('SITE_URL') || 'https://scholarportal.site'}/pricing`);
    const res = await fetch('https://api.stripe.com/v1/billing_portal/sessions', { method:'POST', headers:{ Authorization:`Bearer ${stripeKey}`, 'Content-Type':'application/x-www-form-urlencoded' }, body:params });
    const data = await res.json(); if (!res.ok) return json({ error:data?.error?.message || 'Portal failed' }, 502); return json({ url:data.url });
  } catch(e) { return json({ error:e instanceof Error ? e.message : 'Portal failed' }, 500); }
});
