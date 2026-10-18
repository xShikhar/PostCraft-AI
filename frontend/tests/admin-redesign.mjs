// Fixture coverage only; backend role enforcement is tested separately.
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const executablePath = process.env.BROWSER_PATH || (fs.existsSync('C:/Program Files/Google/Chrome/Application/chrome.exe') ? 'C:/Program Files/Google/Chrome/Application/chrome.exe' : undefined);
const browser = await chromium.launch({ executablePath, headless: true });
const origin = process.env.BASE_URL || 'http://127.0.0.1:3000';
try {
  for (const denied of [true, false]) {
    const context = await browser.newContext({ viewport: { width: 1360, height: 1000 }, reducedMotion: 'reduce' });
    const page = await context.newPage();
    let fail = false;
    const requests = [];
    await page.route('**/api/admin/**', async route => {
      if (route.request().method() === 'OPTIONS') {
        await route.fulfill({ status: 204, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Authorization, Content-Type', 'Access-Control-Allow-Methods': 'GET, OPTIONS' } });
        return;
      }
      const url = new URL(route.request().url()); requests.push(url.pathname + url.search);
      let status = denied ? 403 : 200;
      let data = { detail: 'Admin access required.' };
      if (!denied) {
        if (url.pathname.endsWith('/stats')) data = { users: { total: 51, signups_last_24h: 1, signups_last_7d: 2, signups_last_30d: 3 }, generations: { total: 21, generations_last_24h: 2, generations_last_7d: 4, generations_last_30d: 8, platform_breakdown: { linkedin: 15, x: 6 } } };
        else if (url.pathname.endsWith('/cost-summary')) data = { total_prompt_tokens: 1200, total_completion_tokens: 400, total_cost_usd: .1234, breakdown: { generate: .1234 } };
        else if (url.pathname.endsWith('/audit-logs')) data = { items: [{ id: url.searchParams.get('offset') || 'audit-1', action: 'viewed_user_generations', admin_user_id: 'operator', target_user_id: 'writer', created_at: '2026-10-18T12:00:00Z' }], total: 2 };
        else if (url.pathname.endsWith('/generations')) { status = fail ? 500 : 200; data = fail ? { detail: 'Inspection fixture unavailable' } : { items: [{ generation_id: 'generation-1', topic: 'A real fixture topic', platform: 'linkedin', status: 'editing', raw_thoughts: 'Original raw thoughts', active_draft_index: 1, draft_1: 'First fixture draft', draft_2: 'Second fixture draft', draft_3: null, created_at: '2026-10-18T12:00:00Z' }], total: 1 }; }
        else data = { items: [{ id: 'writer', username: url.searchParams.get('q') || (url.searchParams.get('offset') === '50' ? 'last_writer' : 'writer'), is_admin: false, generation_count: 1, created_at: '2026-10-18T12:00:00Z', last_active_at: null }], total: 51 };
      }
      await route.fulfill({ status, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Authorization, Content-Type' }, contentType: 'application/json', body: JSON.stringify(data) });
    });
    await page.goto(origin + '/admin');
    if (denied) {
      await page.getByRole('heading', { name: 'Restricted console', exact: true }).waitFor();
      assert.equal(await page.getByRole('table').count(), 0);
    } else {
      await page.getByRole('heading', { name: 'The operator’s desk.', exact: true }).waitFor();
      await page.getByRole('region', { name: 'Platform overview' }).getByText('$0.1234', { exact: true }).waitFor();
      if (process.env.ADMIN_SCREENSHOTS) {
        await page.screenshot({ path: '../scratch/admin-light.png', fullPage: true });
        await page.getByRole('button', { name: 'Dark', exact: true }).click();
        await page.screenshot({ path: '../scratch/admin-dark.png', fullPage: true });
        await page.getByRole('button', { name: 'Light', exact: true }).click();
      }
      await page.getByLabel('Search users', { exact: true }).fill('searched');
      await page.getByText('@searched', { exact: true }).waitFor();
      await page.getByLabel('Search users', { exact: true }).fill('');
      await page.getByText('@writer', { exact: true }).waitFor();
      await page.getByRole('button', { name: 'Next users', exact: true }).click();
      await page.getByText('@last_writer', { exact: true }).waitFor();
      await page.getByRole('button', { name: 'Previous users', exact: true }).click();
      const inspect = page.getByRole('button', { name: 'View posts for @writer', exact: true });
      await inspect.click();
      const dialog = page.getByRole('dialog');
      await dialog.getByText('First fixture draft', { exact: true }).waitFor();
      if (process.env.ADMIN_SCREENSHOTS) await page.screenshot({ path: '../scratch/admin-inspector.png', fullPage: true });
      await dialog.getByRole('button', { name: 'Draft 2', exact: true }).click();
      await dialog.getByText('Second fixture draft', { exact: true }).waitFor();
      await dialog.getByRole('button', { name: 'Draft 3', exact: true }).click();
      await dialog.getByText('Draft not generated.', { exact: true }).waitFor();
      await page.keyboard.press('Escape');
      assert.equal(await inspect.evaluate(el => el === document.activeElement), true, 'dialog restores focus to opener');
      fail = true;
      await inspect.click();
      await dialog.getByText('Inspection fixture unavailable', { exact: true }).waitFor();
      assert.equal(await dialog.getByText('First fixture draft', { exact: true }).count(), 0, 'failed new inspection never shows stale content');
      fail = false;
      await dialog.getByRole('button', { name: 'Retry inspection', exact: true }).click();
      await dialog.getByText('First fixture draft', { exact: true }).waitFor();
      await page.keyboard.press('Escape');
      await page.getByRole('button', { name: 'Load more audit records', exact: true }).click();
      assert.ok(requests.some(request => request.includes('audit-logs?limit=20&offset=1')));
      await page.setViewportSize({ width: 390, height: 844 });
      assert.ok(await page.locator('body').evaluate(el => el.scrollWidth <= innerWidth + 1));
      if (process.env.ADMIN_SCREENSHOTS) await page.screenshot({ path: '../scratch/admin-mobile.png', fullPage: true });
    }
    await context.close();
  }
  console.log('Admin fixtures passed: forbidden role, real stats/cost display, search, paging, audit load, draft inspection, missing drafts, errors/retry, focus restoration and mobile overflow.');
} finally { await browser.close(); }
