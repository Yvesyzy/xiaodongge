// 跨端合并导入：把「整库覆盖」转换成「构造目标快照」，复用既有恢复事务与撤销链路。
export type MergeableBackup = {
  entries: Array<{ id: string; updatedAt: string }>;
  summaries: Array<{ id: string; year: number; updatedAt: string }>;
  monthlySummaries: Array<{ id: string; year: number; month: number; updatedAt: string }>;
  covers: Array<{ coverKey: string; updatedAt: string }>;
  listeningMoments: Array<{ id: string; updatedAt: string }>;
  appData: Record<string, string>;
  drafts: Array<{ key: string; raw: string }>;
};

// ponytail: updatedAt 全为 toISOString()，字典序即时间序；同键取较新，无需解析日期。
function byNewest<T extends { updatedAt: string }>(current: T[], incoming: T[], keyOf: (item: T) => string): T[] {
  const merged = new Map(current.map(item => [keyOf(item), item]));
  for (const item of incoming) {
    const key = keyOf(item);
    const existing = merged.get(key);
    if (!existing || item.updatedAt > existing.updatedAt) merged.set(key, item);
  }
  return [...merged.values()];
}

export function mergeBackupData<B extends MergeableBackup>(current: B, incoming: B, options: { includeCovers?: boolean } = {}): B {
  // 本机未保存草稿优先保留：它更可能是正在编辑的原文。
  const drafts = [...current.drafts];
  const seen = new Set(drafts.map(item => item.key));
  for (const item of incoming.drafts) if (!seen.has(item.key)) { drafts.push(item); seen.add(item.key); }
  return {
    ...incoming,
    entries: byNewest(current.entries, incoming.entries, item => item.id),
    // YearlySummary.year / MonthlySummary(year,month) 在库中唯一，按业务键而非 id 合并。
    summaries: byNewest(current.summaries, incoming.summaries, item => String(item.year)),
    monthlySummaries: byNewest(current.monthlySummaries, incoming.monthlySummaries, item => `${item.year}-${item.month}`),
    listeningMoments: byNewest(current.listeningMoments, incoming.listeningMoments, item => item.id),
    covers: options.includeCovers === false ? current.covers : byNewest(current.covers, incoming.covers, item => item.coverKey),
    appData: { ...current.appData, ...incoming.appData },
    drafts,
  } as B;
}
