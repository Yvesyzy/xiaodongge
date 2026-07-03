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

const types = loadModule("../mobile/src/types.ts");
const { formatEntriesCsv, formatEntriesTxt } = loadModule("../mobile/src/exportFormats.ts", { "./types": types });

function entry(overrides) {
  return {
    id: overrides.id,
    type: overrides.type ?? "song",
    title: overrides.title,
    year: overrides.year,
    month: overrides.month,
    albumName: overrides.albumName ?? null,
    songName: overrides.songName ?? null,
    artistName: overrides.artistName ?? null,
    content: overrides.content,
    tags: overrides.tags ?? [],
    moods: overrides.moods ?? [],
    rating: overrides.rating ?? null,
    listenedAt: overrides.listenedAt ?? null,
    createdAt: overrides.createdAt,
    updatedAt: overrides.updatedAt ?? overrides.createdAt,
  };
}

const entries = [
  entry({ id: "old", title: "Old Note", year: 2025, month: 12, content: "older", createdAt: "2025-12-01T00:00:00.000Z" }),
  entry({ id: "late", title: "Late Note", year: 2026, month: 7, songName: "Late Song", artistName: "Yves", content: "line one\nline two", tags: ["Art Pop"], moods: ["安静"], rating: 8, listenedAt: "2026-07-03T00:00:00.000Z", createdAt: "2026-07-03T00:00:00.000Z" }),
  entry({ id: "quoted", title: "Comma, Quote", year: 2026, month: 7, content: "他说 \"OK\", 然后继续听。", createdAt: "2026-07-02T00:00:00.000Z" }),
  entry({ id: "nomonth", title: "No Month", year: 2026, month: null, content: "no month", createdAt: "2026-01-01T00:00:00.000Z" }),
];

const summaries = [{
  id: "summary-2026",
  year: 2026,
  title: "2026 年音乐感受总结",
  content: "年度总结正文",
  sourceEntryCount: 3,
  generatedAt: "2026-12-31T00:00:00.000Z",
  createdAt: "2026-12-31T00:00:00.000Z",
  updatedAt: "2026-12-31T00:00:00.000Z",
}];

const text = formatEntriesTxt(entries, summaries, new Date("2026-07-03T08:00:00.000Z"));
assert.ok(text.includes("私人音乐档案导出"));
assert.ok(text.indexOf("2026 年") < text.indexOf("2025 年"));
assert.ok(text.indexOf("7 月") < text.indexOf("未填月份"));
assert.ok(text.indexOf("Late Note") < text.indexOf("Comma, Quote"));
assert.ok(text.includes("年度总结"));
assert.ok(text.includes("2026 年｜2026 年音乐感受总结"));

const csv = formatEntriesCsv(entries);
assert.ok(csv.startsWith("\uFEFF乐评记录\n类型,标题,年份,月份,听歌日期,评分,歌曲,专辑,艺术家,情绪,曲风/标签,正文,创建时间,更新时间\n"));
assert.ok(csv.indexOf("Late Note") < csv.indexOf("Comma, Quote"));
assert.ok(csv.includes("\"Comma, Quote\""));
assert.ok(csv.includes("\"他说 \"\"OK\"\", 然后继续听。\""));
assert.ok(csv.includes("\"line one\nline two\""));

const csvWithSummaries = formatEntriesCsv(entries, summaries);
assert.ok(csvWithSummaries.includes("\n年度总结\n年份,标题,源记录数,生成时间,正文,创建时间,更新时间\n"));
assert.ok(csvWithSummaries.includes("2026,2026 年音乐感受总结,3,"));

console.log("mobile export format check passed");
