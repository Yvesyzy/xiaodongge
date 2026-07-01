import { Capacitor } from "@capacitor/core";
import { CapacitorSQLite, SQLiteConnection, type capSQLiteSet, type SQLiteDBConnection } from "@capacitor-community/sqlite";
import { excerpt } from "./format";
import { buildLocalYearlySummary } from "./summary";
import { ENTRY_TYPES, type AlbumAggregate, type CoverKind, type CoverTarget, type EntryInput, type EntryType, type FrequencyItem, type ReviewEntry, type SongAggregate, type YearStats, type YearlySummary } from "./types";

const DB_NAME = "music_feelings_archive";
const ENTRIES_KEY = "music-feelings-mobile-entries";
const SUMMARIES_KEY = "music-feelings-mobile-summaries";
const COVERS_KEY = "music-feelings-mobile-covers";
const IMPORT_UNDO_KEY = "music-feelings-mobile-import-undo";

const schemaSql = `
CREATE TABLE IF NOT EXISTS ReviewEntry (
  id TEXT NOT NULL PRIMARY KEY,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  year INTEGER NOT NULL,
  month INTEGER,
  albumName TEXT,
  songName TEXT,
  artistName TEXT,
  content TEXT NOT NULL,
  tags TEXT,
  moods TEXT,
  rating INTEGER,
  listenedAt TEXT,
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS ReviewEntry_year_month_idx ON ReviewEntry(year, month);
CREATE INDEX IF NOT EXISTS ReviewEntry_albumName_idx ON ReviewEntry(albumName);
CREATE INDEX IF NOT EXISTS ReviewEntry_songName_idx ON ReviewEntry(songName);
CREATE INDEX IF NOT EXISTS ReviewEntry_artistName_idx ON ReviewEntry(artistName);
CREATE TABLE IF NOT EXISTS YearlySummary (
  id TEXT NOT NULL PRIMARY KEY,
  year INTEGER NOT NULL UNIQUE,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  sourceEntryCount INTEGER NOT NULL,
  generatedAt TEXT NOT NULL,
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS CoverImage (
  coverKey TEXT NOT NULL PRIMARY KEY,
  kind TEXT NOT NULL,
  albumName TEXT,
  songName TEXT,
  artistName TEXT,
  dataUrl TEXT NOT NULL,
  updatedAt TEXT NOT NULL
);
`;

type CoverRow = {
  coverKey: string;
  kind: CoverKind;
  albumName: string | null;
  songName: string | null;
  artistName: string | null;
  dataUrl: string;
  updatedAt: string;
};

class Store {
  private sqlite = new SQLiteConnection(CapacitorSQLite);
  private db: SQLiteDBConnection | null = null;
  private nativeReady = false;

  async init() {
    if (!Capacitor.isNativePlatform() || this.nativeReady) return;
    const existing = await this.sqlite.isConnection(DB_NAME, false).catch(() => ({ result: false }));
    this.db = existing.result
      ? await this.sqlite.retrieveConnection(DB_NAME, false)
      : await this.sqlite.createConnection(DB_NAME, false, "no-encryption", 1, false);
    const opened = await this.db.isDBOpen().catch(() => ({ result: false }));
    if (!opened.result) await this.db.open();
    await this.db.execute(schemaSql);
    this.nativeReady = true;
  }

  async listEntries() {
    await this.init();
    if (!Capacitor.isNativePlatform()) return readEntries().sort(sortEntries);
    const result = await this.dbReady().query("SELECT * FROM ReviewEntry ORDER BY year DESC, month DESC, createdAt DESC");
    return (result.values ?? []).map(rowToEntry);
  }

