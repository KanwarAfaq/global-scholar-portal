import os, json, time, hashlib, re
from datetime import datetime, timezone
from urllib.parse import urlparse, quote, parse_qs, unquote, urlencode, urlunparse
import requests
from bs4 import BeautifulSoup
from dotenv import load_dotenv
from supabase import create_client

load_dotenv()
SUPABASE_URL = os.getenv('SUPABASE_URL') or os.getenv('VITE_SUPABASE_URL')
SUPABASE_KEY = os.getenv('SUPABASE_SERVICE_ROLE_KEY') or os.getenv('SUPABASE_KEY')
if not SUPABASE_URL or not SUPABASE_KEY:
    raise RuntimeError('SUPABASE_URL and service-role key are required for agents')
supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

AGGREGATOR_DOMAINS = {
    'scholarshiproar.com','opportunitiescircle.com','scholarshipscorner.website','scholarshippositions.com',
    'wemakescholars.com','scholarshipsads.com','scholarshiptab.com','opportunitydesk.org'
}

def domain(url):
    try: return urlparse(url).netloc.lower().removeprefix('www.')
    except Exception: return ''

def canonical_url(url):
    try:
        raw=(url or '').strip()
        if raw.startswith('//'): raw='https:'+raw
        p=urlparse(raw)
        if p.scheme.lower() not in {'http','https'} or not p.netloc:
            return raw
        query=urlencode([(k,v) for k,vs in parse_qs(p.query,keep_blank_values=True).items() if not k.lower().startswith('utm_') and k.lower() not in {'fbclid','gclid','_scholarportal_check'} for v in vs])
        return urlunparse((p.scheme.lower(),p.netloc.lower(),p.path.rstrip('/') or '/','',query,''))
    except Exception:
        return url

def hash_text(text): return hashlib.sha256(re.sub(r'\s+',' ',text or '').strip().encode()).hexdigest()

def clean_json(raw):
    s=(raw or '').strip(); s=re.sub(r'^```(?:json)?\s*','',s,flags=re.I); s=re.sub(r'\s*```$','',s)
    return json.loads(s)

def platform_setting(key, default=None):
    """Read a service-role-only platform setting with a safe fallback."""
    try:
        rows=supabase.table('platform_settings').select('value').eq('key',key).limit(1).execute().data or []
        value=rows[0].get('value') if rows else None
        return value if isinstance(value,dict) else (default if default is not None else {})
    except Exception:
        return default if default is not None else {}

def log_event(agent_name, message, level='info', run_id=None, metadata=None):
    print(f'[{level.upper()}] {agent_name}: {message}')
    try: supabase.table('agent_events').insert({'run_id':run_id,'agent_name':agent_name,'level':level,'message':message,'metadata':metadata or {}}).execute()
    except Exception: pass

