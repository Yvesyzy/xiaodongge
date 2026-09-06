import { ChangeEvent, FormEvent, useEffect, useId, useMemo, useRef, useState } from "react";
import { Capacitor, registerPlugin } from "@capacitor/core";
import { Link, NavLink, Route, Routes, useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { GENRE_TAGS, GENRE_TREE, findGenrePath, genreChildren, isKnownGenreTag, type GenreNode } from "../../shared/genres";
import { MOOD_CATEGORIES, MOOD_TAGS } from "../../shared/moods";
import { ABSTRACT_MAP_REGION_DEFS, UNCLASSIFIED_REGION_ID, UNIVERSE_GROUP_BY_OPTIONS, type AbstractMapRegion, type AbstractMapResult, type UniverseGroupBy, type VisualizationFilters, type VisualizationOptions, type VisualizationSong } from "../../shared/visualizations";
import { canRestoreEditDraft, countNewDrafts, createNewDraftId, deleteEntryDraftByKey, listEntryDrafts, MAX_NEW_DRAFTS, readEntryDraft, removeEntryDraft, writeEntryDraft, type EntryDraft, type EntryDraftFields, type EntryDraftMeta } from "./entryDraft";
import { toAlbumFirstRecognition } from "./albumFirst";
import { BACKUP_HEALTH_KEY, inspectBackup, parseBackupHealth, type BackupHealth } from "./backupHealth";
import { findSimilarEntry } from "./entryDuplicate";
import { excerpt, formatDate, formatDateOnly, monthLabel } from "./format";
import { buildInsights, type Insight } from "./insights";
import { DailyListeningNote, MonthlyListeningPage, YearlyListeningPage } from "./ListeningYearbookView";
import SimpleYearbookPage from "./codex_YearbookPage";
import { mergeMusicMetadata } from "./musicMetadata";
import { sameMusicIdentity } from "./musicIdentity";
import { NowPlaying } from "./nativeNowPlaying";
import { NativeExport } from "./nativeExport";
import { parseSharedMusicPayload, rememberSharedMusic, SharedMusic } from "./nativeSharedMusic";
import { applyAppleCatalogMatch, findAppleCatalogMatch, parseCatalogSearchResult, parseNowPlayingResult } from "./nowPlaying";
import { parseMusicInfoText, type MusicInfoFields } from "./ocr";
import QuickCapturePage from "./QuickCapturePage";
import QuickMemoryCardPanel from "./QuickMemoryCardPanel";
import RatingSlider from "./RatingSlider";
import RelistenPage from "./RelistenPage";
import { DAILY_RESURFACING_KEY, dismissDailyResurfacing, parseDailyResurfacingState, resolveDailyResurfacing, type DailyResurfacingState } from "./resurfacing";
import { parseList, store } from "./store";
import { clearStorageCorruption, readStorageCorruption, type StorageCorruption } from "./storageSafety";
import { ENTRY_TYPE_LABELS, ENTRY_TYPES, type AlbumAggregate, type EntryInput, type ListeningMoment, type ListeningMomentInput, type MusicMetadata, type RatingModifier, type ReviewEntry, type SongAggregate, type YearStats } from "./types";

const APP_VERSION = "2.5";

const nav = [
  ["/", "首页"],
  ["/albums", "专辑"],
  ["/new", "新建"],
  ["/search", "搜索"],
  ["/summary", "总结"],
];

type BackupPreview = { exportedAt: string; entryCount: number; summaryCount: number; monthlySummaryCount: number; coverCount: number; listeningMomentCount: number };
type ExportKind = "json" | "txt" | "csv";
type ExportedData = { kind: ExportKind; content: string; fileName: string; mimeType: string };
type HomeEntry = ReviewEntry & { coverDataUrl: string | null };
type ScreenshotOcrLine = { text: string; left: number; top: number; right: number; bottom: number };
type ScreenshotOcrResult = { text: string; width: number; height: number; lines: ScreenshotOcrLine[] };
type ScreenshotOcrPlugin = { recognize(options: { dataUrl: string }): Promise<ScreenshotOcrResult> };
type FilterDraft = { year: string; month: string; artistName: string; albumName: string; mood: string; tag: string; minRating: string; maxRating: string; groupBy: UniverseGroupBy };
type GenreSelection = { level1: string; level2: string; level3: string };

const EMPTY_VISUALIZATION_OPTIONS: VisualizationOptions = { years: [], months: [], artistNames: [], albumNames: [], moods: [], tags: [] };
const EXPORT_LABELS: Record<ExportKind, string> = { json: "JSON", txt: "TXT", csv: "CSV" };
const EXPORT_FILE_META: Record<ExportKind, { extension: string; mimeType: string }> = {
  json: { extension: "json", mimeType: "application/json;charset=utf-8" },
  txt: { extension: "txt", mimeType: "text/plain;charset=utf-8" },
  csv: { extension: "csv", mimeType: "text/csv;charset=utf-8" },
};
const GROUP_BY_LABELS: Record<UniverseGroupBy, string> = {
  year: "按年份分组",
  artist: "按艺术家分组",
  album: "按专辑分组",
  mood: "按情绪分组",
  tag: "按曲风分组",
};
const MOOD_GROUPS = MOOD_CATEGORIES;

const ScreenshotOcr = registerPlugin<ScreenshotOcrPlugin>("ScreenshotOcr");

export default function App() {
  const [createSheetOpen, setCreateSheetOpen] = useState(false);
  const createButtonRef = useRef<HTMLButtonElement | null>(null);
  const lastShareIdRef = useRef("");
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    setCreateSheetOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    let active = true;
    let listener: { remove(): Promise<void> } | null = null;
    const accept = (value: unknown) => {
      if (!active) return;
      const payload = parseSharedMusicPayload(value);
      if (!payload || payload.id === lastShareIdRef.current) return;
      lastShareIdRef.current = payload.id;
      rememberSharedMusic(payload);
      setCreateSheetOpen(false);
      navigate(`/capture?share=${encodeURIComponent(payload.id)}`);
    };
    void SharedMusic.addListener("shareReceived", accept).then((handle) => {
      if (!active) void handle.remove();
      else listener = handle;
    }).catch(() => undefined);
    void SharedMusic.consumePendingShare().then(accept).catch(() => undefined);
    return () => {
      active = false;
      if (listener) void listener.remove();
    };
  }, [navigate]);

  return (
    <div className="app-shell">
      <header className="app-header">
        <Link to="/" className="brand">小懂哥 v{APP_VERSION}</Link>
        <Link to="/more" className="header-menu" aria-label="更多"><span /></Link>
      </header>
      <main className="app-main">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/timeline" element={<TimelinePage />} />
          <Route path="/capture" element={<QuickCapturePage />} />
          <Route path="/new" element={<EntryFormPage mode="create" />} />
          <Route path="/entries/:id" element={<EntryDetailPage />} />
          <Route path="/entries/:id/edit" element={<EntryFormPage mode="edit" />} />
          <Route path="/relisten/:entryId" element={<RelistenPage />} />
          <Route path="/albums" element={<AlbumsPage />} />
          <Route path="/albums/detail" element={<AggregateDetail kind="album" />} />
          <Route path="/songs" element={<SongsPage />} />
          <Route path="/songs/detail" element={<AggregateDetail kind="song" />} />
          <Route path="/search" element={<SearchPage />} />
          <Route path="/summary" element={<SimpleYearbookPage />} />
          <Route path="/summary/analysis" element={<YearlyListeningPage />} />
          <Route path="/summary/:year/:month" element={<MonthlyListeningPage />} />
          <Route path="/abstract-map" element={<AbstractMusicMapPage />} />
          <Route path="/insights" element={<InsightsPage />} />
          <Route path="/backup" element={<BackupPage />} />
          <Route path="/drafts" element={<DraftsPage />} />
          <Route path="/privacy" element={<PrivacyPage />} />
          <Route path="/more" element={<MorePage />} />
        </Routes>
      </main>
      <nav className="bottom-nav">
        {nav.slice(0, 2).map(([to, label]) => (
          <NavLink key={to} to={to} className={({ isActive }) => (isActive ? "active" : "")} end={to === "/"}>
            {label}
          </NavLink>
        ))}
        {/* 统一的新建和续写入口 */}
        <button ref={createButtonRef} type="button" aria-label="新建记录" onClick={() => setCreateSheetOpen(true)}>新建</button>
        {nav.slice(3).map(([to, label]) => (
          <NavLink key={to} to={to} className={({ isActive }) => (isActive ? "active" : "")} end={to === "/"}>
            {label}
          </NavLink>
        ))}
      </nav>
      {createSheetOpen ? (
        <BottomSheet title="新建" text="选择记录方式" onClose={() => setCreateSheetOpen(false)} returnFocusRef={createButtonRef}>
          <div className="create-choice">
            <Link to="/capture" className="create-choice-card" onClick={() => setCreateSheetOpen(false)}>
              <strong>速记</strong>
              <span>60 秒听感，先留一句真实感受，之后随时展开成完整乐评</span>
            </Link>
            <Link to="/new" className="create-choice-card" onClick={() => setCreateSheetOpen(false)}>
              <strong>完整</strong>
              <span>完整乐评：专辑、曲风、情绪、多维度评分</span>
            </Link>
            <Link to="/drafts" className="create-choice-card" onClick={() => setCreateSheetOpen(false)}>
              <strong>草稿</strong>
              <span>读取未完成的记录，接着写上次的感受</span>
            </Link>
          </div>
        </BottomSheet>
      ) : null}
    </div>
  );
}

function HomePage() {
  const [draftCount, setDraftCount] = useState(() => listEntryDrafts(localStorage).length);
  const [entries, setEntries] = useState<HomeEntry[]>([]);
  const [stats, setStats] = useState<YearStats | null>(null);
  const [resurfacingEntry, setResurfacingEntry] = useState<HomeEntry | null>(null);
  const [resurfacingState, setResurfacingState] = useState<DailyResurfacingState | null>(null);
  const [nowPlayingMatch, setNowPlayingMatch] = useState(false);
  const currentYear = new Date().getFullYear();

  useEffect(() => {
    const refresh = () => setDraftCount(listEntryDrafts(localStorage).length);
    window.addEventListener("storage", refresh);
    window.addEventListener("focus", refresh);
    return () => { window.removeEventListener("storage", refresh); window.removeEventListener("focus", refresh); };
  }, []);

  useEffect(() => {
    let active = true;
    void Promise.all([
      store.recentEntries(5),
      store.getYearStats(currentYear),
      store.listEntries(),
      store.listListeningMoments(),
      store.getStoredAppData(DAILY_RESURFACING_KEY),
    ]).then(async ([recent, yearStats, allEntries, moments, savedState]) => {
      const recentWithCovers = await Promise.all(recent.map(loadHomeCover));
      const today = localDateKey();
      const resolved = resolveDailyResurfacing(allEntries, moments, today, parseDailyResurfacingState(savedState));
      const nextState = JSON.stringify(resolved.state);
      if (savedState !== nextState) await store.setStoredAppData(DAILY_RESURFACING_KEY, nextState);
      const nextResurfacing = resolved.entry ? await loadHomeCover(resolved.entry) : null;
      let currentMatches = false;
      if (nextResurfacing && Capacitor.isNativePlatform()) {
        try {
          const current = parseNowPlayingResult(await NowPlaying.getCurrentTrack());
          currentMatches = !!current.fields && sameMusicIdentity(nextResurfacing, {
            songName: current.fields.songName,
            artistName: current.fields.artistName,
            albumName: current.fields.albumName,
            musicMetadata: current.musicMetadata,
          });
        } catch {
          currentMatches = false;
        }
      }
      if (!active) return;
      setEntries(recentWithCovers);
      setStats(yearStats);
      setResurfacingEntry(nextResurfacing);
      setResurfacingState(resolved.state);
      setNowPlayingMatch(currentMatches);
    }).catch(() => {
      if (!active) return;
      setResurfacingEntry(null);
      setResurfacingState(null);
      setNowPlayingMatch(false);
    });
    return () => {
      active = false;
    };
  }, [currentYear]);

  async function dismissResurfacing() {
    if (!resurfacingState) return;
    const nextState = dismissDailyResurfacing(resurfacingState);
    await store.setStoredAppData(DAILY_RESURFACING_KEY, JSON.stringify(nextState));
    setResurfacingState(nextState);
    setResurfacingEntry(null);
    setNowPlayingMatch(false);
  }

  return (
    <section className="home-page">
      <section className="home-hero">
        <div className="home-hero-copy">
          <h1>私人音乐档案</h1>
          <p>记录每一次听歌的心情与感受</p>
          <Link to="/drafts" className="home-draft-link"><strong>草稿箱 · {draftCount} 条待完成</strong><span>{draftCount ? "接着写上次的感受" : "未完成的感受，随时回来续写"} <span aria-hidden="true">→</span></span></Link>
        </div>
        <div className="hero-record" aria-hidden="true"><span>FOR ME<br />NOT FOR ALL</span></div>
      </section>
      <div className="home-stats">
        <Stat label="今年记录" value={`${stats?.createdThisYear ?? 0} 条`} />
        <Stat label="今年专辑" value={`${stats?.albumCount ?? 0} 张`} />
        <Stat label="今年歌曲" value={`${stats?.songCount ?? 0} 首`} />
      </div>
      {resurfacingEntry ? (
        <section className="daily-resurfacing-card">
          <div className="daily-resurfacing-cover">
            <CoverArt src={resurfacingEntry.coverDataUrl} label={resurfacingEntry.albumName ?? resurfacingEntry.songName ?? resurfacingEntry.title} large />
            <span aria-hidden="true" />
          </div>
          <div className="daily-resurfacing-copy">
            <span className="page-eyebrow">今日重逢</span>
            <h2>{resurfacingEntry.songName ?? resurfacingEntry.title}</h2>
            <p>{[resurfacingEntry.artistName, resurfacingEntry.albumName].filter(Boolean).join(" · ")}</p>
            <blockquote>{excerpt(resurfacingEntry.content, 86)}</blockquote>
            {nowPlayingMatch ? <strong className="now-playing-match">此刻正在播放这首歌</strong> : null}
            <div className="action-row">
              <Link className="primary-button" to={`/relisten/${resurfacingEntry.id}`}>先听，再揭晓</Link>
              <button className="secondary-button" type="button" onClick={() => void dismissResurfacing()}>今天略过</button>
            </div>
          </div>
        </section>
      ) : null}
      <div className="home-section-title">
        <h2>可视化记忆</h2>
      </div>
      <div className="home-visual-links">
        <Link to="/abstract-map" className="visual-entry-card map">
          <span>抽象地图</span>
          <h2>我的听歌地图</h2>
          <p>把情绪、标签和乐评放进几片听歌大陆。</p>
        </Link>
        <Link to="/insights" className="visual-entry-card insights">
          <span>情绪洞察</span>
          <h2>天气与季节里的你</h2>
          <p>下雨天最爱听的情绪、冬天比夏天高几分。</p>
        </Link>
      </div>
      <div className="home-section-title">
        <h2>最近记录</h2>
        <Link to="/timeline">查看全部</Link>
      </div>
      <HomeEntryList entries={entries} />
    </section>
  );
}

async function loadHomeCover(entry: ReviewEntry): Promise<HomeEntry> {
  return { ...entry, coverDataUrl: await loadEntryCover(entry) };
}

