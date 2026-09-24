from urllib.parse import urlparse
import os, json, re, hashlib
from datetime import datetime, timezone, timedelta
from urllib.parse import urlparse
from core import supabase, AI, SEARCH, FETCH, domain, canonical_url, hash_text, AGGREGATOR_DOMAINS, log_event, clean_json, platform_setting
from dispatch_notifications import NotificationAgent

REGIONS={
0:['Taiwan scholarships MOE NSTC Academia Sinica','Japan MEXT JASSO scholarships','South Korea GKS KAIST scholarships'],
1:['Singapore SINGA NUS NTU scholarships','China CSC scholarships','Malaysia Brunei government scholarships'],
2:['Saudi Arabia KAUST KFUPM scholarships','UAE MBZUAI scholarships','Qatar University scholarships'],
3:['Germany DAAD scholarships','Switzerland ETH EPFL scholarships','France Eiffel scholarships'],
4:['Sweden SI scholarships','Finland scholarships EDUFI','Italy DSU scholarships'],
5:['UK Chevening Gates Cambridge scholarships','USA Fulbright international scholarships','Canada Vanier scholarships'],
6:['Australia RTP scholarships','New Zealand Manaaki scholarships','Erasmus Mundus scholarships']}

ALLOWED_TYPES={'Bachelor','Master','PhD','MPhil','Fellowship','Internship','Course','Workshop','Scholarship'}
AUTO_PUBLISH_SCORE=70

def normalize_opportunity_type(value):
    candidates=value if isinstance(value,list) else [value]
    for candidate in candidates:
        text=str(candidate or '').strip()
        if text in ALLOWED_TYPES:return text
    return 'Scholarship'

def verification_status(score):
    return 'verified' if max(0,min(100,int(score or 0)))>AUTO_PUBLISH_SCORE else 'needs_review'

GENERIC_ORG_WORDS={'university','college','institute','institution','foundation','ministry','department','government','international','national','school','programme','program','scholarship','scholarships','education','research','office','organization','organisation'}

def facebook_opportunity_message(opportunity,article_url):
    """Create a readable Facebook caption that sends visitors to ScholarPortal first."""
    def short(value,limit=180):
        text=re.sub(r'\s+',' ',str(value or '')).strip()
        return text if len(text)<=limit else text[:limit-1].rstrip()+'…'
    title=short(opportunity.get('title') or 'New verified opportunity',180)
    organization=short(opportunity.get('organization') or 'Official institution',90)
    country=short(opportunity.get('country') or 'International',60)
    deadline=short(opportunity.get('deadline') or 'Check the official source',60)
    funding=short(opportunity.get('funding_details') or 'Funding details are available in the ScholarPortal guide.',180)
    kind=re.sub(r'[^A-Za-z0-9]','',str(opportunity.get('type') or 'Scholarship')) or 'Scholarship'
    return '\n'.join([
        '🎓 NEW VERIFIED OPPORTUNITY',
        '',
        title,
        f'🏛️ {organization}',
        f'🌍 {country}',
        f'💰 {funding}',
        f'📅 Deadline: {deadline}',
        '',
        '✅ ScholarPortal checked the source and prepared the eligibility, funding, deadline, and application details for you.',
        '👇 Read the complete guide on ScholarPortal first. The authentic official source is provided inside the guide:',
        article_url,
        '',
        f'#ScholarPortal #{kind} #StudyAbroad #InternationalStudents #FundingOpportunity',
    ])

def likely_official_source(url, organization=''):
    """Conservative official-source gate used before an automated verified badge.

    Government/academic domains pass directly. Other domains must contain a
    meaningful token from the extracted organization. Uncertain domains are
    reviewable, never silently auto-published as official.
    """
    d=domain(url)
    if not d or d in AGGREGATOR_DOMAINS: return False
    government_or_academic_markers=('.edu','.edu.','.ac.','.gov','.gov.','.go.','.gouv.','.gc.','europa.eu')
    if any(marker in d for marker in government_or_academic_markers): return True
    tokens=[t for t in re.findall(r'[a-z0-9]+',(organization or '').lower()) if len(t)>=4 and t not in GENERIC_ORG_WORDS]
    compact=re.sub(r'[^a-z0-9]','',d.split('.')[0])
    return any(t in d or re.sub(r'[^a-z0-9]','',t) in compact for t in tokens)


