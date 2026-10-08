import { DatabaseSync } from "node:sqlite";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve, join } from "node:path";
import assert from "node:assert/strict";
import { chromium } from "playwright";
import { createServer } from "vite";
import { freeLoopbackPort, qaOptions } from "./codex_qa_options.mjs";

let { origin, output: outputOption } = qaOptions({
  origin: "http://127.0.0.1:5173",
  output: `release/codex_t06_backup_${Date.now()}`,
});
const output = resolve(outputOption);
let ownedServer;
if (!process.argv.includes("--origin")) {
  ownedServer = await createServer({ configFile: resolve("mobile/vite.config.ts"), cacheDir: join(output, "vite-cache"),
    server: { host: "127.0.0.1", port: await freeLoopbackPort(), strictPort: true, forwardConsole: false } });
  await ownedServer.listen();
  origin = `http://127.0.0.1:${ownedServer.httpServer.address().port}`;
}
const baselineOnly = process.argv.includes("--baseline-only");

const MAIN_KEYS = [
  "music-feelings-mobile-entries",
  "music-feelings-mobile-summaries",
  "music-feelings-mobile-monthly-summaries",
  "music-feelings-mobile-covers",
  "music-feelings-mobile-listening-moments",
  "music-feelings-mobile-app-data",
];
const DRAFT_PREFIX = "music-feelings-entry-draft:v1:";
const IMPORT_UNDO_KEY = "music-feelings-mobile-import-undo";
const WEB_JOURNAL_KEY = "music-feelings-restore-journal:v1";
const NATIVE_JOURNAL_KEY = "codex-restore-journal:v1";
const GATE_KEY = "music-feelings-restore-gate:v1";
const STORAGE_LOCK_NAME = "codex-archive-storage:v1";
const NOW = "2026-09-23T01:02:03.000Z";
const COVER_DATA = "data:image/png;base64,Y29kZXgtZDU=";

const evidence = {
  script: "codex_check_draft_backup.mjs",
  contract: "docs/codex_draft_backup_contract.md",
  origin,
  baselineOnly,
  branches: [],
  cases: [],
  failurePoints: [],
  passed: false,
};

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function errorMessage(error) {
  return error instanceof Error ? error.message : String(error);
}

function cover(kind, albumName, songName, artistName, dataUrl = COVER_DATA) {
  return {
    coverKey: JSON.stringify([kind, albumName ?? "", songName ?? "", artistName ?? ""]),
    kind,
    albumName,
    songName,
    artistName,
    dataUrl,
    updatedAt: NOW,
  };
}

const BASE_ENTRIES = [
  {
    id: "codex-d5-entry-1",
    type: "album",
    title: "D5 合成专辑",
    year: 2026,
    month: 9,
    albumName: "D5 合成专辑",
    songName: null,
    artistName: "D5 模拟艺人",
    musicMetadata: {
      albumArtistName: "D5 模拟艺人",
      authorName: "D5 作者",
      writerName: "D5 作词",
      composerName: "D5 作曲",
      releaseDate: "2026-09-01",
      releaseYear: 2026,
      genre: "ambient",
      durationMs: 240000,
      trackNumber: 1,
      trackCount: 8,
      explicitness: "notExplicit",
      mediaId: "d5-media-1",
      mediaUri: "file:///d5/album",
      artworkUri: COVER_DATA,
      displayTitle: "D5 合成专辑",
      displaySubtitle: "D5 副标题",
      displayDescription: "D5 描述",
      sourcePackage: "codex.synthetic",
      catalogTrackId: "d5-track-1",
      catalogAlbumId: "d5-album-1",
      catalogArtistId: "d5-artist-1",
      enrichedAt: NOW,
    },
    content: "D5 原始正文一。包含换行、emoji 🎧 和完整字段。",
    tags: ["编曲", "空间"],
    moods: ["平静"],
    rating: 8,
    ratingModifier: "+",
    ratingProduction: 8.5,
    ratingSongwriting: 7.5,
    ratingOriginality: 8,
    ratingResonance: 8.5,
    compositeRatingLocked: true,
    firstListenedAt: "2020-01-01T00:00:00.000Z",
    listenedAt: "2026-09-01T12:00:00.000Z",
    createdAt: NOW,
    updatedAt: NOW,
  },
  {
    id: "codex-d5-entry-2",
    type: "song",
    title: "D5 合成歌曲",
    year: 2025,
    month: 12,
    albumName: "D5 合成专辑",
    songName: "D5 合成歌曲",
    artistName: "D5 模拟艺人",
    musicMetadata: {
      releaseDate: "2025-12-01",
      releaseYear: 2025,
      trackNumber: 2,
      trackCount: 8,
      explicitness: "cleaned",
      mediaId: "d5-media-2",
      sourcePackage: "codex.synthetic",
      enrichedAt: NOW,
    },
    content: "D5 原始歌曲正文。",
    tags: ["人声"],
    moods: ["专注", "温柔"],
    rating: 7.5,
    ratingModifier: null,
    ratingProduction: null,
    ratingSongwriting: 7,
    ratingOriginality: 7.5,
    ratingResonance: 8,
    compositeRatingLocked: false,
    firstListenedAt: null,
    listenedAt: "2025-12-03T12:00:00.000Z",
    createdAt: "2026-09-02T01:02:03.000Z",
    updatedAt: "2026-09-02T01:02:03.000Z",
  },
];

const BASE_COVERS = [cover("album", "D5 合成专辑", null, "D5 模拟艺人")];
const BASE_MOMENTS = [{
  id: "codex-d5-moment-1",
  entryId: "codex-d5-entry-1",
  listenedAt: "2026-09-04T12:00:00.000Z",
  rating: 8,
  ratingModifier: null,
  moods: ["平静"],
  content: "D5 复听原文。",
  createdAt: NOW,
  updatedAt: NOW,
}];
const BASE_APP_DATA = {
  "daily-resurfacing": JSON.stringify({ date: "2026-09-23", entryId: "codex-d5-entry-1", dismissed: true }),
  "listening-semantic-overrides": "[]",
};

function draftFields(title, type = "album") {
  return {
    type,
    title,
    year: "2026",
    month: "9",
    albumName: "D5 草稿专辑",
    songName: type === "song" ? "D5 草稿歌曲" : "",
    artistName: "D5 草稿艺人",
    listenedAt: "2026-09-05",
    firstListenedAt: "2020-02-03",
    tags: "编曲, 留白",
    rating: "8.5",
    ratingModifier: "+",
    ratingProduction: "8",
    ratingSongwriting: "7.5",
    ratingOriginality: "9",
    ratingResonance: "8.5",
    content: `D5 草稿正文 ${title}。保留原文、换行与 emoji 🎧。`,
  };
}

function makeDraft({ mode = "create", key, title, entryId = null, draftId = null, baseUpdatedAt = null, savedAt = NOW, coverChanged = true } = {}) {
  return {
    key,
    raw: JSON.stringify({
      version: 2,
      mode,
      captureMode: "full",
      entryId,
      draftId,
      baseUpdatedAt,
      savedAt,
      fields: draftFields(title, mode === "edit" ? "song" : "album"),
      genreSelection: { level1: "电子", level2: "氛围", level3: "" },
      selectedGenreTags: ["ambient", "器乐"],
      selectedMoodGroupId: "calm",
      selectedMoods: ["平静", "专注"],
      coverDataUrl: coverChanged ? COVER_DATA : null,
      coverChanged,
      ocrText: `D5 OCR 原文 ${title}`,
      recognizedFields: { type: mode === "edit" ? "song" : "album", title, albumName: "D5 草稿专辑", artistName: "D5 草稿艺人", content: "OCR 正文" },
      musicMetadata: { releaseDate: "2026-08-01", releaseYear: 2026, genre: "ambient", mediaId: `d5-draft-${title}`, enrichedAt: NOW },
      compositeRatingLocked: true,
      inspiration: true,
    }),
  };
}