class AICascade:
    """Multi-provider LLM router. Missing providers are skipped; failures fall through."""
    def __init__(self):
        self.providers=[
            ('cgu',self._cgu),('groq',self._groq),('openrouter',self._openrouter),('nvidia-nim',self._nvidia),
            ('mistral',self._mistral),('google-ai-studio',self._gemini),('cerebras',self._cerebras),('openai',self._openai)
        ]
    def _post(self,url,headers,payload,timeout=45):
        r=requests.post(url,headers=headers,json=payload,timeout=timeout); 
        if not r.ok: raise RuntimeError(f'Provider HTTP {r.status_code}')
        return r.json()
    def _compatible(self,key,url,model,prompt,json_mode=False,headers=None):
        if not key: raise RuntimeError('missing API key')
        payload={'model':model,'messages':[{'role':'user','content':prompt}],'temperature':0.2}
        if json_mode: payload['response_format']={'type':'json_object'}
        h={'Authorization':f'Bearer {key}','Content-Type':'application/json',**(headers or {})}
        data=self._post(url,h,payload); return data['choices'][0]['message']['content'], model
    def _cgu(self,prompt,json_mode=False): return self._compatible(os.getenv('CGU_API_KEY'),os.getenv('CGU_API_URL','https://air.cgu.edu.tw/cgullmapi/v1/chat/completions'),os.getenv('CGU_MODEL','gpt-4o'),prompt,json_mode)
    def _groq(self,prompt,json_mode=False): return self._compatible(os.getenv('GROQ_API_KEY'),'https://api.groq.com/openai/v1/chat/completions',os.getenv('GROQ_MODEL','openai/gpt-oss-120b'),prompt,json_mode)
    def _openrouter(self,prompt,json_mode=False): return self._compatible(os.getenv('OPENROUTER_API_KEY'),'https://openrouter.ai/api/v1/chat/completions',os.getenv('OPENROUTER_MODEL','openrouter/free'),prompt,json_mode,{'HTTP-Referer':os.getenv('SCHOLARPORTAL_BASE_URL','https://scholarportal.site'),'X-Title':'ScholarPortal'})
    def _nvidia(self,prompt,json_mode=False): return self._compatible(os.getenv('NVIDIA_NIM_API_KEY'),os.getenv('NVIDIA_NIM_URL','https://integrate.api.nvidia.com/v1/chat/completions'),os.getenv('NVIDIA_NIM_MODEL','openai/gpt-oss-20b'),prompt,json_mode)
    def _mistral(self,prompt,json_mode=False): return self._compatible(os.getenv('MISTRAL_API_KEY'),'https://api.mistral.ai/v1/chat/completions',os.getenv('MISTRAL_MODEL','mistral-small-latest'),prompt,json_mode)
    def _cerebras(self,prompt,json_mode=False): return self._compatible(os.getenv('CEREBRAS_API_KEY'),'https://api.cerebras.ai/v1/chat/completions',os.getenv('CEREBRAS_MODEL','gpt-oss-120b'),prompt,json_mode)
    def _openai(self,prompt,json_mode=False): return self._compatible(os.getenv('OPENAI_API_KEY'),'https://api.openai.com/v1/chat/completions',os.getenv('OPENAI_MODEL','gpt-5-mini'),prompt,json_mode)
    def _gemini(self,prompt,json_mode=False):
        key=os.getenv('GEMINI_API_KEY') or os.getenv('GOOGLE_AI_API_KEY')
        if not key: raise RuntimeError('missing GEMINI_API_KEY/GOOGLE_AI_API_KEY')
        model=os.getenv('GEMINI_MODEL','gemini-2.5-flash'); body={'contents':[{'parts':[{'text':prompt}]}],'generationConfig':{'temperature':0.2}}
        if json_mode: body['generationConfig']['responseMimeType']='application/json'
        data=self._post(f'https://generativelanguage.googleapis.com/v1beta/models/{quote(model)}:generateContent?key={quote(key)}',{'Content-Type':'application/json'},body)
        return ''.join(p.get('text','') for p in data['candidates'][0]['content']['parts']), model
    def run(self,prompt,json_mode=False,validator=None):
        attempts=[]; last=None
        if platform_setting('ai',{}).get('enabled') is False: raise RuntimeError('AI is disabled by the administrator')
        order=os.getenv('AI_PROVIDER_ORDER','cgu,groq,nvidia-nim,mistral,openrouter,google-ai-studio,cerebras,openai').split(',')
        providers=sorted(self.providers,key=lambda x:order.index(x[0]) if x[0] in order else 999)
        for name,fn in providers:
            started=time.time()
            try:
                text,model=fn(prompt,json_mode)
                if not isinstance(text,str) or not text.strip(): raise ValueError('Empty response')
                if json_mode:
                    parsed=clean_json(text)
                    if not isinstance(parsed,dict): raise ValueError('Expected JSON object')
                    if validator: validator(parsed)
                attempts.append({'provider':name,'ok':True,'ms':int((time.time()-started)*1000)})
                return {'text':text,'provider':name,'model':model,'attempts':attempts}
            except Exception as e:
                last=type(e).__name__; attempts.append({'provider':name,'ok':False,'error':type(e).__name__})
        raise RuntimeError('AI providers failed: '+json.dumps(attempts))

AI=AICascade()

