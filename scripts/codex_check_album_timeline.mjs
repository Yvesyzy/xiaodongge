import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { chromium } from "playwright";
import { createServer } from "vite";
import { makeJournalFixtures } from "../mobile/codex_journal_fixtures.mjs";
import { freeLoopbackPort, qaOptions } from "./codex_qa_options.mjs";

const options = qaOptions({ output: "release/codex_album_timeline_qa" });
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
const record = (id, type, albumName, artistName, songName, rating) => ({ ...template, id, type,
  albumName, artistName, songName, title: songName ?? albumName, rating, content: `当前乐评 ${id}` });
const album = record("t15-album", "album", "同名专辑", "艺人甲", null, 8.5);
const otherArtist = record("t15-other", "album", "同名专辑", "艺人乙", null, 9);
const song = record("t15-song", "song", "同名专辑", "艺人甲", "专辑内歌曲", 7);
const rank = (albumName, artistName, note = "") => ({ albumName, artistName, note });
const saved = {
  "top-albums:2023": JSON.stringify({ albums: [rank("别的专辑", "艺人丙"), rank("同名专辑", "艺人甲", "2023 的榜单理由")] }),
  "top-albums:2024": JSON.stringify({ albums: [rank("同名专辑", "艺人乙")] }),
  "top-albums:2025": JSON.stringify({ albums: [rank("同名专辑", "艺人甲"), rank("别的专辑", "艺人丙"), rank("仅榜单", "已删除艺人")] }),
};
const report = { passed: false, checks: [] };
let browser;
try {
  browser = await chromium.launch({ channel: "chrome", headless: true });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  page.setDefaultTimeout(15000);
  await page.route("**/*", route => {
    try { if (new URL(route.request().url()).origin === origin) return route.continue(); } catch {}
    return route.abort();
  });
  await page.goto(`${origin}/#/privacy`);
  await page.evaluate(({ entries, saved }) => {
    localStorage.clear();
    localStorage.setItem("music-feelings-mobile-entries", JSON.stringify(entries));
    localStorage.setItem("music-feelings-mobile-app-data", JSON.stringify(saved));
  }, { entries: [album, otherArtist, song], saved });
  await page.reload();
  const model = await page.evaluate(async ({ album, song }) => {
    const { store } = await import("/src/store.ts");
    const { buildAlbumTimelines } = await import("/src/codex_AlbumTimeline.tsx");
    const first = await store.createListeningMoment(album.id, { listenedAt: "2026-07-01T04:00:00.000Z",
      rating: 8, ratingModifier: null, moods: [], content: "第一次重听" });
    const second = await store.createListeningMoment(album.id, { listenedAt: "2026-09-01T04:00:00.000Z",
      rating: 9, ratingModifier: null, moods: [], content: "第二次重听" });
    const archives = await store.listSavedTopAlbums();
    const built = buildAlbumTimelines(archives, await store.listEntries(), await store.listListeningMoments());
    const target = built.find(item => item.albumName === album.albumName && item.artistName === album.artistName);
    const other = built.find(item => item.albumName === album.albumName && item.artistName !== album.artistName);
    const orphan = built.find(item => item.albumName === "仅榜单");
    return { archives: archives.map(item => item.year), target: { ranks: target.ranks,
      entryIds: target.entries.map(item => item.id), momentIds: target.moments.map(item => item.id) },
      other: { ranks: other.ranks, entryIds: other.entries.map(item => item.id) },
      orphan: { ranks: orphan.ranks, entryIds: orphan.entries.map(item => item.id) }, firstId: first.id, secondId: second.id };
  }, { album, song });
  assert.deepEqual(model.archives, [2023, 2024, 2025]);
  assert.deepEqual(model.target.ranks.map(item => [item.startYear, item.rank]), [[2023, 2], [2024, null], [2025, 1]]);
  assert.deepEqual(new Set(model.target.entryIds), new Set([album.id, song.id]));
  assert.deepEqual(new Set(model.target.momentIds), new Set([model.firstId, model.secondId]));
  assert.deepEqual(model.other.entryIds, [otherArtist.id]);
  assert.deepEqual(model.orphan.entryIds, []);
  assert.deepEqual(model.orphan.ranks.map(item => item.rank), [3]);
  report.checks.push("saved-year array positions determine ranks; distinct artists, missing 2024, multiple relistens and rank-only deleted source remain separate");

  await page.goto(`${origin}/#/albums/timeline`);
  await page.getByRole("heading", { name: "跨年专辑轨迹" }).waitFor();
  await page.getByRole("link", { name: /同名专辑.*艺人甲/ }).click();
  const ranks = page.locator(".album-timeline-ranks");
  assert.match(await ranks.innerText(), /2023 · 第 2 名/);
  assert.match(await ranks.innerText(), /2024 · 未记录/);
  assert.match(await ranks.innerText(), /2025 · 第 1 名/);
  assert.ok(!(await ranks.innerText()).includes("8.5"), "Current score must not be shown as historical rank score");
  assert.ok((await page.getByRole("link", { name: /2023 · 第 2 名/ }).getAttribute("href")).includes("year=2023&view=rank"));
  assert.ok((await page.getByRole("link", { name: /专辑乐评/ }).getAttribute("href")).includes(album.id));
  assert.ok((await page.getByRole("link", { name: /查看这次重听及来源/ }).first().getAttribute("href")).includes("moment="));
  await page.getByText("当前乐评 t15-album").waitFor();
  await page.getByText("第一次重听").waitFor();
  await page.getByText("第二次重听").waitFor();
  report.checks.push("timeline UI labels current values, preserves missing year and links each available rank, entry and moment to its source");

  const roundtrip = await page.evaluate(async () => {
    const { store } = await import("/src/store.ts");
    const raw = await store.exportBackup();
    const payload = JSON.parse(raw);
    await store.importBackup(JSON.stringify({ ...payload, appData: {} }));
    const removed = (await store.listSavedTopAlbums()).length;
    await store.restoreImportUndo();
    const restored = (await store.listSavedTopAlbums()).length;
    const current = await store.listEntries();
    const edited = current.map(entry => entry.id === "t15-album" ? { ...entry, rating: 6.5, content: "编辑后的当前正文" } : entry);
    localStorage.setItem("music-feelings-mobile-entries", JSON.stringify(edited));
    return { removed, restored, momentIds: (await store.listListeningMoments()).map(item => item.id).sort() };
  });
  assert.deepEqual(roundtrip, { removed: 0, restored: 3, momentIds: [model.firstId, model.secondId].sort() });
  await page.goto(`${origin}/#/albums/timeline?albumName=${encodeURIComponent(album.albumName)}&artistName=${encodeURIComponent(album.artistName)}`);
  await page.reload();
  await page.getByText(/当前评分：6\.5/).waitFor();
  await page.getByText("编辑后的当前正文").waitFor();
  assert.match(await page.locator(".album-timeline-ranks").innerText(), /2023 · 第 2 名/);
  report.checks.push("backup import/undo restores saved ranks and edited source displays its current score without rewriting historical rank");
  await page.evaluate(() => {
    const key = "music-feelings-mobile-entries";
    const entries = JSON.parse(localStorage.getItem(key));
    const original = entries.find(entry => entry.id === "t15-album");
    original.musicMetadata = { catalogAlbumId: "catalog-first" };
    entries.push({ ...original, id: "t15-same-text-other-id", musicMetadata: { catalogAlbumId: "catalog-second" }, content: "另一张同名专辑的当前正文" });
    localStorage.setItem(key, JSON.stringify(entries));
  });
  await page.reload();
  await page.getByText(/同名同艺人有 2 组不同作品来源/).waitFor();
  await page.getByText("另一张同名专辑的当前正文").waitFor();
  report.checks.push("same name and artist with distinct catalog album IDs keeps source groups separate and leaves historical rank attribution explicit");
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