const BASE_DRAFTS = [
  makeDraft({ key: `${DRAFT_PREFIX}new`, title: "legacy 新建草稿", draftId: null, savedAt: "2026-09-23T00:00:01.000Z" }),
  makeDraft({ key: `${DRAFT_PREFIX}new:d5-create-1`, title: "带 ID 新建草稿", draftId: "d5-create-1", savedAt: "2026-09-23T00:00:02.000Z" }),
  makeDraft({ key: `${DRAFT_PREFIX}edit:${BASE_ENTRIES[0].id}`, title: "编辑草稿", mode: "edit", entryId: BASE_ENTRIES[0].id, baseUpdatedAt: BASE_ENTRIES[0].updatedAt, draftId: null, savedAt: "2026-09-23T00:00:03.000Z" }),
];
const TARGET_DRAFTS = [
  makeDraft({ key: `${DRAFT_PREFIX}new`, title: "导入 legacy 新建", draftId: null, savedAt: "2026-09-23T00:01:01.000Z" }),
  makeDraft({ key: `${DRAFT_PREFIX}new:d5-import-1`, title: "导入带 ID 新建", draftId: "d5-import-1", savedAt: "2026-09-23T00:01:02.000Z" }),
  makeDraft({ key: `${DRAFT_PREFIX}edit:${BASE_ENTRIES[0].id}`, title: "导入编辑", mode: "edit", entryId: BASE_ENTRIES[0].id, baseUpdatedAt: BASE_ENTRIES[0].updatedAt, draftId: null, savedAt: "2026-09-23T00:01:03.000Z" }),
];

for (const draft of [BASE_DRAFTS[1], TARGET_DRAFTS[1]]) {
  const parsed = JSON.parse(draft.raw);
  Object.assign(parsed.fields, { ratingLyrics: "7", ratingComposition: "8", ratingVocals: "9" });
  draft.raw = JSON.stringify(parsed);
}

function makePayload(version, drafts = undefined, suffix = "") {
  const entries = clone(BASE_ENTRIES);
  if (suffix) entries[0].content += ` ${suffix}`;
  const payload = {
    version,
    exportedAt: NOW,
    entries,
    summaries: [],
    covers: clone(BASE_COVERS),
  };
  if (version >= 2) payload.entries = entries;
  else payload.entries = entries.map((entry) => { const copy = clone(entry); delete copy.musicMetadata; return copy; });
  if (version >= 3) {
    payload.monthlySummaries = [];
    payload.appData = clone(BASE_APP_DATA);
  }
  if (version >= 4) payload.listeningMoments = clone(BASE_MOMENTS);
  if (version >= 6) payload.drafts = clone(drafts ?? []);
  return payload;
}

function makeV5(payload) {
  const v5 = clone(payload);
  v5.version = 5;
  delete v5.drafts;
  if (!v5.monthlySummaries) v5.monthlySummaries = [];
  if (!v5.listeningMoments) v5.listeningMoments = [];
  if (!v5.appData) v5.appData = {};
  return v5;
}

function asJson(payload) {
  return JSON.stringify(payload, null, 2);
}

function withoutExportedAt(value) {
  const copy = clone(value);
  delete copy.exportedAt;
  return copy;
}

function normalizeBackup(value) {
  const copy = clone(value);
  delete copy.exportedAt;
  // Missing optional fields in pre-six-dimension backups normalize to SQL NULL.
  for (const entry of copy.entries) {
    entry.ratingLyrics ??= null;
    entry.ratingComposition ??= null;
    entry.ratingVocals ??= null;
  }
  if (copy.drafts) copy.drafts.sort((a, b) => a.key.localeCompare(b.key));
  return copy;
}

function assertResultOk(result, label) {
  assert.equal(result.ok, true, `${label}: ${result.message ?? "操作失败"}`);
  return result.value;
}

function assertResultRejected(result, label) {
  assert.equal(result.ok, false, `${label}: 应拒绝但已成功`);
  assert.equal(typeof result.message, "string", `${label}: 拒绝必须返回错误文本`);
  return result.message;
}

function assertBackupData(actual, expected, label) {
  assert.deepEqual(normalizeBackup(actual), normalizeBackup(expected), label);
}

function makeStorageMap(payload) {
  return {
    [MAIN_KEYS[0]]: JSON.stringify(payload.entries),
    [MAIN_KEYS[1]]: JSON.stringify(payload.summaries),
    [MAIN_KEYS[2]]: JSON.stringify(payload.monthlySummaries ?? []),
    [MAIN_KEYS[3]]: JSON.stringify(payload.covers),
    [MAIN_KEYS[4]]: JSON.stringify(payload.listeningMoments ?? []),
    [MAIN_KEYS[5]]: JSON.stringify(payload.appData ?? {}),
  };
}

function formalBackup(raw) {
  const parsed = JSON.parse(raw);
  parsed.drafts = [];
  return asJson(parsed);
}

async function storeInvoke(page, method, args = []) {
  return page.evaluate(async ({ method, args }) => {
    try {
      const { store } = await import("/src/store.ts");
      return { ok: true, value: await store[method](...args) };
    } catch (error) {
      return { ok: false, message: error instanceof Error ? error.message : String(error) };
    }
  }, { method, args });
}

async function configureStore(page, native) {
  await page.evaluate(async (isNative) => {
    const { store } = await import("/src/store.ts");
    const Capacitor = window.Capacitor;
    Capacitor.isNativePlatform = () => isNative;
    globalThis.Capacitor = Capacitor;
    store.nativeReady = isNative;
    if (isNative) {
      store.db = {
        query: (statement, values = []) => globalThis.codexSQLite({ method: "query", statement, values }),
        run: (statement, values = []) => globalThis.codexSQLite({ method: "run", statement, values }),
        executeSet: (set, transaction) => globalThis.codexSQLite({ method: "executeSet", set, transaction }),
      };
    } else {
      store.db = null;
    }
  }, native);
}

function makeSQLiteBridge(database) {
  const fault = { method: null, statement: null, once: true };
  const matches = (method, statement) => fault.method === method && (!fault.statement || statement.includes(fault.statement));
  const maybeFail = (method, statement) => {
    if (!matches(method, statement)) return;
    if (fault.once) fault.method = null;
    throw new Error(`codex D5 SQLite fault: ${method}:${statement}`);
  };
  return {
    call({ method, statement, values = [], set = [], transaction }) {
      if (method === "query") return { values: database.prepare(statement).all(...values) };
      if (method === "run") {
        maybeFail("run", statement);
        database.prepare(statement).run(...values);
        return { changes: { changes: 1 } };
      }
      assert.equal(method, "executeSet");
      assert.equal(transaction, true, "D5 SQLite bridge requires executeSet transaction=true");
      maybeFail("executeSet", set.map((item) => item.statement).join("\n"));
      database.exec("BEGIN");
      try {
        for (const item of set) {
          if (!Array.isArray(item.values)) throw new Error("ExecuteSet: No value for values");
          maybeFail("executeSet-item", item.statement);
          database.prepare(item.statement).run(...item.values);
        }
        database.exec("COMMIT");
        return { changes: { changes: set.length } };
      } catch (error) {
        database.exec("ROLLBACK");
        throw error;
      }
    },
    setFailure(method, statement = null) {
      fault.method = method;
      fault.statement = statement;
      fault.once = true;
    },
    clearFailure() {
      fault.method = null;
      fault.statement = null;
    },
    describe() {
      return { method: fault.method, statement: fault.statement };
    },
  };
}

