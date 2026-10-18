// Deterministic UI fixtures; not live provider evidence.
import { chromium } from "playwright";
import fs from "node:fs";
fs.mkdirSync("../scratch/redesign-qa", { recursive: true });
import assert from "node:assert/strict";
(async () => {
  const browser = await chromium.launch({
    executablePath:
      process.env.BROWSER_PATH ||
      "C:/Program Files/Google/Chrome/Application/chrome.exe",
    headless: true,
  });
  try {
    const page = await browser.newPage({
      viewport: { width: 1440, height: 1000 },
      reducedMotion: "reduce",
    });
    await page.addInitScript(() =>
      sessionStorage.setItem("postcraft_token", "profile-fixture"),
    );
    let failHistory = true;
    let user = {
      id: "fixture-user",
      username: "writer",
      about_me: "Initial identity",
      profile_context: "Engineering",
      writing_style: "Direct",
      is_admin: false,
    };
    let resume = null,
      failSave = true,
      deleted = 0,
      removed = 0,
      resumePatches = 0;
    const queries = [];
    const item = {
      generation_id: "11111111-1111-4111-8111-111111111111",
      project_id: "22222222-2222-4222-8222-222222222222",
      topic: "Decision ownership",
      platform: "linkedin",
      status: "editing",
      active_draft_index: 1,
      created_at: "2026-10-18T10:00:00Z",
      preview: "A useful draft.",
      draft_1: "A useful draft.",
      draft_2: "Second draft.",
      draft_3: "Third draft.",
    };
    await page.route("**/api/**", async (route) => {
      const req = route.request(),
        url = new URL(req.url()),
        method = req.method();
      let body = {},
        status = 200;
      if (method === "OPTIONS") status = 204;
      else if (url.pathname === "/api/users/me" && method === "PATCH") {
        if (failSave) {
          failSave = false;
          status = 503;
          body = { detail: "Temporary save failure" };
        } else {
          Object.assign(user, req.postDataJSON());
          body = user;
        }
      } else if (url.pathname === "/api/users/me") body = user;
      else if (url.pathname === "/api/users/me/export")
        body = { user, generations: [item] };
      else if (url.pathname === "/api/users/me/style-profile")
        body = { current: null, history: [] };
      else if (url.pathname === "/api/users/me/resume") {
        if (method === "DELETE") {
          removed++;
          resume = null;
          body = { status: "deleted", message: "Removed" };
        } else if (method === "POST") {
          resume = {
            id: "r",
            filename: "resume.txt",
            raw_text: "Resume text",
            raw_text_length: 11,
            uploaded_at: "2026-10-18",
            structured_summary: null,
          };
          body = resume;
        } else if (method === "PATCH") {
          resumePatches++;
          resume = { ...resume, raw_text: req.postDataJSON().raw_text };
          body = resume;
        } else body = resume;
      } else if (url.pathname === "/api/generations/metrics")
        body = { total: 1, finalized: 0, in_progress: 1, recent_dates: [] };
      else if (url.pathname === "/api/generations") {
        queries.push(Object.fromEntries(url.searchParams));
        const q = url.searchParams.get("q");
        if (q === "fail" && failHistory) {
          failHistory = false;
          status = 503;
          body = { detail: "Temporary history failure" };
        } else if (q === "paged") {
          const offset = Number(url.searchParams.get("offset") || 0);
          const all = Array.from({ length: 13 }, (_, i) => ({
            ...item,
            generation_id: "paged-" + i,
            topic: "Paged topic " + (i + 1),
          }));
          body = {
            items: all.slice(offset, offset + 12),
            total: 13,
            offset,
            limit: 12,
          };
        } else
          body = {
            items: deleted ? [] : [item],
            total: deleted ? 0 : 1,
            offset: 0,
            limit: 12,
          };
      } else if (
        method === "DELETE" &&
        url.pathname.endsWith(item.generation_id)
      ) {
        deleted++;
        status = 204;
      } else {
        status = 404;
        body = { detail: "Unexpected " + url.pathname };
      }
      await route.fulfill({
        status,
        contentType: "application/json",
        body: status === 204 ? "" : JSON.stringify(body),
      });
    });
    await page.goto(process.env.BASE_URL || "http://127.0.0.1:3000");
    await page
      .getByRole("button", { name: "Profile & Voice", exact: true })
      .click();
    await page
      .getByRole("heading", { name: "Make it sound like you." })
      .waitFor();
    const about = page.getByLabel("A little about you", { exact: true });
    await assert.equal(await about.inputValue(), "Initial identity");
    await about.fill("Edited identity");
    const aboutSection = page.locator("section").filter({ has: about });
    await aboutSection.getByRole("button", { name: "Save changes" }).click();
    await page.getByText("Temporary save failure", { exact: true }).waitFor();
    assert.equal(await about.inputValue(), "Edited identity");
    await aboutSection.getByRole("button", { name: "Save changes" }).click();
    await aboutSection.getByText("Saved", { exact: true }).waitFor();
    assert.equal(user.about_me, "Edited identity");
    assert.equal(user.profile_context, "Engineering");
    assert.equal(user.writing_style, "Direct");
    await about.fill("Unsaved identity");
    await page
      .getByRole("button", { name: "Back to workspace", exact: true })
      .click();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Keep editing" })
      .click();
    assert.equal(await about.inputValue(), "Unsaved identity");
    await about.fill("Edited identity");
    await page
      .getByLabel("Upload resume", { exact: true })
      .setInputFiles({
        name: "resume.txt",
        mimeType: "text/plain",
        buffer: Buffer.from("Resume text"),
      });
    await page.getByText("resume.txt", { exact: true }).waitFor();
    await page.getByRole("button", { name: "Review text" }).click();
    await page
      .getByLabel("Extracted resume text", { exact: true })
      .fill("Updated resume context");
    await page
      .getByRole("button", { name: "Save resume text", exact: true })
      .click();
    await page.getByRole("button", { name: "Review text" }).waitFor();
    assert.equal(resumePatches, 1);
    await page
      .getByRole("button", { name: "Remove resume", exact: true })
      .click();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Keep resume", exact: true })
      .click();
    assert.equal(removed, 0);
    await page
      .getByRole("button", { name: "Remove resume", exact: true })
      .click();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Remove resume", exact: true })
      .click();
    await page.getByText("No resume added yet.", { exact: true }).waitFor();
    assert.equal(removed, 1);
    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: "Export my data" }).click();
    const download = await downloadPromise;
    assert.equal(download.suggestedFilename(), "postcraft-export.json");
    await page
      .getByRole("button", { name: "Delete account", exact: true })
      .click();
    const dialog = page.getByRole("dialog");
    assert.equal(
      await dialog
        .getByRole("button", { name: "Delete permanently" })
        .isDisabled(),
      true,
    );
    await dialog.getByLabel("Your username", { exact: true }).fill("incorrect");
    assert.equal(
      await dialog
        .getByRole("button", { name: "Delete permanently" })
        .isDisabled(),
      true,
    );
    await dialog.getByLabel("Your username", { exact: true }).fill("writer");
    assert.equal(
      await dialog
        .getByRole("button", { name: "Delete permanently" })
        .isEnabled(),
      true,
    );
    await dialog.getByRole("button", { name: "Keep my account" }).click();
    await page.getByRole("button", { name: "History", exact: true }).click();
    await page
      .getByRole("heading", { name: "Decision ownership", exact: true })
      .waitFor();
    await page
      .getByLabel("Search your archive", { exact: true })
      .fill("Decision");
    await page.getByLabel("Platform", { exact: true }).selectOption("linkedin");
    await page.getByLabel("Status", { exact: true }).selectOption("editing");
    await page.getByLabel("Sort by", { exact: true }).selectOption("oldest");
    await page.waitForTimeout(500);
    assert.ok(
      queries.some(
        (q) =>
          q.q === "Decision" &&
          q.platform === "linkedin" &&
          q.status === "editing" &&
          q.sort === "oldest",
      ),
    );
    await page.getByRole("button", { name: "Preview", exact: true }).click();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Draft 2", exact: true })
      .click();
    await page
      .getByRole("dialog")
      .getByText("Second draft.", { exact: true })
      .waitFor();
    await page.keyboard.press("Escape");
    await page
      .getByRole("button", { name: "Delete Decision ownership", exact: true })
      .click();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Keep generation", exact: true })
      .click();
    assert.equal(deleted, 0);
    await page
      .getByRole("button", { name: "Delete Decision ownership", exact: true })
      .click();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Delete generation", exact: true })
      .click();
    await page
      .getByRole("heading", { name: "No matching ideas yet." })
      .waitFor();
    assert.equal(deleted, 1);
    await page.getByLabel("Search your archive", { exact: true }).fill("paged");
    await page
      .getByRole("heading", { name: "Paged topic 1", exact: true })
      .waitFor();
    await page.getByRole("button", { name: "Next page", exact: true }).click();
    await page
      .getByRole("heading", { name: "Paged topic 13", exact: true })
      .waitFor();
    assert.equal(
      await page
        .getByRole("button", { name: "Next page", exact: true })
        .isDisabled(),
      true,
    );
    assert.ok(queries.some((q) => q.q === "paged" && q.offset === "12"));
    await page
      .getByRole("button", { name: "Previous page", exact: true })
      .click();
    await page
      .getByRole("heading", { name: "Paged topic 1", exact: true })
      .waitFor();
    await page.getByLabel("Search your archive", { exact: true }).fill("fail");
    await page
      .getByText("Temporary history failure", { exact: true })
      .waitFor();
    await page.getByRole("button", { name: "Try again", exact: true }).click();
    await page
      .getByRole("heading", { name: "No matching ideas yet." })
      .waitFor();
    await page.getByLabel("Search your archive", { exact: true }).fill("paged");
    await page
      .getByRole("heading", { name: "Paged topic 1", exact: true })
      .waitFor();
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(120);
    assert.ok(
      await page
        .locator("body")
        .evaluate((element) => element.scrollWidth <= innerWidth + 1),
      "mobile archive overflow",
    );
    await page.screenshot({
      path: "../scratch/redesign-qa/history-mobile.png",
      fullPage: true,
    });
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.screenshot({
      path: "../scratch/redesign-qa/history-desktop.png",
      fullPage: true,
    });
    await page
      .getByRole("button", { name: "Profile & Voice", exact: true })
      .click();
    await page
      .getByRole("heading", { name: "Make it sound like you." })
      .waitFor();
    assert.equal(
      await page.getByLabel("A little about you", { exact: true }).inputValue(),
      "Edited identity",
      "saved profile must reload",
    );
    await page.screenshot({
      path: "../scratch/redesign-qa/profile-desktop.png",
      fullPage: true,
    });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(120);
    assert.ok(
      await page
        .locator("body")
        .evaluate((element) => element.scrollWidth <= innerWidth + 1),
      "mobile profile overflow",
    );
    await page.screenshot({
      path: "../scratch/redesign-qa/profile-mobile.png",
      fullPage: true,
    });
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.waitForTimeout(120);
    await page.getByRole("button", { name: "Dark", exact: true }).click();
    await page.screenshot({
      path: "../scratch/redesign-qa/profile-dark.png",
      fullPage: true,
    });
    await page.getByRole("button", { name: "History", exact: true }).click();
    await page
      .getByRole("heading", { name: "Decision ownership", exact: true })
      .waitFor()
      .catch(() => {});
    await page.screenshot({
      path: "../scratch/redesign-qa/history-dark.png",
      fullPage: true,
    });
    console.log(
      "PASS paging, history failure/retry, saved profile reload, mobile overflow and screenshots.",
    );
    console.log(
      "PASS profile independent save/failure retention, dirty cancel, resume upload/edit/remove/cancel, actual export download, typed account guard, history query/filter/sort, preview switching, deletion/cancel and empty state.",
    );
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
