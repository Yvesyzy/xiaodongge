import { DatabaseSync } from 'node:sqlite';
import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { makeJournalFixtures } from '../mobile/codex_journal_fixtures.mjs';

const origin = process.argv[2] || 'http://127.0.0.1:5180';
const source = await readFile('mobile/src/store.ts', 'utf8');
const schema = source.match(/const schemaSql = `([\s\S]*?)`;/)?.[1];
assert.ok(schema);
const database = new DatabaseSync(':memory:'); database.exec(schema);
const browser = await chromium.launch({ channel: 'chrome', headless: true });
let failCoverWrite = false;
try {
  const page = await browser.newPage();
  await page.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
  await page.exposeFunction('codexSQLite', ({ method, statement, values = [] }) => {
    if (method === 'query') return { values: database.prepare(statement).all(...values) };
    assert.equal(method, 'run');
    if (failCoverWrite && statement.includes('INSERT OR REPLACE INTO CoverImage')) throw new Error('模拟 SQLite 写入失败');
    database.prepare(statement).run(...values); return { changes: { changes: 1 } };
  });
  await page.goto(origin + '/#/privacy');
  const seed = { ...makeJournalFixtures('6')[0], songName: 'cut：甲/乙' };
  const result = await page.evaluate(async seed => {
    const { store, entryCoverTarget } = await import('/src/store.ts');
    store.db = { query: (statement, values) => window.codexSQLite({ method: 'query', statement, values }), run: (statement, values) => window.codexSQLite({ method: 'run', statement, values }) };
    store.nativeReady = true; window.Capacitor.isNativePlatform = () => true;
    const entry = await store.createEntry(seed);
    const events = []; window.addEventListener('codex:cover-changed', () => events.push('changed'));
    await store.setCover('song', entry, 'legacy');
    const legacy = await store.getEntryCover(entry);
    const aggregateLegacy = (await store.albumAggregates())[0].coverDataUrl;
    const other = await store.createEntry({ ...seed, artistName: '另一艺人' });
    const isolated = await store.getEntryCover(other);
    const conflicting = await store.createEntry({ ...seed, songName: '另一个cut' });
    await store.setCover('song', conflicting, 'conflict');
    const ambiguous = await store.getEntryCover(entry);
    const target = entryCoverTarget(entry);
    await store.setCover(target.kind, target.target, 'album');
    const explicit = await store.getEntryCover(entry);
    const aggregate = (await store.albumAggregates()).find(item => item.artistName === entry.artistName).coverDataUrl;
    const normalized = await store.getCover('album', entry);
    const song = await store.createEntry({ ...seed, type: 'song', songName: '独立单曲' });
    const songFallback = await store.getEntryCover(song);
    await store.setCover('song', song, 'song');
    window.codexCoverEntry = entry;
    window.codexCoverEvents = events;
    return { legacy, aggregateLegacy, isolated, ambiguous, explicit, aggregate, normalized, songFallback, song: await store.getEntryCover(song), events: events.length };
  }, seed);
  assert.deepEqual(result, { legacy: 'legacy', aggregateLegacy: 'legacy', isolated: null, ambiguous: null, explicit: 'album', aggregate: 'album', normalized: 'album', songFallback: 'album', song: 'song', events: 4 });
  failCoverWrite = true;
  const failed = await page.evaluate(async () => {
    const { store } = await import('/src/store.ts');
    let error = '';
    try { await store.setCover('album', window.codexCoverEntry, 'invalid-write'); } catch (reason) { error = reason.message; }
    return { error, cover: await store.getEntryCover(window.codexCoverEntry), events: window.codexCoverEvents.length };
  });
  assert.match(failed.error, /模拟 SQLite 写入失败/);
  assert.equal(failed.cover, 'album'); assert.equal(failed.events, 4);
  assert.equal(database.prepare('SELECT count(*) AS count FROM CoverImage').get().count, 4, 'Legacy rows are retained');
  console.log('PASS native SQLite branch: legacy compatibility, ownership, canonical key, artist isolation, conflict handling, song fallback/priority, write failure retains cover and emits no event; historical rows retained.');
} finally { await browser.close(); database.close(); }
