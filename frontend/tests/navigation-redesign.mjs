// Browser regressions for public history, regeneration ownership, and URL input.
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
const origin=process.env.BASE_URL||'http://127.0.0.1:3000';
const browser=await chromium.launch({headless:true,executablePath:process.env.BROWSER_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe'});
try {
 const publicContext=await browser.newContext({reducedMotion:'reduce'});const legal=await publicContext.newPage();
 await legal.goto(origin);await legal.getByRole('button',{name:'Privacy',exact:true}).click();await legal.getByRole('heading',{name:'Privacy Policy',exact:true}).waitFor();
 await legal.goBack();await legal.locator('#username').waitFor();
 await legal.goForward();await legal.getByRole('heading',{name:'Privacy Policy',exact:true}).waitFor();await publicContext.close();
 const context=await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:'reduce'});
 await context.addInitScript(()=>sessionStorage.setItem('postcraft_token','navigation-fixture'));
 const page=await context.newPage();const requests=[];
 const aid='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',bid='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
 const item={generation_id:bid,project_id:aid,topic:'Historical post B',raw_thoughts:'The distinct observation that belongs to post B.',platform:'linkedin',status:'editing',active_draft_index:1,created_at:'2026-10-18T12:00:00Z',updated_at:'2026-10-18T12:00:00Z',draft_1:'Historical B draft one.',draft_2:'Historical B draft two.',draft_3:'Historical B draft three.',sources:[],quality:null,chat_history:[]};
 await page.route('**/api/**',async route=>{const u=new URL(route.request().url()),method=route.request().method();let body={},status=200;
  if(method==='OPTIONS')status=204;
  else if(u.pathname==='/api/users/me')body={id:'nav-writer',username:'writer',is_admin:false};
  else if(u.pathname==='/api/users/me/resume')body=null;
  else if(u.pathname.endsWith('/metrics'))body={total:1,finalized:0,in_progress:1,recent_dates:[]};
  else if(u.pathname.endsWith('/full'))body=item;
  else if(u.pathname==='/api/generations'&&method==='POST'){const data=route.request().postDataJSON();requests.push(data);body={...item,...data,generation_id:aid,status:'editing'};}
  else if(u.pathname==='/api/generations')body={items:[item],total:1,limit:20,offset:0};
  else {status=404;body={detail:'Unexpected navigation fixture endpoint'};}
  await route.fulfill({status,contentType:'application/json',headers:{'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Headers':'Authorization, Content-Type','Access-Control-Allow-Methods':'GET, POST, OPTIONS'},body:status===204?'':JSON.stringify(body)});
 });
 await page.goto(origin);await page.getByRole('button',{name:'New post',exact:true}).first().click();
 await page.locator('#topic').fill('Unrelated post A');await page.locator('#rawThoughts').fill('The unrelated author notes for A.');
 await page.getByRole('button',{name:'Generate Drafts',exact:true}).click();await page.getByRole('heading',{name:'Find your starting point.',exact:true}).waitFor();
 await page.getByRole('button',{name:'History',exact:true}).click();await page.getByRole('button',{name:'Continue writing',exact:true}).click();await page.getByRole('textbox',{name:'Draft text',exact:true}).waitFor();
 await page.getByRole('button',{name:'All variations',exact:true}).click();await page.getByRole('button',{name:'Regenerate drafts',exact:true}).click();
 await page.locator('#topic').waitFor();assert.equal(await page.locator('#topic').inputValue(),'Historical post B');assert.equal(requests.length,1,'opening history must discard unrelated cached generation inputs');
 await page.getByRole('button',{name:'Generate Drafts',exact:true}).click();await page.getByRole('heading',{name:'Find your starting point.',exact:true}).waitFor();assert.equal(requests[1].topic,'Historical post B');assert.equal(requests[1].raw_thoughts,item.raw_thoughts);
 await page.goto(`${origin}/?view=editor&generation=${bid}&draft=1.5`);await page.getByRole('textbox',{name:'Draft text',exact:true}).waitFor();assert.equal(await page.getByRole('textbox',{name:'Draft text',exact:true}).inputValue(),item.draft_1);assert.equal(new URL(page.url()).searchParams.get('draft'),'1');
 console.log('Navigation regressions passed: public legal Back/Forward, regeneration inputs from the correct post, and fractional draft URL normalization. Fixtures only.');
}finally{await browser.close();}
