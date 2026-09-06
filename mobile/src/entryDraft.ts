import type { MusicInfoFields } from "./ocr";
import { readMusicMetadata } from "./musicMetadata";
import { ENTRY_TYPES, type EntryType, type MusicMetadata } from "./types";

export type EntryDraftMode = "create" | "edit";
export type EntryDraftCaptureMode = "quick" | "full";

export type EntryDraftFields = {
  type: EntryType;
  title: string;
  year: string;
  month: string;
  albumName: string;
  songName: string;
  artistName: string;
  listenedAt: string;
  firstListenedAt?: string;
  tags: string;
  rating: string;
  ratingModifier: string;
  ratingProduction: string;
  ratingSongwriting: string;
  ratingOriginality: string;
  ratingResonance: string;
  content: string;
};

export type EntryDraft = {
  version: 2;
  mode: EntryDraftMode;
  captureMode: EntryDraftCaptureMode;
  entryId: string | null;
  draftId: string | null;
  baseUpdatedAt: string | null;
  savedAt: string;
  fields: EntryDraftFields;
  genreSelection: { level1: string; level2: string; level3: string };
  selectedGenreTags: string[];
  selectedMoodGroupId: string;
  selectedMoods: string[];
  coverDataUrl: string | null;
  coverChanged: boolean;
  ocrText: string;
  recognizedFields: MusicInfoFields | null;
  musicMetadata: MusicMetadata | null;
  compositeRatingLocked: boolean;
  inspiration: boolean;
};

export const MAX_NEW_DRAFTS = 5;

type DraftStorage = Pick<Storage, "getItem" | "setItem" | "removeItem" | "key" | "length">;

export function entryDraftKey(mode: EntryDraftMode, entryId: string | null, draftId: string | null = null) {
  if (mode === "create") {
    if (!draftId) return "music-feelings-entry-draft:v1:new";
    return `music-feelings-entry-draft:v1:new:${draftId}`;
  }
  if (!entryId) throw new Error("编辑草稿缺少记录 ID");
  return `music-feelings-entry-draft:v1:edit:${entryId}`;
}

export function readEntryDraft(storage: DraftStorage, mode: EntryDraftMode, entryId: string | null, draftId: string | null = null):
  { status: "missing" } | { status: "invalid" } | { status: "valid"; draft: EntryDraft } {
  const raw = storage.getItem(entryDraftKey(mode, entryId, draftId));
  if (raw === null) return { status: "missing" };
  try {
    const draft = parseEntryDraft(JSON.parse(raw));
    return draft ? { status: "valid", draft } : { status: "invalid" };
  } catch {
    return { status: "invalid" };
  }
}

export function writeEntryDraft(storage: DraftStorage, draft: EntryDraft) {
  storage.setItem(entryDraftKey(draft.mode, draft.entryId, draft.draftId), JSON.stringify(draft));
}

export function removeEntryDraft(storage: DraftStorage, mode: EntryDraftMode, entryId: string | null, draftId: string | null = null) {
  storage.removeItem(entryDraftKey(mode, entryId, draftId));
}

export function createNewDraftId() {
  return crypto.randomUUID();
}

export function countNewDrafts(storage: DraftStorage): number {
  let count = 0;
  for (let i = 0; i < storage.length; i++) {
    const key = storage.key(i);
    if (!key) continue;
    // ponytail: 旧版 v1:new 和新版 v1:new:{id} 都算新建草稿
    if (key === "music-feelings-entry-draft:v1:new" || key.startsWith("music-feelings-entry-draft:v1:new:")) count++;
  }
  return count;
}

export function canRestoreEditDraft(draft: EntryDraft, entryId: string, entryUpdatedAt: string) {
  return draft.mode === "edit" && draft.entryId === entryId && draft.baseUpdatedAt === entryUpdatedAt;
}

export type EntryDraftMeta = {
  key: string;
  mode: EntryDraftMode;
  entryId: string | null;
  draftId: string | null;
  title: string;
  type: EntryType | null;
  savedAt: string;
  inspiration: boolean;
  captureMode: EntryDraftCaptureMode;
};

const DRAFT_KEY_PREFIX = "music-feelings-entry-draft:v1:";
const NEW_LEGACY_KEY = "music-feelings-entry-draft:v1:new";
const NEW_PREFIX = "music-feelings-entry-draft:v1:new:";

// ponytail: 扫描 localStorage 中所有草稿 key，单用户本地草稿数量有限，O(n) 扫描足够
export function listEntryDrafts(storage: DraftStorage): EntryDraftMeta[] {
  const metas: EntryDraftMeta[] = [];
  for (let i = 0; i < storage.length; i++) {
    const key = storage.key(i);
    if (!key || !key.startsWith(DRAFT_KEY_PREFIX)) continue;
    const raw = storage.getItem(key);
    if (!raw) continue;
    try {
      const draft = parseEntryDraft(JSON.parse(raw));
      if (!draft) continue;
      const draftId = key === NEW_LEGACY_KEY ? null : (key.startsWith(NEW_PREFIX) ? key.slice(NEW_PREFIX.length) : null);
      metas.push({
        key,
        mode: draft.mode,
        entryId: draft.entryId,
        draftId,
        title: draft.fields.title || "(未命名草稿)",
        type: draft.fields.type,
        savedAt: draft.savedAt,
        inspiration: draft.inspiration,
        captureMode: draft.captureMode,
      });
    } catch {
      // 损坏草稿跳过，不影响列表
    }
  }
  return metas.sort((a, b) => b.savedAt.localeCompare(a.savedAt));
}

export function deleteEntryDraftByKey(storage: DraftStorage, key: string) {
  storage.removeItem(key);
}

