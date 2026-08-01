import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { Module } from "node:module";
import ts from "typescript";

const require = Module.createRequire(import.meta.url);
function load(path, localModules = {}) {
  const source = readFileSync(new URL(path, import.meta.url), "utf8");
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  });
  const mod = { exports: {} };
  new Function("exports", "require", "module", outputText)(mod.exports, (id) => localModules[id] ?? require(id), mod);
  return mod.exports;
}

const format = load("../mobile/src/format.ts");
const moods = load("../shared/moods.ts");
const musicIdentity = load("../mobile/src/musicIdentity.ts");
const quickCapture = load("../mobile/src/quickCapture.ts", { "../../shared/moods": moods });
const resurfacing = load("../mobile/src/resurfacing.ts", { "./format": format });
const comparison = load("../mobile/src/relistenComparison.ts", { "./format": format, "./resurfacing": resurfacing });
const shareCard = load("../mobile/src/shareCard.ts", { "./format": format });

const baseEntry = {
  id: "entry-1",
  type: "song",
  title: "稻香",
  year: 2025,
  month: 8,
  albumName: "魔杰座",
  songName: "稻香",
  artistName: "周杰伦",
  musicMetadata: { catalogTrackId: "42" },
  content: "第一次听见时很平静。",
  tags: [],
  moods: ["平静", "温柔"],
  rating: 8,
  ratingModifier: null,
  ratingProduction: null,
  ratingSongwriting: null,
  ratingOriginality: null,
  ratingResonance: null,
  compositeRatingLocked: false,
  firstListenedAt: null,
  listenedAt: "2025-08-01T00:00:00.000Z",
  createdAt: "2025-08-01T00:00:00.000Z",
  updatedAt: "2025-08-01T00:00:00.000Z",
};

assert.equal(musicIdentity.sameMusicIdentity(baseEntry, { songName: "别名", artistName: "别人", musicMetadata: { catalogTrackId: "42" } }), true);
assert.equal(musicIdentity.sameMusicIdentity(baseEntry, { songName: " 稻 香 ", artistName: "周杰伦", albumName: null }), true);
assert.equal(musicIdentity.sameMusicIdentity(baseEntry, { songName: "稻香", artistName: null }), false);
assert.equal(musicIdentity.sameMusicIdentity(baseEntry, { songName: "稻香", artistName: "周杰伦", albumName: "不同专辑" }), false);
assert.equal(musicIdentity.findMusicIdentityMatches([baseEntry], { songName: "稻香", artistName: "周杰伦" }).length, 1);

const quickInput = {
  songName: " 稻香 ",
  artistName: " 周杰伦 ",
  albumName: " 魔杰座 ",
  musicMetadata: null,
  content: " 副歌没有推满。 ",
  moods: ["温柔", "温柔", "不存在"],
  rating: 8.5,
  ratingModifier: "+",
  listenedOn: "2026-08-01",
};
const quick = quickCapture.quickCaptureToEntryInput(quickInput);
assert.equal(quick.title, "稻香");
assert.equal(quick.type, "song");
assert.equal(quick.year, 2026);
assert.equal(quick.month, 8);
assert.deepEqual(quick.moods, ["温柔"]);
assert.equal(format.localDateOf(quick.listenedAt), "2026-08-01");
assert.throws(() => quickCapture.quickCaptureToEntryInput({ ...quickInput, content: "" }), /一句话感受/);
assert.throws(() => quickCapture.localDateInputToIso("2026-02-30"), /日期无效/);
assert.deepEqual(quickCapture.recentSavedMoods([
  { ...baseEntry, id: "older", moods: ["温柔", "平静"], updatedAt: "2026-01-01T00:00:00.000Z" },
  { ...baseEntry, id: "newer", moods: ["怀旧", "温柔"], updatedAt: "2026-02-01T00:00:00.000Z" },
]), ["怀旧", "温柔", "平静"]);

const today = "2026-08-01";
const anniversary = { ...baseEntry, id: "anniversary", listenedAt: "2025-08-02T00:00:00.000Z", rating: 7 };
const highRated = { ...baseEntry, id: "high", listenedAt: "2025-01-01T00:00:00.000Z", rating: 10 };
assert.equal(resurfacing.selectDailyResurfacing([highRated, anniversary], [], today).id, "anniversary");
assert.equal(resurfacing.selectDailyResurfacing([anniversary], [{
  id: "m1",
  entryId: "anniversary",
  listenedAt: "2026-07-15T00:00:00.000Z",
  rating: null,
  ratingModifier: null,
  moods: [],
  content: "刚听过",
  createdAt: "2026-07-15T00:00:00.000Z",
  updatedAt: "2026-07-15T00:00:00.000Z",
}], today), null);
const resolved = resurfacing.resolveDailyResurfacing([anniversary], [], today, null);
assert.equal(resolved.entry.id, "anniversary");
assert.equal(resurfacing.resolveDailyResurfacing([anniversary, highRated], [], today, resolved.state).entry.id, "anniversary");
assert.equal(resurfacing.resolveDailyResurfacing([anniversary], [], today, resurfacing.dismissDailyResurfacing(resolved.state)).entry, null);
assert.equal(resurfacing.parseDailyResurfacingState("{broken"), null);
assert.equal(resurfacing.parseDailyResurfacingState('{"date":"2026-08-01","entryId":"","dismissed":false}'), null);

const moment = {
  id: "moment-1",
  entryId: baseEntry.id,
  listenedAt: "2026-08-01T00:00:00.000Z",
  rating: 9,
  ratingModifier: null,
  moods: ["温柔", "怀旧"],
  content: "这一次听见了怀念。",
  createdAt: "2026-08-01T00:00:00.000Z",
  updatedAt: "2026-08-01T00:00:00.000Z",
};
const compared = comparison.compareRelisten(baseEntry, moment);
assert.equal(compared.rating.difference, 1);
assert.equal(compared.rating.direction, "up");
assert.deepEqual(compared.moods, { kept: ["温柔"], added: ["怀旧"], faded: ["平静"] });
assert.equal(compared.dayGap, 365);
assert.throws(() => comparison.compareRelisten(baseEntry, { ...moment, entryId: "other" }), /不属于/);

const visibleQuickCard = shareCard.buildQuickMemoryCard(baseEntry, { hideContent: false, hideRating: false, hideDate: false, hideBrand: false });
assert.equal(visibleQuickCard.title, "稻香");
assert.equal(visibleQuickCard.ratingLine, "8 / 10");
assert.equal(visibleQuickCard.firstQuote, baseEntry.content);
const privateQuickCard = shareCard.buildQuickMemoryCard(baseEntry, { hideContent: true, hideRating: true, hideDate: true, hideBrand: true });
assert.equal(privateQuickCard.firstQuote, null);
assert.equal(privateQuickCard.ratingLine, null);
assert.equal(privateQuickCard.dateLine, null);
assert.equal(privateQuickCard.brand, null);
const relistenCard = shareCard.buildRelistenMemoryCard(baseEntry, moment, compared, { hideContent: false, hideRating: false, hideDate: false, hideBrand: false });
assert.match(relistenCard.eyebrow, /365 天/);
assert.equal(relistenCard.latestQuote, moment.content);

console.log("mobile v2.1.7 logic check passed");
