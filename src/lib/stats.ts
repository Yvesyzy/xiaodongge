import { prisma } from "./prisma";
import { entrySearchText, serializeEntry } from "./entry";
import type { AlbumAggregate, FrequencyItem, SerializedEntry, SongAggregate, YearStats } from "./types";
import { excerpt } from "./format";

export async function getAllEntries() {
  const entries = await prisma.reviewEntry.findMany({
    orderBy: [{ year: "desc" }, { month: "desc" }, { createdAt: "desc" }],
  });
  return entries.map(serializeEntry);
}

export async function getRecentEntries(limit = 5) {
  const entries = await prisma.reviewEntry.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
  });
  return entries.map(serializeEntry);
}

export async function searchEntries(query: string) {
  const q = query.trim().toLowerCase();
  if (!q) return [];

  const entries = await getAllEntries();
  // ponytail: local SQLite archive; switch to SQLite FTS when records become too many for a full scan.
  return entries.filter((entry) => entrySearchText(entry).includes(q));
}

export async function getYearStats(year: number) {
  const entries = await prisma.reviewEntry.findMany({
    where: { year },
    orderBy: [{ month: "asc" }, { createdAt: "asc" }],
  });
  return calculateYearStats(year, entries.map(serializeEntry));
}

export function calculateYearStats(year: number, entries: SerializedEntry[]): YearStats {
  const monthValues = new Set(entries.map((entry) => entry.month).filter((month): month is number => month !== null));
  const albumValues = new Set(entries.map((entry) => entry.albumName).filter(isString));
  const songValues = new Set(entries.map((entry) => entry.songName).filter(isString));
  const ratings = entries.map((entry) => entry.rating).filter((rating): rating is number => rating !== null);
  const monthCounts = countValues(entries.map((entry) => (entry.month ? `${entry.month} 月` : null)));

  return {
    year,
    totalEntries: entries.length,
    monthCount: monthValues.size,
    albumCount: albumValues.size,
    songCount: songValues.size,
    topTags: topItems(entries.flatMap((entry) => entry.tags)),
    topMoods: topItems(entries.flatMap((entry) => entry.moods)),
    averageRating: ratings.length ? roundOne(ratings.reduce((sum, item) => sum + item, 0) / ratings.length) : null,
    mostActiveMonth: topItemsFromMap(monthCounts)[0] ?? null,
    topAlbum: topItems(entries.map((entry) => entry.albumName).filter(isString))[0] ?? null,
    topSong: topItems(entries.map((entry) => entry.songName).filter(isString))[0] ?? null,
  };
}

export async function getAlbumAggregates(): Promise<AlbumAggregate[]> {
  const entries = await getAllEntries();
  const groups = new Map<string, SerializedEntry[]>();

  for (const entry of entries) {
    if (!entry.albumName) continue;
    const key = JSON.stringify([entry.albumName, entry.artistName]);
    groups.set(key, [...(groups.get(key) ?? []), entry]);
  }

  return Array.from(groups.values())
    .map((items) => {
      const latest = items[0];
      return {
        albumName: latest.albumName as string,
        artistName: latest.artistName,
        years: sortedYears(items),
        recordCount: items.length,
        lastRecordedAt: latest.createdAt,
        summary: excerpt(latest.content),
      };
    })
    .sort((a, b) => b.lastRecordedAt.localeCompare(a.lastRecordedAt));
}

export async function getSongAggregates(): Promise<SongAggregate[]> {
  const entries = await getAllEntries();
  const groups = new Map<string, SerializedEntry[]>();

  for (const entry of entries) {
    if (!entry.songName) continue;
    const key = JSON.stringify([entry.songName, entry.artistName, entry.albumName]);
    groups.set(key, [...(groups.get(key) ?? []), entry]);
  }

  return Array.from(groups.values())
    .map((items) => {
      const latest = items[0];
      return {
        songName: latest.songName as string,
        artistName: latest.artistName,
        albumName: latest.albumName,
        years: sortedYears(items),
        recordCount: items.length,
        lastRecordedAt: latest.createdAt,
        summary: excerpt(latest.content),
      };
    })
    .sort((a, b) => b.lastRecordedAt.localeCompare(a.lastRecordedAt));
}

export async function getEntriesByAlbum(albumName: string, artistName: string | null) {
  const entries = await prisma.reviewEntry.findMany({
    where: { albumName, artistName },
    orderBy: [{ year: "desc" }, { month: "desc" }, { createdAt: "desc" }],
  });
  return entries.map(serializeEntry);
}

export async function getEntriesBySong(songName: string, artistName: string | null, albumName: string | null) {
  const entries = await prisma.reviewEntry.findMany({
    where: { songName, artistName, albumName },
    orderBy: [{ year: "desc" }, { month: "desc" }, { createdAt: "desc" }],
  });
  return entries.map(serializeEntry);
}

function topItems(values: string[], limit = 8) {
  return topItemsFromMap(countValues(values), limit);
}

function topItemsFromMap(map: Map<string, number>, limit = 8): FrequencyItem[] {
  return Array.from(map.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, "zh-CN"))
    .slice(0, limit);
}

function countValues(values: Array<string | null>) {
  const map = new Map<string, number>();
  for (const value of values) {
    if (!value) continue;
    map.set(value, (map.get(value) ?? 0) + 1);
  }
  return map;
}

function sortedYears(entries: SerializedEntry[]) {
  return Array.from(new Set(entries.map((entry) => entry.year))).sort((a, b) => b - a);
}

function roundOne(value: number) {
  return Math.round(value * 10) / 10;
}

function isString(value: string | null): value is string {
  return typeof value === "string" && value.length > 0;
}