def queue_review(candidate, verification, run_id=None, note='Borderline automated verification'):
    """Persist borderline candidates for staff review instead of publishing or discarding them."""
    if not verification: return False
    url=(verification.get('page') or {}).get('final_url') or candidate.get('url')
    if not url: return False
    try:
        pending=supabase.table('opportunity_review_queue').select('id').eq('source_url',url).eq('status','pending').limit(1).execute().data or []
        if pending: return False
        page=verification.get('page') or {}
        supabase.table('opportunity_review_queue').insert({
            'source_url':url,
            'search_title':candidate.get('title'),
            'candidate_data':verification.get('data') or {},
            'page_metadata':{'http_status':page.get('status'),'fetch_strategy':page.get('strategy'),'content_hash':hash_text(page.get('text') or '')},
            'verification_score':verification.get('score') or 0,
            'checks':{**(verification.get('checks') or {}),'queue_note':note}
        }).execute()
        log_event('quality-queue',f'queued {url} for staff review','info',run_id)
        return True
    except Exception as e:
        log_event('quality-queue',f'could not queue {url}: {e}','warn',run_id)
        return False

class ResearchAgent:
    name='research-agent'
    def discover(self,run_id=None):
        # Search today's region first, then rotate through the remaining regions.
        # This removes the old 30-candidate ceiling and gives every run multiple
        # independent source pools without lowering verification standards.
        weekday=datetime.now(timezone.utc).weekday()
        targets=[]
        for offset in range(len(REGIONS)):
            targets.extend(REGIONS[(weekday+offset)%len(REGIONS)])
        found=[]; seen=set()
        for target in targets:
            q=f'{target} official application deadline 2026 2027 fully funded'
            try: rows,provider=SEARCH.search(q,10); log_event(self.name,f'{provider} returned {len(rows)} results for {target}',run_id=run_id)
            except Exception as e: log_event(self.name,str(e),'error',run_id); continue
            # Prefer official/university/government pages and reject known SEO aggregators.
            rows=sorted(rows,key=lambda x:(domain(x['url']) in AGGREGATOR_DOMAINS, not any(t in domain(x['url']) for t in ['.edu','.ac.','.gov','.org'])))
            for r in rows:
                u=canonical_url(r['url']); d=domain(u)
                if not u or u in seen or d in AGGREGATOR_DOMAINS: continue
                seen.add(u); found.append({'query':target,**r,'url':u,'search_provider':provider})
        return found

class VerificationAgent:
    name='verification-agent'
    def score(self,candidate,page):
        text=page['text'].lower(); title=(candidate.get('title') or '').lower(); score=0; checks={}
        checks['reachable']=page['status']<400; score+=20 if checks['reachable'] else 0
        checks['scholarship_terms']=any(k in text for k in ['scholarship','fellowship','studentship','financial support','funding']); score+=20 if checks['scholarship_terms'] else 0
        checks['application_terms']=any(k in text for k in ['apply','application','eligibility','eligible','deadline']); score+=20 if checks['application_terms'] else 0
        title_words=[w for w in re.findall(r'[a-z0-9]+',title) if len(w)>4][:6]; checks['title_overlap']=sum(w in text for w in title_words)>=1 if title_words else True; score+=15 if checks['title_overlap'] else 0
        d=domain(page['final_url']); checks['not_known_aggregator']=d not in AGGREGATOR_DOMAINS; score+=15 if checks['not_known_aggregator'] else 0
        checks['substantial_page']=len(page['text'])>1200; score+=10 if checks['substantial_page'] else 0
        return score,checks
    def extract(self,candidate,page):
        prompt=f'''Extract ONE real opportunity from this fetched source page. Never infer a deadline, eligibility rule or benefit not stated in the page. Return JSON only.\nToday: {datetime.now(timezone.utc).date()}\nSource URL: {page['final_url']}\nSearch title: {candidate.get('title')}\nPAGE TEXT:\n{page['text'][:18000]}\n\nSchema: {{"title":"","organization":"","country":"","type":"Scholarship|Bachelor|Master|PhD|MPhil|Fellowship|Internship|Course|Workshop","field":"","funding_details":"","description":"","tags":[],"deadline":"YYYY-MM-DD|Rolling|Unknown","eligibility":{{"citizenships":[],"levels":[],"fields":[],"min_gpa":null,"age_max":null,"language_tests":[{{"type":"IELTS|TOEFL|Other","min_score":null}}]}},"requirements":{{"min_gpa":null,"work_experience":null}},"application_requirements":{{"documents":[],"recommendation_letters":null,"language_tests":[{{"type":"IELTS|TOEFL|Other","min_score":null}}]}}}}'''
        r=AI.run(prompt,True); return clean_json(r['text']),r
    def verify_candidate(self,candidate,run_id=None):
        try: page=FETCH.fetch(candidate['url'])
        except Exception as e: log_event(self.name,f"fetch failed {candidate['url']}: {e}",'warn',run_id); return None
        score,checks=self.score(candidate,page)
        try: data,ai=self.extract(candidate,page)
        except Exception as e: log_event(self.name,f"extraction failed: {e}",'warn',run_id); return None
        typ=normalize_opportunity_type(data.get('type'))
        raw_deadline=data.get('deadline')
        if isinstance(raw_deadline,list):raw_deadline=next((x for x in raw_deadline if isinstance(x,str) and x.strip()),'Unknown')
        deadline=str(raw_deadline or 'Unknown').strip()
        if deadline not in ('Rolling','Unknown') and not re.match(r'^\d{4}-\d{2}-\d{2}$',deadline): deadline='Unknown'
        if deadline=='Unknown': score-=12
        if deadline not in ('Rolling','Unknown'):
            try:
                if datetime.strptime(deadline,'%Y-%m-%d').date() < datetime.now(timezone.utc).date(): return None
            except Exception: pass
        checks['likely_official_source']=likely_official_source(page['final_url'],data.get('organization') or '')
        if not checks['likely_official_source']: score-=20
        checks['specific_destination']=bool(urlparse(page['final_url']).path.strip('/')) and checks.get('substantial_page',False)
        if not checks['specific_destination']: score-=25
        # Product rule: a score strictly greater than 70 is eligible for
        # automatic publication. Scores of 70 or below always require staff.
        status=verification_status(score)
        return {'data':{**data,'type':typ,'deadline':deadline},'page':page,'score':max(0,min(100,score)),'checks':checks,'status':status,'ai':ai}

