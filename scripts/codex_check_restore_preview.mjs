import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { chromium } from "playwright";
import { createServer } from "vite";
import { makeJournalFixtures } from "../mobile/codex_journal_fixtures.mjs";
import { freeLoopbackPort, qaOptions } from "./codex_qa_options.mjs";

const options = qaOptions({ output: "release/codex_restore_preview_qa" });
const output = resolve(options.output);
await mkdir(output, { recursive: true });
let origin = options.origin;
let server;
if (!process.argv.includes("--origin")) {
  server = await createServer({ configFile: resolve("mobile/vite.config.ts"), cacheDir: join(output, "vite-cache"),
    server: { host: "127.0.0.1", port: await freeLoopbackPort(), strictPort: true, forwardConsole: false } });
  await server.listen();
  origin = `http://127.0.0.1:${server.httpServer.address().port}`;
}

const [first, second, third] = makeJournalFixtures("6");
const report = { passed: false, checks: [] };
let browser;
try {
  browser = await chromium.launch({ channel: "chrome", headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  page.setDefaultTimeout(15000);
  await page.route("**/*", route => {
    try { if (new URL(route.request().url()).origin === origin) return route.continue(); } catch {}
    return route.abort();
  });
  await page.goto(`${origin}/#/privacy`);
  await page.evaluate(entries => {
    localStorage.clear();
    localStorage.setItem("music-feelings-mobile-entries", JSON.stringify(entries));
  }, [first, second]);
  await page.reload();
  const result = await page.evaluate(async ({ first, third }) => {
    const { store } = await import("/src/store.ts");
    const { buildMonthlyListeningSnapshot } = await import("/src/listeningYearbook.ts");
    const now = "2026-09-24T04:00:00.000Z";
    localStorage.setItem("music-feelings-mobile-summaries", JSON.stringify([{ id: "year-summary", year: 2026,
      title: "旧年记", content: "原文", analysisJson: null, analysisVersion: null, sourceFingerprint: null,
      sourceEntryCount: 2, generatedAt: now, createdAt: now, updatedAt: now }]));
    const monthly = buildMonthlyListeningSnapshot(2026, 5, [first]);
    localStorage.setItem("music-feelings-mobile-monthly-summaries", JSON.stringify([{ id: "month-summary", year: 2026, month: 5,
      title: "旧月报", content: "原文", themeId: monthly.theme.id, analysisJson: JSON.stringify(monthly), analysisVersion: 1,
      sourceFingerprint: null, sourceEntryCount: monthly.analysis.sourceEntryCount, generatedAt: now, createdAt: now, updatedAt: now }]));
    await store.setCover("album", { albumName: first.albumName, artistName: first.artistName }, "data:image/png;base64,YQ==");
    await store.createListeningMoment(first.id, { listenedAt: now, rating: null, ratingModifier: null, moods: [], content: "合成重听" });
    await store.setStoredAppData("listening-quote:codex-t14", JSON.stringify({ entryId: first.id, sentence: "合成原句" }));
    const draftKey = "music-feelings-entry-draft:v1:new:t14-draft";
    const draft = { version: 2, mode: "create", captureMode: "full", entryId: null, draftId: "t14-draft", baseUpdatedAt: null, savedAt: now,
      fields: { type: "album", title: "合成草稿", year: "2026", month: "9", albumName: "合成专辑", songName: "",
        artistName: "合成艺人", listenedAt: "2026-09-24", tags: "", rating: "8", ratingModifier: "+",
        ratingProduction: "", ratingSongwriting: "", ratingOriginality: "", ratingResonance: "", content: "合成正文" },
      genreSelection: { level1: "", level2: "", level3: "" }, selectedGenreTags: [], selectedMoodGroupId: "", selectedMoods: [],
      coverDataUrl: null, coverChanged: false, ocrText: "", recognizedFields: null, musicMetadata: null,
      compositeRatingLocked: false, inspiration: false };
    localStorage.setItem(draftKey, JSON.stringify(draft));
    const before = await store.exportBackup();
    const parsed = JSON.parse(before);
    const target = JSON.stringify({ ...parsed, entries: [{ ...first, content: "更新后的正文" }, { ...third, id: "codex-new" }],
      summaries: [{ ...parsed.summaries[0], content: "更新后的年记" }], monthlySummaries: [], listeningMoments: [],
      covers: [], appData: {}, drafts: [] });
    const originalKeys = Object.fromEntries(Object.keys(localStorage).sort().map(key => [key, localStorage.getItem(key)]));
    const preflight = await store.rehearseRestore(target);
    const skipCovers = await store.rehearseRestore(target, { includeCovers: false });
    const legacy = { ...JSON.parse(target), version: 5 }; delete legacy.drafts;
    const oldDrafts = await store.rehearseRestore(JSON.stringify(legacy));
    const legacyHealth = await store.rehearseRestore(JSON.stringify({ ...legacy, appData: { "backup-health:v1": "legacy-device-only" } }));
    const afterKeys = Object.fromEntries(Object.keys(localStorage).sort().map(key => [key, localStorage.getItem(key)]));
    let staleError = "";
    localStorage.setItem("music-feelings-mobile-entries", JSON.stringify([{ ...first, content: "另一窗口改动" }]));
    const beforeStale = localStorage.getItem("music-feelings-mobile-entries");
    try { await store.importBackup(target, {}, preflight.localSha256); } catch (error) { staleError = String(error); }
    const stalePreserved = localStorage.getItem("music-feelings-mobile-entries") === beforeStale;
    const invalid = {};
    for (const [label, changes] of [
      ["duplicate", { entries: [first, first] }],
      ["brokenReference", { listeningMoments: [{ id: "moment", entryId: "missing", listenedAt: first.listenedAt,
        rating: null, ratingModifier: null, moods: [], content: "a", createdAt: first.createdAt, updatedAt: first.updatedAt }] }],
      ["badCover", { covers: [{ coverKey: "wrong", kind: "album", albumName: "专辑", songName: null,
        artistName: "艺人", dataUrl: "data:image/png;base64,YQ==", updatedAt: first.updatedAt }] }],
    ]) {
      try { await store.rehearseRestore(JSON.stringify({ ...parsed, ...changes })); invalid[label] = "accepted"; }
      catch (error) { invalid[label] = String(error); }
    }
    const nativeSet = Map.prototype.set;
    let quotaError = "";
    try {
      Map.prototype.set = function(key, value) {
        if (key === "music-feelings-mobile-covers") throw new DOMException("Quota exceeded", "QuotaExceededError");
        return nativeSet.call(this, key, value);
      };
      await store.rehearseRestore(target);
    } catch (error) { quotaError = String(error); }
    finally { Map.prototype.set = nativeSet; }
    return { preflight, skipCovers, oldDrafts, legacyHealth, unchanged: JSON.stringify(originalKeys) === JSON.stringify(afterKeys),
      staleError, stalePreserved, invalid, quotaError, target };
  }, { first, third });
  assert.equal(result.preflight.target, "web-isolated-storage");
  assert.equal(result.preflight.verified, true);
  assert.deepEqual(result.preflight.groups.entries, { added: 1, changed: 1, unchanged: 0, removed: 1 });
  assert.deepEqual(result.preflight.groups.summaries, { added: 0, changed: 1, unchanged: 0, removed: 0 });
  for (const key of ["monthlySummaries", "listeningMoments", "covers", "appData", "drafts"]) {
    assert.deepEqual(result.preflight.groups[key], { added: 0, changed: 0, unchanged: 0, removed: 1 }, key);
  }
  assert.deepEqual(result.skipCovers.groups.covers, { added: 0, changed: 0, unchanged: 1, removed: 0 });
  assert.deepEqual(result.oldDrafts.groups.drafts, { added: 0, changed: 0, unchanged: 1, removed: 0 });
  assert.deepEqual(result.legacyHealth.groups.appData, result.oldDrafts.groups.appData, "旧设备健康字段不属于将导入的 AppData");
  for (const group of Object.values(result.preflight.groups)) assert.ok(Object.values(group).every(Number.isInteger));
  assert.equal(result.unchanged, true);
  assert.match(result.staleError, /预演后已变化/);
  assert.equal(result.stalePreserved, true);
  assert.match(result.invalid.duplicate, /重复/);
  assert.match(result.invalid.brokenReference, /不存在/);
  assert.match(result.invalid.badCover, /不匹配/);
  assert.match(result.quotaError, /QuotaExceededError/);
  report.checks.push("isolated Web write/readback, seven collection diffs, skipped covers, legacy draft preservation, production zero-write, stale guard, malformed input and quota failure");

  await page.evaluate(entries => localStorage.setItem("music-feelings-mobile-entries", JSON.stringify(entries)), [first, second]);
  await page.goto(`${origin}/#/backup`);
  await page.getByLabel("粘贴备份 JSON").fill(result.target);
  await page.getByRole("button", { name: "预演恢复并查看差异" }).click();
  await page.getByLabel("恢复差异报告").waitFor();
  assert.match(await page.getByLabel("恢复差异报告").innerText(), /正式记录：新增 1 · 更新 1 · 相同 0 · 本机将移除 1/);
  assert.equal(await page.getByRole("button", { name: "导入并覆盖当前数据" }).isEnabled(), true);
  await page.getByLabel("粘贴备份 JSON").fill(result.target + " ");
  assert.equal(await page.getByLabel("恢复差异报告").count(), 0);
  assert.equal(await page.getByRole("button", { name: "导入并覆盖当前数据" }).isEnabled(), false);
  report.checks.push("backup page shows bound diff and invalidates it when input changes");
  report.passed = true;
} catch (error) {
  report.error = error instanceof Error ? error.stack : String(error);
  process.exitCode = 1;
} finally {
  await browser?.close();
  await server?.close();
  await writeFile(join(output, "codex_results.json"), JSON.stringify(report, null, 2));
}
console.log(JSON.stringify({ passed: report.passed, checks: report.checks, error: report.error }));
