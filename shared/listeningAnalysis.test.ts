import { strict as assert } from "node:assert";
import { test } from "node:test";
import {
  analyzeListeningEntries,
  applySemanticOverrides,
  mergeListeningAnalyses,
  sourceFingerprint,
  type ListeningEntry,
} from "./listeningAnalysis.ts";

function entry(id: string, content: string, extra: Partial<ListeningEntry> = {}): ListeningEntry {
  return { id, type: "song", title: id, year: 2026, month: 7, content, tags: [], moods: [], listenedAt: null, updatedAt: "2026-07-01", ...extra };
}

test("否定词与例外", () => {
  const negated = analyzeListeningEntries([entry("a", "谈不上温柔的旋律")]);
  assert.equal(negated.hits.find((h) => h.normalized === "温柔")?.negated, true);
  const excepted = analyzeListeningEntries([entry("b", "不只温柔，还很细腻")]);
  const hit = excepted.hits.find((h) => h.normalized === "温柔");
  assert.ok(hit);
  assert.equal(hit.negated, false);
});

test("程度词", () => {
  const a = analyzeListeningEntries([entry("a", "非常温柔的旋律")]);
  assert.equal(a.hits.find((h) => h.normalized === "温柔")?.degree, "非常");
});

test("转折分句各自独立", () => {
  const a = analyzeListeningEntries([entry("a", "温柔但冷峻的编曲")]);
  assert.ok(a.hits.some((h) => h.normalized === "温柔" && h.sentence === "温柔"));
  assert.ok(a.hits.some((h) => h.normalized === "冷峻" && h.sentence === "冷峻的编曲"));
});

test("多词命中同一句", () => {
  const a = analyzeListeningEntries([entry("a", "明亮通透的人声")]);
  const normals = a.hits.map((h) => h.normalized);
  assert.ok(normals.includes("明亮"));
  assert.ok(normals.includes("人声"));
});

test("曲风匹配", () => {
  const a = analyzeListeningEntries([entry("a", "一首后摇加电子的作品")]);
  const genres = a.genres.map((g) => g.name);
  assert.ok(genres.includes("后摇"));
  assert.ok(genres.includes("电子"));
});

test("moods 与 tags 元数据命中", () => {
  const a = analyzeListeningEntries([entry("m", "整体很松弛", { moods: ["温柔"], tags: ["Ambient"] })]);
  assert.ok(a.hits.some((h) => h.source === "mood" && h.normalized === "温柔" && h.category === "已选情绪"));
  assert.ok(a.hits.some((h) => h.source === "tag" && h.normalized === "氛围音乐"));
});

test("聚合 count 与 entryCount", () => {
  const a = analyzeListeningEntries([
    entry("a", "温柔的旋律"),
    entry("b", "温柔而克制的嗓音"),
  ]);
  const feeling = a.feelings.find((m) => m.name === "温柔");
  assert.equal(feeling?.count, 2);
  assert.equal(feeling?.entryCount, 2);
  const b = analyzeListeningEntries([entry("c", "温柔的旋律，温柔的气氛")]);
  const single = b.feelings.find((m) => m.name === "温柔");
  assert.equal(single?.count, 2);
  assert.equal(single?.entryCount, 1);
});

test("分句内主体-描述词配对", () => {
  const a = analyzeListeningEntries([entry("a", "温柔的人声，冷峻的编曲")]);
  assert.deepEqual(
    a.pairs.map((p) => `${p.subject}/${p.descriptor}`).sort(),
    ["编曲/冷峻", "人声/温柔"].sort()
  );
});

test("代表原句按分句评分、每条目一条", () => {
  const a = analyzeListeningEntries([entry("a", "今天听这张专辑，温柔的旋律配上细腻的人声，让我想起小时候。")]);
  assert.equal(a.representativeQuotes.length, 1);
  assert.equal(a.representativeQuotes[0].entryId, "a");
  assert.ok(a.representativeQuotes[0].sentence.includes("温柔"));
});

test("语义校正 exclude 与 move", () => {
  const base = analyzeListeningEntries([entry("a", "温柔的旋律")]);
  const excluded = applySemanticOverrides(base, [{ layer: "feeling", term: "温柔", action: "exclude", targetLayer: null }]);
  assert.ok(!excluded.hits.some((h) => h.normalized === "温柔"));
  const moved = applySemanticOverrides(base, [{ layer: "feeling", term: "温柔", action: "move", targetLayer: "expression" }]);
  const movedHit = moved.hits.find((h) => h.normalized === "温柔");
  assert.equal(movedHit?.layer, "expression");
  assert.equal(movedHit?.category, "用户校正表达");
});

test("合并分析遇到重复条目抛错", () => {
  const a = analyzeListeningEntries([entry("a", "温柔的旋律")]);
  assert.throws(() => mergeListeningAnalyses([a, a]), /重复乐评/);
});

test("来源指纹稳定且随内容变化", () => {
  const first = sourceFingerprint([entry("a", "温柔的旋律"), entry("b", "冷峻的编曲")]);
  const shuffled = sourceFingerprint([entry("b", "冷峻的编曲"), entry("a", "温柔的旋律")]);
  const changed = sourceFingerprint([entry("a", "温柔的旋律"), entry("b", "克制的编曲")]);
  assert.equal(first, shuffled);
  assert.notEqual(first, changed);
});
