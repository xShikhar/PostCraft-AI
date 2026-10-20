// Fixtures isolate motion; real-backend.mjs separately verifies persistence.
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const origin=process.env.BASE_URL||'http://127.0.0.1:3131';
const browser=await chromium.launch({headless:true,executablePath:process.env.BROWSER_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe'});
fs.mkdirSync('../scratch/finalize-review',{recursive:true});
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

  let unavailable=false, fail=false, accepted=false;
  await page.route('**/api/generations/*/finalize',async route=>{
    const data=route.request().postDataJSON();
    if(data.accept_warnings){assert.equal(data.review_token,'review-current');if(fail){await route.fulfill({status:503,json:{detail:'Please retry finalization'}});return;}accepted=true;await route.fulfill({json:{status:'finalized',quality:{result:'FAIL: Quality review unavailable',scope:'draft',draft_index:1,accepted_warnings:true}}});}
    else await route.fulfill({json:{status:'needs_review',updated_at:new Date().toISOString(),quality:{result:unavailable?'FAIL: Quality review unavailable':'FAIL [substance]: Add a concrete example',substance_score:unavailable?null:5,review_unavailable:unavailable,scope:'draft',draft_index:1,review_token:'review-current'}}});
  });
  await page.goto(origin+'/?view=editor&generation='+id+'&draft=1');
  const editor=page.getByRole('textbox',{name:'Draft text',exact:true});await editor.waitFor();
  await page.getByRole('button',{name:'Finalize',exact:true}).click();
  const dialog=page.getByRole('dialog');await dialog.waitFor();await dialog.getByText('Substance score: 5/10',{exact:true}).waitFor();await dialog.getByText(/Add a concrete example/).waitFor();assert.equal(accepted,false);
  await dialog.getByRole('button',{name:'Keep editing',exact:true}).click();await dialog.waitFor({state:'hidden'});assert.equal(await editor.isEditable(),true);await page.getByLabel('Quality feedback').getByText('Substance score: 5/10',{exact:true}).waitFor();
  unavailable=true;await page.getByRole('button',{name:'Finalize',exact:true}).click();await dialog.getByRole('heading',{name:'Review unavailable'}).waitFor();await dialog.getByText('Score unavailable',{exact:true}).waitFor();
  await page.screenshot({path:'../scratch/finalize-review/desktop.png'});await page.setViewportSize({width:390,height:844});assert.ok(await page.evaluate(()=>document.body.scrollWidth<=innerWidth+1));await page.screenshot({path:'../scratch/finalize-review/mobile.png'});
  fail=true;await dialog.getByRole('button',{name:'Finalize anyway',exact:true}).click();await dialog.getByRole('alert').waitFor();assert.equal(accepted,false);
  fail=false;await dialog.getByRole('button',{name:'Finalize anyway',exact:true}).click();await dialog.waitFor({state:'hidden'});await page.getByText('This generation is finalized. Its variations are read-only.',{exact:true}).waitFor();assert.equal(accepted,true);assert.equal(await editor.isEditable(),false);await page.getByText('Finalized with your approval of the review feedback.',{exact:true}).waitFor();
  assert.deepEqual(errors,[]);await context.close();
 }
 console.log('Finalize review passed: score, feedback, keep editing, reviewer outage, explicit approval, retry, mobile and finalized lock.');
}finally{await browser.close();}
