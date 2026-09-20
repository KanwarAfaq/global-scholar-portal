import { corsHeaders, json } from '../_shared/cors.ts';
import { adminClient } from '../_shared/supabase.ts';
import { sendSmtpMail } from '../_shared/smtp.ts';

const enc=new TextEncoder();
async function sha256(v:string){const b=await crypto.subtle.digest('SHA-256',enc.encode(v));return [...new Uint8Array(b)].map(x=>x.toString(16).padStart(2,'0')).join('');}
function code4(){const a=new Uint32Array(1);crypto.getRandomValues(a);return String(a[0]%10000).padStart(4,'0');}

Deno.serve(async req=>{
  if(req.method==='OPTIONS') return new Response('ok',{headers:corsHeaders});
  if(req.method!=='POST') return json({error:'Method not allowed'},405);
  try{
    const body=await req.json(); const email=String(body.email||'').trim().toLowerCase(); const purpose=String(body.purpose||'login');
    if(!/^\S+@\S+\.\S+$/.test(email) || !['login','reset'].includes(purpose)) return json({error:'Valid email and purpose are required'},400);
    const admin=adminClient(); const ip=req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()||null;
    const since=new Date(Date.now()-10*60*1000).toISOString();
    const {count}=await admin.from('auth_otp_challenges').select('id',{count:'exact',head:true}).eq('email',email).gte('created_at',since);
    if((count||0)>=5) return json({error:'Too many OTP requests. Try again later.'},429);

    // Never use magic-link generation as an existence check: it may create unknown users.
    // This RPC is SECURITY DEFINER and executable only by service_role.
    const {data:exists,error:existsError}=await admin.rpc('auth_user_exists',{p_email:email});
    if(existsError) throw existsError;
    if(!exists) return json({ok:true}); // neutral response prevents account enumeration

    const code=code4(); const pepper=Deno.env.get('OTP_PEPPER'); if(!pepper) throw new Error('OTP_PEPPER is not configured');
    const hash=await sha256(`${email}:${purpose}:${code}:${pepper}`); const expires=new Date(Date.now()+10*60*1000).toISOString();
    await admin.from('auth_otp_challenges').update({consumed_at:new Date().toISOString()}).eq('email',email).eq('purpose',purpose).is('consumed_at',null);
    const {error}=await admin.from('auth_otp_challenges').insert({email,purpose,code_hash:hash,expires_at:expires,request_ip:ip}); if(error) throw error;
    const label=purpose==='reset'?'reset your password':'sign in';
    await sendSmtpMail(email,`Your ScholarPortal ${purpose==='reset'?'password reset':'login'} code`,`<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;padding:24px"><h2>ScholarPortal verification</h2><p>Use this 4-digit code to ${label}:</p><div style="font-size:36px;font-weight:800;letter-spacing:12px;background:#eef2ff;padding:20px;text-align:center;border-radius:16px">${code}</div><p>This code expires in 10 minutes. If you did not request it, ignore this email.</p></div>`);
    return json({ok:true,expiresIn:600});
  }catch(e){return json({error:e instanceof Error?e.message:'OTP request failed'},500);}
});