async function createHarness(browser, native, database) {
  const context = await browser.newContext({ timezoneId: "Asia/Shanghai" });
  const page = await context.newPage();
  const bridge = native ? makeSQLiteBridge(database) : null;
  if (native) {
    await page.exposeFunction("codexSQLite", (input) => bridge.call(input));
    await page.exposeFunction("codexSQLiteSetFailure", (method, statement) => bridge.setFailure(method, statement ?? null));
    await page.exposeFunction("codexSQLiteClearFailure", () => bridge.clearFailure());
  }
  await page.route("**/*", (route) => {
    try {
      if (new URL(route.request().url()).origin === origin) return route.continue();
    } catch {
      // Abort malformed or external requests in the offline fixture.
    }
    return route.abort();
  });
  await page.goto(`${origin}/#/privacy`);
  await configureStore(page, native);
  return { native, context, page, bridge, database };
}

async function clearHarness(harness) {
  await harness.page.evaluate(() => localStorage.clear());
  if (harness.native) {
    harness.database.exec("DELETE FROM ListeningMoment; DELETE FROM ReviewEntry; DELETE FROM YearlySummary; DELETE FROM MonthlySummary; DELETE FROM CoverImage; DELETE FROM AppData; DELETE FROM UndoBackup;");
  }
}

async function clearUndo(harness) {
  if (harness.native) {
    harness.database.exec("DELETE FROM UndoBackup");
  } else {
    await harness.page.evaluate((key) => localStorage.removeItem(key), IMPORT_UNDO_KEY);
  }
}

async function setDrafts(harness, drafts) {
  await harness.page.evaluate(({ prefix, drafts }) => {
    const stale = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(prefix)) stale.push(key);
    }
    stale.forEach((key) => localStorage.removeItem(key));
    drafts.forEach(({ key, raw }) => localStorage.setItem(key, raw));
  }, { prefix: DRAFT_PREFIX, drafts });
}

async function readDrafts(harness) {
  return harness.page.evaluate((prefix) => {
    const result = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(prefix)) result.push({ key, raw: localStorage.getItem(key) });
    }
    return result.filter((item) => item.raw !== null).sort((a, b) => a.key.localeCompare(b.key));
  }, DRAFT_PREFIX);
}

async function readPrimaryStorage(harness) {
  return harness.page.evaluate((keys) => Object.fromEntries(keys.map((key) => [key, localStorage.getItem(key)])), MAIN_KEYS);
}

async function readUndo(harness) {
  if (harness.native) {
    const row = harness.database.prepare("SELECT value FROM UndoBackup WHERE id = 1").get();
    return row?.value ?? null;
  }
  return harness.page.evaluate((key) => localStorage.getItem(key), IMPORT_UNDO_KEY);
}

async function readNativeAppData(harness) {
  if (!harness.native) return null;
  const rows = harness.database.prepare("SELECT key, value FROM AppData ORDER BY key").all();
  return Object.fromEntries(rows.map((row) => [String(row.key), String(row.value)]));
}

async function readSnapshot(harness) {
  const exported = await storeInvoke(harness.page, "exportBackup");
  const raw = exported.ok ? exported.value : null;
  const primaryRaw = await readPrimaryStorage(harness);
  const nativeRows = harness.native ? Object.fromEntries(["ReviewEntry", "ListeningMoment", "YearlySummary", "MonthlySummary", "CoverImage", "AppData"].map(table => [table,
    harness.database.prepare(`SELECT * FROM ${table}`).all().filter(row => table !== "AppData" || row.key !== NATIVE_JOURNAL_KEY).map(row => JSON.stringify(row)).sort(),
  ])) : null;
  const appData = harness.native ? await readNativeAppData(harness) : JSON.parse(primaryRaw[MAIN_KEYS[5]] ?? "{}");
  delete appData[NATIVE_JOURNAL_KEY];
  return {
    backupRaw: raw,
    backup: raw === null ? null : JSON.parse(raw),
    nativeRows,
    primaryRaw,
    drafts: await readDrafts(harness),
    undo: await readUndo(harness),
    appDataRaw: appData,
  };
}

function assertSnapshotEqual(actual, expected, label) {
  if (actual.backup && expected.backup) assertBackupData(actual.backup, expected.backup, `${label}: formal backup`);
  assert.deepEqual(actual.nativeRows, expected.nativeRows, `${label}: all native table rows`);
  assert.deepEqual(actual.primaryRaw, expected.primaryRaw, `${label}: six primary Web keys`);
  assert.deepEqual(actual.drafts, expected.drafts, `${label}: draft raw collection`);
  assert.equal(actual.undo, expected.undo, `${label}: undo raw`);
  assert.deepEqual(actual.appDataRaw, expected.appDataRaw, `${label}: AppData`);
}

async function seedBaseline(harness) {
  await clearHarness(harness);
  const result = await storeInvoke(harness.page, "importBackup", [asJson(makePayload(5))]);
  assertResultOk(result, "seed v5 baseline");
  await clearUndo(harness);
  await setDrafts(harness, BASE_DRAFTS);
  const snapshot = await readSnapshot(harness);
  assert.equal(snapshot.drafts.length, BASE_DRAFTS.length, "synthetic baseline drafts installed");
  return snapshot;
}

async function applyDirectTarget(harness, payload, drafts) {
  if (harness.native) {
    const result = await storeInvoke(harness.page, "importBackup", [asJson(makeV5(payload))]);
    assertResultOk(result, "seed direct SQLite target");
    await clearUndo(harness);
  } else {
    await harness.page.evaluate((map) => Object.entries(map).forEach(([key, value]) => localStorage.setItem(key, value)), makeStorageMap(payload));
  }
  await setDrafts(harness, drafts);
}

async function setJournal(harness, journal) {
  const raw = JSON.stringify(journal);
  if (harness.native) {
    harness.database.prepare("INSERT OR REPLACE INTO AppData (key, value) VALUES (?, ?)").run(NATIVE_JOURNAL_KEY, raw);
    await harness.page.evaluate((key) => localStorage.setItem(key, "1"), GATE_KEY);
  } else {
    await harness.page.evaluate(({ journalKey, gateKey, raw }) => {
      localStorage.setItem(journalKey, raw);
      localStorage.setItem(gateKey, "1");
    }, { journalKey: WEB_JOURNAL_KEY, gateKey: GATE_KEY, raw });
  }
}

async function readJournal(harness) {
  if (harness.native) {
    const row = harness.database.prepare("SELECT value FROM AppData WHERE key = ?").get(NATIVE_JOURNAL_KEY);
    return row?.value ?? null;
  }
  return harness.page.evaluate((key) => localStorage.getItem(key), WEB_JOURNAL_KEY);
}

async function clearJournalAndGate(harness) {
  if (harness.native) {
    harness.database.prepare("DELETE FROM AppData WHERE key IN (?, ?)").run(NATIVE_JOURNAL_KEY, GATE_KEY);
  }
  await harness.page.evaluate(({ journalKey, gateKey }) => {
    localStorage.removeItem(journalKey);
    localStorage.removeItem(gateKey);
  }, { journalKey: WEB_JOURNAL_KEY, gateKey: GATE_KEY });
}

