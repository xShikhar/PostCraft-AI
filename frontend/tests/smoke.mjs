/* Run against `npm run start -- -p 3131`; every API is intercepted with fixtures. */
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs';

async function main() {
  const executablePath = process.env.BROWSER_PATH || (process.platform === 'win32' && fs.existsSync('C:/Program Files/Google/Chrome/Application/chrome.exe') ? 'C:/Program Files/Google/Chrome/Application/chrome.exe' : undefined);
  const browser = await chromium.launch({ executablePath, headless: true });
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    const draft = 'Async decisions need named owners. Put a deadline beside each question so reviewers can act. DM me for the review template.';
    const item = { generation_id: '11111111-1111-4111-8111-111111111111', project_id: '22222222-2222-4222-8222-222222222222', topic: 'Decision ownership', platform: 'linkedin', status: 'editing', active_draft_index: 1, created_at: new Date().toISOString(), preview: draft, draft_1: draft, draft_2: draft, draft_3: draft };
    let currentUser = 'writer';
    let generated = false;
    await page.route('**/api/**', async route => {
      const url = new URL(route.request().url());
      const method = route.request().method();
      let body = {};
      let status = 200;
      if (method === 'OPTIONS') status = 204;
      else if (url.pathname === '/api/auth/login' || url.pathname === '/api/auth/signup') body = { access_token: 'smoke-token' };
      else if (url.pathname === '/api/users/me') body = { id: 'user-fixture', username: currentUser, about_me: '', profile_context: 'Engineering', writing_style: 'Direct', is_admin: false };
      else if (url.pathname === '/api/users/me/resume') body = null;
      else if (url.pathname === '/api/users/me/style-profile') body = { current: null, history: [] };
      else if (url.pathname === '/api/generations/metrics') body = { total: 1, finalized: 0, in_progress: 1, recent_dates: [item.created_at] };
      else if (url.pathname.endsWith('/full')) body = { ...item, raw_thoughts: 'Explicit ownership', updated_at: item.created_at, sources: [], chat_history: [{ role: 'user', content: 'Keep it practical', draft_index: 1 }] };
      else if (url.pathname.endsWith('/edit')) body = { revised_draft: draft + ' Make ownership explicit.', reply: 'Clarified the mechanism.', status: 'editing' };
      else if (url.pathname.endsWith('/finalize')) body = { status: 'finalized' };
      else if (url.pathname === '/api/generations' && method === 'POST') { generated = true; body = { ...item, status: 'editing', sources: [], substance_score: 8 }; }
      else if (url.pathname === '/api/generations') body = { items: [item], total: 1, limit: 20, offset: 0 };
      else { status = 404; body = { detail: 'Unexpected fixture endpoint: ' + url.pathname }; }
      await route.fulfill({ status, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': 'http://localhost:3131', 'Access-Control-Allow-Headers': 'Authorization, Content-Type', 'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS' }, body: status === 204 ? '' : JSON.stringify(body) });
    });
    const origin = process.env.BASE_URL || 'http://localhost:3131';
    const response = await page.goto(origin);
    assert.match(response.headers()['content-security-policy'], /nonce-/);
    await page.getByRole('heading', { name: 'POSTCRAFT AI', exact: true }).waitFor();
    await page.getByLabel('Email or username', { exact: true }).fill('writer');
    await page.locator('#password').fill('password123');
    await page.getByRole('button', { name: /Sign in to PostCraft/i }).click();
    await page.getByText(/Good (morning|afternoon|evening),/).waitFor().catch(async error => { console.error(await page.locator('body').innerText()); console.error('Browser errors:', errors); throw error; });
    await page.getByPlaceholder('Capture an unvarnished observation, milestone, or contrarian angle...').fill('Give each decision an owner');
    await page.getByRole('button', { name: 'Synthesize', exact: true }).click();
    assert.equal(await page.locator('#rawThoughts').inputValue(), 'Give each decision an owner');
    await page.locator('#topic').fill('Decision ownership');
    await page.getByRole('button', { name: 'Generate Drafts', exact: true }).click();
    await page.getByRole('heading', { name: 'Select Your Draft' }).waitFor();
    assert.equal(generated, true);
    assert.equal(await page.locator('#topic').count(), 0, 'composer and selection must be distinct');
    await page.getByRole('button', { name: 'Edit', exact: true }).first().click();
    await page.getByPlaceholder('Change Draft 1... (Enter to send)').fill('Clarify ownership');
    await page.getByPlaceholder('Change Draft 1... (Enter to send)').press('Enter');
    await page.getByText('Clarified the mechanism.', { exact: true }).waitFor();
    await page.getByRole('button', { name: /Finalize/ }).click();
    await page.getByRole('button', { name: 'Draft 1 Finalized', exact: true }).waitFor();
    await page.getByRole('button', { name: 'Search history', exact: true }).click();
    await page.getByRole('textbox', { name: 'Search drafts' }).fill('Decision');
    await page.getByRole('button').filter({ hasText: 'Decision ownership' }).last().click();
    await page.getByText('Keep it practical', { exact: true }).waitFor();
    await page.getByRole('button', { name: 'History', exact: true }).click();
    await page.getByRole('textbox', { name: 'Search history' }).fill('Decision');
    await page.getByRole('combobox', { name: 'Filter platform' }).selectOption('linkedin');
    await page.getByText('Decision ownership', { exact: true }).waitFor();
    await page.getByRole('button', { name: 'Profile settings', exact: true }).click();
    await page.getByRole('heading', { name: 'Learned writing style', exact: true }).waitFor();
    await page.getByRole('button', { name: 'Expand sidebar', exact: true }).click();
    await page.getByRole('button', { name: 'Dark', exact: true }).click();
    assert.match(await page.locator('html').getAttribute('class'), /dark/);
    await page.getByRole('button', { name: 'Light', exact: true }).click();
    await page.getByRole('button', { name: 'Sign out', exact: true }).first().click();
    currentUser = 'second_writer';
    await page.locator('#username').fill('second_writer');
    await page.locator('#password').fill('password123');
    await page.getByRole('button', { name: /Sign in to PostCraft/i }).click();
    await page.getByText(/Good (morning|afternoon|evening),/).waitFor();
    assert.equal(await page.getByPlaceholder('Change Draft 1... (Enter to send)').count(), 0, 'old editor must not survive account switching');
    await page.setViewportSize({ width: 390, height: 844 });
    assert.ok(await page.locator('body').evaluate(element => element.scrollWidth <= window.innerWidth + 1), 'mobile must not overflow horizontally');
    assert.deepEqual(errors, []);
    console.log('Browser smoke passed: auth, capture, distinct views, generation, editing, finalization, search, history, profile, themes, account switching, mobile and nonce CSP.');
  } finally { await browser.close(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