class ChangeMonitorAgent:
    name='change-monitor-agent'
    def run(self,run_id=None,limit=80):
        rows=(supabase.table('global_opportunities').select('*').eq('verified',True).order('last_checked_at').limit(limit).execute().data or [])
        changes=[]
        verifier=VerificationAgent()
        for opp in rows:
            url=opp.get('official_source_url') or opp.get('source_url') or opp.get('url')
            if not url: continue
            try: page=FETCH.fetch(url)
            except Exception as e: log_event(self.name,f"{opp['id']}: {e}",'warn',run_id); continue
            h=hash_text(page['text'])
            if h==opp.get('change_hash'):
                supabase.table('global_opportunities').update({'last_checked_at':datetime.now(timezone.utc).isoformat()}).eq('id',opp['id']).execute(); continue
            v=verifier.verify_candidate({'url':url,'title':opp.get('title')},run_id)
            if not v: continue
            if v['status'] != 'verified':
                queue_review({'url':url,'title':opp.get('title')},v,run_id,'Existing verified source changed and now requires manual review')
                supabase.table('global_opportunities').update({'last_checked_at':datetime.now(timezone.utc).isoformat(),'verification_status':'change_needs_review','verification_confidence':v['score']}).eq('id',opp['id']).execute()
                continue
            new=v['data']; changed=[]
            map_fields=['title','organization','country','type','field','funding_details','description','deadline','eligibility','requirements','application_requirements']
            patch={'last_checked_at':datetime.now(timezone.utc).isoformat(),'change_hash':h,'verification_confidence':v['score']}
            for f in map_fields:
                nv=new.get(f)
                if nv not in (None,'',[],{}) and nv!=opp.get(f): patch[f]=nv; changed.append(f)
            supabase.table('opportunity_versions').upsert(
                {'opportunity_id':opp['id'],'content_hash':h,'snapshot':new,'changed_fields':changed},
                on_conflict='opportunity_id,content_hash',ignore_duplicates=True
            ).execute()
            supabase.table('global_opportunities').update(patch).eq('id',opp['id']).execute()
            if changed: changes.append({'opportunity_id':opp['id'],'title':patch.get('title',opp.get('title')),'changed_fields':changed,'hash':h})
        return changes


PROGRAM_TARGETS=[
    'international graduate degree program scholarships official university computer science',
    'international masters degree program scholarships official university engineering',
    'international phd program funding official university research',
    'international undergraduate program scholarships official university admissions',
    'international data science artificial intelligence masters official university',
    'international public health masters scholarships official university',
    'international business masters scholarships official university'
]

