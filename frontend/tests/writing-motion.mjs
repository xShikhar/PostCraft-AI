// Fixtures isolate motion; real-backend.mjs separately verifies persistence.
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const origin=process.env.BASE_URL||'http://127.0.0.1:3131';
const browser=await chromium.launch({headless:true,executablePath:process.env.BROWSER_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe'});
fs.mkdirSync('../scratch/writing-motion',{recursive:true});
try {
 for(const policy of ['full']){
  const context=await browser.newContext({viewport:{width:policy==='coarse'?390:1440,height:1000},reducedMotion:policy==='reduced'?'reduce':'no-preference',hasTouch:policy==='coarse',isMobile:policy==='coarse'});
  await context.addInitScript(()=>sessionStorage.setItem('postcraft_token','motion-fixture'));
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  const id='11111111-1111-4111-8111-111111111111';
  const record={generation_id:id,project_id:id,topic:'A clearer decision',platform:'linkedin',status:'editing',active_draft_index:1,created_at:new Date().toISOString(),updated_at:new Date().toISOString(),preview:'Give each review a named owner and a next action.',draft_1:'Give each review a named owner and a next action.',draft_2:'Review the decision, then name its owner.',draft_3:'One clear owner is a useful starting point.',raw_thoughts:'Practical review ownership',sources:[],chat_history:[],quality:null};
  let failSave=true;
  await page.addInitScript(()=>{window.paperTransitions=0;window.paperReady=0;window.paperFinished=0;const original=document.startViewTransition?.bind(document);if(original)document.startViewTransition=(fn)=>{window.paperTransitions++;const transition=original(fn);transition.finished.then(()=>window.paperFinished++).catch(()=>{});transition.ready.then(()=>window.paperReady++).catch(e=>window.paperFailure=e.message);return transition;};});
  await page.route('**/api/**',async route=>{const u=new URL(route.request().url());let body={};if(route.request().method()==='PATCH'){if(failSave){await route.fulfill({status:500,contentType:'application/json',body:JSON.stringify({detail:'Save unavailable'})});return;}body={content:route.request().postDataJSON().content,updated_at:new Date().toISOString(),status:'editing'};}else if(u.pathname==='/api/users/me')body={id:'motion-user',username:'writer',is_admin:false};else if(u.pathname==='/api/users/me/resume')body=null;else if(u.pathname.endsWith('/metrics'))body={total:1,finalized:0,in_progress:1,recent_dates:[new Date().toISOString()]};else if(u.pathname.endsWith('/full'))body=record;else body={items:[record],total:1,offset:0,limit:20};await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(body)});});

  await page.goto(origin);await page.locator('#quick-thought').waitFor();
  await page.waitForFunction(()=>document.querySelector('.writing-prompts')?.dataset.promptActive==='true');
  await page.waitForFunction(()=>getComputedStyle(document.querySelectorAll('.writing-prompt-line')[1]).opacity==='1');
  await page.screenshot({path:'../scratch/writing-motion/prompt.png'});
  const field=page.locator('#quick-thought');await field.fill('My own words stay untouched.');await page.waitForTimeout(400);
  assert.equal(await page.locator('.writing-prompts').getAttribute('data-prompt-active'),'false');await field.blur();assert.equal(await field.inputValue(),'My own words stay untouched.');
  const card=page.locator('[data-motion=card]').filter({hasText:'A clearer decision'}).first();await card.click();
  const editor=page.getByRole('textbox',{name:'Draft text',exact:true});await editor.waitFor();
  assert.equal(await page.evaluate(()=>window.paperTransitions),1,'Native draft transition ran');
  await page.waitForFunction(()=>window.paperReady===1);
  await page.screenshot({path:"../scratch/writing-motion/card-transition.png"});
  await page.getByRole('button',{name:'Pause motion',exact:true}).click();
  await page.waitForFunction(()=>window.paperFinished===1);
  await page.getByRole('button',{name:'Resume motion',exact:true}).click();
  await page.waitForTimeout(800);assert.equal(await page.locator('.draft-writing-paper').count(),1);
  assert.equal(await page.locator('.save-flourish').count(),0,'No pretend save celebration on load');
  await editor.fill('A real revision to save.');await page.getByRole('button',{name:'Save changes',exact:true}).click();await page.getByRole('alert').filter({hasText:'Save unavailable'}).waitFor();assert.equal(await page.locator('.save-flourish').count(),0,'Failed saves do not celebrate');
  failSave=false;await page.getByRole('button',{name:'Save changes',exact:true}).click();await page.locator('[data-save-confirmed="1"]').waitFor({state:'attached'});await page.getByText('All changes saved',{exact:true}).waitFor();await page.screenshot({path:'../scratch/writing-motion/saved.png'});
  await page.getByRole('button',{name:'Home',exact:true}).click();await field.waitFor();await page.getByRole('button',{name:'Pause motion',exact:true}).click();assert.equal(await page.locator('.writing-prompts').getAttribute('data-prompt-active'),'false');
  await page.locator('[data-motion=card]').filter({hasText:'A clearer decision'}).first().click();await editor.waitFor();assert.equal(await page.evaluate(()=>window.paperTransitions),1,'Paused navigation skips the transition');
  await page.getByRole('button',{name:'Home',exact:true}).click();await field.waitFor();await page.getByRole('button',{name:'Resume motion',exact:true}).click();await page.evaluate(()=>{document.startViewTransition=undefined;});await page.locator('[data-motion=card]').filter({hasText:'A clearer decision'}).first().click();await editor.waitFor();
  assert.deepEqual(errors,[]);await context.close();
 }
 console.log('Writing motion passed: rotating prompts, typing stability, native transition, failed/successful save feedback, pause and unsupported-browser fallback.');
}finally{await browser.close();}
