import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const browser = await chromium.launch({ executablePath: process.env.BROWSER_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const base = process.env.BASE_URL || 'http://127.0.0.1:3131';
const output = '../scratch/bold-auth';
fs.mkdirSync(output, { recursive: true });
const matrix = el => { const m = new DOMMatrix(getComputedStyle(el).transform); return { x: m.m41, y: m.m42, depth: Math.abs(m.m13) + Math.abs(m.m23) }; };
try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  await context.addInitScript(() => {
    window.authAmplitude = { x: 0, y: 0 };
    const capture = () => {
      for (const el of document.querySelectorAll('[data-auth-paper]')) {
        const m = new DOMMatrix(getComputedStyle(el).transform);
        window.authAmplitude.x = Math.max(window.authAmplitude.x, Math.abs(m.m41));
        window.authAmplitude.y = Math.max(window.authAmplitude.y, Math.abs(m.m42));
      }
      requestAnimationFrame(capture);
    };
    requestAnimationFrame(capture);
  });
  const page = await context.newPage();
  await page.goto(base);
  await page.locator('#username').waitFor();
  const field = page.locator('#username'), submit = page.locator('.auth-submit');
  const before = { field: await field.boundingBox(), submit: await submit.boundingBox() };
  await page.waitForFunction(() => [...document.querySelectorAll('[data-auth-paper]')].every(el => getComputedStyle(el).transform === 'none') && getComputedStyle(document.querySelector('.auth-stage-footer')).opacity === '1');
  await page.waitForTimeout(300);
  const amplitude = await page.evaluate(() => window.authAmplitude);
  assert.ok(amplitude.x > 80 && amplitude.y > 90, `Large fan entrance measured: ${JSON.stringify(amplitude)}`);
  assert.deepEqual({ field: await field.boundingBox(), submit: await submit.boundingBox() }, before, 'Entrance does not translate form targets');
  await page.screenshot({ path: `${output}/settled-light.png`, fullPage: true });
  const stage = await page.locator('.auth-stage').boundingBox();
  await page.mouse.move(stage.x + stage.width - 8, stage.y + stage.height - 8);
  await page.waitForTimeout(1100);
  const interactive = await page.locator('.auth-paper-front').evaluate(matrix);
  assert.ok(interactive.x > 28 && interactive.depth > 0.15, `Noticeable parallax and depth: ${JSON.stringify(interactive)}`);
  assert.deepEqual({ field: await field.boundingBox(), submit: await submit.boundingBox() }, before);
  await page.screenshot({ path: `${output}/interactive-light.png`, fullPage: true });
  await field.fill('writer');
  await page.mouse.move(stage.x + 10, stage.y + 10);
  await page.waitForTimeout(1000);
  assert.ok(Math.abs((await page.locator('.auth-paper-front').evaluate(matrix)).x) < 0.1, 'Focused form neutralizes decoration');
  await field.blur();
  await page.getByRole('button', { name: 'Pause motion', exact: true }).click();
  await page.waitForTimeout(200);
  await page.mouse.move(stage.width - 10, 700);
  await page.waitForTimeout(700);
  assert.equal(await page.locator('.auth-paper-front').evaluate(el => getComputedStyle(el).transform), 'none', 'Live pause removes transforms');
  await page.screenshot({ path: `${output}/paused.png`, fullPage: true });
  await context.close();
  for (const setup of [{ reducedMotion: 'reduce' }, { hasTouch: true, isMobile: true }]) {
    const safeContext = await browser.newContext({ viewport: { width: 1024, height: 900 }, ...setup });
    const safePage = await safeContext.newPage();
    await safePage.goto(base); await safePage.locator('#username').waitFor(); await safePage.waitForTimeout(2200);
    await safePage.mouse.move(500, 700); await safePage.waitForTimeout(700);
    assert.ok(await safePage.locator('[data-auth-paper]').evaluateAll(els => els.every(el => getComputedStyle(el).transform === 'none')), 'Reduced and coarse layouts preserve static paper composition');
    await safeContext.close();
  }
  console.log('Bold auth passed: 80px+ fan, 90px+ assembly, 28px+ pointer travel, depth, stable form, focus reset, live pause, reduced and coarse.');
} finally { await browser.close(); }
