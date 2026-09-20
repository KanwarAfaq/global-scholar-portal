import {test,expect} from '@playwright/test';
const user={id:'11111111-1111-4111-8111-111111111111',email:'qa@example.test',app_metadata:{role:'admin'},user_metadata:{},aud:'authenticated',role:'authenticated'};
const profile={id:'22222222-2222-4222-8222-222222222222',user_id:user.id,profile_name:'QA Master',full_name:'QA Candidate',technical_skills:{cloud:['AWS','GCP']},research_interests:['Edge AI'],education:[{degree:'Master of Computer Science',school:'Example University'}],updated_at:'2026-01-01T00:00:00Z'};
const opp={id:'33333333-3333-4333-8333-333333333333',title:'Computer Science Fellowship',organization:'Example University',type:'PhD',country:'Switzerland',field:'Computer Science',verified:true,deadline:'2027-11-30',funding_details:'Full salary',tags:['Research funding'],url:'https://example.org/apply?id=42',created_at:'2026-09-17T00:00:00Z'};
test.beforeEach(async({page})=>{
 await page.addInitScript(({user})=>{const encode=x=>btoa(JSON.stringify(x));const token=encode({alg:'HS256',typ:'JWT'})+'.'+encode({sub:user.id,exp:2100000000})+'.test';localStorage.setItem('sb-fixture-auth-token',JSON.stringify({access_token:token,refresh_token:'fixture',expires_at:2100000000,expires_in:3600,token_type:'bearer',user}));},{user});
 await page.route('https://fixture.supabase.co/**',async route=>{
 const req=route.request(),url=new URL(req.url());let value=[];
 if(url.pathname.includes('/auth/'))value=user;
 else if(url.pathname.includes('/functions/'))value={rows:[],queue:[],runs:[],events:[],referrals:[],sponsorAccounts:[],campaigns:[],editable:[],metrics:{}};
 else if(url.pathname.includes('/rpc/opportunity_article_status'))value='pending';
 else {const table=url.pathname.split('/').pop();const tables={user_profiles:[profile],global_opportunities:[opp],user_applications:[{id:'44444444-4444-4444-8444-444444444444',opportunity_id:opp.id,status:'col-1',global_opportunities:opp}],user_settings:[{user_id:user.id}],ai_generations:[{id:'gen',action:'requirements',title:'Requirements',structured_output:{documents:['CV']},created_at:'2026-09-17'}],user_match_scores:[{profile_id:profile.id,opportunity_id:opp.id,score:75,eligible:true,explanation:'Saved assessment',calculated_at:'2026-09-17',assessment_version:'evidence-v2'}]};value=tables[table]||[];if(req.headers()['accept']?.includes('vnd.pgrst.object'))value=value[0]||null;}
 await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(value),headers:{'access-control-allow-origin':'*'}});
 });
});
for(const width of [390,1440])for(const theme of ['light','dark'])test(`core pages ${width} ${theme}`,async({page})=>{
 await page.setViewportSize({width,height:900});await page.addInitScript(theme=>localStorage.setItem('theme',theme),theme);
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 for(const route of ['/profiles','/copilot','/settings','/dashboard']){
 await page.goto(route);await expect(page.locator('main h1').first()).toBeVisible();
 if(route==='/profiles'){await page.getByRole('button',{name:'Technical Skills & Research Interests'}).click();await expect(page.getByPlaceholder('Skills (comma separated)')).toHaveValue('AWS, GCP');}
 if(route==='/settings')expect(await page.locator('select[multiple] option').count()).toBeGreaterThan(10);
 if(route==='/copilot'){await expect(page.getByRole('button',{name:'Generate draft'})).toBeVisible();await expect(page.locator('main select').first()).toHaveValue('44444444-4444-4444-8444-444444444444');}
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBeTruthy();
 }
 expect(errors).toEqual([]);
 await page.screenshot({path:`test-results/dashboard-${width}-${theme}.png`,fullPage:true});
});
test('pending article does not claim a missing published blog',async({page})=>{await page.goto(`/opportunity/${opp.id}/blog`);await expect(page.getByText('Article pending',{exact:true})).toBeVisible();});
test('mobile Blog navigation is reachable',async({page})=>{await page.setViewportSize({width:390,height:824});await page.goto('/dashboard');await page.getByRole('button',{name:'Toggle navigation menu'}).click();await expect(page.locator('aside').getByRole('link',{name:'Blog',exact:true})).toBeVisible();});

for(const width of [390,1440])for(const theme of ['light','dark'])test(`remaining routes ${width} ${theme}`,async({page})=>{
 test.setTimeout(90000);
 await page.setViewportSize({width,height:900});await page.addInitScript(t=>localStorage.setItem('theme',t),theme);
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 for(const route of ['/programs','/sponsored','/sponsor','/counselor','/counselor-invites','/applications','/analytics','/notifications','/account','/pricing','/blog','/admin','/quality','/resume-builder']){
  await page.goto(route);await expect(page.locator('main')).toBeVisible();await page.waitForTimeout(350);
  await expect(page.getByText('This page needs a fresh start')).toHaveCount(0);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),route).toBeTruthy();
 }
 expect(errors).toEqual([]);
});