async function loadEntryCover(entry: ReviewEntry) {
  let coverDataUrl: string | null = null;
  if (entry.songName) coverDataUrl = await store.getCover("song", { songName: entry.songName, albumName: entry.albumName, artistName: entry.artistName });
  if (!coverDataUrl && entry.albumName) coverDataUrl = await store.getCover("album", { albumName: entry.albumName, artistName: entry.artistName });
  return coverDataUrl;
}

function HomeEntryList({ entries }: { entries: HomeEntry[] }) {
  if (!entries.length) return <Empty text="还没有记录。" />;
  return (
    <div className="home-entry-list">
      {entries.map((entry) => {
        const musicLine = [entry.songName, entry.albumName, entry.artistName].filter(Boolean).join(" / ") || "未关联音乐信息";
        return (
          <Link key={entry.id} to={`/entries/${entry.id}`} className="home-entry-row">
            <CoverArt src={entry.coverDataUrl} label={entry.albumName ?? entry.songName ?? entry.title} />
            <div className="home-entry-copy">
              <div className="home-entry-heading">
                <h2>{entry.title}</h2>
                <time>{shortDate(entry.listenedAt ?? entry.createdAt)}</time>
              </div>
              <p>{musicLine}</p>
              <div className="home-entry-meta">
                <span>{ENTRY_TYPE_LABELS[entry.type]}</span>
                {entry.rating ? <strong>{ratingStars(entry.rating)} <em>{(entry.rating / 2).toFixed(1)}</em></strong> : null}
              </div>
              <p>{excerpt(entry.content)}</p>
            </div>
            <span className="home-entry-menu" aria-hidden="true" />
          </Link>
        );
      })}
    </div>
  );
}

function ratingStars(rating: number) {
  const filled = Math.max(0, Math.min(5, Math.round(rating / 2)));
  return "★★★★★".slice(0, filled) + "☆☆☆☆☆".slice(filled);
}

function shortDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return `${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function TimelinePage() {
  const [entries, setEntries] = useState<ReviewEntry[]>([]);
  useEffect(() => void store.listEntries().then(setEntries), []);
  const groups = useMemo(() => {
    const yearMap = new Map<number, Map<number | null, ReviewEntry[]>>();
    for (const entry of entries) {
      if (!yearMap.has(entry.year)) yearMap.set(entry.year, new Map());
      const monthMap = yearMap.get(entry.year) as Map<number | null, ReviewEntry[]>;
      monthMap.set(entry.month, [...(monthMap.get(entry.month) ?? []), entry]);
    }
    return Array.from(yearMap.entries());
  }, [entries]);

  return (
    <Page title="时间轴" text="按年份和月份回看所有记录。">
      {!groups.length ? <Empty text="暂无记录。" /> : null}
      {groups.map(([year, monthMap]) => (
        <section key={year} className="year-block">
          <h2>{year}</h2>
          {Array.from(monthMap.entries()).map(([month, items]) => (
            <div key={`${year}-${month ?? "year"}`}>
              <h3>{monthLabel(month)}</h3>
              <EntryList entries={items} />
            </div>
          ))}
        </section>
      ))}
    </Page>
  );
}

function EntryFormPage({ mode }: { mode: "create" | "edit" }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const draftIdRef = useRef<string | null>(null);
  const draftLimitErrorRef = useRef(false);
  const inspirationRef = useRef(false);
  if (mode === "create" && draftIdRef.current === null) {
    const fromUrl = searchParams.get("draft");
    if (fromUrl && fromUrl.trim()) {
      draftIdRef.current = fromUrl.trim();
    } else {
      // 直接进入 /new（无 draft 参数）：仅当未达上限时生成新 draftId
      if (countNewDrafts(localStorage) < MAX_NEW_DRAFTS) {
        draftIdRef.current = createNewDraftId();
      } else {
        draftLimitErrorRef.current = true;
      }
    }
    // 灵感速记模式：仅 create 模式下从 URL 参数读取
    inspirationRef.current = searchParams.get("inspiration") === "1";
  }
  const draftId = mode === "create" ? draftIdRef.current : null;
  useEffect(() => {
    if (mode !== "create" || !draftId || searchParams.get("draft") === draftId) return;
    const next = new URLSearchParams(searchParams);
    next.set("draft", draftId);
    setSearchParams(next, { replace: true });
  }, [draftId, mode, searchParams, setSearchParams]);
  const formRef = useRef<HTMLFormElement | null>(null);
  const draftTimerRef = useRef<number | null>(null);
  const pendingDraftRef = useRef<EntryDraft | null>(null);
  const draftReadyRef = useRef(false);
  const skipDraftStateSaveRef = useRef(false);
  // 多维度评分：用户手动拖主滑块后锁定综合分，后续维度变化不再自动覆盖；
  // 仅“自动重算”置为 false，“维度变化”保留原锁，手动改维度时解锁。
  const compositeLockedRef = useRef(false);
  const [entry, setEntry] = useState<ReviewEntry | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(mode === "edit");
  const [saving, setSaving] = useState(false);
  const [entryCoverLoaded, setEntryCoverLoaded] = useState(mode === "create");
  const [coverDataUrl, setCoverDataUrl] = useState<string | null>(null);
  const [coverChanged, setCoverChanged] = useState(false);
  const [ocrText, setOcrText] = useState("");
  const [recognizedFields, setRecognizedFields] = useState<MusicInfoFields | null>(null);
  const [musicMetadata, setMusicMetadata] = useState<MusicMetadata | null>(null);
  const [ocrBusy, setOcrBusy] = useState(false);
  const [nowPlayingBusy, setNowPlayingBusy] = useState(false);
  const [nowPlayingAccessEnabled, setNowPlayingAccessEnabled] = useState<boolean | null>(null);
  const [nowPlayingMessage, setNowPlayingMessage] = useState("");
  const [selectedMoodGroupId, setSelectedMoodGroupId] = useState<string>(() => defaultMoodGroupId([]));
  const [selectedMoods, setSelectedMoods] = useState<string[]>([]);
  const [rating, setRating] = useState<number | null>(null);
  const [ratingModifier, setRatingModifier] = useState<RatingModifier | null>(null);
  const [multiDimension, setMultiDimension] = useState(false);
  const [ratingProduction, setRatingProduction] = useState<number | null>(null);
  const [ratingSongwriting, setRatingSongwriting] = useState<number | null>(null);
  const [ratingOriginality, setRatingOriginality] = useState<number | null>(null);
  const [ratingResonance, setRatingResonance] = useState<number | null>(null);
  const [genreSelection, setGenreSelection] = useState<GenreSelection>(() => defaultGenreSelection(null));
  const [selectedGenreTags, setSelectedGenreTags] = useState<string[]>([]);
  const [draftReady, setDraftReady] = useState(false);
  const [hasDraft, setHasDraft] = useState(false);
  const [draftStatus, setDraftStatus] = useState("输入内容会自动保存");
  const [draftError, setDraftError] = useState(false);

  useEffect(() => {
    if (mode !== "edit") {
      setLoading(false);
      return;
    }
    if (!id) {
      setError("记录不存在");
      setLoading(false);
      return;
    }
    let active = true;
    setLoading(true);
    void store.getEntry(id).then((nextEntry) => {
      if (!active) return;
      setEntry(nextEntry);
      if (!nextEntry) setError("记录不存在");
    }).catch((err) => {
      if (active) setError(err instanceof Error ? err.message : "记录读取失败");
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [id, mode]);

  useEffect(() => {
    if (!entry) return;
    let active = true;
    setEntryCoverLoaded(false);
    setRating(entry.rating);
    setRatingModifier(entry.ratingModifier);
    setRatingProduction(entry.ratingProduction);
    setRatingSongwriting(entry.ratingSongwriting);
    setRatingOriginality(entry.ratingOriginality);
    setRatingResonance(entry.ratingResonance);
    compositeLockedRef.current = entry.compositeRatingLocked;
    setMultiDimension(entry.compositeRatingLocked || entry.ratingProduction !== null || entry.ratingSongwriting !== null || entry.ratingOriginality !== null || entry.ratingResonance !== null);
    void loadEntryCover(entry).then((nextCover) => {
      if (!active) return;
      setCoverDataUrl(nextCover);
      setCoverChanged(false);
    }).catch((err) => {
      if (active) setError(err instanceof Error ? err.message : "封面读取失败");
    }).finally(() => {
      if (active) setEntryCoverLoaded(true);
    });
    return () => {
      active = false;
    };
  }, [entry]);

  useEffect(() => {
    const moods = mode === "edit" ? entry?.moods ?? [] : [];
    setSelectedMoods(moods);
    setSelectedMoodGroupId(defaultMoodGroupId(moods));
  }, [entry, mode]);

  useEffect(() => {
    const genreTags = (mode === "edit" ? entry?.tags ?? [] : []).filter(isKnownGenreTag);
    setSelectedGenreTags(genreTags);
    setGenreSelection(defaultGenreSelection(genreTags[0] ?? null));
  }, [entry, mode]);

  useEffect(() => {
    setMusicMetadata(mode === "edit" ? entry?.musicMetadata ?? null : null);
  }, [entry, mode]);

  useEffect(() => {
    if ((mode === "edit" && (!id || !entry || !entryCoverLoaded)) || !formRef.current) return;
    draftReadyRef.current = false;
    setDraftReady(false);
    skipDraftStateSaveRef.current = true;
    try {
      const result = readEntryDraft(localStorage, mode, mode === "edit" ? id as string : null, draftId);
      if (result.status === "missing") {
        setHasDraft(false);
        setDraftStatus("输入内容会自动保存");
        setDraftError(false);
      } else if (result.status === "invalid") {
        setHasDraft(true);
        setDraftStatus("草稿格式损坏，未覆盖当前表单");
        setDraftError(true);
      } else if (mode === "edit" && !canRestoreEditDraft(result.draft, id as string, entry?.updatedAt as string)) {
        setHasDraft(true);
        setDraftStatus("正式记录比草稿更新，未自动恢复旧草稿");
        setDraftError(false);
      } else {
        applyDraftFields(formRef.current, result.draft.fields);
        setSelectedMoodGroupId(result.draft.selectedMoodGroupId);
        setSelectedMoods(result.draft.selectedMoods);
        setGenreSelection(result.draft.genreSelection);
        setSelectedGenreTags(result.draft.selectedGenreTags);
        setCoverChanged(result.draft.coverChanged);
        if (result.draft.coverChanged) setCoverDataUrl(result.draft.coverDataUrl);
        setOcrText(result.draft.ocrText);
        setRecognizedFields(result.draft.recognizedFields);
        setMusicMetadata(result.draft.musicMetadata);
        // 续写时保留草稿的灵感标记
        if (mode === "create") inspirationRef.current = result.draft.inspiration;
        // 恢复评分和修饰符到 React state
        const draftRating = result.draft.fields.rating ? Number(result.draft.fields.rating) : null;
        setRating(draftRating !== null && draftRating >= 0.5 && draftRating <= 10 ? draftRating : null);
        setRatingModifier(result.draft.fields.ratingModifier === "+" || result.draft.fields.ratingModifier === "-" ? result.draft.fields.ratingModifier : null);
        const dimProd = result.draft.fields.ratingProduction ? Number(result.draft.fields.ratingProduction) : null;
        const dimSong = result.draft.fields.ratingSongwriting ? Number(result.draft.fields.ratingSongwriting) : null;
        const dimOrig = result.draft.fields.ratingOriginality ? Number(result.draft.fields.ratingOriginality) : null;
        const dimReso = result.draft.fields.ratingResonance ? Number(result.draft.fields.ratingResonance) : null;
        const dimActive = dimProd !== null || dimSong !== null || dimOrig !== null || dimReso !== null;
        compositeLockedRef.current = result.draft.compositeRatingLocked;
        setRatingProduction(dimProd !== null && dimProd >= 0.5 && dimProd <= 10 ? dimProd : null);
        setRatingSongwriting(dimSong !== null && dimSong >= 0.5 && dimSong <= 10 ? dimSong : null);
        setRatingOriginality(dimOrig !== null && dimOrig >= 0.5 && dimOrig <= 10 ? dimOrig : null);
        setRatingResonance(dimReso !== null && dimReso >= 0.5 && dimReso <= 10 ? dimReso : null);
        setMultiDimension(result.draft.compositeRatingLocked || dimActive);
        setHasDraft(true);
        setDraftStatus("已恢复上次草稿");
        setDraftError(false);
      }
    } catch (err) {
      setDraftStatus(err instanceof Error ? `草稿读取失败：${err.message}` : "草稿读取失败");
      setDraftError(true);
    } finally {
      draftReadyRef.current = true;
      setDraftReady(true);
    }
  }, [entry, entryCoverLoaded, id, mode, draftId]);

  // ponytail: 多维度开启且4维都有值时，综合分=4维平均（0.5步进）。用户可手动拖主滑块覆盖并锁定；之后维度变化不再覆盖，改任一维度则重新解锁计算。
  useEffect(() => {
    if (!multiDimension) return;
    const dims = [ratingProduction, ratingSongwriting, ratingOriginality, ratingResonance];
    if (dims.some((d) => d === null)) return;
    if (compositeLockedRef.current) return;
    const avg = (dims as number[]).reduce((sum, d) => sum + d, 0) / dims.length;
    setRating(Math.round(avg / 0.5) * 0.5);
  }, [multiDimension, ratingProduction, ratingSongwriting, ratingOriginality, ratingResonance]);

  useEffect(() => {
    if (!draftReady) return;
    if (skipDraftStateSaveRef.current) {
      skipDraftStateSaveRef.current = false;
      return;
    }
    scheduleDraftSave();
  }, [coverChanged, coverDataUrl, draftReady, genreSelection, musicMetadata, ocrText, recognizedFields, selectedGenreTags, selectedMoodGroupId, selectedMoods, rating, ratingModifier, multiDimension, ratingProduction, ratingSongwriting, ratingOriginality, ratingResonance]);

  useEffect(() => {
    if (!draftReady) return;
    const flushDraft = () => persistPendingDraft();
    const flushHiddenDraft = () => {
      if (document.visibilityState === "hidden") flushDraft();
    };
    window.addEventListener("pagehide", flushDraft);
    document.addEventListener("visibilitychange", flushHiddenDraft);
    return () => {
      window.removeEventListener("pagehide", flushDraft);
      document.removeEventListener("visibilitychange", flushHiddenDraft);
      persistPendingDraft(false);
    };
  }, [draftReady, id, mode, draftId]);

  useEffect(() => {
    if (draftReady && Capacitor.isNativePlatform()) void readNowPlaying();
  }, [draftReady, mode]);

  function createDraftSnapshot(): EntryDraft | null {
    if (!draftReadyRef.current || !formRef.current) return null;
    const entryId = mode === "edit" ? id ?? null : null;
    if (mode === "edit" && (!entryId || !entry)) return null;
    return {
      version: 2,
      mode,
      captureMode: "full",
      entryId,
      draftId,
      baseUpdatedAt: mode === "edit" ? entry?.updatedAt ?? null : null,
      savedAt: new Date().toISOString(),
      fields: readDraftFields(formRef.current),
      genreSelection,
      selectedGenreTags: [...selectedGenreTags],
      selectedMoodGroupId,
      selectedMoods: [...selectedMoods],
      coverDataUrl: coverChanged ? coverDataUrl : null,
      coverChanged,
      ocrText,
      recognizedFields,
      musicMetadata,
      compositeRatingLocked: multiDimension && compositeLockedRef.current,
      inspiration: mode === "create" && inspirationRef.current,
    };
  }

  function scheduleDraftSave() {
    const draft = createDraftSnapshot();
    if (!draft) return;
    pendingDraftRef.current = draft;
    setDraftStatus("正在保存草稿");
    setDraftError(false);
    if (draftTimerRef.current !== null) window.clearTimeout(draftTimerRef.current);
    draftTimerRef.current = window.setTimeout(() => persistPendingDraft(), 300);
  }

  function persistPendingDraft(showStatus = true) {
    const draft = pendingDraftRef.current;
    if (!draft) return true;
    if (draftTimerRef.current !== null) {
      window.clearTimeout(draftTimerRef.current);
      draftTimerRef.current = null;
    }
    try {
      writeEntryDraft(localStorage, draft);
      pendingDraftRef.current = null;
      if (showStatus) {
        setHasDraft(true);
        setDraftStatus(`草稿已自动保存 ${formatDraftTime(draft.savedAt)}`);
        setDraftError(false);
      }
      return true;
    } catch (err) {
      const isQuotaError = err instanceof DOMException && (err.name === "QuotaExceededError" || err.name === "NS_ERROR_DOM_QUOTA_REACHED");
      if (showStatus) {
        setDraftStatus(isQuotaError
          ? "本地存储已满，草稿未保存。请在设置页导出备份后清理旧记录"
          : err instanceof Error ? `草稿保存失败：${err.message}` : "草稿保存失败");
        setDraftError(true);
      }
      return false;
    }
  }

  function saveDraftAndExit() {
    const draft = createDraftSnapshot();
    if (!draft || saving) return;
    pendingDraftRef.current = draft;
    if (persistPendingDraft()) navigate("/drafts");
  }

  async function discardDraft() {
    if (!confirm("放弃这份未保存草稿？此操作无法撤销。")) return;
    let originalCover: string | null = null;
    if (entry) {
      try {
        originalCover = await loadEntryCover(entry);
      } catch (err) {
        setError(err instanceof Error ? err.message : "封面读取失败");
      }
    }
    try {
      removeEntryDraft(localStorage, mode, mode === "edit" ? id ?? null : null, draftId);
    } catch (err) {
      setDraftStatus(err instanceof Error ? `草稿清除失败：${err.message}` : "草稿清除失败");
      setDraftError(true);
      return;
    }
    if (draftTimerRef.current !== null) window.clearTimeout(draftTimerRef.current);
    draftTimerRef.current = null;
    pendingDraftRef.current = null;
    skipDraftStateSaveRef.current = true;
    formRef.current?.reset();
    const moods = entry?.moods ?? [];
    const genreTags = (entry?.tags ?? []).filter(isKnownGenreTag);
    setSelectedMoods(moods);
    setSelectedMoodGroupId(defaultMoodGroupId(moods));
    setSelectedGenreTags(genreTags);
    setGenreSelection(defaultGenreSelection(genreTags[0] ?? null));
    setCoverDataUrl(originalCover);
    setCoverChanged(false);
    setOcrText("");
    setRecognizedFields(null);
    setMusicMetadata(entry?.musicMetadata ?? null);
    setRating(entry?.rating ?? null);
    setRatingModifier(entry?.ratingModifier ?? null);
    setHasDraft(false);
    setDraftStatus("草稿已清除");
    setDraftError(false);
  }

  async function readNowPlaying() {
    setNowPlayingBusy(true);
    setError("");
    try {
      const result = parseNowPlayingResult(await NowPlaying.getCurrentTrack());
      setNowPlayingAccessEnabled(result.accessEnabled);
      if (!result.accessEnabled) {
        setNowPlayingMessage("请先授予通知使用权；本应用只读取系统媒体会话中的歌曲信息。");
        return;
      }
      if (!result.fields) {
        setNowPlayingMessage("没有读到正在播放的歌曲，请确认网易云音乐正在播放后重试。");
        return;
      }
      if (!musicIdentityCompatible(formRef.current, result.fields)) {
        setNowPlayingMessage(`${recognitionNotice(result.fields)}；表单已有其他歌曲信息，未覆盖也未关联元数据`);
        return;
      }

      const retainedMetadata = mergeMusicMetadata(result.musicMetadata, musicMetadata);
      const firstResult = prefersAlbumEntry(formRef.current, mode)
        ? toAlbumFirstRecognition(result.fields, retainedMetadata)
        : { fields: result.fields, musicMetadata: retainedMetadata };
      const changed = fillRecognizedFields(formRef.current, firstResult.fields, true);
      setMusicMetadata(firstResult.musicMetadata);
      if (changed) scheduleDraftSave();
      const songName = result.fields.songName?.trim();
      const artistName = result.fields.artistName?.trim();
      if (!songName || !artistName) {
        setNowPlayingMessage(`${recognitionNotice(result.fields)}，已保留原生信息；缺少歌曲名或歌手，未联网补全`);
        return;
      }

      setNowPlayingMessage(`${recognitionNotice(result.fields)}，正在联网补全…`);
      try {
        const options = { title: songName, artistName, ...(result.fields.albumName ? { albumName: result.fields.albumName } : {}) };
        const china = parseCatalogSearchResult(await NowPlaying.searchCatalog({ ...options, country: "CN" }));
        let match = findAppleCatalogMatch(result.fields, china);
        if (!match) {
          const unitedStates = parseCatalogSearchResult(await NowPlaying.searchCatalog({ ...options, country: "US" }));
          match = findAppleCatalogMatch(result.fields, unitedStates);
        }
        if (!match) {
          setNowPlayingMessage(`${recognitionNotice(result.fields)}，已保留原生信息；未找到可确认的目录信息`);
          return;
        }
        const enriched = applyAppleCatalogMatch(result.fields, retainedMetadata, match);
        const finalResult = prefersAlbumEntry(formRef.current, mode)
          ? toAlbumFirstRecognition(enriched.fields, enriched.musicMetadata)
          : enriched;
        const catalogChanged = fillRecognizedFields(formRef.current, finalResult.fields, true);
        setMusicMetadata(finalResult.musicMetadata);
        if (catalogChanged) scheduleDraftSave();
        setNowPlayingMessage(`${recognitionNotice(finalResult.fields)}，联网补全完成`);
      } catch (catalogError) {
        setNowPlayingMessage(`${recognitionNotice(result.fields)}，已保留原生信息；${catalogError instanceof Error ? catalogError.message : "联网补全失败"}，可重试`);
      }
    } catch (err) {
      setNowPlayingMessage("");
      setError(err instanceof Error ? err.message : "当前播放读取失败");
    } finally {
      setNowPlayingBusy(false);
    }
  }

  async function openNotificationSettings() {
    setError("");
    try {
      await NowPlaying.openNotificationSettings();
      setNowPlayingAccessEnabled(null);
      setNowPlayingMessage("授权后返回小懂哥，点击“读取当前播放”。");
    } catch (err) {
      setError(err instanceof Error ? err.message : "通知使用权设置打开失败");
    }
  }

  async function chooseCover(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    if (!file) return;
    setError("");
    setNotice("");
    try {
      const dataUrl = await fileToCoverDataUrl(file);
      setCoverDataUrl(dataUrl);
      setCoverChanged(true);
      setNotice("封面已选择，保存记录后生效");
    } catch (err) {
      setError(err instanceof Error ? err.message : "封面读取失败");
    } finally {
      event.currentTarget.value = "";
    }
  }

  async function recognizeScreenshot(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    if (!file) return;
    setError("");
    setNotice("");
    setOcrText("");
    setOcrBusy(true);
    try {
      if (!Capacitor.isNativePlatform()) throw new Error("截图识别请在 Android APK 中使用");
      const dataUrl = await fileToDataUrl(file);
      const result = await ScreenshotOcr.recognize({ dataUrl });
      const text = result.text.trim();
      if (!text) throw new Error("没有识别到文字");
      const fields = parseMusicInfoText(result);
      setOcrText(text);
      setRecognizedFields(fields);
      setNotice(`${recognitionNotice(fields)}，请检查后应用到表单`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "截图识别失败");
    } finally {
      setOcrBusy(false);
      event.currentTarget.value = "";
    }
  }

  function updateRecognizedField(key: keyof MusicInfoFields, value: string | null) {
    setRecognizedFields((current) => current ? { ...current, [key]: value } : current);
  }

  function applyRecognizedFields() {
    if (!recognizedFields) return;
    const result = prefersAlbumEntry(formRef.current, mode)
      ? toAlbumFirstRecognition(recognizedFields, musicMetadata)
      : { fields: recognizedFields, musicMetadata };
    const clearMetadata = musicIdentityWouldChange(formRef.current, result.fields);
    const changed = fillRecognizedFields(formRef.current, result.fields);
    if (changed) {
      setMusicMetadata(clearMetadata && !result.musicMetadata?.displayTitle ? null : result.musicMetadata);
      scheduleDraftSave();
    }
    setRecognizedFields(result.fields);
    setNotice(changed ? `${recognitionNotice(result.fields)}，已应用到表单` : "识别结果没有可应用的字段");
  }

  function handleFormMutation(event: FormEvent<HTMLFormElement>) {
    const target = event.target;
    if (musicMetadata && (target instanceof HTMLInputElement || target instanceof HTMLSelectElement)
      && ["songName", "artistName", "albumName"].includes(target.name)) {
      setMusicMetadata(null);
      setNowPlayingMessage("音乐身份字段已修改，旧的补全信息已清除；可重新读取当前播放");
    }
    scheduleDraftSave();
  }

  function toggleMood(mood: string) {
    setSelectedMoods((current) => current.includes(mood) ? current.filter((item) => item !== mood) : [...current, mood]);
  }

  function toggleGenre(tag: string) {
    setSelectedGenreTags((current) => current.includes(tag) ? current.filter((item) => item !== tag) : [...current, tag]);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    scheduleDraftSave();
    persistPendingDraft();
    setError("");
    setNotice("");
    setSaving(true);
    try {
      const form = new FormData(event.currentTarget);
      const input: EntryInput = {
        type: String(form.get("type")) as EntryInput["type"],
        title: readText(form, "title"),
        year: Number(form.get("year")),
        month: readNumber(form, "month"),
        albumName: readNullable(form, "albumName"),
        songName: readNullable(form, "songName"),
        artistName: readNullable(form, "artistName"),
        musicMetadata,
        content: readText(form, "content"),
        tags: mergeTagLists(parseList(readText(form, "genreTags")), parseList(readText(form, "tags"))),
        moods: parseList(readText(form, "moods")),
        rating,
        ratingModifier,
        ratingProduction: multiDimension ? ratingProduction : null,
        ratingSongwriting: multiDimension ? ratingSongwriting : null,
        ratingOriginality: multiDimension ? ratingOriginality : null,
        ratingResonance: multiDimension ? ratingResonance : null,
        compositeRatingLocked: multiDimension && compositeLockedRef.current,
        firstListenedAt: readDate(form, "firstListenedAt"),
        listenedAt: readDate(form, "listenedAt"),
      };
      const coverTarget = coverChanged && coverDataUrl ? inputToCoverTarget(input) : null;
      if (coverChanged && coverDataUrl && !coverTarget) throw new Error("请先填写歌曲或专辑，再保存封面");
      const similar = findSimilarEntry(await store.listEntries(), input, mode === "edit" ? id : undefined);
      if (similar && !confirm(`可能已经有相似记录：${similar.title}（${similar.year} / ${monthLabel(similar.month)}）。仍然保存吗？`)) {
        setNotice("已取消保存，现有记录未改变");
        return;
      }
      if (coverTarget) await store.setCover(coverTarget.kind, coverTarget.target, coverDataUrl as string);
      const saved = mode === "create" ? await store.createEntry(input) : await store.updateEntry(id as string, input);
      try {
        removeEntryDraft(localStorage, mode, mode === "edit" ? id ?? null : null, draftId);
      } catch (draftCleanupError) {
        alert(`记录已保存，但草稿清理失败：${draftCleanupError instanceof Error ? draftCleanupError.message : "未知错误"}`);
      }
      if (draftTimerRef.current !== null) window.clearTimeout(draftTimerRef.current);
      draftTimerRef.current = null;
      pendingDraftRef.current = null;
      setHasDraft(false);
      navigate(`/entries/${saved.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "保存失败");
    } finally {
      setSaving(false);
    }
  }

  const source = mode === "edit" ? entry : null;

  if (loading) return <Page title="编辑记录"><Empty text="正在加载记录。" /></Page>;
  if (mode === "edit" && !source) return <Page title="编辑记录"><Empty text={error || "记录不存在。"} /></Page>;
  if (mode === "create" && draftLimitErrorRef.current) return (
    <Page title="新建记录">
      <Empty text={`新建草稿已达上限（${MAX_NEW_DRAFTS} 份）。请先到草稿箱删除旧草稿，或从草稿箱选择一份继续。`} />
      <Link to="/drafts" className="primary-button full" style={{ marginTop: 12 }}>前往草稿箱</Link>
    </Page>
  );

  return (
    <Page
      title={mode === "create" ? (inspirationRef.current ? "灵感速记" : "新建记录") : "编辑记录"}
      text={mode === "create" && inspirationRef.current ? "只需填标题、歌手和一句话感受，随时可以回来补全。" : "未填写的信息会保持为空，不会自动补全。"}
    >
      <form ref={formRef} onSubmit={submit} onChange={handleFormMutation} className="form-card">
        {Capacitor.isNativePlatform() ? (
          <section className="assist-panel">
            <div className="assist-panel-head">
              <strong>当前播放</strong>
              {nowPlayingAccessEnabled === false ? (
                <button className="secondary-button" type="button" onClick={openNotificationSettings}>打开系统设置</button>
              ) : (
                <button className="secondary-button" type="button" onClick={readNowPlaying} disabled={nowPlayingBusy}>
                  {nowPlayingBusy ? "读取中" : "读取当前播放"}
                </button>
              )}
            </div>
            <p>{nowPlayingMessage || "打开新建记录时会自动读取并联网补全，只填充空白字段，不会自动保存。"}</p>
            <small>联网补全只会把当前歌曲名、歌手和专辑发送给 Apple 音乐目录。</small>
          </section>
        ) : null}
        <section className="assist-panel">
          <div className="assist-panel-head">
            <strong>截图识别</strong>
            <label className={`secondary-button file-button${ocrBusy ? " disabled" : ""}`}>
              {ocrBusy ? "识别中" : "上传信息截图"}
              <input type="file" accept="image/*" onChange={recognizeScreenshot} disabled={ocrBusy} />
            </label>
          </div>
          {ocrText ? (
            <details className="ocr-text">
              <summary>识别文本</summary>
              <pre>{ocrText}</pre>
            </details>
          ) : null}
          {recognizedFields ? (
            <section className="recognition-review">
              <div className="recognition-summary">
                <strong>识别结果</strong>
                <span>{recognitionNotice(recognizedFields)}</span>
              </div>
              <label>记录类型<select value={recognizedFields.type ?? ""} onChange={(event) => updateRecognizedField("type", event.target.value)}>
                <option value="">保持当前</option>
                {ENTRY_TYPES.map((type) => <option key={type} value={type}>{ENTRY_TYPE_LABELS[type]} / {type}</option>)}
              </select></label>
              <div className="form-grid">
                <label>标题<input value={recognizedFields.title ?? ""} onChange={(event) => updateRecognizedField("title", event.target.value)} /></label>
                <label>艺术家<input value={recognizedFields.artistName ?? ""} onChange={(event) => updateRecognizedField("artistName", event.target.value)} /></label>
              </div>
              <div className="form-grid">
                <label>专辑<input value={recognizedFields.albumName ?? ""} onChange={(event) => updateRecognizedField("albumName", event.target.value)} /></label>
                <label>歌曲<input value={recognizedFields.songName ?? ""} onChange={(event) => updateRecognizedField("songName", event.target.value)} /></label>
              </div>
              <label>正文草稿<textarea rows={6} value={recognizedFields.content ?? ""} onChange={(event) => updateRecognizedField("content", event.target.value)} /></label>
              <div className="recognition-actions">
                <button className="primary-button" type="button" onClick={applyRecognizedFields}>应用到表单</button>
                <label className="secondary-button file-button">
                  同时选择封面
                  <input type="file" accept="image/*" onChange={chooseCover} />
                </label>
              </div>
            </section>
          ) : null}
        </section>
        <label>记录类型<select name="type" defaultValue={source?.type ?? "album"}>{ENTRY_TYPES.map((type) => <option key={type} value={type}>{ENTRY_TYPE_LABELS[type]} / {type}</option>)}</select></label>
        <label>标题<input name="title" defaultValue={source?.title ?? ""} required /></label>
        <div className="form-grid">
          <label>归档年份<input name="year" type="number" min="1" max="9999" defaultValue={source?.year ?? new Date().getFullYear()} required /></label>
          <label>归档月份<input name="month" type="number" min="1" max="12" defaultValue={source?.month ?? ""} /></label>
        </div>
        <p className="hint">月报、年报按乐评首次正式保存的时间统计；归档年月和收听日期用于整理作品。</p>
        <label>专辑<input name="albumName" defaultValue={source?.albumName ?? ""} /></label>
        <label>歌曲<input name="songName" defaultValue={source?.songName ?? ""} /></label>
        <label>艺术家<input name="artistName" defaultValue={source?.artistName ?? ""} /></label>
        {musicMetadata ? <MusicMetadataDetails metadata={musicMetadata} title="更多音乐信息" /> : null}
        <section className="cover-picker">
          <CoverArt src={coverDataUrl} label={source?.albumName ?? source?.songName ?? "封面"} />
          <div>
            <strong>封面照片</strong>
            <label className="secondary-button file-button">
              从相册选择
              <input type="file" accept="image/*" onChange={chooseCover} />
            </label>
          </div>
        </section>
        <label>收听日期<input name="listenedAt" type="date" defaultValue={source?.listenedAt ? new Date(source.listenedAt).toLocaleDateString("en-CA") : ""} /></label>
        <GenrePicker
          selectedTags={selectedGenreTags}
          onToggleTag={toggleGenre}
        />
        <label>标签<input name="tags" defaultValue={source ? freeTags(source.tags).join(", ") : ""} /></label>
        <MoodPicker
          groupId={selectedMoodGroupId}
          selectedMoods={selectedMoods}
          onGroupChange={setSelectedMoodGroupId}
          onToggleMood={toggleMood}
        />
        <RatingSlider
          value={rating}
          modifier={ratingModifier}
          onChange={(r, m) => { compositeLockedRef.current = multiDimension && r !== null; setRating(r); setRatingModifier(m); }}
          label={multiDimension ? "综合评分" : "评分"}
        />
        <div className="multi-dimension-toggle">
          <label>
            <input type="checkbox" checked={multiDimension} onChange={(e) => { compositeLockedRef.current = false; setMultiDimension(e.target.checked); }} />
            多维度评分（制作 / 词曲 / 原创性 / 共鸣）
          </label>
          {multiDimension ? <small>开启后综合评分自动取四维平均；手动拖动综合滑块后即锁定，改四维可重新解锁。</small> : null}
        </div>
        {multiDimension ? (
          <div className="multi-dimension-grid">
            <RatingSlider value={ratingProduction} modifier={null} onChange={(r) => { compositeLockedRef.current = false; setRatingProduction(r); }} name="ratingProduction" showModifier={false} label="制作" />
            <RatingSlider value={ratingSongwriting} modifier={null} onChange={(r) => { compositeLockedRef.current = false; setRatingSongwriting(r); }} name="ratingSongwriting" showModifier={false} label="词曲" />
            <RatingSlider value={ratingOriginality} modifier={null} onChange={(r) => { compositeLockedRef.current = false; setRatingOriginality(r); }} name="ratingOriginality" showModifier={false} label="原创性" />
            <RatingSlider value={ratingResonance} modifier={null} onChange={(r) => { compositeLockedRef.current = false; setRatingResonance(r); }} name="ratingResonance" showModifier={false} label="共鸣" />
          </div>
        ) : null}
        <label>首次收听时间<input name="firstListenedAt" type="date" defaultValue={source?.firstListenedAt ? new Date(source.firstListenedAt).toLocaleDateString("en-CA") : ""} /></label>
        <label>正文<textarea className="note-editor" name="content" rows={16} defaultValue={source?.content ?? ""} placeholder="像写备忘录一样，记录此刻的感受……" required /></label>
        <div className={`draft-status${draftError ? " error-state" : ""}`}>
          <span role="status" aria-live="polite">{draftStatus}</span>
          {hasDraft ? <button className="secondary-button" type="button" onClick={discardDraft}>放弃草稿</button> : null}
        </div>
        {notice ? <p className="hint">{notice}</p> : null}
        {error ? <p className="error">{error}</p> : null}
        <div className="entry-save-actions">
          <button className="secondary-button" type="button" disabled={saving || !draftReady} onClick={saveDraftAndExit}>保存草稿</button>
          <button className="primary-button" type="submit" disabled={saving}>{saving ? "保存中" : "保存正式乐评"}</button>
        </div>
      </form>
    </Page>
  );
}

