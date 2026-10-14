"""One-time, duplicate-safe Facebook backfill for verified opportunities."""
import json
import os

from core import supabase
from dispatch_notifications import NotificationAgent
from orchestrator import SocialGrowthAgent


def main():
    start=os.getenv('BACKFILL_START','2026-10-12T00:00:00Z')
    end=os.getenv('BACKFILL_END','2026-10-14T12:16:37Z')
    expected=max(1,int(os.getenv('BACKFILL_EXPECTED','29')))
    rows=(supabase.table('global_opportunities').select('*').eq('verified',True)
          .gte('created_at',start).lt('created_at',end)
          .order('created_at').limit(expected+1).execute().data or [])
    if len(rows)!=expected:
        raise RuntimeError(f'Backfill safety check failed: expected {expected} opportunities, found {len(rows)}')

    result=SocialGrowthAgent().run(rows)
    ids=[row['id'] for row in rows]
    ledger=(supabase.table('social_publications').select('opportunity_id')
            .eq('channel','facebook').in_('opportunity_id',ids).execute().data or [])
    covered=len({row.get('opportunity_id') for row in ledger})
    report={
        'opportunities':{'discovered':expected,'verified_inserted':expected,'needs_review':0,'articles_created':expected},
        'social_publications':{**result,'covered':covered,'target':expected},
        'notifications':{'email':0,'line':0},
    }
    status='success' if covered==expected and not result.get('errors') and not result.get('missing_articles') else 'failed'
    NotificationAgent().notify_admins('facebook-backfill',report,status=status)
    print(json.dumps(report,indent=2,default=str),flush=True)
    if status!='success':
        raise SystemExit(2)


if __name__=='__main__':
    main()
