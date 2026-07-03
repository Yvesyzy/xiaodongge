import { ENTRY_TYPE_LABELS, type ReviewEntry, type YearlySummary } from "./types";

const ENTRY_CSV_COLUMNS = ["类型", "标题", "年份", "月份", "听歌日期", "评分", "歌曲", "专辑", "艺术家", "情绪", "曲风/标签", "正文", "创建时间", "更新时间"];
const SUMMARY_CSV_COLUMNS = ["年份", "标题", "源记录数", "生成时间", "正文", "创建时间", "更新时间"];

export function formatEntriesTxt(entries: ReviewEntry[], summaries: YearlySummary[], exportedAt = new Date()) {
  const sortedEntries = sortEntriesForReading(entries);
  const sortedSummaries = [...summaries].sort((a, b) => b.year - a.year || b.generatedAt.localeCompare(a.generatedAt));
  const lines = [
    "私人音乐档案导出",
    `导出时间：${formatDateTime(exportedAt.toISOString())}`,
    `乐评记录：${sortedEntries.length} 条`,
    `年度总结：${sortedSummaries.length} 条`,
    "",
    "乐评记录",
  ];

  if (!sortedEntries.length) {
    lines.push("暂无记录。");
  }

  let currentYear: number | null = null;
  let currentMonth: number | null | undefined = undefined;
  for (const entry of sortedEntries) {
    if (entry.year !== currentYear) {
      currentYear = entry.year;
      currentMonth = undefined;
      lines.push("", `${entry.year} 年`);
    }
    if (entry.month !== currentMonth) {
      currentMonth = entry.month;
      lines.push("", entry.month ? `${entry.month} 月` : "未填月份");
    }
    lines.push(
      "",
      `【${ENTRY_TYPE_LABELS[entry.type]}】${entry.title}`,
      readableMeta("歌曲", entry.songName),
      readableMeta("专辑", entry.albumName),
      readableMeta("艺术家", entry.artistName),
      readableMeta("评分", entry.rating === null ? null : `${entry.rating}/10`),
      readableMeta("听歌日期", formatDateOnly(entry.listenedAt)),
      readableMeta("情绪", entry.moods.join("、") || null),
      readableMeta("曲风/标签", entry.tags.join("、") || null),
      "正文：",
      entry.content.trim(),
      "----",
    );
  }

  if (sortedSummaries.length) {
    lines.push("", "年度总结");
    for (const summary of sortedSummaries) {
      lines.push(
        "",
        `${summary.year} 年｜${summary.title}`,
        `源记录数：${summary.sourceEntryCount}`,
        `生成时间：${formatDateTime(summary.generatedAt)}`,
        summary.content.trim(),
        "----",
      );
    }
  }

  return `${lines.join("\n")}\n`;
}

export function formatEntriesCsv(entries: ReviewEntry[], summaries: YearlySummary[] = []) {
  const entryRows = sortEntriesForReading(entries).map((entry) => [
    ENTRY_TYPE_LABELS[entry.type],
    entry.title,
    String(entry.year),
    entry.month === null ? "" : String(entry.month),
    formatDateOnly(entry.listenedAt),
    entry.rating === null ? "" : String(entry.rating),
    entry.songName ?? "",
    entry.albumName ?? "",
    entry.artistName ?? "",
    entry.moods.join("、"),
    entry.tags.join("、"),
    entry.content,
    formatDateTime(entry.createdAt),
    formatDateTime(entry.updatedAt),
  ]);
  const summaryRows = sortSummariesForReading(summaries).map((summary) => [
    String(summary.year),
    summary.title,
    String(summary.sourceEntryCount),
    formatDateTime(summary.generatedAt),
    summary.content,
    formatDateTime(summary.createdAt),
    formatDateTime(summary.updatedAt),
  ]);
  return `\uFEFF${[
    ["乐评记录"],
    ENTRY_CSV_COLUMNS,
    ...entryRows,
    [],
    ["年度总结"],
    SUMMARY_CSV_COLUMNS,
    ...summaryRows,
  ].map((row) => row.map(csvCell).join(",")).join("\n")}\n`;
}

function sortEntriesForReading(entries: ReviewEntry[]) {
  return [...entries].sort((a, b) => (
    b.year - a.year
    || (b.month ?? 0) - (a.month ?? 0)
    || dateValue(b.listenedAt ?? b.createdAt) - dateValue(a.listenedAt ?? a.createdAt)
    || b.createdAt.localeCompare(a.createdAt)
    || a.title.localeCompare(b.title, "zh-CN")
  ));
}

function sortSummariesForReading(summaries: YearlySummary[]) {
  return [...summaries].sort((a, b) => b.year - a.year || b.generatedAt.localeCompare(a.generatedAt));
}

function readableMeta(label: string, value: string | null) {
  return `${label}：${value || "未填写"}`;
}

function csvCell(value: string) {
  return /[",\r\n]/.test(value) ? `"${value.replace(/"/g, "\"\"")}"` : value;
}

function formatDateOnly(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toISOString().slice(0, 10);
}

function formatDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const pad = (number: number) => String(number).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function dateValue(value: string) {
  const time = new Date(value).getTime();
  return Number.isNaN(time) ? 0 : time;
}
