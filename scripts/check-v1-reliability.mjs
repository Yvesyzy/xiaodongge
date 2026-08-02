import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { Module } from "node:module";
import ts from "typescript";

const require = Module.createRequire(import.meta.url);

function loadModule(path, localModules = {}) {
  const source = readFileSync(new URL(path, import.meta.url), "utf8");
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  });
  const mod = { exports: {} };
  const localRequire = (id) => localModules[id] ?? require(id);
  new Function("exports", "require", "module", outputText)(mod.exports, localRequire, mod);
  return mod.exports;
}

const entries = [
  {
    id: "newer-year",
    type: "song",
    title: "Older creation",
    year: 2026,
    month: 7,
    albumName: "Album",
    songName: "Song",
    artistName: "Artist",
    content: "older",
    tags: [],
    moods: [],
    rating: null,
    listenedAt: null,
    createdAt: "2025-01-01T00:00:00.000Z",
    updatedAt: "2025-01-01T00:00:00.000Z",
  },
  {
    id: "older-year",
    type: "song",
    title: "Newer creation",
    year: 2025,
    month: 1,
    albumName: "Album",
    songName: "Song",
    artistName: "Artist",
    content: "newer",
    tags: [],
    moods: [],
    rating: null,
    listenedAt: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  },
];

const stats = loadModule("../src/lib/stats.ts", {
  "./prisma": { prisma: { reviewEntry: { findMany: async () => entries } } },
  "./entry": { entrySearchText: () => "", serializeEntry: (entry) => entry },
  "./format": { excerpt: (value) => value },
});

assert.equal((await stats.getAlbumAggregates())[0].lastRecordedAt, "2026-01-01T00:00:00.000Z");
assert.equal((await stats.getSongAggregates())[0].lastRecordedAt, "2026-01-01T00:00:00.000Z");

let createdConnections = 0;
let metadataMigrations = 0;
const ratingMigrations = new Map();
let summaryMigrations = 0;
const db = {
  isDBOpen: async () => ({ result: false }),
  open: async () => undefined,
  execute: async () => undefined,
  query: async (statement) => statement.includes("table_info") ? { values: [{ name: "id" }] } : { values: [] },
  run: async (statement) => {
    if (statement.includes("ADD COLUMN musicMetadata")) metadataMigrations += 1;
    const ratingColumn = statement.match(/ADD COLUMN (ratingProduction|ratingSongwriting|ratingOriginality|ratingResonance|compositeRatingLocked)/)?.[1];
    if (ratingColumn) ratingMigrations.set(ratingColumn, (ratingMigrations.get(ratingColumn) ?? 0) + 1);
    if (statement.includes("ALTER TABLE YearlySummary ADD COLUMN")) summaryMigrations += 1;
  },
};
const musicMetadata = loadModule("../mobile/src/musicMetadata.ts");
const format = loadModule("../mobile/src/format.ts");
const resurfacing = loadModule("../mobile/src/resurfacing.ts", { "./format": format });
const storageSafety = loadModule("../mobile/src/storageSafety.ts");
const listeningAnalysis = loadModule("../shared/listeningAnalysis.ts");
const listeningContext = loadModule("../shared/listeningContext.ts");
const listeningYearbook = loadModule("../mobile/src/listeningYearbook.ts", {
  "../../shared/listeningAnalysis": listeningAnalysis,
  "../../shared/listeningContext": listeningContext,
  "./format": format,
  "./types": {},
});
const storeModule = loadModule("../mobile/src/store.ts", {
  "@capacitor/core": { Capacitor: { isNativePlatform: () => true } },
  "@capacitor-community/sqlite": {
    CapacitorSQLite: {},
    SQLiteConnection: class {
      async isConnection() { return { result: false }; }
      async createConnection() { createdConnections += 1; return db; }
      async retrieveConnection() { return db; }
    },
  },
  "../../shared/visualizations": { buildAbstractMusicMap: () => ({}), buildEmotionUniverse: () => ({}), buildVisualizationOptions: () => ({}) },
  "../../shared/listeningContext": listeningContext,
  "./format": format,
  "./exportFormats": { formatEntriesCsv: () => "", formatEntriesTxt: () => "" },
  "./listeningYearbook": listeningYearbook,
  "./musicMetadata": musicMetadata,
  "./resurfacing": resurfacing,
  "./storageSafety": storageSafety,
  "./types": { ENTRY_TYPES: ["year", "month", "album", "song"] },
});