function makeJournal(harness, snapshot, operation, phase) {
  const beforeBackup = formalBackup(snapshot.backupRaw);
  const journal = {
    version: 1,
    operation,
    phase,
    beforeBackup,
    beforeDrafts: clone(snapshot.drafts),
    beforeAppData: clone(snapshot.appDataRaw),
    beforeUndo: snapshot.undo,
  };
  if (!harness.native) journal.beforeWebStorage = clone(snapshot.primaryRaw);
  return journal;
}

async function setBadJournal(harness, raw) {
  if (harness.native) {
    harness.database.prepare("INSERT OR REPLACE INTO AppData (key, value) VALUES (?, ?)").run(NATIVE_JOURNAL_KEY, raw);
  } else {
    await harness.page.evaluate(({ key, gate, raw }) => { localStorage.setItem(key, raw); localStorage.setItem(gate, "1"); }, { key: WEB_JOURNAL_KEY, gate: GATE_KEY, raw });
  }
  await harness.page.evaluate((key) => localStorage.setItem(key, "1"), GATE_KEY);
}

async function installStorageFault(page, { setKey = null, removeKey = null } = {}) {
  await page.evaluate(({ setKey, removeKey }) => {
    const proto = Storage.prototype;
    if (!globalThis.__codexD5StorageOriginal) {
      const original = { setItem: proto.setItem, removeItem: proto.removeItem };
      globalThis.__codexD5StorageOriginal = original;
      proto.setItem = function codexD5SetItem(key, value) {
        const fault = globalThis.__codexD5StorageFault;
        if (fault?.setKey === key) {
          globalThis.__codexD5StorageFault = { ...fault, setKey: null };
          throw new Error(`codex D5 Web fault: setItem:${key}`);
        }
        return original.setItem.call(this, key, value);
      };
      proto.removeItem = function codexD5RemoveItem(key) {
        const fault = globalThis.__codexD5StorageFault;
        if (fault?.removeKey === key) {
          globalThis.__codexD5StorageFault = { ...fault, removeKey: null };
          throw new Error(`codex D5 Web fault: removeItem:${key}`);
        }
        return original.removeItem.call(this, key);
      };
    }
    globalThis.__codexD5StorageFault = { setKey, removeKey };
  }, { setKey, removeKey });
}

async function clearStorageFault(page) {
  await page.evaluate(() => { globalThis.__codexD5StorageFault = { setKey: null, removeKey: null }; });
}

async function assertBarrierBlocksWrites(harness) {
  const draft = clone(BASE_DRAFTS[0]);
  const draftWrite = await harness.page.evaluate(async (draft) => {
    try {
      const { writeEntryDraft } = await import("/src/entryDraft.ts");
      writeEntryDraft(localStorage, JSON.parse(draft.raw));
      return { ok: true };
    } catch (error) {
      return { ok: false, message: error instanceof Error ? error.message : String(error) };
    }
  }, draft);
  assertResultRejected(draftWrite, "恢复屏障阻止 writeEntryDraft");
  const storeWrite = await storeInvoke(harness.page, "setStoredAppData", ["codex-d5-recovery-write", "must-not-write"]);
  assertResultRejected(storeWrite, "恢复屏障阻止普通 Store 写入");
}

async function assertRecovery(harness, baseline, label) {
  const evidenceResult = await storeInvoke(harness.page, "getRecoveryEvidence");
  const rescueText = assertResultOk(evidenceResult, `${label}: getRecoveryEvidence`);
  assert.equal(typeof rescueText, "string", `${label}: rescue evidence is raw text`);
  assert.ok(rescueText.length > 0, `${label}: rescue evidence is not empty`);
  const recoverResult = await storeInvoke(harness.page, "recoverPendingRestore");
  assertResultOk(recoverResult, `${label}: recoverPendingRestore`);
  const after = await readSnapshot(harness);
  assertSnapshotEqual(after, baseline, `${label}: restored before snapshot`);
  assert.equal(await readJournal(harness), null, `${label}: journal removed after verified recovery`);
  const gate = await harness.page.evaluate((key) => localStorage.getItem(key), GATE_KEY);
  assert.equal(gate, null, `${label}: persistent gate removed after verified recovery`);
}

async function runBaselineCheck(browser, schema) {
  const database = new DatabaseSync(":memory:");
  database.exec(schema);
  database.exec("PRAGMA foreign_keys = ON");
  const harness = await createHarness(browser, false, null);
  try {
    const before = await seedBaseline(harness);
    const input = makePayload(6, BASE_DRAFTS, "最小 v6 草稿保留断言");
    const result = await storeInvoke(harness.page, "importBackup", [asJson(input)]);
    if (!result.ok) {
      evidence.baseline = {
        status: "failed-on-current-code",
        expected: "v6 import succeeds and preserves all pre-existing local drafts",
        observed: result.message,
        draftKeysBefore: before.drafts.map((item) => item.key),
        inputDraftKeys: input.drafts.map((item) => item.key),
      };
      return false;
    }
    const after = await readSnapshot(harness);
    assert.deepEqual(after.drafts, before.drafts, "v6 baseline assertion preserves local drafts");
    evidence.baseline = { status: "passed", draftCount: after.drafts.length };
    return true;
  } finally {
    await harness.context.close();
    database.close();
  }
}

async function runCase(name, branch, action) {
  try {
    const result = await action();
    evidence.cases.push({ name, branch, status: result === "not-applicable" ? "not-applicable" : "passed" });
  } catch (error) {
    const item = { name, branch, status: "failed", error: errorMessage(error) };
    evidence.cases.push(item);
    throw error;
  }
}

