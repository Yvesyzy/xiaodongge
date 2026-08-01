import { Capacitor } from "@capacitor/core";
import { CapacitorSQLite, SQLiteConnection, type capSQLiteSet, type SQLiteDBConnection } from "@capacitor-community/sqlite";
import { buildAbstractMusicMap, buildVisualizationOptions, type VisualizationFilters } from "../../shared/visualizations";
import { fetchHistoricalWeather, fetchHistoricalWeatherRange, parseWeatherLocation, parseWeatherRecord, searchWeatherLocations, type WeatherLocation, type WeatherRecord } from "../../shared/listeningContext";
import type { ListeningLayer, SemanticOverride } from "../../shared/listeningAnalysis";
import { excerpt, localDateOf } from "./format";
import { formatEntriesCsv, formatEntriesTxt } from "./exportFormats";
import { buildDayListeningSnapshot, buildMonthlyListeningSnapshot, buildYearlyListeningSnapshot, monthlySnapshotToMarkdown, parseMonthlyListeningSnapshot, parseYearlyListeningSnapshot, yearlySnapshotToMarkdown, type ListeningDaySnapshot, type MonthlyListeningSnapshot, type YearlyListeningSnapshot } from "./listeningYearbook";
import { readMusicMetadata } from "./musicMetadata";
import { ENTRY_TYPES, type AlbumAggregate, type CoverKind, type CoverTarget, type EntryInput, type EntryType, type FrequencyItem, type ListeningMoment, type ListeningMomentInput, type MonthlySummary, type RatingModifier, type ReviewEntry, type SongAggregate, type YearStats, type YearlySummary } from "./types";

