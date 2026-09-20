import { corsHeaders, json } from '../_shared/cors.ts';
import { requireUser } from '../_shared/supabase.ts';

const PRICE_ENV: Record<string, string[]> = {
  pro: ['STRIPE_PRICE_PRO_MONTHLY', 'STRIPE_PRICE_PRO'],
  counselor: ['STRIPE_PRICE_COUNSELOR_MONTHLY', 'STRIPE_PRICE_COUNSELOR'],
  sponsor: ['STRIPE_PRICE_SPONSOR_MONTHLY', 'STRIPE_PRICE_SPONSOR'],
};

function priceFor(planId: string) {
  for (const key of PRICE_ENV[planId] || []) {
    const value = Deno.env.get(key);
    if (value) return value;
  }
  return '';
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const { user, admin } = await requireUser(req);
    const { planId = 'pro' } = await req.json();
    const stripeKey = Deno.env.get('STRIPE_SECRET_KEY');
    if (!PRICE_ENV[planId]) return json({ error: 'Unsupported billing plan' }, 400);
    const priceId = priceFor(planId);
    if (!stripeKey || !priceId) return json({ error: 'Stripe is not fully configured for this plan' }, 503);
    const { data: existing } = await admin.from('subscriptions').select('provider_customer_id').eq('user_id', user.id).maybeSingle();
    const params = new URLSearchParams();
    params.set('mode', 'subscription'); params.set('line_items[0][price]', priceId); params.set('line_items[0][quantity]', '1');
    params.set('client_reference_id', user.id); params.set('metadata[user_id]', user.id); params.set('metadata[plan_id]', planId);
    params.set('subscription_data[metadata][user_id]', user.id); params.set('subscription_data[metadata][plan_id]', planId);
    const siteUrl = (Deno.env.get('SITE_URL') || 'https://scholarportal.site').replace(/\/$/, '');
    params.set('success_url', `${siteUrl}/pricing?checkout=success`);
    params.set('cancel_url', `${siteUrl}/pricing?checkout=cancelled`);
    if (existing?.provider_customer_id) params.set('customer', existing.provider_customer_id); else if (user.email) params.set('customer_email', user.email);
    const res = await fetch('https://api.stripe.com/v1/checkout/sessions', { method: 'POST', headers: { Authorization: `Bearer ${stripeKey}`, 'Content-Type': 'application/x-www-form-urlencoded' }, body: params });
    const data = await res.json();
    if (!res.ok) return json({ error: data?.error?.message || 'Stripe checkout failed' }, 502);
    return json({ url: data.url, id: data.id });
  } catch (e) { return json({ error: e instanceof Error ? e.message : 'Checkout failed' }, 500); }
});
