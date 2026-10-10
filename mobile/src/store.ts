import { Capacitor } from "@capacitor/core";
import { privacyFetch, requirePrivacyConsent } from "./codex_privacy";
import { CapacitorSQLite, SQLiteConnection, type capSQLiteSet, type SQLiteDBConnection } from "@capacitor-community/sqlite";
import { buildAbstractMusicMap, buildVisualizationOptions, type VisualizationFilters } from "../../shared/visualizations";
import { fetchHistoricalWeather, fetchHistoricalWeatherRange, parseWeatherLocation, parseWeatherRecord, searchWeatherLocations, type WeatherLocation, type WeatherRecord } from "../../shared/listeningContext";
import type { ListeningLayer, SemanticOverride } from "../../shared/listeningAnalysis";
import { localDateOf } from "./format";
import { formatEntriesCsv, formatEntriesTxt } from "./exportFormats";
import { buildDayListeningSnapshot, buildMonthlyListeningSnapshot, buildYearlyListeningSnapshot, inRecordingPeriod, monthlySnapshotToMarkdown, parseMonthlyListeningSnapshot, parseYearlyListeningSnapshot, yearlySnapshotToMarkdown, type ListeningDaySnapshot, type MonthlyListeningSnapshot, type YearlyListeningSnapshot } from "./listeningYearbook";
import { readMusicMetadata } from "./musicMetadata";
import { groupMusicEntries } from "./musicIdentity";
import { BACKUP_HEALTH_KEY, readBackupAppData, readPreferredQuote, readSemanticOverride, readYearTopAlbums, SEMANTIC_OVERRIDES_KEY, TOP_ALBUMS_PREFIX, WEATHER_LOCATION_KEY } from "../../shared/backupAppData";
import type { BackupPreview } from "./backupHealth";
import { listRawEntryDrafts, readStoredEntryDraft, MAX_NEW_DRAFTS, type StoredEntryDraft } from "./entryDraft";
import { acquireStorageSession, clearRecoveryError, RESTORE_GATE_KEY, WEB_RESTORE_JOURNAL_KEY, withRestoreLock, withStorageAccess, markRecoveryError } from "./codex_restoreState";
import { preserveStorageCorruption, readSafeJson, readStorageCorruptions } from "./storageSafety";
import { ENTRY_TYPES, type AlbumAggregate, type CoverKind, type CoverTarget, type EntryInput, type EntryType, type FrequencyItem, type ListeningMoment, type ListeningMomentInput, type MonthlySummary, type RatingModifier, type ReviewEntry, type SongAggregate, type YearStats, type YearlySummary } from "./types";

