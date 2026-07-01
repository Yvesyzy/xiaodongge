import type { EntryInput, ReviewEntry } from "./types";

export function findSimilarEntry(entries: ReviewEntry[], input: EntryInput, ignoreId?: string) {
  return entries.find((entry) => entry.id !== ignoreId && sameEntrySignal(entry, input)) ?? null;
}

function sameEntrySignal(entry: ReviewEntry, input: EntryInput) {
  return entry.type === input.type
    && entry.year === input.year
    && entry.month === input.month
    && textKey(entry.albumName) === textKey(input.albumName)
    && textKey(entry.songName) === textKey(input.songName)
    && textKey(entry.artistName) === textKey(input.artistName)
    && dateKey(entry.listenedAt) === dateKey(input.listenedAt);
}

function textKey(value: string | null) {
  return (value ?? "").trim().toLocaleLowerCase("zh-CN");
}

function dateKey(value: string | null) {
  return value ? value.slice(0, 10) : "";
}
