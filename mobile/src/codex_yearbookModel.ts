import { inRecordingPeriod } from "./listeningYearbook";
import { localDateOf } from "./format";
import { store } from "./store";
import type { ReviewEntry } from "./types";

export function journalEntries(entries: ReviewEntry[], year: number) {
  return entries.filter((entry) => (entry.type === "song" || entry.type === "album") && inRecordingPeriod(entry, year))
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime() || a.id.localeCompare(b.id));
}

export function journalMonths(entries: ReviewEntry[]) {
  const counts = Array<number>(12).fill(0);
  for (const entry of entries) counts[new Date(entry.createdAt).getMonth()]++;
  return counts;
}

export function journalTitle(entry: ReviewEntry) {
  return (entry.type === "song" ? entry.songName : entry.albumName)?.trim() || entry.title;
}

export function journalDate(entry: ReviewEntry) {
  return localDateOf(entry.createdAt)?.replaceAll("-", ".") ?? "日期无效";
}

export function journalRating(entry: ReviewEntry) {
  return entry.rating === null ? "未评分" : `${entry.rating}${entry.ratingModifier ?? ""} / 10`;
}

export function journalFuture(year: number, month: number, now = new Date()) {
  return year > now.getFullYear() || (year === now.getFullYear() && month > now.getMonth() + 1);
}

export async function journalCover(entry: ReviewEntry) {
  return store.getEntryCover(entry);
}
