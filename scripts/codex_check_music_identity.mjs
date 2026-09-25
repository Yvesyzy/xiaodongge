import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve, join } from "node:path";
import { chromium } from "playwright";
import { createServer } from "vite";
import { makeJournalFixtures } from "../mobile/codex_journal_fixtures.mjs";
import { freeLoopbackPort, qaOptions } from "./codex_qa_options.mjs";

let { origin, output: outputOption } = qaOptions({ output: `release/codex_t07_identity_${Date.now()}` });
const output = resolve(outputOption);
let server;
if (!process.argv.includes("--origin")) {
  server = await createServer({ configFile: resolve("mobile/vite.config.ts"), cacheDir: join(output, "vite-cache"),
    server: { host: "127.0.0.1", port: await freeLoopbackPort(), strictPort: true, forwardConsole: false } });
  await server.listen();
  origin = `http://127.0.0.1:${server.httpServer.address().port}`;
}

const template = makeJournalFixtures("6")[0];
const entries = [];
function add(id, type, albumName, songName, artistName, rating = null, musicMetadata = null) {
  const createdAt = new Date(Date.UTC(2026, 4, entries.length + 1, 4)).toISOString();
  entries.push({ ...template, id: `t07-${id}`, type, title: `身份测试 ${id}`, albumName, songName, artistName,
    rating, musicMetadata, createdAt, updatedAt: createdAt });
}
add(1, "album", " Echo ", null, "Alice", 8);
add(2, "album", "ｅＣＨＯ", null, " ALICE ", 6);
add(3, "album", "Echo", null, "Bob", 9);
add(4, "song", "First", "Same Song", "Alice", 7);
add(5, "song", " first ", " same  song ", " ALICE ");
add(6, "song", "Second", "Same Song", "Alice", 10);
add(7, "song", null, "Same Song", "Alice");
add(8, "album", "ID Album", null, null, 5, { catalogAlbumId: "ALB1" });
add(9, "album", "Renamed", null, null, null, { catalogAlbumId: "ALB1" });
add(10, "album", "ID Album", null, null, null, { catalogAlbumId: "ALB2" });
add(11, "album", "Echo", null, null);
add(12, "album", "Echo", null, null);
add(13, "song", null, "ID Song", null, null, { catalogTrackId: "TRACK1" });
add(14, "song", null, "Retitled", null, null, { catalogTrackId: "TRACK1" });
add(15, "song", null, "ID Song", null, null, { catalogTrackId: "TRACK2" });
add(16, "song", "First", "Same Song", "Bob");
add(17, "year", "Not a music work", null, null, 2);
add(18, "album", "Bridge", null, "Alpha");
add(19, "album", "Bridge", null, "Alpha", null, { catalogAlbumId: "BRIDGE-ALBUM-1" });
add(20, "album", "Bridge", null, "Alpha", null, { catalogAlbumId: "BRIDGE-ALBUM-2" });
add(21, "song", "Bridge Album", "Bridge Song", "Alpha");
add(22, "song", "Bridge Album", "Bridge Song", "Alpha", null, { catalogTrackId: "BRIDGE-TRACK-1" });
add(23, "song", "Bridge Album", "Bridge Song", "Alpha", null, { catalogTrackId: "BRIDGE-TRACK-2" });

