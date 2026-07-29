import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { Module } from "node:module";
import ts from "typescript";

const require = Module.createRequire(import.meta.url);
const source = readFileSync(new URL("../shared/listeningAnalysis.ts", import.meta.url), "utf8");
const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } });
const mod = { exports: {} };
new Function("exports", "require", "module", outputText)(mod.exports, require, mod);
const { analyzeListeningEntries, applySemanticOverrides, mergeListeningAnalyses, sourceFingerprint } = mod.exports;

function entry(overrides = {}) {
  return {
    id: overrides.id ?? "entry-1",
    type: overrides.type ?? "song",
    title: overrides.title ?? "测试乐评",
    year: 2026,
    month: 3,
    content: overrides.content ?? "人声非常温柔，编曲有清澈的层次。",
    tags: overrides.tags ?? [],
    moods: overrides.moods ?? [],
    listenedAt: overrides.listenedAt ?? "2026-03-08T00:00:00.000Z",
    updatedAt: overrides.updatedAt ?? "2026-03-08T01:00:00.000Z",
    musicMetadata: overrides.musicMetadata ?? null,
  };
}

const analysis = analyzeListeningEntries([
  entry(),
  entry({ id: "entry-2", content: "旋律不温柔，但是节奏很激烈，像在雨夜的街道奔跑。", moods: ["激烈"], tags: ["电子"] }),
]);
assert.equal(analysis.version, 1);
assert.equal(analysis.sourceEntryCount, 2);
assert.equal(analysis.feelings.find((item) => item.name === "温柔").count, 1);
assert.equal(analysis.hits.find((item) => item.entryId === "entry-2" && item.normalized === "温柔").negated, true);
assert.equal(analysis.hits.find((item) => item.entryId === "entry-1" && item.normalized === "温柔").degree, "非常");
assert.ok(analysis.subjects.some((item) => item.name === "人声"));
assert.ok(analysis.expressions.some((item) => item.name === "场景描写"));
assert.ok(analysis.genres.some((item) => item.name === "电子" && item.count === 1));
assert.ok(analysis.pairs.some((item) => item.subject === "人声" && item.descriptor === "温柔"));
assert.ok(analysis.pairs.some((item) => item.subject === "节奏" && item.descriptor === "激烈"));
assert.ok(analysis.representativeQuotes[0].score >= 2);
assert.equal(new Set(analysis.representativeQuotes.map((item) => item.entryId)).size, analysis.representativeQuotes.length);
assert.equal(analysis.sourceFingerprint, sourceFingerprint([entry({ id: "entry-2", content: "旋律不温柔，但是节奏很激烈，像在雨夜的街道奔跑。", moods: ["激烈"], tags: ["电子"] }), entry()]));
assert.notEqual(analysis.sourceFingerprint, sourceFingerprint([entry({ content: "内容已修改" })]));
const merged = mergeListeningAnalyses([
  analyzeListeningEntries([entry()]),
  analyzeListeningEntries([entry({ id: "entry-2", content: "节奏很激烈。" })]),
]);
assert.equal(merged.sourceEntryCount, 2);
assert.equal(merged.feelings.find((item) => item.name === "激烈").count, 1);
assert.throws(() => mergeListeningAnalyses([analyzeListeningEntries([entry()]), analyzeListeningEntries([entry()])]), /重复乐评/);
const corrected = applySemanticOverrides(analysis, [
  { layer: "feeling", term: "温柔", action: "exclude", targetLayer: null },
  { layer: "expression", term: "场景描写", action: "move", targetLayer: "feeling" },
]);
assert.equal(corrected.feelings.some((item) => item.name === "温柔"), false);
assert.equal(corrected.feelings.some((item) => item.name === "场景描写"), true);
assert.notEqual(corrected.sourceFingerprint, analysis.sourceFingerprint);

console.log("mobile listening analysis check passed");
