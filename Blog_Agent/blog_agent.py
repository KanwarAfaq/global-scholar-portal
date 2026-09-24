"""Standalone researched blogs. Never writes opportunity_blogs."""
import argparse,sys,json,os
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'Agent'))
from content_pipeline import StandaloneBlogAgent,publish_standalone_blogs
from dispatch_notifications import NotificationAgent
if __name__=='__main__':
    parser=argparse.ArgumentParser()
    parser.add_argument('--query',default='official university graduate admissions scholarship application guidance')
    parser.add_argument('--minimum',type=int,default=3)
    args=parser.parse_args()
    notifier=NotificationAgent();result={}
    try:
        result=StandaloneBlogAgent().run(args.query,max(1,args.minimum))
        created_articles=result.pop('created_articles',[])
        result['social_publications']=publish_standalone_blogs(created_articles) if os.getenv('AGENT_ALLOW_OUTBOUND')=='true' else {'skipped':'outbound disabled'}
        status='success' if result.get('minimum_met') else 'partial'
        if os.getenv('AGENT_ALLOW_OUTBOUND')=='true':
            # A blog-only run must never send old opportunity digests to users.
            result['admin_notifications']=notifier.notify_admins('standalone-blog',result,None,status)
        else:result['admin_notifications']={'skipped':'outbound disabled'}
        print(json.dumps(result,indent=2))
        if status=='partial':raise SystemExit(2)
    except Exception as exc:
        if os.getenv('AGENT_ALLOW_OUTBOUND')=='true':
            notifier.notify_admins('standalone-blog',{'error':str(exc),'metrics':result},None,'failed')
        raise
