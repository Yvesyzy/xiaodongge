import { genreMatchesFilter } from "./genres";

export type UniverseGroupBy = "year" | "artist" | "album" | "mood" | "tag";

export type VisualizationEntry = {
  id: string;
  title: string;
  year: number;
  month: number | null;
  albumName: string | null;
  songName: string | null;
  artistName: string | null;
  content: string;
  tags: string[];
  moods: string[];
  rating: number | null;
  listenedAt: string | null;
  createdAt: string;
};

export type VisualizationFilters = {
  year?: number | null;
  month?: number | null;
  artistName?: string | null;
  albumName?: string | null;
  mood?: string | null;
  tag?: string | null;
  minRating?: number | null;
  maxRating?: number | null;
  groupBy?: UniverseGroupBy;
};

export type VisualizationOptions = {
  years: number[];
  months: number[];
  artistNames: string[];
  albumNames: string[];
  moods: string[];
  tags: string[];
};

export type VisualizationSong = {
  id: string;
  title: string;
  artistName: string | null;
  albumName: string | null;
  songName: string | null;
  year: number;
  month: number | null;
  rating: number | null;
  moods: string[];
  tags: string[];
  listenedAt: string | null;
  createdAt: string;
  reviewExcerpt: string;
  reviewLength: number;
  playCount: number;
};

export type AbstractMapRegion = {
  id: string;
  name: string;
  description: string;
  tone: string;
  color: string;
  moods: readonly string[];
  songCount: number;
  songs: VisualizationSong[];
  featuredSongs: VisualizationSong[];
};

export type AbstractMapResult = {
  regions: AbstractMapRegion[];
  unclassified: VisualizationSong[];
  totalCount: number;
  options: VisualizationOptions;
};

export type EmotionUniverseSong = VisualizationSong & {
  x: number;
  y: number;
  z: number;
  depth: number;
  radius: number;
  opacity: number;
  ringStrength: number;
  color: string;
  groupName: string;
};

export type EmotionUniverseGroup = {
  name: string;
  type: UniverseGroupBy;
  songCount: number;
};

export type EmotionUniverseResult = {
  songs: EmotionUniverseSong[];
  groups: EmotionUniverseGroup[];
  totalCount: number;
  displayedCount: number;
  truncated: boolean;
  options: VisualizationOptions;
};

export const UNCLASSIFIED_REGION_ID = "unclassified_stars";
export const UNIVERSE_GROUP_BY_OPTIONS: UniverseGroupBy[] = ["year", "artist", "album", "mood", "tag"];

export const ABSTRACT_MAP_REGION_DEFS = [
  {
    id: "lonely_island",
    name: "孤独岛",
    description: "孤独、压抑、失落、低落、空虚相关歌曲",
    tone: "偏冷、孤立、岛屿感",
    color: "#80a7ff",
    moods: ["孤独", "压抑", "失落", "低落", "空虚"],
  },
  {
    id: "rock_peninsula",
    name: "摇滚半岛",
    description: "激烈、愤怒、冲动、爆发、热血相关歌曲",
    tone: "边缘锐利、能量强、半岛感",
    color: "#ff6b58",
    moods: ["激烈", "愤怒", "冲动", "爆发", "热血"],
  },
  {
    id: "electronic_sea",
    name: "电子海",
    description: "平静、放空、迷幻、流动、夜晚相关歌曲",
    tone: "流动、海面、点位分散",
    color: "#5ed8c8",
    moods: ["平静", "放空", "迷幻", "流动", "夜晚"],
  },
  {
    id: "jazz_harbor",
    name: "爵士港口",
    description: "松弛、慵懒、浪漫、微醺、城市相关歌曲",
    tone: "港口灯光、柔和线条",
    color: "#f0b45f",
    moods: ["松弛", "慵懒", "浪漫", "微醺", "城市"],
  },
  {
    id: "insomnia_city",
    name: "失眠城市",
    description: "深夜、失眠、焦虑、清醒、疲惫相关歌曲",
    tone: "城市夜景、网格、霓虹感",
    color: "#bc8cff",
    moods: ["深夜", "失眠", "焦虑", "清醒", "疲惫"],
  },
  {
    id: "nostalgia_forest",
    name: "怀旧森林",
    description: "怀旧、温柔、回忆、释然、遗憾相关歌曲",
    tone: "森林、年轮、记忆感",
    color: "#9ecf7a",
    moods: ["怀旧", "温柔", "回忆", "释然", "遗憾"],
  },
  {
    id: UNCLASSIFIED_REGION_ID,
    name: "未分类星野",
    description: "没有匹配到明确情绪的歌曲",
    tone: "边缘星点、稀疏散落",
    color: "#d8d5c8",
    moods: [],
  },
] as const;

