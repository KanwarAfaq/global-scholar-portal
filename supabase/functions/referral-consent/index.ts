import { corsHeaders, json } from '../_shared/cors.ts';
import { requireUser } from '../_shared/supabase.ts';

const ALLOWED_PROFILE_FIELDS = new Set([
  'full_name','contact_email','location','citizenship','desired_countries','desired_degree',
  'gpa','gpa_scale','english_test','education','technical_skills','research_interests','languages'
]);

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  try {
    const { user, admin } = await requireUser(req);
    const body = await req.json();
    const programId = String(body.programId || '');
    const profileId = body.profileId ? String(body.profileId) : null;
    const requestedFields = Array.isArray(body.sharedFields) ? body.sharedFields.map(String) : [];
    if(!profileId||!requestedFields.length)return json({error:'Select your profile and fields to share'},400);
    if (!programId) return json({ error: 'programId is required' }, 400);

    const { data: setting } = await admin.from('platform_settings').select('value').eq('key','monetization').maybeSingle();
    if (setting?.value?.referrals_enabled === false) {
      return json({ error: 'Partner referrals are currently disabled by the administrator', code: 'referrals_disabled' }, 503);
    }

    const { data: program, error: programError } = await admin.from('programs')
      .select('id,institution,title,referral_enabled,partner_disclosure,verified,verification_status')
      .eq('id', programId).single();
    if (programError || !program) return json({ error: 'Program not found' }, 404);
    if (!program.verified || program.verification_status === 'rejected') return json({ error: 'Only verified programs can accept referrals' }, 400);
    if (!program.referral_enabled) return json({ error: 'This program is not currently a referral partner' }, 400);

    let referralData: Record<string, unknown> = {};
    if (profileId) {
      const { data: profile } = await admin.from('user_profiles').select('*').eq('id', profileId).eq('user_id', user.id).single();
      if (!profile) return json({ error: 'Profile not found' }, 404);
      const fields = requestedFields.filter((field: string) => ALLOWED_PROFILE_FIELDS.has(field));
      if(!fields.length)return json({error:'Select at least one supported profile field'},400);
      referralData = {};
      for (const field of fields) referralData[field] = field === 'contact_email' ? (profile[field] || user.email || null) : profile[field];
    }

    const consentText = `I consent to ScholarPortal referring me to ${program.institution} for “${program.title}”. I understand ScholarPortal may receive compensation if the referral results in enrollment. Only the data I explicitly selected may be shared.`;
    const { data: referral, error } = await admin.from('program_referrals').upsert({
      user_id: user.id,
      program_id: programId,
      profile_id: profileId,
      referral_data: referralData,
      consent_text: consentText,
      status: 'requested',
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id,program_id' }).select('id,status,created_at,updated_at').single();
    if (error) throw error;

    await admin.from('analytics_events').insert({
      user_id: user.id,
      event_name: 'program_referral_requested',
      entity_type: 'program',
      entity_id: programId,
      properties: { profile_id: profileId, shared_fields: Object.keys(referralData), partner_disclosure: program.partner_disclosure || null },
    });
    return json({ referral, disclosure: program.partner_disclosure || 'ScholarPortal may receive compensation from this partner if a referral results in enrollment.' });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Referral request failed';
    return json({ error: message }, message.includes('Unauthorized') ? 401 : 500);
  }
});