class SearchFallback:
    """Four web-search fallbacks: Serper, Tavily, Bing, DuckDuckGo HTML."""
    def serper(self,q,n=8):
        k=os.getenv('SERPER_API_KEY');
        if not k: raise RuntimeError('missing SERPER_API_KEY')
        r=requests.post('https://google.serper.dev/search',headers={'X-API-KEY':k,'Content-Type':'application/json'},json={'q':q,'num':n},timeout=25);r.raise_for_status()
        return [{'title':x.get('title'),'url':x.get('link'),'snippet':x.get('snippet','')} for x in r.json().get('organic',[])[:n]]
    def tavily(self,q,n=8):
        k=os.getenv('TAVILY_API_KEY');
        if not k: raise RuntimeError('missing TAVILY_API_KEY')
        r=requests.post('https://api.tavily.com/search',json={'api_key':k,'query':q,'max_results':n,'search_depth':'advanced'},timeout=25);r.raise_for_status()
        return [{'title':x.get('title'),'url':x.get('url'),'snippet':x.get('content','')} for x in r.json().get('results',[])[:n]]
    def bing(self,q,n=8):
        k=os.getenv('BING_SEARCH_API_KEY');
        if not k: raise RuntimeError('missing BING_SEARCH_API_KEY')
        r=requests.get('https://api.bing.microsoft.com/v7.0/search',headers={'Ocp-Apim-Subscription-Key':k},params={'q':q,'count':n,'responseFilter':'Webpages'},timeout=25);r.raise_for_status()
        return [{'title':x.get('name'),'url':x.get('url'),'snippet':x.get('snippet','')} for x in r.json().get('webPages',{}).get('value',[])[:n]]
    def duckduckgo(self,q,n=8):
        r=requests.get('https://html.duckduckgo.com/html/',params={'q':q},headers={'User-Agent':'Mozilla/5.0'},timeout=25);r.raise_for_status();s=BeautifulSoup(r.text,'html.parser');out=[]
        for a in s.select('.result__a')[:n]:
            href=(a.get('href') or '').strip()
            if href.startswith('//'): href='https:'+href
            # DDG HTML frequently returns a redirect URL. Resolve the real target so
            # the fourth search fallback still feeds official pages to verification.
            try:
                parsed=urlparse(href)
                if 'duckduckgo.com' in parsed.netloc and parsed.path.startswith('/l/'):
                    target=parse_qs(parsed.query).get('uddg',[None])[0]
                    if target: href=unquote(target)
            except Exception:
                pass
            out.append({'title':a.get_text(' ',strip=True),'url':href,'snippet':a.find_parent(class_='result').get_text(' ',strip=True) if a.find_parent(class_='result') else ''})
        return out
    def search(self,q,n=8):
        errors=[]
        for name,fn in [('serper',self.serper),('tavily',self.tavily),('bing',self.bing),('duckduckgo',self.duckduckgo)]:
            try:
                rows=[x for x in fn(q,n) if x.get('url')]
                if rows: return rows,name
            except Exception as e: errors.append(f'{name}:{e}')
        raise RuntimeError('all search fallbacks failed: '+' | '.join(errors))

SEARCH=SearchFallback()

class FetchFallback:
    """Four page-retrieval strategies for verification/change monitoring."""
    def _extract(self,r):
        r.raise_for_status(); ct=r.headers.get('content-type','');
        if 'html' not in ct and 'text' not in ct: raise RuntimeError(f'unsupported content-type {ct}')
        soup=BeautifulSoup(r.text,'html.parser');
        for x in soup(['script','style','nav','footer','noscript']): x.decompose()
        return re.sub(r'\s+',' ',soup.get_text(' ',strip=True))[:50000], r.url, r.status_code
    def standard(self,url): return self._extract(requests.get(url,timeout=25,allow_redirects=True))
    def browser(self,url): return self._extract(requests.get(url,headers={'User-Agent':'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/124 Safari/537.36','Accept-Language':'en-US,en;q=0.9'},timeout=30,allow_redirects=True))
    def cache_bust(self,url):
        sep='&' if '?' in url else '?'; return self._extract(requests.get(url+sep+'_scholarportal_check='+str(int(time.time())),headers={'User-Agent':'ScholarPortalVerifier/1.0'},timeout=30,allow_redirects=True))
    def jina_reader(self,url):
        proxy='https://r.jina.ai/http://'+url.removeprefix('https://').removeprefix('http://') if url.startswith('http://') else 'https://r.jina.ai/https://'+url.removeprefix('https://')
        r=requests.get(proxy,headers={'User-Agent':'ScholarPortalVerifier/1.0'},timeout=40);r.raise_for_status(); return r.text[:50000],url,r.status_code
    def fetch(self,url):
        errs=[]
        for name,fn in [('standard',self.standard),('browser',self.browser),('cache_bust',self.cache_bust),('jina',self.jina_reader)]:
            try:
                text,final,status=fn(url)
                if len(text)>400: return {'text':text,'final_url':final,'status':status,'strategy':name}
            except Exception as e: errs.append(f'{name}:{e}')
        raise RuntimeError('all page fetch fallbacks failed: '+' | '.join(errs))
FETCH=FetchFallback()
