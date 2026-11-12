import { strict as assert } from "node:assert";
import { test } from "node:test";
import { mergeBackupData, type MergeableBackup } from "./backupMerge.ts";

function fixture(partial: Partial<MergeableBackup> = {}): MergeableBackup {
  return {
    entries: [], summaries: [], monthlySummaries: [], covers: [],
    listeningMoments: [], appData: {}, drafts: [], ...partial,
  };
}

const entry = (id: string, updatedAt: string) => ({ id, updatedAt });
const cover = (coverKey: string, updatedAt: string) => ({ coverKey, updatedAt });
const summary = (id: string, year: number, updatedAt: string) => ({ id, year, updatedAt });
const monthly = (id: string, year: number, month: number, updatedAt: string) => ({ id, year, month, updatedAt });
const moment = (id: string, updatedAt: string) => ({ id, updatedAt });
const draft = (key: string, raw: string) => ({ key, raw });

test("两端各自新增的记录都保留", () => {
  const current = fixture({ entries: [entry("local", "2026-11-01T00:00:00.000Z")] });
  const incoming = fixture({ entries: [entry("phone", "2026-11-02T00:00:00.000Z")] });
  assert.deepEqual(mergeBackupData(current, incoming).entries.map(item => item.id), ["local", "phone"]);
});

test("同 id 取 updatedAt 较新的一方", () => {
  const current = fixture({ entries: [entry("same", "2026-11-10T00:00:00.000Z")] });
  const incoming = fixture({ entries: [entry("same", "2026-11-05T00:00:00.000Z")] });
  assert.equal(mergeBackupData(current, incoming).entries[0].updatedAt, "2026-11-10T00:00:00.000Z");
});

test("年度总结按 year、月度作品按 year-month 合并，不产生唯一键冲突", () => {
  const current = fixture({
    summaries: [summary("local", 2026, "2026-11-01T00:00:00.000Z")],
    monthlySummaries: [monthly("local-m", 2026, 5, "2026-11-01T00:00:00.000Z")],
  });
  const incoming = fixture({
    summaries: [summary("phone", 2026, "2026-11-09T00:00:00.000Z"), summary("phone-old", 2025, "2026-11-09T00:00:00.000Z")],
    monthlySummaries: [monthly("phone-m", 2026, 5, "2026-10-01T00:00:00.000Z")],
  });
  const merged = mergeBackupData(current, incoming);
  assert.equal(merged.summaries.length, 2);
  assert.equal(merged.summaries.find(item => item.year === 2026)?.id, "phone");
  assert.equal(merged.monthlySummaries.length, 1);
  assert.equal(merged.monthlySummaries[0].id, "local-m");
});

test("封面、重听、appData 与草稿的合并规则", () => {
  const current = fixture({
    covers: [cover("c1", "2026-11-01T00:00:00.000Z")],
    listeningMoments: [moment("local", "2026-11-01T00:00:00.000Z")],
    appData: { "local-key": "local", shared: "old" },
    drafts: [draft("draft:local", "local-raw")],
  });
  const incoming = fixture({
    covers: [cover("c1", "2026-10-01T00:00:00.000Z"), cover("c2", "2026-11-02T00:00:00.000Z")],
    listeningMoments: [moment("phone", "2026-11-02T00:00:00.000Z")],
    appData: { shared: "new", "phone-key": "phone" },
    drafts: [draft("draft:local", "incoming-raw"), draft("draft:phone", "phone-raw")],
  });
  const merged = mergeBackupData(current, incoming);
  assert.equal(merged.covers.find(item => item.coverKey === "c1")?.updatedAt, "2026-11-01T00:00:00.000Z");
  assert.deepEqual(merged.covers.map(item => item.coverKey), ["c1", "c2"]);
  assert.deepEqual(merged.listeningMoments.map(item => item.id), ["local", "phone"]);
  assert.deepEqual(merged.appData, { "local-key": "local", shared: "new", "phone-key": "phone" });
  assert.deepEqual(merged.drafts.find(item => item.key === "draft:local"), draft("draft:local", "local-raw"));
  assert.equal(merged.drafts.length, 2);
});

test("跳过封面时完整保留本机封面", () => {
  const current = fixture({ covers: [cover("local", "2026-11-01T00:00:00.000Z")] });
  const incoming = fixture({ covers: [cover("phone", "2026-11-02T00:00:00.000Z")] });
  assert.deepEqual(mergeBackupData(current, incoming, { includeCovers: false }).covers, current.covers);
});
