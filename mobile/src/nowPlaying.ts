import { mergeMusicMetadata, readMusicMetadata } from "./musicMetadata";
import type { MusicInfoFields } from "./ocr";
import type { MusicMetadata } from "./types";

export type ParsedNowPlayingResult = {
  accessEnabled: boolean;
  fields: MusicInfoFields | null;
  musicMetadata: MusicMetadata | null;
};

export type AppleCatalogTrack = {
  trackName: string;
  artistName: string;
  collectionName?: string;
  releaseDate?: string;
  primaryGenreName?: string;
  trackTimeMillis?: number;
  trackNumber?: number;
  trackCount?: number;
  discNumber?: number;
  discCount?: number;
  trackExplicitness?: "explicit" | "cleaned" | "notExplicit";
  trackId?: string;
  collectionId?: string;
  artistId?: string;
};

export type ParsedCatalogSearchResult = {
  country: "CN" | "US";
  results: AppleCatalogTrack[];
};

export function parseNowPlayingResult(value: unknown): ParsedNowPlayingResult {
  if (!isRecord(value) || typeof value.accessEnabled !== "boolean") {
    throw new Error("当前播放返回格式无效");
  }

  const title = readOptionalString(value.title, "title");
  const artistName = readOptionalString(value.artistName, "artistName");
  const albumName = readOptionalString(value.albumName, "albumName");
  const musicMetadata = readMusicMetadata(value.musicMetadata, "当前播放.musicMetadata");

  return {
    accessEnabled: value.accessEnabled,
    fields: value.accessEnabled && title ? {
      type: "song",
      title,
      songName: title,
      ...(artistName ? { artistName } : {}),
      ...(albumName ? { albumName } : {}),
    } : null,
    musicMetadata: value.accessEnabled && title ? musicMetadata : null,
  };
}

export function parseCatalogSearchResult(value: unknown): ParsedCatalogSearchResult {
  if (!isRecord(value) || (value.country !== "CN" && value.country !== "US") || !Array.isArray(value.results)) {
    throw new Error("音乐目录返回格式无效");
  }
  return {
    country: value.country,
    results: value.results.map((item, index) => readCatalogTrack(item, `results[${index}]`)),
  };
}

export function findAppleCatalogMatch(fields: MusicInfoFields, search: ParsedCatalogSearchResult) {
  const songName = clean(fields.songName);
  const artistName = clean(fields.artistName);
  if (!songName || !artistName) return null;

  let matches = search.results.filter((item) => (
    normalize(item.trackName) === normalize(songName)
    && artistMatches(artistName, item.artistName)
  ));
  const albumName = clean(fields.albumName);
  if (albumName) {
    const albumMatches = matches.filter((item) => item.collectionName && normalize(item.collectionName) === normalize(albumName));
    if (albumMatches.length) matches = albumMatches;
  }
  matches = Array.from(new Map(matches.map((item) => [item.trackId ?? JSON.stringify(item), item])).values());
  return matches.length === 1 ? matches[0] : null;
}

export function applyAppleCatalogMatch(
  fields: MusicInfoFields,
  nativeMetadata: MusicMetadata | null,
  match: AppleCatalogTrack,
  enrichedAt = new Date().toISOString(),
) {
  const catalogMetadata: MusicMetadata = {
    ...(match.releaseDate ? { releaseDate: match.releaseDate, ...releaseYear(match.releaseDate) } : {}),
    ...(match.primaryGenreName ? { genre: match.primaryGenreName } : {}),
    ...(match.trackTimeMillis !== undefined ? { durationMs: match.trackTimeMillis } : {}),
    ...(match.trackNumber !== undefined ? { trackNumber: match.trackNumber } : {}),
    ...(match.trackCount !== undefined ? { trackCount: match.trackCount } : {}),
    ...(match.discNumber !== undefined ? { discNumber: match.discNumber } : {}),
    ...(match.discCount !== undefined ? { discCount: match.discCount } : {}),
    ...(match.trackExplicitness ? { explicitness: match.trackExplicitness } : {}),
    catalogSource: "apple",
    ...(match.trackId ? { catalogTrackId: match.trackId } : {}),
    ...(match.collectionId ? { catalogAlbumId: match.collectionId } : {}),
    ...(match.artistId ? { catalogArtistId: match.artistId } : {}),
    enrichedAt,
  };
  return {
    fields: {
      ...fields,
      ...(!fields.albumName && match.collectionName ? { albumName: match.collectionName } : {}),
    },
    musicMetadata: mergeMusicMetadata(nativeMetadata, catalogMetadata),
  };
}

function readCatalogTrack(value: unknown, key: string): AppleCatalogTrack {
  if (!isRecord(value)) throw new Error(`音乐目录.${key} 必须是对象`);
  const trackName = readRequiredString(value.trackName, `${key}.trackName`);
  const artistName = readRequiredString(value.artistName, `${key}.artistName`);
  const result: AppleCatalogTrack = { trackName, artistName };
  for (const name of ["collectionName", "releaseDate", "primaryGenreName", "trackId", "collectionId", "artistId"] as const) {
    const item = readOptionalString(value[name], `${key}.${name}`);
    if (item) result[name] = item;
  }
  for (const name of ["trackTimeMillis", "trackNumber", "trackCount", "discNumber", "discCount"] as const) {
    const item = value[name];
    if (item === undefined || item === null) continue;
    if (!Number.isInteger(item) || (item as number) < 0) throw new Error(`音乐目录.${key}.${name} 必须是非负整数`);
    result[name] = item as number;
  }
  const explicitness = value.trackExplicitness;
  if (explicitness !== undefined && explicitness !== null) {
    if (explicitness !== "explicit" && explicitness !== "cleaned" && explicitness !== "notExplicit") {
      throw new Error(`音乐目录.${key}.trackExplicitness 无效`);
    }
    result.trackExplicitness = explicitness;
  }
  return result;
}

function artistMatches(nativeArtist: string, catalogArtist: string) {
  const native = normalize(nativeArtist);
  const catalog = normalize(catalogArtist);
  if (native === catalog) return true;
  return catalogArtist
    .split(/\s*(?:&|,|，|、|\bfeat\.?\b|\bft\.?\b|\bwith\b|和|×)\s*/iu)
    .map(normalize)
    .includes(native);
}

function normalize(value: string) {
  return value.normalize("NFKC").toLocaleLowerCase().replace(/\s+/g, " ").replace(/^[\p{P}\p{S}\s]+|[\p{P}\p{S}\s]+$/gu, "").trim();
}

function releaseYear(value: string) {
  const match = value.match(/^(\d{4})/);
  return match ? { releaseYear: Number(match[1]) } : {};
}

function clean(value: string | null | undefined) {
  return typeof value === "string" ? value.trim() || null : null;
}

function readRequiredString(value: unknown, key: string) {
  const result = readOptionalString(value, key);
  if (!result) throw new Error(`音乐目录.${key} 不能为空`);
  return result;
}

function readOptionalString(value: unknown, key: string) {
  if (value === undefined || value === null) return null;
  if (typeof value !== "string") throw new Error(`${key} 必须是字符串`);
  return value.trim() || null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}