const DB_NAME = "music_feelings_archive";
const ENTRIES_KEY = "music-feelings-mobile-entries";
const SUMMARIES_KEY = "music-feelings-mobile-summaries";
const MONTHLY_SUMMARIES_KEY = "music-feelings-mobile-monthly-summaries";
const COVERS_KEY = "music-feelings-mobile-covers";
const LISTENING_MOMENTS_KEY = "music-feelings-mobile-listening-moments";
const APP_DATA_KEY = "music-feelings-mobile-app-data";
const IMPORT_UNDO_KEY = "music-feelings-mobile-import-undo";
const WEATHER_LOCATION_KEY = "listening-weather-location";
const SEMANTIC_OVERRIDES_KEY = "listening-semantic-overrides";

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
  ratingOriginality REAL,
  ratingResonance REAL,
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
    for (const dim of ["ratingProduction", "ratingSongwriting", "ratingOriginality", "ratingResonance"] as const) {
      if (!(columns.values ?? []).some((column) => column.name === dim)) {
        await this.db.run(`ALTER TABLE ReviewEntry ADD COLUMN ${dim} REAL`);
      }
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
      `INSERT INTO ReviewEntry (id, type, title, year, month, albumName, songName, artistName, musicMetadata, content, tags, moods, rating, ratingModifier, ratingProduction, ratingSongwriting, ratingOriginality, ratingResonance, firstListenedAt, listenedAt, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
      `UPDATE ReviewEntry SET type=?, title=?, year=?, month=?, albumName=?, songName=?, artistName=?, musicMetadata=?, content=?, tags=?, moods=?, rating=?, ratingModifier=?, ratingProduction=?, ratingSongwriting=?, ratingOriginality=?, ratingResonance=?, firstListenedAt=?, listenedAt=?, updatedAt=? WHERE id=?`,
      [entry.type, entry.title, entry.year, entry.month, entry.albumName, entry.songName, entry.artistName, encodeMusicMetadata(entry.musicMetadata), entry.content, JSON.stringify(entry.tags), JSON.stringify(entry.moods), entry.rating, entry.ratingModifier, entry.ratingProduction, entry.ratingSongwriting, entry.ratingOriginality, entry.ratingResonance, entry.firstListenedAt, entry.listenedAt, entry.updatedAt, id],
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
    const years = unique(entries.filter(isAutomaticEntry).map((entry) => entry.year));
    const months = unique(entries.filter((entry) => entry.month !== null && (isAutomaticEntry(entry) || entry.type === "month")).map((entry) => `${entry.year}-${entry.month}`));
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

  async visualizationOptions() {
    return buildVisualizationOptions(await this.listEntries());
  }

  async abstractMusicMap(filters: VisualizationFilters) {
    return buildAbstractMusicMap(await this.listEntries(), filters);
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
    const entries = (await this.listEntries()).filter((entry) => entry.year === year && entry.month === month);
    const sourceEntries = entries.filter(isAutomaticEntry);
    if (!sourceEntries.length) throw new Error("该月份没有歌曲或专辑乐评，无法生成月度总结");
    const weather = await this.cachedWeatherForEntries(sourceEntries);
    const snapshot = buildMonthlyListeningSnapshot(year, month, entries, weather, await this.getSemanticOverrides());
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
    const entries = (await this.listEntries()).filter((entry) => entry.year === year).sort((a, b) => (a.month ?? 0) - (b.month ?? 0) || a.createdAt.localeCompare(b.createdAt));
    const sourceEntries = entries.filter(isAutomaticEntry);
    if (!sourceEntries.length) throw new Error("该年份没有歌曲或专辑乐评，无法生成年度总结");
    const months = unique(sourceEntries.map((entry) => entry.month).filter((month): month is number => month !== null)).sort((a, b) => a - b);
    const monthSnapshots: MonthlyListeningSnapshot[] = [];
    for (const month of months) {
      try {
        monthSnapshots.push(parseMonthlyListeningSnapshot((await this.generateMonthlySummary(year, month)).analysisJson));
      } catch {
        // 单个月份生成失败不阻塞整年总结，跳过该月
      }
    }
    const snapshot = buildYearlyListeningSnapshot(year, monthSnapshots, sourceEntries.filter((entry) => entry.month === null), await this.getSemanticOverrides());
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
    return searchWeatherLocations(query);
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
    const weather = await fetchHistoricalWeather(location, date);
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

  async exportBackup() {
    return JSON.stringify({
      version: 5,
      exportedAt: new Date().toISOString(),
      entries: await this.listEntries(),
      summaries: await this.listSummaries(),
      monthlySummaries: await this.listMonthlySummaries(),
      covers: await this.listCovers(),
      listeningMoments: await this.listListeningMoments(),
      appData: await this.listAppData(),
    }, null, 2);
  }

  async exportTxt() {
    return formatEntriesTxt(await this.listEntries(), await this.listSummaries());
  }

  async exportCsv() {
    return formatEntriesCsv(await this.listEntries(), await this.listSummaries());
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
      const oldMonthlySummaries = localStorage.getItem(MONTHLY_SUMMARIES_KEY);
      const oldCovers = localStorage.getItem(COVERS_KEY);
      const oldListeningMoments = localStorage.getItem(LISTENING_MOMENTS_KEY);
      const oldAppData = localStorage.getItem(APP_DATA_KEY);
      try {
        writeEntries(backup.entries);
        writeSummaries(backup.summaries);
        writeMonthlySummaries(backup.monthlySummaries);
        writeCovers(backup.covers);
        writeListeningMoments(backup.listeningMoments);
        writeAppData(backup.appData);
      } catch (error) {
        restoreStorage(ENTRIES_KEY, oldEntries);
        restoreStorage(SUMMARIES_KEY, oldSummaries);
        restoreStorage(MONTHLY_SUMMARIES_KEY, oldMonthlySummaries);
        restoreStorage(COVERS_KEY, oldCovers);
        restoreStorage(LISTENING_MOMENTS_KEY, oldListeningMoments);
        restoreStorage(APP_DATA_KEY, oldAppData);
        throw error;
      }
      return;
    }

    const set: capSQLiteSet[] = [
      { statement: "DELETE FROM ListeningMoment" },
      { statement: "DELETE FROM ReviewEntry" },
      { statement: "DELETE FROM YearlySummary" },
      { statement: "DELETE FROM MonthlySummary" },
      { statement: "DELETE FROM CoverImage" },
      { statement: "DELETE FROM AppData" },
      ...backup.listeningMoments.map((moment) => ({ statement: "INSERT INTO ListeningMoment (id, entryId, listenedAt, rating, ratingModifier, moods, content, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)", values: listeningMomentValues(moment) })),
      ...backup.entries.map((entry) => ({ statement: "INSERT INTO ReviewEntry (id, type, title, year, month, albumName, songName, artistName, musicMetadata, content, tags, moods, rating, ratingModifier, ratingProduction, ratingSongwriting, ratingOriginality, ratingResonance, firstListenedAt, listenedAt, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", values: entryValues(entry) })),
      ...backup.summaries.map((summary) => ({ statement: "INSERT INTO YearlySummary (id, year, title, content, analysisJson, analysisVersion, sourceFingerprint, sourceEntryCount, generatedAt, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", values: summaryValues(summary) })),
      ...backup.monthlySummaries.map((summary) => ({ statement: "INSERT INTO MonthlySummary (id, year, month, title, content, themeId, analysisJson, analysisVersion, sourceFingerprint, sourceEntryCount, generatedAt, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", values: monthlySummaryValues(summary) })),
      ...backup.covers.map((cover) => ({ statement: "INSERT INTO CoverImage (coverKey, kind, albumName, songName, artistName, dataUrl, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?)", values: coverValues(cover) })),
      ...Object.entries(backup.appData).map(([key, value]) => ({ statement: "INSERT INTO AppData (key, value) VALUES (?, ?)", values: [key, value] })),
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
        const fetched = await fetchHistoricalWeatherRange(location, missing[0], missing[missing.length - 1]);
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

  private async listListeningMoments() {
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

export const store = new Store();

export function parseList(value: string) {
  return Array.from(new Set(value.split(/[,，;；\n\t]/).map((item) => item.trim()).filter(Boolean)));
}

export function calculateYearStats(year: number, entries: ReviewEntry[]): YearStats {
  const ratings = entries.map((entry) => entry.rating).filter((rating): rating is number => rating !== null);
  const createdThisYear = entries.filter((entry) => entry.createdAt.slice(0, 4) === String(year)).length;
  return {
    year,
    totalEntries: entries.length,
    createdThisYear,
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
    musicMetadata: safeDecodeMusicMetadata(nullableString(row.musicMetadata)),
    content: String(row.content),
    tags: safeDecodeList(nullableString(row.tags)),
    moods: safeDecodeList(nullableString(row.moods)),
    rating: row.rating === null || row.rating === undefined ? null : Number(row.rating),
    ratingModifier: safeParseRatingModifier(nullableString(row.ratingModifier)),
    ratingProduction: row.ratingProduction === null || row.ratingProduction === undefined ? null : Number(row.ratingProduction),
    ratingSongwriting: row.ratingSongwriting === null || row.ratingSongwriting === undefined ? null : Number(row.ratingSongwriting),
    ratingOriginality: row.ratingOriginality === null || row.ratingOriginality === undefined ? null : Number(row.ratingOriginality),
    ratingResonance: row.ratingResonance === null || row.ratingResonance === undefined ? null : Number(row.ratingResonance),
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
  return [entry.id, entry.type, entry.title, entry.year, entry.month, entry.albumName, entry.songName, entry.artistName, encodeMusicMetadata(entry.musicMetadata), entry.content, JSON.stringify(entry.tags), JSON.stringify(entry.moods), entry.rating, entry.ratingModifier, entry.ratingProduction, entry.ratingSongwriting, entry.ratingOriginality, entry.ratingResonance, entry.firstListenedAt, entry.listenedAt, entry.createdAt, entry.updatedAt];
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
  for (const [dim, label] of [["ratingProduction", "制作"], ["ratingSongwriting", "词曲"], ["ratingOriginality", "原创性"], ["ratingResonance", "共鸣"]] as const) {
    const value = entry[dim];
    if (value !== null && (typeof value !== "number" || !Number.isFinite(value) || value < 0.5 || value > 10)) throw new Error(`${label}评分范围必须是 0.5-10`);
    if (value !== null && !isHalfStep(value)) throw new Error(`${label}评分必须是 0.5 的整数倍`);
  }
  if (entry.firstListenedAt !== null && !isValidDateString(entry.firstListenedAt)) throw new Error("首次收听时间必须是有效时间字符串");
  readMusicMetadata(entry.musicMetadata, "entry.musicMetadata");
}

type BackupData = {
  version: 5;
  exportedAt: string;
  entries: ReviewEntry[];
  summaries: YearlySummary[];
  monthlySummaries: MonthlySummary[];
  covers: CoverRow[];
  listeningMoments: ListeningMoment[];
  appData: Record<string, string>;
};

function parseBackup(raw: string): BackupData {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("备份 JSON 格式错误");
  }
  if (!isRecord(parsed)) throw new Error("备份内容必须是 JSON 对象");
  const version = parsed.version;
  if (version !== 1 && version !== 2 && version !== 3 && version !== 4 && version !== 5) throw new Error("备份版本不支持");
  if (!isValidDateString(parsed.exportedAt)) throw new Error("备份导出时间无效");

  const entries = readArray(parsed.entries, "entries").map((entry) => readEntry(entry, version >= 2));
  const summaries = readArray(parsed.summaries, "summaries").map((summary) => readSummary(summary, version >= 3));
  const monthlySummaries = version >= 3 ? readArray(parsed.monthlySummaries, "monthlySummaries").map(readMonthlySummary) : [];
  const covers = readArray(parsed.covers, "covers").map(readCover);
  const listeningMoments = version >= 4 ? readArray(parsed.listeningMoments, "listeningMoments").map(readListeningMoment) : [];
  const appData = version >= 3 ? readBackupAppData(parsed.appData) : {};
  return { version: 5, exportedAt: parsed.exportedAt, entries, summaries, monthlySummaries, covers, listeningMoments, appData };
}

function summarizeBackup(backup: BackupData) {
  return {
    exportedAt: backup.exportedAt,
    entryCount: backup.entries.length,
    summaryCount: backup.summaries.length,
    monthlySummaryCount: backup.monthlySummaries.length,
    coverCount: backup.covers.length,
    listeningMomentCount: backup.listeningMoments.length,
  };
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
    ratingOriginality: readNullableNumber(value.ratingOriginality, "entries.ratingOriginality"),
    ratingResonance: readNullableNumber(value.ratingResonance, "entries.ratingResonance"),
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

function readMonthlySummary(value: unknown): MonthlySummary {
  if (!isRecord(value)) throw new Error("monthlySummaries 必须是总结对象数组");
  const analysisJson = readString(value.analysisJson, "monthlySummaries.analysisJson");
  const snapshot = parseMonthlyListeningSnapshot(analysisJson);
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
  if (summary.year !== snapshot.year || summary.month !== snapshot.month || summary.themeId !== snapshot.theme.id) throw new Error("月度总结与分析快照不匹配");
  return summary;
}

function readBackupAppData(value: unknown) {
  if (!isRecord(value)) throw new Error("appData 必须是对象");
  const result: Record<string, string> = {};
  for (const [key, raw] of Object.entries(value)) {
    if (typeof raw !== "string") throw new Error("appData 值必须是字符串");
    if (key === WEATHER_LOCATION_KEY) parseWeatherLocation(JSON.parse(raw));
    else if (key.startsWith("listening-weather:")) parseWeatherRecord(JSON.parse(raw));
    else if (key.startsWith("listening-quote:")) readPreferredQuote(JSON.parse(raw));
    else if (key === SEMANTIC_OVERRIDES_KEY) {
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) throw new Error("本地语义校正格式无效");
      parsed.forEach(readSemanticOverride);
    } else throw new Error(`appData 包含不支持的键：${key}`);
    result[key] = raw;
  }
  return result;
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

function readEntries() {
  const values = readJson<unknown[]>(ENTRIES_KEY, []);
  return Array.isArray(values) ? values.map((entry) => readEntry(entry)) : [];
}

function writeEntries(entries: ReviewEntry[]) {
  localStorage.setItem(ENTRIES_KEY, JSON.stringify(entries));
}

function readSummaries() {
  const values = readJson<unknown[]>(SUMMARIES_KEY, []);
  return Array.isArray(values) ? values.map((summary) => readSummary(summary)) : [];
}

function readPreferredQuote(value: unknown) {
  if (!isRecord(value) || typeof value.entryId !== "string" || !value.entryId || typeof value.sentence !== "string" || !value.sentence.trim()) throw new Error("代表原句格式无效");
  return { entryId: value.entryId, sentence: value.sentence };
}

function readSemanticOverride(value: unknown): SemanticOverride {
  if (!isRecord(value) || !isListeningLayer(value.layer) || typeof value.term !== "string" || !value.term.trim() || (value.action !== "exclude" && value.action !== "move")) throw new Error("本地语义校正格式无效");
  const targetLayer = value.targetLayer === null ? null : isListeningLayer(value.targetLayer) ? value.targetLayer : null;
  if (value.action === "move" && !targetLayer) throw new Error("语义分类校正缺少目标类别");
  return { layer: value.layer, term: value.term.trim(), action: value.action, targetLayer: value.action === "exclude" ? null : targetLayer };
}

function isListeningLayer(value: unknown): value is ListeningLayer {
  return value === "feeling" || value === "subject" || value === "expression" || value === "genre";
}

function writeSummaries(summaries: YearlySummary[]) {
  localStorage.setItem(SUMMARIES_KEY, JSON.stringify(summaries));
}

function readMonthlySummaries() {
  const values = readJson<unknown[]>(MONTHLY_SUMMARIES_KEY, []);
  return Array.isArray(values) ? values.map(readMonthlySummary) : [];
}

function writeMonthlySummaries(summaries: MonthlySummary[]) {
  localStorage.setItem(MONTHLY_SUMMARIES_KEY, JSON.stringify(summaries));
}

function readCovers() {
  return readJson<CoverRow[]>(COVERS_KEY, []);
}

function writeCovers(covers: CoverRow[]) {
  localStorage.setItem(COVERS_KEY, JSON.stringify(covers));
}

function readListeningMoments(): ListeningMoment[] {
  const values = readJson<unknown[]>(LISTENING_MOMENTS_KEY, []);
  return Array.isArray(values) ? values.map(readListeningMoment) : [];
}

function writeListeningMoments(moments: ListeningMoment[]) {
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
    // ponytail: 旧版数据可能是纯字符串格式，回退到 parseList 避免标签丢失
    return parseList(value);
  }
}

function readAppData() {
  const value = readJson<unknown>(APP_DATA_KEY, {});
  return isRecord(value) ? Object.fromEntries(Object.entries(value).filter((item): item is [string, string] => typeof item[1] === "string")) : {};
}

function writeAppData(value: Record<string, string>) {
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

function coverKey(kind: CoverKind, target: CoverTarget) {
  return JSON.stringify([kind, target.albumName ?? "", target.songName ?? "", target.artistName ?? ""]);
}

function group<T>(items: T[], keyOf: (item: T) => string) {
  const map = new Map<string, T[]>();
  for (const item of items) map.set(keyOf(item), [...(map.get(keyOf(item)) ?? []), item]);
  return map;
}

function isAutomaticEntry(entry: ReviewEntry) {
  return entry.type === "song" || entry.type === "album";
}

function exactEntryDate(entry: ReviewEntry) {
  return localDateOf(entry.listenedAt);
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