async function runCoreCases(harness, branch) {
  await runCase("v1-v5 preserve local drafts and expose sourceVersion/draftsPresence", branch, async () => {
    for (let version = 1; version <= 5; version++) {
      const before = await seedBaseline(harness);
      const payload = makePayload(version, undefined, `legacy-v${version}`);
      const preview = assertResultOk(await storeInvoke(harness.page, "previewBackup", [asJson(payload)]), `preview v${version}`);
      assert.equal(preview.sourceVersion, version, `v${version} sourceVersion`);
      assert.equal(preview.draftsPresence, "absent", `v${version} draftsPresence`);
      assert.equal(preview.draftCount, 0, `v${version} draftCount`);
      assert.equal(preview.localDraftCount, before.drafts.length, `v${version} localDraftCount`);
      assertResultOk(await storeInvoke(harness.page, "importBackup", [asJson(payload)]), `import v${version}`);
      const after = await readSnapshot(harness);
      assert.deepEqual(after.drafts, before.drafts, `v${version} retains every local draft raw byte`);
    }
  });

  await runCase("v6 round trip, preview counts, empty replacement and undo", branch, async () => {
    const before = await seedBaseline(harness);
    const payload = makePayload(6, TARGET_DRAFTS, "v6 正常导入");
    const preview = assertResultOk(await storeInvoke(harness.page, "previewBackup", [asJson(payload)]), "v6 preview");
    assert.equal(preview.sourceVersion, 6);
    assert.equal(preview.draftsPresence, "present");
    assert.equal(preview.draftCount, 3);
    assert.equal(preview.newDraftCount, 2);
    assert.equal(preview.editDraftCount, 1);
    assert.equal(preview.localDraftCount, before.drafts.length);
    assertResultOk(await storeInvoke(harness.page, "importBackup", [asJson(payload)]), "v6 import");
    const imported = await readSnapshot(harness);
    assert.deepEqual(imported.drafts, [...TARGET_DRAFTS].sort((a, b) => a.key.localeCompare(b.key)), "v6 restores legacy/new/edit draft raw bytes");
    assert.equal(JSON.parse(imported.backupRaw).version, 6, "normal export remains v6");
    assertBackupData(JSON.parse(imported.backupRaw), { ...payload, exportedAt: JSON.parse(imported.backupRaw).exportedAt }, "v6 formal fields round trip");

    await seedBaseline(harness);
    const empty = makePayload(6, [], "empty draft replacement");
    assertResultOk(await storeInvoke(harness.page, "importBackup", [asJson(empty)]), "v6 empty drafts import");
    assert.equal((await readDrafts(harness)).length, 0, "v6 empty array clears local drafts");
    assertResultOk(await storeInvoke(harness.page, "restoreImportUndo"), "undo restores empty-array import");
    const restored = await readSnapshot(harness);
    assertSnapshotEqual(restored, before, "empty-array undo restores original state");

    await seedBaseline(harness);
    const noCoverExport = JSON.parse(assertResultOk(await storeInvoke(harness.page, "exportBackup", [{ includeCovers: false }]), "export without covers"));
    assert.equal(noCoverExport.version, 6);
    assert.deepEqual(noCoverExport.covers, []);
    assert.equal(noCoverExport.drafts.length, BASE_DRAFTS.length);
    noCoverExport.drafts.forEach(({ raw }) => {
      const draft = JSON.parse(raw);
      assert.equal(draft.coverDataUrl, null, "coverless export clears draft cover data");
      assert.equal(draft.coverChanged, false, "coverless export clears draft coverChanged");
      const source = BASE_DRAFTS.map(item => JSON.parse(item.raw)).find(item => item.fields.title === draft.fields.title);
      assert.deepEqual(draft, { ...source, coverDataUrl: null, coverChanged: false }, "coverless export preserves every non-cover field");
    });
    const coverlessInput = makePayload(6, TARGET_DRAFTS, "skip cover import");
    coverlessInput.covers = [cover("album", "D5 合成专辑", null, "D5 模拟艺人", "data:image/png;base64,REVFUF9DT1ZFUl9UT0tFTg==")];
    const beforeCoverless = await readSnapshot(harness);
    assertResultOk(await storeInvoke(harness.page, "importBackup", [asJson(coverlessInput), { includeCovers: false }]), "skip cover import");
    const coverlessAfter = await readSnapshot(harness);
    assert.deepEqual(coverlessAfter.backup.covers, beforeCoverless.backup.covers, "skip cover import preserves current covers");
    coverlessAfter.drafts.forEach(({ key, raw }) => {
      const draft = JSON.parse(raw);
      assert.equal(draft.coverDataUrl, null, "skip cover import clears draft cover data");
      assert.equal(draft.coverChanged, false, "skip cover import clears draft coverChanged");
      assert.deepEqual(draft, { ...JSON.parse(TARGET_DRAFTS.find(item => item.key === key).raw), coverDataUrl: null, coverChanged: false }, "coverless import preserves every non-cover field");
    });
  });

  await runCase("invalid v6 fields, draft identities, duplicates, raw bytes and quota are atomic", branch, async () => {
    const invalids = [];
    const missing = makePayload(6, TARGET_DRAFTS, "missing drafts"); delete missing.drafts; invalids.push(["v6 missing drafts", missing]);
    invalids.push(["v6 drafts is not an array", { ...makePayload(6, []), drafts: {} }]);
    for (let version = 1; version <= 5; version++) invalids.push([`v${version} contradicts drafts field`, { ...makePayload(version), drafts: [] }]);
    invalids.push(["duplicate key", makePayload(6, [TARGET_DRAFTS[0], TARGET_DRAFTS[0]])]);
    invalids.push(["unknown key", makePayload(6, [{ ...TARGET_DRAFTS[0], key: `${DRAFT_PREFIX}unknown:d5` }])]);
    invalids.push(["empty key suffix", makePayload(6, [{ ...TARGET_DRAFTS[0], key: `${DRAFT_PREFIX}new:` }])]);
    invalids.push(["invalid raw", makePayload(6, [{ key: TARGET_DRAFTS[0].key, raw: "not-json" }])]);
    invalids.push(["key and content mismatch", makePayload(6, [{ ...TARGET_DRAFTS[0], key: `${DRAFT_PREFIX}edit:${BASE_ENTRIES[0].id}` }])]);
    const editDraftId = JSON.parse(TARGET_DRAFTS[2].raw); editDraftId.draftId = "must-be-null";
    invalids.push(["edit draftId must be null", makePayload(6, [{ key: TARGET_DRAFTS[2].key, raw: JSON.stringify(editDraftId) }])]);
    const overQuota = Array.from({ length: 11 }, (_, index) => makeDraft({ key: `${DRAFT_PREFIX}new:d5-over-${index}`, title: `超过配额 ${index}`, draftId: `d5-over-${index}` }));
    invalids.push(["more than ten new drafts", makePayload(6, overQuota)]);
    for (const [label, payload] of invalids) {
      const before = await seedBaseline(harness);
      assertResultRejected(await storeInvoke(harness.page, "importBackup", [asJson(payload)]), label);
      const after = await readSnapshot(harness);
      assertSnapshotEqual(after, before, `${label} leaves main data, drafts and undo unchanged`);
    }
    const externalJournal = makePayload(6, TARGET_DRAFTS, "external journal injection");
    externalJournal.appData[NATIVE_JOURNAL_KEY] = "external input must not install a restore journal";
    const before = await seedBaseline(harness);
    assertResultRejected(await storeInvoke(harness.page, "importBackup", [asJson(externalJournal)]), "external AppData restore journal injection");
    assertSnapshotEqual(await readSnapshot(harness), before, "external restore journal injection is atomic");
  });

  await runCase("edit-source conflicts remain recoverable raw drafts", branch, async () => {
    const before = await seedBaseline(harness);
    const missingSource = makeDraft({ key: `${DRAFT_PREFIX}edit:codex-d5-missing-source`, title: "源记录缺失冲突", mode: "edit", entryId: "codex-d5-missing-source", baseUpdatedAt: NOW, draftId: null });
    const staleSource = makeDraft({ key: `${DRAFT_PREFIX}edit:${BASE_ENTRIES[0].id}`, title: "源记录更新冲突", mode: "edit", entryId: BASE_ENTRIES[0].id, baseUpdatedAt: "2020-01-01T00:00:00.000Z", draftId: null });
    const payload = makePayload(6, [missingSource, staleSource], "conflict import");
    assertResultOk(await storeInvoke(harness.page, "previewBackup", [asJson(payload)]), "preview edit conflicts");
    assertResultOk(await storeInvoke(harness.page, "importBackup", [asJson(payload)]), "import edit conflicts");
    const after = await readSnapshot(harness);
    assert.deepEqual(after.drafts, [missingSource, staleSource].sort((a, b) => a.key.localeCompare(b.key)), "conflict raws stay available for rescue");
    assert.equal(after.backup.entries[0].content.endsWith("conflict import"), true);
    assert.equal(before.drafts.length, 3);
  });

  await runCase("corrupt undo preview remains read-only and keeps its raw slot", branch, async () => {
    await seedBaseline(harness);
    const corruptUndo = "{\"version\":6,\"drafts\":\"broken\"}";
    if (harness.native) harness.database.prepare("INSERT OR REPLACE INTO UndoBackup (id, value) VALUES (1, ?)").run(corruptUndo);
    else await harness.page.evaluate(({ key, raw }) => localStorage.setItem(key, raw), { key: IMPORT_UNDO_KEY, raw: corruptUndo });
    assertResultRejected(await storeInvoke(harness.page, "previewImportUndo"), "corrupt undo preview");
    assert.equal(await readUndo(harness), corruptUndo, "corrupt undo raw is not silently removed");
    await clearUndo(harness);
  });

  await runCase("damaged drafts and device health survive import and undo exactly", branch, async () => {
    await seedBaseline(harness);
    await storeInvoke(harness.page, "setStoredAppData", ["backup-health:v1", "codex device-only original bytes"]);
    await setDrafts(harness, [...BASE_DRAFTS, { key: `${DRAFT_PREFIX}new:damaged`, raw: "{damaged raw\n🎧" }]);
    const before = await readSnapshot(harness);
    assert.equal(before.backup, null, "ordinary export refuses damaged drafts");
    assertResultOk(await storeInvoke(harness.page, "importBackup", [asJson(makePayload(6, []))]), "replace damaged drafts via validated import");
    assert.equal(assertResultOk(await storeInvoke(harness.page, "getStoredAppData", ["backup-health:v1"]), "health"), "codex device-only original bytes");
    assertResultOk(await storeInvoke(harness.page, "restoreImportUndo"), "undo restores damaged raw");
    assertSnapshotEqual(await readSnapshot(harness), before, "damaged originals and health exact restore");
  });
}