const REGION_BY_ID = new Map<string, (typeof ABSTRACT_MAP_REGION_DEFS)[number]>(ABSTRACT_MAP_REGION_DEFS.map((region) => [region.id, region]));
const REGION_BY_MOOD = new Map<string, string>();

for (const region of ABSTRACT_MAP_REGION_DEFS) {
  for (const mood of region.moods) REGION_BY_MOOD.set(mood, region.id);
}

export function buildAbstractMusicMap(entries: VisualizationEntry[], filters: VisualizationFilters = {}): AbstractMapResult {
  const filtered = filterEntries(entries, filters);
  const buckets = new Map<string, VisualizationSong[]>(ABSTRACT_MAP_REGION_DEFS.map((region) => [region.id, [] as VisualizationSong[]]));

  for (const entry of filtered) {
    const regionId = resolveRegionId(entry);
    const regionSongs = buckets.get(regionId);
    if (regionSongs) regionSongs.push(toVisualizationSong(entry));
  }

  const regions = ABSTRACT_MAP_REGION_DEFS.map((region) => {
    const songs = buckets.get(region.id) ?? [];
    return {
      ...region,
      songCount: songs.length,
      songs,
      featuredSongs: songs.slice(0, 3),
    };
  });

  return {
    regions,
    unclassified: buckets.get(UNCLASSIFIED_REGION_ID) ?? [],
    totalCount: filtered.length,
    options: buildVisualizationOptions(entries),
  };
}

export function buildEmotionUniverse(entries: VisualizationEntry[], filters: VisualizationFilters = {}): EmotionUniverseResult {
  const groupBy = filters.groupBy ?? "year";
  const filtered = filterEntries(entries, filters).sort(compareUniverseEntries);
  const displayed = filtered.slice(0, 300);
  const denominator = Math.max(1, displayed.length - 1);
  const laneCount = Math.min(12, Math.max(1, Math.ceil(displayed.length / 18)));
  const groupNames = Array.from(new Set(displayed.map((entry) => groupNameFor(entry, groupBy)))).sort((a, b) => a.localeCompare(b, "zh-CN"));
  const groupDenominator = Math.max(1, groupNames.length - 1);
  const groupIndexByName = new Map(groupNames.map((name, index) => [name, index]));
  const songs = displayed.map((entry, index): EmotionUniverseSong => {
    const song = toVisualizationSong(entry);
    const region = REGION_BY_ID.get(resolveRegionId(entry)) ?? REGION_BY_ID.get(UNCLASSIFIED_REGION_ID);
    const rating = entry.rating ?? 0;
    const reviewLift = Math.min(song.reviewLength, 600) / 120;
    const groupName = groupNameFor(entry, groupBy);
    const groupIndex = groupIndexByName.get(groupName) ?? 0;
    const laneRatio = laneCount <= 1 ? 0 : ((index % laneCount) - (laneCount - 1) / 2) / ((laneCount - 1) / 2);
    const z = roundOne(clamp((groupNames.length <= 1 ? 50 : 12 + (groupIndex / groupDenominator) * 76) + laneRatio * 18, 10, 90));
    return {
      ...song,
      x: displayed.length === 1 ? 50 : roundOne(clamp(8 + (index / denominator) * 84 + laneRatio * 2.4, 6, 94)),
      y: roundOne(clamp(92 - Math.max(0, Math.min(10, rating)) * 8.2 + laneRatio * 8.4, 8, 94)),
      z,
      depth: roundOne((z - 50) / 38),
      radius: roundOne(Math.max(9, Math.min(24, 8 + rating * 0.9 + reviewLift))),
      opacity: roundOne(Math.max(0.48, Math.min(1, 0.48 + song.reviewLength / 520 + rating / 30))),
      ringStrength: roundOne(Math.max(0.32, Math.min(1, 0.32 + song.reviewLength / 520 + rating / 34))),
      color: region?.color ?? "#d8d5c8",
      groupName,
    };
  });

  return {
    songs,
    groups: groupUniverseSongs(songs, groupBy),
    totalCount: filtered.length,
    displayedCount: songs.length,
    truncated: filtered.length > songs.length,
    options: buildVisualizationOptions(entries),
  };
}

export function buildVisualizationOptions(entries: VisualizationEntry[]): VisualizationOptions {
  return {
    years: uniqueNumbers(entries.map((entry) => entry.year)).sort((a, b) => b - a),
    months: uniqueNumbers(entries.map((entry) => entry.month)).sort((a, b) => a - b),
    artistNames: uniqueStrings(entries.map((entry) => entry.artistName)),
    albumNames: uniqueStrings(entries.map((entry) => entry.albumName)),
    moods: uniqueStrings(entries.flatMap((entry) => entry.moods)),
    tags: uniqueStrings(entries.flatMap((entry) => entry.tags)),
  };
}