class ProgramDiscoveryAgent:
    """Verified degree-program inventory. Uses the same 4 search, 4 fetch and 4 LLM fallbacks."""
    name='program-discovery-agent'
    def _score(self,page):
        t=page['text'].lower(); score=0
        score += 20 if page['status'] < 400 else 0
        score += 20 if any(k in t for k in ['admission','admissions','apply','application']) else 0
        score += 20 if any(k in t for k in ['master','bachelor','phd','doctoral','degree','programme','program']) else 0
        score += 15 if any(k in t for k in ['tuition','fee','scholarship','financial aid','funding']) else 0
        score += 15 if domain(page['final_url']) not in AGGREGATOR_DOMAINS else 0
        score += 10 if len(page['text']) > 1500 else 0
        return score
    def run(self,run_id=None,limit=4):
        target=PROGRAM_TARGETS[datetime.now(timezone.utc).weekday() % len(PROGRAM_TARGETS)]
        try: rows,provider=SEARCH.search(target,10)
        except Exception as e: log_event(self.name,str(e),'warn',run_id); return 0
        inserted=0
        rows=sorted(rows,key=lambda x:(domain(x.get('url','')) in AGGREGATOR_DOMAINS, not any(z in domain(x.get('url','')) for z in ['.edu','.ac.','.gov'])))
        for r in rows:
            u=canonical_url(r.get('url') or ''); d=domain(u)
            if not u or d in AGGREGATOR_DOMAINS: continue
            if supabase.table('programs').select('id').eq('official_url',u).limit(1).execute().data: continue
            try: page=FETCH.fetch(u)
            except Exception as e: log_event(self.name,f'fetch {u}: {e}','warn',run_id); continue
            score=self._score(page)
            threshold=int(platform_setting('trust',{}).get('program_auto_publish_min_confidence',80) or 80)
            if score < threshold: continue
            prompt=f'''Extract ONE real degree program from the fetched official page. Never invent tuition, deadlines, eligibility, funding, or a partner relationship. Return JSON only.
Today: {datetime.now(timezone.utc).date()}
Official URL: {page['final_url']}
PAGE TEXT:
{page['text'][:18000]}
Schema: {{"institution":"","title":"","country":"","level":"Bachelor|Master|PhD|Doctoral|Other","field":"","tuition_amount":null,"tuition_currency":"","scholarships":[],"eligibility":{{"citizenships":[],"min_gpa":null,"gpa_scale":4,"language_tests":[{{"type":"IELTS|TOEFL|Other","min_score":null}}]}},"requirements":{{"documents":[]}},"deadline":"YYYY-MM-DD|Rolling|Unknown"}}'''
            try:
                ai=AI.run(prompt,True); data=clean_json(ai['text'])
            except Exception as e: log_event(self.name,f'extract {u}: {e}','warn',run_id); continue
            if not data.get('title') or not data.get('institution'): continue
            if not likely_official_source(page['final_url'],data.get('institution') or ''):
                log_event(self.name,f'uncertain official ownership for {page["final_url"]}; skipped automatic program publication','warn',run_id)
                continue
            deadline=str(data.get('deadline') or 'Unknown')
            if deadline not in ('Rolling','Unknown') and not re.match(r'^\d{4}-\d{2}-\d{2}$',deadline): deadline='Unknown'
            payload={
                'institution':data['institution'],'title':data['title'],'country':data.get('country'),'level':data.get('level'),'field':data.get('field'),
                'tuition_amount':data.get('tuition_amount'),'tuition_currency':data.get('tuition_currency'),'scholarships':data.get('scholarships') or [],
                'eligibility':data.get('eligibility') or {},'requirements':data.get('requirements') or {},'deadline':deadline,
                'official_url':page['final_url'],'referral_enabled':False,'verified':True,'verification_status':'verified',
                'verification_confidence':score,'last_checked_at':datetime.now(timezone.utc).isoformat(),'content_hash':hash_text(page['text']),'source_domain':domain(page['final_url'])
            }
            try:
                supabase.table('programs').insert(payload).execute(); inserted+=1
                log_event(self.name,f"verified {data['institution']} - {data['title']} via {provider}/{page['strategy']}",run_id=run_id)
            except Exception as e: log_event(self.name,f'insert {u}: {e}','warn',run_id)
            if inserted>=limit: break
        return inserted

class ProgramMonitorAgent:
    name='program-monitor-agent'
    def run(self,run_id=None,limit=30):
        rows=supabase.table('programs').select('*').eq('verified',True).order('last_checked_at').limit(limit).execute().data or []; changed=0
        extractor=ProgramDiscoveryAgent()
        for p in rows:
            try: page=FETCH.fetch(p['official_url'])
            except Exception as e: log_event(self.name,f"{p['id']}: {e}",'warn',run_id); continue
            h=hash_text(page['text'])
            if h == p.get('content_hash'):
                supabase.table('programs').update({'last_checked_at':datetime.now(timezone.utc).isoformat()}).eq('id',p['id']).execute(); continue
            score=extractor._score(page)
            # Changed pages stay visible but are marked for staff attention if verification weakens.
            threshold=int(platform_setting('trust',{}).get('program_auto_publish_min_confidence',80) or 80)
            patch={'last_checked_at':datetime.now(timezone.utc).isoformat(),'verification_confidence':score,'content_hash':h,'verification_status':'verified' if score>=threshold else 'change_needs_review'}
            if score < threshold: patch['verified']=False
            supabase.table('programs').update(patch).eq('id',p['id']).execute(); changed+=1
        return changed

