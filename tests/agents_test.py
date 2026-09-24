import unittest,os,sys
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import MagicMock,patch
os.environ['SUPABASE_URL']='https://example.supabase.co';os.environ['SUPABASE_SERVICE_ROLE_KEY']='test-placeholder'
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'Agent'))
with patch('supabase.create_client'):
    import core
    import orchestrator
    import dispatch_notifications
from content_pipeline import article_schema
class AgentTests(unittest.TestCase):
    def test_ai_list_type_is_normalized_without_crashing_run(self):
        self.assertEqual(orchestrator.normalize_opportunity_type(['PhD','Scholarship']),'PhD')
        self.assertEqual(orchestrator.normalize_opportunity_type(['Unknown','Other']),'Scholarship')
    def test_user_match_rules_respect_all_saved_preferences(self):
        settings={'alert_countries_v2':['Taiwan'],'alert_levels_v2':['PhD'],'alert_fields_v2':['Computer Science']}
        matching={'country':'Taiwan','type':'PhD Scholarship','field':'Computer Science','tags':[]}
        wrong_field={**matching,'field':'Medicine'}
        self.assertTrue(dispatch_notifications.match_rules(matching,settings))
        self.assertFalse(dispatch_notifications.match_rules(wrong_field,settings))
    def test_digest_cutoff_uses_selected_frequency(self):
        now=orchestrator.datetime(2026,9,23,tzinfo=orchestrator.timezone.utc)
        cutoff=dispatch_notifications.digest_cutoff({'alert_frequency':'monthly'},None,now)
        self.assertEqual((now-cutoff).days,31)
    def test_long_line_reports_are_split_within_api_limits(self):
        chunks=dispatch_notifications.line_message_chunks('\n'.join(['Opportunity title']*700))
        self.assertGreater(len(chunks),1)
        self.assertLessEqual(len(chunks),5)
        self.assertTrue(all(len(chunk)<=4800 for chunk in chunks))
    def test_admin_numeric_summary_renders_integer_counts(self):
        database=MagicMock();database.auth.admin.list_users.return_value=[]
        report={'standalone_articles_created':3,'social_publications':{'published':3,'errors':0}}
        with patch.object(dispatch_notifications,'supabase',database),patch.object(dispatch_notifications.EMAIL,'send',return_value='smtp') as send,patch.dict(os.environ,{'ADMIN_NOTIFICATION_EMAIL':'admin@example.org'},clear=False):
            result=dispatch_notifications.NotificationAgent().notify_admins('standalone-blog',report,status='success')
        self.assertEqual(result['email'],1)
        self.assertIn('>3<',send.call_args.args[2])
    def test_opportunity_score_boundary_routes_to_correct_destination(self):
        self.assertEqual(orchestrator.verification_status(70),'needs_review')
        self.assertEqual(orchestrator.verification_status(71),'verified')
        self.assertEqual(orchestrator.verification_status(100),'verified')
    def test_facebook_caption_routes_reader_through_scholarportal(self):
        message=orchestrator.facebook_opportunity_message({'title':'Global Scholarship','organization':'Example University','country':'Taiwan','deadline':'2027-01-15','funding_details':'Full tuition and stipend','type':'Scholarship'},'https://scholarportal.site/opportunity/abc/blog')
        self.assertIn('NEW VERIFIED OPPORTUNITY',message)
        self.assertIn('https://scholarportal.site/opportunity/abc/blog',message)
        self.assertIn('official source is provided inside',message)
    def test_social_agent_posts_every_inserted_verified_opportunity(self):
        class Query:
            def __init__(self,table):self.table=table;self.op='select'
            def select(self,*a,**k):return self
            def eq(self,*a,**k):return self
            def neq(self,*a,**k):return self
            def limit(self,*a,**k):return self
            def single(self):return self
            def insert(self,*a,**k):self.op='insert';return self
            def execute(self):
                if self.table=='global_opportunities':return SimpleNamespace(data={'verified':True})
                if self.table=='opportunity_blogs':return SimpleNamespace(data=[{'id':'article'}])
                return SimpleNamespace(data=[])
        database=SimpleNamespace(table=lambda name:Query(name))
        opportunities=[{'id':f'opp-{i}','title':f'Opportunity {i}','verified':True} for i in range(10)]
        with patch.object(orchestrator,'supabase',database),patch('facebook_publisher.publish_post',return_value='post-id') as publish,patch.dict(os.environ,{'FACEBOOK_PUBLISH_ENABLED':'true'}):
            result=orchestrator.SocialGrowthAgent().run(opportunities)
        self.assertEqual(result['eligible'],10)
        self.assertEqual(result['attempted'],10)
        self.assertEqual(result['published'],10)
        self.assertEqual(publish.call_count,10)
    def test_query_identifiers_survive_canonicalization(self):
        self.assertEqual(core.canonical_url('https://example.org/apply?id=42&utm_source=test'),'https://example.org/apply?id=42')
    @patch('core.platform_setting',return_value={})
    def test_invalid_json_falls_through(self,_):
        ai=core.AICascade();ai.providers=[('cgu',lambda *a:('not json','test')),('mistral',lambda *a:('{"ok":true}','test'))]
        result=ai.run('Return JSON',True);self.assertEqual(result['provider'],'mistral');self.assertFalse(result['attempts'][0]['ok'])
    @patch('core.platform_setting',return_value={})
    def test_empty_response_falls_through(self,_):
        ai=core.AICascade();ai.providers=[('cgu',lambda *a:('','test')),('nvidia-nim',lambda *a:('OK','test'))]
        self.assertEqual(ai.run('test')['provider'],'nvidia-nim')
    @patch('core.platform_setting',return_value={})
    def test_schema_failure_falls_through(self,_):
        ai=core.AICascade();valid='{"title":"A","content":"'+('x'*210)+'","tags":[]}'
        ai.providers=[('cgu',lambda *a:('{"title":"A"}','test')),('openrouter',lambda *a:(valid,'test'))]
        self.assertEqual(ai.run('JSON',True,article_schema)['provider'],'openrouter')
    @patch('core.platform_setting',return_value={'enabled':False})
    def test_kill_switch_blocks_provider(self,_):
        ai=core.AICascade();ai.providers=[('cgu',lambda *a:self.fail('Must not call provider'))]
        with self.assertRaises(RuntimeError):ai.run('test')
if __name__=='__main__':unittest.main()
