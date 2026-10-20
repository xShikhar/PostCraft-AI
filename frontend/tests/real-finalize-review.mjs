// Real FastAPI and disposable SQLite integration. No API success fixtures.
// Start backend/tests/serve_browser_e2e.py first. Browser traffic is forwarded
// unchanged to its isolated port; this keeps the frontend API build setting intact.
import { chromium } from "playwright";
import assert from "node:assert/strict";
const origin = process.env.BASE_URL || "http://127.0.0.1:3000";
const backend = process.env.E2E_API_URL || "http://127.0.0.1:8765";
const id = "11111111-1111-4111-8111-111111111111";
const run = Date.now();
const profileText = `A saved profile from the real disposable backend. Run ${run}.`;
const browser = await chromium.launch({
  headless: true,
  executablePath:
    process.env.BROWSER_PATH ||
    "C:/Program Files/Google/Chrome/Application/chrome.exe",
});
try {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    reducedMotion: "reduce",
  });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.route("**/api/**", async (route) => {
    const url = new URL(route.request().url());
    const response = await route.fetch({
      url: backend + url.pathname + url.search,
    });
    await route.fulfill({ response });
  });
  await page.goto(origin);
  await page.locator("#username").fill("e2e_writer");
  await page.locator("#password").fill("local-e2e-password123");
  await page.getByRole("button", { name: /Sign in to PostCraft/i }).click();
  await page.locator('#quick-thought').waitFor();
  await page.goto(`${origin}/?view=editor&generation=${id}&draft=1`);
  const editor = page.getByRole('textbox',{name:'Draft text',exact:true});
  await editor.waitFor();
  await page.getByRole('button',{name:'Finalize',exact:true}).click();
  const dialog=page.getByRole('dialog');await dialog.waitFor();
  await dialog.getByText('Score unavailable',{exact:true}).waitFor();
  await dialog.getByRole('button',{name:'Finalize anyway',exact:true}).click();
  await dialog.waitFor({state:'hidden'});
  await page.getByText('This generation is finalized. Its variations are read-only.',{exact:true}).waitFor();
  const token=await page.evaluate(()=>sessionStorage.getItem('postcraft_token'));
  const response=await fetch(`${backend}/api/generations/${id}/full`,{headers:{Authorization:`Bearer ${token}`}});
  const record=await response.json();assert.equal(record.status,'finalized');assert.equal(record.quality.accepted_warnings,true);assert.notEqual(record.quality.result,'PASS');
  await page.reload();await editor.waitFor();assert.equal(await editor.isEditable(),false);
  await page.getByText('Finalized with your approval of the review feedback.',{exact:true}).waitFor();
  assert.deepEqual(errors,[]);
  console.log('Real advisory finalization passed: review unavailable, explicit acceptance, persisted honest quality result, locked draft after reload.');
}finally{await browser.close();}