const report = { origin, passed: false, checks: [] };
let browser;
try {
  browser = await chromium.launch({ headless: true, channel: "chrome" });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, timezoneId: "Asia/Shanghai" });
  await page.route("**/*", route => {
    try { if (new URL(route.request().url()).origin === origin) return route.continue(); } catch {}
    return route.abort();
  });
  await page.goto(`${origin}/#/privacy`);
  await page.evaluate(items => localStorage.setItem("music-feelings-mobile-entries", JSON.stringify(items)), entries);
  await page.reload();
  await page.locator(".app-header").waitFor();
  const actual = await page.evaluate(async items => {
    const { groupMusicEntries } = await import("/src/musicIdentity.ts");
    const { store } = await import("/src/store.ts");
    const memberships = (values, kind) => groupMusicEntries(values, kind).map(group => group.map(entry => entry.id).sort().join(",")).sort();
    return {
      stats: await store.getYearStats(2026),
      albums: await store.albumAggregates(), songs: await store.songAggregates(),
      albumMemberships: memberships(items, "album"), albumMembershipsReversed: memberships([...items].reverse(), "album"),
      songMemberships: memberships(items, "song"), songMembershipsReversed: memberships([...items].reverse(), "song"),
    };
  }, entries);
  assert.equal(actual.stats.totalEntries, 23);
  assert.equal(actual.stats.createdThisYear, 23);
  assert.equal(actual.stats.albumCount, 12);
  assert.equal(actual.stats.songCount, 7);
  assert.equal(actual.stats.averageRating, 7.5, "average uses rated music records, not unique works or rated reflections");
  assert.equal(actual.albums.length, 12);
  assert.equal(actual.songs.length, 7);
  assert.deepEqual(actual.albumMemberships, actual.albumMembershipsReversed, "album grouping ignores storage order");
  assert.deepEqual(actual.songMemberships, actual.songMembershipsReversed, "song grouping ignores storage order");
  assert.equal(actual.albums.find(row => row.representativeEntryId === "t07-2")?.recordCount, 2, "normalized names and artist merge");
  assert.equal(actual.albums.find(row => row.representativeEntryId === "t07-9")?.recordCount, 2, "shared catalog album ID merges aliases without artist");
  assert.equal(actual.albums.filter(row => row.albumName === "Echo" && row.artistName === null).length, 2, "missing artist without ID stays unmerged");
  assert.equal(actual.songs.find(row => row.representativeEntryId === "t07-7")?.recordCount, 3, "missing song album joins one known identity");
  assert.equal(actual.songs.find(row => row.representativeEntryId === "t07-14")?.recordCount, 2, "shared catalog track ID merges aliases");
  assert.ok(actual.albumMemberships.includes("t07-18,t07-19"), "ID-less album joins one matching catalog identity");
  assert.ok(actual.albumMemberships.includes("t07-20"), "conflicting catalog album IDs remain separate");
  assert.ok(actual.songMemberships.includes("t07-21,t07-22"), "ID-less song joins one matching catalog identity");
  assert.ok(actual.songMemberships.includes("t07-23"), "conflicting catalog track IDs remain separate");
  report.checks.push("Store stats, normalized identities, distinct artists, missing artist, catalog IDs, order independence and per-record rating");

  const coverDataUrl = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScL/nwAAAABJRU5ErkJggg==";
  const retainedCovers = await page.evaluate(async dataUrl => {
    const { store } = await import("/src/store.ts");
    await store.setCover("album", { albumName: " Echo ", artistName: "Alice" }, dataUrl);
    await store.setCover("song", { songName: "Same Song", albumName: "First", artistName: "Alice" }, dataUrl);
    return {
      album: (await store.albumAggregates()).find(row => row.representativeEntryId === "t07-2")?.coverDataUrl,
      song: (await store.songAggregates()).find(row => row.representativeEntryId === "t07-7")?.coverDataUrl,
    };
  }, coverDataUrl);
  assert.deepEqual(retainedCovers, { album: coverDataUrl, song: coverDataUrl }, "merged card keeps a cover attached to an older spelling");
  report.checks.push("Merged aggregate cards retain covers on non-representative spellings");

  await page.goto(`${origin}/#/`);
  await page.waitForFunction(() => document.querySelector(".home-stats")?.textContent?.includes("12 张"));
  assert.match(await page.locator(".home-stats").innerText(), /今年专辑\s*12 张/);
  assert.match(await page.locator(".home-stats").innerText(), /今年歌曲\s*7 首/);
  assert.match(await page.locator(".home-stats").innerText(), /今年记录\s*23 条/);
  report.checks.push("Home shows work counts and separate record count");

  await page.goto(`${origin}/#/summary?year=2026&view=overview`);
  await page.locator(".journal-facts").waitFor();
  const facts = await page.locator(".journal-facts").innerText();
  assert.match(facts, /12\s*张不同专辑/);
  assert.match(facts, /7\s*首不同歌曲/);
  assert.match(facts, /7\.5\s*平均评分 · 6 篇已评分/);
  report.checks.push("Yearbook agrees with Home while keeping average and rated-record count distinct");

  await page.goto(`${origin}/#/albums`);
  await page.waitForFunction(() => document.querySelectorAll("a.cover-row").length === 12);
  await page.locator('a.cover-row[href*="entryId=t07-2&"]').click();
  await page.waitForFunction(() => document.querySelectorAll(".card-list .codex-entry-list-item").length === 2);
  assert.equal(await page.locator(".card-list .codex-entry-list-item").count(), 2);
  assert.equal(await page.locator(".cover-editor img.cover-art").getAttribute("src"), coverDataUrl, "album detail retains group cover");
  await page.goto(`${origin}/#/songs`);
  await page.waitForFunction(() => document.querySelectorAll("a.cover-row").length === 7);
  await page.locator('a.cover-row[href*="entryId=t07-7&"]').click();
  await page.waitForFunction(() => document.querySelectorAll(".card-list .codex-entry-list-item").length === 3);
  assert.equal(await page.locator(".card-list .codex-entry-list-item").count(), 3);
  assert.equal(await page.locator(".cover-editor img.cover-art").getAttribute("src"), coverDataUrl, "song detail retains group cover");
  await page.goto(`${origin}/#/albums/detail?albumName=echo&artistName=alice`);
  await page.waitForFunction(() => document.querySelectorAll(".card-list .codex-entry-list-item").length === 2);
  assert.equal(await page.locator(".cover-editor img.cover-art").getAttribute("src"), coverDataUrl, "legacy album link resolves normalized group cover");
  await page.goto(`${origin}/#/songs/detail?songName=SAME+SONG&artistName=alice&albumName=first`);
  await page.waitForFunction(() => document.querySelectorAll(".card-list .codex-entry-list-item").length === 3);
  assert.equal(await page.locator(".cover-editor img.cover-art").getAttribute("src"), coverDataUrl, "legacy song link resolves normalized group cover");
  await page.goto(`${origin}/#/albums/detail?albumName=Echo`);
  await page.waitForFunction(() => document.querySelectorAll(".card-list .codex-entry-list-item").length === 1);
  await page.goto(`${origin}/#/songs/detail?songName=ID+Song`);
  await page.waitForFunction(() => document.querySelectorAll(".card-list .codex-entry-list-item").length === 2);
  report.checks.push("Aggregate list counts and detail records use the same identity groups");

  await page.goto(`${origin}/#/albums`);
  await page.waitForFunction(() => document.querySelectorAll("a.cover-row").length === 12);
  const staleTextLink = await page.locator('a.cover-row[href*="entryId=t07-2&"]').getAttribute("href");
  const staleAlbumIdLink = await page.locator('a.cover-row[href*="entryId=t07-9&"]').getAttribute("href");
  await page.goto(`${origin}/#/songs`);
  await page.waitForFunction(() => document.querySelectorAll("a.cover-row").length === 7);
  const staleTrackIdLink = await page.locator('a.cover-row[href*="entryId=t07-14&"]').getAttribute("href");
  assert.ok(staleTextLink && staleAlbumIdLink && staleTrackIdLink);
  await page.evaluate(async () => {
    const { store } = await import("/src/store.ts");
    for (const id of ["t07-2", "t07-9", "t07-14"]) await store.deleteEntry(id);
  });
  for (const [href, survivingTitle] of [[staleTextLink, "身份测试 1"], [staleAlbumIdLink, "身份测试 8"], [staleTrackIdLink, "身份测试 13"]]) {
    await page.goto(`${origin}/${href}`);
    await page.waitForFunction(title => document.querySelector(".card-list .entry-card h2")?.textContent?.trim() === title, survivingTitle);
    assert.equal(await page.locator(".card-list .entry-card").count(), 1);
    assert.equal(await page.locator(".card-list .entry-card h2").innerText(), survivingTitle, "deleted representative falls back to remaining identity group");
  }
  report.checks.push("Stale detail links survive representative deletion via normalized text or catalog ID");
  report.passed = true;
} catch (error) {
  report.error = error instanceof Error ? error.stack : String(error);
  process.exitCode = 1;
} finally {
  await mkdir(output, { recursive: true });
  await writeFile(join(output, "codex_music_identity_results.json"), JSON.stringify(report, null, 2));
  await browser?.close();
  await server?.close();
}
console.log(JSON.stringify(report));
