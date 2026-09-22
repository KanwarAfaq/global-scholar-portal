import unittest,os,sys
from pathlib import Path
from unittest.mock import patch
os.environ['SUPABASE_URL']='https://example.supabase.co';os.environ['SUPABASE_SERVICE_ROLE_KEY']='test-placeholder'
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'Agent'))
with patch('supabase.create_client'):
    import core
    import orchestrator
from content_pipeline import article_schema
class AgentTests(unittest.TestCase):
    def test_opportunity_score_boundary_routes_to_correct_destination(self):
        self.assertEqual(orchestrator.verification_status(70),'needs_review')
        self.assertEqual(orchestrator.verification_status(71),'verified')
        self.assertEqual(orchestrator.verification_status(100),'verified')
    def test_facebook_caption_routes_reader_through_scholarportal(self):
        message=orchestrator.facebook_opportunity_message({'title':'Global Scholarship','organization':'Example University','country':'Taiwan','deadline':'2027-01-15','funding_details':'Full tuition and stipend','type':'Scholarship'},'https://scholarportal.site/opportunity/abc/blog')
        self.assertIn('NEW VERIFIED OPPORTUNITY',message)
        self.assertIn('https://scholarportal.site/opportunity/abc/blog',message)
        self.assertIn('official source is provided inside',message)
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
