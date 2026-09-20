import { corsHeaders, json } from '../_shared/cors.ts';
import { requireUser } from '../_shared/supabase.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if(req.method!=='POST')return json({error:'Method not allowed'},405);
  try {
    const { user, admin } = await requireUser(req);
    if(user.app_metadata?.role==='admin')return json({error:'Ask another administrator to change your role before deleting this account'},400);
    const body = await req.json().catch(() => ({}));
    if (body.confirm !== `DELETE ${user.email}`) return json({ error: 'Confirmation phrase does not match' }, 400);

    // counselor_students keeps the invite email even when student_user_id is SET NULL,
    // so remove those rows explicitly before deleting the Auth account.
    await admin.from('counselor_students').delete().eq('student_user_id', user.id);
    if (user.email) await admin.from('counselor_students').delete().ilike('student_email', user.email);
    const { error } = await admin.auth.admin.deleteUser(user.id);
    if (error) throw error;
    return json({ deleted: true });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : 'Deletion failed' }, 500);
  }
});