const DB_NAME = "music_feelings_archive";
const ENTRIES_KEY = "music-feelings-mobile-entries";
const SUMMARIES_KEY = "music-feelings-mobile-summaries";
const MONTHLY_SUMMARIES_KEY = "music-feelings-mobile-monthly-summaries";
const COVERS_KEY = "music-feelings-mobile-covers";
const LISTENING_MOMENTS_KEY = "music-feelings-mobile-listening-moments";
const APP_DATA_KEY = "music-feelings-mobile-app-data";
const IMPORT_UNDO_KEY = "music-feelings-mobile-import-undo";
const NATIVE_RESTORE_JOURNAL_KEY = "codex-restore-journal:v1";
const WEB_DATA_KEYS = [ENTRIES_KEY, SUMMARIES_KEY, MONTHLY_SUMMARIES_KEY, COVERS_KEY, LISTENING_MOMENTS_KEY, APP_DATA_KEY] as const;

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
  musicMetadata TEXT,
  content TEXT NOT NULL,
  tags TEXT,
  moods TEXT,
  rating REAL,
  ratingModifier TEXT,
  ratingProduction REAL,
  ratingSongwriting REAL,
  ratingLyrics REAL,
  ratingComposition REAL,
  ratingVocals REAL,
  ratingOriginality REAL,
  ratingResonance REAL,
  compositeRatingLocked INTEGER NOT NULL DEFAULT 0,
  firstListenedAt TEXT,
  listenedAt TEXT,
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS ReviewEntry_year_month_idx ON ReviewEntry(year, month);
CREATE INDEX IF NOT EXISTS ReviewEntry_albumName_idx ON ReviewEntry(albumName);
CREATE INDEX IF NOT EXISTS ReviewEntry_songName_idx ON ReviewEntry(songName);
CREATE INDEX IF NOT EXISTS ReviewEntry_artistName_idx ON ReviewEntry(artistName);
CREATE TABLE IF NOT EXISTS ListeningMoment (
  id TEXT NOT NULL PRIMARY KEY,
  entryId TEXT NOT NULL,
  listenedAt TEXT NOT NULL,
  rating REAL,
  ratingModifier TEXT,
  moods TEXT,
  content TEXT NOT NULL,
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL,
  FOREIGN KEY (entryId) REFERENCES ReviewEntry(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS ListeningMoment_entryId_idx ON ListeningMoment(entryId);
CREATE TABLE IF NOT EXISTS YearlySummary (
  id TEXT NOT NULL PRIMARY KEY,
  year INTEGER NOT NULL UNIQUE,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  analysisJson TEXT,
  analysisVersion INTEGER,
  sourceFingerprint TEXT,
  sourceEntryCount INTEGER NOT NULL,
  generatedAt TEXT NOT NULL,
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS MonthlySummary (
  id TEXT NOT NULL PRIMARY KEY,
  year INTEGER NOT NULL,
  month INTEGER NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  themeId TEXT NOT NULL,
  analysisJson TEXT NOT NULL,
  analysisVersion INTEGER NOT NULL,
  sourceFingerprint TEXT,
  sourceEntryCount INTEGER NOT NULL,
  generatedAt TEXT NOT NULL,
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL,
  UNIQUE(year, month)
);
CREATE INDEX IF NOT EXISTS MonthlySummary_year_month_idx ON MonthlySummary(year, month);
CREATE TABLE IF NOT EXISTS CoverImage (
  coverKey TEXT NOT NULL PRIMARY KEY,
  kind TEXT NOT NULL,
  albumName TEXT,
  songName TEXT,
  artistName TEXT,
  dataUrl TEXT NOT NULL,
  updatedAt TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS AppData (
  key TEXT NOT NULL PRIMARY KEY,
  value TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS UndoBackup (
  id INTEGER NOT NULL PRIMARY KEY CHECK (id = 1),
  value TEXT NOT NULL
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
  private initPromise: Promise<void> | null = null;

  async init() {
    if (!Capacitor.isNativePlatform() || this.nativeReady) return;
    if (!this.initPromise) {
      this.initPromise = this.openNativeDatabase().catch((error) => {
        this.initPromise = null;
        throw error;
      });
    }
    return this.initPromise;
  }

  private async openNativeDatabase() {
    const existing = await this.sqlite.isConnection(DB_NAME, false).catch(() => ({ result: false }));
    this.db = existing.result
      ? await this.sqlite.retrieveConnection(DB_NAME, false)
      : await this.sqlite.createConnection(DB_NAME, false, "no-encryption", 1, false);
    const opened = await this.db.isDBOpen().catch(() => ({ result: false }));
    if (!opened.result) await this.db.open();
    await this.db.execute(schemaSql);
    const columns = await this.db.query("PRAGMA table_info(ReviewEntry)");
    if (!(columns.values ?? []).some((column) => column.name === "musicMetadata")) {
      await this.db.run("ALTER TABLE ReviewEntry ADD COLUMN musicMetadata TEXT");
    }
    if (!(columns.values ?? []).some((column) => column.name === "ratingModifier")) {
      await this.db.run("ALTER TABLE ReviewEntry ADD COLUMN ratingModifier TEXT");
    }
    if (!(columns.values ?? []).some((column) => column.name === "firstListenedAt")) {
      await this.db.run("ALTER TABLE ReviewEntry ADD COLUMN firstListenedAt TEXT");
    }
    for (const dim of ["ratingProduction", "ratingSongwriting", "ratingLyrics", "ratingComposition", "ratingVocals", "ratingOriginality", "ratingResonance"] as const) {
      if (!(columns.values ?? []).some((column) => column.name === dim)) {
        await this.db.run(`ALTER TABLE ReviewEntry ADD COLUMN ${dim} REAL`);
      }
    }
    if (!(columns.values ?? []).some((column) => column.name === "compositeRatingLocked")) {
      await this.db.run("ALTER TABLE ReviewEntry ADD COLUMN compositeRatingLocked INTEGER NOT NULL DEFAULT 0");
    }
    const summaryColumns = await this.db.query("PRAGMA table_info(YearlySummary)");
    for (const [name, definition] of [["analysisJson", "TEXT"], ["analysisVersion", "INTEGER"], ["sourceFingerprint", "TEXT"]] as const) {
      if (!(summaryColumns.values ?? []).some((column) => column.name === name)) await this.db.run(`ALTER TABLE YearlySummary ADD COLUMN ${name} ${definition}`);
    }
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
      await this.markGeneratedSummariesStale([entry]);
      return entry;
    }
    await this.dbReady().run(
      `INSERT INTO ReviewEntry (id, type, title, year, month, albumName, songName, artistName, musicMetadata, content, tags, moods, rating, ratingModifier, ratingProduction, ratingSongwriting, ratingLyrics, ratingComposition, ratingVocals, ratingOriginality, ratingResonance, compositeRatingLocked, firstListenedAt, listenedAt, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      entryValues(entry),
    );
    await this.markGeneratedSummariesStale([entry]);
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
      await this.markGeneratedSummariesStale([old, entry]);
      return entry;
    }
    await this.dbReady().run(
      `UPDATE ReviewEntry SET type=?, title=?, year=?, month=?, albumName=?, songName=?, artistName=?, musicMetadata=?, content=?, tags=?, moods=?, rating=?, ratingModifier=?, ratingProduction=?, ratingSongwriting=?, ratingLyrics=?, ratingComposition=?, ratingVocals=?, ratingOriginality=?, ratingResonance=?, compositeRatingLocked=?, firstListenedAt=?, listenedAt=?, updatedAt=? WHERE id=?`,
      [entry.type, entry.title, entry.year, entry.month, entry.albumName, entry.songName, entry.artistName, encodeMusicMetadata(entry.musicMetadata), entry.content, JSON.stringify(entry.tags), JSON.stringify(entry.moods), entry.rating, entry.ratingModifier, entry.ratingProduction, entry.ratingSongwriting, entry.ratingLyrics ?? null, entry.ratingComposition ?? null, entry.ratingVocals ?? null, entry.ratingOriginality, entry.ratingResonance, entry.compositeRatingLocked ? 1 : 0, entry.firstListenedAt, entry.listenedAt, entry.updatedAt, id],
    );
    await this.markGeneratedSummariesStale([old, entry]);
    return entry;
  }

  async deleteEntry(id: string) {
    const existing = await this.getEntry(id);
    await this.init();
    if (!Capacitor.isNativePlatform()) {
      writeEntries(readEntries().filter((entry) => entry.id !== id));
      // 与原生 SQLite 的 ON DELETE CASCADE 对齐：删除乐评时同步清理其追加记录
      writeListeningMoments(readListeningMoments().filter((moment) => moment.entryId !== id));
      if (existing) await this.markGeneratedSummariesStale([existing]);
      return;
    }
    await this.dbReady().executeSet([
      { statement: "DELETE FROM ListeningMoment WHERE entryId = ?", values: [id] },
      { statement: "DELETE FROM ReviewEntry WHERE id = ?", values: [id] },
    ], true);
    if (existing) await this.markGeneratedSummariesStale([existing]);
  }

  private async markGeneratedSummariesStale(entries: ReviewEntry[]) {
    const years = unique(entries.map((entry) => new Date(entry.createdAt).getFullYear()));
    const months = unique(entries.map((entry) => `${new Date(entry.createdAt).getFullYear()}-${new Date(entry.createdAt).getMonth() + 1}`));
    if (!years.length && !months.length) return;
    await this.init();
    if (!Capacitor.isNativePlatform()) {
      writeSummaries(readSummaries().map((summary) => years.includes(summary.year) ? { ...summary, sourceFingerprint: null } : summary));
      writeMonthlySummaries(readMonthlySummaries().map((summary) => months.includes(`${summary.year}-${summary.month}`) ? { ...summary, sourceFingerprint: null } : summary));
      return;
    }
    if (years.length) await this.dbReady().run(`UPDATE YearlySummary SET sourceFingerprint = NULL WHERE year IN (${years.map(() => "?").join(", ")})`, years);
    for (const key of months) {
      const [year, month] = key.split("-").map(Number);
      await this.dbReady().run("UPDATE MonthlySummary SET sourceFingerprint = NULL WHERE year = ? AND month = ?", [year, month]);
    }
  }

  private async markAllAnalysisStale() {
    await this.init();
    if (!Capacitor.isNativePlatform()) {
      writeSummaries(readSummaries().map((summary) => summary.analysisJson ? { ...summary, sourceFingerprint: null } : summary));
      writeMonthlySummaries(readMonthlySummaries().map((summary) => ({ ...summary, sourceFingerprint: null })));
      return;
    }
    await this.dbReady().run("UPDATE YearlySummary SET sourceFingerprint = NULL WHERE analysisJson IS NOT NULL");
    await this.dbReady().run("UPDATE MonthlySummary SET sourceFingerprint = NULL");
  }

  private async markContextSummariesStale(date: string) {
    const year = Number(date.slice(0, 4));
    const month = Number(date.slice(5, 7));
    await this.init();
    if (!Capacitor.isNativePlatform()) {
      writeSummaries(readSummaries().map((summary) => summary.year === year && summary.analysisJson ? { ...summary, sourceFingerprint: null } : summary));
      writeMonthlySummaries(readMonthlySummaries().map((summary) => summary.year === year && summary.month === month ? { ...summary, sourceFingerprint: null } : summary));
      return;
    }
    await this.dbReady().run("UPDATE YearlySummary SET sourceFingerprint = NULL WHERE year = ? AND analysisJson IS NOT NULL", [year]);
    await this.dbReady().run("UPDATE MonthlySummary SET sourceFingerprint = NULL WHERE year = ? AND month = ?", [year, month]);
  }

  async searchEntries(query: string) {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    const entries = await this.listEntries();
    // ponytail: local phone archive; use SQLite FTS only when full-scan search becomes slow.
    return entries.filter((entry) => [entry.title, entry.content, entry.songName, entry.albumName, entry.artistName, entry.tags.join(" "), entry.moods.join(" ")].filter(Boolean).join(" ").toLowerCase().includes(q));
  }

  async albumAggregates() {
    const [entries, covers] = await Promise.all([this.listEntries(), this.listCovers()]);
    const groups = groupMusicEntries(entries, "album");
    return groups.map((items): AlbumAggregate => {
      const newest = [...items].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      const latest = newest[0];
      const albumName = latest.albumName as string;
      const coverDataUrl = newest.map(item => resolveAlbumCover(covers, entries, { albumName: item.albumName as string, artistName: item.artistName })).find(Boolean) ?? null;
      return { representativeEntryId: latest.id, catalogId: items.map(item => item.musicMetadata?.catalogAlbumId?.trim()).find(Boolean) ?? null, albumName, artistName: latest.artistName, coverDataUrl, years: years(items), recordCount: items.length, lastRecordedAt: latest.createdAt, latestRating: latest.rating };
    }).sort((a, b) => b.lastRecordedAt.localeCompare(a.lastRecordedAt));
  }

  async songAggregates() {
    const [entries, covers] = await Promise.all([this.listEntries(), this.listCovers()]);
    const groups = groupMusicEntries(entries, "song");
    return groups.map((items): SongAggregate => {
      const newest = [...items].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      const latest = newest[0];
      const songName = latest.songName as string;
      const ownCover = newest.map(item => directCover(covers, "song", { songName: item.songName, albumName: item.albumName, artistName: item.artistName })).find(Boolean);
      const albumCover = newest.map(item => item.albumName ? resolveAlbumCover(covers, entries, { albumName: item.albumName, artistName: item.artistName }) : null).find(Boolean);
      return { representativeEntryId: latest.id, catalogId: items.map(item => item.musicMetadata?.catalogTrackId?.trim()).find(Boolean) ?? null, songName, artistName: latest.artistName, albumName: latest.albumName, coverDataUrl: ownCover ?? albumCover ?? null, years: years(items), recordCount: items.length, lastRecordedAt: latest.createdAt, latestRating: latest.rating };
    }).sort((a, b) => b.lastRecordedAt.localeCompare(a.lastRecordedAt));
  }

  async visualizationOptions() {
    return buildVisualizationOptions(await this.listEntries());
  }

  async abstractMusicMap(filters: VisualizationFilters) {
    return buildAbstractMusicMap(await this.listEntries(), filters);
  }

  async getCover(kind: CoverKind, target: CoverTarget, options?: { matchNormalizedIdentity: boolean }) {
    const exact = await this.resolveCover(kind, normalizeCoverTarget(kind, target));
    if (exact || !options?.matchNormalizedIdentity) return exact;
    const text = (value: string | null | undefined) => value?.normalize("NFKC").toLocaleLowerCase("zh-CN").replace(/\s+/g, "") ?? "";
    const matches = (await this.listCovers()).filter(item => item.kind === kind
      && text(item.artistName) === text(target.artistName)
      && (kind === "album" ? text(item.albumName) === text(target.albumName)
        : text(item.songName) === text(target.songName)
          && (!item.albumName || !target.albumName || text(item.albumName) === text(target.albumName))));
    const images = [...new Set(matches.map(item => item.dataUrl))];
    if (images.length > 1) throw new Error("同一作品存在不同封面，请手动选择");
    return images[0] ?? null;
  }

  async getEntryCover(entry: ReviewEntry) {
    const selected = entryCoverTarget(entry);
    if (!selected) return null;
    return this.resolveCover(selected.kind, selected.target, entry);
  }

  async getEntryCovers(entries: ReviewEntry[], source: ReviewEntry[]) {
    // source is the full archive snapshot, including records outside this page.
    if (!entries.length) return [];
    const covers = await this.listCovers();
    return entries.map(entry => {
      const selected = entryCoverTarget(entry);
      if (!selected) return null;
      const own = directCover(covers, selected.kind, selected.target);
      return own ?? (selected.target.albumName ? resolveAlbumCover(covers, source,
        { albumName: selected.target.albumName, artistName: selected.target.artistName }) : null);
    });
  }

  private async resolveCover(kind: CoverKind, target: CoverTarget, associationEntry?: ReviewEntry) {
    await this.init();
    const covers = await this.listCovers();
    const own = directCover(covers, kind, target);
    if (own || !target.albumName) return own;
    const entries = await this.listEntries();
    if (associationEntry && !entries.some((entry) => entry.id === associationEntry.id)) entries.push(associationEntry);
    return resolveAlbumCover(covers, entries, { albumName: target.albumName, artistName: target.artistName });
  }

  async setCover(kind: CoverKind, target: CoverTarget, dataUrl: string, options?: { onlyIfMissing: boolean }) {
    const normalizedTarget = normalizeCoverTarget(kind, target);
    if (kind === "album" && !normalizedTarget.albumName) throw new Error("缺少专辑名称");
    if (kind === "song" && !normalizedTarget.songName) throw new Error("缺少歌曲名称");
    const now = new Date().toISOString();
    const cover: CoverRow = { coverKey: coverKey(kind, normalizedTarget), kind, albumName: normalizedTarget.albumName, songName: normalizedTarget.songName ?? null, artistName: normalizedTarget.artistName, dataUrl, updatedAt: now };
    await this.init();
    if (options?.onlyIfMissing && await this.getCover(kind, normalizedTarget, { matchNormalizedIdentity: true })) return;
    if (!Capacitor.isNativePlatform()) {
      const covers = readCovers();
      if (options?.onlyIfMissing && covers.some(item => item.coverKey === cover.coverKey)) return;
      writeCovers([...covers.filter((item) => item.coverKey !== cover.coverKey), cover]);
      dispatchCoverChanged();
      return;
    }
    await this.dbReady().run(
      `INSERT OR ${options?.onlyIfMissing ? "IGNORE" : "REPLACE"} INTO CoverImage (coverKey, kind, albumName, songName, artistName, dataUrl, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [cover.coverKey, cover.kind, cover.albumName, cover.songName, cover.artistName, cover.dataUrl, cover.updatedAt],
    );
    dispatchCoverChanged();
  }

  async getYearStats(year: number, source?: ReviewEntry[]) {
    const entries = (source ?? await this.listEntries()).filter((entry) => inRecordingPeriod(entry, year));
    return calculateYearStats(year, entries.map((entry) => ({ ...entry, month: new Date(entry.createdAt).getMonth() + 1 })));
  }

  async getSummary(year: number) {
    await this.init();
    if (!Capacitor.isNativePlatform()) return readSummaries().find((summary) => summary.year === year) ?? null;
    const result = await this.dbReady().query("SELECT * FROM YearlySummary WHERE year = ?", [year]);
    return result.values?.[0] ? rowToSummary(result.values[0]) : null;
  }

  async getMonthlySummary(year: number, month: number) {
    await this.init();
    if (!Capacitor.isNativePlatform()) return readMonthlySummaries().find((summary) => summary.year === year && summary.month === month) ?? null;
    const result = await this.dbReady().query("SELECT * FROM MonthlySummary WHERE year = ? AND month = ?", [year, month]);
    return result.values?.[0] ? rowToMonthlySummary(result.values[0]) : null;
  }

  async listMonthlySummaries(year?: number) {
    await this.init();
    if (!Capacitor.isNativePlatform()) return readMonthlySummaries().filter((summary) => year === undefined || summary.year === year).sort((a, b) => b.year - a.year || b.month - a.month);
    const result = year === undefined
      ? await this.dbReady().query("SELECT * FROM MonthlySummary ORDER BY year DESC, month DESC")
      : await this.dbReady().query("SELECT * FROM MonthlySummary WHERE year = ? ORDER BY month DESC", [year]);
    return (result.values ?? []).map(rowToMonthlySummary);
  }

  async generateMonthlySummary(year: number, month: number) {
    const entries = (await this.listEntries()).filter((entry) => inRecordingPeriod(entry, year, month));
    const sourceEntries = entries.filter(isAutomaticEntry);
    if (!sourceEntries.length) throw new Error("该月份没有歌曲或专辑乐评，无法生成月度总结");
    const weather = await this.cachedWeatherForEntries(sourceEntries);
    const snapshot = buildMonthlyListeningSnapshot(year, month, entries, weather, await this.getSemanticOverrides());
    parseMonthlyListeningSnapshot(JSON.stringify(snapshot));
    const existing = await this.getMonthlySummary(year, month);
    const now = new Date().toISOString();
    const reflections = entries.filter((entry) => entry.type === "month");
    const summary: MonthlySummary = {
      id: existing?.id ?? crypto.randomUUID(),
      year,
      month,
      title: snapshot.title,
      content: monthlySnapshotToMarkdown(snapshot, reflections),
      themeId: snapshot.theme.id,
      analysisJson: JSON.stringify(snapshot),
      analysisVersion: snapshot.version,
      sourceFingerprint: snapshot.analysis.sourceFingerprint,
      sourceEntryCount: snapshot.analysis.sourceEntryCount,
      generatedAt: now,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };
    await this.init();
    if (!Capacitor.isNativePlatform()) {
      writeMonthlySummaries([...readMonthlySummaries().filter((item) => item.year !== year || item.month !== month), summary]);
      return summary;
    }
    await this.dbReady().run(
      `INSERT OR REPLACE INTO MonthlySummary (id, year, month, title, content, themeId, analysisJson, analysisVersion, sourceFingerprint, sourceEntryCount, generatedAt, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      monthlySummaryValues(summary),
    );
    return summary;
  }

  async generateSummary(year: number) {
    const entries = (await this.listEntries()).filter((entry) => inRecordingPeriod(entry, year)).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    const sourceEntries = entries.filter(isAutomaticEntry);
    if (!sourceEntries.length) throw new Error("该年份没有歌曲或专辑乐评，无法生成年度总结");
    const months = unique(sourceEntries.map((entry) => new Date(entry.createdAt).getMonth() + 1)).sort((a, b) => a - b);
    const monthSnapshots: MonthlyListeningSnapshot[] = [];
    for (const month of months) {
      try {
        monthSnapshots.push(parseMonthlyListeningSnapshot((await this.generateMonthlySummary(year, month)).analysisJson));
      } catch (error) {
        throw new Error(`${month} 月生成失败，年度标本册未更新：${error instanceof Error ? error.message : "请重试"}`);
      }
    }
    const snapshot = buildYearlyListeningSnapshot(year, monthSnapshots, [], await this.getSemanticOverrides());
    parseYearlyListeningSnapshot(JSON.stringify(snapshot));
    const includedIds = new Set(snapshot.analysis.sourceEntryIds);
    if (includedIds.size !== sourceEntries.length || sourceEntries.some((entry) => !includedIds.has(entry.id))) {
      throw new Error("年度乐评数量校验失败，旧标本册已保留，请重新生成");
    }
    const existing = await this.getSummary(year);
    const now = new Date().toISOString();
    const summary: YearlySummary = {
      id: existing?.id ?? crypto.randomUUID(),
      year,
      title: snapshot.title,
      content: yearlySnapshotToMarkdown(snapshot),
      analysisJson: JSON.stringify(snapshot),
      analysisVersion: snapshot.version,
      sourceFingerprint: snapshot.analysis.sourceFingerprint,
      sourceEntryCount: snapshot.analysis.sourceEntryCount,
      generatedAt: now,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };
    await this.init();
    if (!Capacitor.isNativePlatform()) {
      writeSummaries([...readSummaries().filter((item) => item.year !== year), summary]);
      return summary;
    }
    await this.dbReady().run(
      `INSERT OR REPLACE INTO YearlySummary (id, year, title, content, analysisJson, analysisVersion, sourceFingerprint, sourceEntryCount, generatedAt, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      summaryValues(summary),
    );
    return summary;
  }

  async getDayListeningSnapshot(date: string, refreshWeather = false): Promise<ListeningDaySnapshot> {
    const entries = (await this.listEntries()).filter((entry) => exactEntryDate(entry) === date);
    let weather = await this.getWeatherForDate(date);
    if (!weather && refreshWeather) {
      try {
        weather = await this.refreshWeatherForDate(date);
      } catch {
        weather = null;
      }
    }
    return buildDayListeningSnapshot(date, entries, weather, await this.getSemanticOverrides());
  }

  async searchWeatherLocations(query: string) {
    return searchWeatherLocations(query, privacyFetch);
  }

  async getWeatherLocation() {
    const raw = await this.getAppData(WEATHER_LOCATION_KEY);
    if (!raw) return null;
    try {
      return parseWeatherLocation(JSON.parse(raw));
    } catch {
      return null;
    }
  }

  async setWeatherLocation(location: WeatherLocation | null) {
    if (location) parseWeatherLocation(location);
    const current = await this.getWeatherLocation();
    if (!location || !sameWeatherLocation(current, location)) await this.deleteAppDataByPrefix("listening-weather:");
    await this.setAppData(WEATHER_LOCATION_KEY, location ? JSON.stringify(location) : null);
    await this.markAllAnalysisStale();
  }

  async getPreferredQuote(scope: string) {
    const raw = await this.getAppData(`listening-quote:${scope}`);
    if (!raw) return null;
    try {
      return readPreferredQuote(JSON.parse(raw));
    } catch {
      return null;
    }
  }

  async setPreferredQuote(scope: string, quote: { entryId: string; sentence: string } | null) {
    if (!/^(?:year:\d{4}|month:\d{4}-\d{1,2})$/.test(scope)) throw new Error("代表原句范围无效");
    if (quote) readPreferredQuote(quote);
    await this.setAppData(`listening-quote:${scope}`, quote ? JSON.stringify(quote) : null);
  }

  async getSemanticOverrides(): Promise<SemanticOverride[]> {
    const raw = await this.getAppData(SEMANTIC_OVERRIDES_KEY);
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed.map(readSemanticOverride) : [];
    } catch {
      return [];
    }
  }

  async setSemanticOverride(override: SemanticOverride) {
    const valid = readSemanticOverride(override);
    const current = (await this.getSemanticOverrides()).filter((item) => item.layer !== valid.layer || item.term !== valid.term);
    await this.setAppData(SEMANTIC_OVERRIDES_KEY, JSON.stringify([...current, valid]));
    await this.markAllAnalysisStale();
  }

  async removeSemanticOverride(layer: ListeningLayer, term: string) {
    const current = (await this.getSemanticOverrides()).filter((item) => item.layer !== layer || item.term !== term);
    await this.setAppData(SEMANTIC_OVERRIDES_KEY, current.length ? JSON.stringify(current) : null);
    await this.markAllAnalysisStale();
  }

  async refreshWeatherForDate(date: string) {
    const location = await this.getWeatherLocation();
    if (!location) throw new Error("请先选择天气城市");
    const weather = await fetchHistoricalWeather(location, date, privacyFetch);
    requirePrivacyConsent();
    await this.setAppData(weatherKey(location, date), JSON.stringify(weather));
    await this.markContextSummariesStale(date);
    return weather;
  }

  async getWeatherForDate(date: string) {
    const location = await this.getWeatherLocation();
    if (!location) return null;
    const raw = await this.getAppData(weatherKey(location, date));
    if (!raw) return null;
    try {
      return parseWeatherRecord(JSON.parse(raw));
    } catch {
      return null;
    }
  }

  async createListeningMoment(entryId: string, input: ListeningMomentInput) {
    const now = new Date().toISOString();
    const moment: ListeningMoment = { ...input, id: crypto.randomUUID(), entryId, createdAt: now, updatedAt: now };
    await this.init();
    if (!Capacitor.isNativePlatform()) {
      writeListeningMoments([...readListeningMoments(), moment]);
      return moment;
    }
    await this.dbReady().run(
      "INSERT INTO ListeningMoment (id, entryId, listenedAt, rating, ratingModifier, moods, content, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
      [moment.id, moment.entryId, moment.listenedAt, moment.rating, moment.ratingModifier, JSON.stringify(moment.moods), moment.content, moment.createdAt, moment.updatedAt],
    );
    return moment;
  }

  async getMomentsByEntryId(entryId: string) {
    await this.init();
    if (!Capacitor.isNativePlatform()) return readListeningMoments().filter((m) => m.entryId === entryId).sort((a, b) => a.listenedAt.localeCompare(b.listenedAt));
    const result = await this.dbReady().query("SELECT * FROM ListeningMoment WHERE entryId = ? ORDER BY listenedAt ASC", [entryId]);
    return (result.values ?? []).map(rowToListeningMoment);
  }

  async getListeningMoment(id: string) {
    await this.init();
    if (!Capacitor.isNativePlatform()) return readListeningMoments().find((moment) => moment.id === id) ?? null;
    const result = await this.dbReady().query("SELECT * FROM ListeningMoment WHERE id = ?", [id]);
    return result.values?.[0] ? rowToListeningMoment(result.values[0]) : null;
  }

  async deleteListeningMoment(id: string) {
    await this.init();
    if (!Capacitor.isNativePlatform()) {
      writeListeningMoments(readListeningMoments().filter((m) => m.id !== id));
      return;
    }
    await this.dbReady().run("DELETE FROM ListeningMoment WHERE id = ?", [id]);
  }

  async updateListeningMoment(id: string, input: ListeningMomentInput) {
    const now = new Date().toISOString();
    await this.init();
    if (!Capacitor.isNativePlatform()) {
      writeListeningMoments(readListeningMoments().map((m) => m.id === id ? { ...input, id, entryId: m.entryId, createdAt: m.createdAt, updatedAt: now } : m));
      return;
    }
    await this.dbReady().run(
      "UPDATE ListeningMoment SET listenedAt=?, rating=?, ratingModifier=?, moods=?, content=?, updatedAt=? WHERE id=?",
      [input.listenedAt, input.rating, input.ratingModifier, JSON.stringify(input.moods), input.content, now, id],
    );
  }

  async getStoredAppData(key: string) {
    return this.getAppData(key);
  }

  async listSavedTopAlbums() {
    const data = await this.listAppData();
    return Object.entries(data).filter(([key]) => /^top-albums:[1-9]\d{0,3}$/.test(key))
      .map(([key, raw]) => ({ year: Number(key.slice(TOP_ALBUMS_PREFIX.length)), albums: readYearTopAlbums(JSON.parse(raw)).albums }))
      .sort((left, right) => left.year - right.year);
  }

  async setStoredAppData(key: string, value: string | null) {
    if (!key.trim()) throw new Error("应用数据键不能为空");
    if (key === NATIVE_RESTORE_JOURNAL_KEY || key === RESTORE_GATE_KEY || key === WEB_RESTORE_JOURNAL_KEY) throw new Error("恢复日志不能通过普通设置修改");
    await this.setAppData(key, value);
  }

  async exportBackup(options: { includeCovers?: boolean } = {}) {
    const drafts = readBackupDrafts(listRawEntryDrafts(localStorage), options);
    return JSON.stringify({ ...await this.exportMainData(options), drafts }, null, 2);
  }

  private async exportMainData(options: { includeCovers?: boolean } = {}) {
    if (!Capacitor.isNativePlatform()) assertLocalStorageIntegrity();
    return {
      version: 6,
      exportedAt: new Date().toISOString(),
      entries: await this.listEntries(),
      summaries: await this.listSummaries(),
      monthlySummaries: await this.listMonthlySummaries(),
      covers: options.includeCovers === false ? [] : await this.listCovers(),
      listeningMoments: await this.listListeningMoments(),
      // 备份健康是设备本地状态(最近验证/保存时间)，不属于用户数据，不应进入备份
      appData: userAppData(await this.listAppData()),
      drafts: [],
    };
  }

  async exportTxt() {
    if (!Capacitor.isNativePlatform()) assertLocalStorageIntegrity();
    return formatEntriesTxt(await this.listEntries(), await this.listSummaries());
  }

  async exportCsv() {
    if (!Capacitor.isNativePlatform()) assertLocalStorageIntegrity();
    return formatEntriesCsv(await this.listEntries(), await this.listSummaries());
  }

  async importBackup(raw: string, options: { includeCovers?: boolean } = {}, expectedLocalSha256?: string) {
    const backup = parseBackup(raw, options);
    let stale = false;
    await withRestoreLock(async () => {
      await this.requireNoJournal();
      const before = await this.snapshot();
      if (expectedLocalSha256 && await sha256(mainSignature(parseBackup(before.beforeBackup)) + draftSignature(before.beforeDrafts)) !== expectedLocalSha256) {
        stale = true;
        return;
      }
      if (options.includeCovers === false) backup.covers = await this.listCovers();
      // Device health belongs to this installation, not to the imported archive.
      backup.appData = { ...userAppData(backup.appData), ...deviceAppData(before.beforeAppData) };
      const targetDrafts = backup.draftsPresence === "absent" ? before.beforeDrafts : backup.drafts;
      await this.replaceWithJournal("import", before, backup, targetDrafts, JSON.stringify(before));
    });
    if (stale) throw new Error("本机数据在预演后已变化，请重新预演");
  }

  async restoreImportUndo() {
    await withRestoreLock(async () => {
      await this.requireNoJournal();
      const raw = await this.readImportUndo();
      if (!raw) throw new Error("没有可撤销的导入");
      const target = this.parseUndo(raw);
      const before = await this.snapshot();
      const backup = target.snapshot ? parseBackup(target.snapshot.beforeBackup) : target.backup;
      backup.appData = target.snapshot?.beforeAppData ?? { ...userAppData(backup.appData), ...deviceAppData(before.beforeAppData) };
      await this.replaceWithJournal("undo", before, backup, target.snapshot?.beforeDrafts ?? before.beforeDrafts, null, target.snapshot?.beforeWebStorage);
    });
  }

  async previewImportUndo(): Promise<BackupPreview | null> {
    const raw = await this.readImportUndo();
    if (!raw) return null;
    const target = this.parseUndo(raw);
    const preview = summarizeBackup(target.backup);
    return target.snapshot ? { ...preview, ...draftPreview(target.snapshot.beforeDrafts), draftsPresence: "present" } : preview;
  }

  private parseUndo(raw: string): { backup: BackupData; snapshot?: RestoreSnapshot } {
    const parsed: unknown = JSON.parse(raw);
    if (isRecord(parsed) && parsed.kind === "codex-import-undo") {
      const snapshot = readRestoreSnapshot(parsed, Capacitor.isNativePlatform());
      return { backup: parseBackup(snapshot.beforeBackup), snapshot };
    }
    const backup = parseBackup(raw);
    if (backup.sourceVersion > 5) throw new Error("撤销槽格式无效，原文已保留");
    return { backup };
  }

  private async snapshot(): Promise<RestoreSnapshot> {
    const beforeBackup = JSON.stringify(await this.exportMainData());
    const beforeAppData = Object.fromEntries(Object.entries(await this.listAppData()).filter(([key]) => key !== NATIVE_RESTORE_JOURNAL_KEY));
    return readRestoreSnapshot({ kind: "codex-import-undo", version: 1, beforeBackup,
      beforeDrafts: listRawEntryDrafts(localStorage), beforeAppData,
      ...(!Capacitor.isNativePlatform() ? { beforeWebStorage: Object.fromEntries(WEB_DATA_KEYS.map(key => [key, localStorage.getItem(key)])) } : {}),
    }, Capacitor.isNativePlatform());
  }

  private async readJournal() {
    return Capacitor.isNativePlatform() ? this.getAppData(NATIVE_RESTORE_JOURNAL_KEY) : localStorage.getItem(WEB_RESTORE_JOURNAL_KEY);
  }
  private async writeJournal(journal: RestoreJournal | null) {
    const raw = journal === null ? null : JSON.stringify(journal);
    if (Capacitor.isNativePlatform()) await this.setAppData(NATIVE_RESTORE_JOURNAL_KEY, raw);
    else restoreStorage(WEB_RESTORE_JOURNAL_KEY, raw);
    if (await this.readJournal() !== raw) throw new Error("恢复日志写入校验失败");
  }
  private async requireNoJournal() {
    if (await this.readJournal() !== null) throw new Error("上次恢复尚未结束，请先重试恢复。");
  }

  async recoverPendingRestore() {
    try {
      // Acquire a shared session first, so a normal second window can open without exclusive access.
      await acquireStorageSession();
      if (await this.readJournal() === null && localStorage.getItem(RESTORE_GATE_KEY) === null) {
        clearRecoveryError();
        return;
      }
      await withRestoreLock(async () => {
        const raw = await this.readJournal();
        if (raw !== null) await this.rollback(readRestoreJournal(raw, Capacitor.isNativePlatform()));
      });
    } catch (error) { markRecoveryError(error); throw error; }
  }

  async getRecoveryEvidence() {
    await this.init();
    return JSON.stringify({ journal: await this.readJournal(), gate: localStorage.getItem(RESTORE_GATE_KEY),
      undo: await this.readImportUndo(), drafts: listRawEntryDrafts(localStorage),
      webStorage: Object.fromEntries(WEB_DATA_KEYS.map(key => [key, localStorage.getItem(key)])),
    }, null, 2);
  }

  private async replaceWithJournal(operation: "import" | "undo", before: RestoreSnapshot, backup: BackupData,
    drafts: StoredEntryDraft[], undo: string | null, webStorage?: Record<string, string | null>) {
    const journal: RestoreJournal = { ...before, operation, phase: "prepared", beforeUndo: await this.readImportUndo() };
    await this.writeJournal(journal);
    try {
      const written = { ...journal, phase: "data-written" as const };
      await this.writeBackup(backup, written, undo, webStorage);
      replaceDrafts(drafts);
      await this.verifyRestore(backup, drafts, undo, webStorage);
      await this.writeJournal(null);
    } catch (error) {
      try { await this.rollback(journal); }
      catch (rollbackError) { throw new Error(`恢复未完成，原文和快照已保留，请重试：${rollbackError instanceof Error ? rollbackError.message : "回滚失败"}`); }
      throw error;
    }
  }

  private async rollback(journal: RestoreJournal) {
    const rolling = { ...journal, phase: "rolling-back" as const };
    await this.writeJournal(rolling);
    const backup = parseBackup(journal.beforeBackup);
    backup.appData = journal.beforeAppData;
    await this.writeBackup(backup, rolling, journal.beforeUndo, journal.beforeWebStorage);
    replaceDrafts(journal.beforeDrafts);
    await this.verifyRestore(backup, journal.beforeDrafts, journal.beforeUndo, journal.beforeWebStorage);
    await this.writeJournal(null);
  }

  private async verifyRestore(backup: BackupData, drafts: StoredEntryDraft[], undo: string | null, webStorage?: Record<string, string | null>) {
    if (webStorage && WEB_DATA_KEYS.some(key => localStorage.getItem(key) !== webStorage[key])) throw new Error("恢复后主数据原文不一致");
    // Read directly here: a retained corruption archive must never prevent restoring its original bytes.
    const current = Capacitor.isNativePlatform() ? {
      entries: await this.listEntries(), summaries: await this.listSummaries(), monthlySummaries: await this.listMonthlySummaries(),
      covers: await this.listCovers(), listeningMoments: await this.listListeningMoments(), appData: await this.listAppData(),
    } : readWebSnapshot(Object.fromEntries(WEB_DATA_KEYS.map(key => [key, localStorage.getItem(key)])));
    current.appData = Object.fromEntries(Object.entries(current.appData).filter(([key]) => key !== NATIVE_RESTORE_JOURNAL_KEY));
    if (mainSignature(current) !== mainSignature(backup)) throw new Error("恢复后正式数据或应用数据不一致");
    if (draftSignature(listRawEntryDrafts(localStorage)) !== draftSignature(drafts)) throw new Error("恢复后草稿原文不一致");
    if (await this.readImportUndo() !== undo) throw new Error("恢复后撤销快照不一致");
  }

  private async readImportUndo(): Promise<string | null> {
    if (Capacitor.isNativePlatform()) {
      await this.init();
      const result = await this.dbReady().query("SELECT value FROM UndoBackup WHERE id = 1");
      const row = (result.values ?? [])[0];
      return row && typeof row.value === "string" ? row.value : null;
    }
    return localStorage.getItem(IMPORT_UNDO_KEY);
  }

  previewBackup(raw: string, options: { includeCovers?: boolean } = {}) {
    return summarizeBackup(parseBackup(raw, options));
  }

  async previewRestoreDiff(raw: string, options: { includeCovers?: boolean } = {}): Promise<RestoreDiffReport> {
    const backup = parseBackup(raw, options);
    const current = await this.exportMainData();
    const currentDrafts = listRawEntryDrafts(localStorage);
    const targetCovers = options.includeCovers === false ? current.covers : backup.covers;
    const targetDrafts = backup.draftsPresence === "absent" ? currentDrafts : backup.drafts;
    return {
      inputSha256: await sha256(raw),
      localSha256: await sha256(mainSignature(current) + draftSignature(currentDrafts)),
      includeCovers: options.includeCovers !== false,
      sourceVersion: backup.sourceVersion,
      groups: {
        entries: restoreDiffCounts(current.entries, backup.entries, item => item.id),
        summaries: restoreDiffCounts(current.summaries, backup.summaries, item => item.id),
        monthlySummaries: restoreDiffCounts(current.monthlySummaries, backup.monthlySummaries, item => item.id),
        listeningMoments: restoreDiffCounts(current.listeningMoments, backup.listeningMoments, item => item.id),
        covers: restoreDiffCounts(current.covers, targetCovers, item => item.coverKey),
        appData: restoreDiffCounts(Object.entries(current.appData).map(([key, value]) => ({ key, value })),
          Object.entries(userAppData(backup.appData)).map(([key, value]) => ({ key, value })), item => item.key),
        drafts: restoreDiffCounts(currentDrafts, targetDrafts, item => item.key),
      },
    };
  }

  async rehearseRestore(raw: string, options: { includeCovers?: boolean } = {}): Promise<RestoreRehearsal> {
    const diff = await this.previewRestoreDiff(raw, options);
    const backup = parseBackup(raw, options);
    const current = await this.exportMainData();
    const currentDrafts = listRawEntryDrafts(localStorage);
    if (await sha256(mainSignature(current) + draftSignature(currentDrafts)) !== diff.localSha256) {
      throw new Error("预演期间本机数据已变化，请重新预演");
    }
    if (options.includeCovers === false) backup.covers = current.covers;
    backup.appData = { ...userAppData(backup.appData), ...deviceAppData(await this.listAppData()) };
    const drafts = backup.draftsPresence === "absent" ? currentDrafts : backup.drafts;
    const journal: RestoreJournal = { ...await this.snapshot(), operation: "import", phase: "data-written", beforeUndo: null };
    const isolatedDrafts = createIsolatedStorage();
    let isolationDatabase: string | undefined;
    if (Capacitor.isNativePlatform()) {
      const sandbox = new Store();
      const name = `codex_restore_preview_${crypto.randomUUID().replaceAll("-", "")}`;
      isolationDatabase = name;
      if (name === DB_NAME || (await sandbox.sqlite.isDatabase(name)).result) throw new Error("隔离数据库名称已存在，预演已停止");
      const database = await sandbox.sqlite.createConnection(name, false, "no-encryption", 1, false);
      try {
        await database.open();
        await database.execute(schemaSql);
        sandbox.db = database;
        sandbox.nativeReady = true;
        await sandbox.writeBackup(backup, journal, null);
        replaceDrafts(drafts, isolatedDrafts);
        const readback = await sandbox.exportMainData();
        if (mainSignature(readback) !== mainSignature({ ...backup, appData: userAppData(backup.appData) })
          || draftSignature(listRawEntryDrafts(isolatedDrafts)) !== draftSignature(drafts)
          || await sandbox.readImportUndo() !== null) throw new Error("隔离数据库回读与目标备份不一致");
      } finally {
        await sandbox.sqlite.closeConnection(name, false);
      }
    } else {
      const sandbox = new Store();
      await sandbox.writeBackup(backup, journal, null, undefined, isolatedDrafts);
      replaceDrafts(drafts, isolatedDrafts);
      const readback = readWebSnapshot(Object.fromEntries(WEB_DATA_KEYS.map(key => [key, isolatedDrafts.getItem(key)])));
      if (mainSignature(readback) !== mainSignature(backup)
        || draftSignature(listRawEntryDrafts(isolatedDrafts)) !== draftSignature(drafts)
        || isolatedDrafts.getItem(IMPORT_UNDO_KEY) !== null) throw new Error("隔离 Web 存储回读与目标备份不一致");
    }
    const after = await this.previewRestoreDiff(raw, options);
    if (after.localSha256 !== diff.localSha256 || after.inputSha256 !== diff.inputSha256) throw new Error("预演期间正式数据已变化，请重新预演");
    return { ...diff, verified: true, target: Capacitor.getPlatform() === "electron" ? "windows-isolated-sqlite" : Capacitor.isNativePlatform() ? "android-isolated-sqlite" : "web-isolated-storage",
      ...(isolationDatabase ? { isolationDatabase } : {}) };
  }

  private async writeBackup(backup: BackupData, journal: RestoreJournal, undo: string | null,
    webStorage?: Record<string, string | null>, isolatedStorage?: Storage) {
    await this.init();
    if (!Capacitor.isNativePlatform()) {
      const values = [backup.entries, backup.summaries, backup.monthlySummaries, backup.covers, backup.listeningMoments, backup.appData];
      WEB_DATA_KEYS.forEach((key, index) => restoreStorage(key, webStorage ? webStorage[key] : JSON.stringify(values[index]), isolatedStorage));
      restoreStorage(IMPORT_UNDO_KEY, undo, isolatedStorage);
      if (isolatedStorage) restoreStorage(WEB_RESTORE_JOURNAL_KEY, JSON.stringify(journal), isolatedStorage);
      else await this.writeJournal(journal);
      return;
    }

    const set: capSQLiteSet[] = [
      // Native executeSet requires values even for statements without parameters.
      { statement: "DELETE FROM ListeningMoment", values: [] },
      { statement: "DELETE FROM ReviewEntry", values: [] },
      { statement: "DELETE FROM YearlySummary", values: [] },
      { statement: "DELETE FROM MonthlySummary", values: [] },
      { statement: "DELETE FROM CoverImage", values: [] },
      { statement: "DELETE FROM AppData", values: [] },
      ...backup.entries.map((entry) => ({ statement: "INSERT INTO ReviewEntry (id, type, title, year, month, albumName, songName, artistName, musicMetadata, content, tags, moods, rating, ratingModifier, ratingProduction, ratingSongwriting, ratingLyrics, ratingComposition, ratingVocals, ratingOriginality, ratingResonance, compositeRatingLocked, firstListenedAt, listenedAt, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", values: entryValues(entry) })),
      ...backup.listeningMoments.map((moment) => ({ statement: "INSERT INTO ListeningMoment (id, entryId, listenedAt, rating, ratingModifier, moods, content, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)", values: listeningMomentValues(moment) })),
      ...backup.summaries.map((summary) => ({ statement: "INSERT INTO YearlySummary (id, year, title, content, analysisJson, analysisVersion, sourceFingerprint, sourceEntryCount, generatedAt, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", values: summaryValues(summary) })),
      ...backup.monthlySummaries.map((summary) => ({ statement: "INSERT INTO MonthlySummary (id, year, month, title, content, themeId, analysisJson, analysisVersion, sourceFingerprint, sourceEntryCount, generatedAt, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", values: monthlySummaryValues(summary) })),
      ...backup.covers.map((cover) => ({ statement: "INSERT INTO CoverImage (coverKey, kind, albumName, songName, artistName, dataUrl, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?)", values: coverValues(cover) })),
      ...Object.entries(backup.appData).map(([key, value]) => ({ statement: "INSERT INTO AppData (key, value) VALUES (?, ?)", values: [key, value] })),
      { statement: "INSERT INTO AppData (key, value) VALUES (?, ?)", values: [NATIVE_RESTORE_JOURNAL_KEY, JSON.stringify(journal)] },
      ...(undo === null ? [{ statement: "DELETE FROM UndoBackup", values: [] }] : [{ statement: "INSERT INTO UndoBackup (id, value) VALUES (1, ?) ON CONFLICT(id) DO UPDATE SET value = excluded.value", values: [undo] }]),
    ];
    await this.dbReady().executeSet(set, true);
  }

  async getWeatherForEntries(entries: ReviewEntry[]) {
    return this.cachedWeatherForEntries(entries);
  }

  private async cachedWeatherForEntries(entries: ReviewEntry[]) {
    const dates = unique(entries.map(exactEntryDate).filter((date): date is string => !!date)).sort();
    const location = await this.getWeatherLocation();
    if (!location || !dates.length) return [];
    const cached = await Promise.all(dates.map((date) => this.getWeatherForDate(date)));
    const missing = dates.filter((_, index) => !cached[index]);
    if (missing.length) {
      try {
        const fetched = await fetchHistoricalWeatherRange(location, missing[0], missing[missing.length - 1], privacyFetch);
        requirePrivacyConsent();
        const wanted = new Set(missing);
        for (const weather of fetched) {
          if (!wanted.has(weather.date)) continue;
          await this.setAppData(weatherKey(location, weather.date), JSON.stringify(weather));
        }
      } catch {
        // Offline or unavailable historical weather must not block local summary generation.
      }
    }
    const weather = await Promise.all(dates.map((date) => this.getWeatherForDate(date)));
    return weather.filter((item): item is WeatherRecord => !!item);
  }

  private async getAppData(key: string) {
    await this.init();
    if (!Capacitor.isNativePlatform()) return readAppData()[key] ?? null;
    const result = await this.dbReady().query("SELECT value FROM AppData WHERE key = ?", [key]);
    return result.values?.[0] ? String(result.values[0].value) : null;
  }

  private async setAppData(key: string, value: string | null) {
    await this.init();
    if (!Capacitor.isNativePlatform()) {
      const data = readAppData();
      if (value === null) delete data[key];
      else data[key] = value;
      writeAppData(data);
      return;
    }
    if (value === null) await this.dbReady().run("DELETE FROM AppData WHERE key = ?", [key]);
    else await this.dbReady().run("INSERT OR REPLACE INTO AppData (key, value) VALUES (?, ?)", [key, value]);
  }

  private async deleteAppDataByPrefix(prefix: string) {
    await this.init();
    if (!Capacitor.isNativePlatform()) {
      writeAppData(Object.fromEntries(Object.entries(readAppData()).filter(([key]) => !key.startsWith(prefix))));
      return;
    }
    await this.dbReady().run("DELETE FROM AppData WHERE key LIKE ?", [`${prefix}%`]);
  }

  private async listAppData() {
    await this.init();
    if (!Capacitor.isNativePlatform()) return readAppData();
    const result = await this.dbReady().query("SELECT key, value FROM AppData ORDER BY key");
    return Object.fromEntries((result.values ?? []).map((row) => [String(row.key), String(row.value)]));
  }

  private dbReady() {
    if (!this.db) throw new Error("数据库未初始化");
    return this.db;
  }

  private async listSummaries() {
    await this.init();
    if (!Capacitor.isNativePlatform()) return readSummaries();
    const result = await this.dbReady().query("SELECT * FROM YearlySummary ORDER BY year DESC");
    return (result.values ?? []).map(rowToSummary);
  }

  async listListeningMoments() {
    await this.init();
    if (!Capacitor.isNativePlatform()) return readListeningMoments();
    const result = await this.dbReady().query("SELECT * FROM ListeningMoment ORDER BY listenedAt ASC");
    return (result.values ?? []).map(rowToListeningMoment);
  }

  private async listCovers() {
    await this.init();
    if (!Capacitor.isNativePlatform()) return readCovers();
    const result = await this.dbReady().query("SELECT * FROM CoverImage ORDER BY updatedAt DESC");
    return (result.values ?? []).map(rowToCover);
  }
}

const rawStore = new Store();
const unlockedMethods = new Set(["previewBackup", "importBackup", "restoreImportUndo", "recoverPendingRestore", "getRecoveryEvidence"]);
export const store = new Proxy(rawStore, {
  get(target, key, receiver) {
    const value = Reflect.get(target, key, receiver);
    if (typeof value !== "function") return value;
    return (...args: unknown[]) => unlockedMethods.has(String(key))
      ? value.apply(target, args) : withStorageAccess(() => value.apply(target, args));
  },
});

export function entryCoverTarget(input: Pick<EntryInput, "type" | "songName" | "albumName" | "artistName">) {
  if (input.type === "album" && input.albumName) {
    return { kind: "album" as const, target: { albumName: input.albumName, artistName: input.artistName } };
  }
  if (input.songName) {
    return { kind: "song" as const, target: { albumName: input.albumName, songName: input.songName, artistName: input.artistName } };
  }
  if (input.albumName) {
    return { kind: "album" as const, target: { albumName: input.albumName, artistName: input.artistName } };
  }
  return null;
}

export function parseList(value: string) {
  return Array.from(new Set(value.split(/[,，;；\n\t]/).map((item) => item.trim()).filter(Boolean)));
}

export function calculateYearStats(year: number, entries: ReviewEntry[]): YearStats {
  const musicEntries = entries.filter(isAutomaticEntry);
  const ratings = musicEntries.map((entry) => entry.rating).filter((rating): rating is number => rating !== null);
  const createdThisYear = entries.filter((entry) => inRecordingPeriod(entry, year)).length;
  return {
    year,
    totalEntries: entries.length,
    createdThisYear,
    monthCount: new Set(entries.map((entry) => entry.month).filter((month): month is number => month !== null)).size,
    albumCount: groupMusicEntries(entries, "album").length,
    songCount: groupMusicEntries(entries, "song").length,
    topTags: topItems(entries.flatMap((entry) => entry.tags)),
    topMoods: topItems(entries.flatMap((entry) => entry.moods)),
    averageRating: ratings.length ? Math.round((ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length) * 10) / 10 : null,
    mostActiveMonth: topItems(entries.map((entry) => (entry.month ? `${entry.month} 月` : "")))[0] ?? null,
    topAlbum: topItems(musicEntries.map((entry) => entry.albumName ?? ""))[0] ?? null,
    topSong: topItems(musicEntries.map((entry) => entry.songName ?? ""))[0] ?? null,
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
    musicMetadata: safeDecodeMusicMetadata(nullableString(row.musicMetadata)),
    content: String(row.content),
    tags: safeDecodeList(nullableString(row.tags)),
    moods: safeDecodeList(nullableString(row.moods)),
    rating: row.rating === null || row.rating === undefined ? null : Number(row.rating),
    ratingModifier: safeParseRatingModifier(nullableString(row.ratingModifier)),
    ratingProduction: row.ratingProduction === null || row.ratingProduction === undefined ? null : Number(row.ratingProduction),
    ratingSongwriting: row.ratingSongwriting === null || row.ratingSongwriting === undefined ? null : Number(row.ratingSongwriting),
    ratingLyrics: row.ratingLyrics === null || row.ratingLyrics === undefined ? null : Number(row.ratingLyrics),
    ratingComposition: row.ratingComposition === null || row.ratingComposition === undefined ? null : Number(row.ratingComposition),
    ratingVocals: row.ratingVocals === null || row.ratingVocals === undefined ? null : Number(row.ratingVocals),
    ratingOriginality: row.ratingOriginality === null || row.ratingOriginality === undefined ? null : Number(row.ratingOriginality),
    ratingResonance: row.ratingResonance === null || row.ratingResonance === undefined ? null : Number(row.ratingResonance),
    compositeRatingLocked: Number(row.compositeRatingLocked) === 1,
    firstListenedAt: nullableString(row.firstListenedAt),
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
    analysisJson: nullableString(row.analysisJson),
    analysisVersion: row.analysisVersion === null || row.analysisVersion === undefined ? null : Number(row.analysisVersion),
    sourceFingerprint: nullableString(row.sourceFingerprint),
    sourceEntryCount: Number(row.sourceEntryCount),
    generatedAt: String(row.generatedAt),
    createdAt: String(row.createdAt),
    updatedAt: String(row.updatedAt),
  };
}

function rowToMonthlySummary(row: Record<string, unknown>): MonthlySummary {
  return {
    id: String(row.id),
    year: Number(row.year),
    month: Number(row.month),
    title: String(row.title),
    content: String(row.content),
    themeId: String(row.themeId),
    analysisJson: String(row.analysisJson),
    analysisVersion: Number(row.analysisVersion),
    sourceFingerprint: nullableString(row.sourceFingerprint),
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

function rowToListeningMoment(row: Record<string, unknown>): ListeningMoment {
  return {
    id: String(row.id),
    entryId: String(row.entryId),
    listenedAt: String(row.listenedAt),
    rating: row.rating === null || row.rating === undefined ? null : Number(row.rating),
    ratingModifier: parseRatingModifier(nullableString(row.ratingModifier)),
    moods: decodeList(nullableString(row.moods)),
    content: String(row.content),
    createdAt: String(row.createdAt),
    updatedAt: String(row.updatedAt),
  };
}

function entryValues(entry: ReviewEntry) {
  return [entry.id, entry.type, entry.title, entry.year, entry.month, entry.albumName, entry.songName, entry.artistName, encodeMusicMetadata(entry.musicMetadata), entry.content, JSON.stringify(entry.tags), JSON.stringify(entry.moods), entry.rating, entry.ratingModifier, entry.ratingProduction, entry.ratingSongwriting, entry.ratingLyrics ?? null, entry.ratingComposition ?? null, entry.ratingVocals ?? null, entry.ratingOriginality, entry.ratingResonance, entry.compositeRatingLocked ? 1 : 0, entry.firstListenedAt, entry.listenedAt, entry.createdAt, entry.updatedAt];
}

function summaryValues(summary: YearlySummary) {
  return [summary.id, summary.year, summary.title, summary.content, summary.analysisJson, summary.analysisVersion, summary.sourceFingerprint, summary.sourceEntryCount, summary.generatedAt, summary.createdAt, summary.updatedAt];
}

function monthlySummaryValues(summary: MonthlySummary) {
  return [summary.id, summary.year, summary.month, summary.title, summary.content, summary.themeId, summary.analysisJson, summary.analysisVersion, summary.sourceFingerprint, summary.sourceEntryCount, summary.generatedAt, summary.createdAt, summary.updatedAt];
}

function coverValues(cover: CoverRow) {
  return [cover.coverKey, cover.kind, cover.albumName, cover.songName, cover.artistName, cover.dataUrl, cover.updatedAt];
}

function listeningMomentValues(moment: ListeningMoment) {
  return [moment.id, moment.entryId, moment.listenedAt, moment.rating, moment.ratingModifier, JSON.stringify(moment.moods), moment.content, moment.createdAt, moment.updatedAt];
}

function validateEntry(entry: ReviewEntry) {
  if (!ENTRY_TYPES.includes(entry.type)) throw new Error("记录类型必须是 year / month / album / song");
  if (!entry.title.trim()) throw new Error("标题不能为空");
  if (!entry.content.trim()) throw new Error("正文内容不能为空");
  if (!Number.isInteger(entry.year) || entry.year < 1 || entry.year > 9999) throw new Error("年份范围必须是 1-9999");
  if (entry.month !== null && (!Number.isInteger(entry.month) || entry.month < 1 || entry.month > 12)) throw new Error("月份范围必须是 1-12");
  if (entry.rating !== null && (typeof entry.rating !== "number" || !Number.isFinite(entry.rating) || entry.rating < 0.5 || entry.rating > 10)) throw new Error("评分范围必须是 0.5-10");
  // ponytail: 综合分允许 0.1 步进（多维度均值自动计算），不再强制 0.5 步进
  if (entry.ratingModifier !== null && entry.ratingModifier !== "+" && entry.ratingModifier !== "-") throw new Error("评分修饰符必须是 + 或 -");
  if (entry.rating === null && entry.ratingModifier !== null) throw new Error("评分修饰符只能与评分一起使用");
  for (const [dim, label] of [["ratingProduction", "制作"], ["ratingSongwriting", "词曲"], ["ratingLyrics", "词"], ["ratingComposition", "曲"], ["ratingVocals", "人声"], ["ratingOriginality", "原创性"], ["ratingResonance", "共鸣"]] as const) {
    const value = entry[dim] ?? null;
    if (value !== null && (typeof value !== "number" || !Number.isFinite(value) || value < 0.5 || value > 10)) throw new Error(`${label}评分范围必须是 0.5-10`);
    if (value !== null && !isHalfStep(value)) throw new Error(`${label}评分必须是 0.5 的整数倍`);
  }
  if (entry.firstListenedAt !== null && !isValidDateString(entry.firstListenedAt)) throw new Error("首次收听时间必须是有效时间字符串");
  readMusicMetadata(entry.musicMetadata, "entry.musicMetadata");
}

type BackupData = {
  version: 6;
  sourceVersion: number;
  draftsPresence: "absent" | "present";
  drafts: StoredEntryDraft[];
  exportedAt: string;
  entries: ReviewEntry[];
  summaries: YearlySummary[];
  monthlySummaries: MonthlySummary[];
  covers: CoverRow[];
  listeningMoments: ListeningMoment[];
  appData: Record<string, string>;
};

export type RestoreDiffCounts = { added: number; changed: number; unchanged: number; removed: number };
export type RestoreDiffReport = {
  inputSha256: string;
  localSha256: string;
  includeCovers: boolean;
  sourceVersion: number;
  groups: Record<"entries" | "summaries" | "monthlySummaries" | "listeningMoments" | "covers" | "appData" | "drafts", RestoreDiffCounts>;
};
export type RestoreRehearsal = RestoreDiffReport & { verified: true; target: "web-isolated-storage" | "android-isolated-sqlite" | "windows-isolated-sqlite"; isolationDatabase?: string };

function parseBackup(raw: string, options: { includeCovers?: boolean } = {}): BackupData {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("备份 JSON 格式错误");
  }
  if (!isRecord(parsed)) throw new Error("备份内容必须是 JSON 对象");
  const version = parsed.version;
  if (version !== 1 && version !== 2 && version !== 3 && version !== 4 && version !== 5 && version !== 6) throw new Error("备份版本不支持");
  if (!isValidDateString(parsed.exportedAt)) throw new Error("备份导出时间无效");
  if (version < 6 && Object.hasOwn(parsed, "drafts")) throw new Error("v1–v5 备份不能含 drafts，来源格式矛盾");
  const drafts = version === 6 ? readBackupDrafts(parsed.drafts, options) : [];

  const entries = readArray(parsed.entries, "entries").map((entry) => readEntry(entry, version >= 2));
  const summaries = readArray(parsed.summaries, "summaries").map((summary) => readSummary(summary, version >= 3));
  const monthlySummaries = version >= 3 ? readArray(parsed.monthlySummaries, "monthlySummaries").map((summary) => readMonthlySummary(summary)) : [];
  const covers = options.includeCovers === false ? [] : readArray(parsed.covers, "covers").map(readCover);
  const listeningMoments = version >= 4 ? readArray(parsed.listeningMoments, "listeningMoments").map(readListeningMoment) : [];
  const appData = version >= 3 ? readBackupAppData(parsed.appData) : {};
  assertUniqueBackupKeys(entries, item => item.id, "entries.id");
  assertUniqueBackupKeys(summaries, item => item.id, "summaries.id");
  assertUniqueBackupKeys(summaries, item => String(item.year), "summaries.year");
  assertUniqueBackupKeys(monthlySummaries, item => item.id, "monthlySummaries.id");
  assertUniqueBackupKeys(monthlySummaries, item => `${item.year}-${item.month}`, "monthlySummaries.year/month");
  assertUniqueBackupKeys(covers, item => item.coverKey, "covers.coverKey");
  assertUniqueBackupKeys(listeningMoments, item => item.id, "listeningMoments.id");
  const entryIds = new Set(entries.map(item => item.id));
  if (listeningMoments.some(item => !entryIds.has(item.entryId))) throw new Error("重听记录引用了备份中不存在的乐评");
  return { version: 6, sourceVersion: version, draftsPresence: version === 6 ? "present" : "absent", drafts, exportedAt: parsed.exportedAt, entries, summaries, monthlySummaries, covers, listeningMoments, appData };
}

function assertUniqueBackupKeys<T>(values: T[], keyOf: (value: T) => string, label: string) {
  const seen = new Set<string>();
  for (const value of values) {
    const key = keyOf(value);
    if (seen.has(key)) throw new Error(`${label} 重复`);
    seen.add(key);
  }
}

function summarizeBackup(backup: BackupData): BackupPreview {
  return {
    sourceVersion: backup.sourceVersion,
    draftsPresence: backup.draftsPresence,
    ...draftPreview(backup.drafts),
    exportedAt: backup.exportedAt,
    entryCount: backup.entries.length,
    summaryCount: backup.summaries.length,
    monthlySummaryCount: backup.monthlySummaries.length,
    coverCount: backup.covers.length,
    listeningMomentCount: backup.listeningMoments.length,
  };
}

type RestoreSnapshot = {
  kind: "codex-import-undo";
  version: 1;
  beforeBackup: string;
  beforeDrafts: StoredEntryDraft[];
  beforeAppData: Record<string, string>;
  beforeWebStorage?: Record<string, string | null>;
};
type RestoreJournal = RestoreSnapshot & {
  operation: "import" | "undo";
  phase: "prepared" | "data-written" | "rolling-back";
  beforeUndo: string | null;
};
function userAppData(data: Record<string, string>) {
  return Object.fromEntries(Object.entries(data).filter(([key]) => key !== BACKUP_HEALTH_KEY && key !== NATIVE_RESTORE_JOURNAL_KEY));
}
function deviceAppData(data: Record<string, string>) {
  return Object.fromEntries(Object.entries(data).filter(([key]) => key === BACKUP_HEALTH_KEY));
}
function readRawDrafts(value: unknown): StoredEntryDraft[] {
  const seen = new Set<string>();
  return readArray(value, "drafts").map(item => {
    if (!isRecord(item) || typeof item.key !== "string" || !item.key.startsWith("music-feelings-entry-draft:v1:")
      || typeof item.raw !== "string" || seen.has(item.key)) throw new Error("草稿键无效或重复，原文已保留");
    seen.add(item.key);
    return { key: item.key, raw: item.raw };
  });
}
function readBackupDrafts(value: unknown, options: { includeCovers?: boolean } = {}) {
  let newCount = 0;
  const drafts = readRawDrafts(value).map(item => {
    const draft = readStoredEntryDraft(item.key, item.raw);
    if (!draft) throw new Error("草稿损坏或键与内容不一致，请在草稿箱抢救原文并整理后重试");
    if (draft.mode === "create") newCount++;
    return options.includeCovers === false
      ? { key: item.key, raw: JSON.stringify({ ...JSON.parse(item.raw), coverDataUrl: null, coverChanged: false, coverFromPlayback: undefined }) }
      : item;
  });
  if (newCount > MAX_NEW_DRAFTS) throw new Error(`新建草稿超过 ${MAX_NEW_DRAFTS} 份，请先整理备份中的草稿`);
  return drafts;
}
function draftPreview(drafts: StoredEntryDraft[]) {
  return {
    draftCount: drafts.length,
    newDraftCount: drafts.filter(item => item.key === "music-feelings-entry-draft:v1:new" || item.key.startsWith("music-feelings-entry-draft:v1:new:")).length,
    editDraftCount: drafts.filter(item => item.key.startsWith("music-feelings-entry-draft:v1:edit:")).length,
    localDraftCount: listRawEntryDrafts(localStorage).length,
  };
}
function replaceDrafts(drafts: StoredEntryDraft[], storage: Storage = localStorage) {
  const keys = new Set(drafts.map(item => item.key));
  for (const item of drafts) storage.setItem(item.key, item.raw);
  for (const item of listRawEntryDrafts(storage)) if (!keys.has(item.key)) storage.removeItem(item.key);
}
function draftSignature(drafts: StoredEntryDraft[]) {
  return JSON.stringify([...drafts].sort((a, b) => a.key.localeCompare(b.key)));
}
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (isRecord(value)) return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonical(value[key])}`).join(",")}}`;
  return JSON.stringify(value);
}

async function sha256(value: string) {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(bytes), byte => byte.toString(16).padStart(2, "0")).join("");
}

function restoreDiffCounts<T>(before: T[], after: T[], keyOf: (value: T) => string): RestoreDiffCounts {
  const old = new Map(before.map(item => [keyOf(item), canonical(item)]));
  const next = new Map(after.map(item => [keyOf(item), canonical(item)]));
  let added = 0, changed = 0, unchanged = 0, removed = 0;
  for (const [key, value] of next) {
    if (!old.has(key)) added++;
    else if (old.get(key) === value) unchanged++;
    else changed++;
  }
  for (const key of old.keys()) if (!next.has(key)) removed++;
  return { added, changed, unchanged, removed };
}

function createIsolatedStorage(): Storage {
  const values = new Map<string, string>();
  return {
    get length() { return values.size; },
    clear: () => values.clear(),
    getItem: key => values.get(key) ?? null,
    key: index => [...values.keys()][index] ?? null,
    removeItem: key => { values.delete(key); },
    setItem: (key, value) => { values.set(key, value); },
  };
}
function mainSignature(value: Pick<BackupData, "entries" | "summaries" | "monthlySummaries" | "covers" | "listeningMoments" | "appData">) {
  return canonical({ ...Object.fromEntries((["entries", "summaries", "monthlySummaries", "covers", "listeningMoments"] as const)
    .map(key => [key, value[key].map(canonical).sort()])), appData: value.appData });
}
function readWebSnapshot(raw: Record<string, string | null>) {
  const parsed = WEB_DATA_KEYS.map((key, index) => raw[key] === null ? (index === 5 ? {} : []) : JSON.parse(raw[key]));
  const appData = parsed[5];
  if (!isRecord(appData) || Object.values(appData).some(value => typeof value !== "string") || Object.hasOwn(appData, NATIVE_RESTORE_JOURNAL_KEY)) throw new Error("应用数据快照无效");
  return {
    entries: readArray(parsed[0], "entries").map(item => readEntry(item)),
    summaries: readArray(parsed[1], "summaries").map(item => readSummary(item)),
    monthlySummaries: readArray(parsed[2], "monthlySummaries").map(item => readMonthlySummary(item, false)),
    covers: readArray(parsed[3], "covers").map(readCover),
    listeningMoments: readArray(parsed[4], "listeningMoments").map(readListeningMoment),
    appData: appData as Record<string, string>,
  };
}
function readRestoreSnapshot(value: unknown, native: boolean): RestoreSnapshot {
  if (!isRecord(value) || value.version !== 1 || value.kind !== "codex-import-undo" || typeof value.beforeBackup !== "string"
    || !isRecord(value.beforeAppData) || Object.values(value.beforeAppData).some(item => typeof item !== "string")
    || Object.hasOwn(value.beforeAppData, NATIVE_RESTORE_JOURNAL_KEY)) throw new Error("恢复快照格式无效，原文已保留");
  const backup = parseBackup(value.beforeBackup);
  if (backup.sourceVersion !== 6 || backup.drafts.length !== 0) throw new Error("内部快照必须为不含草稿的 v6 数据");
  const beforeAppData = value.beforeAppData as Record<string, string>;
  if (canonical(backup.appData) !== canonical(userAppData(beforeAppData))) throw new Error("恢复快照应用数据矛盾");
  const beforeDrafts = readRawDrafts(value.beforeDrafts);
  let beforeWebStorage: Record<string, string | null> | undefined;
  if (!native) {
    const raw = value.beforeWebStorage;
    if (!isRecord(raw) || Object.keys(raw).length !== WEB_DATA_KEYS.length
      || WEB_DATA_KEYS.some(key => !Object.hasOwn(raw, key) || (raw[key] !== null && typeof raw[key] !== "string"))) throw new Error("恢复快照的六个存储键不完整");
    beforeWebStorage = raw as Record<string, string | null>;
    const snapshot = readWebSnapshot(beforeWebStorage);
    if (mainSignature(snapshot) !== mainSignature({ ...backup, appData: beforeAppData })) throw new Error("恢复快照原文与正式数据不一致");
  } else if (value.beforeWebStorage !== undefined) throw new Error("原生恢复快照不能含 Web 存储键");
  return { kind: "codex-import-undo", version: 1, beforeBackup: value.beforeBackup, beforeDrafts, beforeAppData, ...(beforeWebStorage ? { beforeWebStorage } : {}) };
}
function readRestoreJournal(raw: string, native: boolean): RestoreJournal {
  const value: unknown = JSON.parse(raw);
  if (!isRecord(value) || (value.operation !== "import" && value.operation !== "undo")
    || !["prepared", "data-written", "rolling-back"].includes(String(value.phase))
    || (value.beforeUndo !== null && typeof value.beforeUndo !== "string")) throw new Error("恢复日志格式无效，原文已保留");
  return { ...readRestoreSnapshot({ ...value, kind: "codex-import-undo" }, native), operation: value.operation, phase: value.phase as RestoreJournal["phase"], beforeUndo: value.beforeUndo };
}

function readEntry(value: unknown, metadataRequired = false): ReviewEntry {
  if (!isRecord(value)) throw new Error("entries 必须是记录对象数组");
  if (metadataRequired && value.musicMetadata === undefined) throw new Error("entries.musicMetadata 缺失");
  const entry: ReviewEntry = {
    id: readString(value.id, "entries.id"),
    type: readString(value.type, "entries.type") as EntryType,
    title: readString(value.title, "entries.title"),
    year: readInt(value.year, "entries.year"),
    month: readNullableInt(value.month, "entries.month"),
    albumName: readNullableField(value.albumName, "entries.albumName"),
    songName: readNullableField(value.songName, "entries.songName"),
    artistName: readNullableField(value.artistName, "entries.artistName"),
    musicMetadata: readMusicMetadata(value.musicMetadata, "entries.musicMetadata"),
    content: readString(value.content, "entries.content"),
    tags: readStringArray(value.tags, "entries.tags"),
    moods: readStringArray(value.moods, "entries.moods"),
    rating: readNullableNumber(value.rating, "entries.rating"),
    ratingModifier: parseRatingModifier(readNullableField(value.ratingModifier, "entries.ratingModifier")),
    ratingProduction: readNullableNumber(value.ratingProduction, "entries.ratingProduction"),
    ratingSongwriting: readNullableNumber(value.ratingSongwriting, "entries.ratingSongwriting"),
    ratingLyrics: readNullableNumber(value.ratingLyrics, "entries.ratingLyrics"),
    ratingComposition: readNullableNumber(value.ratingComposition, "entries.ratingComposition"),
    ratingVocals: readNullableNumber(value.ratingVocals, "entries.ratingVocals"),
    ratingOriginality: readNullableNumber(value.ratingOriginality, "entries.ratingOriginality"),
    ratingResonance: readNullableNumber(value.ratingResonance, "entries.ratingResonance"),
    compositeRatingLocked: value.compositeRatingLocked === true,
    firstListenedAt: readNullableDate(value.firstListenedAt, "entries.firstListenedAt"),
    listenedAt: readNullableDate(value.listenedAt, "entries.listenedAt"),
    createdAt: readDate(value.createdAt, "entries.createdAt"),
    updatedAt: readDate(value.updatedAt, "entries.updatedAt"),
  };
  validateEntry(entry);
  return entry;
}

function readSummary(value: unknown, structuredRequired = false): YearlySummary {
  if (!isRecord(value)) throw new Error("summaries 必须是总结对象数组");
  const analysisJson = value.analysisJson === undefined && !structuredRequired ? null : readNullableField(value.analysisJson, "summaries.analysisJson");
  const analysisVersion = value.analysisVersion === undefined && !structuredRequired ? null : readNullableInt(value.analysisVersion, "summaries.analysisVersion");
  const sourceFingerprint = value.sourceFingerprint === undefined && !structuredRequired ? null : readNullableField(value.sourceFingerprint, "summaries.sourceFingerprint");
  if (analysisJson) parseYearlyListeningSnapshot(analysisJson);
  return {
    id: readString(value.id, "summaries.id"),
    year: readInt(value.year, "summaries.year"),
    title: readString(value.title, "summaries.title"),
    content: readString(value.content, "summaries.content"),
    analysisJson,
    analysisVersion,
    sourceFingerprint,
    sourceEntryCount: readInt(value.sourceEntryCount, "summaries.sourceEntryCount"),
    generatedAt: readDate(value.generatedAt, "summaries.generatedAt"),
    createdAt: readDate(value.createdAt, "summaries.createdAt"),
    updatedAt: readDate(value.updatedAt, "summaries.updatedAt"),
  };
}

function readMonthlySummary(value: unknown, validateSnapshot = true): MonthlySummary {
  if (!isRecord(value)) throw new Error("monthlySummaries 必须是总结对象数组");
  const analysisJson = readString(value.analysisJson, "monthlySummaries.analysisJson");
  // Keep locally saved text visible when an old generated snapshot is unreadable.
  // Backup imports still require full snapshot validation.
  const snapshot = validateSnapshot ? parseMonthlyListeningSnapshot(analysisJson) : null;
  const summary: MonthlySummary = {
    id: readString(value.id, "monthlySummaries.id"),
    year: readInt(value.year, "monthlySummaries.year"),
    month: readInt(value.month, "monthlySummaries.month"),
    title: readString(value.title, "monthlySummaries.title"),
    content: readString(value.content, "monthlySummaries.content"),
    themeId: readString(value.themeId, "monthlySummaries.themeId"),
    analysisJson,
    analysisVersion: readInt(value.analysisVersion, "monthlySummaries.analysisVersion"),
    sourceFingerprint: readNullableField(value.sourceFingerprint, "monthlySummaries.sourceFingerprint"),
    sourceEntryCount: readInt(value.sourceEntryCount, "monthlySummaries.sourceEntryCount"),
    generatedAt: readDate(value.generatedAt, "monthlySummaries.generatedAt"),
    createdAt: readDate(value.createdAt, "monthlySummaries.createdAt"),
    updatedAt: readDate(value.updatedAt, "monthlySummaries.updatedAt"),
  };
  if (snapshot && (summary.year !== snapshot.year || summary.month !== snapshot.month || summary.themeId !== snapshot.theme.id)) throw new Error("月度总结与分析快照不匹配");
  return summary;
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
  if (value === null || value === undefined) return null;
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
  if (value === null || value === undefined) return null;
  return readInt(value, key);
}

function readNullableNumber(value: unknown, key: string): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== "number" || !Number.isFinite(value)) throw new Error(`${key} 必须是有效数字`);
  return value;
}

function isHalfStep(value: number) {
  return Math.abs(value * 2 - Math.round(value * 2)) < 0.001;
}

function parseRatingModifier(value: string | null): RatingModifier | null {
  if (!value) return null;
  if (value !== "+" && value !== "-") throw new Error("评分修饰符必须是 + 或 -");
  return value;
}

function readDate(value: unknown, key: string) {
  if (!isValidDateString(value)) throw new Error(`${key} 必须是有效时间字符串`);
  return value;
}

function readNullableDate(value: unknown, key: string) {
  if (value === null || value === undefined) return null;
  return readDate(value, key);
}

function isValidDateString(value: unknown): value is string {
  return typeof value === "string" && !Number.isNaN(new Date(value).getTime());
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

// ponytail: 列表可继续显示有效行，但原数组保留在隔离副本前不得被任何 write* 重写。
function tolerantMap<T>(values: unknown[], read: (value: unknown) => T, key: string, raw: string | null): T[] {
  let damaged = false;
  const result = values.flatMap((value) => {
    try {
      return [read(value)];
    } catch (error) {
      damaged = true;
      console.warn("跳过损坏的本地数据条目", error);
      return [];
    }
  });
  if (damaged && raw !== null) {
    try {
      preserveStorageCorruption(localStorage, key, raw);
    } catch (error) {
      const detail = error instanceof Error ? `：${error.message}` : "";
      throw new Error(`本地数据 ${key} 含有损坏条目，原始集合仍保留但隔离副本保存失败${detail}`);
    }
  }
  return result;
}

function readEntries() {
  return readCollection(ENTRIES_KEY, (entry) => readEntry(entry), "entries");
}

function writeEntries(entries: ReviewEntry[]) {
  assertLocalStorageIntegrity();
  localStorage.setItem(ENTRIES_KEY, JSON.stringify(entries));
}

function readSummaries() {
  return readCollection(SUMMARIES_KEY, (summary) => readSummary(summary), "summaries");
}

function writeSummaries(summaries: YearlySummary[]) {
  assertLocalStorageIntegrity();
  localStorage.setItem(SUMMARIES_KEY, JSON.stringify(summaries));
}

function readMonthlySummaries() {
  return readCollection(MONTHLY_SUMMARIES_KEY, (summary) => readMonthlySummary(summary, false), "monthly summaries");
}

function writeMonthlySummaries(summaries: MonthlySummary[]) {
  assertLocalStorageIntegrity();
  localStorage.setItem(MONTHLY_SUMMARIES_KEY, JSON.stringify(summaries));
}

function readCovers() {
  return readCollection(COVERS_KEY, readCover, "covers");
}

function writeCovers(covers: CoverRow[]) {
  assertLocalStorageIntegrity();
  localStorage.setItem(COVERS_KEY, JSON.stringify(covers));
}

function readListeningMoments(): ListeningMoment[] {
  return readCollection(LISTENING_MOMENTS_KEY, readListeningMoment, "listening moments");
}

function writeListeningMoments(moments: ListeningMoment[]) {
  assertLocalStorageIntegrity();
  localStorage.setItem(LISTENING_MOMENTS_KEY, JSON.stringify(moments));
}

function readListeningMoment(value: unknown): ListeningMoment {
  if (!isRecord(value)) throw new Error("listeningMoments 必须是记录对象数组");
  return {
    id: readString(value.id, "listeningMoments.id"),
    entryId: readString(value.entryId, "listeningMoments.entryId"),
    listenedAt: readDate(value.listenedAt, "listeningMoments.listenedAt"),
    rating: readNullableNumber(value.rating, "listeningMoments.rating"),
    ratingModifier: parseRatingModifier(readNullableField(value.ratingModifier, "listeningMoments.ratingModifier")),
    moods: readStringArray(value.moods, "listeningMoments.moods"),
    content: readString(value.content, "listeningMoments.content"),
    createdAt: readDate(value.createdAt, "listeningMoments.createdAt"),
    updatedAt: readDate(value.updatedAt, "listeningMoments.updatedAt"),
  };
}

function restoreStorage(key: string, value: string | null, storage: Storage = localStorage) {
  if (value === null) {
    storage.removeItem(key);
    return;
  }
  storage.setItem(key, value);
}

function readJsonWithRaw<T>(key: string, fallback: T): { value: T; raw: string | null } {
  const raw = localStorage.getItem(key);
  return { value: readSafeJson(localStorage, key, fallback), raw };
}

function readCollection<T>(key: string, read: (value: unknown) => T, label: string): T[] {
  const { value, raw } = readJsonWithRaw<unknown>(key, []);
  if (!Array.isArray(value)) {
    if (raw !== null) preserveStorageCorruption(localStorage, key, raw);
    throw new Error(`本地数据 ${key} 的 ${label}结构无效，原始内容仍保留，请前往备份页处理`);
  }
  return tolerantMap(value, read, key, raw);
}

function assertLocalStorageIntegrity() {
  const checks: Array<[string, () => unknown]> = [
    [ENTRIES_KEY, readEntries],
    [SUMMARIES_KEY, readSummaries],
    [MONTHLY_SUMMARIES_KEY, readMonthlySummaries],
    [COVERS_KEY, readCovers],
    [LISTENING_MOMENTS_KEY, readListeningMoments],
    [APP_DATA_KEY, readAppData],
  ];
  const failedKeys = new Set<string>();
  for (const [key, read] of checks) {
    try {
      read();
    } catch {
      // Continue scanning so one damaged collection cannot hide the others.
      failedKeys.add(key);
    }
  }
  const corruptions = readStorageCorruptions(localStorage);
  const keys = Array.from(new Set([...failedKeys, ...corruptions.map((item) => item.key)])).join("、");
  if (!keys) return;
  throw new Error(`本地数据 ${keys} 含有损坏条目，原文已保留；请先在备份页抢救，当前备份不完整，已阻止写入或导出`);
}

function decodeList(value: string | null) {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string" && item.trim().length > 0) : [];
  } catch {
    // ponytail: 旧版数据可能是纯字符串格式，回退到 parseList 避免标签丢失
    return parseList(value);
  }
}

function readAppData() {
  const { value, raw } = readJsonWithRaw<unknown>(APP_DATA_KEY, {});
  if (!isRecord(value) || Object.values(value).some((item) => typeof item !== "string")) {
    if (raw !== null) preserveStorageCorruption(localStorage, APP_DATA_KEY, raw);
    throw new Error(`本地数据 ${APP_DATA_KEY} 的应用数据映射结构无效，原始内容仍保留，请前往备份页处理`);
  }
  return value as Record<string, string>;
}

function writeAppData(value: Record<string, string>) {
  assertLocalStorageIntegrity();
  localStorage.setItem(APP_DATA_KEY, JSON.stringify(value));
}

function encodeMusicMetadata(value: ReviewEntry["musicMetadata"]) {
  return value ? JSON.stringify(value) : null;
}

function decodeMusicMetadata(value: string | null) {
  if (!value) return null;
  try {
    return readMusicMetadata(JSON.parse(value));
  } catch {
    throw new Error("数据库中的音乐元数据格式无效");
  }
}

// ponytail: 容错版——单条损坏数据不阻塞整列表加载，降级为 null
function safeDecodeMusicMetadata(value: string | null) {
  try { return decodeMusicMetadata(value); } catch { return null; }
}

function safeDecodeList(value: string | null) {
  try { return decodeList(value); } catch { return []; }
}

function safeParseRatingModifier(value: string | null) {
  try { return parseRatingModifier(value); } catch { return null; }
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

function normalizeCoverTarget(kind: CoverKind, target: CoverTarget): CoverTarget {
  return kind === "album"
    ? { albumName: target.albumName ?? null, artistName: target.artistName ?? null }
    : { albumName: target.albumName ?? null, songName: target.songName ?? null, artistName: target.artistName ?? null };
}

function directCover(covers: CoverRow[], kind: CoverKind, target: CoverTarget) {
  const key = coverKey(kind, normalizeCoverTarget(kind, target));
  return nullableString(covers.find((cover) => cover.coverKey === key)?.dataUrl);
}

function resolveAlbumCover(covers: CoverRow[], entries: ReviewEntry[], target: Pick<CoverTarget, "albumName" | "artistName">) {
  const albumTarget = { albumName: target.albumName, artistName: target.artistName };
  const existing = directCover(covers, "album", albumTarget);
  if (existing || !target.albumName) return existing;

  const albumSongNames = new Set(entries
    .filter((entry) => entry.type === "album" && sameAlbum(entry, target) && entry.songName)
    .map((entry) => entry.songName as string));
  if (!albumSongNames.size) return null;

  const legacyImages = new Set(covers
    .filter((cover) => cover.kind === "song" && sameAlbum(cover, target) && !!cover.songName && albumSongNames.has(cover.songName) && !!nullableString(cover.dataUrl))
    .map((cover) => cover.dataUrl));
  return legacyImages.size === 1 ? Array.from(legacyImages)[0] : null;
}

function sameAlbum(left: Pick<CoverTarget, "albumName" | "artistName">, right: Pick<CoverTarget, "albumName" | "artistName">) {
  return left.albumName === right.albumName && left.artistName === right.artistName;
}

function dispatchCoverChanged() {
  if (typeof window === "undefined" || typeof window.dispatchEvent !== "function" || typeof Event !== "function") return;
  window.dispatchEvent(new Event("codex:cover-changed"));
}

function coverKey(kind: CoverKind, target: CoverTarget) {
  return JSON.stringify([kind, target.albumName ?? "", target.songName ?? "", target.artistName ?? ""]);
}

function isAutomaticEntry(entry: ReviewEntry) {
  return entry.type === "song" || entry.type === "album";
}

function exactEntryDate(entry: ReviewEntry) {
  return localDateOf(entry.createdAt);
}

function weatherKey(location: WeatherLocation, date: string) {
  return `listening-weather:${location.latitude},${location.longitude}:${date}`;
}

function sameWeatherLocation(left: WeatherLocation | null, right: WeatherLocation) {
  return !!left && left.latitude === right.latitude && left.longitude === right.longitude && left.timezone === right.timezone;
}

function unique<T>(values: T[]) {
  return Array.from(new Set(values));
}