async function runRecoveryCases(harness, branch) {
  await runCase("prepared/data-written/rolling-back recovery restores exact before snapshots", branch, async () => {
    for (const phase of ["prepared", "data-written", "rolling-back"]) {
      const baseline = await seedBaseline(harness);
      const target = makePayload(6, TARGET_DRAFTS, `recovery ${phase}`);
      await applyDirectTarget(harness, target, TARGET_DRAFTS);
      await setJournal(harness, makeJournal(harness, baseline, "import", phase));
      await assertRecovery(harness, baseline, `${branch} ${phase}`);
    }
  });

  await runCase("unknown or malformed journal remains read-only with rescue evidence", branch, async () => {
    const baseline = await seedBaseline(harness);
    for (const raw of ["not-json", JSON.stringify({ version: 99, operation: "import" })]) {
      await setBadJournal(harness, raw);
      const evidenceResult = await storeInvoke(harness.page, "getRecoveryEvidence");
      const rescueText = assertResultOk(evidenceResult, "bad journal rescue evidence");
      assert.equal(typeof rescueText, "string");
      assert.equal(JSON.parse(rescueText).journal, raw, "rescue evidence contains the exact original bad log text");
      assertResultRejected(await storeInvoke(harness.page, "recoverPendingRestore"), "bad journal recovery refusal");
      assert.equal(await readJournal(harness), raw, "bad journal is retained");
      await assertBarrierBlocksWrites(harness);
      assertSnapshotEqual(await readSnapshot(harness), baseline, "bad journal keeps data unchanged");
      await clearJournalAndGate(harness);
    }
  });

  await runCase("recovery write failure retains journal and barrier, then retries", branch, async () => {
    const baseline = await seedBaseline(harness);
    const target = makePayload(6, TARGET_DRAFTS, "recovery temporary failure");
    await applyDirectTarget(harness, target, TARGET_DRAFTS);
    await setJournal(harness, makeJournal(harness, baseline, "import", "data-written"));
    if (harness.native) {
      await harness.page.evaluate(() => globalThis.codexSQLiteSetFailure("executeSet", null));
    } else {
      await installStorageFault(harness.page, { setKey: MAIN_KEYS[0] });
    }
    assertResultRejected(await storeInvoke(harness.page, "recoverPendingRestore"), `${branch} injected recovery failure`);
    assert.ok(await readJournal(harness), "recovery failure retains journal");
    await assertBarrierBlocksWrites(harness);
    if (harness.native) await harness.page.evaluate(() => globalThis.codexSQLiteClearFailure());
    else await clearStorageFault(harness.page);
    await assertRecovery(harness, baseline, `${branch} retry after temporary failure`);
  });

  await runCase("ordinary writes are blocked by the recovery barrier and resume after recovery", branch, async () => {
    const baseline = await seedBaseline(harness);
    await setJournal(harness, makeJournal(harness, baseline, "import", "prepared"));
    await assertBarrierBlocksWrites(harness);
    await clearJournalAndGate(harness);
    const writeResult = await storeInvoke(harness.page, "setStoredAppData", ["codex-d5-recovery-write", "after-recovery"]);
    assertResultOk(writeResult, "ordinary Store write resumes after gate removal");
    const after = await readSnapshot(harness);
    assert.equal(after.appDataRaw["codex-d5-recovery-write"], "after-recovery");
  });

  await runCase("every Web persistent write point rejects without a half-import", branch, async () => {
    if (harness.native) return "not-applicable";
    const target = makePayload(6, TARGET_DRAFTS, "Web write-point fault");
    const keys = [...MAIN_KEYS, IMPORT_UNDO_KEY, WEB_JOURNAL_KEY, GATE_KEY, ...TARGET_DRAFTS.map((item) => item.key)];
    for (const key of keys) {
      const baseline = await seedBaseline(harness);
      await installStorageFault(harness.page, { setKey: key });
      const result = await storeInvoke(harness.page, "importBackup", [asJson(target)]);
      assertResultRejected(result, `Web write fault ${key}`);
      await clearStorageFault(harness.page);
      const pending = await readJournal(harness);
      if (pending) {
        await assertRecovery(harness, baseline, `Web write fault ${key} recovery`);
      } else {
        assertSnapshotEqual(await readSnapshot(harness), baseline, `Web write fault ${key} immediate rollback`);
      }
      evidence.failurePoints.push({ branch: "web", point: key, status: "checked" });
    }
  });

  await runCase("SQLite executeSet and UndoBackup interruptions preserve transactions", branch, async () => {
    if (!harness.native) return "not-applicable";
    const target = makePayload(6, TARGET_DRAFTS, "SQLite write-point fault");
    for (const [method, statement] of [["executeSet", null], ["executeSet-item", "UndoBackup"], ["run", "AppData"]]) {
      const baseline = await seedBaseline(harness);
      await harness.page.evaluate(({ method, statement }) => globalThis.codexSQLiteSetFailure(method, statement), { method, statement });
      const result = await storeInvoke(harness.page, "importBackup", [asJson(target)]);
      assertResultRejected(result, `SQLite ${method}:${statement ?? "executeSet"}`);
      await harness.page.evaluate(() => globalThis.codexSQLiteClearFailure());
      const pending = await readJournal(harness);
      if (pending) await assertRecovery(harness, baseline, `SQLite ${method}:${statement ?? "executeSet"} recovery`);
      else assertSnapshotEqual(await readSnapshot(harness), baseline, `SQLite ${method}:${statement ?? "executeSet"} immediate rollback`);
      evidence.failurePoints.push({ branch: "sqlite-simulated", point: `${method}:${statement ?? "executeSet"}`, status: "checked", engine: "Node SQLite executeSet bridge" });
    }
  });

  await runCase("undo interruption rolls back to the pre-undo state and retains journal", branch, async () => {
    const baseline = await seedBaseline(harness);
    const target = makePayload(6, TARGET_DRAFTS, "undo interruption target");
    assertResultOk(await storeInvoke(harness.page, "importBackup", [asJson(target)]), "prepare successful import for undo fault");
    const beforeUndo = await readSnapshot(harness);
    if (harness.native) {
      await harness.page.evaluate(() => globalThis.codexSQLiteSetFailure("executeSet-item", "DELETE FROM UndoBackup"));
    } else {
      await installStorageFault(harness.page, { removeKey: IMPORT_UNDO_KEY });
    }
    assertResultRejected(await storeInvoke(harness.page, "restoreImportUndo"), "interrupted undo");
    assert.ok(await harness.page.evaluate(key => localStorage.getItem(key), GATE_KEY), "interrupted undo retains recovery barrier");
    await assertBarrierBlocksWrites(harness);
    if (harness.native) await harness.page.evaluate(() => globalThis.codexSQLiteClearFailure());
    else await clearStorageFault(harness.page);
    await assertRecovery(harness, beforeUndo, "interrupted undo recovery restores pre-undo state");
    assert.notDeepEqual((await readSnapshot(harness)).drafts, baseline.drafts, "pre-undo state remains imported target, not original baseline");
  });
}

