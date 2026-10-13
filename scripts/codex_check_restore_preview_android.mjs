import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { makeJournalFixtures } from "../mobile/codex_journal_fixtures.mjs";
import { closeAndroidWebView, connectAndroidWebView, createAdbCommand, projectAvdName, PROJECT_AVD_NAME } from "./codex_android_cdp.mjs";

const { command } = createAdbCommand();
const output = resolve(process.argv[2] ?? "release/codex_t14_native_qa");
assert.equal(projectAvdName(command), PROJECT_AVD_NAME, "Only project-owned AVD may be used");
await mkdir(output, { recursive: true });
const report = { passed: false, engine: "Android 36 AVD, actual CapacitorSQLite plugin", checks: [] };
let connection, page;
try {
  command("shell", "am", "start", "-n", "com.yves.musicarchive/.MainActivity");
  connection = await connectAndroidWebView({ command, appId: "com.yves.musicarchive", pageSelector: ".app-header" });
  page = connection.page;
  page.setDefaultTimeout(30000);
  await page.evaluate(() => { location.hash = "/backup"; });
  await page.getByRole("heading", { name: "备份", exact: true }).waitFor();
  const snapshot = () => page.evaluate(async () => {
    const tables = {};
    for (const table of ["ReviewEntry", "ListeningMoment", "YearlySummary", "MonthlySummary", "CoverImage", "AppData", "UndoBackup"]) {
      const result = await window.Capacitor.nativePromise("CapacitorSQLite", "query", {
        database: "music_feelings_archive", statement: `SELECT * FROM ${table}`, values: [], readonly: false });
      tables[table] = (result.values ?? []).map(row => JSON.stringify(row)).sort();
    }
    return { tables, storage: Object.fromEntries(Object.keys(localStorage).sort().map(key => [key, localStorage.getItem(key)])) };
  });
  const before = await snapshot();
  await page.evaluate(() => {
    window.codexT14Original = window.Capacitor.nativePromise.bind(window.Capacitor);
    window.codexT14Writes = [];
    window.Capacitor.nativePromise = async (plugin, method, args) => {
      if (plugin === "CapacitorSQLite" && ["createConnection", "execute", "executeSet", "run", "deleteDatabase", "closeConnection"].includes(method)) {
        window.codexT14Writes.push({ method, database: args?.database });
      }
      return window.codexT14Original(plugin, method, args);
    };
  });
  const payload = { version: 6, exportedAt: new Date().toISOString(), entries: [{ ...makeJournalFixtures("6")[0], id: "codex-t14-isolated-preview" }],
    summaries: [], monthlySummaries: [], covers: [], listeningMoments: [], appData: {}, drafts: [] };
  await page.getByLabel("粘贴备份 JSON").fill(JSON.stringify(payload));
  await page.getByRole("button", { name: "预演恢复并查看差异" }).click();
  await page.getByText("Android 隔离数据库写入及回读通过；正式数据未覆盖").waitFor();
  await page.getByLabel("恢复差异报告").waitFor();
  const writes = await page.evaluate(() => {
    window.Capacitor.nativePromise = window.codexT14Original;
    return window.codexT14Writes;
  });
  const created = writes.filter(item => item.method === "createConnection");
  assert.equal(created.length, 1);
  const database = created[0].database;
  assert.match(database, /^codex_restore_preview_[a-f0-9]{32}$/);
  assert.ok(writes.every(item => item.database === database), "Preflight must never write to production SQLite");
  assert.ok(writes.some(item => item.method === "executeSet"), "Actual plugin transaction must execute");
  assert.ok(writes.some(item => item.method === "closeConnection"), "Isolated connection must close");
  const status = await page.evaluate(database => window.Capacitor.nativePromise("CapacitorSQLite", "isDatabase", { database, readonly: false }), database);
  assert.equal(status.result, true);
  assert.deepEqual(await snapshot(), before, "Production SQLite, drafts, undo and health remain byte-for-byte unchanged");
  report.isolationDatabase = database;
  report.checks.push("actual CapacitorSQLite isolated database transaction, readback and closed connection; production tables and Web storage unchanged");
  await page.evaluate(() => {
    window.codexT14Original = window.Capacitor.nativePromise.bind(window.Capacitor);
    window.codexT14FailureCalls = [];
    window.Capacitor.nativePromise = async (plugin, method, args) => {
      if (plugin === "CapacitorSQLite" && args?.database?.startsWith("codex_restore_preview_")) {
        window.codexT14FailureCalls.push(method);
        if (method === "executeSet") throw new Error("codex isolated write failure");
      }
      return window.codexT14Original(plugin, method, args);
    };
  });
  await page.getByRole("button", { name: "预演恢复并查看差异" }).click();
  await page.getByText(/恢复预演失败：codex isolated write failure/).waitFor();
  const failureCalls = await page.evaluate(() => {
    window.Capacitor.nativePromise = window.codexT14Original;
    return window.codexT14FailureCalls;
  });
  assert.ok(failureCalls.includes("executeSet") && failureCalls.includes("closeConnection"));
  assert.equal(await page.getByLabel("恢复差异报告").count(), 0);
  assert.deepEqual(await snapshot(), before, "Failed rehearsal must preserve all production data");
  report.checks.push("isolated SQLite write failure closes connection, rejects preview and leaves production unchanged");
  report.passed = true;
} catch (error) {
  report.error = error instanceof Error ? error.stack : String(error);
  process.exitCode = 1;
} finally {
  await writeFile(join(output, "codex_results.json"), JSON.stringify(report, null, 2));
  if (page) await page.evaluate(() => {
    if (window.codexT14Original) window.Capacitor.nativePromise = window.codexT14Original;
  }).catch(() => {});
  await closeAndroidWebView(connection);
}
console.log(JSON.stringify({ passed: report.passed, checks: report.checks, error: report.error }));
