import unittest,os,sys,tempfile,json
from pathlib import Path
from unittest.mock import patch
os.environ['SUPABASE_URL']='https://example.supabase.co';os.environ['SUPABASE_SERVICE_ROLE_KEY']='test-placeholder'
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'Agent'))
with patch('supabase.create_client'):
    import indexing_agent
class IndexingTests(unittest.TestCase):
    def test_public_routes_only_latest_nonempty_article(self):
        records={'blog_posts':[{'slug':'guide','title':'Guide','content':'Published text'},{'slug':'empty','title':'Empty','content':None}], 'opportunity_blogs':[{'opportunity_id':'o1','title':'Old','content':'Old','updated_at':'2025-01-01'},{'opportunity_id':'o1','title':'Latest','content':'Updated','updated_at':'2026-01-01'},{'opportunity_id':'o2','title':'Pending','content':None}]}
        with tempfile.TemporaryDirectory() as d,patch.dict(os.environ,{'SCHOLARPORTAL_BASE_URL':'https://example.org'}),patch.object(indexing_agent,'all_rows',side_effect=lambda t:records[t]):
            result=indexing_agent.build(d);manifest=json.loads(Path(d,'seo-pages.json').read_text())
            self.assertEqual(result['public_pages'],8)
            pages={x['path']:x for x in manifest['pages']}
            self.assertEqual(pages['/opportunity/o1/blog']['title'],'Latest')
            self.assertIn('/terms',pages);self.assertIn('/privacy-policy',pages)
            self.assertNotIn('/account',pages);self.assertNotIn('/blog/empty',pages)
            self.assertIn('https://example.org/blog/guide',Path(d,'sitemap.xml').read_text())
if __name__=='__main__':unittest.main()
