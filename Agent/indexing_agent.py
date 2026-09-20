"""Generate public SEO artifacts; optionally submit a sitemap to Search Console.
No Indexing API calls: ordinary articles are not eligible for that API.
"""
import argparse,json,os,re
from pathlib import Path
from urllib.parse import quote,urlparse
from xml.etree.ElementTree import Element,SubElement,tostring
from core import supabase
from content_pipeline import all_rows

def build(output=None):
    base=os.getenv('SCHOLARPORTAL_BASE_URL',os.getenv('FRONTEND_URL','https://scholarportal.site')).rstrip('/')
    if urlparse(base).scheme!='https':raise ValueError('Use the public HTTPS origin')
    out=Path(output) if output else Path(__file__).resolve().parents[1]/'public'
    out.mkdir(parents=True,exist_ok=True)
    pages=[{'path':path,'title':title,'description':desc} for path,title,desc in [('/', 'ScholarPortal — Global opportunities','Discover academic funding and plan your applications.'),('/blog','ScholarPortal Blog','Research and practical guidance for academic applications.'),('/programs','Degree programs','Explore degree programs and official sources.'),('/pricing','Plans and pricing','Compare application tools and allowances.')]]
    for row in all_rows('blog_posts'):
        if not (row.get('content') or '').strip() or not row.get('slug'):continue
        pages.append({'path':'/blog/'+quote(row['slug'],safe=''),'title':row['title'],'description':row.get('excerpt') or row['title'],'content':row['content'],'date':row.get('updated_at') or row.get('created_at'),'kind':'Article','image':row.get('image')})
    seen=set()
    # Stable iteration, one canonical per opportunity. Never index missing/empty articles.
    blogs=list(all_rows('opportunity_blogs'))
    for row in sorted(blogs,key=lambda r:r.get('updated_at') or r.get('created_at') or '',reverse=True):
        oid=row.get('opportunity_id')
        if not oid or oid in seen or not (row.get('content') or '').strip():continue
        seen.add(oid)
        pages.append({'path':f'/opportunity/{quote(oid,safe="")}/blog','title':row['title'],'description':row.get('excerpt') or row['title'],'content':row['content'],'date':row.get('updated_at') or row.get('created_at'),'kind':'Article','image':row.get('image')})
    root=Element('urlset',xmlns='http://www.sitemaps.org/schemas/sitemap/0.9')
    for page in pages:
        node=SubElement(root,'url');SubElement(node,'loc').text=base+page['path']
        if page.get('date'):SubElement(node,'lastmod').text=page['date']
    (out/'sitemap.xml').write_bytes(tostring(root,encoding='utf-8',xml_declaration=True))
    (out/'robots.txt').write_text('User-agent: *\nAllow: /\nSitemap: '+base+'/sitemap.xml\n')
    (out/'seo-pages.json').write_text(json.dumps({'base':base,'pages':pages},ensure_ascii=False),encoding='utf-8')
    return {'public_pages':len(pages),'sitemap':base+'/sitemap.xml','status':'generated; deploy artifacts before submission'}

def submit(sitemap):
    # Explicit CLI opt-in. Credentials stay local; google-auth refreshes short-lived tokens.
    import google.auth
    from google.auth.transport.requests import AuthorizedSession
    credentials,_=google.auth.default(scopes=['https://www.googleapis.com/auth/webmasters'])
    site=os.environ['GOOGLE_SEARCH_CONSOLE_SITE']
    session=AuthorizedSession(credentials)
    # Confirm sitemap is deployed before asking Google to fetch it.
    import requests
    response=requests.get(sitemap,timeout=20);response.raise_for_status()
    if '<urlset' not in response.text and '<sitemapindex' not in response.text:raise ValueError('Deployed URL is not an XML sitemap')
    response=session.put('https://www.googleapis.com/webmasters/v3/sites/'+quote(site,safe='')+'/sitemaps/'+quote(sitemap,safe=''),timeout=30)
    if not response.ok:raise RuntimeError(f'Search Console HTTP {response.status_code}')
    return 'Sitemap submitted; indexing is not guaranteed'

if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--submit',action='store_true');parser.add_argument('--output');args=parser.parse_args()
    result=build(args.output)
    if args.submit:result['submission']=submit(result['sitemap'])
    print(json.dumps(result,indent=2))
