import { excerpt, monthLabel } from "./format";
import type { ReviewEntry, YearStats } from "./types";

export function buildLocalYearlySummary(year: number, entries: ReviewEntry[], stats: YearStats) {
  const monthGroups = new Map<number | null, ReviewEntry[]>();
  for (const entry of entries) monthGroups.set(entry.month, [...(monthGroups.get(entry.month) ?? []), entry]);
  const orderedMonths = Array.from(monthGroups.entries()).sort(([a], [b]) => (a ?? 0) - (b ?? 0));

  return [
    `# ${year} 年音乐感受总结`,
    "",
    "## 统计信息",
    `- 总记录数：${stats.totalEntries}`,
    `- 涉及月份数量：${stats.monthCount}`,
    `- 涉及专辑数量：${stats.albumCount}`,
    `- 涉及歌曲数量：${stats.songCount}`,
    `- 评分平均值：${stats.averageRating ?? "暂无评分"}`,
    `- 记录最多的月份：${stats.mostActiveMonth ? `${stats.mostActiveMonth.name}（${stats.mostActiveMonth.count} 条）` : "暂无"}`,
    `- 记录最多的专辑：${stats.topAlbum ? `${stats.topAlbum.name}（${stats.topAlbum.count} 条）` : "暂无"}`,
    `- 记录最多的歌曲：${stats.topSong ? `${stats.topSong.name}（${stats.topSong.count} 条）` : "暂无"}`,
    "",
    "## 高频标签",
    stats.topTags.length ? stats.topTags.map((item) => `- ${item.name}：${item.count} 次`).join("\n") : "暂无标签",
    "",
    "## 高频情绪",
    stats.topMoods.length ? stats.topMoods.map((item) => `- ${item.name}：${item.count} 次`).join("\n") : "暂无情绪关键词",
    "",
    "## 按月份归纳",
    ...orderedMonths.flatMap(([month, items]) => [
      `### ${monthLabel(month)}`,
      ...items.map((entry) => `- ${entry.title}：${excerpt(entry.content)}`),
      "",
    ]),
    "## 关键片段",
    ...entries.slice(0, 8).map((entry, index) => `${index + 1}. ${entry.title}：${excerpt(entry.content, 110)}`),
    "",
    "## 关系总结",
    `以上内容仅根据手机本地数据库中 ${year} 年已有的 ${entries.length} 条记录整理，未填写的信息没有被补全。`,
  ].join("\n");
}
