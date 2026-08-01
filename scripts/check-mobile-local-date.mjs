import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { Module } from "node:module";
import ts from "typescript";

const require = Module.createRequire(import.meta.url);
function loadModule(path, localModules = {}) {
  const source = readFileSync(new URL(path, import.meta.url), "utf8");
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  });
  const mod = { exports: {} };
  const localRequire = (id) => localModules[id] ?? require(id);
  new Function("exports", "require", "module", outputText)(mod.exports, localRequire, mod);
  return mod.exports;
}

const { localDateOf } = loadModule("../mobile/src/format.ts");

// 表单存储格式：本地午夜转 UTC ISO（东八区会存成前一天）。localDateOf 必须还原成本地日期。
const storedInUtc8 = new Date("2026-08-01T00:00:00").toISOString(); // 08-01 本地午夜
assert.equal(storedInUtc8.slice(0, 10), "2026-07-31", "前提：UTC+8 下 08-01 存成 07-31 的 UTC ISO");
assert.equal(localDateOf(storedInUtc8), "2026-08-01", "localDateOf 应还原为本地日期");

// 旧数据/UTC 日期输入：直接保留日期部分
assert.equal(localDateOf("2026-08-01T00:00:00.000Z"), "2026-08-01");
// 无效值
assert.equal(localDateOf(null), null);
assert.equal(localDateOf(""), null);
assert.equal(localDateOf("not-a-date"), null);
// 带时刻的 UTC 时间戳（moment 表单格式）
const momentLike = new Date("2026-08-01T00:00:00Z").toISOString();
assert.equal(localDateOf(momentLike), "2026-08-01");

// 回归防线：各按日聚合点不得再出现 slice(0,10) 直接提取
const storeSource = readFileSync(new URL("../mobile/src/store.ts", import.meta.url), "utf8");
assert.ok(!/exactEntryDate[\s\S]{0,80}slice\(0, 10\)/.test(storeSource), "store.exactEntryDate 不应再 slice(0,10)");
const yearbookSource = readFileSync(new URL("../mobile/src/listeningYearbook.ts", import.meta.url), "utf8");
assert.ok(!/slice\(0, 10\)/.test(yearbookSource), "listeningYearbook 不应再有 slice(0,10)");
const insightsSource = readFileSync(new URL("../mobile/src/insights.ts", import.meta.url), "utf8");
assert.ok(!/listenedAt\?\.slice\(0, 10\)/.test(insightsSource), "insights 不应再有 slice(0,10)");
const duplicateSource = readFileSync(new URL("../mobile/src/entryDuplicate.ts", import.meta.url), "utf8");
assert.ok(!/slice\(0, 10\)/.test(duplicateSource), "entryDuplicate 不应再有 slice(0,10)");

console.log("mobile local date check passed");
