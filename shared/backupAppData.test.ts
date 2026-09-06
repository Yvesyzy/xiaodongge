import { strict as assert } from "node:assert";
import { test } from "node:test";
import {
  BACKUP_HEALTH_KEY,
  DAILY_RESURFACING_KEY,
  parseDailyResurfacingState,
  readBackupAppData,
  readJournalEdition,
  readSemanticOverride,
  SEMANTIC_OVERRIDES_KEY,
  WEATHER_LOCATION_KEY,
} from "./backupAppData.ts";

test("年度精选随备份保留；拒绝超过三篇、重复编号及过长寄语", () => {
  const edition = { coverId: "a1", entryIds: ["a1", "a2"], quotes: { a1: "保留原话" }, message: "今年的记录" };
  const raw = JSON.stringify(edition);
  assert.equal(readBackupAppData({ "journal-edition:2026": raw })["journal-edition:2026"], raw);
  assert.deepEqual(readJournalEdition(edition), edition);
  assert.throws(() => readJournalEdition({ ...edition, entryIds: ["a", "b", "c", "d"] }), /年度精选格式无效/);
  assert.throws(() => readJournalEdition({ ...edition, entryIds: ["a", "a"] }), /年度精选格式无效/);
  assert.throws(() => readJournalEdition({ ...edition, message: "字".repeat(121) }), /年度精选格式无效/);
  assert.throws(() => readJournalEdition({ ...edition, quotes: { a1: 1 } }), /年度精选格式无效/);
  assert.throws(() => readBackupAppData({ "journal-edition:0": raw }), /不支持的键/);
});

test("白名单接受备份健康键(回归锁:A1)", () => {
  const result = readBackupAppData({ [BACKUP_HEALTH_KEY]: "{\"version\":1}" });
  assert.equal(result[BACKUP_HEALTH_KEY], "{\"version\":1}");
});

test("全部合法 AppData 键通过", () => {
  const result = readBackupAppData({
    [WEATHER_LOCATION_KEY]: JSON.stringify({ name: "北京", admin1: null, country: "中国", countryCode: "CN", latitude: 39.9, longitude: 116.41, timezone: "Asia/Shanghai" }),
    [DAILY_RESURFACING_KEY]: JSON.stringify({ date: "2026-07-01", entryId: "a1", dismissed: false }),
    [SEMANTIC_OVERRIDES_KEY]: JSON.stringify([{ layer: "feeling", term: "温柔", action: "exclude", targetLayer: null }]),
    "listening-quote:2026-07": JSON.stringify({ entryId: "a1", sentence: "温柔的旋律" }),
  });
  assert.equal(Object.keys(result).length, 4);
});

test("拒绝未知键", () => {
  assert.throws(() => readBackupAppData({ "unknown-key:v1": "x" }), /不支持的键/);
  assert.throws(() => readBackupAppData({ "listening-weather:bad": "not-json" }), /^SyntaxError/);
});

test("非字符串值报错", () => {
  assert.throws(() => readBackupAppData({ [WEATHER_LOCATION_KEY]: 42 }), /必须是字符串/);
});

test("损坏的天气与重逢状态报错", () => {
  assert.throws(() => readBackupAppData({ [WEATHER_LOCATION_KEY]: "{\"broken\"" }));
  assert.throws(() => readBackupAppData({ [DAILY_RESURFACING_KEY]: "not-json" }), /今日重逢状态格式无效/);
});

test("语义校正校验", () => {
  assert.deepEqual(readSemanticOverride({ layer: "feeling", term: "温柔", action: "exclude", targetLayer: null }), { layer: "feeling", term: "温柔", action: "exclude", targetLayer: null });
  assert.deepEqual(readSemanticOverride({ layer: "feeling", term: "温柔", action: "move", targetLayer: "expression" }), { layer: "feeling", term: "温柔", action: "move", targetLayer: "expression" });
  assert.throws(() => readSemanticOverride({ layer: "feeling", term: "温柔", action: "move", targetLayer: null }), /缺少目标类别/);
  assert.throws(() => readSemanticOverride({ layer: "nope", term: "温柔", action: "exclude", targetLayer: null }), /本地语义校正格式无效/);
});

test("重逢状态解析", () => {
  assert.deepEqual(parseDailyResurfacingState(JSON.stringify({ date: "2026-07-01", entryId: "a1", dismissed: false })), { date: "2026-07-01", entryId: "a1", dismissed: false });
  assert.equal(parseDailyResurfacingState(null), null);
  assert.equal(parseDailyResurfacingState("not-json"), null);
  assert.equal(parseDailyResurfacingState(JSON.stringify({ date: "2026-07-01", dismissed: false })), null); // 缺 entryId
});
