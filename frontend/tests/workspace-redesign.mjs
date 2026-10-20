/* API fixtures only. Run from frontend: BASE_URL=http://127.0.0.1:3000 node tests/workspace-redesign.mjs */
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const origin = process.env.BASE_URL || 'http://127.0.0.1:3000';
const output = '../scratch/redesign-qa';
fs.mkdirSync(output, { recursive: true });
const browser = await chromium.launch({ headless: true, executablePath: process.env.BROWSER_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' }), page = await context.newPage();
const errors = [], focusProblems = [];
page.on('pageerror', e => errors.push(e.message));
const id = '33333333-3333-4333-8333-333333333333';
const originals = ['Give every decision a named owner. A clear deadline turns an open question into an action.', 'Our review stalled for a week. Naming one owner and a deadline made the next step obvious.', 'The smallest useful process change: put a name and a date beside every decision.'];
const state = { username: 'writer', userId: 'workspace-writer', complete: true, empty: false, failRecent: false, failMetrics: false, failGenerate: true, failEdit: true, status: 'editing', version: '2026-10-18T10:00:00.000000', drafts: [...originals], chat: [], generations: [], edits: [], saves: [], finalizations: [], fullReads: 0, queries: [] };
const item = () => ({ generation_id: id, project_id: '44444444-4444-4444-8444-444444444444', topic: 'Decision ownership', platform: 'x', status: state.status, active_draft_index: state.status === 'finalized' ? 2 : 1, created_at: '2026-10-18T10:00:00Z', updated_at: state.version, preview: state.drafts[0], draft_1: state.drafts[0], draft_2: state.drafts[1], draft_3: state.drafts[2] });
await page.addInitScript(() => {
    if (!sessionStorage.getItem('workspace:initialized')) {
        sessionStorage.setItem('postcraft_token', 'workspace-fixture');
        sessionStorage.setItem('workspace:initialized', 'true');
    }
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async () => { throw new Error('Fixture clipboard denied'); } } });
});
await page.route('**/api/**', async (route) => {
    const req = route.request(), u = new URL(req.url()), method = req.method();
    let body = {}, status = 200;
    if (method === 'OPTIONS')
        status = 204;
    else if (u.pathname === '/api/auth/login') {
        state.username = new URLSearchParams(req.postData()).get('username');
        state.userId = state.username === 'second_writer' ? 'workspace-second' : 'workspace-writer';
        body = { access_token: 'fixture-' + state.username };
    }
    else if (u.pathname === '/api/users/me')
        body = { id: state.userId, username: state.username, is_admin: false, about_me: state.complete ? 'Engineering leader' : '', profile_context: state.complete ? 'Product development' : '', writing_style: state.complete ? 'Clear and considered' : '' };
    else if (u.pathname === '/api/users/me/resume')
        body = null;
    else if (u.pathname === '/api/users/me/style-profile')
        body = { current: null, history: [] };
    else if (u.pathname === '/api/generations/metrics') {
        if (state.failMetrics) {
            status = 503;
            body = { detail: 'Fixture activity unavailable' };
        }
        else {
            const now = new Date(), yesterday = new Date(now);
            yesterday.setDate(now.getDate() - 1);
            body = state.empty ? { total: 0, finalized: 0, in_progress: 0, recent_dates: [] } : { total: 17, finalized: 5, in_progress: 12, recent_dates: [now.toISOString(), now.toISOString(), now.toISOString(), yesterday.toISOString()] };
        }
    }
    else if (u.pathname === '/api/generations' && method === 'POST') {
        state.generations.push(req.postDataJSON());
        await new Promise(resolve => setTimeout(resolve, 250));
        if (state.failGenerate) {
            state.failGenerate = false;
            status = 503;
            body = { detail: 'Fixture provider unavailable; your input is safe.' };
        }
        else
            body = { ...item(), sources: [], research_source: 'synthetic_structure', research_confidence: 'low', substance_score: 7.6 };
    }
    else if (u.pathname === `/api/generations/${id}/edit`) {
        const data = req.postDataJSON();
        state.edits.push(data);
        if (state.failEdit) {
            state.failEdit = false;
            status = 503;
            body = { detail: 'Fixture revision unavailable; retry your instruction.' };
        }
        else {
            state.drafts[data.draft_index - 1] += ' Name the owner before the meeting ends.';
            state.version = '2026-10-18T10:02:00.000000';
            state.chat.push({ role: 'user', content: data.instruction, draft_index: data.draft_index }, { role: 'assistant', content: 'Made the opening more specific.', draft_index: data.draft_index });
            body = { revised_draft: state.drafts[data.draft_index - 1], reply: 'Made the opening more specific.', status: 'editing' };
        }
    }
    else if (u.pathname === `/api/generations/${id}/finalize`) {
        state.finalizations.push(req.postDataJSON());
        state.status = 'finalized';
        body = { status: state.status };
    }
    else if (u.pathname === `/api/generations/${id}` && method === 'PATCH') {
        const data = req.postDataJSON();
        state.saves.push(data);
        assert.equal(data.expected_updated_at, state.version, 'AI revision must refresh the version for manual saves');
        state.drafts[data.draft_index - 1] = data.content;
        state.version = '2026-10-18T10:03:00.000000';
        state.status = 'needs_review';
        body = { generation_id: id, draft_index: data.draft_index, content: data.content, updated_at: state.version, status: state.status };
    }
    else if (u.pathname === `/api/generations/${id}/full`) {
        state.fullReads++;
        if (state.userId === 'workspace-second') {
            status = 404;
            body = { detail: 'Generation not found' };
        }
        else
            body = { ...item(), raw_thoughts: 'Explicit ownership avoids stalled review.', chat_history: state.chat, sources: [], research_source: 'synthetic_structure', research_confidence: 'low', research_retrieved_at: null, quality: null, original_drafts: { draft_1: originals[0], draft_2: originals[1], draft_3: originals[2] } };
    }
    else if (u.pathname === '/api/generations') {
        state.queries.push(Object.fromEntries(u.searchParams));
        if (state.failRecent) {
            status = 503;
            body = { detail: 'Fixture recent work unavailable' };
        }
        else
            body = { items: state.empty || state.userId === 'workspace-second' ? [] : [item()], total: state.empty || state.userId === 'workspace-second' ? 0 : 1, limit: Number(u.searchParams.get('limit') || 20), offset: 0 };
    }
    else {
        status = 404;
        body = { detail: `Unexpected fixture endpoint ${method} ${u.pathname}` };
    }
    await route.fulfill({ status, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Headers': 'Authorization, Content-Type', 'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS' }, body: status === 204 ? '' : JSON.stringify(body) });
});
const shot = name => page.screenshot({ path: `${output}/${name}.png`, fullPage: true });
const viewport = async (w, h) => { await page.setViewportSize({ width: w, height: h }); await page.waitForTimeout(120); };
const noOverflow = async (label) => assert.ok(await page.locator('body').evaluate(e => e.scrollWidth <= innerWidth + 1), `${label} must not overflow horizontally`);
const theme = async (name) => { await page.getByRole('button', { name, exact: true }).first().click(); await page.waitForTimeout(120); };
const home = () => page.getByRole('button', { name: 'Home', exact: true }).first().click();
const waitHome = () => page.getByRole('heading', { name: /Good (morning|afternoon|evening),/ }).waitFor();
const capture = async (name) => { await shot(name + '-light'); await theme('Dark'); await shot(name + '-dark'); await theme('Light'); await viewport(390, 844); await noOverflow(name); await shot(name + '-mobile'); await viewport(1440, 1000); };
try {
    await page.goto(origin);
    await waitHome();
    const rhythm = page.locator('section').filter({ has: page.getByRole('heading', { name: 'Your writing rhythm', exact: true }) });
    await rhythm.getByText('17generations', { exact: true }).waitFor();
    await rhythm.getByText('5finalized', { exact: true }).waitFor();
    await rhythm.getByText('12in progress', { exact: true }).waitFor();
    assert.match(await rhythm.getByRole('img').getAttribute('aria-label'), /3 generations/);
    assert.match(await rhythm.getByRole('img').getAttribute('aria-label'), /1 generations/);
    const cadenceColor = await rhythm.locator('[class*="bg-primary/75"]').first().evaluate(e => getComputedStyle(e).backgroundColor);
    assert.notEqual(cadenceColor, 'rgba(0, 0, 0, 0)', 'Nonzero cadence bars must have a visible semantic primary color');
    await page.getByRole('button', { name: 'Refine your profile', exact: true }).waitFor();
    await capture('dashboard');
    await page.getByLabel('What’s on your mind?', { exact: true }).fill('Explicit ownership avoids stalled review.');
    await page.getByRole('button', { name: 'Synthesize', exact: true }).click();
    await page.getByRole('heading', { name: 'Give your idea a voice.', exact: true }).waitFor();
    assert.equal(await page.locator('#rawThoughts').inputValue(), 'Explicit ownership avoids stalled review.');
    await page.locator('#topic').fill('Decision ownership');
    await page.getByRole('button', { name: 'X / Twitter', exact: true }).click();
    await page.getByLabel('Include saved profile', { exact: true }).uncheck();
    await page.getByText('Additional background', { exact: false }).click();
    await page.locator('#profileContext').fill('Write for product teams making async decisions.');
    await capture('composer');
    const expected = { topic: 'Decision ownership', platform: 'x', raw_thoughts: 'Explicit ownership avoids stalled review.', profile_context: 'Write for product teams making async decisions.', use_context: false };
    await page.getByRole('button', { name: 'Generate Drafts', exact: true }).click();
    await page.getByRole('region', { name: 'Draft generation in progress' }).waitFor();
    assert.equal(await page.locator('#topic').count(), 0);
    await page.getByRole('alert').getByText('Fixture provider unavailable; your input is safe.', { exact: true }).waitFor();
    assert.deepEqual(state.generations[0], expected);
    assert.equal(await page.locator('#topic').inputValue(), expected.topic);
    assert.equal(await page.locator('#rawThoughts').inputValue(), expected.raw_thoughts);
    assert.equal(await page.locator('#profileContext').inputValue(), expected.profile_context);
    assert.equal(await page.getByLabel('Include saved profile', { exact: true }).isChecked(), false);
    await page.getByRole('button', { name: 'Generate Drafts', exact: true }).click();
    await page.getByRole('heading', { name: 'Find your starting point.', exact: true }).waitFor();
    assert.deepEqual(state.generations[1], expected);
    assert.equal(await page.getByRole('heading', { name: /^Draft [123]$/ }).count(), 3);
    await page.getByText('No external research was retrieved. AI-generated structure is guidance, not sourced evidence.', { exact: true }).waitFor();
    await page.getByRole('button', { name: 'Copy draft 1', exact: true }).click();
    await page.getByText('Clipboard access was blocked. Select and copy the text manually.', { exact: true }).waitFor();
    await page.getByText('Clipboard access was blocked. Select and copy the text manually.', { exact: true }).waitFor({ state: 'hidden' });
    await capture('selection');
    await page.getByRole('button', { name: 'Refine inputs', exact: true }).click();
    assert.equal(await page.locator('#rawThoughts').inputValue(), expected.raw_thoughts);
    assert.equal(await page.locator('#profileContext').inputValue(), expected.profile_context);
    await page.getByLabel('Include saved profile', { exact: true }).check();
    await page.getByRole('button', { name: 'Generate Drafts', exact: true }).click();
    await page.getByRole('heading', { name: 'Find your starting point.', exact: true }).waitFor();
    assert.deepEqual(state.generations[2], { ...expected, use_context: true });
    await page.getByRole('button', { name: 'Regenerate drafts', exact: true }).click();
    await page.getByRole('heading', { name: 'Find your starting point.', exact: true }).waitFor();
    assert.deepEqual(state.generations[3], state.generations[2]);
    assert.equal(state.generations.length, 4, 'One request per action');
    await page.getByRole('article').filter({ has: page.getByRole('heading', { name: 'Draft 2', exact: true }) }).getByRole('button', { name: 'Edit', exact: true }).click();
    const editor = page.getByRole('textbox', { name: 'Draft text', exact: true });
    await editor.waitFor();
    assert.equal(await editor.inputValue(), originals[1]);
    assert.match(page.url(), /draft=2/);
    const instruction = page.getByLabel('Revision instruction', { exact: true });
    for (const chip of ['Make it shorter', 'More conversational', 'Strengthen the opening']) {
        await page.getByRole('button', { name: chip, exact: true }).click();
        assert.equal(await instruction.inputValue(), chip);
    }
    await page.getByRole('button', { name: 'Refine draft', exact: true }).click();
    await page.getByRole('alert').filter({ hasText: 'Fixture revision unavailable; retry your instruction.' }).waitFor();
    assert.equal(await instruction.inputValue(), 'Strengthen the opening');
    assert.equal(await editor.inputValue(), originals[1]);
    assert.deepEqual(state.edits[0], { instruction: 'Strengthen the opening', draft_index: 2 });
    const readsBefore = state.fullReads;
    await page.getByRole('button', { name: 'Refine draft', exact: true }).click();
    await page.getByText('Made the opening more specific.', { exact: false }).first().waitFor();
    assert.equal(state.fullReads, readsBefore + 1, 'AI success reloads persisted version');
    assert.equal(await instruction.inputValue(), '');
    assert.match(await editor.inputValue(), /Name the owner/);
    await editor.fill((await editor.inputValue()) + ' Add one clear next step.');
    await page.getByRole('button', { name: 'Save changes', exact: true }).click();
    await page.getByText('All changes saved', { exact: true }).waitFor();
    assert.equal(state.saves[0].expected_updated_at, '2026-10-18T10:02:00.000000');
    await page.getByRole('button', { name: 'Finalize', exact: true }).click();
    await page.getByRole('button', { name: 'Draft 2 Finalized', exact: true }).first().waitFor();
    assert.deepEqual(state.finalizations[0], { final_draft_index: 2 });
    assert.equal(await editor.getAttribute('readonly'), '');
    assert.equal(await instruction.isDisabled(), true);
    await page.getByRole('button', { name: 'Draft 1', exact: true }).click();
    assert.equal(await editor.getAttribute('readonly'), '', 'Other finalized variations must be read-only');
    assert.equal(await page.getByRole('button', { name: 'Refine draft', exact: true }).isDisabled(), true);
    const trigger = page.getByRole('button', { name: 'Search history', exact: true });
    await trigger.click();
    const search = page.getByRole('textbox', { name: 'Search drafts', exact: true });
    await search.waitFor();
    await search.fill('Decision');
    await page.getByRole('dialog').getByRole('button').filter({ hasText: 'Decision ownership' }).waitFor();
    assert.ok(state.queries.some(q => q.q === 'Decision' && q.limit === '8'));
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => document.activeElement?.getAttribute('aria-label') === 'Search history', undefined, { timeout: 1500 }).catch(async () => {
        focusProblems.push(await page.evaluate(() => ({ tag: document.activeElement?.tagName, label: document.activeElement?.getAttribute('aria-label'), text: document.activeElement?.textContent?.slice(0, 100) })));
    });
    await page.keyboard.press('Control+k');
    await search.waitFor();
    await page.keyboard.press('Escape');
    await home();
    await waitHome();
    state.failRecent = true;
    state.failMetrics = true;
    await page.getByRole('button', { name: 'History', exact: true }).click();
    await home();
    await page.getByRole('alert').filter({ hasText: 'Your recent work could not be loaded.' }).waitFor();
    await page.getByText('Activity is unavailable.', { exact: false }).waitFor();
    assert.equal(await rhythm.getByRole('img').count(), 0, 'Unavailable metrics cannot fabricate a zero chart');
    state.failRecent = false;
    state.failMetrics = false;
    state.empty = true;
    state.complete = false;
    await page.getByRole('button', { name: 'Retry', exact: true }).first().click();
    await page.getByRole('heading', { name: 'Your first page is waiting.', exact: true }).waitFor();
    await page.getByRole('button', { name: 'Set up your voice', exact: true }).waitFor();
    await rhythm.getByText('0generations', { exact: true }).waitFor();
    assert.match(await rhythm.getByRole('img').getAttribute('aria-label'), /0 generations/);
    await shot('dashboard-empty');
    await page.getByRole('button', { name: 'New post', exact: true }).first().click();
    await page.locator('#topic').fill('First account private brief');
    await page.locator('#rawThoughts').fill('First account private notes');
    await page.waitForFunction(() => Object.keys(sessionStorage).some(k => k.startsWith('postcraft:compose:workspace-writer')));
    await page.getByRole('button', { name: 'Sign out', exact: true }).first().click();
    await page.locator('#username').waitFor();
    assert.equal(await page.evaluate(() => Object.keys(sessionStorage).filter(k => k.startsWith('postcraft:compose:') || k.startsWith('postcraft:editor:')).length), 0, 'Sign-out clears private recovery buffers');
    await page.locator('#username').fill('second_writer');
    await page.locator('#password').fill('password123');
    await page.getByRole('button', { name: /Sign in to PostCraft/i }).click();
    await waitHome();
    assert.equal(await page.getByRole('heading', { name: /second_writer/ }).count(), 1);
    await page.getByRole('button', { name: 'New post', exact: true }).first().click();
    assert.equal(await page.locator('#topic').inputValue(), '');
    assert.equal(await page.locator('#rawThoughts').inputValue(), '');
    assert.equal(await page.getByText('First account private notes', { exact: false }).count(), 0);
    await page.goto(`${origin}/?view=editor&generation=${id}&draft=2`);
    await page.getByRole('heading', { name: 'Every idea has a place.', exact: true }).waitFor();
    assert.equal(await page.getByRole('textbox', { name: 'Draft text', exact: true }).count(), 0, 'Unauthorized deep-link cannot restore another account draft');
    await home();
    await waitHome();
    await viewport(390, 844);
    await page.getByRole('button', { name: 'Open navigation', exact: true }).click();
    const menu = page.getByRole('dialog', { name: 'Workspace navigation', exact: true });
    await menu.waitFor();
    await menu.getByRole('button', { name: 'New post', exact: true }).click();
    await page.getByRole('heading', { name: 'Give your idea a voice.', exact: true }).waitFor();
    await menu.waitFor({ state: 'hidden' });
    await noOverflow('Mobile drawer navigation');
    assert.deepEqual(errors, []);
    assert.deepEqual(focusProblems, [], 'Search must return focus to its opener after Escape');
    console.log('Workspace fixtures PASS: true metrics/cadence/setup and empty/error states; quick capture; exact generation payload, failure retention, refine inputs and regeneration; selection/copy failure; AI edit failure/success/version refresh/manual save; finalization locks; keyboard search/focus; account switch/recovery clearing; mobile drawer and responsive screenshots. Fixtures only.');
}
catch (error) {
    await shot('workspace-failure');
    console.error((await page.locator('body').innerText()).slice(-4500));
    throw error;
}
finally {
    await browser.close();
}
