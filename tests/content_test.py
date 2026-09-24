import unittest,sys,os,json
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch
os.environ['SUPABASE_URL']='https://example.supabase.co'
os.environ['SUPABASE_SERVICE_ROLE_KEY']='test-placeholder'
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'Agent'))
with patch('supabase.create_client'):
    import content_pipeline as pipeline

class Query:
    def __init__(self,db,table):self.db=db;self.table=table;self.filters={};self.op='select';self.payload=None
    def select(self,*a,**k):return self
    def eq(self,k,v):self.filters[k]=v;return self
    def order(self,*a,**k):return self
    def limit(self,*a):return self
    def update(self,value):self.op='update';self.payload=value;return self
    def insert(self,value):self.op='insert';self.payload=value;return self
    def execute(self):
        rows=self.db.rows.setdefault(self.table,[])
        found=[r for r in rows if all(r.get(k)==v for k,v in self.filters.items())]
        if self.op=='insert':
            if self.db.fail_insert:raise RuntimeError('database unavailable')
            rows.append({'id':'new',**self.payload});found=rows[-1:]
        if self.op=='update':
            for row in found:row.update(self.payload)
        return SimpleNamespace(data=found)
class Database:
    def __init__(self):self.rows={'content_jobs':[]};self.fail_insert=False
    def table(self,name):return Query(self,name)
    def rpc(self,name,args):
        self.rows['content_jobs'].append({'kind':args['job_kind'],'entity_key':args['job_key'],'status':'running'})
        return SimpleNamespace(execute=lambda:SimpleNamespace(data=True))

class ContentTests(unittest.TestCase):
    def setUp(self):
        self.db=Database()
        self.result={'text':json.dumps({'title':'Evidence based article','content':'Source-supported paragraph. '*15,'tags':['Research'],'read_time':'3 min'}),'provider':'mistral','model':'fixture'}
    def generate(self,kind,key):
        with patch.object(pipeline,'supabase',self.db),patch.object(pipeline.AI,'run',return_value=self.result):
            return pipeline.generate_article(kind,key,{'title':'Opportunity','url':'https://example.org/apply?id=42'})
    def test_pipelines_write_distinct_route_identifiers(self):
        self.assertTrue(self.generate('opportunity','opp-1'))
        self.assertTrue(self.generate('standalone','research-guide'))
        self.assertEqual(self.db.rows['opportunity_blogs'][0]['opportunity_id'],'opp-1')
        self.assertEqual(self.db.rows['blog_posts'][0]['slug'],'research-guide')
        self.assertTrue(all(x['status']=='published' for x in self.db.rows['content_jobs']))
    def test_repeat_does_not_duplicate(self):
        self.generate('opportunity','opp-1');self.assertFalse(self.generate('opportunity','opp-1'))
        self.assertEqual(len(self.db.rows['opportunity_blogs']),1)
    def test_null_article_is_repaired(self):
        self.db.rows['opportunity_blogs']=[{'id':'existing','opportunity_id':'opp-1','content':None}]
        self.assertTrue(self.generate('opportunity','opp-1'))
        self.assertEqual(len(self.db.rows['opportunity_blogs']),1)
        self.assertTrue(self.db.rows['opportunity_blogs'][0]['content'])
    def test_insert_failure_is_not_reported_as_published(self):
        self.db.fail_insert=True
        with self.assertRaises(RuntimeError):self.generate('opportunity','opp-1')
        self.assertEqual(self.db.rows['content_jobs'][0]['status'],'failed')
    def test_standalone_social_posts_once_per_created_blog(self):
        articles=[{'slug':f'guide-{i}','title':f'Guide {i}','excerpt':'Useful details'} for i in range(7)]
        with patch('facebook_publisher.publish_post',return_value='post-id') as publish,patch.dict(os.environ,{'FACEBOOK_PUBLISH_ENABLED':'true'}):
            result=pipeline.publish_standalone_blogs(articles)
        self.assertEqual(result['eligible'],7)
        self.assertEqual(result['published'],7)
        self.assertEqual(publish.call_count,7)
if __name__=='__main__':unittest.main()