function GenrePicker({ selectedTags, onToggleTag }: {
  selectedTags: string[];
  onToggleTag: (tag: string) => void;
}) {
  const [genreQuery, setGenreQuery] = useState("");
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
  const selectedTagSet = new Set(selectedTags);
  const searchResults = genreSearchMatches(genreQuery);
  const searchGroups = groupGenreSearchResults(searchResults, (label) => selectedTagSet.has(label));

  function toggleExpand(label: string) {
    setExpandedNodes((prev) => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      return next;
    });
  }

  function selectSearchResult(label: string) {
    onToggleTag(label);
    setGenreQuery("");
  }

  return (
    <section className="choice-panel">
      <strong>曲风</strong>
      <label>搜索曲风<input type="search" value={genreQuery} onChange={(event) => setGenreQuery(event.target.value)} placeholder="输入关键词快速定位" /></label>
      {searchResults.length ? (
        <GenreSearchResultGroups groups={searchGroups} onSelect={selectSearchResult} />
      ) : genreQuery.trim() ? (
        <p className="genre-empty-hint">没有匹配曲风</p>
      ) : null}
      <div className="genre-tree">
        {GENRE_TREE.map((level1) => {
          const isExpanded = expandedNodes.has(level1.label);
          const hasChildren = level1.children && level1.children.length > 0;
          return (
            <div key={level1.label}>
              <div className="genre-tree-level">
                <button
                  type="button"
                  className={`genre-tree-chip${selectedTagSet.has(level1.label) ? " selected" : ""}${hasChildren ? " has-children" : ""}`}
                  onClick={() => {
                    onToggleTag(level1.label);
                    if (hasChildren) toggleExpand(level1.label);
                  }}
                >
                  {level1.label}
                </button>
              </div>
              {isExpanded && hasChildren ? (
                <div style={{ paddingLeft: 16 }}>
                  {level1.children!.map((level2) => {
                    const isL2Expanded = expandedNodes.has(level2.label);
                    const hasL2Children = "children" in level2 && (level2.children as readonly GenreNode[]).length > 0;
                    return (
                      <div key={level2.label}>
                        <div className="genre-tree-level">
                          <button
                            type="button"
                            className={`genre-tree-chip${selectedTagSet.has(level2.label) ? " selected" : ""}${hasL2Children ? " has-children" : ""}`}
                            onClick={() => {
                              onToggleTag(level2.label);
                              if (hasL2Children) toggleExpand(level2.label);
                            }}
                          >
                            {level2.label}
                          </button>
                        </div>
                        {isL2Expanded && hasL2Children ? (
                          <div style={{ paddingLeft: 16 }}>
                            <div className="genre-tree-level">
                              {(level2 as GenreNode).children!.map((level3) => (
                                <button
                                  key={level3.label}
                                  type="button"
                                  className={`genre-tree-chip${selectedTagSet.has(level3.label) ? " selected" : ""}`}
                                  onClick={() => onToggleTag(level3.label)}
                                >
                                  {level3.label}
                                </button>
                              ))}
                            </div>
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              ) : null}
              <div className="genre-tree-separator" />
            </div>
          );
        })}
      </div>
      {selectedTags.length ? (
        <div className="selected-chip-row" aria-label="已选曲风">
          {selectedTags.map((tag) => (
            <button key={tag} type="button" onClick={() => onToggleTag(tag)}>
              {tag} ×
            </button>
          ))}
        </div>
      ) : null}
      <input type="hidden" name="genreTags" value={selectedTags.join(", ")} />
    </section>
  );
}

function MoodPicker({ groupId, selectedMoods, onGroupChange, onToggleMood }: {
  groupId: string;
  selectedMoods: string[];
  onGroupChange: (groupId: string) => void;
  onToggleMood: (mood: string) => void;
}) {
  const group = MOOD_GROUPS.find((item) => item.id === groupId) ?? MOOD_GROUPS[0];
  const selectedMoodSet = new Set(selectedMoods);
  return (
    <section className="choice-panel">
      <label>情绪关键词
        <select value={group?.id ?? ""} onChange={(event) => onGroupChange(event.target.value)}>
          {MOOD_GROUPS.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
        </select>
      </label>
      <div className="choice-chip-row" aria-label="二级情绪">
        {(group?.moods ?? []).map((mood) => (
          <button key={mood} type="button" className={selectedMoodSet.has(mood) ? "selected" : ""} onClick={() => onToggleMood(mood)}>
            {mood}
          </button>
        ))}
      </div>
      {selectedMoods.length ? (
        <div className="selected-chip-row" aria-label="已选情绪">
          {selectedMoods.map((mood) => (
            <button key={mood} type="button" onClick={() => onToggleMood(mood)}>
              {mood} ×
            </button>
          ))}
        </div>
      ) : null}
      <input type="hidden" name="moods" value={selectedMoods.join(", ")} />
    </section>
  );
}

function defaultMoodGroupId(moods: string[]) {
  return MOOD_GROUPS.find((group) => group.moods.some((mood) => moods.includes(mood)))?.id ?? MOOD_GROUPS[0]?.id ?? "";
}

function defaultGenreSelection(value: string | null): GenreSelection {
  const path = value ? findGenrePath(value) : [];
  return {
    level1: path[0] ?? GENRE_TREE[0]?.label ?? "",
    level2: path[1] ?? "",
    level3: path[2] ?? "",
  };
}

function selectedGenreValue(selection: GenreSelection) {
  return selection.level3 || selection.level2 || selection.level1;
}

function genreSearchMatches(query: string) {
  const normalizedQuery = normalizeGenreQuery(query);
  if (!normalizedQuery) return [];
  return GENRE_TAGS.filter((tag) => normalizeGenreQuery(tag).includes(normalizedQuery)).slice(0, 12);
}

function groupGenreSearchResults(results: string[], isSelected: (label: string) => boolean) {
  return [
    { label: "已选", values: results.filter(isSelected), selected: true },
    { label: "未选", values: results.filter((label) => !isSelected(label)), selected: false },
  ].filter((group) => group.values.length);
}

function GenreSearchResultGroups({ groups, onSelect }: {
  groups: { label: string; values: string[]; selected: boolean }[];
  onSelect: (label: string) => void;
}) {
  return (
    <div className="genre-search-groups" aria-label="曲风搜索结果">
      {groups.map((group) => (
        <div key={group.label} className="genre-search-group">
          <span className="genre-search-group-label">{group.label}</span>
          <div className="genre-search-results">
            {group.values.map((label) => (
              <button key={label} type="button" className={group.selected ? "selected" : ""} onClick={() => onSelect(label)}>
                {label}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function normalizeGenreQuery(value: string) {
  return value.toLocaleLowerCase().replace(/\s+/g, " ").trim();
}

function freeTags(tags: string[]) {
  return tags.filter((tag) => !isKnownGenreTag(tag));
}

function mergeTagLists(...lists: string[][]) {
  return Array.from(new Set(lists.flat().filter(Boolean)));
}

function EntryDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [entry, setEntry] = useState<ReviewEntry | null>(null);
  const [coverDataUrl, setCoverDataUrl] = useState<string | null>(null);
  const [moments, setMoments] = useState<ListeningMoment[]>([]);
  const [showMomentForm, setShowMomentForm] = useState(false);
  const [momentSaving, setMomentSaving] = useState(false);
  const [momentError, setMomentError] = useState("");
  const [error, setError] = useState("");
  const momentFormRef = useRef<HTMLFormElement | null>(null);

  useEffect(() => {
    let active = true;
    if (!id) {
      setEntry(null);
      setCoverDataUrl(null);
      setMoments([]);
      return () => { active = false; };
    }
    void (async () => {
      const nextEntry = await store.getEntry(id);
      const nextCover = nextEntry ? await loadEntryCover(nextEntry) : null;
      const nextMoments = nextEntry ? await store.getMomentsByEntryId(id) : [];
      if (!active) return;
      setEntry(nextEntry);
      setCoverDataUrl(nextCover);
      setMoments(nextMoments);
    })().catch(() => {
      if (!active) return;
      setEntry(null);
      setCoverDataUrl(null);
      setMoments([]);
    });
    return () => { active = false; };
  }, [id]);
  if (!entry) return <Page title="记录不存在"><Empty text="没有找到这条记录。" /></Page>;

  const musicLine = [entry.songName, entry.albumName, entry.artistName].filter(Boolean).join(" / ");
  const coverLabel = entry.albumName ?? entry.songName ?? entry.title;

  async function remove() {
    const current = entry;
    if (!current) return;
    if (!confirm("确认删除这条记录？")) return;
    try {
      await store.deleteEntry(current.id);
      removeEntryDraft(localStorage, "edit", current.id);
      navigate("/timeline");
    } catch (err) {
      setError(err instanceof Error ? err.message : "删除失败");
    }
  }

  async function addMoment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (momentSaving || !id) return;
    setMomentError("");
    setMomentSaving(true);
    try {
      const form = new FormData(event.currentTarget);
      const rating = readNumber(form, "momentRating");
      const modifier = readNullable(form, "momentRatingModifier") as RatingModifier | null;
      const input: ListeningMomentInput = {
        listenedAt: readText(form, "momentListenedAt") ? new Date(readText(form, "momentListenedAt")).toISOString() : new Date().toISOString(),
        rating: rating !== null && rating >= 0.5 && rating <= 10 ? rating : null,
        ratingModifier: rating !== null && rating >= 0.5 && rating <= 10 ? modifier : null,
        moods: parseList(readText(form, "momentMoods")),
        content: readText(form, "momentContent"),
      };
      if (!input.content.trim()) throw new Error("感受内容不能为空");
      const saved = await store.createListeningMoment(id, input);
      setMoments((current) => [...current, saved].sort((a, b) => a.listenedAt.localeCompare(b.listenedAt)));
      setShowMomentForm(false);
      momentFormRef.current?.reset();
    } catch (err) {
      setMomentError(err instanceof Error ? err.message : "添加失败");
    } finally {
      setMomentSaving(false);
    }
  }

  async function removeMoment(momentId: string) {
    if (!confirm("确认删除这条追加记录？")) return;
    try {
      await store.deleteListeningMoment(momentId);
      setMoments((current) => current.filter((m) => m.id !== momentId));
    } catch (err) {
      setMomentError(err instanceof Error ? err.message : "删除失败");
    }
  }

  const ratingDisplay = entry.rating !== null
    ? `${entry.rating}${entry.ratingModifier ?? ""}/10`
    : null;

  const allRatings = [
    ...(entry.rating !== null ? [{ label: "首次", rating: entry.rating, modifier: entry.ratingModifier }] : []),
    ...moments.filter((m) => m.rating !== null).map((m) => ({ label: formatDateOnly(m.listenedAt), rating: m.rating as number, modifier: m.ratingModifier })),
  ];

  const maxRating = Math.max(...allRatings.map((r) => r.rating), 1);
  const entryMoodSet = new Set(entry.moods);
  const allMomentMoods = new Set(moments.flatMap((m) => m.moods));
  const newMoods = Array.from(allMomentMoods).filter((m) => !entryMoodSet.has(m));
  const goneMoods = Array.from(entryMoodSet).filter((m) => !allMomentMoods.has(m));
  const sameMoods = Array.from(entryMoodSet).filter((m) => allMomentMoods.has(m));

  return (
    <Page title={entry.title} text={`${ENTRY_TYPE_LABELS[entry.type]} / ${entry.year} / ${monthLabel(entry.month)}`}>
      <div className="detail-hero">
        <CoverArt src={coverDataUrl} label={coverLabel} large />
        <div className="detail-hero-copy">
          <span>{musicLine || entry.title}</span>
          {entry.rating !== null ? <strong>{entry.rating}{entry.ratingModifier ?? ""}/10</strong> : null}
          <small>{formatDateOnly(entry.listenedAt)}</small>
        </div>
      </div>
      <div className="action-row">
        {entry.type === "song" ? <Link className="primary-button" to={`/relisten/${entry.id}`}>再次听见</Link> : null}
        <Link className="secondary-button" to={`/entries/${entry.id}/edit`}>编辑</Link>
        <button className="danger-button" onClick={remove}>删除</button>
      </div>
      {error ? <p className="error">{error}</p> : null}
      {searchParams.get("draftCleanup") === "failed" ? <p className="hint">记录已保存，但原快速草稿未能清理；可稍后在草稿箱手动删除。</p> : null}
      <article className="content-card">{entry.content}</article>
      <QuickMemoryCardPanel entry={entry} coverUrl={coverDataUrl} emphasized={searchParams.get("card") === "quick"} />
      <DailyListeningNote entry={entry} />
      <div className="detail-card">
        <Meta label="专辑" value={entry.albumName} />
        <Meta label="歌曲" value={entry.songName} />
        <Meta label="艺术家" value={entry.artistName} />
        <Meta label="标签" value={entry.tags.join("、") || null} />
        <Meta label="情绪" value={entry.moods.join("、") || null} />
        <Meta label="评分" value={ratingDisplay} />
        {entry.ratingProduction !== null || entry.ratingSongwriting !== null || entry.ratingOriginality !== null || entry.ratingResonance !== null ? (
          <>
            <Meta label="制作" value={entry.ratingProduction !== null ? `${entry.ratingProduction}/10` : null} />
            <Meta label="词曲" value={entry.ratingSongwriting !== null ? `${entry.ratingSongwriting}/10` : null} />
            <Meta label="原创性" value={entry.ratingOriginality !== null ? `${entry.ratingOriginality}/10` : null} />
            <Meta label="共鸣" value={entry.ratingResonance !== null ? `${entry.ratingResonance}/10` : null} />
          </>
        ) : null}
        <Meta label="首次收听" value={formatDateOnly(entry.firstListenedAt)} />
        <Meta label="听歌或感受日期" value={formatDateOnly(entry.listenedAt)} />
        <Meta label="创建时间" value={formatDate(entry.createdAt)} />
        <Meta label="更新时间" value={formatDate(entry.updatedAt)} />
      </div>
      {entry.musicMetadata ? <MusicMetadataDetails metadata={entry.musicMetadata} title="完整音乐元数据" open /> : null}

      <section className="moment-section">
        <div className="moment-section-head">
          <div>
            <h2>听歌时间线</h2>
            <span>{moments.length} 次追加记录</span>
          </div>
          <button className="secondary-button" type="button" onClick={() => setShowMomentForm((v) => !v)}>
            {showMomentForm ? "取消" : "添加记录"}
          </button>
        </div>

        {moments.length ? (
          <div className="moment-list">
            {moments.map((moment) => (
              <div key={moment.id} className="moment-card">
                <div className="moment-card-head">
                  <time>{formatDateOnly(moment.listenedAt)}</time>
                  {moment.rating !== null ? (
                    <span className="moment-rating">{moment.rating}{moment.ratingModifier ?? ""}/10</span>
                  ) : null}
                  <button type="button" className="danger-button" style={{ marginLeft: "auto", padding: "2px 8px", fontSize: 11 }} onClick={() => removeMoment(moment.id)}>删除</button>
                </div>
                <div className="moment-card-content">{moment.content}</div>
                {moment.moods.length ? (
                  <div className="moment-card-moods">
                    {moment.moods.map((mood) => <span key={mood}>{mood}</span>)}
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        ) : (
          <p style={{ padding: 16, color: "var(--muted)", fontSize: 13 }}>还没有追加记录。点击"添加记录"写下再次听到这首歌的感受。</p>
        )}

        {showMomentForm ? (
          <form className="moment-form" ref={momentFormRef} onSubmit={addMoment}>
            <label>收听日期<input name="momentListenedAt" type="date" defaultValue={new Date().toLocaleDateString("en-CA")} /></label>
            <div className="moment-form-row">
              <label>评分<input name="momentRating" type="number" min="0.5" max="10" step="0.5" placeholder="0.5-10" /></label>
              <label>修饰符<select name="momentRatingModifier" defaultValue=""><option value="">无</option><option value="+">+</option><option value="-">-</option></select></label>
            </div>
            <label>情绪关键词<input name="momentMoods" placeholder="用逗号分隔，如：感动, 平静" /></label>
            <label>感受<textarea name="momentContent" rows={4} placeholder="这次听到这首歌，有什么新的感受？" required /></label>
            {momentError ? <p className="error">{momentError}</p> : null}
            <div className="moment-form-actions">
              <button className="primary-button" type="submit" disabled={momentSaving}>{momentSaving ? "保存中" : "保存记录"}</button>
            </div>
          </form>
        ) : null}
      </section>

      {allRatings.length > 1 || newMoods.length || goneMoods.length ? (
        <section className="change-viz">
          <h2>评分与情绪变化</h2>
          <div className="change-viz-row">
            {allRatings.length > 1 ? (
              <div className="change-viz-card">
                <strong>评分趋势</strong>
                <div className="rating-sparkline">
                  {allRatings.map((r, index) => (
                    <div key={index} className={`rating-sparkline-bar${index === 0 ? " first" : ""}`}
                      style={{ height: `${(r.rating / maxRating) * 100}%` }}
                      title={`${r.label}: ${r.rating}${r.modifier ?? ""}/10`}
                    />
                  ))}
                </div>
                <div className="rating-sparkline-value">
                  {allRatings.map((r) => `${r.rating}${r.modifier ?? ""}`).join(" → ")}
                </div>
              </div>
            ) : null}
            <div className="change-viz-card">
              <strong>情绪演变</strong>
              <div className="mood-flow">
                {newMoods.map((mood) => <span key={mood} className="mood-flow-item new">+{mood}</span>)}
                {sameMoods.map((mood) => <span key={mood} className="mood-flow-item same">{mood}</span>)}
                {goneMoods.map((mood) => <span key={mood} className="mood-flow-item gone">{mood}</span>)}
              </div>
            </div>
          </div>
        </section>
      ) : null}
    </Page>
  );
}

function AlbumsPage() {
  const [albums, setAlbums] = useState<AlbumAggregate[]>([]);
  useEffect(() => void store.albumAggregates().then(setAlbums), []);
  return <AggregateList title="专辑" items={albums} kind="album" emptyText="暂无专辑记录。" />;
}

function SongsPage() {
  const [songs, setSongs] = useState<SongAggregate[]>([]);
  useEffect(() => void store.songAggregates().then(setSongs), []);
  return <AggregateList title="歌曲" items={songs} kind="song" emptyText="暂无歌曲记录。" />;
}

function AggregateList({ title, items, kind, emptyText }: { title: string; items: Array<AlbumAggregate | SongAggregate>; kind: "album" | "song"; emptyText: string }) {
  return (
    <Page title={title} text={`按你填写过的${title}名称聚合。`}>
      {!items.length ? <Empty text={emptyText} /> : null}
      <div className="cover-list">
        {items.map((item) => {
          const isSong = kind === "song";
          const name = isSong ? (item as SongAggregate).songName : (item as AlbumAggregate).albumName;
          const params = new URLSearchParams(isSong ? { songName: name } : { albumName: name });
          if (item.artistName) params.set("artistName", item.artistName);
          if (isSong && (item as SongAggregate).albumName) params.set("albumName", (item as SongAggregate).albumName as string);
          return (
            <Link key={`${kind}-${name}-${item.artistName ?? ""}-${isSong ? (item as SongAggregate).albumName ?? "" : ""}`} to={`/${kind === "song" ? "songs" : "albums"}/detail?${params.toString()}`} className="cover-row">
              <CoverArt src={item.coverDataUrl} label={name} />
              <div className="cover-copy">
                <h2>{name}</h2>
                <p>{item.artistName ?? "未填写艺术家"}</p>
                {"albumName" in item ? <p>所属专辑：{item.albumName ?? "未填写"}</p> : null}
                <p>年份：{item.years.join(", ")} / 记录：{item.recordCount}</p>
                <p>{item.summary}</p>
              </div>
            </Link>
          );
        })}
      </div>
    </Page>
  );
}

function AggregateDetail({ kind }: { kind: "album" | "song" }) {
  const [params] = useSearchParams();
  const [entries, setEntries] = useState<ReviewEntry[]>([]);
  const [cover, setCover] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const albumName = params.get("albumName");
  const songName = params.get("songName");
  const artistName = params.get("artistName");
  useEffect(() => {
    Promise.all([
      store.listEntries(),
      store.getCover(kind, { albumName, songName, artistName }),
    ]).then(([all, nextCover]) => {
      setEntries(all.filter((entry) => kind === "album" ? entry.albumName === albumName && entry.artistName === artistName : entry.songName === songName && entry.artistName === artistName && entry.albumName === albumName));
      setCover(nextCover);
    });
  }, [albumName, artistName, kind, songName]);
  const title = kind === "album" ? albumName ?? "专辑记录" : songName ?? "歌曲记录";

  async function chooseCover(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    if (!file) return;
    setMessage("");
    try {
      const dataUrl = await fileToCoverDataUrl(file);
      await store.setCover(kind, { albumName, songName, artistName }, dataUrl);
      setCover(dataUrl);
      setMessage("封面已保存");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "封面保存失败");
    } finally {
      event.currentTarget.value = "";
    }
  }

  return (
    <Page title={title} text={artistName ?? "未填写艺术家"}>
      <div className="cover-editor">
        <CoverArt src={cover} label={title} large />
        <div>
          <strong>封面</strong>
          <p>从手机相册选择图片，保存后会显示在聚合列表。</p>
          <label className="secondary-button file-button">
            从相册选择
            <input type="file" accept="image/*" onChange={chooseCover} />
          </label>
          {message ? <p className="hint">{message}</p> : null}
        </div>
      </div>
      {kind === "song" && entries.length ? (
        <Link className="primary-button full aggregate-relisten-link" to={`/relisten/${oldestEntry(entries).id}`}>再次听见这首歌</Link>
      ) : null}
      <EntryList entries={entries} />
    </Page>
  );
}

function localDateKey() {
  const date = new Date();
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function oldestEntry(entries: ReviewEntry[]) {
  return entries.reduce((oldest, entry) => (entry.listenedAt ?? entry.createdAt).localeCompare(oldest.listenedAt ?? oldest.createdAt) < 0 ? entry : oldest);
}

function SearchPage() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ReviewEntry[]>([]);
  async function search(event: FormEvent) {
    event.preventDefault();
    setResults(await store.searchEntries(query));
  }
  return (
    <Page title="搜索" text="搜索标题、正文、歌曲、专辑、艺术家、标签和情绪。">
      <form onSubmit={search} className="search-box">
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="输入关键词" />
        <button className="primary-button">搜索</button>
      </form>
      <EntryList entries={results} emptyText={query ? "没有匹配记录。" : "输入关键词后开始搜索。"} />
    </Page>
  );
}

function AbstractMusicMapPage() {
  const [filters, setFilters] = useState<VisualizationFilters>({});
  const [result, setResult] = useState<AbstractMapResult | null>(null);
  const [selectedRegion, setSelectedRegion] = useState<AbstractMapRegion | null>(null);
  const [filterOpen, setFilterOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    void store.abstractMusicMap(filters).then((nextResult) => {
      if (!active) return;
      setResult(nextResult);
      setSelectedRegion((current) => current ? nextResult.regions.find((region) => region.id === current.id) ?? null : null);
    }).catch((err) => {
      if (active) setError(err instanceof Error ? err.message : "抽象地图读取失败");
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [filters]);

  return (
    <VisualPage title="抽象地图" text="按情绪把你的音乐记忆放进不同大陆。">
      <VisualToolbar
        count={result?.totalCount ?? 0}
        summary={filterSummary(filters, true, false)}
        onFilter={() => setFilterOpen(true)}
      />
      {loading ? <VisualLoading text="正在绘制听歌地图。" /> : null}
      {error ? <VisualError text={error} /> : null}
      {!loading && !error && result && !result.totalCount ? <VisualEmpty text="当前筛选下没有记录。换一个年份、艺术家或情绪试试。" /> : null}
      {!loading && !error && result ? (
        <section className="abstract-map-grid" aria-label="抽象听歌地图">
          {result.regions.map((region) => (
            <button key={region.id} className={`map-region-card ${region.id}`} type="button" onClick={() => setSelectedRegion(region)}>
              <span className="map-region-glow" style={{ backgroundColor: region.color }} />
              <span className="map-region-kicker">{region.tone}</span>
              <strong>{region.name}</strong>
              <span>{region.songCount} 首</span>
              <p>{region.description}</p>
              <div className="map-feature-list">
                {region.featuredSongs.length ? region.featuredSongs.map((song) => <em key={song.id}>{song.title}</em>) : <em>暂无代表歌曲</em>}
              </div>
            </button>
          ))}
        </section>
      ) : null}
      {filterOpen ? (
        <VisualizationFilterSheet
          title="筛选抽象地图"
          filters={filters}
          options={result?.options ?? EMPTY_VISUALIZATION_OPTIONS}
          includeMonth
          onApply={(nextFilters) => {
            setFilters(nextFilters);
            setFilterOpen(false);
          }}
          onReset={() => {
            setFilters({});
            setFilterOpen(false);
          }}
          onClose={() => setFilterOpen(false)}
        />
      ) : null}
      {selectedRegion ? (
        <BottomSheet title={selectedRegion.name} text={`${selectedRegion.songCount} 首 / ${selectedRegion.description}`} onClose={() => setSelectedRegion(null)}>
          <VisualSongList songs={selectedRegion.songs} emptyText="这片区域暂时没有歌曲。" />
        </BottomSheet>
      ) : null}
    </VisualPage>
  );
}

function DraftsPage() {
  const navigate = useNavigate();
  const [drafts, setDrafts] = useState<EntryDraftMeta[]>([]);
  const [error, setError] = useState("");

  function refresh() {
    try {
      setDrafts(listEntryDrafts(localStorage));
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "草稿列表读取失败");
    }
  }

  useEffect(() => { refresh(); }, []);

  function continueDraft(draft: EntryDraftMeta) {
    if (draft.mode === "create") {
      if (draft.draftId) {
        navigate(`${draft.captureMode === "quick" ? "/capture" : "/new"}?draft=${encodeURIComponent(draft.draftId)}`);
      } else {
        // legacy 草稿（v1:new 无 draftId）：迁移到新 key 后跳转
        const result = readEntryDraft(localStorage, "create", null, null);
        if (result.status === "valid") {
          const newDraftId = createNewDraftId();
          writeEntryDraft(localStorage, { ...result.draft, draftId: newDraftId });
          deleteEntryDraftByKey(localStorage, draft.key);
          navigate(`/new?draft=${encodeURIComponent(newDraftId)}`);
        } else {
          navigate("/new");
        }
      }
    } else if (draft.entryId) {
      navigate(`/entries/${draft.entryId}/edit`);
    }
  }

  function createNewDraft() {
    const newCount = countNewDrafts(localStorage);
    if (newCount >= MAX_NEW_DRAFTS) {
      setError(`新建草稿已达上限（${MAX_NEW_DRAFTS} 份），请先删除旧草稿。`);
      return;
    }
    const newDraftId = createNewDraftId();
    navigate(`/new?draft=${encodeURIComponent(newDraftId)}`);
  }

  function createInspirationDraft() {
    const newCount = countNewDrafts(localStorage);
    if (newCount >= MAX_NEW_DRAFTS) {
      setError(`新建草稿已达上限（${MAX_NEW_DRAFTS} 份），请先删除旧草稿。`);
      return;
    }
    const newDraftId = createNewDraftId();
    navigate(`/new?draft=${encodeURIComponent(newDraftId)}&inspiration=1`);
  }

  function deleteDraft(draft: EntryDraftMeta) {
    if (!confirm(`删除草稿「${draft.title}」？此操作无法撤销。`)) return;
    try {
      deleteEntryDraftByKey(localStorage, draft.key);
      refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "草稿删除失败");
    }
  }

  const newCount = drafts.filter((d) => d.mode === "create").length;

  return (
    <Page title="草稿箱" text={`${drafts.length} 份未保存草稿（新建 ${newCount}/${MAX_NEW_DRAFTS}，编辑 ${drafts.length - newCount}），点击续写或删除。`}>
      {error ? <p className="error">{error}</p> : null}
      <div className="draft-actions">
        <button type="button" className="primary-button full draft-create" onClick={createNewDraft} disabled={newCount >= MAX_NEW_DRAFTS}>
          新建草稿（{newCount}/{MAX_NEW_DRAFTS}）
        </button>
        <button type="button" className="secondary-button full draft-inspiration-create" onClick={createInspirationDraft} disabled={newCount >= MAX_NEW_DRAFTS}>
          灵感速记
        </button>
      </div>
      {drafts.length === 0 ? (
        <Empty text="没有草稿。点上方按钮或底部「+」开始新记录，输入内容会自动保存。" />
      ) : (
        <div className="draft-list">
          {drafts.map((draft) => (
            <div key={draft.key} className={`draft-card${draft.inspiration ? " draft-inspiration" : ""}`}>
              <button type="button" className="draft-card-main" onClick={() => continueDraft(draft)}>
                <strong>{draft.title}</strong>
                <span className="draft-meta">
                  {draft.inspiration ? "灵感速记" : draft.captureMode === "quick" ? "快速记录" : draft.mode === "create" ? "新建草稿" : "编辑记录"}
                  {draft.type ? ` · ${ENTRY_TYPE_LABELS[draft.type]}` : ""}
                  {" · "}{formatDate(draft.savedAt)}
                </span>
              </button>
              <button type="button" className="danger-button draft-delete" onClick={() => deleteDraft(draft)}>删除</button>
            </div>
          ))}
        </div>
      )}
    </Page>
  );
}

function BackupPage() {
  const [exported, setExported] = useState<ExportedData | null>(null);
  const [exportAction, setExportAction] = useState<"save" | "share" | "copy" | null>(null);
  const [exportStatus, setExportStatus] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const [importText, setImportText] = useState("");
  const [preview, setPreview] = useState<BackupPreview | null>(null);
  const [undoPreview, setUndoPreview] = useState<BackupPreview | null>(null);
  useEffect(() => {
    let active = true;
    void store.previewImportUndo().then((preview) => {
      if (active) setUndoPreview(preview);
    });
    return () => {
      active = false;
    };
  }, []);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [health, setHealth] = useState<BackupHealth | null>(null);
  const [corruption, setCorruption] = useState<StorageCorruption | null>(() => readStorageCorruption(localStorage));

  useEffect(() => {
    let active = true;
    void store.getStoredAppData(BACKUP_HEALTH_KEY).then((raw) => {
      if (active) setHealth(parseBackupHealth(raw));
    }).catch((err) => {
      if (active) {
        setCorruption(readStorageCorruption(localStorage));
        setError(err instanceof Error ? err.message : "备份健康记录读取失败");
      }
    });
    return () => { active = false; };
  }, []);

  async function saveHealth(next: BackupHealth) {
    await store.setStoredAppData(BACKUP_HEALTH_KEY, JSON.stringify(next));
    setHealth(next);
  }

  async function verifyBackup() {
    setMessage("");
    setError("");
    setBusy(true);
    try {
      const raw = await store.exportBackup();
      const next = await inspectBackup(raw, store.previewBackup(raw));
      await saveHealth(next);
      setMessage("备份健康检查通过：SQLite v5、记录数量和 SHA-256 已确认");
    } catch (err) {
      setError(err instanceof Error ? err.message : "备份健康检查失败");
    } finally {
      setBusy(false);
    }
  }

  async function markJsonSaved(fileName: string, raw: string) {
    const sha = await inspectBackup(raw, store.previewBackup(raw));
    await saveHealth({ ...sha, lastSavedAt: new Date().toISOString(), lastSavedFileName: fileName });
  }

  async function exportData(kind: ExportKind) {
    setMessage("");
    setError("");
    setExportStatus(null);
    try {
      const content = kind === "json" ? await store.exportBackup() : kind === "txt" ? await store.exportTxt() : await store.exportCsv();
      const meta = EXPORT_FILE_META[kind];
      setExported({ kind, content, fileName: exportFileName(kind), mimeType: meta.mimeType });
      setExportStatus({ tone: "success", text: `${EXPORT_LABELS[kind]} 已生成，可以保存、分享或复制` });
    } catch (err) {
      setError(err instanceof Error ? err.message : "导出失败");
    }
  }

  async function saveExportFile() {
    if (!exported) return;
    setExportAction("save");
    setExportStatus({ tone: "success", text: Capacitor.isNativePlatform() ? "正在打开系统文件选择器……" : "正在保存文件……" });
    try {
      if (Capacitor.isNativePlatform()) {
        const result = await NativeExport.saveFile(exported);
        if (result.status === "cancelled") {
          setExportStatus({ tone: "success", text: "已取消保存" });
          return;
        }
        if (exported.kind === "json") {
          try {
            await markJsonSaved(exported.fileName, exported.content);
          } catch (healthError) {
            setExportStatus({ tone: "error", text: `文件已保存，但备份健康状态更新失败：${healthError instanceof Error ? healthError.message : "未知错误"}` });
            return;
          }
        }
        setExportStatus({ tone: "success", text: `文件已保存：${exported.fileName}` });
      } else {
        downloadExportFile(new File([exported.content], exported.fileName, { type: exported.mimeType }));
        setExportStatus({ tone: "success", text: `已开始下载：${exported.fileName}` });
      }
    } catch (err) {
      setExportStatus({ tone: "error", text: err instanceof Error ? `保存失败：${err.message}` : "保存失败，请重试" });
    } finally {
      setExportAction(null);
    }
  }

  async function shareExportFile() {
    if (!exported) return;
    setExportAction("share");
    setExportStatus({ tone: "success", text: "正在打开系统分享……" });
    try {
      if (Capacitor.isNativePlatform()) {
        await NativeExport.shareFile(exported);
      } else {
        const file = new File([exported.content], exported.fileName, { type: exported.mimeType });
        if (typeof navigator.share !== "function" || navigator.canShare?.({ files: [file] }) === false) {
          throw new Error("当前浏览器不支持分享文件");
        }
        await navigator.share({ files: [file], title: exported.fileName, text: "小懂哥导出文件" });
      }
      setExportStatus({ tone: "success", text: "已打开系统分享" });
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        setExportStatus({ tone: "success", text: "已取消分享" });
      } else {
        setExportStatus({ tone: "error", text: err instanceof Error ? `分享失败：${err.message}` : "分享失败，请重试" });
      }
    } finally {
      setExportAction(null);
    }
  }

  async function copyExport() {
    if (!exported) return;
    setExportAction("copy");
    setExportStatus({ tone: "success", text: "正在复制内容……" });
    try {
      if (Capacitor.isNativePlatform()) await NativeExport.copyText({ text: exported.content });
      else await copyText(exported.content);
      setExportStatus({ tone: "success", text: `${EXPORT_LABELS[exported.kind]} 内容已复制` });
    } catch (err) {
      setExportStatus({ tone: "error", text: err instanceof Error ? `复制失败：${err.message}` : "复制失败，请重试" });
    } finally {
      setExportAction(null);
    }
  }

  async function copyCorruption() {
    if (!corruption) return;
    try {
      await copyText(corruption.raw);
      setMessage("损坏数据原文已复制");
    } catch {
      setError("损坏数据复制失败");
    }
  }

  function dismissCorruption() {
    if (!corruption || !confirm("确认清除这份隔离副本？清除后无法从应用内恢复原文。")) return;
    clearStorageCorruption(localStorage);
    setCorruption(null);
    setMessage("隔离副本已清除");
  }

  function changeImportText(value: string) {
    setImportText(value);
    setMessage("");
    setError("");
    if (!value.trim()) {
      setPreview(null);
      return;
    }
    try {
      setPreview(store.previewBackup(value));
    } catch (err) {
      setPreview(null);
      setError(err instanceof Error ? err.message : "备份预览失败");
    }
  }

  async function chooseImportFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    if (!file) return;
    setMessage("");
    setError("");
    try {
      // ponytail: file.text() 在部分 WebView 不可用，用 FileReader 回退
      let raw: string;
      try {
        raw = await file.text();
      } catch {
        raw = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result ?? ""));
          reader.onerror = () => reject(new Error("文件读取失败"));
          reader.readAsText(file);
        });
      }
      setImportText(raw);
      if (!raw.trim()) {
        setPreview(null);
        setError("备份文件为空");
        return;
      }
      setPreview(store.previewBackup(raw));
      setMessage(`已读取备份文件：${file.name}`);
    } catch (err) {
      setPreview(null);
      setError(err instanceof Error ? err.message : "备份文件读取失败");
    } finally {
      event.currentTarget.value = "";
    }
  }

  async function importData(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    let nextPreview: BackupPreview;
    try {
      nextPreview = store.previewBackup(importText);
      setPreview(nextPreview);
    } catch (err) {
      setError(err instanceof Error ? err.message : "备份预览失败");
      return;
    }
    if (!confirm(`导入会覆盖当前手机本地数据。备份包含 ${nextPreview.entryCount} 条记录、${nextPreview.summaryCount} 个年度总结、${nextPreview.monthlySummaryCount} 个月度作品、${nextPreview.coverCount} 张封面。确认继续？`)) return;
    setMessage("");
    setError("");
    setBusy(true);
    try {
      await store.importBackup(importText);
      setUndoPreview(await store.previewImportUndo());
      setMessage("导入完成");
      setExported(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "导入失败");
    } finally {
      setBusy(false);
    }
  }

  async function undoImport() {
    if (busy || !undoPreview) return;
    if (!confirm(`撤销会恢复导入前快照：${undoPreview.entryCount} 条记录、${undoPreview.summaryCount} 个年度总结、${undoPreview.monthlySummaryCount} 个月度作品、${undoPreview.coverCount} 张封面。确认继续？`)) return;
    setMessage("");
    setError("");
    setBusy(true);
    try {
      await store.restoreImportUndo();
      setUndoPreview(await store.previewImportUndo());
      setExported(null);
      setMessage("已撤销上次导入");
    } catch (err) {
      setError(err instanceof Error ? err.message : "撤销失败");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Page title="备份" text="JSON 用于恢复备份；TXT 和 CSV 用于手机查看。">
      <section className="form-card backup-health-card">
        <div className="assist-panel-head">
          <strong>备份健康</strong>
          <button className="secondary-button" type="button" onClick={verifyBackup} disabled={busy}>{busy ? "检查中" : "立即检查"}</button>
        </div>
        {health ? (
          <div className="backup-health-grid">
            <span>最近验证<strong>{formatDate(health.verifiedAt)}</strong></span>
            <span>最近保存<strong>{health.lastSavedAt ? formatDate(health.lastSavedAt) : "尚未保存 JSON 文件"}</strong></span>
            <span>内容统计<strong>{health.entryCount} 条记录 · {health.listeningMomentCount} 次复听</strong></span>
            <span>校验摘要<strong title={health.sha256}>{health.sha256.slice(0, 12)}…</strong></span>
          </div>
        ) : <p className="hint">尚未检查。检查会实际生成 SQLite v5 备份并计算 SHA-256，不会修改乐评。</p>}
        {health?.lastSavedFileName ? <p className="hint">最近保存：{health.lastSavedFileName}</p> : null}
      </section>
      {corruption ? (
        <section className="form-card corruption-card">
          <strong>发现并隔离了损坏的本地数据</strong>
          <p className="error">来源：{corruption.key} · {formatDate(corruption.detectedAt)}。应用没有用空数据覆盖它。</p>
          <textarea readOnly rows={6} value={corruption.raw} />
          <div className="export-output-actions">
            <button className="secondary-button" type="button" onClick={copyCorruption}>复制原始内容</button>
            <button className="danger-button" type="button" onClick={dismissCorruption}>清除隔离副本</button>
          </div>
        </section>
      ) : null}
      <div className="backup-export-actions">
        <button className="primary-button" type="button" onClick={() => exportData("json")}>导出 JSON</button>
        <button className="secondary-button" type="button" onClick={() => exportData("txt")}>导出 TXT</button>
        <button className="secondary-button" type="button" onClick={() => exportData("csv")}>导出 CSV</button>
      </div>
      {exported ? (
        <section className="form-card">
          <strong>导出的 {EXPORT_LABELS[exported.kind]}</strong>
          <p className="hint">{exported.fileName}</p>
          <textarea readOnly rows={10} value={exported.content} />
          <div className="export-output-actions native-export-actions">
            <button className="primary-button" type="button" onClick={saveExportFile} disabled={exportAction !== null}>保存到文件夹</button>
            <button className="secondary-button" type="button" onClick={shareExportFile} disabled={exportAction !== null}>系统分享</button>
            <button className="secondary-button" type="button" onClick={copyExport} disabled={exportAction !== null}>复制内容</button>
          </div>
          {exportStatus ? (
            <p className={exportStatus.tone === "error" ? "error" : "hint"} role={exportStatus.tone === "error" ? "alert" : "status"} aria-live="polite">
              {exportStatus.text}
            </p>
          ) : null}
        </section>
      ) : null}
      {undoPreview ? (
        <section className="form-card">
          <strong>可撤销的导入</strong>
          <p className="hint">导入前快照：{undoPreview.entryCount} 条记录、{undoPreview.summaryCount} 个年度总结、{undoPreview.monthlySummaryCount} 个月度作品、{undoPreview.coverCount} 张封面；导出时间：{formatDate(undoPreview.exportedAt)}</p>
          <button className="secondary-button" type="button" onClick={undoImport} disabled={busy}>{busy ? "处理中" : "撤销上次导入"}</button>
        </section>
      ) : null}
      <form className="form-card" onSubmit={importData}>
        <label className="secondary-button file-input-button">
          选择 JSON 文件
          <input type="file" accept="application/json,.json" onChange={chooseImportFile} />
        </label>
        <label>
          粘贴备份 JSON
          <textarea rows={10} value={importText} onChange={(event) => changeImportText(event.target.value)} />
        </label>
        {preview ? <p className="hint">备份内容：{preview.entryCount} 条记录、{preview.summaryCount} 个年度总结、{preview.monthlySummaryCount} 个月度作品、{preview.coverCount} 张封面；导出时间：{formatDate(preview.exportedAt)}</p> : null}
        <button className="danger-button" type="submit" disabled={busy}>{busy ? "导入中" : "导入并覆盖当前数据"}</button>
      </form>
      {message ? <p className="hint">{message}</p> : null}
      {error ? <p className="error">{error}</p> : null}
    </Page>
  );
}

function MorePage() {
  const [draftCount] = useState(() => listEntryDrafts(localStorage).length);
  const items = [
    ["/timeline", "时间轴", "按时间查看所有听感记录。"],
    ["/abstract-map", "抽象地图", "按情绪把记录放进听歌大陆。"],
    ["/insights", "情绪洞察", "按天气和季节看你的听歌偏好。"],
    ["/albums", "专辑", "按专辑名称聚合记录。"],
    ["/songs", "歌曲", "按歌曲名称聚合记录。"],
    ["/drafts", "草稿箱", `${draftCount} 份未保存草稿，可续写或删除。`],
    ["/backup", "备份", "导出或导入本地 JSON 备份。"],
    ["/privacy", "隐私说明", "查看通知读取、天气联网与本地听感分析的数据范围。"],
  ];
  return (
    <Page title="更多" text="低频入口集中放在这里。">
      <div className="card-list">
        {items.map(([to, title, text]) => (
          <Link key={to} to={to} className="entry-card">
            <h2>{title}</h2>
            <p>{text}</p>
          </Link>
        ))}
      </div>
      <p className="hint">版本 {APP_VERSION} · 本地优先的私人音乐档案</p>
    </Page>
  );
}

function InsightsPage() {
  const [insights, setInsights] = useState<Insight[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const entries = await store.listEntries();
        const weather = await store.getWeatherForEntries(entries);
        if (!active) return;
        setInsights(buildInsights(entries, weather));
      } catch (err) {
        if (!active) return;
        setError(err instanceof Error ? err.message : String(err));
        setInsights([]);
      }
    })();
    return () => { active = false; };
  }, []);

  return (
    <Page title="情绪洞察" text="把天气、季节和你的听歌情绪连起来，生成本地可分享的洞察卡片。">
      {error ? <p className="error">{error}</p> : null}
      {insights === null ? <p className="hint">正在汇总…</p> : null}
      {insights !== null && !insights.length ? (
        <Empty text="暂无足够数据。至少需要 5 篇带听取日期的乐评，且天气/季节分组各 3 篇以上才会生成洞察。" />
      ) : null}
      {insights && insights.length ? (
        <div className="insight-card-list">
          {insights.map((insight) => (
            <article key={insight.kind} className={`insight-card insight-${insight.kind}`}>
              <span className="insight-eyebrow">{insight.eyebrow}</span>
              <h2>{insight.title}</h2>
              <p>{insight.body}</p>
              {insight.evidence.length ? (
                <footer className="insight-evidence">
                  <span>相关日期：</span>
                  {insight.evidence.map((date) => <time key={date}>{formatDateOnly(date)}</time>)}
                </footer>
              ) : null}
            </article>
          ))}
        </div>
      ) : null}
    </Page>
  );
}

function VisualPage({ title, text, children }: { title: string; text: string; children: React.ReactNode }) {
  return (
    <section className="visual-page">
      <div className="visual-page-head">
        <h1>{title}</h1>
        <p>{text}</p>
      </div>
      {children}
    </section>
  );
}

function VisualToolbar({ count, summary, onFilter }: { count: number; summary: string; onFilter: () => void }) {
  return (
    <section className="visual-toolbar">
      <div>
        <strong>{count} 条记录</strong>
        <span>{summary}</span>
      </div>
      <button type="button" className="secondary-button" onClick={onFilter}>筛选</button>
    </section>
  );
}

function VisualizationFilterSheet({ title, filters, options, includeMonth = false, includeRating = false, includeGroup = false, onApply, onReset, onClose }: {
  title: string;
  filters: VisualizationFilters;
  options: VisualizationOptions;
  includeMonth?: boolean;
  includeRating?: boolean;
  includeGroup?: boolean;
  onApply: (filters: VisualizationFilters) => void;
  onReset: () => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState<FilterDraft>(() => draftFromFilters(filters));

  useEffect(() => {
    setDraft(draftFromFilters(filters));
  }, [filters]);

  function update(key: keyof FilterDraft, value: string) {
    setDraft((current) => ({ ...current, [key]: key === "groupBy" ? readGroupBy(value) : value }));
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onApply(filtersFromDraft(draft, includeMonth, includeRating, includeGroup));
  }

  return (
    <BottomSheet title={title} text="应用后会立即刷新当前图。勾选留空表示不限制。" onClose={onClose}>
      <form className="filter-sheet-form" onSubmit={submit}>
        <div className="form-grid">
          <label>年份<select value={draft.year} onChange={(event) => update("year", event.target.value)}>
            <option value="">全部年份</option>
            {options.years.map((year) => <option key={year} value={year}>{year}</option>)}
          </select></label>
          {includeMonth ? (
            <label>月份<select value={draft.month} onChange={(event) => update("month", event.target.value)}>
              <option value="">全部月份</option>
              {options.months.map((month) => <option key={month} value={month}>{month} 月</option>)}
            </select></label>
          ) : null}
        </div>
        <label>艺术家<select value={draft.artistName} onChange={(event) => update("artistName", event.target.value)}>
          <option value="">全部艺术家</option>
          {options.artistNames.map((name) => <option key={name} value={name}>{name}</option>)}
        </select></label>
        <label>专辑<select value={draft.albumName} onChange={(event) => update("albumName", event.target.value)}>
          <option value="">全部专辑</option>
          {options.albumNames.map((name) => <option key={name} value={name}>{name}</option>)}
        </select></label>
        <GenreFilterPicker value={draft.tag} onChange={(value) => update("tag", value)} />
        <label>情绪<select value={draft.mood} onChange={(event) => update("mood", event.target.value)}>
          <option value="">全部情绪</option>
          {options.moods.map((mood) => <option key={mood} value={mood}>{mood}</option>)}
        </select></label>
        {includeRating ? (
          <div className="form-grid">
            <label>最低评分<input type="number" min="0" max="10" value={draft.minRating} onChange={(event) => update("minRating", event.target.value)} /></label>
            <label>最高评分<input type="number" min="0" max="10" value={draft.maxRating} onChange={(event) => update("maxRating", event.target.value)} /></label>
          </div>
        ) : null}
        {includeGroup ? (
          <label>分组模式<select value={draft.groupBy} onChange={(event) => update("groupBy", event.target.value)}>
            {UNIVERSE_GROUP_BY_OPTIONS.map((groupBy) => <option key={groupBy} value={groupBy}>{GROUP_BY_LABELS[groupBy]}</option>)}
          </select></label>
        ) : null}
        <div className="sheet-actions">
          <button type="button" className="secondary-button" onClick={onReset}>重置</button>
          <button type="submit" className="primary-button">应用筛选</button>
        </div>
      </form>
    </BottomSheet>
  );
}

function GenreFilterPicker({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const [genreQuery, setGenreQuery] = useState("");
  const selection = value ? defaultGenreSelection(value) : { level1: "", level2: "", level3: "" };
  const level2Options = selection.level1 ? genreChildren(selection.level1) : [];
  const level3Options = selection.level2 ? genreChildren(selection.level2) : [];
  const searchResults = genreSearchMatches(genreQuery);
  const searchGroups = groupGenreSearchResults(searchResults, (label) => value === label);
  function selectSearchResult(label: string) {
    onChange(label);
    setGenreQuery("");
  }
  return (
    <section className="genre-filter-panel">
      <label>曲风搜索<input type="search" value={genreQuery} onChange={(event) => setGenreQuery(event.target.value)} placeholder="输入关键词快速筛选" /></label>
      {searchResults.length ? (
        <GenreSearchResultGroups groups={searchGroups} onSelect={selectSearchResult} />
      ) : genreQuery.trim() ? (
        <p className="genre-empty-hint">没有匹配曲风</p>
      ) : null}
      <label>曲风一级<select value={selection.level1} onChange={(event) => onChange(event.target.value)}>
        <option value="">全部曲风</option>
        {GENRE_TREE.map((genre) => <option key={genre.label} value={genre.label}>{genre.label}</option>)}
      </select></label>
      {selection.level1 ? (
        <label>曲风二级<select value={selection.level2} onChange={(event) => onChange(event.target.value || selection.level1)}>
          <option value="">全部 {selection.level1}</option>
          {level2Options.map((genre) => <option key={genre.label} value={genre.label}>{genre.label}</option>)}
        </select></label>
      ) : null}
      {selection.level2 && level3Options.length ? (
        <label>曲风三级<select value={selection.level3} onChange={(event) => onChange(event.target.value || selection.level2)}>
          <option value="">全部 {selection.level2}</option>
          {level3Options.map((genre) => <option key={genre.label} value={genre.label}>{genre.label}</option>)}
        </select></label>
      ) : null}
    </section>
  );
}

function VisualSongList({ songs, emptyText }: { songs: VisualizationSong[]; emptyText: string }) {
  if (!songs.length) return <Empty text={emptyText} />;
  return (
    <div className="visual-song-list">
      {songs.map((song) => (
        <Link key={song.id} to={`/entries/${song.id}`} className="visual-song-row">
          <div>
            <strong>{song.title}</strong>
            <span>{[song.artistName, song.albumName].filter(Boolean).join(" / ") || "未填写音乐信息"}</span>
            <p>{song.reviewExcerpt || "没有乐评摘要。"}</p>
            <TagList values={[...song.moods, ...song.tags]} />
          </div>
          <em>{song.rating ? `${song.rating}/10` : "未评分"}</em>
        </Link>
      ))}
    </div>
  );
}

function VisualSongDetail({ song }: { song: VisualizationSong }) {
  return (
    <section className="visual-song-detail">
      <Meta label="歌曲" value={song.songName ?? song.title} />
      <Meta label="艺术家" value={song.artistName} />
      <Meta label="专辑" value={song.albumName} />
      <Meta label="年份" value={`${song.year}`} />
      <Meta label="评分" value={song.rating ? `${song.rating}/10` : null} />
      <Meta label="情绪" value={song.moods.join("、") || null} />
      <Meta label="标签" value={song.tags.join("、") || null} />
      <p>{song.reviewExcerpt || "没有乐评摘要。"}</p>
      <Link className="primary-button full" to={`/entries/${song.id}`}>查看详情</Link>
    </section>
  );
}

function TagList({ values }: { values: string[] }) {
  const list = Array.from(new Set(values)).slice(0, 8);
  if (!list.length) return null;
  return <div className="tag-row">{list.map((value) => <span key={value}>{value}</span>)}</div>;
}

function BottomSheet({ title, text, children, onClose, returnFocusRef }: { title: string; text?: string; children: React.ReactNode; onClose: () => void; returnFocusRef?: React.RefObject<HTMLElement | null> }) {
  const titleId = useId();
  const dialogRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const background = [".app-header", ".app-main", ".bottom-nav"]
      .map((selector) => document.querySelector<HTMLElement>(selector))
      .filter((element): element is HTMLElement => Boolean(element));
    background.forEach((element) => { element.inert = true; });
    const focusable = () => Array.from(dialog.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'));
    focusable()[0]?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== "Tab") return;
      const items = focusable();
      if (!items.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      background.forEach((element) => { element.inert = false; });
      returnFocusRef?.current?.focus();
    };
  }, [onClose, returnFocusRef]);

  return (
    <div className="sheet-backdrop" role="presentation" onClick={onClose}>
      <section ref={dialogRef} className="bottom-sheet" role="dialog" aria-modal="true" aria-labelledby={titleId} onClick={(event) => event.stopPropagation()}>
        <div className="sheet-handle" />
        <div className="sheet-head">
          <div>
            <h2 id={titleId}>{title}</h2>
            {text ? <p>{text}</p> : null}
          </div>
          <button type="button" onClick={onClose} aria-label="关闭">×</button>
        </div>
        {children}
      </section>
    </div>
  );
}

function VisualLoading({ text }: { text: string }) {
  return <div className="visual-state loading"><span />{text}</div>;
}

function VisualError({ text }: { text: string }) {
  return <div className="visual-state error-state">{text}</div>;
}

function VisualEmpty({ text }: { text: string }) {
  return <div className="visual-state empty-state">{text}</div>;
}

function draftFromFilters(filters: VisualizationFilters): FilterDraft {
  return {
    year: filters.year ? String(filters.year) : "",
    month: filters.month ? String(filters.month) : "",
    artistName: filters.artistName ?? "",
    albumName: filters.albumName ?? "",
    mood: filters.mood ?? "",
    tag: filters.tag ?? "",
    minRating: filters.minRating !== undefined && filters.minRating !== null ? String(filters.minRating) : "",
    maxRating: filters.maxRating !== undefined && filters.maxRating !== null ? String(filters.maxRating) : "",
    groupBy: filters.groupBy ?? "year",
  };
}

function filtersFromDraft(draft: FilterDraft, includeMonth: boolean, includeRating: boolean, includeGroup: boolean): VisualizationFilters {
  return {
    year: numberField(draft.year),
    month: includeMonth ? numberField(draft.month) : null,
    artistName: draft.artistName || null,
    albumName: draft.albumName || null,
    mood: draft.mood || null,
    tag: draft.tag || null,
    minRating: includeRating ? numberField(draft.minRating) : null,
    maxRating: includeRating ? numberField(draft.maxRating) : null,
    groupBy: includeGroup ? draft.groupBy : undefined,
  };
}

function numberField(value: string) {
  if (!value.trim()) return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function exportFileName(kind: ExportKind) {
  const date = new Date();
  const pad = (value: number) => String(value).padStart(2, "0");
  const stamp = `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
  return `xiaodongge-${stamp}.${EXPORT_FILE_META[kind].extension}`;
}

function downloadExportFile(file: File) {
  const url = URL.createObjectURL(file);
  const link = document.createElement("a");
  link.href = url;
  link.download = file.name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function readGroupBy(value: string): UniverseGroupBy {
  return UNIVERSE_GROUP_BY_OPTIONS.includes(value as UniverseGroupBy) ? value as UniverseGroupBy : "year";
}

function filterSummary(filters: VisualizationFilters, includeMonth: boolean, includeRating: boolean) {
  const parts = [
    filters.year ? `${filters.year} 年` : "",
    includeMonth && filters.month ? `${filters.month} 月` : "",
    filters.artistName ?? "",
    filters.albumName ?? "",
    filters.tag ?? "",
    filters.mood ?? "",
    includeRating && filters.minRating !== undefined && filters.minRating !== null ? `≥ ${filters.minRating} 分` : "",
    includeRating && filters.maxRating !== undefined && filters.maxRating !== null ? `≤ ${filters.maxRating} 分` : "",
  ].filter(Boolean);
  return parts.length ? parts.join(" / ") : "全部记录";
}

function Page({ title, text, children }: { title: string; text?: string; children: React.ReactNode }) {
  return <section className="page"><h1>{title}</h1>{text ? <p className="lead">{text}</p> : null}{children}</section>;
}

function SectionTitle({ title }: { title: string }) {
  return <h2 className="section-title">{title}</h2>;
}

function EntryList({ entries, emptyText = "暂无记录。" }: { entries: ReviewEntry[]; emptyText?: string }) {
  if (!entries.length) return <Empty text={emptyText} />;
  return <div className="card-list">{entries.map((entry) => <Link key={entry.id} to={`/entries/${entry.id}`} className="entry-card"><span>{ENTRY_TYPE_LABELS[entry.type]} / {entry.year} / {monthLabel(entry.month)}</span><h2>{entry.title}</h2><p>{[entry.songName, entry.albumName, entry.artistName].filter(Boolean).join(" / ") || "未关联音乐信息"}</p><p>{excerpt(entry.content)}</p></Link>)}</div>;
}

function CoverArt({ src, label, large = false }: { src: string | null; label: string; large?: boolean }) {
  const className = `cover-art${large ? " large" : ""}`;
  if (src) return <img className={className} src={src} alt={`${label}封面`} />;
  return <div className={`${className} cover-placeholder`} aria-label={`${label}暂无封面`}><span>{label.trim().slice(0, 1) || "音"}</span></div>;
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return <div className="stat-card"><span>{label}</span><strong>{value}</strong></div>;
}

function Empty({ text }: { text: string }) {
  return <p className="empty">{text}</p>;
}

function Meta({ label, value }: { label: string; value: string | null }) {
  return <div className="meta"><span>{label}</span><strong>{value ?? "未填写"}</strong></div>;
}

function PrivacyPage() {
  return (
    <Page title="隐私说明" text="当前播放、天气背景与本地听感分析的数据使用方式。">
      <article className="content-card privacy-copy">
        <h2>本地保存</h2>
        <p>音乐记录、正文、标签、情绪、评分、封面、草稿和听感总结保存在本机。除下述明确说明的音乐目录与天气请求外，小懂哥不会主动上传这些内容。</p>
        <h2>通知使用权</h2>
        <p>Android 通知使用权仅用于访问系统媒体会话中的当前播放信息。应用不保存其他应用的通知正文，也不读取暂停的媒体会话。</p>
        <h2>联网补全</h2>
        <p>当当前播放同时包含歌曲名和歌手时，应用会把歌曲名、歌手和已有专辑发送给 Apple iTunes Search API，用于补全专辑、发行日期、流派、时长和曲目序号等音乐元数据。</p>
        <h2>不会发送的数据</h2>
        <p>日记正文、标签、情绪、评分、播放历史、其他通知、歌词和音频不会发送给 Apple。目录查询失败时，应用只保留本机读取到的信息，仍可正常记录。</p>
        <h2>听感分析与日历</h2>
        <p>情绪、音乐对象、表达方式和曲风分析在本机完成。应用不会读取系统日历、会议、生日或提醒；工作日、周末、调休和节假日来自应用内置的中国大陆官方年度数据。</p>
        <h2>天气背景</h2>
        <p>只有用户手动选择城市后，应用才会把粗略城市坐标和乐评日期发送给 Open-Meteo 查询历史天气。应用不持续定位，不读取 vivo 或其他手机的系统天气，也不会在天气请求中发送乐评正文。</p>
        <h2>导出与删除</h2>
        <p>用户可以通过备份页导出或恢复本地数据，也可以在记录详情页删除记录。Android 系统云备份已关闭，卸载应用前请先手动导出 JSON。</p>
      </article>
    </Page>
  );
}

function MusicMetadataDetails({ metadata, title, open = false }: { metadata: MusicMetadata; title: string; open?: boolean }) {
  const rows = musicMetadataRows(metadata);
  if (!rows.length) return null;
  return (
    <details className="metadata-details" open={open}>
      <summary>{title}</summary>
      <div className="detail-card">
        {rows.map(([label, value]) => <Meta key={label} label={label} value={value} />)}
      </div>
    </details>
  );
}

function musicMetadataRows(metadata: MusicMetadata): Array<[string, string]> {
  const rows: Array<[string, string | null | undefined]> = [
    ["专辑艺人", metadata.albumArtistName],
    ["目录发行日期", metadata.releaseDate],
    ["发行年份", metadata.releaseYear === undefined ? null : String(metadata.releaseYear)],
    ["流派", metadata.genre],
    ["作曲", metadata.composerName],
    ["词作者", metadata.writerName],
    ["作者", metadata.authorName],
    ["合辑信息", metadata.compilation],
    ["时长", metadata.durationMs === undefined ? null : formatDuration(metadata.durationMs)],
    ["曲目序号", formatPosition(metadata.trackNumber, metadata.trackCount)],
    ["碟片序号", formatPosition(metadata.discNumber, metadata.discCount)],
    ["内容标记", explicitnessLabel(metadata.explicitness)],
    ["展示标题", metadata.displayTitle],
    ["展示副标题", metadata.displaySubtitle],
    ["展示描述", metadata.displayDescription],
    ["来源应用", metadata.sourcePackage],
    ["媒体 ID", metadata.mediaId],
    ["媒体 URI", metadata.mediaUri],
    ["封面 URI", metadata.artworkUri],
    ["目录来源", metadata.catalogSource === "apple" ? "Apple 音乐目录" : null],
    ["Apple 歌曲 ID", metadata.catalogTrackId],
    ["Apple 专辑 ID", metadata.catalogAlbumId],
    ["Apple 艺术家 ID", metadata.catalogArtistId],
    ["补全时间", metadata.enrichedAt ? formatDate(metadata.enrichedAt) : null],
  ];
  return rows.filter((row): row is [string, string] => !!row[1]);
}

function formatDuration(durationMs: number) {
  const totalSeconds = Math.floor(durationMs / 1000);
  const seconds = String(totalSeconds % 60).padStart(2, "0");
  const minutes = Math.floor(totalSeconds / 60) % 60;
  const hours = Math.floor(totalSeconds / 3600);
  return hours ? `${hours}:${String(minutes).padStart(2, "0")}:${seconds}` : `${minutes}:${seconds}`;
}

function formatPosition(position?: number, count?: number) {
  if (position === undefined && count === undefined) return null;
  if (position === undefined) return `共 ${count} 项`;
  return count === undefined ? String(position) : `${position} / ${count}`;
}

function explicitnessLabel(value?: MusicMetadata["explicitness"]) {
  if (value === "explicit") return "明确内容";
  if (value === "cleaned") return "洁净版";
  if (value === "notExplicit") return "非明确内容";
  return null;
}

function inputToCoverTarget(input: EntryInput) {
  if (input.songName) return { kind: "song" as const, target: { albumName: input.albumName, songName: input.songName, artistName: input.artistName } };
  if (input.albumName) return { kind: "album" as const, target: { albumName: input.albumName, artistName: input.artistName } };
  return null;
}

function readDraftFields(form: HTMLFormElement): EntryDraftFields {
  const data = new FormData(form);
  const value = (key: string) => String(data.get(key) ?? "");
  return {
    type: value("type") as EntryDraftFields["type"],
    title: value("title"),
    year: value("year"),
    month: value("month"),
    albumName: value("albumName"),
    songName: value("songName"),
    artistName: value("artistName"),
    listenedAt: value("listenedAt"),
    firstListenedAt: value("firstListenedAt"),
    tags: value("tags"),
    rating: value("rating"),
    ratingModifier: value("ratingModifier"),
    ratingProduction: value("ratingProduction"),
    ratingSongwriting: value("ratingSongwriting"),
    ratingOriginality: value("ratingOriginality"),
    ratingResonance: value("ratingResonance"),
    content: value("content"),
  };
}

function applyDraftFields(form: HTMLFormElement, fields: EntryDraftFields) {
  for (const [name, value] of Object.entries(fields)) setRecognizedField(form, name, value, false);
}

function formatDraftTime(value: string) {
  return new Date(value).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit", hour12: false });
}

function fillRecognizedFields(form: HTMLFormElement | null, fields: MusicInfoFields, onlyEmpty = false) {
  if (!form) return 0;
  let changed = 0;
  changed += setRecognizedField(form, "type", fields.type, onlyEmpty);
  changed += setRecognizedField(form, "songName", fields.songName, onlyEmpty);
  changed += setRecognizedField(form, "albumName", fields.albumName, onlyEmpty);
  changed += setRecognizedField(form, "artistName", fields.artistName, onlyEmpty);
  changed += setRecognizedField(form, "title", fields.title ?? fields.songName ?? fields.albumName, onlyEmpty);
  changed += setRecognizedField(form, "content", fields.content, onlyEmpty);
  return changed;
}

async function copyText(text: string) {
  // ponytail: Capacitor WebView 的 Clipboard API 可能被权限策略拒绝，保留同步 DOM 回退。
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return;
    }
  } catch { /* fall through */ }
  const input = document.createElement("textarea");
  input.value = text;
  input.style.position = "fixed";
  input.style.left = "-9999px";
  document.body.appendChild(input);
  input.select();
  const copied = document.execCommand("copy");
  input.remove();
  if (!copied) throw new Error("复制失败");
}

function prefersAlbumEntry(form: HTMLFormElement | null, mode: "create" | "edit") {
  const type = form ? formValue(form, "type") : "";
  return mode === "create" && (!type || type === "album");
}

function musicIdentityCompatible(form: HTMLFormElement | null, fields: MusicInfoFields) {
  if (!form) return false;
  for (const [name, value] of [["songName", fields.songName], ["artistName", fields.artistName]] as const) {
    const existing = formValue(form, name);
    if (existing && (!value || normalizeIdentity(existing) !== normalizeIdentity(value))) return false;
  }
  const existingAlbum = formValue(form, "albumName");
  if (existingAlbum && fields.albumName && normalizeIdentity(existingAlbum) !== normalizeIdentity(fields.albumName)) return false;
  return true;
}

function musicIdentityWouldChange(form: HTMLFormElement | null, fields: MusicInfoFields) {
  if (!form) return false;
  return (["songName", "artistName", "albumName"] as const).some((name) => {
    const value = fields[name];
    return value !== undefined && normalizeIdentity(formValue(form, name)) !== normalizeIdentity(value ?? "");
  });
}

function formValue(form: HTMLFormElement, name: string) {
  const field = form.elements.namedItem(name);
  return field instanceof HTMLInputElement || field instanceof HTMLSelectElement || field instanceof HTMLTextAreaElement
    ? field.value.trim()
    : "";
}

function normalizeIdentity(value: string) {
  return value.normalize("NFKC").toLocaleLowerCase().replace(/\s+/g, " ").trim();
}

function setRecognizedField(form: HTMLFormElement, name: string, value: string | null | undefined, onlyEmpty: boolean) {
  if (value === undefined) return 0;
  const field = form.elements.namedItem(name);
  if (!(field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement || field instanceof HTMLSelectElement)) return 0;
  if (onlyEmpty && field.value.trim()) return 0;
  const nextValue = value ?? "";
  if (field.value === nextValue) return 0;
  field.value = nextValue;
  return 1;
}

function recognitionNotice(fields: MusicInfoFields) {
  const artist = fields.artistName ? ` / ${fields.artistName}` : "";
  if (fields.type === "album" && fields.albumName) return `识别为专辑：${fields.albumName}${artist}`;
  if (fields.songName) return `识别为歌曲：${fields.songName}${artist}`;
  return "已识别文字，请保存前检查";
}

function readText(form: FormData, key: string) {
  return String(form.get(key) ?? "").trim();
}

function readNullable(form: FormData, key: string) {
  const value = readText(form, key);
  return value || null;
}

function readNumber(form: FormData, key: string) {
  const value = readText(form, key);
  return value ? Number(value) : null;
}

function readDate(form: FormData, key: string) {
  const value = readText(form, key);
  // ponytail: <input type="date"> 返回 YYYY-MM-DD，用本地时间构造避免 UTC 偏移
  return value ? new Date(value + "T00:00:00").toISOString() : null;
}

async function fileToCoverDataUrl(file: File) {
  if (file.type && !file.type.startsWith("image/")) throw new Error("请选择图片文件");
  const url = URL.createObjectURL(file);
  try {
    const image = await loadImage(url);
    if (!image.naturalWidth || !image.naturalHeight) throw new Error("图片读取失败");
    const size = 512;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("图片处理失败");
    context.fillStyle = "#0f766e";
    context.fillRect(0, 0, size, size);
    const scale = Math.max(size / image.naturalWidth, size / image.naturalHeight);
    const width = image.naturalWidth * scale;
    const height = image.naturalHeight * scale;
    // ponytail: one centered square crop keeps covers simple; add manual crop only if you need precise framing.
    context.drawImage(image, (size - width) / 2, (size - height) / 2, width, height);
    return canvas.toDataURL("image/jpeg", 0.86);
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function fileToDataUrl(file: File) {
  if (file.type && !file.type.startsWith("image/")) throw new Error("请选择图片文件");
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => typeof reader.result === "string" ? resolve(reader.result) : reject(new Error("图片读取失败"));
    reader.onerror = () => reject(new Error("图片读取失败"));
    reader.readAsDataURL(file);
  });
}

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("图片读取失败"));
    image.src = src;
  });
}
