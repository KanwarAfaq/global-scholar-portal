import { supabase } from './supabase';
export async function invokeFunction(name,options={}) {
 const {data,error}=await supabase.functions.invoke(name,options);
 if(error || data?.error){let body=data;try{if(error?.context?.clone)body=await error.context.clone().json();}catch{}
 const e=new Error(body?.error||body?.message||error?.message||'Request failed');e.code=body?.code;e.entitlement=body?.entitlement;throw e;}
 return data;
}
