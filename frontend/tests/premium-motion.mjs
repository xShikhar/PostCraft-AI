// Fixtures isolate motion; real-backend.mjs separately verifies persistence.
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const origin=process.env.BASE_URL||'http://127.0.0.1:3131';
const browser=await chromium.launch({headless:true,executablePath:process.env.BROWSER_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe'});
fs.mkdirSync('../scratch/premium-motion',{recursive:true});
try {
 for(const policy of ['full','reduced','coarse']){
  const context=await browser.newContext({viewport:{width:policy==='coarse'?390:1440,height:1000},reducedMotion:policy==='reduced'?'reduce':'no-preference',hasTouch:policy==='coarse',isMobile:policy==='coarse'});
  await context.addInitScript(()=>sessionStorage.setItem('postcraft_token','motion-fixture'));
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  const id='11111111-1111-4111-8111-111111111111';
  const record={generation_id:id,project_id:id,topic:'A clearer decision',platform:'linkedin',status:'editing',active_draft_index:1,created_at:new Date().toISOString(),updated_at:new Date().toISOString(),preview:'Give each review a named owner and a next action.',draft_1:'Give each review a named owner and a next action.',draft_2:'Review the decision, then name its owner.',draft_3:'One clear owner is a useful starting point.',raw_thoughts:'Practical review ownership',sources:[],chat_history:[],quality:null};
  await page.route('**/api/**',async route=>{const u=new URL(route.request().url());let body={};if(u.pathname==='/api/users/me')body={id:'motion-user',username:'writer',is_admin:false};else if(u.pathname==='/api/users/me/resume')body=null;else if(u.pathname.endsWith('/metrics'))body={total:1,finalized:0,in_progress:1,recent_dates:[new Date().toISOString()]};else if(u.pathname.endsWith('/full'))body=record;else body={items:[record],total:1,offset:0,limit:20};await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(body)});});
  await page.goto(origin);await page.getByRole('heading',{name:/Good (morning|afternoon|evening),/}).waitFor();
  const scene=page.locator('[data-motion-scene="home"]');await scene.waitFor();
  await page.waitForFunction(expected=>document.querySelector('[data-motion-scene]')?.getAttribute('data-motion-policy')===expected,policy);
  const scratch=page.locator('#quick-thought');await scratch.fill('An immediately usable scratchpad.');const before=await scratch.boundingBox();await page.waitForTimeout(180);const after=await scratch.boundingBox();assert.ok(Math.abs(before.y-after.y)<1,'writing input must stay spatially steady');
  const card=page.locator('[data-motion="card"]').first();await card.scrollIntoViewIfNeeded();await page.waitForTimeout(650);
  const handle=await card.elementHandle();
  if(policy==='full'){
   const box=await card.boundingBox();await page.mouse.move(box.x+box.width*.8,box.y+box.height*.3);await page.waitForTimeout(220);
   assert.notEqual(await card.evaluate(e=>getComputedStyle(e).transform),'none','fine-pointer card depth should respond');
   await page.mouse.move(1,1);await page.waitForTimeout(500);
  }else assert.equal(await card.evaluate(e=>getComputedStyle(e).transform),'none','reduced/coarse pointers need a steady fallback');
  await page.locator('[data-motion="bar"]').first().scrollIntoViewIfNeeded();await page.waitForTimeout(750);
  await page.screenshot({path:`../scratch/premium-motion/dashboard-${policy}.png`,fullPage:true});
  if(policy==='coarse'){await page.getByRole('button',{name:'Open navigation',exact:true}).click();await page.getByRole('dialog').getByRole('button',{name:'New post',exact:true}).click();}
  else await page.getByRole('button',{name:'New post',exact:true}).first().click();
  await page.locator('#topic').fill('The next idea');await page.locator('#rawThoughts').fill('Typing is never gated by an animation.');
  const detached=await handle.evaluate(e=>({connected:e.isConnected,transform:e.style.transform}));assert.equal(detached.connected,false);assert.ok(!detached.transform||detached.transform==='none','unmounted scene must release its transforms');
  await page.goto(`${origin}/?view=editor&generation=${id}&draft=1`);const editor=page.getByRole('textbox',{name:'Draft text',exact:true});await editor.waitFor();await editor.fill('A steady writing surface.');const editBefore=await editor.boundingBox();await page.waitForTimeout(600);const editAfter=await editor.boundingBox();assert.ok(Math.abs(editBefore.y-editAfter.y)<1,`editor cannot drift while typing (${policy}: ${editBefore.y} to ${editAfter.y})`);
  assert.ok(await page.locator('body').evaluate(e=>e.scrollWidth<=innerWidth+1),'motion must not add horizontal overflow');assert.deepEqual(errors,[]);await context.close();
 }
 console.log('Premium motion passed: pointer depth, native scroll, immediate inputs, steady editor, reduced/touch fallbacks, cleanup and responsive behavior. Fixtures only.');
}finally{await browser.close();}
