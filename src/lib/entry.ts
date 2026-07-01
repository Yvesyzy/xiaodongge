import type { ReviewEntry } from "@prisma/client";
import { ENTRY_TYPES, type EntryType } from "./constants";
import { excerpt } from "./format";
import type { SerializedEntry } from "./types";

export class InputError extends Error {
  status = 400;
}

export function serializeEntry(entry: ReviewEntry): SerializedEntry {
  return {
    id: entry.id,
    type: entry.type as EntryType,
    title: entry.title,
    year: entry.year,
    month: entry.month,
    albumName: entry.albumName,
    songName: entry.songName,
    artistName: entry.artistName,
    content: entry.content,
    tags: decodeList(entry.tags),
    moods: decodeList(entry.moods),
    rating: entry.rating,
    listenedAt: entry.listenedAt?.toISOString() ?? null,
    createdAt: entry.createdAt.toISOString(),
    updatedAt: entry.updatedAt.toISOString(),
    summary: excerpt(entry.content),
    musicLabel: getMusicLabel(entry),
  };
}

export function decodeList(value: string | null) {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter(isNonEmptyString) : [];
  } catch {
    return [];
  }
}

export function parseStringList(value: unknown) {
  if (Array.isArray(value)) {
    return Array.from(new Set(value.filter(isNonEmptyString).map((item) => item.trim())));
  }

  if (typeof value !== "string") return [];

  return Array.from(
    new Set(
      value
        .split(/[,，\n]/)
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  );
}

export function encodeList(value: unknown) {
  const list = parseStringList(value);
  return list.length ? JSON.stringify(list) : null;
}

export function parseEntryInput(raw: unknown) {
  const body = asObject(raw);
  const type = readType(body.type);
  const title = readRequiredString(body.title, "标题不能为空");
  const year = readRequiredInt(body.year, "年份不能为空");
  const month = readOptionalInt(body.month);
  const rating = readOptionalInt(body.rating);
  const listenedAt = readOptionalDate(body.listenedAt);

  if (year < 1 || year > 9999) throw new InputError("年份范围必须是 1-9999");
  if (month !== null && (month < 1 || month > 12)) throw new InputError("月份范围必须是 1-12");
  if (rating !== null && (rating < 1 || rating > 10)) {
    throw new InputError("评分范围必须是 1-10");
  }

  return {
    type,
    title,
    year,
    month,
    albumName: readOptionalString(body.albumName),
    songName: readOptionalString(body.songName),
    artistName: readOptionalString(body.artistName),
    content: readRequiredString(body.content, "正文内容不能为空"),
    tags: encodeList(body.tags),
    moods: encodeList(body.moods),
    rating,
    listenedAt,
  };
}

export function entrySearchText(entry: SerializedEntry) {
  return [
    entry.title,
    entry.content,
    entry.songName,
    entry.albumName,
    entry.artistName,
    entry.tags.join(" "),
    entry.moods.join(" "),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function getMusicLabel(entry: ReviewEntry) {
  const parts = [entry.songName, entry.albumName, entry.artistName].filter(Boolean);
  return parts.length ? parts.join(" / ") : "未关联音乐信息";
}

function asObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new InputError("请求内容必须是 JSON 对象");
  }
  return value as Record<string, unknown>;
}

function readType(value: unknown): EntryType {
  if (typeof value !== "string" || !ENTRY_TYPES.includes(value as EntryType)) {
    throw new InputError("记录类型必须是 year / month / album / song");
  }
  return value as EntryType;
}

function readRequiredString(value: unknown, message: string) {
  const result = readOptionalString(value);
  if (!result) throw new InputError(message);
  return result;
}

function readOptionalString(value: unknown) {
  if (value === null || value === undefined) return null;
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function readRequiredInt(value: unknown, message: string) {
  const result = readOptionalInt(value);
  if (result === null) throw new InputError(message);
  return result;
}

function readOptionalInt(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  if (!Number.isInteger(number)) throw new InputError("数字字段必须是整数");
  return number;
}

function readOptionalDate(value: unknown) {
  const raw = readOptionalString(value);
  if (!raw) return null;
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) throw new InputError("时间字段不是有效日期");
  return date;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}
