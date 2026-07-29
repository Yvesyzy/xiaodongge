import type { MusicInfoFields } from "./ocr";
import { readMusicMetadata } from "./musicMetadata";
import { ENTRY_TYPES, type EntryType, type MusicMetadata } from "./types";

export type EntryDraftMode = "create" | "edit";

export type EntryDraftFields = {
  type: EntryType;
  title: string;
  year: string;
  month: string;
  albumName: string;
  songName: string;
  artistName: string;
  listenedAt: string;
  tags: string;
  rating: string;
  content: string;
};

export type EntryDraft = {
  version: 2;
  mode: EntryDraftMode;
  entryId: string | null;
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
};

type DraftStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export function entryDraftKey(mode: EntryDraftMode, entryId: string | null) {
  if (mode === "create") return "music-feelings-entry-draft:v1:new";
  if (!entryId) throw new Error("编辑草稿缺少记录 ID");
  return `music-feelings-entry-draft:v1:edit:${entryId}`;
}

export function readEntryDraft(storage: DraftStorage, mode: EntryDraftMode, entryId: string | null):
  { status: "missing" } | { status: "invalid" } | { status: "valid"; draft: EntryDraft } {
  const raw = storage.getItem(entryDraftKey(mode, entryId));
  if (raw === null) return { status: "missing" };
  try {
    const draft = parseEntryDraft(JSON.parse(raw));
    return draft ? { status: "valid", draft } : { status: "invalid" };
  } catch {
    return { status: "invalid" };
  }
}

export function writeEntryDraft(storage: DraftStorage, draft: EntryDraft) {
  storage.setItem(entryDraftKey(draft.mode, draft.entryId), JSON.stringify(draft));
}

export function removeEntryDraft(storage: DraftStorage, mode: EntryDraftMode, entryId: string | null) {
  storage.removeItem(entryDraftKey(mode, entryId));
}

export function canRestoreEditDraft(draft: EntryDraft, entryId: string, entryUpdatedAt: string) {
  return draft.mode === "edit" && draft.entryId === entryId && draft.baseUpdatedAt === entryUpdatedAt;
}

function parseEntryDraft(value: unknown): EntryDraft | null {
  if (!isRecord(value) || (value.version !== 1 && value.version !== 2) || (value.mode !== "create" && value.mode !== "edit")) return null;
  const entryId = nullableString(value.entryId);
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
  if (entryId === undefined || baseUpdatedAt === undefined || !savedAt || !fields || !genreSelection
    || !selectedGenreTags || selectedMoodGroupId === null || !selectedMoods || coverDataUrl === undefined
    || typeof value.coverChanged !== "boolean" || typeof value.ocrText !== "string" || recognizedFields === undefined
    || (value.version === 2 && value.musicMetadata === undefined)) return null;
  if (value.mode === "create" && (entryId !== null || baseUpdatedAt !== null)) return null;
  if (value.mode === "edit" && (!entryId || !baseUpdatedAt)) return null;
  return {
    version: 2,
    mode: value.mode,
    entryId,
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
  };
}

function parseFields(value: unknown): EntryDraftFields | null {
  if (!isRecord(value) || !ENTRY_TYPES.includes(value.type as EntryType)) return null;
  const keys = ["title", "year", "month", "albumName", "songName", "artistName", "listenedAt", "tags", "rating", "content"] as const;
  if (keys.some((key) => typeof value[key] !== "string")) return null;
  return {
    type: value.type as EntryType,
    title: value.title as string,
    year: value.year as string,
    month: value.month as string,
    albumName: value.albumName as string,
    songName: value.songName as string,
    artistName: value.artistName as string,
    listenedAt: value.listenedAt as string,
    tags: value.tags as string,
    rating: value.rating as string,
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