class CampaignAgent:
    name='sponsor-campaign-agent'
    def run(self,run_id=None):
        leads=supabase.table('campaign_leads').select('*,sponsor_campaigns(*)').in_('status',['new','reviewed']).limit(200).execute().data or []; n=0
        for lead in leads:
            c=lead.get('sponsor_campaigns') or {}; data=lead.get('lead_data') or {}; blob=json.dumps(data).lower(); score=45
            for x in c.get('target_countries') or []: score+=15 if x.lower() in blob else 0
            for x in c.get('target_fields') or []: score+=15 if x.lower() in blob else 0
            for x in c.get('target_levels') or []: score+=15 if x.lower() in blob else 0
            score=min(100,score); status='qualified' if score>=70 else 'reviewed'
            supabase.table('campaign_leads').update({'match_score':score,'status':status,'updated_at':datetime.now(timezone.utc).isoformat()}).eq('id',lead['id']).execute(); n+=1
        return n

class CounselorAgent:
    name='counselor-agent'
    def run(self,run_id=None):
        links=supabase.table('counselor_students').select('*').eq('status','accepted').not_.is_('student_user_id','null').execute().data or []; created=0
        for link in links:
            apps=supabase.table('user_applications').select('id,user_id,status,global_opportunities(title,deadline)').eq('user_id',link['student_user_id']).execute().data or []
            for app in apps:
                o=app.get('global_opportunities') or {}; d=o.get('deadline')
                if not d or not re.match(r'^\d{4}-\d{2}-\d{2}$',d): continue
                days=(datetime.strptime(d,'%Y-%m-%d').date()-datetime.now(timezone.utc).date()).days
                if 0<=days<=14 and app.get('status') not in ('col-3','col-5'):
                    title=f"Deadline risk: {o.get('title')} ({days} days)"; exists=supabase.table('tasks').select('id').eq('organization_id',link['organization_id']).eq('student_user_id',link['student_user_id']).eq('title',title).limit(1).execute().data or []
                    if not exists:
                        supabase.table('tasks').insert({'user_id':link['invited_by'],'organization_id':link['organization_id'],'student_user_id':link['student_user_id'],'application_id':app['id'],'title':title,'priority':'urgent' if days<=5 else 'high','due_at':d+'T12:00:00Z'}).execute(); created+=1
        return created

class GrowthAgent:
    name='growth-agent'
    def run(self,run_id=None):
        since=(datetime.now(timezone.utc)-timedelta(days=7)).isoformat(); rows=supabase.table('analytics_events').select('event_name').gte('created_at',since).execute().data or []; counts={}
        for r in rows: counts[r['event_name']]=counts.get(r['event_name'],0)+1
        return {'period_days':7,'events':counts}

class CostAbuseAgent:
    name='cost-abuse-agent'
    def run(self,run_id=None):
        since=(datetime.now(timezone.utc)-timedelta(hours=24)).isoformat(); rows=supabase.table('ai_usage').select('user_id,credit_cost,success').gte('created_at',since).execute().data or []; totals={}
        for r in rows: totals[r['user_id']]=totals.get(r['user_id'],0)+int(r.get('credit_cost') or 0)
        flagged={u:c for u,c in totals.items() if c>250}
        if flagged: log_event(self.name,f'flagged {len(flagged)} high-usage accounts','warn',run_id,{'counts':flagged})
        return {'users':len(totals),'flagged':len(flagged)}

class ContentAgent:
    name='opportunity-content-agent'
    def run(self,run_id=None,limit=100):
        from content_pipeline import ArticleReconciliationAgent
        return ArticleReconciliationAgent().run(run_id,limit)

