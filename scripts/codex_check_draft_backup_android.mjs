import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve, join } from "node:path";
import { chromium } from "playwright";
import { makeJournalFixtures } from "../mobile/codex_journal_fixtures.mjs";

const adb = "C:/Users/lenovo/AppData/Local/Android/Sdk/platform-tools/adb.exe";
const serial = "emulator-5562";
const output = resolve(process.argv[2] ?? "release/codex_t06_native_20260923");
const command = (...args) => execFileSync(adb, ["-s", serial, ...args], { encoding: "utf8", windowsHide: true }).trim();
assert.equal(command("emu", "avd", "name").replace(/\r/g, "").split("\n")[0], "codex_np1_api36", "Only the project-owned synthetic AVD may be modified");
await mkdir(output, { recursive: true });
let browser, page, port;
const result = { passed: false, engine: "Android 36 AVD, actual CapacitorSQLite plugin", checks: [] };
async function connect() {
  command("shell", "am", "start", "-n", "com.yves.musicarchive/.MainActivity");
  let socket;
  for (let tries = 0; tries < 60; tries++) {
    let pid;
    try { pid = command("shell", "pidof", "com.yves.musicarchive"); }
    catch { await new Promise(resolve => setTimeout(resolve, 500)); continue; }
    const sockets = command("shell", "cat", "/proc/net/unix");
    socket = sockets.split(/\r?\n/).map(line => line.split(/\s+/).at(-1)).find(name => name === `@webview_devtools_remote_${pid}`);
    if (socket) break;
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  assert.ok(socket, "Owned app exposes debug WebView");
  port = command("forward", "tcp:0", `localabstract:${socket.slice(1)}`);
  browser = await chromium.connectOverCDP(`http://127.0.0.1:${port}`, { noDefaults: true });
  page = browser.contexts()[0].pages()[0];
  page.on("dialog", dialog => dialog.accept());
  page.setDefaultTimeout(20000);
  await page.locator(".app-header").waitFor();
  await page.evaluate(() => { location.hash = "/backup"; });
  await page.getByRole("heading", { name: "备份", exact: true }).waitFor();
}
async function disconnect() {
  await browser?.close();
  browser = undefined;
  if (port) command("forward", "--remove", `tcp:${port}`);
  port = undefined;
}
async function importThroughUi(payload, expectSuccess = true) {
  await page.getByLabel("粘贴备份 JSON").fill(JSON.stringify(payload));
  await page.getByRole("button", { name: "预演恢复并查看差异" }).click();
  await page.getByLabel("恢复差异报告").waitFor();
  await page.getByRole("button", { name: "导入并覆盖当前数据", exact: true }).click();
  if (expectSuccess) await page.getByText(/^导入完成：/).waitFor();
  else await page.getByRole("heading", { name: "档案恢复尚未完成", exact: true }).waitFor();
}
async function snapshot() {
  return page.evaluate(async () => {
    const tables = {};
    for (const table of ["ReviewEntry", "ListeningMoment", "YearlySummary", "MonthlySummary", "CoverImage", "AppData", "UndoBackup"]) {
      const response = await window.Capacitor.nativePromise("CapacitorSQLite", "query", { database: "music_feelings_archive", statement: `SELECT * FROM ${table}`, values: [], readonly: false });
      tables[table] = (response.values ?? []).filter(row => table !== "AppData" || row.key !== "codex-restore-journal:v1").map(row => JSON.stringify(row)).sort();
    }
    return { tables, drafts: Object.keys(localStorage).filter(key => key.startsWith("music-feelings-entry-draft:v1:")).sort().map(key => ({ key, raw: localStorage.getItem(key) })) };
  });
}
try {
  await connect();
  const today = await page.evaluate(() => { const now = new Date(); return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`; });
  const payload = { version: 6, exportedAt: new Date().toISOString(), entries: makeJournalFixtures("6"), summaries: [], monthlySummaries: [], covers: [], listeningMoments: [], appData: { "daily-resurfacing": JSON.stringify({ date: today, entryId: null, dismissed: true }) }, drafts: [] };
  const draft = { version: 2, mode: "create", captureMode: "full", entryId: null, draftId: "native-fixture", baseUpdatedAt: null, savedAt: payload.exportedAt,
    fields: { type: "album", title: "原生草稿", year: "2026", month: "9", albumName: "合成专辑", songName: "", artistName: "合成艺人", listenedAt: today, tags: "", rating: "8", ratingModifier: "+", ratingProduction: "", ratingSongwriting: "", ratingOriginality: "", ratingResonance: "", content: "SQLite 与草稿必须一起恢复" },
    genreSelection: { level1: "", level2: "", level3: "" }, selectedGenreTags: [], selectedMoodGroupId: "", selectedMoods: [], coverDataUrl: null, coverChanged: false, ocrText: "原始 OCR", recognizedFields: null, musicMetadata: null, compositeRatingLocked: false, inspiration: false };
  payload.drafts = [{ key: "music-feelings-entry-draft:v1:new:native-fixture", raw: JSON.stringify(draft) }];
  await importThroughUi(payload);
  const before = await snapshot();
  const target = structuredClone(payload);
  target.entries[0].content += " 新导入内容";
  target.drafts = [];
  await importThroughUi(target);
  assert.equal((await snapshot()).drafts.length, 0);
  await page.getByRole("button", { name: "撤销上次导入", exact: true }).click();
  await page.getByText("已撤销上次导入", { exact: true }).waitFor();
  const undone = await snapshot();
  assert.deepEqual(undone.drafts, before.drafts);
  for (const table of Object.keys(before.tables).filter(table => table !== "UndoBackup")) assert.deepEqual(undone.tables[table], before.tables[table]);
  assert.deepEqual(undone.tables.UndoBackup, []);
  result.checks.push("real SQLite v6 import, empty draft replacement and undo");
  const checkpoint = await snapshot();
  await page.getByLabel("粘贴备份 JSON").fill(JSON.stringify(target));
  await page.getByRole("button", { name: "预演恢复并查看差异" }).click();
  await page.getByLabel("恢复差异报告").waitFor();
  await page.evaluate(() => {
    const original = window.Capacitor.nativePromise.bind(window.Capacitor);
    const setItem = Storage.prototype.setItem, removeItem = Storage.prototype.removeItem;
    window.codexNativeInterrupted = false;
    Storage.prototype.setItem = function(...args) { if (window.codexNativeInterrupted) throw new Error("codex storage unavailable"); return setItem.apply(this, args); };
    Storage.prototype.removeItem = function(...args) { if (window.codexNativeInterrupted) throw new Error("codex storage unavailable"); return removeItem.apply(this, args); };
    window.Capacitor.nativePromise = async (plugin, method, options) => {
      if (plugin === "CapacitorSQLite" && ["run", "executeSet", "execute"].includes(method) && window.codexNativeInterrupted) throw new Error("codex native writes unavailable");
      const response = await original(plugin, method, options);
      if (plugin === "CapacitorSQLite" && method === "executeSet") { window.codexNativeInterrupted = true; throw new Error("codex interruption after actual SQLite COMMIT"); }
      return response;
    };
  });
  await page.getByRole("button", { name: "导入并覆盖当前数据", exact: true }).click();
  await page.getByRole("heading", { name: "档案恢复尚未完成", exact: true }).waitFor();
  result.pendingJournal = await page.evaluate(async () => (await window.Capacitor.nativePromise("CapacitorSQLite", "query", { database: "music_feelings_archive", statement: "SELECT value FROM AppData WHERE key = ?", values: ["codex-restore-journal:v1"], readonly: false })).values);
  assert.equal(JSON.parse(result.pendingJournal[0].value).phase, "data-written");
  await page.screenshot({ path: join(output, "codex_native_recovery_blocked.png") });
  await disconnect();
  command("shell", "am", "force-stop", "com.yves.musicarchive");
  await connect();
  assert.deepEqual(await snapshot(), checkpoint, "Actual process restart rolls back all SQLite tables, undo and draft raw bytes");
  const marker = await page.evaluate(async () => ({ journal: (await window.Capacitor.nativePromise("CapacitorSQLite", "query", { database: "music_feelings_archive", statement: "SELECT value FROM AppData WHERE key = ?", values: ["codex-restore-journal:v1"], readonly: false })).values, gate: localStorage.getItem("music-feelings-restore-gate:v1") }));
  assert.deepEqual(marker.journal, []);
  assert.equal(marker.gate, null);
  result.checks.push("actual SQLite COMMIT followed by unavailable writes, process death, startup rollback of all tables and drafts");
  await page.screenshot({ path: join(output, "codex_native_recovery_complete.png") });
  result.passed = true;
} catch (error) {
  result.error = error instanceof Error ? error.stack : String(error);
  process.exitCode = 1;
} finally {
  await writeFile(join(output, "codex_native_draft_backup_results.json"), JSON.stringify(result, null, 2));
  await disconnect();
}
console.log(JSON.stringify({ passed: result.passed, checks: result.checks, error: result.error }));