async function runWebWindowCase(harness) {
  await runCase("Web Locks reject a second mounted window, then allow retry after close", "web", async () => {
    const baseline = await seedBaseline(harness);
    const second = await harness.context.newPage();
    try {
      await second.route("**/*", (route) => {
        try {
          if (new URL(route.request().url()).origin === origin) return route.continue();
        } catch {}
        return route.abort();
      });
      await second.goto(`${origin}/#/privacy`);
      await configureStore(second, false);
      await second.waitForFunction(async name => {
        const locks = await navigator.locks.query();
        return locks.held.filter(lock => lock.name === name && lock.mode === "shared").length === 2;
      }, STORAGE_LOCK_NAME);
      const target = makePayload(6, TARGET_DRAFTS, "second-window retry");
      const blocked = await storeInvoke(harness.page, "importBackup", [asJson(target)]);
      assertResultRejected(blocked, "second mounted Web window import refusal");
      assertSnapshotEqual(await readSnapshot(harness), baseline, "second-window refusal has zero writes");
      await harness.page.goto(`${origin}/#/backup`);
      await harness.page.getByLabel("粘贴备份 JSON").fill(asJson(target));
      await harness.page.getByText("备份内容（v6）", { exact: false }).waitFor();
      await harness.page.getByRole("button", { name: "预演恢复并查看差异" }).click();
      await harness.page.getByLabel("恢复差异报告").waitFor();
      harness.page.once("dialog", dialog => { void dialog.accept(); });
      await harness.page.getByRole("button", { name: "导入并覆盖当前数据" }).click();
      await harness.page.getByText(/其他窗口仍打开或保存尚未结束/).waitFor();
      assertSnapshotEqual(await readSnapshot(harness), baseline, "second-window UI refusal has zero writes and shows cause");
    } finally {
      await second.close();
    }
    await harness.page.waitForFunction(async () => {
      const locks = await navigator.locks.query();
      return locks.held.length === 1 && locks.pending.length === 0;
    });
    let retry;
    // ponytail: 20 short retries cover transient shared reads after window close; raise only if startup adds longer storage work.
    for (let attempt = 0; attempt < 20; attempt++) {
      retry = await storeInvoke(harness.page, "importBackup", [asJson(makePayload(6, TARGET_DRAFTS, "after second window closes"))]);
      if (retry.ok) break;
      assert.match(retry.message, /其他窗口仍打开或保存尚未结束/, "only an in-flight local save may delay the retry");
      await harness.page.waitForTimeout(50);
    }
    assertResultOk(retry, "retry after closing second window");
    assert.deepEqual((await readSnapshot(harness)).drafts, [...TARGET_DRAFTS].sort((a, b) => a.key.localeCompare(b.key)), "retry keeps imported drafts");
  });
}

async function runWebUiCancelCase(harness) {
  await runCase("backup UI cancel, import, remount and undo preserve feedback and data", "web", async () => {
    const before = await seedBaseline(harness);
    await harness.page.goto(`${origin}/#/backup`);
    const payload = asJson(makePayload(6, TARGET_DRAFTS, "backup UI import"));
    await harness.page.getByLabel("粘贴备份 JSON").fill(payload);
    await harness.page.getByText("备份内容（v6）", { exact: false }).waitFor();
    await harness.page.getByRole("button", { name: "预演恢复并查看差异" }).click();
    await harness.page.getByLabel("恢复差异报告").waitFor();
    const confirmationReady = new Promise(resolve => harness.page.once("dialog", async dialog => {
      const message = dialog.message();
      await dialog.dismiss();
      resolve(message);
    }));
    await harness.page.getByRole("button", { name: "导入并覆盖当前数据" }).click();
    assert.match(await confirmationReady, /导入会覆盖本机数据/);
    assertSnapshotEqual(await readSnapshot(harness), before, "cancelled UI import has zero writes");
    assert.equal(await harness.page.evaluate(key => localStorage.getItem(key), GATE_KEY), null, "cancelled UI import leaves no barrier");
    harness.page.once("dialog", dialog => { void dialog.accept(); });
    await harness.page.getByRole("button", { name: "导入并覆盖当前数据" }).click();
    await harness.page.getByText(/^导入完成：/).waitFor();
    assert.deepEqual(await readDrafts(harness), [...TARGET_DRAFTS].sort((a, b) => a.key.localeCompare(b.key)));
    harness.page.once("dialog", dialog => { void dialog.accept(); });
    await harness.page.getByRole("button", { name: "撤销上次导入" }).click();
    await harness.page.getByText("已撤销上次导入", { exact: true }).waitFor();
    assertSnapshotEqual(await readSnapshot(harness), before, "UI undo restores exact baseline after App remount");
  });
}

async function runBranch(browser, schema, native) {
  const database = new DatabaseSync(":memory:");
  database.exec(schema);
  database.exec("PRAGMA foreign_keys = ON");
  const branch = native ? "sqlite-simulated" : "web";
  const harness = await createHarness(browser, native, database);
  const summary = { branch, engine: native ? "Node SQLite executeSet bridge; not a real Capacitor plugin" : "Chrome localStorage", status: "running" };
  evidence.branches.push(summary);
  try {
    await runCoreCases(harness, branch);
    await runRecoveryCases(harness, branch);
    if (!native) {
      await runWebUiCancelCase(harness);
      await runWebWindowCase(harness);
      await runStaleWorkflows(harness);
      await runWebCrashCases(harness);
    }
    summary.status = "passed";
  } finally {
    await harness.context.close();
    database.close();
  }
}

