// Deterministic surface/motion checks. API fixtures are not live provider evidence.
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const origin = process.env.BASE_URL || 'http://127.0.0.1:3131';
const output = '../scratch/premium-pages';
fs.mkdirSync(output, {recursive:true});
const browser = await chromium.launch({headless:true, executablePath:process.env.BROWSER_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe'});
try {
  for (const reducedMotion of ['no-preference', 'reduce']) {
    const context = await browser.newContext({viewport:{width:1440,height:1000}, reducedMotion});
    const page = await context.newPage();
    await page.addInitScript(() => sessionStorage.setItem('postcraft_token','premium-pages-fixture'));
    let user={id:'fixture-user',username:'writer',about_me:'A thoughtful perspective.',profile_context:'Engineering',writing_style:'Direct',is_admin:false};
    const item={generation_id:'premium-fixture',topic:'Decision ownership',platform:'linkedin',status:'editing',active_draft_index:1,created_at:'2026-10-18T10:00:00Z',draft_1:'A useful draft.',draft_2:'Another perspective.',draft_3:'Third option.',preview:'A useful draft.'};
    await page.route('**/api/**',async route=>{
      const request=route.request(),url=new URL(request.url());
      let body={},status=200;
      if(request.method()==='OPTIONS')status=204;
      else if(url.pathname==='/api/users/me') { if(request.method()==='PATCH')Object.assign(user,request.postDataJSON()); body=user; }
      else if(url.pathname.endsWith('/style-profile'))body={current:null,history:[]};
      else if(url.pathname.endsWith('/resume'))body=null;
      else if(url.pathname.endsWith('/metrics'))body={total:1,finalized:0,in_progress:1,recent_dates:[]};
      else if(url.pathname==='/api/generations')body={items:url.searchParams.get('q')==='missing'?[]:[item],total:url.searchParams.get('q')==='missing'?0:1,offset:0,limit:12};
      else {status=404;body={detail:'Unexpected '+url.pathname};}
      await route.fulfill({status,contentType:'application/json',body:status===204?'':JSON.stringify(body)});
    });
    await page.goto(origin);
    await page.getByRole('button',{name:'Profile & Voice',exact:true}).click();
    const field=page.getByLabel('A little about you',{exact:true});
    await field.waitFor(); await field.fill('A revised perspective.');
    await field.focus();
    const panel=page.locator('section').filter({has:field});
    const steady=await panel.evaluate(el=>{const value=getComputedStyle(el).transform;return value==='none'||new DOMMatrixReadOnly(value).isIdentity});
    assert.ok(steady,'profile form stays spatially steady');
    await panel.getByRole('button',{name:'Save changes',exact:true}).click();
    await panel.locator('[data-motion="feedback"]').getByText('Saved',{exact:true}).waitFor();
    assert.equal(user.about_me,'A revised perspective.');
    for(const theme of ['light','dark']) {
      await page.getByRole('button',{name:theme==='dark'?'Dark':'Light',exact:true}).click();
      await page.waitForTimeout(650); // Capture the settled native theme and entrance transitions.
      await page.screenshot({path:`${output}/profile-${theme}-${reducedMotion}.png`,fullPage:true});
    }
    await page.getByRole('button',{name:'History',exact:true}).click();
    const article=page.locator('article').filter({has:page.getByRole('heading',{name:'Decision ownership',exact:true})});
    await article.waitFor();assert.equal(await article.getAttribute('data-motion'),'panel');
    await article.getByRole('button',{name:'Draft 2',exact:true}).click();
    await article.getByText('Another perspective.',{exact:true}).waitFor();
    await article.getByRole('button',{name:'Preview',exact:true}).click();
    await page.getByRole('dialog').getByText('Another perspective.',{exact:true}).waitFor();
    await page.keyboard.press('Escape');
    await page.getByLabel('Search your archive',{exact:true}).fill('missing');
    await page.getByRole('heading',{name:'No matching ideas yet.',exact:true}).waitFor();
    assert.equal(await page.locator('[data-motion="feedback"]').count(),0,'empty result is not success feedback');
    await page.getByRole('button',{name:'Clear filters',exact:true}).click();
    await page.getByRole('heading',{name:'Decision ownership',exact:true}).waitFor();
    for(const theme of ['light','dark']) {
      await page.getByRole('button',{name:theme==='dark'?'Dark':'Light',exact:true}).click();
      await page.waitForTimeout(650); // Capture the settled native theme and entrance transitions.
      await page.screenshot({path:`${output}/history-${theme}-${reducedMotion}.png`,fullPage:true});
    }
    await page.setViewportSize({width:390,height:844});
    await page.waitForFunction(()=>document.body.scrollWidth<=innerWidth+1,{},{timeout:5000});
    assert.ok(await page.locator('body').evaluate(el=>el.scrollWidth<=innerWidth+1),'mobile history has no page overflow');
    await page.screenshot({path:`${output}/history-mobile-${reducedMotion}.png`,fullPage:true});
    if(reducedMotion==='reduce') assert.ok(await page.locator('[data-motion]').evaluateAll(nodes=>nodes.every(el=>{const value=getComputedStyle(el).transform;return value==='none'||new DOMMatrixReadOnly(value).isIdentity})),'reduced motion has no spatial transforms');
    await page.goto(origin+'/missing-premium-page');
    await page.getByRole('heading',{name:'Let’s turn to a fresh page.'}).waitFor();
    assert.equal(await page.locator('[data-motion-scene]').count(),1);
    await page.evaluate(()=>sessionStorage.removeItem('postcraft_token'));
    await page.goto(origin+'/?view=privacy');
    await page.getByRole('heading',{name:'Privacy Policy',exact:true}).waitFor();
    assert.ok(await page.locator('article p[data-motion="panel"]').count()>3,'legal disclosure reveals authored paragraphs');
    assert.ok(await page.locator('body').evaluate(el=>el.scrollWidth<=innerWidth+1),'mobile legal document has no page overflow');
    await page.screenshot({path:`${output}/legal-mobile-${reducedMotion}.png`});
    await context.close();
  }
  console.log('Premium remaining pages passed: steady profile fields, real saved feedback, archive alternatives and preview, honest empty state, both themes, desktop/mobile, normal/reduced motion, standalone 404, mobile legal section hierarchy.');
} finally {await browser.close();}