class SocialGrowthAgent:
    name='social-growth-agent'
    def run(self,inserted,run_id=None):
        if os.getenv('FACEBOOK_PUBLISH_ENABLED','false').lower() not in ('1','true','yes','on'):
            return {'enabled':False,'attempted':0,'published':0,'errors':0}
        try:
            from facebook_publisher import publish_post
        except Exception as e:
            log_event(self.name,f'publisher unavailable: {e}','warn',run_id)
            return {'enabled':True,'attempted':0,'published':0,'errors':1}
        # Publish every verified opportunity created by this run. Do not pull
        # older rows into the batch: the post count should exactly describe
        # this run and retries remain protected by the publication ledger.
        candidates=[];seen=set()
        for o in inserted or []:
            if o.get('id') and o['id'] not in seen:candidates.append(o);seen.add(o['id'])
        published=0;attempted=0;errors=0;facebook_titles=[];missing_articles=0
        for o in candidates:
            if not o.get('verified'): continue
            latest=supabase.table('global_opportunities').select('verified').eq('id',o['id']).single().execute().data
            if not latest or not latest.get('verified'):continue
            existing=supabase.table('social_publications').select('id').eq('opportunity_id',o['id']).eq('channel','facebook').limit(1).execute().data or []
            if existing: continue
            ready=supabase.table('opportunity_blogs').select('id').eq('opportunity_id',o['id']).neq('content','').limit(1).execute().data
            if not ready:
                missing_articles+=1
                log_event(self.name,f"{o.get('title')}: Facebook skipped because its article is missing",'warn',run_id)
                continue
            base=(os.getenv('SCHOLARPORTAL_BASE_URL') or 'https://scholarportal.site').rstrip('/')
            article=f"{base}/opportunity/{o['id']}/blog"
            msg=facebook_opportunity_message(o,article)
            attempted+=1
            try:
                ext=publish_post(msg,article)
                supabase.table('social_publications').insert({'opportunity_id':o['id'],'channel':'facebook','external_id':ext,'metadata':{'article_url':article}}).execute()
                published+=1;facebook_titles.append(o.get('title') or 'Untitled opportunity')
            except Exception as e:
                errors+=1;log_event(self.name,f"{o.get('title')}: {e}",'warn',run_id)
        return {'enabled':True,'eligible':len(candidates),'attempted':attempted,'published':published,'missing_articles':missing_articles,'errors':errors,'facebook_titles':facebook_titles}

class OpportunitySafetyAgent:
    name='opportunity-safety-agent'
    def run(self,run_id=None,limit=25):
        rows=supabase.table('global_opportunities').select('*').eq('verified',True).order('last_checked_at',desc=True).limit(limit).execute().data or []
        updated=0
        for o in rows:
            flags=[]; score=0; url=(o.get('official_source_url') or o.get('url') or '').lower(); desc=' '.join([str(o.get('description') or ''),str(o.get('funding_details') or '')]).lower()
            if any(x in url for x in ('bit.ly','tinyurl.com','t.me/','wa.me/')): flags.append('shortened_or_messaging_link'); score+=35
            if any(x in desc for x in ('application fee via western union','send money','crypto payment','gift card')): flags.append('suspicious_payment_language'); score+=55
            if not o.get('official_source_url'): flags.append('missing_official_source'); score+=20
            if not o.get('verified'): flags.append('not_verified'); score+=30
            score=min(100,score)
            try:
                supabase.table('global_opportunities').update({'safety_risk_score':score,'safety_flags':flags}).eq('id',o['id']).execute(); updated+=1
            except Exception as e: log_event(self.name,f"{o.get('title')}: {e}",'warn',run_id)
        return {'reviewed':updated,'high_risk':sum(1 for o in rows if int(o.get('safety_risk_score') or 0)>=60)}

class OpportunityFreshnessAgent:
    name='opportunity-freshness-agent'
    def run(self,run_id=None,limit=500):
        rows=supabase.table('global_opportunities').select('id,last_checked_at,deadline,verification_status').eq('verified',True).limit(limit).execute().data or []; updated=0
        now=datetime.now(timezone.utc)
        for o in rows:
            checked=o.get('last_checked_at'); age=999
            if checked:
                try: age=max(0,(now-datetime.fromisoformat(checked.replace('Z','+00:00'))).days)
                except Exception: pass
            score=max(0,100-min(80,age*4))
            if o.get('verification_status')!='verified': score=min(score,40)
            try: supabase.table('global_opportunities').update({'freshness_score':score}).eq('id',o['id']).execute(); updated+=1
            except Exception as e: log_event(self.name,str(e),'warn',run_id)
        return {'scored':updated}

class CommunityModerationAgent:
    name='community-moderation-agent'
    def run(self,run_id=None,limit=100):
        try: rows=supabase.table('content_comments').select('*').eq('status','approved').order('created_at',desc=True).limit(limit).execute().data or []
        except Exception as e: log_event(self.name,f'table unavailable: {e}','warn',run_id); return {'reviewed':0,'hidden':0}
        hidden=0
        spam_terms=('telegram me','whatsapp me','guaranteed scholarship','pay me','send crypto','gift card')
        for c in rows:
            body=(c.get('body') or '').lower(); links=len(re.findall(r'https?://',body)); suspicious=links>=3 or any(t in body for t in spam_terms)
            if suspicious:
                try: supabase.table('content_comments').update({'status':'hidden','updated_at':datetime.now(timezone.utc).isoformat()}).eq('id',c['id']).execute(); hidden+=1
                except Exception as e: log_event(self.name,str(e),'warn',run_id)
        return {'reviewed':len(rows),'hidden':hidden}

