// Fixtures isolate motion; real-backend.mjs separately verifies persistence.
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const origin=process.env.BASE_URL||'http://127.0.0.1:3131';
const browser=await chromium.launch({headless:true,executablePath:process.env.BROWSER_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe'});
fs.mkdirSync('../scratch/sidebar-motion',{recursive:true});
try {
 for(const policy of ['full']){
  const context=await browser.newContext({viewport:{width:policy==='coarse'?390:1440,height:1000},reducedMotion:policy==='reduced'?'reduce':'no-preference',hasTouch:policy==='coarse',isMobile:policy==='coarse'});
  await context.addInitScript(()=>sessionStorage.setItem('postcraft_token','motion-fixture'));
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  const id='11111111-1111-4111-8111-111111111111';
  const record={generation_id:id,project_id:id,topic:'A clearer decision',platform:'linkedin',status:'editing',active_draft_index:1,created_at:new Date().toISOString(),updated_at:new Date().toISOString(),preview:'Give each review a named owner and a next action.',draft_1:'Give each review a named owner and a next action.',draft_2:'Review the decision, then name its owner.',draft_3:'One clear owner is a useful starting point.',raw_thoughts:'Practical review ownership',sources:[],chat_history:[],quality:null};
  await page.route('**/api/**',async route=>{const u=new URL(route.request().url());let body={};if(u.pathname==='/api/users/me')body={id:'motion-user',username:'writer',is_admin:false};else if(u.pathname==='/api/users/me/resume')body=null;else if(u.pathname.endsWith('/metrics'))body={total:1,finalized:0,in_progress:1,recent_dates:[new Date().toISOString()]};else if(u.pathname.endsWith('/full'))body=record;else body={items:[record],total:1,offset:0,limit:20};await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(body)});});

  await page.goto(origin); await page.locator('#quick-thought').waitFor();
  await page.waitForFunction(()=>document.documentElement.dataset.motionPaused==='false');
  const rail=page.locator('aside.workspace-sidebar-surface');
  await rail.getByRole('button',{name:'Collapse sidebar',exact:true}).focus(); await page.keyboard.press('Enter');
  const samples=await page.evaluate(async()=>{const values=[];for(let i=0;i<40;i++){await new Promise(requestAnimationFrame);values.push({width:document.querySelector('.workspace-sidebar-surface').getBoundingClientRect().width,inset:parseFloat(getComputedStyle(document.querySelector('.workspace-main')).paddingLeft)});}return values;});
  assert.ok(samples.some(s=>s.width>81&&s.width<235),'Sidebar actually interpolates');
  assert.ok(samples.every(s=>Math.abs(s.width-s.inset)<1),'Rail and page move cohesively');
  await page.waitForFunction(()=>document.querySelector('.workspace-sidebar-surface').getBoundingClientRect().width===80);
  assert.equal(await rail.getByRole('button',{name:'Expand sidebar',exact:true}).getAttribute('aria-expanded'),'false');
  await rail.getByRole('button',{name:'History',exact:true}).click();
  await page.getByRole('heading',{name:'Every idea has a place.'}).waitFor();
  await page.reload(); await rail.getByRole('button',{name:'Expand sidebar',exact:true}).waitFor();await page.waitForTimeout(700);
  assert.equal((await rail.boundingBox()).width,80,'Preference survives navigation and reload');
  await page.screenshot({path:'../scratch/sidebar-motion/collapsed.png'});
  await rail.getByRole('button',{name:'Dark',exact:true}).click();await page.screenshot({path:'../scratch/sidebar-motion/collapsed-dark.png'});
  await rail.getByRole('button',{name:'Expand sidebar',exact:true}).click();await rail.getByRole('button',{name:'Collapse sidebar',exact:true}).click();await rail.getByRole('button',{name:'Expand sidebar',exact:true}).click();await page.waitForTimeout(700);
  assert.equal((await rail.boundingBox()).width,236,'Interrupted transitions settle correctly');await page.screenshot({path:'../scratch/sidebar-motion/expanded.png'});
  await page.getByRole('button',{name:'Pause motion',exact:true}).click();await rail.getByRole('button',{name:'Collapse sidebar',exact:true}).click();assert.equal((await rail.boundingBox()).width,80,'Paused mode is immediate');
  await page.setViewportSize({width:390,height:844});assert.equal(await page.locator('.workspace-main').evaluate(el=>getComputedStyle(el).paddingLeft),'0px');
  await page.getByRole('button',{name:'Open navigation',exact:true}).click();const dialog=page.getByRole('dialog');await dialog.waitFor();assert.equal(await dialog.locator('.workspace-sidebar').getAttribute('data-collapsed'),'false');
  await dialog.getByRole('button',{name:'Close navigation',exact:true}).click();await dialog.waitFor({state:'hidden'});
  await page.getByRole('button',{name:'Open navigation',exact:true}).click();await dialog.getByRole('button',{name:'Home',exact:true}).click();await page.locator('#quick-thought').waitFor();assert.ok(await page.evaluate(()=>document.body.scrollWidth<=innerWidth+1));await page.screenshot({path:'../scratch/sidebar-motion/mobile.png'});
  await page.setViewportSize({width:1440,height:1000});await page.getByRole('button',{name:'Resume motion',exact:true}).click();await page.emulateMedia({reducedMotion:'reduce'});await rail.getByRole('button',{name:'Expand sidebar',exact:true}).click();assert.equal((await rail.boundingBox()).width,236,'OS reduced motion is immediate');
  await page.evaluate(()=>{const original=Storage.prototype.setItem;Storage.prototype.setItem=function(key,value){if(key==='postcraft:sidebar-collapsed')throw new DOMException('Full','QuotaExceededError');return original.call(this,key,value);};});
  await rail.getByRole('button',{name:'Collapse sidebar',exact:true}).click();assert.equal((await rail.boundingBox()).width,80,'Storage failure does not disable toggle');
  await page.setViewportSize({width:1440,height:600});
  const sidebar=rail.locator('.workspace-sidebar');
  assert.equal(await sidebar.evaluate(el=>getComputedStyle(el).scrollbarWidth),'none','Sidebar scrollbar stays hidden');
  await rail.getByRole('button',{name:'Terms',exact:true}).focus();
  assert.ok(await sidebar.evaluate(el=>el.scrollTop>0),'Keyboard focus reaches lower controls on short screens');
  await page.screenshot({path:'../scratch/sidebar-motion/short-no-scrollbar.png'});
  assert.deepEqual(errors,[]);await context.close();
 }
 console.log('Sidebar passed: interpolated width, synchronized layout, keyboard, interruption, persistence, icon navigation, themes, pause/reduce, mobile drawer and no overflow.');
}finally{await browser.close();}
