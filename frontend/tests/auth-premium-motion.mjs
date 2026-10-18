// Deterministic visual behavior; live authentication is covered separately.
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const executablePath = process.env.BROWSER_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const browser = await chromium.launch({ executablePath, headless: true });
const output = '../scratch/premium-auth';
fs.mkdirSync(output, { recursive: true });
try {
  for (const reducedMotion of ['no-preference', 'reduce']) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion });
    const page = await context.newPage();
    await page.goto(process.env.BASE_URL || 'http://127.0.0.1:3131');
    await page.locator('#username').waitFor();
    await page.waitForTimeout(1100);
    const field = page.locator('#username');
    const before = await field.boundingBox();
    await page.mouse.move(600, 650);
    await page.waitForTimeout(750);
    const light = await page.locator('.auth-paper-front').evaluate(el => getComputedStyle(el).getPropertyValue('--auth-light-x').trim());
    assert.ok(light, 'paper has local lighting coordinates');
    if (reducedMotion === 'no-preference') assert.notEqual(light, '50%', 'fine pointer moves paper lighting');
    else assert.equal(light, '50%', 'reduced motion keeps lighting neutral');
    assert.deepEqual(await field.boundingBox(), before, 'paper interaction leaves form steady');
    await field.fill('writer');
    const typing = await field.boundingBox();
    await page.mouse.move(70, 250);
    await page.waitForTimeout(650);
    assert.deepEqual(await field.boundingBox(), typing, 'typing never moves credentials');
    await field.blur();
    await page.mouse.move(1200, 40);
    await page.waitForTimeout(750);
    await page.screenshot({ path: `${output}/${reducedMotion}-light.png`, fullPage: true });
    await page.getByRole('button', { name: 'Switch to dark theme', exact: true }).click();
    await page.waitForTimeout(450);
    await page.screenshot({ path: `${output}/${reducedMotion}-dark.png`, fullPage: true });
    await page.getByRole('button', { name: 'Sign up', exact: true }).click();
    await page.getByRole('heading', { name: 'Begin with you.', exact: true }).waitFor();
    await page.waitForTimeout(260);
    assert.ok(await page.locator('#username').isVisible());
    assert.equal(await field.inputValue(), '');
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.mouse.move(600, 650);
    await page.waitForTimeout(700);
    assert.ok(await page.locator('[data-auth-paper]').evaluateAll(elements => elements.every(el => getComputedStyle(el).transform === 'none')), 'changing motion preference reverts paper transforms');
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({ path: `${output}/${reducedMotion}-mobile.png`, fullPage: true });
    assert.ok(await page.locator('body').evaluate(el => el.scrollWidth <= innerWidth + 1));
    await context.close();
  }
  const coarse = await browser.newContext({ viewport: { width: 1024, height: 900 }, hasTouch: true, isMobile: true, reducedMotion: 'no-preference' });
  const coarsePage = await coarse.newPage();
  await coarsePage.goto(process.env.BASE_URL || 'http://127.0.0.1:3131');
  await coarsePage.locator('#username').waitFor();
  await coarsePage.waitForTimeout(1100);
  await coarsePage.mouse.move(450, 650);
  await coarsePage.waitForTimeout(700);
  assert.ok(await coarsePage.locator('[data-auth-paper]').evaluateAll(elements => elements.every(el => getComputedStyle(el).transform === 'none')), 'coarse pointer uses static paper composition');
  await coarse.close();
  console.log('Premium auth motion: local light, stable typing, mode timing, live reduced preference and responsive evidence passed.');
} finally { await browser.close(); }
