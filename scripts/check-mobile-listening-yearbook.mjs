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

const analysis = load("../shared/listeningAnalysis.ts");
const context = load("../shared/listeningContext.ts");
const yearbook = load("../mobile/src/listeningYearbook.ts", { "../../shared/listeningAnalysis": analysis, "../../shared/listeningContext": context, "./types": {} });
assert.equal(yearbook.MONTH_THEMES.length, 12);
assert.equal(new Set(yearbook.MONTH_THEMES.map((theme) => theme.id)).size, 12);
assert.equal(new Set(yearbook.MONTH_THEMES.map((theme) => theme.name)).size, 12);
assert.equal(new Set(yearbook.MONTH_THEMES.map((theme) => theme.accent)).size, 12);

function entry(id, month, content, listenedAt, type = "song") {
  return { id, type, title: id, year: 2026, month, albumName: "A", songName: id, artistName: "Y", musicMetadata: null, content, tags: [], moods: [], rating: 8, listenedAt, createdAt: "2026-01-01T00:00:00.000Z", updatedAt: `2026-${String(month ?? 1).padStart(2, "0")}-01T00:00:00.000Z` };
}

const marchEntries = [
  entry("m1", 3, "人声很温柔，画面像春天。", "2026-03-02T00:00:00.000Z"),
  entry("m2", 3, "旋律安静，歌词克制。", "2026-03-07T00:00:00.000Z"),
  entry("m3", 3, "编曲细腻，空间感开阔。", "2026-03-08T00:00:00.000Z"),
  entry("reflection", 3, "这是我的本月自述。", null, "month"),
];
const march = yearbook.buildMonthlyListeningSnapshot(2026, 3, marchEntries);
assert.equal(march.theme.id, "botanical-sheet");
assert.equal(march.mode, "full");
assert.equal(march.analysis.sourceEntryCount, 3);
assert.deepEqual(march.reflectionEntryIds, ["reflection"]);
assert.equal(march.days.length, 3);
assert.ok(yearbook.monthlySnapshotToMarkdown(march, [marchEntries[3]]).includes("本月自述"));

const july = yearbook.buildMonthlyListeningSnapshot(2026, 7, [entry("j1", 7, "节奏激烈。", "2026-07-02T00:00:00.000Z")]);
assert.equal(july.mode, "memory");
const annual = yearbook.buildYearlyListeningSnapshot(2026, [march, july], [entry("undated", null, "音色清澈。", null)]);
assert.equal(annual.mode, "compact");
assert.equal(annual.analysis.sourceEntryCount, 5);
assert.equal(annual.undatedEntryCount, 1);
assert.equal(annual.months.length, 2);
assert.deepEqual(annual.migrations, []);
assert.ok(yearbook.yearlySnapshotToMarkdown(annual).includes("私人听感标本册"));
assert.deepEqual(annual.analysis.sourceEntryIds.sort(), ["j1", "m1", "m2", "m3", "undated"]);
assert.equal(yearbook.buildYearlyListeningSnapshot(2026, [july], []).mode, "memory");
const fullMonthEntries = Array.from({ length: 8 }, (_, index) => entry(`f${index}`, 4, index % 2 ? "人声温柔。" : "旋律明亮。", `2026-04-${String(index + 1).padStart(2, "0")}T00:00:00.000Z`));
assert.equal(yearbook.buildYearlyListeningSnapshot(2026, [yearbook.buildMonthlyListeningSnapshot(2026, 4, fullMonthEntries)], []).mode, "full");
assert.throws(() => yearbook.buildMonthlyListeningSnapshot(2026, 5, [entry("only-reflection", 5, "本月自述。", null, "month")]), /没有歌曲或专辑乐评/);
const contextEntries = [
  entry("work-1", 3, "人声温柔。", "2026-03-02T00:00:00.000Z"),
  entry("work-2", 3, "旋律温柔。", "2026-03-03T00:00:00.000Z"),
  entry("work-3", 3, "编曲温柔。", "2026-03-04T00:00:00.000Z"),
  entry("holiday-1", 3, "人声激烈。", "2026-03-07T00:00:00.000Z"),
  entry("holiday-2", 3, "旋律激烈。", "2026-03-08T00:00:00.000Z"),
  entry("holiday-3", 3, "编曲激烈。", "2026-03-14T00:00:00.000Z"),
];
const contextMonth = yearbook.buildMonthlyListeningSnapshot(2026, 3, contextEntries);
assert.equal(contextMonth.context.insights.find((item) => item.basis === "day-kind").term, "激烈");
assert.equal(yearbook.parseMonthlyListeningSnapshot(JSON.stringify(march)).theme.id, "botanical-sheet");
assert.equal(yearbook.parseYearlyListeningSnapshot(JSON.stringify(annual)).months.length, 2);
assert.throws(() => yearbook.parseMonthlyListeningSnapshot(JSON.stringify({ ...march, analysis: {} })), /格式无效/);
assert.throws(() => yearbook.parseYearlyListeningSnapshot(JSON.stringify({ ...annual, months: [{ month: 13 }] })), /格式无效/);

console.log("mobile listening yearbook check passed");
