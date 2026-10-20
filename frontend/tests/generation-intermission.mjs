import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const origin = process.env.BASE_URL || 'http://127.0.0.1:3131';
fs.mkdirSync('../scratch/intermission', { recursive: true });
const browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
try {
  for (const quiet of [false, true]) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1100 }, reducedMotion: quiet ? 'reduce' : 'no-preference' });
    const page = await context.newPage(), errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.addInitScript(() => { sessionStorage.setItem('postcraft_token', 'fixture'); localStorage.setItem('theme', 'dark'); });
    let release, failed = false;
    await page.route('**/api/**', async route => {
      const u = new URL(route.request().url());
      if (u.pathname === '/api/generations' && route.request().method() === 'POST') {
        await new Promise(resolve => { release = resolve; });
        await route.fulfill(failed ? { status: 503, json: { detail: 'Temporary outage. Your idea is safe.' } } : { json: { generation_id: '11111111-1111-4111-8111-111111111111', status: 'editing', updated_at: new Date().toISOString(), draft_1: 'A first draft.', draft_2: 'Another angle.', draft_3: 'One more thought.', sources: [] } });
      } else {
        const body = u.pathname === '/api/users/me' ? { id: 'writer', username: 'writer', is_admin: false } : u.pathname.endsWith('/resume') ? null : u.pathname.endsWith('/metrics') ? { total: 0, finalized: 0, in_progress: 0, recent_dates: [] } : { items: [], total: 0 };
        await route.fulfill({ json: body });
      }
    });
    await page.goto(origin + '/?view=compose');
    await page.locator('#topic').fill('A thought worth sharing');
    await page.locator('#rawThoughts').fill('Every decision deserves a clear owner.');
    await page.getByRole('button', { name: 'Generate Drafts', exact: true }).click();
    const region = page.getByRole('region', { name: 'Draft generation in progress' });
    await region.waitFor();
    assert.equal(await page.getByText(/Researching and writing your three drafts/).count(), 0);
    await page.getByText(/not live stage tracking/).waitFor();
    await page.getByRole('button', { name: 'Consider Quality & grounding' }).click();
    await page.getByText(/the final decision stays yours/).waitFor();
    assert.equal(await page.getByRole('button', { name: 'Consider Quality & grounding' }).getAttribute('aria-pressed'), 'true');
    if (quiet) {
      await page.getByRole('button', { name: 'Collect a thought' }).click();
      await page.getByRole('button', { name: 'Collect a thought' }).press('Space');
      assert.equal(await page.locator('.thought-score b').textContent(), '02');
      assert.equal(await page.locator('.pipeline-traveller').evaluate(e => getComputedStyle(e).animationName), 'none');
    } else {
      await page.getByRole('button', { name: 'Start paper flight' }).click();
      await page.getByRole('button', { name: 'Lift the paper plane' }).waitFor();
      const start = await page.locator('.paper-flight').getAttribute('transform');
      await page.waitForTimeout(180);
      assert.notEqual(await page.locator('.paper-flight').getAttribute('transform'), start);
      await page.getByRole('button', { name: 'Pause game' }).click();
      const paused = await page.locator('.paper-flight').getAttribute('transform');
      await page.waitForTimeout(250);
      assert.equal(await page.locator('.paper-flight').getAttribute('transform'), paused);
      await page.getByRole('button', { name: 'Resume game' }).click();
      await page.getByRole('button', { name: 'Lift the paper plane' }).waitFor();
      await page.waitForTimeout(2500);
      await page.getByText('Every landing is a new beginning.').waitFor();
      await page.getByRole('button', { name: 'Start paper flight' }).press('Space');
      await page.getByRole('button', { name: 'Lift the paper plane' }).waitFor();
      // Fly through the first gate using the visible plane position, not internal game state.
      for (let step = 0; step < 65; step++) {
        const transform = await page.locator('.paper-flight').getAttribute('transform');
        const y = Number(transform.match(/translate\(135 ([\d.-]+)/)[1]);
        if (y > 164) await page.getByRole('button', { name: 'Lift the paper plane' }).click();
        await page.waitForTimeout(75);
        if (Number(await page.locator('.thought-score b').textContent()) >= 1) break;
      }
      assert.ok(Number(await page.locator('.thought-score b').textContent()) >= 1, 'Flying through punctuation must award a point');
      await page.getByRole('button', { name: 'Pause game' }).click();
    }
    assert.ok(await page.locator('.thought-game').evaluate(e => e.getBoundingClientRect().left >= 236), 'Game must clear the desktop sidebar');
    await page.screenshot({ path: `../scratch/intermission/${quiet ? 'quiet' : 'desktop'}.png`, fullPage: false });
    await page.setViewportSize({ width: 390, height: 844 });
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
    await page.screenshot({ path: `../scratch/intermission/${quiet ? 'quiet-mobile' : 'mobile'}.png`, fullPage: false });
    if (quiet) failed = true;
    release();
    await region.waitFor({ state: 'hidden' });
    if (quiet) {
      await page.getByRole('alert').getByText('Temporary outage. Your idea is safe.').waitFor();
      assert.equal(await page.locator('#rawThoughts').inputValue(), 'Every decision deserves a clear owner.');
    } else {
      await page.getByRole('region', { name: 'Drafts ready, keep playing' }).waitFor();
      assert.equal(await page.locator('.thought-score b').textContent(), '01', 'Completion must preserve the game score');
      await page.waitForTimeout(400);
      assert.equal(await page.getByRole('heading', { name: 'Find your starting point.', exact: true }).count(), 0);
      await page.getByRole('button', { name: 'Resume game' }).click();
      await page.getByRole('button', { name: 'Lift the paper plane' }).waitFor();
      await page.getByRole('button', { name: 'Pause game' }).click();
      await page.getByRole('button', { name: 'View your drafts', exact: true }).scrollIntoViewIfNeeded();
      await page.screenshot({ path: '../scratch/intermission/ready-mobile.png' });
      await page.getByRole('button', { name: 'View your drafts', exact: true }).click();
      await page.getByRole('heading', { name: 'Find your starting point.', exact: true }).waitFor();
    }
    assert.deepEqual(errors, []);
    await context.close();
  }
  console.log('Intermission passed: flight, scoring, pause/restart, reduced motion, mobile, retained game on completion, explicit draft reveal and failure recovery.');
} finally { await browser.close(); }