class ApplicationCoachAgent:
    name='application-coach-agent'
    def run(self,run_id=None,limit=250):
        apps=supabase.table('user_applications').select('id,user_id,status,opportunity_id,global_opportunities(title,deadline)').limit(limit).execute().data or []; created=0
        now=datetime.now(timezone.utc).date()
        settings_cache={}
        for app in apps:
            uid=app.get('user_id')
            if uid not in settings_cache:
                try:
                    r=supabase.table('user_settings').select('in_app_alerts_enabled,notify_application_updates').eq('user_id',uid).limit(1).execute().data or []
                    settings_cache[uid]=r[0] if r else {}
                except Exception: settings_cache[uid]={}
            prefs=settings_cache[uid]
            if prefs.get('in_app_alerts_enabled',True) is False or prefs.get('notify_application_updates',True) is False: continue
            if app.get('status') in ('col-5','accepted','rejected'): continue
            o=app.get('global_opportunities') or {}; d=o.get('deadline')
            if not d or not re.match(r'^\d{4}-\d{2}-\d{2}$',str(d)): continue
            try: days=(datetime.strptime(d,'%Y-%m-%d').date()-now).days
            except Exception: continue
            if days not in (14,7,3,1): continue
            key=f"coach:{app['id']}:{d}:{days}"
            try:
                exists=supabase.table('notification_deliveries').select('id').eq('user_id',app['user_id']).eq('channel','in_app').eq('delivery_key',key).limit(1).execute().data or []
                if exists: continue
                supabase.table('notification_deliveries').insert({'user_id':app['user_id'],'opportunity_id':app['opportunity_id'],'channel':'in_app','delivery_key':key,'notification_type':'application_coach','metadata':{'title':o.get('title'),'deadline':d,'days_left':days,'application_id':app['id'],'message':f'{days} days left: review requirements, evidence, references, and submission readiness.'}}).execute(); created+=1
            except Exception as e: log_event(self.name,str(e),'warn',run_id)
        return {'coaching_notifications':created}

class OpportunityPipeline:
    def run(self,run_id=None):
        discovered=ResearchAgent().discover(run_id); verified=0; review=0; inserted=[]; review_titles=[]; verifier=VerificationAgent()
        for c in discovered:
            # Avoid reprocessing canonical source URLs.
            exist=supabase.table('global_opportunities').select('id').eq('source_url',c['url']).limit(1).execute().data or []
            if exist: continue
            try:v=verifier.verify_candidate(c,run_id)
            except Exception as e:
                log_event('opportunity-pipeline',f"candidate failed {c.get('url')}: {type(e).__name__}",'warn',run_id)
                continue
            if not v: continue
            d=v['data']; payload={'title':d.get('title') or c.get('title'),'organization':d.get('organization') or domain(c['url']),'country':d.get('country') or 'Global','type':d.get('type') or 'Scholarship','field':d.get('field') or 'All Fields','funding_details':d.get('funding_details') or 'See official source','description':d.get('description') or c.get('snippet') or 'Verified opportunity. See official source.','tags':d.get('tags') or [],'deadline':d.get('deadline') or 'Unknown','url':c['url'],'source_url':c['url'],'official_source_url':v['page']['final_url'],'verified':v['status']=='verified','verification_status':v['status'],'verification_confidence':v['score'],'verified_at':datetime.now(timezone.utc).isoformat() if v['status']=='verified' else None,'last_checked_at':datetime.now(timezone.utc).isoformat(),'requirements':d.get('requirements') or {},'eligibility':d.get('eligibility') or {},'application_requirements':d.get('application_requirements') or {},'change_hash':hash_text(v['page']['text'])}
            if v['status']!='verified':
                review+=1;review_titles.append(payload['title']);queue_review(c,v,run_id); continue # low confidence never auto-publishes
            try:
                row=supabase.table('global_opportunities').insert(payload).execute().data[0]
                # A verified opportunity is publishable only after its full
                # detail article exists. Roll back the parent row if article
                # generation fails so the public opportunity/article counts
                # cannot drift apart.
                from content_pipeline import generate_article
                try:
                    generated=generate_article('opportunity',row['id'],row)
                    ready=supabase.table('opportunity_blogs').select('id').eq('opportunity_id',row['id']).neq('content','').limit(1).execute().data or []
                    if not generated or not ready:raise RuntimeError('Opportunity article was not published')
                except Exception:
                    supabase.table('global_opportunities').delete().eq('id',row['id']).execute()
                    raise
                verified+=1;inserted.append(row)
            except Exception as e:
                log_event('opportunity-pipeline',f"insert/article failed {payload['title']}: {e}",'warn',run_id)
                continue
            try:
                supabase.table('opportunity_sources').insert({'opportunity_id':row['id'],'source_url':v['page']['final_url'],'source_domain':domain(v['page']['final_url']),'source_type':'official','is_official':True,'http_status':v['page']['status'],'content_hash':payload['change_hash'],'metadata':{'search_provider':c.get('search_provider'),'fetch_strategy':v['page']['strategy']}}).execute()
                supabase.table('opportunity_versions').insert({'opportunity_id':row['id'],'content_hash':payload['change_hash'],'snapshot':d,'changed_fields':['created']}).execute()
                supabase.table('opportunity_verifications').insert({'opportunity_id':row['id'],'status':'verified','confidence':v['score'],'checks':v['checks'],'evidence':[v['page']['final_url']],'verifier':self.__class__.__name__}).execute()
            except Exception as e:log_event('opportunity-pipeline',f"audit metadata failed {payload['title']}: {e}",'warn',run_id)
        minimum=max(1,int(os.getenv('MIN_OPPORTUNITIES_PER_RUN','3')))
        return {'discovered':len(discovered),'verified_inserted':verified,'articles_created':verified,'needs_review':review,'minimum_target':minimum,'minimum_met':verified>=minimum,'shortfall':max(0,minimum-verified),'discovered_titles':[c.get('title') or c.get('url') for c in discovered],'published_titles':[o.get('title') for o in inserted],'review_titles':review_titles,'inserted':inserted}

