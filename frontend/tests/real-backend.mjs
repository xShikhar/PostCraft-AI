// Real FastAPI and disposable SQLite integration. No API success fixtures.
// Start backend/tests/serve_browser_e2e.py first. Browser traffic is forwarded
// unchanged to its isolated port; this keeps the frontend API build setting intact.
import { chromium } from "playwright";
import assert from "node:assert/strict";
const origin = process.env.BASE_URL || "http://127.0.0.1:3000";
const backend = process.env.E2E_API_URL || "http://127.0.0.1:8765";
const id = "11111111-1111-4111-8111-111111111111";
const run = Date.now();
const profileText = `A saved profile from the real disposable backend. Run ${run}.`;
const browser = await chromium.launch({
  headless: true,
  executablePath:
    process.env.BROWSER_PATH ||
    "C:/Program Files/Google/Chrome/Application/chrome.exe",
});
try {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    reducedMotion: "reduce",
  });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.route("**/api/**", async (route) => {
    const url = new URL(route.request().url());
    const response = await route.fetch({
      url: backend + url.pathname + url.search,
    });
    await route.fulfill({ response });
  });
  await page.goto(origin);
  await page.locator("#username").fill("e2e_writer");
  await page.locator("#password").fill("local-e2e-password123");
  await page.getByRole("button", { name: /Sign in to PostCraft/i }).click();
  await page
    .getByRole("button", { name: "Profile & Voice", exact: true })
    .click();
  await page.locator("#profile-about_me").fill(profileText);
  await page
    .locator("#profile-about_me")
    .locator("..")
    .getByRole("button", { name: "Save changes", exact: true })
    .click();
  await page.getByText("Saved", { exact: true }).first().waitFor();
  await page.reload();
  await page.locator("#profile-about_me").waitFor();
  assert.equal(
    await page.locator("#profile-about_me").inputValue(),
    profileText,
  );
  await page.goto(`${origin}/?view=editor&generation=${id}&draft=1`);
  const editor = page.getByRole("textbox", { name: "Draft text", exact: true });
  await editor.waitFor();
  const revision = `A real persisted revision. Give each review a named owner, a deadline, and one next action. Run ${run}.`;
  await editor.fill(revision);
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await page.getByText("All changes saved", { exact: true }).waitFor();
  await page.reload();
  await editor.waitFor();
  assert.equal(await editor.inputValue(), revision);
  const token = await page.evaluate(() =>
    sessionStorage.getItem("postcraft_token"),
  );
  const response = await fetch(`${backend}/api/generations/${id}/full`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  assert.equal(response.status, 200);
  assert.equal((await response.json()).draft_1, revision);
  const signup = await fetch(`${backend}/api/auth/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      username: `stranger_${Date.now()}`,
      password: "local-test-password123",
      agreed_to_terms: true,
      terms_version: "2026-10-15",
    }),
  });
  assert.equal(signup.status, 200);
  const stranger = (await signup.json()).access_token;
  assert.equal(
    (
      await fetch(`${backend}/api/generations/${id}/full`, {
        headers: { Authorization: `Bearer ${stranger}` },
      })
    ).status,
    404,
  );
  await page.getByRole("button", { name: "History", exact: true }).click();
  await page.locator("#history-status").selectOption("needs_review");
  await page.getByText("Decision ownership", { exact: true }).first().waitFor();
  await page.getByRole("button", { name: "Delete Decision ownership" }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: /Delete/ })
    .click();
  await page
    .getByText(/No matching ideas yet|A fresh page awaits/i)
    .first()
    .waitFor();
  assert.equal(
    (
      await fetch(`${backend}/api/generations/${id}/full`, {
        headers: { Authorization: `Bearer ${token}` },
      })
    ).status,
    404,
  );
  assert.deepEqual(errors, []);
  console.log(
    "Real backend browser integration passed: login, profile save/reload, draft save/reload, signup, account isolation, status filter and deletion. Disposable SQLite; no provider calls.",
  );
} finally {
  await browser.close();
}
