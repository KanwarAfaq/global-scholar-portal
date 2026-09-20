import { corsHeaders, json } from '../_shared/cors.ts';
import { requireUser } from '../_shared/supabase.ts';
Deno.serve(async(req)=>{
  if(req.method==='OPTIONS') return new Response('ok',{headers:corsHeaders});
  if(req.method!=='POST') return json({error:'Method not allowed'},405);
  try{ const {user,admin}=await requireUser(req);
    const {data:setting}=await admin.from('platform_settings').select('value').eq('key','monetization').maybeSingle();
    if(setting?.value?.sponsor_leads_enabled===false) return json({error:'Sponsored lead sharing is currently disabled by the administrator',code:'sponsor_leads_disabled'},503);
    const {campaignId,profileId,sharedFields=[]}=await req.json();
    if(!campaignId||!profileId||!Array.isArray(sharedFields)||sharedFields.length===0)return json({error:'campaignId, profileId and selected sharedFields are required'},400);
    const {data:campaign}=await admin.from('sponsor_campaigns').select('id,status,title').eq('id',campaignId).eq('status','active').single(); if(!campaign) return json({error:'Campaign is not active'},404);
    const {data:profile}=await admin.from('user_profiles').select('*').eq('id',profileId).eq('user_id',user.id).single(); if(!profile) return json({error:'Profile not found'},404);
    const allowed=new Set(['full_name','contact_email','location','bio','citizenship','desired_countries','desired_degree','education','technical_skills','research_interests','languages','english_test']); const fields=sharedFields.filter((f:string)=>allowed.has(f)); if(!fields.length)return json({error:'Select at least one supported profile field'},400); const leadData:any={}; for(const f of fields) leadData[f]=profile[f]; if(fields.includes('contact_email')&&!leadData.contact_email) leadData.contact_email=user.email;
    const consentText=`I agree to share the selected profile fields with the sponsor of “${campaign.title}” for this opportunity only.`;
    const {data:consent,error}=await admin.from('lead_consents').upsert({user_id:user.id,campaign_id:campaignId,shared_fields:fields,consent_text:consentText,consented_at:new Date().toISOString(),revoked_at:null},{onConflict:'user_id,campaign_id'}).select('id').single(); if(error) throw error;
    const {data:lead,error:leadErr}=await admin.from('campaign_leads').upsert({campaign_id:campaignId,user_id:user.id,consent_id:consent.id,lead_data:leadData,status:'new',updated_at:new Date().toISOString()},{onConflict:'campaign_id,user_id'}).select('id,status').single(); if(leadErr) throw leadErr;
    return json({consentId:consent.id,lead});
  }catch(e){return json({error:e instanceof Error?e.message:'Lead consent failed'},500)}
});
