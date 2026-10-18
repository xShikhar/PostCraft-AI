// Responsive edge inputs and public routes; fixture data is used for the workspace.
import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const origin=process.env.BASE_URL||'http://127.0.0.1:3131';
const browser=await chromium.launch({headless:true,executablePath:process.env.BROWSER_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe'});
fs.mkdirSync('../scratch/redesign-qa',{recursive:true});
try{
 for(const width of [390,768,1024,1440]){
  const context=await browser.newContext({viewport:{width,height:1024},reducedMotion:'reduce'});const page=await context.newPage();
  await page.goto(origin);await page.locator('#username').waitFor();assert.ok(await page.locator('body').evaluate(e=>e.scrollWidth<=innerWidth+1),`auth overflow ${width}`);
  if(width===768)await page.screenshot({path:'../scratch/redesign-qa/auth-tablet.png',fullPage:true});
  await page.getByRole('button',{name:'Terms',exact:true}).click();await page.getByRole('heading',{name:'Terms of Service',exact:true}).waitFor();assert.ok(await page.locator('body').evaluate(e=>e.scrollWidth<=innerWidth+1),`legal overflow ${width}`);
  await page.addInitScript(()=>sessionStorage.setItem('postcraft_token','responsive-fixture'));
  await page.route('**/api/**',async route=>{const u=new URL(route.request().url());let body={};if(u.pathname==='/api/users/me')body={id:'responsive-writer',username:'x'.repeat(255),is_admin:false};else if(u.pathname.endsWith('/metrics'))body={total:0,finalized:0,in_progress:0,recent_dates:[]};else if(u.pathname.endsWith('/resume'))body=null;else body={items:[],total:0,limit:20,offset:0};await route.fulfill({status:200,contentType:'application/json',headers:{'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Headers':'Authorization, Content-Type'},body:JSON.stringify(body)});});
  await page.goto(origin);await page.getByRole('heading',{name:/Good (morning|afternoon|evening),/}).waitFor();assert.ok(await page.locator('body').evaluate(e=>e.scrollWidth<=innerWidth+1),`long-username overflow ${width}`);
  if(width===768)await page.screenshot({path:'../scratch/redesign-qa/dashboard-tablet.png',fullPage:true});
  await context.close();
 }
 const page=await browser.newPage();const response=await page.goto(origin+'/page-that-does-not-exist');assert.equal(response.status(),404);await page.getByRole('link',{name:'Back to the studio',exact:true}).waitFor();
 console.log('Responsive checks passed: auth, legal and maximum-length username at390/768/1024/1440px; real not-found route. Workspace fixtures only.');
}finally{await browser.close();}
