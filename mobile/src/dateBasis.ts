// 带扩展名以便 node --test 直接跑自检脚本（tsconfig 已开 allowImportingTsExtensions）
import { localDateOf } from "./format.ts";
import type { ReviewEntry } from "./types";

/** 归档整理的两种口径 */
export type ArchiveBasis = "releaseDate" | "recordedAt";
/** 月报 / 年报的两种口径 */
export type ReportBasis = "releaseDate" | "firstListenedAt";
/** 报告生成口径；createdAt 只用于兼容旧调用方与旧快照 */
export type DateBasis = ArchiveBasis | ReportBasis | "createdAt";

export const ARCHIVE_BASES: readonly ArchiveBasis[] = ["releaseDate", "recordedAt"];
export const REPORT_BASES: readonly ReportBasis[] = ["releaseDate", "firstListenedAt"];

export const DATE_BASIS_LABELS: Record<DateBasis, string> = {
  releaseDate: "专辑/歌曲发行时间",
  recordedAt: "乐评记录时间",
  firstListenedAt: "首次收听时间",
  createdAt: "首次正式保存时间",
};

export function isArchiveBasis(value: unknown): value is ArchiveBasis {
  return value === "releaseDate" || value === "recordedAt";
}

export function isReportBasis(value: unknown): value is ReportBasis {
  return value === "releaseDate" || value === "firstListenedAt";
}

function dateOnly(value: string | null | undefined): string | null {
  if (!value) return null;
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const parsed = new Date(year, month - 1, day);
  if (parsed.getFullYear() !== year || parsed.getMonth() + 1 !== month || parsed.getDate() !== day) return null;
  return `${match[1]}-${match[2]}-${match[3]}`;
}

/**
 * 三种时间统一取本地年月日。发行时间优先读可编辑的顶层字段；
 * musicMetadata 的目录发行日期作为旧数据回退，只有年份时不伪造具体日期。
 */
export function entryDate(entry: ReviewEntry, basis: DateBasis): string | null {
  if (basis === "releaseDate") return dateOnly(entry.releaseDate) ?? dateOnly(entry.musicMetadata?.releaseDate);
  if (basis === "firstListenedAt") return localDateOf(entry.firstListenedAt);
  return localDateOf(entry.createdAt);
}

/** 发行年份：完整日期或目录年份都能识别新老专辑。 */
export function releaseYearOf(entry: ReviewEntry): number | null {
  const full = dateOnly(entry.releaseDate) ?? dateOnly(entry.musicMetadata?.releaseDate);
  if (full) return Number(full.slice(0, 4));
  const year = entry.musicMetadata?.releaseYear;
  return typeof year === "number" && Number.isInteger(year) && year >= 1 && year <= 9999 ? year : null;
}

/** 今年发行的专辑/歌曲即为新专辑；没有发行时间的作品不算新专辑。 */
export function isNewRelease(entry: ReviewEntry, year: number): boolean {
  return releaseYearOf(entry) === year;
}

export function inPeriod(entry: ReviewEntry, basis: DateBasis, year: number, month?: number): boolean {
  const date = entryDate(entry, basis);
  if (!date) return false;
  if (date.slice(0, 4) !== String(year).padStart(4, "0")) return false;
  return month === undefined || Number(date.slice(5, 7)) === month;
}

/** 该年份下所有有记录的月份（1-12），用于年度报告按口径生成月报。 */
export function activeMonths(entries: ReviewEntry[], basis: DateBasis, year: number): number[] {
  const months = new Set<number>();
  for (const entry of entries) {
    const date = entryDate(entry, basis);
    if (date && date.startsWith(String(year).padStart(4, "0"))) months.add(Number(date.slice(5, 7)));
  }
  return [...months].sort((a, b) => a - b);
}

/** 明确日期缺失的条目数量，供双口径统计同时展示。 */
export function countDated(entries: ReviewEntry[], basis: DateBasis): number {
  return entries.filter((entry) => entryDate(entry, basis) !== null).length;
}