await Promise.all([storeModule.store.init(), storeModule.store.init()]);
assert.equal(createdConnections, 1);
assert.equal(metadataMigrations, 1);
for (const column of ["ratingProduction", "ratingSongwriting", "ratingOriginality", "ratingResonance", "compositeRatingLocked"]) {
  assert.equal(ratingMigrations.get(column), 1, `${column} 应完成一次原生迁移`);
}
assert.equal(summaryMigrations, 3);

const backupEntry = {
  id: "entry-1",
  type: "song",
  title: "稻香随记",
  year: 2026,
  month: 7,
  albumName: "魔杰座",
  songName: "稻香",
  artistName: "周杰伦",
  content: "正文",
  tags: [],
  moods: [],
  rating: null,
  listenedAt: null,
  createdAt: "2026-07-29T10:00:00.000Z",
  updatedAt: "2026-07-29T10:00:00.000Z",
};
const backupBase = { exportedAt: "2026-07-29T10:00:00.000Z", summaries: [], covers: [] };
assert.equal(storeModule.store.previewBackup(JSON.stringify({ ...backupBase, version: 1, entries: [backupEntry] })).entryCount, 1);
assert.equal(storeModule.store.previewBackup(JSON.stringify({ ...backupBase, version: 2, entries: [{ ...backupEntry, musicMetadata: { releaseYear: 2008 } }] })).entryCount, 1);
assert.deepEqual(storeModule.store.previewBackup(JSON.stringify({ ...backupBase, version: 3, entries: [{ ...backupEntry, musicMetadata: null }], monthlySummaries: [], appData: {} })), { exportedAt: backupBase.exportedAt, entryCount: 1, summaryCount: 0, monthlySummaryCount: 0, coverCount: 0, listeningMomentCount: 0 });
assert.throws(
  () => storeModule.store.previewBackup(JSON.stringify({ ...backupBase, version: 2, entries: [backupEntry] })),
  /musicMetadata 缺失/,
);

const storeSource = readFileSync(new URL("../mobile/src/store.ts", import.meta.url), "utf8");
const createRouteSource = readFileSync(new URL("../src/app/api/entries/route.ts", import.meta.url), "utf8");
const entryRouteSource = readFileSync(new URL("../src/app/api/entries/[id]/route.ts", import.meta.url), "utf8");
const buildScriptSource = readFileSync(new URL("./build-android-debug.ps1", import.meta.url), "utf8");

assert.match(storeSource, /markGeneratedSummariesStale\(\[entry\]\)/);
assert.match(storeSource, /markGeneratedSummariesStale\(\[old, entry\]\)/);
assert.match(storeSource, /markGeneratedSummariesStale\(\[existing\]\)/);
assert.match(storeSource, /ALTER TABLE ReviewEntry ADD COLUMN musicMetadata TEXT/);
assert.match(storeSource, /const dim of \["ratingProduction", "ratingSongwriting", "ratingOriginality", "ratingResonance"\]/);
assert.match(storeSource, /ADD COLUMN compositeRatingLocked INTEGER NOT NULL DEFAULT 0/);
assert.match(storeSource, /version: 5/);
assert.match(createRouteSource, /invalidateYearlySummaries/);
assert.match(entryRouteSource, /invalidateYearlySummaries/);
assert.match(buildScriptSource, /\$env:ANDROID_SDK_ROOT/);
assert.match(buildScriptSource, /\$env:ANDROID_HOME/);
assert.match(buildScriptSource, /\$env:JAVA_HOME/);
assert.equal((buildScriptSource.match(/\$LASTEXITCODE -ne 0/g) ?? []).length, 3);

console.log("reliability check passed");
