export async function getEntitlement(admin: any, userId: string) {
  const { data: subscription } = await admin
    .from('subscriptions')
    .select('plan_id,status,current_period_start,current_period_end')
    .eq('user_id', userId)
    .in('status', ['active','trialing'])
    .maybeSingle();
  const planId = subscription?.plan_id || 'free';
  const { data: plan } = await admin.from('plans').select('*').eq('id', planId).single();
  const now = new Date();
  const start = subscription?.current_period_start || new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
  const { data: usage } = await admin
    .from('ai_usage')
    .select('credit_cost')
    .eq('user_id', userId)
    .gte('created_at', start);
  const used = (usage || []).reduce((sum: number, row: { credit_cost?: number }) => sum + Number(row.credit_cost || 0), 0);
  return { planId, plan: plan || { monthly_ai_credits: 0, max_watchlists: 0, features: {} }, used, remaining: Math.max(0, Number(plan?.monthly_ai_credits || 0) - used) };
}
