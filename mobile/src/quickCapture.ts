import { MOOD_TAGS } from "../../shared/moods";
import { toAlbumFirstRecognition } from "./albumFirst";
import type { EntryInput, EntryType, MusicMetadata, RatingModifier, ReviewEntry } from "./types";

const MOOD_SET = new Set<string>(MOOD_TAGS);

export type QuickCaptureInput = {
  type?: EntryType;
  title?: string | null;
  songName?: string | null;
  artistName?: string | null;
  albumName?: string | null;
  musicMetadata?: MusicMetadata | null;
  content: string;
  moods: string[];
  rating: number | null;
  ratingModifier: RatingModifier | null;
  listenedOn: string;
};

export function quickCaptureToEntryInput(input: QuickCaptureInput): EntryInput {
  const songName = clean(input.songName);
  const requestedType = input.type ?? "album";
  const albumFirst = requestedType === "album"
    ? toAlbumFirstRecognition({
      type: requestedType,
      title: clean(input.title) ?? songName ?? undefined,
      songName,
      albumName: clean(input.albumName) ?? undefined,
      artistName: clean(input.artistName) ?? undefined,
    }, input.musicMetadata ?? null)
    : null;
  const type: EntryType = albumFirst?.fields.type ?? requestedType;
  const title = clean(albumFirst?.fields.title) ?? clean(input.title) ?? songName;
  const content = input.content.trim();
  if (!title) throw new Error("请填写标题或歌曲名");
  if (!content) throw new Error("请写下一句话感受");
  if (input.rating !== null && (!Number.isFinite(input.rating) || input.rating < 0.5 || input.rating > 10 || !isHalfStep(input.rating))) {
    throw new Error("评分必须是 0.5 到 10 之间的 0.5 步进值");
  }
  if (input.rating === null && input.ratingModifier !== null) throw new Error("评分修饰符只能与评分一起使用");

  const listenedAt = localDateInputToIso(input.listenedOn);
  const date = new Date(listenedAt);
  return {
    type,
    title,
    year: date.getFullYear(),
    month: date.getMonth() + 1,
    albumName: clean(albumFirst?.fields.albumName) ?? clean(input.albumName),
    songName: type === "album" ? null : songName,
    artistName: clean(albumFirst?.fields.artistName) ?? clean(input.artistName),
    musicMetadata: albumFirst?.musicMetadata ?? input.musicMetadata ?? null,
    content,
    tags: [],
    moods: unique(input.moods.filter((mood) => MOOD_SET.has(mood))),
    rating: input.rating,
    ratingModifier: input.rating === null ? null : input.ratingModifier,
    ratingProduction: null,
    ratingSongwriting: null,
    ratingOriginality: null,
    ratingResonance: null,
    compositeRatingLocked: false,
    firstListenedAt: null,
    listenedAt,
  };
}

export function recentSavedMoods(entries: ReviewEntry[], limit = 6) {
  if (!Number.isInteger(limit) || limit < 0) throw new Error("情绪数量上限无效");
  const result: string[] = [];
  const seen = new Set<string>();
  const sorted = [...entries].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  for (const entry of sorted) {
    for (const mood of entry.moods) {
      if (!MOOD_SET.has(mood) || seen.has(mood)) continue;
      seen.add(mood);
      result.push(mood);
      if (result.length === limit) return result;
    }
  }
  return result;
}

export function localDateInputToIso(value: string) {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) throw new Error("收听日期格式无效");
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) throw new Error("收听日期无效");
  return date.toISOString();
}

function clean(value: string | null | undefined) {
  return typeof value === "string" ? value.trim() || null : null;
}

function unique(values: string[]) {
  return Array.from(new Set(values));
}

function isHalfStep(value: number) {
  return Math.abs(value * 2 - Math.round(value * 2)) < Number.EPSILON * 10;
}
