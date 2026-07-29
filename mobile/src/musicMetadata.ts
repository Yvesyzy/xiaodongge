import type { MusicMetadata } from "./types";

const STRING_KEYS = [
  "albumArtistName",
  "authorName",
  "writerName",
  "composerName",
  "compilation",
  "releaseDate",
  "genre",
  "mediaId",
  "mediaUri",
  "artworkUri",
  "displayTitle",
  "displaySubtitle",
  "displayDescription",
  "sourcePackage",
  "catalogTrackId",
  "catalogAlbumId",
  "catalogArtistId",
] as const;

const INTEGER_KEYS = ["releaseYear", "durationMs", "trackNumber", "trackCount", "discNumber", "discCount"] as const;

export function readMusicMetadata(value: unknown, key = "musicMetadata"): MusicMetadata | null {
  if (value === undefined || value === null) return null;
  if (!isRecord(value)) throw new Error(`${key} 必须是音乐元数据对象或 null`);

  const result: MusicMetadata = {};
  for (const name of STRING_KEYS) {
    const item = value[name];
    if (item === undefined || item === null || item === "") continue;
    if (typeof item !== "string") throw new Error(`${key}.${name} 必须是字符串`);
    const text = item.trim();
    if (text) result[name] = text;
  }
  for (const name of INTEGER_KEYS) {
    const item = value[name];
    if (item === undefined || item === null) continue;
    if (!Number.isInteger(item) || (item as number) < 0) throw new Error(`${key}.${name} 必须是非负整数`);
    result[name] = item as number;
  }

  const explicitness = value.explicitness;
  if (explicitness !== undefined && explicitness !== null) {
    if (explicitness !== "explicit" && explicitness !== "cleaned" && explicitness !== "notExplicit") {
      throw new Error(`${key}.explicitness 无效`);
    }
    result.explicitness = explicitness;
  }

  const catalogSource = value.catalogSource;
  if (catalogSource !== undefined && catalogSource !== null) {
    if (catalogSource !== "apple") throw new Error(`${key}.catalogSource 无效`);
    result.catalogSource = catalogSource;
  }

  const enrichedAt = value.enrichedAt;
  if (enrichedAt !== undefined && enrichedAt !== null) {
    if (typeof enrichedAt !== "string" || Number.isNaN(new Date(enrichedAt).getTime())) {
      throw new Error(`${key}.enrichedAt 必须是有效时间字符串`);
    }
    result.enrichedAt = enrichedAt;
  }

  return Object.keys(result).length ? result : null;
}

export function mergeMusicMetadata(primary: MusicMetadata | null, fallback: MusicMetadata | null) {
  return readMusicMetadata({ ...(fallback ?? {}), ...(primary ?? {}) });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}