def start_run():
    try: return supabase.table('agent_runs').insert({'agent_name':'daily-orchestrator','status':'running','provider_chain':['cgu','groq','openrouter','nvidia-nim','mistral','google-ai-studio','cerebras','openai']}).execute().data[0]['id']
    except Exception: return None

def finish(run_id,status,metrics,error=None):
    if not run_id:return
    try: supabase.table('agent_runs').update({'status':status,'metrics':metrics,'error':error,'finished_at':datetime.now(timezone.utc).isoformat()}).eq('id',run_id).execute()
    except Exception: pass

def main():
    run_id=start_run(); metrics={}
    try:
        opp_metrics=OpportunityPipeline().run(run_id)
        inserted=opp_metrics.pop('inserted',[])
        metrics['opportunities']=opp_metrics
        # Detail coverage is a public-route invariant, so reconcile it before
        # independent monitoring/specialist agents can fail the run.
        metrics['opportunity_articles']=ContentAgent().run(run_id,limit=None)
        changes=ChangeMonitorAgent().run(run_id); metrics['changes']=len(changes)
        metrics['programs_verified']=ProgramDiscoveryAgent().run(run_id)
        metrics['programs_changed']=ProgramMonitorAgent().run(run_id)
        from specialists import SourceAuditor, ApplicationCompletenessAgent
        metrics['source_audit']=SourceAuditor().run(run_id)
        metrics['application_completeness']=ApplicationCompletenessAgent().run(run_id)
        metrics['social_publications']=SocialGrowthAgent().run(inserted,run_id) if os.getenv('AGENT_ALLOW_OUTBOUND')=='true' else {'skipped':'outbound disabled'}
        notifier=NotificationAgent(); metrics['notifications']=notifier.run(run_id,changes,inserted) if os.getenv('AGENT_ALLOW_OUTBOUND')=='true' else {'skipped':'outbound disabled'}
        metrics['campaign_leads_scored']=CampaignAgent().run(run_id)
        metrics['counselor_tasks_created']=CounselorAgent().run(run_id)
        metrics['growth']=GrowthAgent().run(run_id)
        metrics['cost_abuse']=CostAbuseAgent().run(run_id)
        metrics['opportunity_safety']=OpportunitySafetyAgent().run(run_id)
        metrics['opportunity_freshness']=OpportunityFreshnessAgent().run(run_id)
        metrics['community_moderation']=CommunityModerationAgent().run(run_id)
        metrics['application_coach']=ApplicationCoachAgent().run(run_id)
        run_status='success' if metrics['opportunities'].get('minimum_met') else 'partial'
        metrics['admin_notifications']=notifier.notify_admins('multi-agent',metrics,run_id,run_status)
        finish(run_id,run_status,metrics); print(json.dumps(metrics,indent=2,default=str))
        if run_status=='partial':raise SystemExit(2)
        return metrics
    except Exception as e:
        try:NotificationAgent().notify_admins('multi-agent',{'error':str(e),'metrics':metrics},run_id,'failed')
        except Exception:pass
        finish(run_id,'failed',metrics,str(e)); raise

if __name__=='__main__': main()
