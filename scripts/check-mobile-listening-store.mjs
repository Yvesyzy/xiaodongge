import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { Module } from "node:module";
import ts from "typescript";

const require = Module.createRequire(import.meta.url);
function load(path, localModules = {}) {
  const source = readFileSync(new URL(path, import.meta.url), "utf8");
  const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } });
  const mod = { exports: {} };
  new Function("exports", "require", "module", outputText)(mod.exports, (id) => localModules[id] ?? require(id), mod);
  return mod.exports;
}

const storage = new Map();
globalThis.localStorage = { getItem: (key) => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, String(value)), removeItem: (key) => storage.delete(key), clear: () => storage.clear() };

const analysis = load("../shared/listeningAnalysis.ts");
const context = load("../shared/listeningContext.ts");
const format = load("../mobile/src/format.ts");
const yearbook = load("../mobile/src/listeningYearbook.ts", { "../../shared/listeningAnalysis": analysis, "../../shared/listeningContext": context, "./format": format, "./types": {} });
const musicMetadata = load("../mobile/src/musicMetadata.ts");
const storeModule = load("../mobile/src/store.ts", {
  "@capacitor/core": { Capacitor: { isNativePlatform: () => false } },
  "@capacitor-community/sqlite": { CapacitorSQLite: {}, SQLiteConnection: class {} },
  "../../shared/visualizations": { buildAbstractMusicMap: () => ({}), buildVisualizationOptions: () => ({}) },
  "../../shared/listeningContext": context,
  "./format": format,
  "./exportFormats": { formatEntriesCsv: () => "", formatEntriesTxt: () => "" },
  "./listeningYearbook": yearbook,
  "./musicMetadata": musicMetadata,
  "./types": { ENTRY_TYPES: ["year", "month", "album", "song"] },
});

const { store } = storeModule;
const input = {
  type: "song",
  title: "三月乐评",
  year: 2026,
  month: 3,
  albumName: "春日",
  songName: "雨后",
  artistName: "Yves",
  musicMetadata: null,
  content: "人声很温柔，旋律安静。",
  tags: ["Dream Pop"],
  moods: ["温柔"],
  rating: 9,
  ratingModifier: null,
  ratingProduction: 8.5,
  ratingSongwriting: 9,
  ratingOriginality: 7.5,
  ratingResonance: 9.5,
  firstListenedAt: null,
  listenedAt: "2026-03-08T00:00:00.000Z",
};
const created = await store.createEntry(input);
assert.equal(created.ratingProduction, 8.5, "ratingProduction 应持久化");
assert.equal(created.ratingSongwriting, 9, "ratingSongwriting 应持久化");
assert.equal(created.ratingOriginality, 7.5, "ratingOriginality 应持久化");
assert.equal(created.ratingResonance, 9.5, "ratingResonance 应持久化");
const day = await store.getDayListeningSnapshot("2026-03-08");
assert.equal(day.entryCount, 1);
assert.equal(day.day.kind, "ordinary_holiday");

const monthly = await store.generateMonthlySummary(2026, 3);
assert.equal(monthly.themeId, "botanical-sheet");
assert.ok(monthly.analysisJson.includes('"scope":"month"'));
const annual = await store.generateSummary(2026);
assert.ok(annual.analysisJson.includes('"scope":"year"'));
assert.equal(annual.sourceEntryCount, 1);

await store.updateEntry(created.id, { ...input, content: "人声很克制，旋律清澈。" });
const updated = await store.getEntry(created.id);
assert.equal(updated.ratingProduction, 8.5, "updateEntry 后 ratingProduction 应保留");
assert.equal(updated.ratingResonance, 9.5, "updateEntry 后 ratingResonance 应保留");
assert.equal((await store.getMonthlySummary(2026, 3)).sourceFingerprint, null);
assert.equal((await store.getSummary(2026)).sourceFingerprint, null);
assert.ok((await store.getSummary(2026)).content.includes("私人听感标本册"));

await store.setSemanticOverride({ layer: "feeling", term: "克制", action: "move", targetLayer: "expression" });
assert.equal((await store.getSummary(2026)).sourceFingerprint, null);
const correctedMonthly = yearbook.parseMonthlyListeningSnapshot((await store.generateMonthlySummary(2026, 3)).analysisJson);
assert.equal(correctedMonthly.analysis.feelings.some((item) => item.name === "克制"), false);
assert.equal(correctedMonthly.analysis.expressions.some((item) => item.name === "克制"), true);
assert.equal((await store.getSemanticOverrides()).length, 1);

await store.setWeatherLocation({ name: "广州", admin1: "广东", country: "中国", countryCode: "CN", latitude: 23.13, longitude: 113.26, timezone: "Asia/Shanghai" });
assert.equal((await store.getWeatherLocation()).name, "广州");
let weatherFetchCount = 0;
globalThis.fetch = async (url) => {
  weatherFetchCount += 1;
  assert.ok(String(url).includes("start_date=2026-03-08"));
  assert.ok(String(url).includes("end_date=2026-03-08"));
  return new Response(JSON.stringify({ daily: { time: ["2026-03-08"], weather_code: [61], temperature_2m_max: [19.2], temperature_2m_min: [12.4], precipitation_sum: [4.1], snowfall_sum: [0] } }), { status: 200 });
};
const weatherMonthly = yearbook.parseMonthlyListeningSnapshot((await store.generateMonthlySummary(2026, 3)).analysisJson);
assert.equal(weatherFetchCount, 1);
assert.equal(weatherMonthly.context.weather[0].category, "rain");
const backupWithWeather = JSON.parse(await store.exportBackup());
assert.ok(Object.keys(backupWithWeather.appData).some((key) => key.startsWith("listening-weather:")));
await store.setWeatherLocation(null);
const backup = JSON.parse(await store.exportBackup());
assert.equal(backup.version, 5);
assert.equal(backup.entries.length, 1);
assert.equal(backup.monthlySummaries.length, 1);
assert.equal(JSON.parse(backup.appData["listening-semantic-overrides"]).length, 1);
assert.equal(Object.keys(backup.appData).some((key) => key === "listening-weather-location" || key.startsWith("listening-weather:")), false);
assert.equal(store.previewBackup(JSON.stringify(backup)).monthlySummaryCount, 1);

console.log("mobile listening store check passed");
