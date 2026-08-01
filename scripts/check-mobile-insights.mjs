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

const format = loadModule("../mobile/src/format.ts");
const { buildInsights, seasonOf } = loadModule("../mobile/src/insights.ts", {
  "./format": format,
  "./types": {},
  "../../shared/listeningContext": {},
});

function makeEntry(overrides) {
  return {
    id: overrides.id ?? crypto.randomUUID(),
    type: overrides.type ?? "song",
    title: overrides.title ?? "t",
    year: overrides.year ?? 2026,
    month: overrides.month ?? null,
    albumName: overrides.albumName ?? null,
    songName: overrides.songName ?? "s",
    artistName: overrides.artistName ?? "a",
    musicMetadata: null,
    content: "",
    tags: [],
    moods: overrides.moods ?? [],
    rating: overrides.rating ?? null,
    ratingModifier: null,
    firstListenedAt: null,
    listenedAt: overrides.listenedAt ?? null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
}

function makeWeather(date, category) {
  return {
    date,
    location: { name: "x", admin1: null, country: "CN", countryCode: "CN", latitude: 0, longitude: 0, timezone: "Asia/Shanghai" },
    weatherCode: 0,
    category,
    categoryLabel: category,
    temperatureMax: 0,
    temperatureMin: 0,
    precipitation: 0,
    fetchedAt: "2026-01-01T00:00:00.000Z",
  };
}

// seasonOf 边界
assert.equal(seasonOf(1), "冬");
assert.equal(seasonOf(3), "春");
assert.equal(seasonOf(5), "春");
assert.equal(seasonOf(6), "夏");
assert.equal(seasonOf(8), "夏");
assert.equal(seasonOf(9), "秋");
assert.equal(seasonOf(11), "秋");
assert.equal(seasonOf(12), "冬");
assert.equal(seasonOf(2), "冬");

// 空数据
assert.deepEqual(buildInsights([], []), []);
assert.deepEqual(buildInsights([makeEntry({ listenedAt: "2026-01-01" })], []), []);

// 不足 5 条有日期的 → 空
const few = [
  makeEntry({ listenedAt: "2026-01-01", moods: ["孤独"] }),
  makeEntry({ listenedAt: "2026-01-02", moods: ["孤独"] }),
  makeEntry({ listenedAt: "2026-01-03", moods: ["孤独"] }),
  makeEntry({ listenedAt: "2026-01-04", moods: ["孤独"] }),
];
assert.deepEqual(buildInsights(few, []), []);

// 5+ 条同雨天同冬，"孤独"重复 → weather-mood + season-mood
const rainy = [
  makeEntry({ id: "r1", listenedAt: "2026-01-10", moods: ["孤独", "悲伤"], rating: 6 }),
  makeEntry({ id: "r2", listenedAt: "2026-01-11", moods: ["孤独"], rating: 6 }),
  makeEntry({ id: "r3", listenedAt: "2026-01-12", moods: ["孤独"], rating: 7 }),
  makeEntry({ id: "r4", listenedAt: "2026-01-13", moods: ["孤独"], rating: 6 }),
  makeEntry({ id: "r5", listenedAt: "2026-01-14", moods: ["悲伤"], rating: 7 }),
];
const rainyWeather = [
  makeWeather("2026-01-10", "rain"),
  makeWeather("2026-01-11", "rain"),
  makeWeather("2026-01-12", "rain"),
  makeWeather("2026-01-13", "rain"),
  makeWeather("2026-01-14", "rain"),
];
const rainyInsights = buildInsights(rainy, rainyWeather);
const rainyMood = rainyInsights.find((i) => i.kind === "weather-mood");
assert.ok(rainyMood, "weather-mood should exist");
assert.equal(rainyMood.strong, "孤独");
assert.ok(rainyMood.title.includes("雨天"), `title: ${rainyMood.title}`);
assert.ok(rainyMood.body.includes("5 篇"), `body: ${rainyMood.body}`);
assert.ok(rainyMood.evidence.length > 0);

const seasonMood = rainyInsights.find((i) => i.kind === "season-mood");
assert.ok(seasonMood, "season-mood should exist");
assert.equal(seasonMood.strong, "孤独");
assert.ok(seasonMood.title.includes("冬"), `title: ${seasonMood.title}`);

// 无天气数据 → 只有 season 洞察，无 weather 洞察
const noWeather = buildInsights(rainy, []);
assert.equal(noWeather.find((i) => i.kind === "weather-mood"), undefined);
assert.equal(noWeather.find((i) => i.kind === "weather-rating"), undefined);
assert.ok(noWeather.find((i) => i.kind === "season-mood"));

// 评分差异足够大 → season-rating
const mixedRating = [
  makeEntry({ id: "w1", listenedAt: "2026-01-10", rating: 8 }),
  makeEntry({ id: "w2", listenedAt: "2026-01-11", rating: 8 }),
  makeEntry({ id: "w3", listenedAt: "2026-01-12", rating: 9 }),
  makeEntry({ id: "s1", listenedAt: "2026-07-10", rating: 5 }),
  makeEntry({ id: "s2", listenedAt: "2026-07-11", rating: 5 }),
  makeEntry({ id: "s3", listenedAt: "2026-07-12", rating: 6 }),
];
const mixedInsights = buildInsights(mixedRating, []);
const seasonRating = mixedInsights.find((i) => i.kind === "season-rating");
assert.ok(seasonRating, "season-rating should exist");
assert.ok(seasonRating.title.includes("冬"), `title: ${seasonRating.title}`);
assert.ok(seasonRating.title.includes("夏"), `title: ${seasonRating.title}`);
assert.ok(seasonRating.strongValue > seasonRating.weakValue);

// 评分差异不足 → 不生成 rating 洞察
const closeRating = [
  makeEntry({ listenedAt: "2026-01-10", rating: 7 }),
  makeEntry({ listenedAt: "2026-01-11", rating: 7 }),
  makeEntry({ listenedAt: "2026-01-12", rating: 7 }),
  makeEntry({ listenedAt: "2026-07-10", rating: 7 }),
  makeEntry({ listenedAt: "2026-07-11", rating: 7 }),
  makeEntry({ listenedAt: "2026-07-12", rating: 7 }),
];
const closeInsights = buildInsights(closeRating, []);
assert.equal(closeInsights.find((i) => i.kind === "season-rating"), undefined);
assert.equal(closeInsights.find((i) => i.kind === "weather-rating"), undefined);

// year/month 类型记录被过滤
const yearOnly = [
  { ...makeEntry({ type: "year", listenedAt: "2026-01-01", moods: ["孤独"] }), id: "y1" },
  { ...makeEntry({ type: "year", listenedAt: "2026-01-02", moods: ["孤独"] }), id: "y2" },
  { ...makeEntry({ type: "year", listenedAt: "2026-01-03", moods: ["孤独"] }), id: "y3" },
  { ...makeEntry({ type: "year", listenedAt: "2026-01-04", moods: ["孤独"] }), id: "y4" },
  { ...makeEntry({ type: "year", listenedAt: "2026-01-05", moods: ["孤独"] }), id: "y5" },
];
assert.deepEqual(buildInsights(yearOnly, []), []);

// 无 listenedAt 的记录被过滤
const noDate = [
  makeEntry({ id: "n1", listenedAt: null, moods: ["孤独"] }),
  makeEntry({ id: "n2", listenedAt: null, moods: ["孤独"] }),
  makeEntry({ id: "n3", listenedAt: null, moods: ["孤独"] }),
  makeEntry({ id: "n4", listenedAt: null, moods: ["孤独"] }),
  makeEntry({ id: "n5", listenedAt: null, moods: ["孤独"] }),
];
assert.deepEqual(buildInsights(noDate, []), []);

console.log("mobile insights check passed");
