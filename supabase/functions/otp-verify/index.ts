import { corsHeaders, json } from '../_shared/cors.ts';
import { adminClient } from '../_shared/supabase.ts';
const enc=new TextEncoder();
async function sha256(v:string){const b=await crypto.subtle.digest('SHA-256',enc.encode(v));return [...new Uint8Array(b)].map(x=>x.toString(16).padStart(2,'0')).join('');}

Deno.serve(async req=>{
  if(req.method==='OPTIONS') return new Response('ok',{headers:corsHeaders});
  if(req.method!=='POST') return json({error:'Method not allowed'},405);
  try{
    const body=await req.json(); const email=String(body.email||'').trim().toLowerCase(); const purpose=String(body.purpose||'login'); const code=String(body.code||'').trim();
    if(!/^\d{4}$/.test(code) || !['login','reset'].includes(purpose)) return json({error:'Enter the 4-digit code'},400);
    const pepper=Deno.env.get('OTP_PEPPER'); if(!pepper) throw new Error('OTP_PEPPER is not configured'); const admin=adminClient();
    const {data:exists,error:existsError}=await admin.rpc('auth_user_exists',{p_email:email}); if(existsError) throw existsError; if(!exists) return json({error:'Code expired or invalid'},400);
    const {data:row}=await admin.from('auth_otp_challenges').select('*').eq('email',email).eq('purpose',purpose).is('consumed_at',null).order('created_at',{ascending:false}).limit(1).maybeSingle();
    if(!row || new Date(row.expires_at)<=new Date()) return json({error:'Code expired or invalid'},400);
    if(Number(row.attempts||0)>=5) return json({error:'Too many incorrect attempts. Request a new code.'},429);
    const hash=await sha256(`${email}:${purpose}:${code}:${pepper}`);
    if(hash!==row.code_hash){await admin.from('auth_otp_challenges').update({attempts:Number(row.attempts||0)+1}).eq('id',row.id);return json({error:'Incorrect code'},400);}
    await admin.from('auth_otp_challenges').update({consumed_at:new Date().toISOString()}).eq('id',row.id);

    const type=purpose==='reset'?'recovery':'magiclink'; const {data:link,error:linkError}=await admin.auth.admin.generateLink({type,email}); if(linkError) throw linkError;
    const tokenHash=link?.properties?.hashed_token; if(!tokenHash) throw new Error('Could not create secure session');
    const supabaseUrl=Deno.env.get('SUPABASE_URL')!; const serviceKey=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const r=await fetch(`${supabaseUrl}/auth/v1/verify`,{method:'POST',headers:{'Content-Type':'application/json','apikey':serviceKey},body:JSON.stringify({token_hash:tokenHash,type})});
    const session=await r.json(); if(!r.ok || !session.access_token) throw new Error(session?.msg||session?.error_description||'Session exchange failed');
    return json({ok:true,purpose,session:{access_token:session.access_token,refresh_token:session.refresh_token,expires_in:session.expires_in,expires_at:session.expires_at,token_type:session.token_type,user:session.user}});
  }catch(e){return json({error:e instanceof Error?e.message:'OTP verification failed'},500);}
});
