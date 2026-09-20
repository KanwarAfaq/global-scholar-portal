"""Operator-selected tasks. Source auditing and content tasks write database records."""
import argparse,json
from core import supabase
from specialists import SourceAuditor,EligibilityValidator,ApplicationCompletenessAgent
from content_pipeline import ArticleReconciliationAgent
from indexing_agent import build
if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('task',choices=['source-audit','articles','eligibility','completeness','indexing']);p.add_argument('--profile-id');p.add_argument('--opportunity-id');p.add_argument('--limit',type=int,default=4);a=p.parse_args()
    limit=max(1,min(a.limit,20))
    if a.task=='source-audit':result=SourceAuditor().run(limit=limit)
    elif a.task=='articles':result=ArticleReconciliationAgent().run(limit=limit)
    elif a.task=='indexing':result=build()
    else:
        if not a.profile_id or not a.opportunity_id:p.error('profile-id and opportunity-id required')
        profile=supabase.table('user_profiles').select('*').eq('id',a.profile_id).single().execute().data
        opp=supabase.table('global_opportunities').select('*').eq('id',a.opportunity_id).single().execute().data
        result=EligibilityValidator().assess(profile,opp) if a.task=='eligibility' else ApplicationCompletenessAgent().assess(profile,opp,[])
    print(json.dumps(result,indent=2))
