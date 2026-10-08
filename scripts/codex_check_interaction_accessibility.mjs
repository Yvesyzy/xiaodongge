import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { chromium } from "playwright";
import { createServer } from "vite";
import { makeJournalFixtures } from "../mobile/codex_journal_fixtures.mjs";
import { freeLoopbackPort, qaOptions } from "./codex_qa_options.mjs";

let { origin, output: outputOption } = qaOptions({ output: `release/codex_t08_interaction_${Date.now()}` });
const output = resolve(outputOption);
let server;
if (!process.argv.includes("--origin")) {
  server = await createServer({ configFile: resolve("mobile/vite.config.ts"), cacheDir: join(output, "vite-cache"),
    server: { host: "127.0.0.1", port: await freeLoopbackPort(), strictPort: true, forwardConsole: false } });
  await server.listen();
  origin = `http://127.0.0.1:${server.httpServer.address().port}`;
}

const entries = makeJournalFixtures("6").slice(0, 3).map((entry, index) => ({ ...entry, id: `t08-${index + 1}`, type: "album",
  title: `榜单测试 ${index + 1}`, albumName: `榜单测试 ${index + 1}`, artistName: `艺人 ${index + 1}`, songName: null, year: 2026 }));
const albums = entries.map(entry => ({ albumName: entry.albumName, artistName: entry.artistName, note: `理由 ${entry.id}` }));
const report = { origin, passed: false, checks: [] };
let browser;
let page;
let touchContext;
try {
  browser = await chromium.launch({ channel: "chrome", headless: true });
  page = await browser.newPage({ viewport: { width: 390, height: 844 }, timezoneId: "Asia/Shanghai" });
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.goto(`${origin}/#/privacy`);
  await page.evaluate(({ entries, albums }) => {
    localStorage.clear();
    localStorage.setItem("music-feelings-mobile-entries", JSON.stringify(entries));
    localStorage.setItem("music-feelings-mobile-app-data", JSON.stringify({ "top-albums:2026": JSON.stringify({ albums }) }));
  }, { entries, albums });
  await page.goto(`${origin}/#/summary?year=2026&view=rank-edit`);
  await page.getByRole("heading", { name: "编辑年度专辑榜单" }).waitFor();
  await page.getByRole("button", { name: "移除 榜单测试 2" }).click();
  assert.equal(await page.locator(".journal-selected-entry").count(), 2);
  await page.getByRole("button", { name: "上移 榜单测试 3" }).click();
  assert.match(await page.locator(".journal-selected-entry").first().innerText(), /榜单测试 3/);
  await page.getByRole("button", { name: "保存年度专辑榜单" }).click();
  await page.getByRole("heading", { name: "我的年度专辑榜单" }).waitFor();
  assert.deepEqual(await page.locator(".journal-rank-info strong").allInnerTexts(), ["榜单测试 3", "榜单测试 1"]);
  await page.reload();
  await page.locator(".journal-rank-info strong").first().waitFor();
  assert.deepEqual(await page.locator(".journal-rank-info strong").allInnerTexts(), ["榜单测试 3", "榜单测试 1"]);
  report.checks.push("Selected albums can be removed and reordered, then persist across reload");

  const backup = await page.evaluate(async () => {
    const { store } = await import("/src/store.ts");
    return store.exportBackup();
  });
  assert.deepEqual(JSON.parse(JSON.parse(backup).appData["top-albums:2026"]).albums.map(item => item.albumName), ["榜单测试 3", "榜单测试 1"]);
  await page.evaluate(async raw => {
    const { store } = await import("/src/store.ts");
    await store.setStoredAppData("top-albums:2026", JSON.stringify({ albums: [] }));
    await store.importBackup(raw);
    for (const id of ["t08-1", "t08-2", "t08-3"]) await store.deleteEntry(id);
  }, backup);
  const remaining = await page.evaluate(async () => (await (await import("/src/store.ts")).store.listEntries()).map(entry => entry.id));
  assert.deepEqual(remaining, [], "source entries were deleted after backup round-trip");
  await page.goto(`${origin}/#/summary?year=2026&view=rank`);
  await page.reload();
  await page.getByRole("heading", { name: "我的年度专辑榜单" }).waitFor();
  await page.locator(".journal-rank-info strong").first().waitFor();
  assert.deepEqual(await page.locator(".journal-rank-info strong").allInnerTexts(), ["榜单测试 3", "榜单测试 1"]);
  await page.goto(`${origin}/#/summary?year=2026`);
  await page.getByRole("heading", { name: "这一年还没有正式音乐记录" }).waitFor();
  await page.getByRole("link", { name: "查看年度专辑榜单（2 张）" }).waitFor({ timeout: 5000 });
  await page.getByRole("link", { name: "查看年度专辑榜单（2 张）" }).click();
  await page.getByRole("button", { name: "保存榜单图片" }).waitFor();
  assert.equal(await page.getByRole("button", { name: "保存榜单图片" }).count(), 1);
  await page.getByRole("button", { name: "保存榜单图片" }).click();
  await page.locator(".journal-export-preview").waitFor();
  report.checks.push("Backup round-trip and deleted source records preserve an empty-year ranking and export");

  await page.goto(`${origin}/#/new`);
  assert.equal(await page.locator("details.writing-extras").evaluate(element => element.open), true, "完整乐评应直接显示补充字段");
  const slider = page.getByRole("slider", { name: "评分" });
  await slider.waitFor({ timeout: 5000 });
  assert.equal(await slider.getAttribute("tabindex"), "0");
  assert.equal(await slider.getAttribute("aria-valuetext"), "未评分");
  assert.ok(Number(await slider.getAttribute("aria-valuenow")) >= Number(await slider.getAttribute("aria-valuemin")));
  await page.keyboard.press("Tab");
  await slider.focus();
  await page.keyboard.press("Shift+Tab");
  assert.equal(await slider.evaluate(element => document.activeElement === element), false);
  await page.keyboard.press("Tab");
  assert.equal(await slider.evaluate(element => document.activeElement === element), true);
  assert.equal(await slider.evaluate(element => getComputedStyle(element).outlineStyle !== "none"), true);
  await slider.press("ArrowRight");
  assert.equal(await slider.getAttribute("aria-valuenow"), "0.5");
  await slider.press("ArrowUp");
  assert.equal(await slider.getAttribute("aria-valuenow"), "1");
  await slider.press("PageUp");
  assert.equal(await slider.getAttribute("aria-valuenow"), "2");
  await slider.press("PageDown");
  assert.equal(await slider.getAttribute("aria-valuenow"), "1");
  await slider.press("ArrowDown");
  assert.equal(await slider.getAttribute("aria-valuenow"), "0.5");
  await slider.press("End");
  assert.equal(await slider.getAttribute("aria-valuenow"), "10");
  await slider.press("ArrowRight");
  assert.equal(await slider.getAttribute("aria-valuenow"), "10");
  await slider.press("Home");
  assert.equal(await slider.getAttribute("aria-valuenow"), "0.5");
  await slider.press("ArrowLeft");
  assert.equal(await slider.getAttribute("aria-valuenow"), "0.5");
  assert.equal(await page.locator('input[name="rating"]').inputValue(), "0.5");
  await page.getByRole("button", { name: "清除评分" }).click();
  assert.equal(await slider.getAttribute("aria-valuetext"), "未评分");
  assert.equal(await page.locator('input[name="rating"]').inputValue(), "");
  const bounds = await slider.boundingBox();
  assert.ok(bounds);
  await page.mouse.move(bounds.x + bounds.width * 0.25, bounds.y + bounds.height / 2);
  await page.mouse.down();
  await page.mouse.move(bounds.x + bounds.width * 0.75, bounds.y + bounds.height / 2, { steps: 4 });
  await page.mouse.up();
  assert.ok(Number(await page.locator('input[name="rating"]').inputValue()) >= 0.5);
  await page.getByRole("button", { name: "加号修饰" }).click();
  assert.match(await slider.getAttribute("aria-valuetext"), /\+$/);
  assert.equal(await page.locator('input[name="ratingModifier"]').inputValue(), "+");
  await page.getByRole("button", { name: "清除评分" }).click();
  await page.keyboard.press("Tab");
  await slider.focus();
  await page.screenshot({ path: join(output, "codex_rating_focus_light.png") });
  await page.evaluate(async () => (await import("/src/abu_theme.ts")).setThemeChoice("dark"));
  await page.screenshot({ path: join(output, "codex_rating_focus_dark.png") });
  report.checks.push("Keyboard focus, step keys, boundaries, accessible value and clear action work");
  await page.getByRole("checkbox", { name: /多维度评分/ }).check();
  const dimensions = ["制作", "词", "曲", "人声", "原创性", "共鸣"];
  for (const name of dimensions) await page.getByRole("slider", { name, exact: true }).press("ArrowRight");
  await page.getByRole("slider", { name: "共鸣" }).press("ArrowUp");
  await page.waitForFunction(() => document.querySelector('input[name="rating"]')?.value === "0.6");
  assert.equal(await page.getByRole("slider", { name: "综合评分" }).count(), 0, "six-dimension average cannot be overridden independently");
  assert.match(await page.locator('output[aria-label="综合评分"]').innerText(), /0\.6/);
  assert.equal(await page.locator('input[name="rating"]').inputValue(), "0.6");
  await page.getByRole("slider", { name: "制作" }).press("ArrowUp");
  await page.waitForFunction(() => document.querySelector('input[name="rating"]')?.value === "0.7");
  await page.locator('input[name="title"]').fill("T08 综合评分保存");
  await page.locator('input[name="artistName"]').fill("T08 艺人");
  await page.locator('input[name="albumName"]').fill("T08 专辑");
  await page.locator('textarea[name="content"]').fill("六项评分和综合一位小数的保存回归。");
  await page.getByRole("button", { name: "保存正式乐评" }).click();
  await page.waitForURL(/#\/entries\/[^/]+\?saved=1/);
  const savedId = page.url().match(/#\/entries\/([^?]+)/)?.[1];
  assert.ok(savedId);
  await page.reload();
  const saved = await page.evaluate(async id => (await (await import("/src/store.ts")).store.listEntries()).find(entry => entry.id === id), savedId);
  assert.deepEqual([saved.rating, saved.ratingProduction, saved.ratingLyrics, saved.ratingComposition, saved.ratingVocals, saved.ratingOriginality, saved.ratingResonance, saved.ratingSongwriting, saved.compositeRatingLocked], [0.7, 1, 0.5, 0.5, 0.5, 0.5, 1, null, false]);
  await page.goto(`${origin}/#/entries/${savedId}/edit`);
  assert.equal(await page.locator("details.writing-extras").evaluate(element => element.open), true, "编辑乐评应直接显示补充字段");
  for (const name of dimensions) await page.getByRole("slider", { name, exact: true }).press("End");
  await page.getByRole("button", { name: "保存正式乐评" }).click();
  await page.waitForURL(/\?saved=1/);
  const maximum = await page.evaluate(async id => (await (await import("/src/store.ts")).store.getEntry(id)), savedId);
  assert.deepEqual([maximum.rating, maximum.ratingModifier, maximum.compositeRatingLocked], [10, null, false]);
  report.checks.push("Six half-step dimensions compute a read-only one-decimal average and persist across save/reload");

  const legacyEntries = [false, true].map((locked, index) => ({ ...entries[index], id: `codex-legacy-score-${index}`, title: `旧评分 ${index}`,
    rating: locked ? 9.2 : 7.4, ratingModifier: locked ? "-" : "+", ratingProduction: 8, ratingSongwriting: 6,
    ratingOriginality: 9, ratingResonance: 7, compositeRatingLocked: locked }));
  for (const legacy of legacyEntries) for (const key of ["ratingLyrics", "ratingComposition", "ratingVocals"]) delete legacy[key];
  await page.evaluate(items => localStorage.setItem("music-feelings-mobile-entries", JSON.stringify(items)), legacyEntries);
  const scoreKeys = ["rating", "ratingModifier", "ratingProduction", "ratingSongwriting", "ratingOriginality", "ratingResonance", "compositeRatingLocked"];
  for (const legacy of legacyEntries) {
    await page.goto(`${origin}/#/entries/${legacy.id}/edit`);
    await page.getByRole("slider", { name: "人声", exact: true }).waitFor();
    assert.equal(await page.locator('input[name="rating"]').inputValue(), String(legacy.rating));
    assert.equal(await page.locator('input[name="ratingModifier"]').inputValue(), legacy.ratingModifier);
    for (const name of ["词", "曲", "人声"]) assert.equal(await page.getByRole("slider", { name, exact: true }).getAttribute("aria-valuetext"), "未评分");
    assert.match(await page.locator(".multi-dimension-toggle").innerText(), /旧版词曲.*6/);
    await page.locator('textarea[name="content"]').fill(`${legacy.content}\n只修改正文。`);
    await page.getByRole("button", { name: "保存正式乐评" }).click();
    await page.waitForURL(/\?saved=1/);
    const preserved = await page.evaluate(async id => (await (await import("/src/store.ts")).store.getEntry(id)), legacy.id);
    assert.deepEqual(scoreKeys.map(key => preserved[key]), scoreKeys.map(key => legacy[key]), "body-only edits preserve every legacy score and lock flag");
    assert.deepEqual([preserved.ratingLyrics, preserved.ratingComposition, preserved.ratingVocals], [null, null, null]);
  }
  const legacyId = legacyEntries[1].id;
  await page.goto(`${origin}/#/entries/${legacyId}/edit`);
  for (const name of ["词", "曲", "人声"]) await page.getByRole("slider", { name, exact: true }).press("Home");
  await page.waitForFunction(() => document.querySelector('input[name="rating"]')?.value === "4.3");
  assert.equal(await page.locator('input[name="ratingModifier"]').inputValue(), "");
  await page.getByRole("button", { name: "保存草稿" }).click();
  await page.waitForURL(/#\/drafts/);
  await page.goto(`${origin}/#/entries/${legacyId}/edit`);
  await page.reload();
  await page.getByRole("slider", { name: "人声", exact: true }).waitFor();
  await page.waitForFunction(() => document.querySelector('input[name="rating"]')?.value === "4.3");
  for (const name of ["词", "曲", "人声"]) assert.equal(await page.getByRole("slider", { name, exact: true }).getAttribute("aria-valuenow"), "0.5");
  page.once("dialog", dialog => dialog.accept());
  await page.getByRole("button", { name: "放弃草稿", exact: true }).click();
  await page.waitForFunction(() => document.querySelector('input[name="rating"]')?.value === "9.2");
  assert.equal(await page.locator('input[name="ratingModifier"]').inputValue(), "-");
  for (const name of ["词", "曲", "人声"]) assert.equal(await page.getByRole("slider", { name, exact: true }).getAttribute("aria-valuetext"), "未评分", "discarding the draft restores the saved dimensions");
  for (const name of ["词", "曲", "人声"]) await page.getByRole("slider", { name, exact: true }).press("Home");
  await page.getByRole("button", { name: "保存正式乐评" }).click();
  await page.waitForURL(/\?saved=1/);
  const converted = await page.evaluate(async id => (await (await import("/src/store.ts")).store.getEntry(id)), legacyId);
  assert.deepEqual([converted.rating, converted.ratingModifier, converted.ratingLyrics, converted.ratingComposition, converted.ratingVocals, converted.ratingSongwriting, converted.compositeRatingLocked], [4.3, null, 0.5, 0.5, 0.5, 6, false]);
  await page.goto(`${origin}/#/entries/${legacyId}/edit`);
  await page.getByRole("slider", { name: "人声", exact: true }).waitFor();
  for (const width of [320, 390]) {
    await page.setViewportSize({ width, height: 844 });
    for (const theme of ["light", "dark"]) {
      await page.evaluate(async value => (await import("/src/abu_theme.ts")).setThemeChoice(value), theme);
      assert.equal(await page.getByRole("slider").count(), 6);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true, "six sliders fit the mobile viewport");
      for (const name of dimensions) {
        const rect = await page.getByRole("slider", { name, exact: true }).boundingBox();
        assert.ok(rect && rect.width > 0 && rect.x >= 0 && rect.x + rect.width <= width + 1);
      }
      await page.locator(".multi-dimension-grid").screenshot({ path: join(output, `codex_six_rating_${theme}_${width}.png`), style: ".app-header, .bottom-nav { visibility: hidden; }" });
    }
  }
  report.checks.push("Six rating sliders fit 320/390px light/dark mobile layouts");
  await page.locator(".rating-slider-section").filter({ has: page.getByRole("slider", { name: "人声", exact: true }) }).getByRole("button", { name: "清除评分" }).click();
  assert.equal(await page.locator('input[name="rating"]').inputValue(), "4.3", "partial dimensions retain the saved score instead of treating missing values as zero");
  report.checks.push("Legacy scores and modifiers survive body edits; manual completion computes the average and survives draft restore without splitting the old joint score");
  report.checks.push("Discarding a changed scoring draft restores all saved dimensions, total and modifier");

  await page.evaluate(items => {
    localStorage.setItem("music-feelings-mobile-entries", JSON.stringify(items));
    localStorage.setItem("music-feelings-mobile-app-data", JSON.stringify({ "top-albums:2026": "{broken" }));
  }, entries);
  await page.goto(`${origin}/#/summary?year=2026`);
  await page.reload();
  await page.locator(".journal-error").filter({ hasText: "榜单展示暂不可用" }).waitFor();
  assert.equal(await page.getByRole("link", { name: "创建年度榜单" }).count(), 0, "damaged saved ranking must not look empty");
  report.checks.push("Damaged saved ranking reports an error without presenting a create action");
  assert.deepEqual(errors, []);

  touchContext = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const touchPage = await touchContext.newPage();
  await touchPage.goto(`${origin}/#/new`);
  assert.equal(await touchPage.locator("details.writing-extras").evaluate(element => element.open), true, "触屏完整乐评应直接显示补充字段");
  const touchSlider = touchPage.getByRole("slider", { name: "评分" });
  const touchBounds = await touchSlider.boundingBox();
  assert.ok(touchBounds);
  await touchSlider.tap({ position: { x: touchBounds.width * 0.75, y: touchBounds.height / 2 } });
  await touchPage.waitForFunction(() => Number(document.querySelector('input[name="rating"]')?.value) > 0);
  report.checks.push("Touch tap commits a rating through the existing gesture path");
  report.passed = true;
} catch (error) {
  report.error = error instanceof Error ? error.stack : String(error);
  report.page = page ? { url: page.url(), body: (await page.locator("body").innerText().catch(() => "")).slice(0, 900) } : null;
  process.exitCode = 1;
} finally {
  await mkdir(output, { recursive: true });
  await writeFile(join(output, "codex_interaction_accessibility_results.json"), JSON.stringify(report, null, 2));
  await touchContext?.close();
  await browser?.close();
  await server?.close();
}
console.log(JSON.stringify(report));
