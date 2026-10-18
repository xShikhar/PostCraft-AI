// Deterministic navigation fixtures; normal/reduced motion and keyboard contracts.
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const origin = process.env.BASE_URL || 'http://127.0.0.1:3131';
const screenshots = '../scratch/premium-navigation';
fs.mkdirSync(screenshots, { recursive: true });
const browser = await chromium.launch({ headless: true, executablePath: process.env.BROWSER_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
const item = { generation_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', project_id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', topic: 'The useful observation', preview: 'A saved writing thought.', platform: 'linkedin', status: 'editing', active_draft_index: 1, draft_1: 'A saved writing thought.', draft_2: 'Another angle.', draft_3: 'Third angle.', created_at: '2026-10-18T12:00:00Z', updated_at: '2026-10-18T12:00:00Z', sources: [], chat_history: [], quality: null };
async function setup(reducedMotion = 'no-preference', width = 1440) {
  const context = await browser.newContext({ viewport: { width, height: 1000 }, reducedMotion });
  await context.addInitScript(() => { sessionStorage.setItem('postcraft_token', 'navigation-motion-fixture'); localStorage.setItem('theme', 'light'); });
  const page = await context.newPage();
  await page.route('**/api/**', async route => {
    const u = new URL(route.request().url()); let body = {};
    if (u.pathname === '/api/users/me') body = { id: 'navigation-writer', username: 'writer', is_admin: false };
    else if (u.pathname.endsWith('/resume')) body = null;
    else if (u.pathname.endsWith('/style-profile')) body = { current: null, history: [] };
    else if (u.pathname.endsWith('/metrics')) body = { total: 1, finalized: 0, in_progress: 1, recent_dates: [] };
    else if (u.pathname.endsWith('/full')) body = item;
    else body = { items: [item], total: 1, limit: 20, offset: 0 };
    await route.fulfill({ status: 200, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Headers': 'Authorization, Content-Type' }, body: JSON.stringify(body) });
  });
  await page.goto(origin);
  try { await page.getByRole('heading', { name: /Good (morning|afternoon|evening),/ }).waitFor(); }
  catch (error) { await page.screenshot({ path: `${screenshots}/setup-failure.png`, fullPage: true }); console.error((await page.locator('body').innerText()).slice(0, 3000)); throw error; }
  return { context, page };
}
const markerY = marker => marker.evaluate(e => new DOMMatrixReadOnly(getComputedStyle(e).transform).m42);
const settleMarker = async (marker, target) => {
  const position = await marker.evaluate(async (e, target) => {
    const deadline = performance.now() + 4000;
    let y;
    do {
      y = new DOMMatrixReadOnly(getComputedStyle(e).transform).m42;
      if (Math.abs(y - target) < .01) return y;
      await new Promise(requestAnimationFrame);
    } while (performance.now() < deadline);
    return y;
  }, target);
  assert.ok(Math.abs(position - target) < .01, `marker ended at ${position}, expected ${target}`);
};
try {
  const { context, page } = await setup();
  const nav = page.locator('aside .workspace-nav'), marker = nav.locator('.workspace-nav-indicator');
  assert.equal(await markerY(marker), 0);
  const samples = await nav.evaluate(async e => {
    e.querySelectorAll('button')[1].click();
    const marker = e.querySelector('.workspace-nav-indicator');
    const samples = [];
    for (let i = 0; i < 8; i++) { await new Promise(requestAnimationFrame); samples.push(new DOMMatrixReadOnly(getComputedStyle(marker).transform).m42); }
    return samples;
  });
  assert.ok(samples.some(y => y > 0 && y < 50), `indicator must actually interpolate: ${samples}`);
  await settleMarker(marker, 50);
  await nav.getByRole('button', { name: 'Home', exact: true }).click();
  await nav.getByRole('button', { name: 'Profile & Voice', exact: true }).click();
  await settleMarker(marker, 100);
  assert.equal(await nav.locator('[aria-current="page"]').innerText(), 'Profile & Voice');
  await nav.getByRole('button', { name: 'Home', exact: true }).click();
  await page.waitForTimeout(1200);
  await page.screenshot({ path: `${screenshots}/desktop-light.png`, fullPage: true });
  await page.getByRole('button', { name: 'Dark', exact: true }).click();
  await page.waitForTimeout(260);
  assert.equal(await page.locator('.workspace-theme-thumb').evaluate(e => new DOMMatrixReadOnly(getComputedStyle(e).transform).m41), 78);
  assert.equal(await page.getByRole('button', { name: 'Dark', exact: true }).getAttribute('aria-pressed'), 'true');
  await page.screenshot({ path: `${screenshots}/desktop-dark.png`, fullPage: true });
  await page.keyboard.press('Control+k');
  await page.locator('#workspace-search').waitFor();
  await page.waitForFunction(() => document.activeElement?.id === 'workspace-search');
  await page.locator('#workspace-search').fill('observation');
  await page.getByRole('button', { name: /The useful observation/ }).waitFor();
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Search history', exact: true }).waitFor({ state: 'visible' });
  await page.waitForFunction(() => document.activeElement?.getAttribute('aria-label') === 'Search history');
  await page.keyboard.press('Control+k');
  await page.locator('#workspace-search').waitFor();
  await page.getByRole('button', { name: /The useful observation/ }).focus();
  await page.keyboard.press('Enter');
  await page.getByRole('textbox', { name: 'Draft text', exact: true }).waitFor();
  await context.close();

  const reduced = await setup('reduce');
  const reducedNav = reduced.page.locator('aside .workspace-nav');
  await reducedNav.getByRole('button', { name: 'History', exact: true }).click();
  assert.equal(await markerY(reducedNav.locator('.workspace-nav-indicator')), 50);
  assert.equal(await reducedNav.locator('.workspace-nav-indicator').evaluate(e => getComputedStyle(e).transitionDuration), '0s');
  await reduced.context.close();

  const mobile = await setup('reduce', 390);
  await mobile.page.getByRole('button', { name: 'Open navigation', exact: true }).click();
  const drawer = mobile.page.getByRole('dialog', { name: 'Workspace navigation' });
  await drawer.waitFor();
  assert.equal(await drawer.evaluate(e => getComputedStyle(e).animationName), 'none');
  assert.ok(await mobile.page.locator('body').evaluate(e => e.scrollWidth <= innerWidth + 1), 'mobile drawer overflow');
  await mobile.page.screenshot({ path: `${screenshots}/mobile-drawer.png`, fullPage: true });
  await drawer.getByRole('button', { name: 'History', exact: true }).click();
  await drawer.waitFor({ state: 'hidden' });
  await mobile.page.getByRole('button', { name: 'Open navigation', exact: true }).click();
  await drawer.waitFor(); await mobile.page.keyboard.press('Escape');
  await drawer.waitFor({ state: 'hidden' });
  await mobile.page.waitForFunction(() => document.activeElement?.getAttribute('aria-label') === 'Open navigation');
  await mobile.context.close();
  const movingMobile = await setup('no-preference', 390);
  await movingMobile.page.setViewportSize({ width: 390, height: 844 });
  await movingMobile.page.getByRole('button', { name: 'Open navigation', exact: true }).click();
  const movingDrawer = movingMobile.page.getByRole('dialog', { name: 'Workspace navigation' });
  await movingDrawer.waitFor();
  assert.equal(await movingDrawer.evaluate(e => getComputedStyle(e).animationName), 'workspace-drawer-in');
  await movingMobile.page.waitForTimeout(300);
  assert.ok(await movingDrawer.evaluate(e => e.scrollWidth <= e.clientWidth + 1), 'normal mobile drawer internal overflow');
  await movingMobile.page.screenshot({ path: `${screenshots}/mobile-drawer-normal.png` });
  await movingMobile.context.close();
  console.log('Navigation motion passed: actual interpolation, interruption, theme thumb, keyboard search and result opening, focus restoration, reduced fallback and mobile drawer/overflow. Fixtures only.');
} finally { await browser.close(); }