async function runStaleWorkflows(harness) {
  await runCase("old Home continuation and form autosave cannot write after restore", "web", async () => {
    await seedBaseline(harness);
    await harness.page.evaluate(() => {
      const original = Promise.all.bind(Promise);
      window.codexHomeReleases = [];
      Promise.all = values => {
        const items = Array.from(values);
        const result = original(items);
        return items.length === 5 ? result.then(value => new Promise(resolve => window.codexHomeReleases.push(() => resolve(value)))) : result;
      };
      window.codexRestorePromiseAll = () => { Promise.all = original; };
      location.hash = "/";
    });
    await harness.page.waitForFunction(() => window.codexHomeReleases.length > 0);
    const target = makePayload(6, TARGET_DRAFTS, "stale Home");
    const today = await harness.page.evaluate(() => {
      const date = new Date();
      const pad = value => String(value).padStart(2, "0");
      return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
    });
    target.appData["daily-resurfacing"] = JSON.stringify({ date: today, entryId: null, dismissed: true });
    assertResultOk(await storeInvoke(harness.page, "importBackup", [asJson(target)]), "restore while old Home awaits result");
    await harness.page.evaluate(() => { window.codexRestorePromiseAll(); window.codexHomeReleases.forEach(release => release()); });
    await harness.page.waitForTimeout(100);
    assert.equal(assertResultOk(await storeInvoke(harness.page, "getStoredAppData", ["daily-resurfacing"]), "restored resurfacing"), target.appData["daily-resurfacing"]);
    await harness.page.evaluate(() => { location.hash = "/new?draft=d5-import-1"; });
    await harness.page.locator(".writing-form").waitFor();
    await harness.page.clock.install();
    await harness.page.locator('.writing-form textarea[name="content"]').fill("obsolete pending autosave must never reappear");
    const empty = makePayload(6, [], "replace while old form mounted");
    assertResultOk(await storeInvoke(harness.page, "importBackup", [asJson(empty)]), "replace mounted form drafts");
    await harness.page.clock.runFor(500);
    await harness.page.evaluate(() => window.dispatchEvent(new Event("pagehide")));
    assert.deepEqual(await readDrafts(harness), [], "old form cannot resurrect replaced drafts");
    await harness.page.clock.resume();
    await harness.page.goto(`${origin}/#/privacy`);
    await harness.page.locator(".app-header").waitFor();
  });

  await runCase("in-flight weather cache holds shared lock through its final write", "web", async () => {
    await seedBaseline(harness);
    const city = { name: "合成城市", admin1: null, country: "CN", countryCode: "CN", latitude: 23, longitude: 113, timezone: "Asia/Shanghai" };
    assertResultOk(await storeInvoke(harness.page, "setWeatherLocation", [city]), "set synthetic weather city");
    let release;
    const pending = new Promise(resolve => { release = resolve; });
    await harness.page.route("https://archive-api.open-meteo.com/**", async route => {
      await pending;
      await route.fulfill({ json: { daily: { time: ["2026-09-01"], weather_code: [0], temperature_2m_max: [30], temperature_2m_min: [20], precipitation_sum: [0] } } });
    });
    const requested = harness.page.waitForRequest("https://archive-api.open-meteo.com/**");
    const weather = storeInvoke(harness.page, "getWeatherForEntries", [[BASE_ENTRIES[0]]]);
    await requested;
    const before = await readSnapshot(harness);
    assertResultRejected(await storeInvoke(harness.page, "importBackup", [asJson(makePayload(6, []))]), "in-flight weather blocks restore");
    assertSnapshotEqual(await readSnapshot(harness), before, "weather refusal changes no data");
    release();
    assertResultOk(await weather, "weather finishes");
    await harness.page.waitForFunction(async () => (await navigator.locks.query()).held.length === 1);
    assertResultOk(await storeInvoke(harness.page, "importBackup", [asJson(makePayload(6, []))]), "restore after weather completes");
    const after = await readSnapshot(harness);
    assert.equal(Object.keys(after.appDataRaw).some(key => key.startsWith("listening-weather:")), false, "old weather cache does not survive replacement");
    await harness.page.unroute("https://archive-api.open-meteo.com/**");
  });
}

async function runWebCrashCases(harness) {
  await runCase("restart recovers every Web write boundary with all rollback writes unavailable", "web", async () => {
    const target = makePayload(6, TARGET_DRAFTS, "hard interruption");
    async function instrument(cut) {
      await harness.page.evaluate(({ cut, mainKeys, undoKey, journalKey, gateKey, draftPrefix }) => {
        const prototype = Storage.prototype;
        const original = { setItem: prototype.setItem, removeItem: prototype.removeItem };
        window.codexCrashTrace = [];
        window.codexCrashStopped = false;
        for (const method of ["setItem", "removeItem"]) {
          prototype[method] = function(...args) {
            if (window.codexCrashStopped) throw new Error("codex persistent storage unavailable");
            original[method].apply(this, args);
            if (!mainKeys.includes(args[0]) && args[0] !== undoKey && args[0] !== journalKey
              && args[0] !== gateKey && !args[0].startsWith(draftPrefix)) return;
            window.codexCrashTrace.push({ method, key: args[0] });
            if (window.codexCrashTrace.length === cut) {
              window.codexCrashStopped = true;
              throw new Error("codex process interrupted after persistent write");
            }
          };
        }
      }, { cut, mainKeys: MAIN_KEYS, undoKey: IMPORT_UNDO_KEY, journalKey: WEB_JOURNAL_KEY, gateKey: GATE_KEY, draftPrefix: DRAFT_PREFIX });
    }
    await seedBaseline(harness);
    await instrument(-1);
    assertResultOk(await storeInvoke(harness.page, "importBackup", [asJson(target)]), "record successful write boundaries");
    const trace = await harness.page.evaluate(() => window.codexCrashTrace);
    for (let cut = 1; cut <= trace.length; cut++) {
      await harness.page.reload();
      await harness.page.locator(".app-header").waitFor();
      await configureStore(harness.page, false);
      const before = await seedBaseline(harness);
      await instrument(cut);
      assertResultRejected(await storeInvoke(harness.page, "importBackup", [asJson(target)]), `hard interruption ${cut}`);
      await assertBarrierBlocksWrites(harness);
      const journalCleared = trace.slice(0, cut).some(item => item.method === "removeItem" && item.key === WEB_JOURNAL_KEY);
      await harness.page.reload();
      await harness.page.locator(".app-header").waitFor();
      const after = await readSnapshot(harness);
      if (journalCleared) {
        assertBackupData(after.backup, target, "verified completed import survives final marker removal failure");
        assert.ok(after.undo, "completed import retains undo");
      } else assertSnapshotEqual(after, before, `startup rollback after persistent write ${cut}`);
      assert.equal(await readJournal(harness), null);
      evidence.failurePoints.push({ branch: "web-restart", point: cut, ...trace[cut - 1], status: "checked" });
    }
  });
}

let browser;
let failure = null;
try {
  const source = await readFile("mobile/src/store.ts", "utf8");
  const schema = source.match(/const schemaSql = `([\s\S]*?)`;/)?.[1];
  assert.ok(schema, "store.ts schemaSql is required for the simulated SQLite bridge");
  browser = await chromium.launch({ headless: true, channel: "chrome" });
  const baselinePassed = await runBaselineCheck(browser, schema);
  if (!baselinePassed) {
    evidence.note = "Current store is intentionally pre-T06; the minimum v6 draft-preservation check failed and stopped the full suite. Run again after the T06 store/entryDraft integration.";
  } else if (baselineOnly) {
    evidence.note = "--baseline-only requested; full D5 matrix was not run.";
    evidence.passed = true;
  } else {
    await runBranch(browser, schema, false);
    await runBranch(browser, schema, true);
    evidence.passed = true;
  }
} catch (error) {
  failure = error;
  evidence.error = errorMessage(error);
} finally {
  await browser?.close();
  await ownedServer?.close();
  await mkdir(output, { recursive: true });
  await writeFile(join(output, "codex_draft_backup_results.json"), JSON.stringify(evidence, null, 2), "utf8");
}

console.log(JSON.stringify(evidence));
if (failure || evidence.baseline?.status === "failed-on-current-code" || (!evidence.passed && !baselineOnly)) process.exitCode = 1;