  async recentEntries(limit = 5) {
    return (await this.listEntries()).sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, limit);
  }

  async getEntry(id: string) {
    await this.init();
    if (!Capacitor.isNativePlatform()) return readEntries().find((entry) => entry.id === id) ?? null;
    const result = await this.dbReady().query("SELECT * FROM ReviewEntry WHERE id = ?", [id]);
    return result.values?.[0] ? rowToEntry(result.values[0]) : null;
  }

  async createEntry(input: EntryInput) {
    const now = new Date().toISOString();
    const entry: ReviewEntry = { ...input, id: crypto.randomUUID(), createdAt: now, updatedAt: now };
    validateEntry(entry);
    await this.init();
    if (!Capacitor.isNativePlatform()) {
      writeEntries([...readEntries(), entry]);
      return entry;
    }
    await this.dbReady().run(
      `INSERT INTO ReviewEntry (id, type, title, year, month, albumName, songName, artistName, content, tags, moods, rating, listenedAt, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      entryValues(entry),
    );
    return entry;
  }

  async updateEntry(id: string, input: EntryInput) {
    const old = await this.getEntry(id);
    if (!old) throw new Error("记录不存在");
    const entry: ReviewEntry = { ...input, id, createdAt: old.createdAt, updatedAt: new Date().toISOString() };
    validateEntry(entry);
    await this.init();
    if (!Capacitor.isNativePlatform()) {
      writeEntries(readEntries().map((item) => (item.id === id ? entry : item)));
      return entry;
    }
    await this.dbReady().run(
      `UPDATE ReviewEntry SET type=?, title=?, year=?, month=?, albumName=?, songName=?, artistName=?, content=?, tags=?, moods=?, rating=?, listenedAt=?, updatedAt=? WHERE id=?`,
      [entry.type, entry.title, entry.year, entry.month, entry.albumName, entry.songName, entry.artistName, entry.content, JSON.stringify(entry.tags), JSON.stringify(entry.moods), entry.rating, entry.listenedAt, entry.updatedAt, id],
    );
    return entry;
  }

  async deleteEntry(id: string) {
    await this.init();
    if (!Capacitor.isNativePlatform()) {
      writeEntries(readEntries().filter((entry) => entry.id !== id));
      return;
    }
    await this.dbReady().run("DELETE FROM ReviewEntry WHERE id = ?", [id]);
  }

  async searchEntries(query: string) {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    const entries = await this.listEntries();
    // ponytail: local phone archive; use SQLite FTS only when full-scan search becomes slow.
    return entries.filter((entry) => [entry.title, entry.content, entry.songName, entry.albumName, entry.artistName, entry.tags.join(" "), entry.moods.join(" ")].filter(Boolean).join(" ").toLowerCase().includes(q));
  }

  async albumAggregates() {
    const coverMap = await this.coverMap();
    const groups = group((await this.listEntries()).filter((entry) => entry.albumName), (entry) => JSON.stringify([entry.albumName, entry.artistName]));
    return Array.from(groups.values()).map((items): AlbumAggregate => {
      const latest = [...items].sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
      const albumName = latest.albumName as string;
      return { albumName, artistName: latest.artistName, coverDataUrl: coverMap.get(coverKey("album", { albumName, artistName: latest.artistName })) ?? null, years: years(items), recordCount: items.length, lastRecordedAt: latest.createdAt, summary: excerpt(latest.content) };
    }).sort((a, b) => b.lastRecordedAt.localeCompare(a.lastRecordedAt));
  }

  async songAggregates() {
    const coverMap = await this.coverMap();
    const groups = group((await this.listEntries()).filter((entry) => entry.songName), (entry) => JSON.stringify([entry.songName, entry.artistName, entry.albumName]));
    return Array.from(groups.values()).map((items): SongAggregate => {
      const latest = [...items].sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
      const songName = latest.songName as string;
      const ownCover = coverMap.get(coverKey("song", { songName, albumName: latest.albumName, artistName: latest.artistName }));
      const albumCover = latest.albumName ? coverMap.get(coverKey("album", { albumName: latest.albumName, artistName: latest.artistName })) : null;
      return { songName, artistName: latest.artistName, albumName: latest.albumName, coverDataUrl: ownCover ?? albumCover ?? null, years: years(items), recordCount: items.length, lastRecordedAt: latest.createdAt, summary: excerpt(latest.content) };
    }).sort((a, b) => b.lastRecordedAt.localeCompare(a.lastRecordedAt));
  }

  async getCover(kind: CoverKind, target: CoverTarget) {
    await this.init();
    const key = coverKey(kind, target);
    if (!Capacitor.isNativePlatform()) {
      const own = readCovers().find((cover) => cover.coverKey === key)?.dataUrl ?? null;
      if (own || kind !== "song" || !target.albumName) return own;
      return readCovers().find((cover) => cover.coverKey === coverKey("album", { albumName: target.albumName, artistName: target.artistName }))?.dataUrl ?? null;
    }
    const result = await this.dbReady().query("SELECT dataUrl FROM CoverImage WHERE coverKey = ?", [key]);
    const own = nullableString(result.values?.[0]?.dataUrl);
    if (own || kind !== "song" || !target.albumName) return own;
    const fallback = await this.dbReady().query("SELECT dataUrl FROM CoverImage WHERE coverKey = ?", [coverKey("album", { albumName: target.albumName, artistName: target.artistName })]);
    return nullableString(fallback.values?.[0]?.dataUrl);
  }

  async setCover(kind: CoverKind, target: CoverTarget, dataUrl: string) {
    if (kind === "album" && !target.albumName) throw new Error("缺少专辑名称");
    if (kind === "song" && !target.songName) throw new Error("缺少歌曲名称");
    const now = new Date().toISOString();
    const cover: CoverRow = { coverKey: coverKey(kind, target), kind, albumName: target.albumName, songName: target.songName ?? null, artistName: target.artistName, dataUrl, updatedAt: now };
    await this.init();
    if (!Capacitor.isNativePlatform()) {
      writeCovers([...readCovers().filter((item) => item.coverKey !== cover.coverKey), cover]);
      return;
    }
    await this.dbReady().run(
      `INSERT OR REPLACE INTO CoverImage (coverKey, kind, albumName, songName, artistName, dataUrl, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [cover.coverKey, cover.kind, cover.albumName, cover.songName, cover.artistName, cover.dataUrl, cover.updatedAt],
    );
  }

  async getYearStats(year: number) {
    return calculateYearStats(year, (await this.listEntries()).filter((entry) => entry.year === year));
  }

  async getSummary(year: number) {
    await this.init();
    if (!Capacitor.isNativePlatform()) return readSummaries().find((summary) => summary.year === year) ?? null;
    const result = await this.dbReady().query("SELECT * FROM YearlySummary WHERE year = ?", [year]);
    return result.values?.[0] ? rowToSummary(result.values[0]) : null;
  }

  async generateSummary(year: number) {
    const entries = (await this.listEntries()).filter((entry) => entry.year === year).sort((a, b) => (a.month ?? 0) - (b.month ?? 0) || a.createdAt.localeCompare(b.createdAt));
    if (!entries.length) throw new Error("该年份没有记录，无法生成年度总结");
    const now = new Date().toISOString();
    const summary: YearlySummary = {
      id: crypto.randomUUID(),
      year,
      title: `${year} 年音乐感受总结`,
      content: buildLocalYearlySummary(year, entries, calculateYearStats(year, entries)),
      sourceEntryCount: entries.length,
      generatedAt: now,
      createdAt: now,
      updatedAt: now,
    };
    await this.init();
    if (!Capacitor.isNativePlatform()) {
      writeSummaries([...readSummaries().filter((item) => item.year !== year), summary]);
      return summary;
    }
    await this.dbReady().run(
      `INSERT OR REPLACE INTO YearlySummary (id, year, title, content, sourceEntryCount, generatedAt, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [summary.id, summary.year, summary.title, summary.content, summary.sourceEntryCount, summary.generatedAt, summary.createdAt, summary.updatedAt],
    );
    return summary;
  }

  async exportBackup() {
    return JSON.stringify({
      version: 1,
      exportedAt: new Date().toISOString(),
      entries: await this.listEntries(),
      summaries: await this.listSummaries(),
      covers: await this.listCovers(),
    }, null, 2);
  }

  async importBackup(raw: string) {
    const backup = parseBackup(raw);
    const undoBackup = await this.exportBackup();
    try {
      localStorage.setItem(IMPORT_UNDO_KEY, undoBackup);
    } catch {
      throw new Error("无法保存导入前快照，已取消导入");
    }
    await this.writeBackup(backup);
  }

  async restoreImportUndo() {
    const raw = localStorage.getItem(IMPORT_UNDO_KEY);
    if (!raw) throw new Error("没有可撤销的导入");
    await this.writeBackup(parseBackup(raw));
    localStorage.removeItem(IMPORT_UNDO_KEY);
  }

  previewImportUndo() {
    const raw = localStorage.getItem(IMPORT_UNDO_KEY);
    if (!raw) return null;
    try {
      return summarizeBackup(parseBackup(raw));
    } catch {
      localStorage.removeItem(IMPORT_UNDO_KEY);
      return null;
    }
  }

  previewBackup(raw: string) {
    return summarizeBackup(parseBackup(raw));
  }

  private async writeBackup(backup: BackupData) {
    await this.init();
    if (!Capacitor.isNativePlatform()) {
      const oldEntries = localStorage.getItem(ENTRIES_KEY);
      const oldSummaries = localStorage.getItem(SUMMARIES_KEY);
      const oldCovers = localStorage.getItem(COVERS_KEY);
      try {
        writeEntries(backup.entries);
        writeSummaries(backup.summaries);
        writeCovers(backup.covers);
      } catch (error) {
        restoreStorage(ENTRIES_KEY, oldEntries);
        restoreStorage(SUMMARIES_KEY, oldSummaries);
        restoreStorage(COVERS_KEY, oldCovers);
        throw error;
      }
      return;
    }

    const set: capSQLiteSet[] = [
      { statement: "DELETE FROM ReviewEntry" },
      { statement: "DELETE FROM YearlySummary" },
      { statement: "DELETE FROM CoverImage" },
      ...backup.entries.map((entry) => ({ statement: "INSERT INTO ReviewEntry (id, type, title, year, month, albumName, songName, artistName, content, tags, moods, rating, listenedAt, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", values: entryValues(entry) })),
      ...backup.summaries.map((summary) => ({ statement: "INSERT INTO YearlySummary (id, year, title, content, sourceEntryCount, generatedAt, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)", values: summaryValues(summary) })),
      ...backup.covers.map((cover) => ({ statement: "INSERT INTO CoverImage (coverKey, kind, albumName, songName, artistName, dataUrl, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?)", values: coverValues(cover) })),
    ];
    await this.dbReady().executeSet(set, true);
  }

  private dbReady() {
    if (!this.db) throw new Error("数据库未初始化");
    return this.db;
  }

  private async coverMap() {
    await this.init();
    if (!Capacitor.isNativePlatform()) return new Map(readCovers().map((cover) => [cover.coverKey, cover.dataUrl]));
    const result = await this.dbReady().query("SELECT coverKey, dataUrl FROM CoverImage");
    return new Map((result.values ?? []).map((row) => [String(row.coverKey), String(row.dataUrl)]));
  }

  private async listSummaries() {
    await this.init();
    if (!Capacitor.isNativePlatform()) return readSummaries();
    const result = await this.dbReady().query("SELECT * FROM YearlySummary ORDER BY year DESC");
    return (result.values ?? []).map(rowToSummary);
  }

  private async listCovers() {
    await this.init();
    if (!Capacitor.isNativePlatform()) return readCovers();
    const result = await this.dbReady().query("SELECT * FROM CoverImage ORDER BY updatedAt DESC");
    return (result.values ?? []).map(rowToCover);
  }
}

export const store = new Store();

export function parseList(value: string) {
  return Array.from(new Set(value.split(/[,，\n]/).map((item) => item.trim()).filter(Boolean)));
}

export function calculateYearStats(year: number, entries: ReviewEntry[]): YearStats {
  const ratings = entries.map((entry) => entry.rating).filter((rating): rating is number => rating !== null);
  return {
    year,
    totalEntries: entries.length,
    monthCount: new Set(entries.map((entry) => entry.month).filter((month): month is number => month !== null)).size,
    albumCount: new Set(entries.map((entry) => entry.albumName).filter(Boolean)).size,
    songCount: new Set(entries.map((entry) => entry.songName).filter(Boolean)).size,
    topTags: topItems(entries.flatMap((entry) => entry.tags)),
    topMoods: topItems(entries.flatMap((entry) => entry.moods)),
    averageRating: ratings.length ? Math.round((ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length) * 10) / 10 : null,
    mostActiveMonth: topItems(entries.map((entry) => (entry.month ? `${entry.month} 月` : "")))[0] ?? null,
    topAlbum: topItems(entries.map((entry) => entry.albumName ?? ""))[0] ?? null,
    topSong: topItems(entries.map((entry) => entry.songName ?? ""))[0] ?? null,
  };
}

function rowToEntry(row: Record<string, unknown>): ReviewEntry {
  return {
    id: String(row.id),
    type: String(row.type) as EntryType,
    title: String(row.title),
    year: Number(row.year),
    month: row.month === null || row.month === undefined ? null : Number(row.month),
    albumName: nullableString(row.albumName),
    songName: nullableString(row.songName),
    artistName: nullableString(row.artistName),
    content: String(row.content),
    tags: decodeList(nullableString(row.tags)),
    moods: decodeList(nullableString(row.moods)),
    rating: row.rating === null || row.rating === undefined ? null : Number(row.rating),
    listenedAt: nullableString(row.listenedAt),
    createdAt: String(row.createdAt),
    updatedAt: String(row.updatedAt),
  };
}

function rowToSummary(row: Record<string, unknown>): YearlySummary {
  return {
    id: String(row.id),
    year: Number(row.year),
    title: String(row.title),
    content: String(row.content),
    sourceEntryCount: Number(row.sourceEntryCount),
    generatedAt: String(row.generatedAt),
    createdAt: String(row.createdAt),
    updatedAt: String(row.updatedAt),
  };
}

function rowToCover(row: Record<string, unknown>): CoverRow {
  return {
    coverKey: String(row.coverKey),
    kind: String(row.kind) as CoverKind,
    albumName: nullableString(row.albumName),
    songName: nullableString(row.songName),
    artistName: nullableString(row.artistName),
    dataUrl: String(row.dataUrl),
    updatedAt: String(row.updatedAt),
  };
}

function entryValues(entry: ReviewEntry) {
  return [entry.id, entry.type, entry.title, entry.year, entry.month, entry.albumName, entry.songName, entry.artistName, entry.content, JSON.stringify(entry.tags), JSON.stringify(entry.moods), entry.rating, entry.listenedAt, entry.createdAt, entry.updatedAt];
}

function summaryValues(summary: YearlySummary) {
  return [summary.id, summary.year, summary.title, summary.content, summary.sourceEntryCount, summary.generatedAt, summary.createdAt, summary.updatedAt];
}

function coverValues(cover: CoverRow) {
  return [cover.coverKey, cover.kind, cover.albumName, cover.songName, cover.artistName, cover.dataUrl, cover.updatedAt];
}

function validateEntry(entry: ReviewEntry) {
  if (!ENTRY_TYPES.includes(entry.type)) throw new Error("记录类型必须是 year / month / album / song");
  if (!entry.title.trim()) throw new Error("标题不能为空");
  if (!entry.content.trim()) throw new Error("正文内容不能为空");
  if (!Number.isInteger(entry.year) || entry.year < 1 || entry.year > 9999) throw new Error("年份范围必须是 1-9999");
  if (entry.month !== null && (!Number.isInteger(entry.month) || entry.month < 1 || entry.month > 12)) throw new Error("月份范围必须是 1-12");
  if (entry.rating !== null && (!Number.isInteger(entry.rating) || entry.rating < 1 || entry.rating > 10)) throw new Error("评分范围必须是 1-10");
}

type BackupData = {
  version: 1;
  exportedAt: string;
  entries: ReviewEntry[];
  summaries: YearlySummary[];
  covers: CoverRow[];
};

function parseBackup(raw: string): BackupData {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("备份 JSON 格式错误");
  }
  if (!isRecord(parsed)) throw new Error("备份内容必须是 JSON 对象");
  if (parsed.version !== 1) throw new Error("备份版本不支持");
  if (!isValidDateString(parsed.exportedAt)) throw new Error("备份导出时间无效");

  const entries = readArray(parsed.entries, "entries").map(readEntry);
  const summaries = readArray(parsed.summaries, "summaries").map(readSummary);
  const covers = readArray(parsed.covers, "covers").map(readCover);
  return { version: 1, exportedAt: parsed.exportedAt, entries, summaries, covers };
}

function summarizeBackup(backup: BackupData) {
  return {
    exportedAt: backup.exportedAt,
    entryCount: backup.entries.length,
    summaryCount: backup.summaries.length,
    coverCount: backup.covers.length,
  };
}

function readEntry(value: unknown): ReviewEntry {
  if (!isRecord(value)) throw new Error("entries 必须是记录对象数组");
  const entry: ReviewEntry = {
    id: readString(value.id, "entries.id"),
    type: readString(value.type, "entries.type") as EntryType,
    title: readString(value.title, "entries.title"),
    year: readInt(value.year, "entries.year"),
    month: readNullableInt(value.month, "entries.month"),
    albumName: readNullableField(value.albumName, "entries.albumName"),
    songName: readNullableField(value.songName, "entries.songName"),
    artistName: readNullableField(value.artistName, "entries.artistName"),
    content: readString(value.content, "entries.content"),
    tags: readStringArray(value.tags, "entries.tags"),
    moods: readStringArray(value.moods, "entries.moods"),
    rating: readNullableInt(value.rating, "entries.rating"),
    listenedAt: readNullableDate(value.listenedAt, "entries.listenedAt"),
    createdAt: readDate(value.createdAt, "entries.createdAt"),
    updatedAt: readDate(value.updatedAt, "entries.updatedAt"),
  };
  validateEntry(entry);
  return entry;
}

function readSummary(value: unknown): YearlySummary {
  if (!isRecord(value)) throw new Error("summaries 必须是总结对象数组");
  return {
    id: readString(value.id, "summaries.id"),
    year: readInt(value.year, "summaries.year"),
    title: readString(value.title, "summaries.title"),
    content: readString(value.content, "summaries.content"),
    sourceEntryCount: readInt(value.sourceEntryCount, "summaries.sourceEntryCount"),
    generatedAt: readDate(value.generatedAt, "summaries.generatedAt"),
    createdAt: readDate(value.createdAt, "summaries.createdAt"),
    updatedAt: readDate(value.updatedAt, "summaries.updatedAt"),
  };
}

function readCover(value: unknown): CoverRow {
  if (!isRecord(value)) throw new Error("covers 必须是封面对象数组");
  const kind = readString(value.kind, "covers.kind") as CoverKind;
  if (kind !== "album" && kind !== "song") throw new Error("covers.kind 必须是 album 或 song");
  const albumName = readNullableField(value.albumName, "covers.albumName");
  const songName = readNullableField(value.songName, "covers.songName");
  const artistName = readNullableField(value.artistName, "covers.artistName");
  const key = coverKey(kind, { albumName, songName, artistName });
  if (readString(value.coverKey, "covers.coverKey") !== key) throw new Error("covers.coverKey 与封面信息不匹配");
  return {
    coverKey: key,
    kind,
    albumName,
    songName,
    artistName,
    dataUrl: readString(value.dataUrl, "covers.dataUrl"),
    updatedAt: readDate(value.updatedAt, "covers.updatedAt"),
  };
}

function readArray(value: unknown, key: string) {
  if (!Array.isArray(value)) throw new Error(`${key} 必须是数组`);
  return value;
}

function readString(value: unknown, key: string) {
  if (typeof value !== "string") throw new Error(`${key} 必须是字符串`);
  return value;
}

function readNullableField(value: unknown, key: string) {
  if (value === null) return null;
  return readString(value, key);
}

function readStringArray(value: unknown, key: string): string[] {
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) throw new Error(`${key} 必须是字符串数组`);
  return value;
}

function readInt(value: unknown, key: string): number {
  if (!Number.isInteger(value)) throw new Error(`${key} 必须是整数`);
  return value as number;
}

function readNullableInt(value: unknown, key: string): number | null {
  if (value === null) return null;
  return readInt(value, key);
}

function readDate(value: unknown, key: string) {
  if (!isValidDateString(value)) throw new Error(`${key} 必须是有效时间字符串`);
  return value;
}

function readNullableDate(value: unknown, key: string) {
  if (value === null) return null;
  return readDate(value, key);
}

function isValidDateString(value: unknown): value is string {
  return typeof value === "string" && !Number.isNaN(new Date(value).getTime());
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function readEntries() {
  return readJson<ReviewEntry[]>(ENTRIES_KEY, []);
}

function writeEntries(entries: ReviewEntry[]) {
  localStorage.setItem(ENTRIES_KEY, JSON.stringify(entries));
}

function readSummaries() {
  return readJson<YearlySummary[]>(SUMMARIES_KEY, []);
}

function writeSummaries(summaries: YearlySummary[]) {
  localStorage.setItem(SUMMARIES_KEY, JSON.stringify(summaries));
}

function readCovers() {
  return readJson<CoverRow[]>(COVERS_KEY, []);
}

function writeCovers(covers: CoverRow[]) {
  localStorage.setItem(COVERS_KEY, JSON.stringify(covers));
}

function restoreStorage(key: string, value: string | null) {
  if (value === null) {
    localStorage.removeItem(key);
    return;
  }
  localStorage.setItem(key, value);
}

function readJson<T>(key: string, fallback: T): T {
  const raw = localStorage.getItem(key);
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function decodeList(value: string | null) {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string" && item.trim().length > 0) : [];
  } catch {
    return [];
  }
}

function nullableString(value: unknown) {
  return typeof value === "string" && value.length ? value : null;
}

function sortEntries(a: ReviewEntry, b: ReviewEntry) {
  return b.year - a.year || (b.month ?? 0) - (a.month ?? 0) || b.createdAt.localeCompare(a.createdAt);
}

function topItems(values: string[], limit = 8): FrequencyItem[] {
  const map = new Map<string, number>();
  for (const value of values) {
    if (!value) continue;
    map.set(value, (map.get(value) ?? 0) + 1);
  }
  return Array.from(map.entries()).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, "zh-CN")).slice(0, limit);
}

function years(entries: ReviewEntry[]) {
  return Array.from(new Set(entries.map((entry) => entry.year))).sort((a, b) => b - a);
}

function coverKey(kind: CoverKind, target: CoverTarget) {
  return JSON.stringify([kind, target.albumName ?? "", target.songName ?? "", target.artistName ?? ""]);
}

function group<T>(items: T[], keyOf: (item: T) => string) {
  const map = new Map<string, T[]>();
  for (const item of items) map.set(keyOf(item), [...(map.get(keyOf(item)) ?? []), item]);
  return map;
}
