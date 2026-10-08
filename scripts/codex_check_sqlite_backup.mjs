import { DatabaseSync } from "node:sqlite";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import assert from "node:assert/strict";
import { chromium } from "playwright";
import { makeJournalFixtures } from "../mobile/codex_journal_fixtures.mjs";
import { qaOptions } from "./codex_qa_options.mjs";

const { origin, output, backup: backupPath } = qaOptions({ origin: "http://127.0.0.1:5189", output: "release/codex_sqlite_backup", positionalBackup: true });

const source = await readFile("mobile/src/store.ts", "utf8");
const schema = source.match(/const schemaSql = `([\s\S]*?)`;/)?.[1];
assert.ok(schema);
const database = new DatabaseSync(":memory:");
const newDimensions = ["ratingLyrics", "ratingComposition", "ratingVocals"];
database.exec(newDimensions.reduce((sql, field) => sql.replace(`  ${field} REAL,`, ""), schema));
database.prepare("INSERT INTO ReviewEntry (id, type, title, year, content, rating, ratingModifier, ratingProduction, ratingSongwriting, ratingOriginality, ratingResonance, compositeRatingLocked, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
  .run("codex-sqlite-legacy-score", "album", "旧表评分", 2026, "合成旧记录", 9.2, "+", 8, 6, 9, 7, 1, "2026-09-01T00:00:00Z", "2026-09-01T00:00:00Z");
const legacyBefore = database.prepare("SELECT * FROM ReviewEntry WHERE id = ?").get("codex-sqlite-legacy-score");
database.exec("PRAGMA foreign_keys = ON");
const browser = await chromium.launch({ headless: true, channel: "chrome" });
let failNextUndoWrite = false;
let failNextEntryInsert = false;
let result;

try {
  const page = await browser.newPage({ timezoneId: "Asia/Shanghai" });
  await page.route("**/*", (route) => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
  await page.exposeFunction("codexSQLite", ({ method, statement, values = [], set, transaction }) => {
    if (method === "execute") { database.exec(statement); return { changes: { changes: 0 } }; }
    if (method === "query") return { values: database.prepare(statement).all(...values) };
    if (method === "run") {
      if (failNextUndoWrite && statement.includes("UndoBackup")) {
        failNextUndoWrite = false;
        throw new Error("模拟 UndoBackup 写入失败");
      }
      database.prepare(statement).run(...values);
      return { changes: { changes: 1 } };
    }
    assert.equal(method, "executeSet");
    assert.equal(transaction, true);
    database.exec("BEGIN");
    try {
      for (const item of set) {
        if (!Array.isArray(item.values)) throw new Error("ExecuteSet: No value for values");
        if (failNextUndoWrite && item.statement.includes("UndoBackup")) {
          failNextUndoWrite = false;
          throw new Error("模拟 UndoBackup 写入失败");
        }
        if (failNextEntryInsert && item.statement.startsWith("INSERT INTO ReviewEntry")) {
          failNextEntryInsert = false;
          throw new Error("模拟 ReviewEntry 写入失败");
        }
        database.prepare(item.statement).run(...item.values);
      }
      database.exec("COMMIT");
      return { changes: { changes: set.length } };
    } catch (error) {
      database.exec("ROLLBACK");
      throw error;
    }
  });

  await page.goto(`${origin}/#/privacy`);
  await page.evaluate(async () => {
    const { store } = await import("/src/store.ts");
    const connection = {
      isDBOpen: async () => ({ result: true }),
      execute: statement => window.codexSQLite({ method: "execute", statement }),
      query: (statement, values) => window.codexSQLite({ method: "query", statement, values }),
      run: (statement, values) => window.codexSQLite({ method: "run", statement, values }),
    };
    store.sqlite = { isConnection: async () => ({ result: true }), retrieveConnection: async () => connection };
    window.Capacitor.isNativePlatform = () => true;
    await store.init();
    await store.init();
  });
  const legacyAfter = database.prepare("SELECT * FROM ReviewEntry WHERE id = ?").get("codex-sqlite-legacy-score");
  for (const [key, value] of Object.entries(legacyBefore)) assert.deepEqual(legacyAfter[key], value, `Old-table migration preserves ${key}`);
  for (const field of newDimensions) assert.equal(legacyAfter[field], null, "new columns start empty without splitting legacy scores");
  const entries = makeJournalFixtures("6");
  entries[0] = { ...entries[0], rating: 7.3, ratingProduction: 8, ratingLyrics: 6.5, ratingComposition: 7.5,
    ratingVocals: 8, ratingOriginality: 7, ratingResonance: 7, ratingSongwriting: 6, compositeRatingLocked: false };
  for (const field of newDimensions) delete entries[1][field];
  const now = new Date().toISOString();
  const raw = backupPath
    ? await readFile(backupPath, "utf8")
    : JSON.stringify({ version: 5, exportedAt: now, entries, summaries: [], monthlySummaries: [], covers: [], listeningMoments: [{ id: "codex-relisten", entryId: entries[0].id, listenedAt: now, rating: 8, ratingModifier: null, moods: ["平静"], content: "模拟复听", createdAt: now, updatedAt: now }], appData: {} });

  result = await page.evaluate(async (input) => {
    const { store } = await import("/src/store.ts");
    store.db = {
      query: (statement, values) => window.codexSQLite({ method: "query", statement, values }),
      run: (statement, values) => window.codexSQLite({ method: "run", statement, values }),
      executeSet: (set, transaction) => window.codexSQLite({ method: "executeSet", set, transaction }),
    };
    store.nativeReady = true;
    window.Capacitor.isNativePlatform = () => true;
    await store.importBackup(input);
    return JSON.parse(await store.exportBackup());
  }, raw);
  const original = JSON.parse(raw);
  assert.equal(result.entries.length, original.entries.length);
  for (const entry of original.entries) {
    for (const [key, value] of Object.entries(entry)) {
      assert.deepEqual(result.entries.find((item) => item.id === entry.id)?.[key], value, `Preserved entry field ${key}`);
    }
  }
  assert.deepEqual(result.covers, original.covers);
  assert.deepEqual(result.monthlySummaries, original.monthlySummaries);
  assert.deepEqual(result.summaries, original.summaries);
  assert.deepEqual(result.listeningMoments, original.listeningMoments);
  assert.deepEqual(result.appData, original.appData);
  if (!backupPath) {
    const legacy = result.entries.find(entry => entry.id === entries[1].id);
    for (const field of newDimensions) assert.equal(legacy[field], null, "absent fields in legacy backups read back as null");
  }

  for (const field of newDimensions) {
    for (const invalid of [0, 10.5, 7.2, "8"]) {
      const damaged = structuredClone(original);
      damaged.entries[0][field] = invalid;
      await assert.rejects(page.evaluate(value => import("/src/store.ts").then(({ store }) => store.importBackup(value)), JSON.stringify(damaged)), /评分|必须是有效数字/);
    }
  }
  const afterInvalid = await page.evaluate(async () => JSON.parse(await (await import("/src/store.ts")).store.exportBackup()));
  assert.deepEqual({ ...afterInvalid, exportedAt: result.exportedAt }, result, "invalid dimension imports do not mutate stored data");

  failNextEntryInsert = true;
  await assert.rejects(page.evaluate(async (input) => (await import("/src/store.ts")).store.importBackup(input), raw), /模拟 ReviewEntry 写入失败/);
  await page.evaluate(async () => (await import("/src/store.ts")).store.recoverPendingRestore());
  const afterFailure = await page.evaluate(async () => JSON.parse(await (await import("/src/store.ts")).store.exportBackup()));
  assert.deepEqual({ ...afterFailure, exportedAt: result.exportedAt }, result, "Failed imports preserve every table");

  const oldUndoRaw = JSON.stringify({ version: 5, exportedAt: "2026-09-16T00:00:00.000Z", entries: [], summaries: [], monthlySummaries: [], covers: [], listeningMoments: [], appData: {} });
  database.prepare("INSERT OR REPLACE INTO UndoBackup (id, value) VALUES (1, ?)").run(oldUndoRaw);
  failNextUndoWrite = true;
  await assert.rejects(page.evaluate(async (input) => (await import("/src/store.ts")).store.importBackup(input), raw), /模拟 UndoBackup 写入失败/);
  assert.equal(database.prepare("SELECT value FROM UndoBackup WHERE id = 1").get().value, oldUndoRaw, "Failed snapshot write retains old undo");
  await page.evaluate(async () => (await import("/src/store.ts")).store.recoverPendingRestore());
  const afterUndoWriteFailure = await page.evaluate(async () => JSON.parse(await (await import("/src/store.ts")).store.exportBackup()));
  assert.deepEqual({ ...afterUndoWriteFailure, exportedAt: result.exportedAt }, result, "Failed snapshot write leaves main data unchanged");
  await page.evaluate(async () => (await import("/src/store.ts")).store.restoreImportUndo());
  const restoredAfterUndoWriteFailure = await page.evaluate(async () => JSON.parse(await (await import("/src/store.ts")).store.exportBackup()));
  assert.deepEqual({ ...restoredAfterUndoWriteFailure, exportedAt: "2026-09-16T00:00:00.000Z" }, { ...JSON.parse(oldUndoRaw), version: 6, drafts: [] }, "Undo write failure still restores the retained old main data");
  assert.equal(database.prepare("SELECT count(*) AS total FROM UndoBackup").get().total, 0, "Restoring the retained old undo clears the snapshot");
  await page.evaluate(async (input) => (await import("/src/store.ts")).store.importBackup(input), raw);

  const changed = JSON.parse(raw);
  changed.entries[0].content += "\n模拟新版本";
  const changedRaw = JSON.stringify(changed);
  await page.evaluate(async (input) => (await import("/src/store.ts")).store.importBackup(input), changedRaw);
  const savedUndo = database.prepare("SELECT value FROM UndoBackup WHERE id = 1").get().value;
  assert.deepEqual(JSON.parse(JSON.parse(savedUndo).beforeBackup).entries, result.entries, "Successful import stores the latest pre-import snapshot");
  await page.evaluate(async () => (await import("/src/store.ts")).store.restoreImportUndo());
  const restoredAfterSuccess = await page.evaluate(async () => JSON.parse(await (await import("/src/store.ts")).store.exportBackup()));
  assert.deepEqual({ ...restoredAfterSuccess, exportedAt: result.exportedAt }, result, "Successful undo restores prior data");
  assert.equal(database.prepare("SELECT count(*) AS total FROM UndoBackup").get().total, 0, "Successful undo clears the snapshot");

  const coverless = await page.evaluate(async (input) => {
    const { store } = await import("/src/store.ts");
    const exported = JSON.parse(await store.exportBackup({ includeCovers: false }));
    const damaged = JSON.parse(input);
    damaged.covers = [{ dataUrl: "damaged-cover" }];
    damaged.entries[0].content += "\n模拟修改，用于验证撤销恢复原文";
    let strictError = false;
    try { store.previewBackup(JSON.stringify(damaged)); } catch { strictError = true; }
    const preview = store.previewBackup(JSON.stringify(damaged), { includeCovers: false });
    await store.importBackup(JSON.stringify(damaged), { includeCovers: false });
    const after = JSON.parse(await store.exportBackup());
    await store.restoreImportUndo();
    return { exported, preview, after, strictError, restored: JSON.parse(await store.exportBackup()) };
  }, raw);
  assert.equal(coverless.strictError, true);
  assert.equal(coverless.preview.coverCount, 0);
  assert.deepEqual(coverless.exported.covers, []);
  assert.deepEqual(coverless.exported.entries, result.entries);
  assert.deepEqual(coverless.after.covers, original.covers, "Skipping backup covers preserves current covers");
  assert.notDeepEqual(coverless.after.entries, result.entries);
  assert.deepEqual(coverless.restored.entries, result.entries);
  assert.deepEqual(coverless.restored.covers, original.covers);

  result = { entries: result.entries.length, covers: result.covers.length, monthlySummaries: result.monthlySummaries.length, summaries: result.summaries.length, oldTableUpgrade: true, dimensionValidation: true, transactionRollback: true, undoAtomicFailure: true, undoRoundTrip: true, coverlessRoundTrip: true, engine: "Node SQLite with Android executeSet contract" };
} finally {
  await browser.close();
  database.close();
}

const payload = { passed: true, ...result };
if (output) {
  await mkdir(output, { recursive: true });
  await writeFile(join(output, "codex_sqlite_backup.json"), JSON.stringify(payload, null, 2));
}
console.log(JSON.stringify(payload));
