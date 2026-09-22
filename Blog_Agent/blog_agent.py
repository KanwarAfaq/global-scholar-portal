"""Standalone researched blogs. Never writes opportunity_blogs."""
import argparse,sys,json,os
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'Agent'))
from content_pipeline import StandaloneBlogAgent
from dispatch_notifications import NotificationAgent
if __name__=='__main__':
    parser=argparse.ArgumentParser()
    parser.add_argument('--query',default='official university graduate admissions scholarship application guidance')
    parser.add_argument('--limit',type=int,default=2)
    args=parser.parse_args()
    result=StandaloneBlogAgent().run(args.query,max(1,min(args.limit,10)))
    if os.getenv('AGENT_ALLOW_OUTBOUND')=='true':
        notifier=NotificationAgent()
        result['user_notifications']=notifier.run(None,[])
        result['admin_notifications']=notifier.notify_admins('standalone-blog',result,None,'success')
    else:
        result['notifications']={'skipped':'outbound disabled'}
    print(json.dumps(result,indent=2))
