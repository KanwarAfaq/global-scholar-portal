export type AiMessage = { role: 'system' | 'user' | 'assistant'; content: string };
export type AiResult = { text: string; provider: string; model: string; attempts: string[] };
type Provider = { name: string; run: () => Promise<{ text: string; model: string }> };

async function fetchJson(url: string, init: RequestInit, timeoutMs = 45000) {
  const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), timeoutMs);
  try { const res = await fetch(url, { ...init, signal: controller.signal }); const text = await res.text(); if (!res.ok) throw new Error(`Provider HTTP ${res.status}`); return JSON.parse(text); }
  finally { clearTimeout(timer); }
}

function openAiCompatibleProvider(name:string,url:string,key:string|undefined,model:string,messages:AiMessage[],jsonMode:boolean,extraHeaders:Record<string,string>={}):Provider|null {
  if(!key) return null;
  return {name,run:async()=>{
    const body:Record<string,unknown>={model,messages,temperature:0.25}; if(jsonMode) body.response_format={type:'json_object'};
    const data=await fetchJson(url,{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${key}`,...extraHeaders},body:JSON.stringify(body)});
    const text=data?.choices?.[0]?.message?.content; if(!text) throw new Error('Provider returned no content'); return {text,model};
  }};
}
function geminiProvider(key:string|undefined,model:string,messages:AiMessage[],jsonMode:boolean):Provider|null{
  if(!key) return null; return {name:'google-ai-studio',run:async()=>{
    const prompt=messages.map(m=>`${m.role.toUpperCase()}: ${m.content}`).join('\n\n');
    const data=await fetchJson(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(key)}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({contents:[{parts:[{text:prompt}]}],generationConfig:jsonMode?{responseMimeType:'application/json',temperature:.25}:{temperature:.25}})});
    const text=data?.candidates?.[0]?.content?.parts?.map((p:{text?:string})=>p.text||'').join(''); if(!text) throw new Error('Google AI Studio returned no content'); return {text,model};
  }};
}

export async function runAiCascade(messages: AiMessage[], jsonMode=false):Promise<AiResult>{
  const site=Deno.env.get('SITE_URL')||'https://scholarportal.site';
  const providers=[
    openAiCompatibleProvider('cgu',Deno.env.get('CGU_API_URL')||'https://air.cgu.edu.tw/cgullmapi/v1/chat/completions',Deno.env.get('CGU_API_KEY'),Deno.env.get('CGU_MODEL')||'gpt-4o',messages,jsonMode),
    openAiCompatibleProvider('groq','https://api.groq.com/openai/v1/chat/completions',Deno.env.get('GROQ_API_KEY'),Deno.env.get('GROQ_MODEL')||'openai/gpt-oss-120b',messages,jsonMode),
    openAiCompatibleProvider('openrouter','https://openrouter.ai/api/v1/chat/completions',Deno.env.get('OPENROUTER_API_KEY'),Deno.env.get('OPENROUTER_MODEL')||'openrouter/free',messages,jsonMode,{'HTTP-Referer':site,'X-Title':'ScholarPortal'}),
    openAiCompatibleProvider('nvidia-nim',Deno.env.get('NVIDIA_NIM_URL')||'https://integrate.api.nvidia.com/v1/chat/completions',Deno.env.get('NVIDIA_NIM_API_KEY'),Deno.env.get('NVIDIA_NIM_MODEL')||'openai/gpt-oss-20b',messages,jsonMode),
    openAiCompatibleProvider('mistral','https://api.mistral.ai/v1/chat/completions',Deno.env.get('MISTRAL_API_KEY'),Deno.env.get('MISTRAL_MODEL')||'mistral-small-latest',messages,jsonMode),
    geminiProvider(Deno.env.get('GEMINI_API_KEY')||Deno.env.get('GOOGLE_AI_API_KEY'),Deno.env.get('GEMINI_MODEL')||'gemini-2.5-flash',messages,jsonMode),
    openAiCompatibleProvider('cerebras','https://api.cerebras.ai/v1/chat/completions',Deno.env.get('CEREBRAS_API_KEY'),Deno.env.get('CEREBRAS_MODEL')||'gpt-oss-120b',messages,jsonMode),
    openAiCompatibleProvider('openai','https://api.openai.com/v1/chat/completions',Deno.env.get('OPENAI_API_KEY'),Deno.env.get('OPENAI_MODEL')||'gpt-5-mini',messages,jsonMode),
  ].filter(Boolean) as Provider[];
  if(!providers.length) throw new Error('No server-side AI provider is configured');
  const order=(Deno.env.get('AI_PROVIDER_ORDER')||'cgu,groq,nvidia-nim,mistral,openrouter,google-ai-studio,cerebras,openai').split(',');providers.sort((a,b)=>{const rank=(n:string)=>order.includes(n)?order.indexOf(n):999;return rank(a.name)-rank(b.name);});
  const attempts:string[]=[]; let lastError:unknown;
  for(const provider of providers){const started=Date.now();try{const result=await provider.run();if(!result.text?.trim())throw new Error('Empty provider response');if(jsonMode){const parsed=JSON.parse(result.text.replace(/^```(?:json)?\s*/i,'').replace(/```$/,'').trim());if(!parsed||typeof parsed!=='object'||Array.isArray(parsed))throw new Error('Expected JSON object');}attempts.push(`${provider.name}:ok:${Date.now()-started}ms`);return {text:result.text,provider:provider.name,model:result.model,attempts};}catch(error){lastError=error;attempts.push(`${provider.name}:failed:${error instanceof Error?error.message.slice(0,140):'unknown'}`)}}
  throw new Error(`All configured AI providers failed: ${lastError instanceof Error?lastError.message:'unknown error'}`);
}
