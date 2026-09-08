import { DatabaseSync } from 'node:sqlite';
import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { makeJournalFixtures } from '../mobile/codex_journal_fixtures.mjs';
const source = await readFile('mobile/src/store.ts', 'utf8');
const schema = source.match(/const schemaSql = `([\s\S]*?)`;/)?.[1];
assert.ok(schema);
const database = new DatabaseSync(':memory:'); database.exec(schema);
database.exec('PRAGMA foreign_keys = ON');
const browser = await chromium.launch({ headless: true, channel: 'chrome' });
let failNextInsert = false;
try {
  const page = await browser.newPage({ timezoneId: 'Asia/Shanghai' });
  await page.route('**/*', route => new URL(route.request().url()).hostname === '127.0.0.1' ? route.continue() : route.abort());
  await page.exposeFunction('codexSQLite', ({ method, statement, values = [], set, transaction }) => {
    if (method === 'query') return { values: database.prepare(statement).all(...values) };
    if (method === 'run') { database.prepare(statement).run(...values); return { changes: { changes: 1 } }; }
    assert.equal(method, 'executeSet'); assert.equal(transaction, true);
    database.exec('BEGIN');
    try {
      for (const item of set) {
        if (!Array.isArray(item.values)) throw new Error('ExecuteSet: No value for values');
        if (failNextInsert && item.statement.startsWith('INSERT INTO ReviewEntry')) { failNextInsert = false; throw new Error('Simulated write failure'); }
        database.prepare(item.statement).run(...item.values);
      }
      database.exec('COMMIT'); return { changes: { changes: set.length } };
    } catch (e) { database.exec('ROLLBACK'); throw e; }
  });
  await page.goto('http://127.0.0.1:5173');
  const entries = makeJournalFixtures('6');
  const now = new Date().toISOString();
  const raw = process.argv[2] ? await readFile(process.argv[2], 'utf8') : JSON.stringify({ version: 5, exportedAt: now, entries, summaries: [], monthlySummaries: [], covers: [], listeningMoments: [{ id: 'codex-relisten', entryId: entries[0].id, listenedAt: now, rating: 8, ratingModifier: null, moods: ['平静'], content: '模拟复听', createdAt: now, updatedAt: now }], appData: {} });
  const result = await page.evaluate(async raw => {
    const { store } = await import('/src/store.ts');
    store.db = {
      query: (statement, values) => window.codexSQLite({ method: 'query', statement, values }),
      run: (statement, values) => window.codexSQLite({ method: 'run', statement, values }),
      executeSet: (set, transaction) => window.codexSQLite({ method: 'executeSet', set, transaction })
    };
    store.nativeReady = true; window.Capacitor.isNativePlatform = () => true;
    await store.importBackup(raw);
    return JSON.parse(await store.exportBackup());
  }, raw);
  const original = JSON.parse(raw);
  assert.equal(result.entries.length, original.entries.length);
  for (const entry of original.entries) for (const [key, value] of Object.entries(entry)) assert.deepEqual(result.entries.find(e => e.id === entry.id)?.[key], value, 'Preserved entry field ' + key);
  assert.deepEqual(result.covers, original.covers);
  assert.deepEqual(result.monthlySummaries, original.monthlySummaries);
  assert.deepEqual(result.summaries, original.summaries);
  assert.deepEqual(result.listeningMoments, original.listeningMoments);
  assert.deepEqual(result.appData, original.appData);
  failNextInsert = true;
  await assert.rejects(page.evaluate(async raw => { const { store } = await import('/src/store.ts'); await store.importBackup(raw); }, raw), /Simulated write failure/);
  assert.equal(database.prepare('SELECT count(*) AS total FROM ReviewEntry').get().total, original.entries.length, 'Failed imports roll back DELETEs');
  const afterFailure = await page.evaluate(async () => JSON.parse(await (await import('/src/store.ts')).store.exportBackup()));
  assert.deepEqual({ ...afterFailure, exportedAt: result.exportedAt }, result, 'Failed imports preserve every table');
  const coverless = await page.evaluate(async raw => {
    const { store } = await import('/src/store.ts');
    const exported = JSON.parse(await store.exportBackup({ includeCovers: false }));
    const damaged = JSON.parse(raw); damaged.covers = [{ dataUrl: 'damaged-cover' }];
    damaged.entries[0].content += '\n模拟修改，用于验证撤销恢复原文';
    let strictError = false; try { store.previewBackup(JSON.stringify(damaged)); } catch { strictError = true; }
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
  assert.deepEqual(coverless.after.covers, original.covers, 'Skipping backup covers preserves current covers');
  assert.notDeepEqual(coverless.after.entries, result.entries);
  assert.deepEqual(coverless.restored.entries, result.entries);
  assert.deepEqual(coverless.restored.covers, original.covers);
  console.log(JSON.stringify({ passed: true, entries: result.entries.length, covers: result.covers.length, monthlySummaries: result.monthlySummaries.length, summaries: result.summaries.length, transactionRollback: true, coverlessRoundTrip: true, undo: true, engine: 'Node SQLite with Android executeSet contract' }));
} finally { await browser.close(); database.close(); }