function parseEntryDraft(value: unknown): EntryDraft | null {
  if (!isRecord(value) || (value.version !== 1 && value.version !== 2) || (value.mode !== "create" && value.mode !== "edit")) return null;
  const entryId = nullableString(value.entryId);
  // ponytail: 旧版草稿没有 draftId 字段，create 模式下解析为 null（legacy 草稿，续写时迁移）
  const draftId = nullableString(value.draftId) ?? null;
  const baseUpdatedAt = nullableDate(value.baseUpdatedAt);
  const savedAt = dateString(value.savedAt);
  const fields = parseFields(value.fields);
  const genreSelection = parseGenreSelection(value.genreSelection);
  const selectedGenreTags = stringArray(value.selectedGenreTags);
  const selectedMoodGroupId = stringValue(value.selectedMoodGroupId);
  const selectedMoods = stringArray(value.selectedMoods);
  const coverDataUrl = imageDataUrl(value.coverDataUrl);
  const recognizedFields = parseMusicInfoFields(value.recognizedFields);
  const musicMetadata = value.version === 1 ? null : readMusicMetadata(value.musicMetadata, "draft.musicMetadata");
  if (entryId === undefined || draftId === undefined || baseUpdatedAt === undefined || !savedAt || !fields || !genreSelection
    || !selectedGenreTags || selectedMoodGroupId === null || !selectedMoods || coverDataUrl === undefined
    || typeof value.coverChanged !== "boolean" || typeof value.ocrText !== "string" || recognizedFields === undefined
    || (value.version === 2 && value.musicMetadata === undefined)) return null;
  if (value.mode === "create" && (entryId !== null || baseUpdatedAt !== null)) return null;
  if (value.mode === "edit" && (!entryId || !baseUpdatedAt)) return null;
  return {
    version: 2,
    mode: value.mode,
    captureMode: value.captureMode === "quick" ? "quick" : "full",
    entryId,
    draftId,
    baseUpdatedAt,
    savedAt,
    fields,
    genreSelection,
    selectedGenreTags,
    selectedMoodGroupId,
    selectedMoods,
    coverDataUrl,
    coverChanged: value.coverChanged,
    ocrText: value.ocrText,
    recognizedFields,
    musicMetadata,
    compositeRatingLocked: value.compositeRatingLocked === true,
    inspiration: value.inspiration === true,
  };
}

function parseFields(value: unknown): EntryDraftFields | null {
  if (!isRecord(value) || !ENTRY_TYPES.includes(value.type as EntryType)) return null;
  const keys = ["title", "year", "month", "albumName", "songName", "artistName", "listenedAt", "tags", "rating", "content"] as const;
  if (keys.some((key) => typeof value[key] !== "string")) return null;
  // ponytail: 旧版草稿（v1）没有 ratingModifier/4 维字段，兼容为空字符串
  const ratingModifier = typeof value.ratingModifier === "string" ? value.ratingModifier : "";
  const ratingProduction = typeof value.ratingProduction === "string" ? value.ratingProduction : "";
  const ratingSongwriting = typeof value.ratingSongwriting === "string" ? value.ratingSongwriting : "";
  const ratingOriginality = typeof value.ratingOriginality === "string" ? value.ratingOriginality : "";
  const ratingResonance = typeof value.ratingResonance === "string" ? value.ratingResonance : "";
  return {
    type: value.type as EntryType,
    title: value.title as string,
    year: value.year as string,
    month: value.month as string,
    albumName: value.albumName as string,
    songName: value.songName as string,
    artistName: value.artistName as string,
    listenedAt: value.listenedAt as string,
    ...(typeof value.firstListenedAt === "string" ? { firstListenedAt: value.firstListenedAt } : {}),
    tags: value.tags as string,
    rating: value.rating as string,
    ratingModifier,
    ratingProduction,
    ratingSongwriting,
    ratingOriginality,
    ratingResonance,
    content: value.content as string,
  };
}

function parseGenreSelection(value: unknown) {
  if (!isRecord(value) || typeof value.level1 !== "string" || typeof value.level2 !== "string" || typeof value.level3 !== "string") return null;
  return { level1: value.level1, level2: value.level2, level3: value.level3 };
}

function parseMusicInfoFields(value: unknown): MusicInfoFields | null | undefined {
  if (value === null) return null;
  if (!isRecord(value)) return undefined;
  const result: MusicInfoFields = {};
  if (value.type !== undefined) {
    if (!ENTRY_TYPES.includes(value.type as EntryType)) return undefined;
    result.type = value.type as EntryType;
  }
  for (const key of ["title", "albumName", "artistName", "content"] as const) {
    if (value[key] !== undefined) {
      if (typeof value[key] !== "string") return undefined;
      result[key] = value[key];
    }
  }
  if (value.songName !== undefined) {
    if (value.songName !== null && typeof value.songName !== "string") return undefined;
    result.songName = value.songName;
  }
  return result;
}

function stringArray(value: unknown) {
  return Array.isArray(value) && value.every((item) => typeof item === "string") ? [...value] : null;
}

function stringValue(value: unknown) {
  return typeof value === "string" ? value : null;
}

function nullableString(value: unknown) {
  return value === null || typeof value === "string" ? value : undefined;
}

function dateString(value: unknown) {
  return typeof value === "string" && !Number.isNaN(new Date(value).getTime()) ? value : null;
}

function nullableDate(value: unknown) {
  return value === null ? null : dateString(value) ?? undefined;
}

function imageDataUrl(value: unknown) {
  return value === null || (typeof value === "string" && value.startsWith("data:image/")) ? value : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}
