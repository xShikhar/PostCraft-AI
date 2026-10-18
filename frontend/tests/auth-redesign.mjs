// Deterministic UI fixtures: these assertions do not prove live authentication.
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const executablePath = process.env.BROWSER_PATH || (fs.existsSync('C:/Program Files/Google/Chrome/Application/chrome.exe') ? 'C:/Program Files/Google/Chrome/Application/chrome.exe' : undefined);
const browser = await chromium.launch({ executablePath, headless: true });
try {
  for (const remember of [false, true]) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
    const page = await context.newPage();
    const requests = [];
    let accept = false;
    await page.route('**/api/**', async route => {
      const path = new URL(route.request().url()).pathname;
      const method = route.request().method();
      const auth = path.includes('/auth/');
      if (auth && method === 'POST') requests.push({ path, data: route.request().postData() });
      const status = method === 'OPTIONS' ? 204 : auth && !accept ? 401 : 200;
      const body = auth ? accept ? { access_token: 'auth-fixture-token' } : { detail: 'Invalid fixture credentials' } : path.endsWith('/me') ? { id: 'auth-fixture', username: 'writer', is_admin: false } : path.endsWith('/metrics') ? { total: 0, finalized: 0, in_progress: 0, recent_dates: [] } : { items: [], total: 0 };
      await route.fulfill({ status, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Authorization, Content-Type', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS' }, contentType: 'application/json', body: status === 204 ? '' : JSON.stringify(body) });
    });
    await page.goto(process.env.BASE_URL || 'http://localhost:3000');
    await page.getByRole('heading', { name: 'POSTCRAFT AI', exact: true }).waitFor();
    await page.mouse.move(650, 650);
    assert.ok(await page.locator('[data-auth-paper]').evaluateAll(elements => elements.every(el => getComputedStyle(el).transform === 'none')), 'reduced motion disables paper tracking');
    await page.getByRole('button', { name: 'Privacy', exact: true }).click();
    await page.getByRole('heading', { name: 'Privacy Policy', exact: true }).waitFor();
    await page.getByRole('button', { name: 'Back', exact: true }).click();
    await page.getByRole('button', { name: 'Sign in to PostCraft', exact: true }).click();
    assert.equal(requests.length, 0, 'native validation prevents empty submission');
    await page.getByRole('button', { name: 'Sign up', exact: true }).click();
    await page.locator('#username').fill('writer');
    await page.locator('#password').fill('password123');
    assert.equal(await page.getByRole('button', { name: 'Create account', exact: true }).isDisabled(), true);
    await page.getByLabel(/I agree to the/).check();
    assert.equal(await page.getByRole('button', { name: 'Create account', exact: true }).isEnabled(), true);
    await page.getByRole('button', { name: 'Create account', exact: true }).click();
    await page.getByText('Invalid fixture credentials', { exact: true }).first().waitFor();
    const signup = requests.find(request => request.path.endsWith('/signup'));
    assert.ok(signup, 'signup is sent through the real API client');
    assert.equal(JSON.parse(signup.data).agreed_to_terms, true);
    assert.equal(JSON.parse(signup.data).password, 'password123');
    await page.getByRole('button', { name: 'Log in', exact: true }).click();
    await page.locator('#username').fill('writer');
    await page.locator('#password').fill('password123');
    await page.locator('#password').press('Tab');
    assert.equal(await page.getByRole('button', { name: 'Show password', exact: true }).evaluate(el => el === document.activeElement), true, 'password visibility is keyboard reachable');
    await page.keyboard.press('Enter');
    assert.equal(await page.locator('#password').getAttribute('type'), 'text');
    await page.getByRole('button', { name: 'Hide password', exact: true }).click();
    await page.getByRole('button', { name: 'Sign in to PostCraft', exact: true }).click();
    await page.getByText('Invalid fixture credentials', { exact: true }).first().waitFor();
    assert.equal(await page.locator('#username').inputValue(), 'writer');
    assert.equal(await page.locator('#password').inputValue(), 'password123');
    assert.equal(await page.evaluate(() => sessionStorage.getItem('postcraft_token') || localStorage.getItem('postcraft_token')), null);
    await page.getByRole('button', { name: 'Switch to dark theme', exact: true }).click();
    assert.match(await page.locator('html').getAttribute('class'), /dark/);
    await page.getByRole('button', { name: 'Switch to light theme', exact: true }).click();
    await page.setViewportSize({ width: 390, height: 844 });
    assert.ok(await page.locator('body').evaluate(el => el.scrollWidth <= innerWidth + 1), 'mobile has no horizontal overflow');
    accept = true;
    if (remember) await page.getByLabel('Remember this session (30 days)', { exact: true }).check();
    await page.getByRole('button', { name: 'Sign in to PostCraft', exact: true }).click();
    await page.waitForFunction(() => sessionStorage.getItem('postcraft_token') || localStorage.getItem('postcraft_token'));
    const stored = await page.evaluate(() => ({ session: sessionStorage.getItem('postcraft_token'), local: localStorage.getItem('postcraft_token') }));
    assert.deepEqual(stored, remember ? { session: null, local: 'auth-fixture-token' } : { session: 'auth-fixture-token', local: null });
    await context.close();
  }
  const motionContext = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'no-preference' });
  const motionPage = await motionContext.newPage();
  await motionPage.goto(process.env.BASE_URL || 'http://localhost:3000');
  await motionPage.getByRole('heading', { name: 'POSTCRAFT AI', exact: true }).waitFor();
  const formBounds = await motionPage.locator('#username').boundingBox();
  await motionPage.mouse.move(650, 650);
  await motionPage.waitForFunction(() => [...document.querySelectorAll('[data-auth-paper]')].some(el => Math.abs(new DOMMatrix(getComputedStyle(el).transform).m41) > 1));
  assert.deepEqual(await motionPage.locator('#username').boundingBox(), formBounds, 'pointer motion must never move the form');
  await motionContext.close();
  console.log('Auth fixtures passed: validation, consent, keyboard, failure retention, themes, mobile, session storage, reduced motion and stationary form during paper motion.');
} finally {
  await browser.close();
}
