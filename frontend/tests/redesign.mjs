import { chromium } from "playwright";
import assert from "node:assert/strict";
import fs from "node:fs";

const browser = await chromium.launch({
  headless: true,
  executablePath:
    process.env.BROWSER_PATH ||
    "C:/Program Files/Google/Chrome/Application/chrome.exe",
});
const context = await browser.newContext({
  viewport: { width: 1440, height: 1000 },
  reducedMotion: "reduce",
});
const page = await context.newPage();
const origin = process.env.BASE_URL || "http://127.0.0.1:3000";
const id = "11111111-1111-4111-8111-111111111111";
const original =
  "Decision ownership begins with a name. Give every review a deadline and make the next action explicit.";
let draft = original,
  saved = 0,
  status = "editing",
  failSave = false;
let version = "2026-10-18T10:00:00.000000";
let qualityData = {
  result: "PASS",
  scope: "draft",
  draft_index: 1,
  substance_score: 8,
};
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await page.route("**/api/**", async (route) => {
  const req = route.request(),
    u = new URL(req.url()),
    method = req.method();
  let body = {},
    code = 200;
  const item = {
    generation_id: id,
    project_id: "22222222-2222-4222-8222-222222222222",
    topic: "Decision ownership",
    platform: "linkedin",
    status,
    active_draft_index: 1,
    created_at: version,
    updated_at: version,
    preview: draft,
    draft_1: draft,
    draft_2: original + " A second angle.",
    draft_3: original + " A third angle.",
  };
  if (method === "OPTIONS") code = 204;
  else if (
    u.pathname === "/api/auth/login" ||
    u.pathname === "/api/auth/signup"
  )
    body = { access_token: "redesign-fixture" };
  else if (u.pathname === "/api/users/me")
    body = {
      id: "fixture-writer",
      username: "writer",
      about_me: "Engineering leader",
      profile_context: "Software",
      writing_style: "Clear and direct",
      is_admin: false,
    };
  else if (u.pathname === "/api/users/me/resume") body = null;
  else if (u.pathname === "/api/users/me/style-profile")
    body = { current: null, history: [] };
  else if (u.pathname.endsWith("/metrics"))
    body = { total: 1, finalized: 0, in_progress: 1, recent_dates: [version] };
  else if (u.pathname.endsWith("/full"))
    body = {
      ...item,
      raw_thoughts: "Explicit decision ownership",
      sources: [
        {
          title: "Research source",
          snippet: "A sourced description",
          url: "https://example.com/research",
        },
      ],
      research_source: "general_search",
      research_confidence: "medium",
      research_retrieved_at: null,
      quality: qualityData,
      original_drafts: { draft_1: original },
      chat_history: [],
    };
  else if (u.pathname === "/api/generations" && method === "POST")
    body = {
      ...item,
      sources: [],
      research_confidence: "low",
      research_source: "synthetic_structure",
    };
  else if (u.pathname === `/api/generations/${id}` && method === "PATCH") {
    const data = req.postDataJSON();
    if (failSave) {
      code = 409;
      body = { detail: "Draft changed in another tab. Reload before saving." };
    } else {
      assert.equal(data.expected_updated_at, version);
      draft = data.content;
      status = "needs_review";
      qualityData = null;
      saved++;
      version = new Date(Date.UTC(2026, 9, 18, 10, saved)).toISOString();
      body = {
        generation_id: id,
        draft_index: 1,
        content: draft,
        updated_at: version,
        status,
      };
    }
  } else if (u.pathname.endsWith("/edit")) {
    draft += " Revised for clarity.";
    version = "2026-10-18T10:02:00.000000";
    body = {
      revised_draft: draft,
      reply: "Clarified the draft.",
      status: "editing",
    };
  } else if (u.pathname.endsWith("/finalize")) {
    status = "finalized";
    body = { status };
  } else if (u.pathname === "/api/generations")
    body = { items: [item], total: 1, limit: 20, offset: 0 };
  else {
    code = 404;
    body = { detail: `Unexpected fixture endpoint ${u.pathname}` };
  }
  await route.fulfill({
    status: code,
    contentType: "application/json",
    headers: {
      "Access-Control-Allow-Origin": origin,
      "Access-Control-Allow-Headers": "Authorization, Content-Type",
      "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
    },
    body: code === 204 ? "" : JSON.stringify(body),
  });
});
try {
  const firstResponse = await page.goto(origin);
  assert.match(firstResponse.headers()["content-security-policy"], /nonce-/);
  await page.locator("#username").fill("writer");
  await page.locator("#password").fill("password123");
  await page.getByRole("button", { name: /Sign in to PostCraft/i }).click();
  await page.goto(`${origin}/?view=editor&generation=${id}&draft=1`);
  const editor = page.getByRole("textbox", { name: "Draft text", exact: true });
  await editor.waitFor();
  await page.getByText(/The last automated quality review passed/).waitFor();
  await page.getByRole("button", { name: "Draft 2", exact: true }).click();
  assert.equal(
    await page.getByText(/The last automated quality review passed/).count(),
    0,
    "a draft-specific PASS cannot evaluate a sibling variation",
  );
  await page.getByRole("button", { name: "Draft 1", exact: true }).click();
  await editor.fill(original + " My saved revision.");
  await page
    .getByRole("button", { name: "Undo last change", exact: true })
    .click();
  assert.equal(await editor.inputValue(), original);
  await page
    .getByRole("button", { name: "Redo last change", exact: true })
    .click();
  assert.match(await editor.inputValue(), /My saved revision/);
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await page.getByText("All changes saved", { exact: true }).waitFor();
  assert.equal(saved, 1);
  assert.match(page.url(), /generation=/);
  await page.reload();
  await editor.waitFor();
  assert.match(await editor.inputValue(), /My saved revision/);
  await editor.fill(original + " Saved while switching variations.");
  await page.getByRole("button", { name: "Draft 2", exact: true }).click();
  await page
    .getByRole("button", { name: "Save and continue", exact: true })
    .click();
  await page.getByRole("button", { name: "Draft 1", exact: true }).click();
  assert.match(
    await editor.inputValue(),
    /Saved while switching variations/,
    "switching must use the newly saved record",
  );
  await page.getByRole("button", { name: "Home", exact: true }).click();
  await page.goBack();
  await editor.waitFor();
  await page.goForward();
  await page
    .getByRole("heading", { name: /Good (morning|afternoon|evening),/ })
    .waitFor();
  await page.goBack();
  await editor.waitFor();
  await editor.fill("Unsaved text must not disappear.");
  await page.getByRole("button", { name: "Home", exact: true }).first().click();
  await page
    .getByRole("dialog")
    .getByText("Unsaved changes", { exact: true })
    .waitFor();
  await page.getByRole("button", { name: "Keep editing", exact: true }).click();
  assert.equal(await editor.inputValue(), "Unsaved text must not disappear.");
  failSave = true;
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await page
    .getByText(/Draft changed in another tab/)
    .first()
    .waitFor();
  assert.equal(await editor.inputValue(), "Unsaved text must not disappear.");
  failSave = false;
  fs.mkdirSync("../scratch/redesign-qa", { recursive: true });
  await page.screenshot({
    path: "../scratch/redesign-qa/editor-light.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Dark", exact: true }).first().click();
  await page.screenshot({
    path: "../scratch/redesign-qa/editor-dark.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  assert.ok(
    await page.locator("body").evaluate((e) => e.scrollWidth <= innerWidth + 1),
    "mobile overflow",
  );
  await page.screenshot({
    path: "../scratch/redesign-qa/editor-mobile.png",
    fullPage: true,
  });
  assert.deepEqual(errors, []);
  console.log(
    "Redesign lifecycle passed: persisted save, reload/deep-link, dirty guard, save conflict, themes and mobile. Fixtures only.",
  );
} finally {
  await browser.close();
}
