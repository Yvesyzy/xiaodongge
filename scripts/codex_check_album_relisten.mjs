import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { chromium } from "playwright";
import { createServer } from "vite";
import { makeJournalFixtures } from "../mobile/codex_journal_fixtures.mjs";
import { freeLoopbackPort, qaOptions } from "./codex_qa_options.mjs";

const options = qaOptions({ output: "release/codex_album_relisten_qa" });
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

const template = makeJournalFixtures("6")[0];
const record = (id, type, albumName, songName, artistName, listenedAt, rating, content) => ({
  ...template, id, type, title: songName ?? albumName, albumName, songName, artistName,
  listenedAt, firstListenedAt: listenedAt, rating, content,
  createdAt: "2026-09-01T04:00:00.000Z", updatedAt: "2026-09-01T04:00:00.000Z",
});
const albumA = { ...record("codex-album-a", "album", "同名专辑", null, "艺人甲", "2025-09-22T04:00:00.000Z", 8, "旧正文私密标记"), title: "不同于专辑名的乐评标题" };
const albumB = record("codex-album-b", "album", "同名专辑", null, "艺人乙", "2025-09-01T04:00:00.000Z", 9, "另一张专辑的旧感受");
const song = record("codex-song", "song", "歌曲专辑", "测试歌曲", "艺人丙", "2025-08-01T04:00:00.000Z", 7, "歌曲旧感受");
const entries = [albumA, albumB, song];
const report = { passed: false, origin, checks: [] };
let browser;
try {
  browser = await chromium.launch({ channel: "chrome", headless: true });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, timezoneId: "Asia/Shanghai" });
  page.setDefaultTimeout(15000);
  await page.route("**/*", route => {
    try { if (new URL(route.request().url()).origin === origin) return route.continue(); } catch {}
    return route.abort();
  });
  await page.goto(`${origin}/#/privacy`);
  await page.evaluate(data => {
    localStorage.clear();
    localStorage.setItem("music-feelings-mobile-entries", JSON.stringify(data));
  }, entries);
  await page.reload();
  const selection = await page.evaluate(async ({ albumA, albumB, song }) => {
    const { selectDailyResurfacing, resolveDailyResurfacing, daysBetween } = await import("/src/resurfacing.ts");
    const { sameAlbumIdentity } = await import("/src/musicIdentity.ts");
    const { compareRelisten } = await import("/src/relistenComparison.ts");
    const today = "2026-09-24";
    const recentMoment = { id: "recent", entryId: albumA.id, listenedAt: "2026-09-10T04:00:00.000Z", rating: null,
      ratingModifier: null, moods: [], content: "最近听过", createdAt: today, updatedAt: today };
    const leap = { ...albumA, id: "leap", listenedAt: "2024-02-29T04:00:00.000Z" };
    const crossYear = { ...albumA, id: "cross-year", listenedAt: "2024-12-29T04:00:00.000Z" };
    return {
      selected: selectDailyResurfacing([song, albumB, albumA], [], today)?.id,
      afterRecent: selectDailyResurfacing([song, albumB, albumA], [recentMoment], today)?.id,
      savedAlbum: resolveDailyResurfacing([song, albumB, albumA], [], today,
        { date: today, entryId: albumA.id, dismissed: false }).entry?.id,
      savedAfterTodayMoment: resolveDailyResurfacing([song, albumB, albumA], [{ ...recentMoment, listenedAt: "2026-09-24T04:00:00.000Z" }], today,
        { date: today, entryId: albumA.id, dismissed: false }).entry?.id,
      afterDelete: resolveDailyResurfacing([song, albumB], [], today,
        { date: today, entryId: albumA.id, dismissed: false }).entry?.id,
      differentArtists: sameAlbumIdentity(albumA, albumB),
      leapSelected: selectDailyResurfacing([leap], [], "2025-02-28")?.id,
      crossYearSelected: selectDailyResurfacing([crossYear], [], "2026-01-02")?.id,
      leapGap: daysBetween("2024-02-29", "2025-02-28"),
      crossYearGap: compareRelisten(crossYear, { ...recentMoment, entryId: crossYear.id, listenedAt: "2026-01-02T04:00:00.000Z" }).dayGap,
      unratedComparison: compareRelisten({ ...albumA, rating: null }, { ...recentMoment, rating: 8 }).rating,
    };
  }, { albumA, albumB, song });
  assert.deepEqual(selection, { selected: albumA.id, afterRecent: albumB.id, savedAlbum: albumA.id,
    savedAfterTodayMoment: albumB.id, afterDelete: albumB.id, differentArtists: false,
    leapSelected: "leap", crossYearSelected: "cross-year", leapGap: 365, crossYearGap: 369,
    unratedComparison: { first: null, latest: 8, difference: null, direction: "unavailable" } });
  report.checks.push("album and song daily selection, persisted choice, recent moment, deleted source, distinct artists, leap day, cross-year gap and missing old rating");

  await page.goto(`${origin}/#/entries/${albumA.id}`);
  assert.ok((await page.getByRole("link", { name: "再次听见", exact: true }).getAttribute("href")).includes(albumA.id));
  await page.goto(`${origin}/#/albums`);
  await page.locator(".cover-row").filter({ hasText: "艺人甲" }).click();
  assert.ok((await page.getByRole("link", { name: "再次听见这张专辑" }).getAttribute("href")).includes(albumA.id));
  report.checks.push("album record and aggregate both open the album's own blind relisten flow");

  await page.goto(`${origin}/#/`);
  const homeCard = page.locator(".daily-resurfacing-card");
  await homeCard.waitFor();
  assert.equal(await homeCard.getByRole("heading", { name: "同名专辑" }).count(), 1);
  assert.ok(!(await homeCard.innerText()).includes(albumA.title), "每日重逢应展示专辑名而不是乐评标题");
  assert.ok(!(await homeCard.innerText()).includes(albumA.content), "Home blind card must not reveal old content");
  await homeCard.getByRole("link", { name: "先听，再揭晓" }).click();
  await page.locator(".relisten-form").waitFor();
  const before = await page.locator(".relisten-page").ariaSnapshot();
  assert.ok(!before.includes(albumA.content) && !before.includes("8/10"), "Blind form accessibility tree must hide history");
  await page.getByLabel("一句话感受").fill("未保存的新感受");
  await page.getByRole("link", { name: /小懂哥 v/ }).click();
  await page.getByRole("alertdialog", { name: "离开未保存的重听记录" }).waitFor();
  await page.getByRole("button", { name: "放弃并离开" }).click();
  await page.locator(".home-page").waitFor();
  assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem("music-feelings-mobile-listening-moments") ?? "[]").length), 0);
  report.checks.push("home card and blind accessibility tree hide old rating/content; cancel leaves no moment");

  await page.goto(`${origin}/#/relisten/${albumA.id}`);
  await page.locator(".relisten-form").waitFor();
  await page.getByLabel("一句话感受").fill("新的专辑听感");
  await page.locator(".relisten-form button.primary-button.full").evaluate(button => { button.click(); button.click(); });
  await page.locator(".relisten-reveal").waitFor();
  assert.ok((await page.locator(".relisten-reveal").innerText()).includes(albumA.content));
  assert.ok((await page.locator(".relisten-reveal").innerText()).includes("新的专辑听感"));
  const roundtrip = await page.evaluate(async id => {
    const { store } = await import("/src/store.ts");
    const before = await store.getMomentsByEntryId(id);
    const backup = await store.exportBackup();
    const payload = JSON.parse(backup);
    await store.importBackup(JSON.stringify({ ...payload, listeningMoments: [] }));
    const afterImport = await store.getMomentsByEntryId(id);
    await store.restoreImportUndo();
    const afterUndo = await store.getMomentsByEntryId(id);
    await store.deleteEntry(id);
    const afterDelete = await store.getMomentsByEntryId(id);
    return { before: before.length, backupCount: payload.listeningMoments.length,
      afterImport: afterImport.length, afterUndo: afterUndo.length, afterDelete: afterDelete.length,
      savedEntryId: before[0]?.entryId };
  }, albumA.id);
  assert.deepEqual(roundtrip, { before: 1, backupCount: 1, afterImport: 0, afterUndo: 1, afterDelete: 0, savedEntryId: albumA.id });
  report.checks.push("double submit creates one album moment; revealed comparison, backup/import/undo and source deletion preserve associations");

  await page.goto(`${origin}/#/relisten/${song.id}`);
  await page.locator(".relisten-form").waitFor();
  assert.ok(!(await page.locator(".relisten-page").ariaSnapshot()).includes(song.content));
  report.checks.push("song blind relisten remains available");
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