export function filterEntries(entries: VisualizationEntry[], filters: VisualizationFilters): VisualizationEntry[] {
  return entries.filter((entry) => {
    if (filters.year !== undefined && filters.year !== null && entry.year !== filters.year) return false;
    if (filters.month !== undefined && filters.month !== null && entry.month !== filters.month) return false;
    if (filters.artistName && entry.artistName !== filters.artistName) return false;
    if (filters.albumName && entry.albumName !== filters.albumName) return false;
    if (filters.mood && !entry.moods.includes(filters.mood)) return false;
    if (filters.tag && !entry.tags.some((tag) => genreMatchesFilter(tag, filters.tag as string))) return false;
    if (filters.minRating !== undefined && filters.minRating !== null && (entry.rating ?? 0) < filters.minRating) return false;
    if (filters.maxRating !== undefined && filters.maxRating !== null && (entry.rating ?? 0) > filters.maxRating) return false;
    return true;
  });
}

export function resolveRegionId(entry: VisualizationEntry) {
  const fromMoods = firstMatchedRegionId(entry.moods);
  if (fromMoods) return fromMoods;
  return firstMatchedRegionId(entry.tags) ?? UNCLASSIFIED_REGION_ID;
}

function firstMatchedRegionId(values: string[]) {
  const counts = new Map<string, number>();
  for (const value of values) {
    const regionId = REGION_BY_MOOD.get(value);
    if (!regionId) continue;
    counts.set(regionId, (counts.get(regionId) ?? 0) + 1);
  }
  let selectedId: string | null = null;
  let selectedCount = 0;
  for (const region of ABSTRACT_MAP_REGION_DEFS) {
    const count = counts.get(region.id) ?? 0;
    if (count > selectedCount) {
      selectedId = region.id;
      selectedCount = count;
    }
  }
  return selectedId;
}

function toVisualizationSong(entry: VisualizationEntry): VisualizationSong {
  return {
    id: entry.id,
    title: entry.songName ?? entry.title,
    artistName: entry.artistName,
    albumName: entry.albumName,
    songName: entry.songName,
    year: entry.year,
    month: entry.month,
    rating: entry.rating,
    moods: entry.moods,
    tags: entry.tags,
    listenedAt: entry.listenedAt,
    createdAt: entry.createdAt,
    reviewExcerpt: excerptText(entry.content, 88),
    reviewLength: visibleLength(entry.content),
    // ponytail: no play_count field exists in ReviewEntry; add real listening stats only after the schema stores them.
    playCount: 1,
  };
}

function groupUniverseSongs(songs: EmotionUniverseSong[], groupBy: UniverseGroupBy): EmotionUniverseGroup[] {
  const counts = new Map<string, number>();
  for (const song of songs) counts.set(song.groupName, (counts.get(song.groupName) ?? 0) + 1);
  return Array.from(counts.entries())
    .map(([name, songCount]) => ({ name, type: groupBy, songCount }))
    .sort((a, b) => b.songCount - a.songCount || a.name.localeCompare(b.name, "zh-CN"));
}

function groupNameFor(entry: VisualizationEntry, groupBy: UniverseGroupBy) {
  if (groupBy === "artist") return entry.artistName ?? "未填写艺术家";
  if (groupBy === "album") return entry.albumName ?? "未填写专辑";
  if (groupBy === "mood") return entry.moods[0] ?? "未填写情绪";
  if (groupBy === "tag") return entry.tags[0] ?? "未填写曲风";
  return `${entry.year}`;
}

function compareUniverseEntries(a: VisualizationEntry, b: VisualizationEntry) {
  const timeDiff = timeValue(a) - timeValue(b);
  if (timeDiff) return timeDiff;
  return a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id);
}

function timeValue(entry: VisualizationEntry) {
  const listened = parseTime(entry.listenedAt);
  if (listened !== null) return listened;
  if (Number.isInteger(entry.year)) return Date.UTC(entry.year, Math.max(0, (entry.month ?? 1) - 1), 1);
  return parseTime(entry.createdAt) ?? 0;
}

function parseTime(value: string | null) {
  if (!value) return null;
  const time = new Date(value).getTime();
  return Number.isNaN(time) ? null : time;
}

function excerptText(value: string, length: number) {
  const clean = value.replace(/\s+/g, " ").trim();
  return clean.length > length ? `${clean.slice(0, length)}...` : clean;
}

function visibleLength(value: string) {
  return value.replace(/\s+/g, "").length;
}

function uniqueStrings(values: Array<string | null>) {
  return Array.from(new Set(values.filter((value): value is string => !!value))).sort((a, b) => a.localeCompare(b, "zh-CN"));
}

function uniqueNumbers(values: Array<number | null>) {
  return Array.from(new Set(values.filter((value): value is number => Number.isInteger(value))));
}

function roundOne(value: number) {
  return Math.round(value * 10) / 10;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}
