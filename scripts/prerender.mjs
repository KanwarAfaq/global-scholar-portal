// Public article snapshots for crawlers and social previews; never includes private data.
import fs from 'node:fs';
import path from 'node:path';
const file='public/seo-pages.json';
if(!fs.existsSync(file)){console.log('SEO snapshots skipped: run Agent/indexing_agent.py with backend credentials first.');process.exit(0);}
const {base,pages}=JSON.parse(fs.readFileSync(file,'utf8'));
const template=fs.readFileSync('dist/index.html','utf8');
const escape=v=>String(v||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
for(const page of pages){
 if(!page.path.startsWith('/')||page.path.includes('..'))throw new Error('Unsafe SEO path');
 const canonical=base+page.path;
 const structured=page.kind?{'@context':'https://schema.org','@type':page.kind,headline:page.title,description:page.description,url:canonical,dateModified:page.date,publisher:{'@type':'Organization',name:'ScholarPortal'}}:null;
 const head=`<title>${escape(page.title)}</title><meta name="description" content="${escape(page.description)}"><link rel="canonical" href="${escape(canonical)}"><meta property="og:title" content="${escape(page.title)}"><meta property="og:description" content="${escape(page.description)}"><meta property="og:url" content="${escape(canonical)}"><meta property="og:type" content="${page.kind?'article':'website'}"><meta name="twitter:card" content="summary">${structured?`<script type="application/ld+json">${JSON.stringify(structured).replace(/</g,'\\u003c')}</script>`:''}`;
 // Safe plain text prevents stored/generated HTML from executing before React mounts.
 const content=page.content?`<article><h1>${escape(page.title)}</h1><p>${escape(page.content.replace(/<[^>]*>/g,' '))}</p></article>`:'';
 let html=template.replace(/<title>[\s\S]*?<\/title>/,'').replace(/<meta name="description"[^>]*>/g,'').replace('</head>',head.replace(/<(meta|link|script) /g,'<$1 data-rh="true" ')+'</head>').replace('<div id="root"></div>',`<div id="root">${content}</div>`);
 const dest=path.join('dist',page.path,'index.html');fs.mkdirSync(path.dirname(dest),{recursive:true});fs.writeFileSync(dest,html);
}
console.log(`SEO: generated ${pages.length} public snapshots`);
