// Motion fixtures only: no generated content or invented account activity.
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const browser = await chromium.launch({ headless: true, executablePath: process.env.BROWSER_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
const origin = process.env.BASE_URL || 'http://127.0.0.1:3131';
fs.mkdirSync('../scratch/bold-story', { recursive: true });
try {
  for (const policy of ['full', 'reduced', 'coarse', 'short']) {
    const context = await browser.newContext({ viewport: { width: policy === 'coarse' ? 390 : 1440, height: policy === 'short' ? 650 : 900 }, reducedMotion: policy === 'reduced' ? 'reduce' : 'no-preference', hasTouch: policy === 'coarse', isMobile: policy === 'coarse' });
    await context.addInitScript(() => sessionStorage.setItem('postcraft_token', 'story-fixture'));
    const page = await context.newPage();
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    await page.route('**/api/**', async route => {
      const path = new URL(route.request().url()).pathname;
      const body = path === '/api/users/me' ? { id: 'story-user', username: 'writer', is_admin: false } : path.endsWith('/resume') ? null : path.endsWith('/metrics') ? { total: 0, finalized: 0, in_progress: 0, recent_dates: [] } : { items: [], total: 0, offset: 0, limit: 20 };
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
    });
    await page.goto(origin);
    await page.locator('.craft-story').waitFor();
    await page.waitForTimeout(900);
    assert.ok((await page.locator('#quick-thought').boundingBox()).y < 900, 'scratchpad remains in the first viewport');
    const story = page.locator('.craft-story');
    if (policy === 'full') {
      await page.locator('[data-story-mode="pinned"]').waitFor();
      await page.waitForFunction(()=>[...document.querySelectorAll('[data-kinetic-word]')].every(el=>!el.style.transform));
      await page.screenshot({path:'../scratch/bold-story/dashboard-top.png'});
      assert.equal(await page.locator('.pin-spacer .craft-stage').count(), 1, 'GSAP creates a real pin spacer');
      const start = await page.locator('.pin-spacer .craft-stage').evaluate(el => el.getBoundingClientRect().top + scrollY - 80);
      await page.evaluate(y => scrollTo(0, y + 30), start); await page.waitForTimeout(700);
      const before = await page.locator('.craft-paper-2').evaluate(el => getComputedStyle(el).transform);
      await page.screenshot({ path: '../scratch/bold-story/desktop-start.png' });
      await page.evaluate(y => scrollTo(0, y + 500), start); await page.waitForTimeout(700);
      assert.notEqual(await page.locator('.craft-paper-2').evaluate(el => getComputedStyle(el).transform), before, 'scroll changes paper transforms');
      const pinnedTop = await page.locator('.craft-stage').evaluate(el => el.getBoundingClientRect().top);
      assert.ok(Math.abs(pinnedTop - 80) < 3, `stage really pins (top ${pinnedTop})`);
      await page.screenshot({ path: '../scratch/bold-story/desktop-mid.png' });
      await page.evaluate(y => scrollTo(0, y + 890), start); await page.waitForTimeout(700);
      await page.screenshot({ path: '../scratch/bold-story/desktop-end.png' });
      await page.getByRole('button',{name:'Dark',exact:true}).click();await page.waitForTimeout(400);
      await page.screenshot({path:'../scratch/bold-story/desktop-dark.png'});
      await page.getByRole('button',{name:'Light',exact:true}).click();
      await page.getByRole('link', { name: 'Skip story' }).click();
      assert.equal(await page.locator('#craft-story-next').evaluate(el => el === document.activeElement), true, 'skip moves keyboard focus past pin');
      await page.evaluate(() => { localStorage.setItem('postcraft:motion-paused', 'true'); window.dispatchEvent(new Event('postcraft:motion-change')); });
      await page.waitForTimeout(200);
      assert.equal(await page.locator('.pin-spacer .craft-stage').count(), 0, 'pause fully removes pin');
      assert.equal(await page.locator('.craft-paper-2').evaluate(el => el.style.transform), '', 'pause reverts transforms');
    } else {
      assert.equal(await story.getAttribute('data-story-mode'), null);
      assert.equal(await page.locator('.pin-spacer .craft-stage').count(), 0);
      const cards = await page.locator('.craft-paper').evaluateAll(els => els.map(el => ({ transform: getComputedStyle(el).transform, position: getComputedStyle(el).position })));
      assert.ok(cards.every(card => card.transform === 'none' && card.position === 'relative'));
      await story.scrollIntoViewIfNeeded();
      await page.screenshot({ path: `../scratch/bold-story/${policy}.png`, fullPage: true });
    }
    assert.ok(await page.locator('body').evaluate(el => el.scrollWidth <= innerWidth + 1), 'no horizontal overflow');
    await page.getByRole('button', { name: 'Start with a thought' }).click();
    await page.locator('#topic').waitFor();
    assert.equal(await page.locator('.craft-story').count(), 0, 'CTA invokes real new-post navigation');
    assert.deepEqual(errors, []);
    await context.close();
  }
  console.log('Bold story passed: real pin, scroll transforms, skip focus, pause cleanup, CTA, reduced/touch/short fallback, no overflow.');
} finally { await browser.close(); }
