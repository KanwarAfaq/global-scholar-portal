import { deterministicMatch } from '../_shared/matching.ts';
import { corsHeaders, json } from '../_shared/cors.ts';
import { requireUser } from '../_shared/supabase.ts';
import { getEntitlement } from '../_shared/billing.ts';
import { runAiCascade } from '../_shared/ai.ts';

const ACTION_COST: Record<string, number> = {
  match: 1,
  requirements: 1,
  cover_letter: 2,
  cold_email: 1,
  sop: 3,
  personal_statement: 3,
  research_proposal: 4,
  recommendation_brief: 2,
  interview_practice: 2,
  checklist: 1,
  resume_tailor: 3,
  compare: 1,
  counselor_review: 2,
  profile_gap: 2,
  competitiveness: 2,
  scam_review: 1,
  application_strategy: 2,
};

function text(v:unknown){return String(v??'').trim();}

function prompts(action: string, profile: any, opportunity: any, extra: any) {
  const facts = `CANDIDATE PROFILE (use only these facts; never invent achievements):\n${JSON.stringify(action==='requirements'?{}:profile || {}, null, 2)}\n\nOPPORTUNITY (recorded claims; respect verification status and flag unsupported or missing facts):\n${JSON.stringify(opportunity || {}, null, 2)}\n\nEXTRA CONTEXT:\n${JSON.stringify(extra || {}, null, 2)}`;
  const common = 'You are ScholarPortal Application Studio. Never invent facts, awards, scores, publications, employment, research, or eligibility. Clearly flag missing information. Avoid guarantees of admission or scholarship success.';
  const map: Record<string, string> = {
    match: 'Explain the candidate-opportunity match in concise markdown. Separate confirmed matches, unknowns, and risks. Explain only evidence-backed rule results. A null eligibility is unknown, not a failure. Never infer eligibility from a career label. Do not override deterministic eligibility failures.',
    requirements: 'Extract only from the OPPORTUNITY. Never use candidate contacts. Missing contacts must be null/unknown. Qualifications belong in eligibility, submission evidence belongs in documents. Extract a practical application requirements checklist. Return JSON with keys documents, eligibility, dates, contacts, unknowns.',
    checklist: 'Create a prioritized application checklist with due-order and missing information. Return JSON with key items; each item has title, priority, reason.',
    cover_letter: 'Draft a tailored professional cover letter grounded only in candidate facts and opportunity requirements.',
    cold_email: 'Draft a concise cold email to the most appropriate professor/program contact; if no contact is known, use a role placeholder rather than inventing a name.',
    sop: 'Draft a statement of purpose with clear motivation, preparation, fit, and future goals. Use placeholders for missing specifics.',
    personal_statement: 'Draft a personal statement focused on authentic evidence and narrative. Use placeholders for missing facts.',
    research_proposal: 'Create a research-proposal outline and a draft abstract. Distinguish candidate evidence from suggested future work.',
    recommendation_brief: 'Create a recommender brief: relevant achievements to mention, opportunity criteria, and evidence prompts. Do not write false endorsements.',
    interview_practice: 'Return JSON with 8 likely interview questions and strong answer frameworks tied to the candidate profile.',
    resume_tailor: 'Return JSON with title, summary, skills, experience, projects. Preserve factual roles/organizations/dates; improve wording only.',
    compare: 'Compare supplied opportunities for fit, funding, deadline risk, verification confidence, and application effort. Return concise markdown.',
    counselor_review: 'Review student application readiness. Identify missing documents, deadline risks, weak evidence, and next actions. Return JSON with risks and tasks.',
    profile_gap: 'Act as a Profile Improvement Agent. Return JSON with strengths, missing_evidence, high_impact_improvements, and profile_completeness. Never invent candidate facts.',
    competitiveness: 'Act as a Scholarship Competitiveness Agent. Estimate competitiveness using only stated opportunity requirements and candidate evidence. Return JSON with score_0_100, strengths, weaknesses, uncertainty, and actions. Never imply guaranteed selection.',
    scam_review: 'Act as an Opportunity Safety Agent. Review source, organization, contact/payment requests, verification metadata and opportunity facts for scam/red-flag indicators. Return JSON with risk_level, flags, safe_next_steps, and evidence. Do not call something fraudulent without evidence.',
    application_strategy: 'Act as an Application Strategy Agent. Build a practical prioritized plan from today to deadline using only the candidate and opportunity facts. Return JSON with phases, immediate_actions, evidence_to_prepare, and risks.',
  };
  return [{ role: 'system' as const, content: common }, { role: 'user' as const, content: `${map[action] || map.cover_letter}\n\n${facts}` }];
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  const started = Date.now();
  try {
    const { user, admin } = await requireUser(req);
    const { data: aiSettingRow } = await admin.from('platform_settings').select('value').eq('key','ai').maybeSingle();
    const aiSettings = (aiSettingRow?.value && typeof aiSettingRow.value === 'object') ? aiSettingRow.value as Record<string, any> : {};
    if (aiSettings.enabled === false) return json({ error: 'AI features are temporarily disabled by the administrator', code: 'ai_disabled' }, 503);

    const body = await req.json();
    const action = text(body.action);
    if (!ACTION_COST[action]) return json({ error: 'Unsupported AI action' }, 400);
    const entitlement = await getEntitlement(admin, user.id);
    const cost = ACTION_COST[action];
    if (entitlement.remaining < cost) return json({ error: 'AI credit limit reached', code: 'quota_exceeded', entitlement }, 402);

    let profile = null;
    let opportunity = null;
    // Counselor review may inspect a connected student's profile only after that student accepted the workspace invitation.
    if (action === 'counselor_review' && body?.extra?.student_user_id) {
      const studentUserId = String(body.extra.student_user_id);
      const { data: link } = await admin.from('counselor_students').select('organization_id,student_user_id,consented_at').eq('student_user_id', studentUserId).not('consented_at','is',null).limit(1).maybeSingle();
      if (!link) return json({ error: 'Student has not consented to a counselor workspace review' }, 403);
      const { data: membership } = await admin.from('organization_members').select('role').eq('organization_id', link.organization_id).eq('user_id', user.id).maybeSingle();
      const { data: ownedOrg } = await admin.from('organizations').select('id').eq('id', link.organization_id).eq('owner_user_id', user.id).maybeSingle();
      if (!membership && !ownedOrg) return json({ error: 'You do not have access to this student workspace' }, 403);
      const { data: studentProfile } = await admin.from('user_profiles').select('*').eq('user_id', studentUserId).order('updated_at', { ascending: false }).limit(1).maybeSingle();
      profile = studentProfile;
    }
    if (!profile && body.profileId) {
      const { data } = await admin.from('user_profiles').select('*').eq('id', body.profileId).eq('user_id', user.id).single();
      if(!data)return json({error:'Profile not found'},404);
      profile = data;
    }
    if (!opportunity && body.opportunityId) {
      const { data } = await admin.from('global_opportunities').select('*').eq('id', body.opportunityId).single();
      if(!data)return json({error:'Opportunity not found'},404);
      opportunity = data;
    }

    if(action==='match'&&(!profile||!opportunity))return json({error:'Choose a profile and opportunity'},400);
    let deterministic: any = null;
    if (action === 'match') deterministic = deterministicMatch(profile, opportunity);
    const jsonMode = ['requirements','checklist','resume_tailor','interview_practice','counselor_review','profile_gap','competitiveness','scam_review','application_strategy'].includes(action);
    const ai = await runAiCascade(prompts(action, profile, opportunity, { ...body.extra, deterministic }), jsonMode);
    let structured: any = null;
    if (jsonMode) {
      try { structured = JSON.parse(ai.text.replace(/^```json\s*/i, '').replace(/```$/i, '').trim()); } catch { structured = null; }
    }

    await admin.from('ai_usage').insert({ user_id: user.id, action, provider: ai.provider, model: ai.model, credit_cost: cost, success: true, latency_ms: Date.now() - started });
    let generation: any = null;
    if (aiSettings.save_generation_history !== false) {
      const { data, error: historyError } = await admin.from('ai_generations').insert({
        user_id: user.id, profile_id: body.profileId || profile?.id || null, opportunity_id: body.opportunityId || opportunity?.id || null,
        action, title: body.title || null, content: ai.text, structured_output: structured, provider: ai.provider, model: ai.model,
      }).select('id').single();
      if(historyError)throw new Error('Generation completed but history could not be saved. Check database migrations before retrying.');
      generation = data;
    }

    if (action === 'match' && opportunity?.id) {
      const {error: matchError}=await admin.from('user_match_scores').upsert({ user_id: user.id, profile_id: body.profileId || profile?.id || null, opportunity_id: opportunity.id, ...deterministic, explanation: ai.text, calculated_at: new Date().toISOString() }, { onConflict: 'user_id,profile_id,opportunity_id' });
      if(matchError)throw new Error('Assessment could not be saved. Check database migrations before retrying.');
    }

    return json({ text: ai.text, structured, deterministic, provider: ai.provider, model: ai.model, attempts: ai.attempts, generationId: generation?.id, entitlement: { ...entitlement, remaining: entitlement.remaining - cost } });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'AI request failed' }, String(error).includes('Unauthorized') ? 401 : 500);
  }
});
