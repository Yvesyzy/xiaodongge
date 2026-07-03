import { ChangeEvent, FormEvent, lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Capacitor, registerPlugin } from "@capacitor/core";
import { Link, NavLink, Route, Routes, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { GENRE_TAGS, GENRE_TREE, findGenrePath, genreChildren, isKnownGenreTag } from "../../shared/genres";
import { ABSTRACT_MAP_REGION_DEFS, UNCLASSIFIED_REGION_ID, UNIVERSE_GROUP_BY_OPTIONS, type AbstractMapRegion, type AbstractMapResult, type EmotionUniverseResult, type EmotionUniverseSong, type UniverseGroupBy, type VisualizationFilters, type VisualizationOptions, type VisualizationSong } from "../../shared/visualizations";
import { findSimilarEntry } from "./entryDuplicate";
import { excerpt, formatDate, formatDateOnly, monthLabel } from "./format";
import { parseMusicInfoText, type MusicInfoFields } from "./ocr";
import { parseList, store } from "./store";
import { ENTRY_TYPE_LABELS, ENTRY_TYPES, type AlbumAggregate, type EntryInput, type ReviewEntry, type SongAggregate, type YearStats, type YearlySummary } from "./types";

const nav = [
  ["/", "首页"],
  ["/timeline", "时间轴"],
  ["/new", "新建"],
  ["/search", "搜索"],
  ["/summary", "总结"],
];

type BackupPreview = { exportedAt: string; entryCount: number; summaryCount: number; coverCount: number };
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
const MOOD_GROUPS = ABSTRACT_MAP_REGION_DEFS.filter((region) => region.id !== UNCLASSIFIED_REGION_ID && region.moods.length);
const EmotionUniverseScene = lazy(() => import("./EmotionUniverseScene"));

const ScreenshotOcr = registerPlugin<ScreenshotOcrPlugin>("ScreenshotOcr");

export default function App() {
  return (
    <div className="app-shell">
      <header className="app-header">
        <Link to="/" className="brand">小懂哥 v2</Link>
        <Link to="/more" className="header-menu" aria-label="更多"><span /></Link>
      </header>
      <main className="app-main">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/timeline" element={<TimelinePage />} />
          <Route path="/new" element={<EntryFormPage mode="create" />} />
          <Route path="/entries/:id" element={<EntryDetailPage />} />
          <Route path="/entries/:id/edit" element={<EntryFormPage mode="edit" />} />
          <Route path="/albums" element={<AlbumsPage />} />
          <Route path="/albums/detail" element={<AggregateDetail kind="album" />} />
          <Route path="/songs" element={<SongsPage />} />
          <Route path="/songs/detail" element={<AggregateDetail kind="song" />} />
          <Route path="/search" element={<SearchPage />} />
          <Route path="/summary" element={<YearlySummaryPage />} />
          <Route path="/abstract-map" element={<AbstractMusicMapPage />} />
          <Route path="/emotion-universe" element={<EmotionUniversePage />} />
          <Route path="/backup" element={<BackupPage />} />
          <Route path="/more" element={<MorePage />} />
        </Routes>
      </main>
      <nav className="bottom-nav">
        {nav.map(([to, label]) => (
          <NavLink key={to} to={to} className={({ isActive }) => (isActive ? "active" : "")} end={to === "/"}>
            {label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}

function HomePage() {
  const [entries, setEntries] = useState<HomeEntry[]>([]);
  const [stats, setStats] = useState<YearStats | null>(null);
  const currentYear = new Date().getFullYear();

  useEffect(() => {
    let active = true;
    Promise.all([store.recentEntries(5), store.getYearStats(currentYear)]).then(async ([recent, yearStats]) => {
      const recentWithCovers = await Promise.all(recent.map(loadHomeCover));
      if (!active) return;
      setEntries(recentWithCovers);
      setStats(yearStats);
    });
    return () => {
      active = false;
    };
  }, [currentYear]);

  return (
    <section className="home-page">
      <section className="home-hero">
        <div className="home-hero-copy">
          <h1>私人音乐档案</h1>
          <p>记录每一次听歌的心情与感受</p>
          <Link to="/new" className="home-new-button"><span aria-hidden="true">+</span>新建记录</Link>
        </div>
        <div className="hero-record" aria-hidden="true"><span>FOR ME<br />NOT FOR ALL</span></div>
      </section>
      <div className="home-stats">
        <Stat label="今年记录" value={`${stats?.totalEntries ?? 0} 条`} />
        <Stat label="今年专辑" value={`${stats?.albumCount ?? 0} 张`} />
        <Stat label="今年歌曲" value={`${stats?.songCount ?? 0} 首`} />
      </div>
      <div className="home-section-title">
        <h2>可视化记忆</h2>
      </div>
      <div className="home-visual-links">
        <Link to="/abstract-map" className="visual-entry-card map">
          <span>抽象地图</span>
          <h2>我的听歌地图</h2>
          <p>把情绪、标签和乐评放进几片听歌大陆。</p>
        </Link>
        <Link to="/emotion-universe" className="visual-entry-card universe">
          <span>情绪宇宙</span>
          <h2>我的情绪宇宙</h2>
          <p>用 3D 星图回看每首歌在记忆里的位置。</p>
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
  const formRef = useRef<HTMLFormElement | null>(null);
  const [entry, setEntry] = useState<ReviewEntry | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(mode === "edit");
  const [saving, setSaving] = useState(false);
  const [coverDataUrl, setCoverDataUrl] = useState<string | null>(null);
  const [coverChanged, setCoverChanged] = useState(false);
  const [ocrText, setOcrText] = useState("");
  const [recognizedFields, setRecognizedFields] = useState<MusicInfoFields | null>(null);
  const [ocrBusy, setOcrBusy] = useState(false);
  const [selectedMoodGroupId, setSelectedMoodGroupId] = useState<string>(() => defaultMoodGroupId([]));
  const [selectedMoods, setSelectedMoods] = useState<string[]>([]);
  const [genreSelection, setGenreSelection] = useState<GenreSelection>(() => defaultGenreSelection(null));
  const [selectedGenreTags, setSelectedGenreTags] = useState<string[]>([]);

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
    void loadEntryCover(entry).then((nextCover) => {
      if (!active) return;
      setCoverDataUrl(nextCover);
      setCoverChanged(false);
    }).catch((err) => {
      if (active) setError(err instanceof Error ? err.message : "封面读取失败");
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
    const changed = fillRecognizedFields(formRef.current, recognizedFields);
    setNotice(changed ? `${recognitionNotice(recognizedFields)}，已应用到表单` : "识别结果没有可应用的字段");
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
        content: readText(form, "content"),
        tags: mergeTagLists(parseList(readText(form, "genreTags")), parseList(readText(form, "tags"))),
        moods: parseList(readText(form, "moods")),
        rating: readNumber(form, "rating"),
        listenedAt: readDate(form, "listenedAt"),
      };
      const coverTarget = coverChanged && coverDataUrl ? inputToCoverTarget(input) : null;
      if (coverChanged && coverDataUrl && !coverTarget) throw new Error("请先填写歌曲或专辑，再保存封面");
      const similar = findSimilarEntry(await store.listEntries(), input, mode === "edit" ? id : undefined);
      if (similar && !confirm(`可能已经有相似记录：${similar.title}（${similar.year} / ${monthLabel(similar.month)}）。仍然保存吗？`)) {
        setNotice("已取消保存，现有记录未改变");
        return;
      }
      const saved = mode === "create" ? await store.createEntry(input) : await store.updateEntry(id as string, input);
      if (coverTarget) {
        try {
          await store.setCover(coverTarget.kind, coverTarget.target, coverDataUrl as string);
        } catch (coverErr) {
          alert(`记录已保存，但封面保存失败：${coverErr instanceof Error ? coverErr.message : "未知错误"}`);
        }
      }
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

  return (
    <Page title={mode === "create" ? "新建记录" : "编辑记录"} text="未填写的信息会保持为空，不会自动补全。">
      <form ref={formRef} onSubmit={submit} className="form-card">
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
        <label>记录类型<select name="type" defaultValue={source?.type ?? "song"}>{ENTRY_TYPES.map((type) => <option key={type} value={type}>{ENTRY_TYPE_LABELS[type]} / {type}</option>)}</select></label>
        <label>标题<input name="title" defaultValue={source?.title ?? ""} required /></label>
        <div className="form-grid">
          <label>年份<input name="year" type="number" min="1" max="9999" defaultValue={source?.year ?? new Date().getFullYear()} required /></label>
          <label>月份<input name="month" type="number" min="1" max="12" defaultValue={source?.month ?? ""} /></label>
        </div>
        <label>专辑<input name="albumName" defaultValue={source?.albumName ?? ""} /></label>
        <label>歌曲<input name="songName" defaultValue={source?.songName ?? ""} /></label>
        <label>艺术家<input name="artistName" defaultValue={source?.artistName ?? ""} /></label>
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
        <label>听歌或感受日期<input name="listenedAt" type="date" defaultValue={source?.listenedAt?.slice(0, 10) ?? ""} /></label>
        <GenrePicker
          selection={genreSelection}
          selectedTags={selectedGenreTags}
          onSelectionChange={setGenreSelection}
          onToggleTag={toggleGenre}
        />
        <label>标签<input name="tags" defaultValue={source ? freeTags(source.tags).join(", ") : ""} /></label>
        <MoodPicker
          groupId={selectedMoodGroupId}
          selectedMoods={selectedMoods}
          onGroupChange={setSelectedMoodGroupId}
          onToggleMood={toggleMood}
        />
        <label>评分<input name="rating" type="number" min="1" max="10" defaultValue={source?.rating ?? ""} /></label>
        <label>正文<textarea name="content" rows={12} defaultValue={source?.content ?? ""} required /></label>
        {notice ? <p className="hint">{notice}</p> : null}
        {error ? <p className="error">{error}</p> : null}
        <button className="primary-button" type="submit" disabled={saving}>{saving ? "保存中" : "保存"}</button>
      </form>
    </Page>
  );
}

function GenrePicker({ selection, selectedTags, onSelectionChange, onToggleTag }: {
  selection: GenreSelection;
  selectedTags: string[];
  onSelectionChange: (selection: GenreSelection) => void;
  onToggleTag: (tag: string) => void;
}) {
  const [genreQuery, setGenreQuery] = useState("");
  const selectedTagSet = new Set(selectedTags);
  const level2Options = genreChildren(selection.level1);
  const level3Options = selection.level2 ? genreChildren(selection.level2) : [];
  const currentTag = selectedGenreValue(selection);
  const searchResults = genreSearchMatches(genreQuery);
  const searchGroups = groupGenreSearchResults(searchResults, (label) => selectedTagSet.has(label));
  function selectSearchResult(label: string) {
    onSelectionChange(defaultGenreSelection(label));
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
      <div className="genre-select-grid">
        <label>一级<select value={selection.level1} onChange={(event) => onSelectionChange({ level1: event.target.value, level2: "", level3: "" })}>
          {GENRE_TREE.map((genre) => <option key={genre.label} value={genre.label}>{genre.label}</option>)}
        </select></label>
        <label>二级<select value={selection.level2} onChange={(event) => onSelectionChange({ ...selection, level2: event.target.value, level3: "" })}>
          <option value="">选择二级</option>
          {level2Options.map((genre) => <option key={genre.label} value={genre.label}>{genre.label}</option>)}
        </select></label>
        {level3Options.length ? (
          <label>三级<select value={selection.level3} onChange={(event) => onSelectionChange({ ...selection, level3: event.target.value })}>
            <option value="">选择三级</option>
            {level3Options.map((genre) => <option key={genre.label} value={genre.label}>{genre.label}</option>)}
          </select></label>
        ) : null}
      </div>
      <button className="secondary-button" type="button" onClick={() => onToggleTag(currentTag)}>{selectedTagSet.has(currentTag) ? "移除曲风" : "添加曲风"}</button>
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
  const [entry, setEntry] = useState<ReviewEntry | null>(null);
  const [coverDataUrl, setCoverDataUrl] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    if (!id) {
      setEntry(null);
      setCoverDataUrl(null);
      return () => {
        active = false;
      };
    }

    void (async () => {
      const nextEntry = await store.getEntry(id);
      const nextCover = nextEntry ? await loadEntryCover(nextEntry) : null;
      if (!active) return;
      setEntry(nextEntry);
      setCoverDataUrl(nextCover);
    })().catch(() => {
      if (!active) return;
      setEntry(null);
      setCoverDataUrl(null);
    });

    return () => {
      active = false;
    };
  }, [id]);
  if (!entry) return <Page title="记录不存在"><Empty text="没有找到这条记录。" /></Page>;

  const musicLine = [entry.songName, entry.albumName, entry.artistName].filter(Boolean).join(" / ");
  const coverLabel = entry.albumName ?? entry.songName ?? entry.title;

  async function remove() {
    const current = entry;
    if (!current) return;
    if (!confirm("确认删除这条记录？")) return;
    await store.deleteEntry(current.id);
    navigate("/timeline");
  }

  return (
    <Page title={entry.title} text={`${ENTRY_TYPE_LABELS[entry.type]} / ${entry.year} / ${monthLabel(entry.month)}`}>
      <div className="detail-hero">
        <CoverArt src={coverDataUrl} label={coverLabel} large />
        <div className="detail-hero-copy">
          <span>{musicLine || entry.title}</span>
          {entry.rating ? <strong>{entry.rating}/10</strong> : null}
          <small>{formatDateOnly(entry.listenedAt)}</small>
        </div>
      </div>
      <div className="action-row">
        <Link className="secondary-button" to={`/entries/${entry.id}/edit`}>编辑</Link>
        <button className="danger-button" onClick={remove}>删除</button>
      </div>
      <div className="detail-card">
        <Meta label="专辑" value={entry.albumName} />
        <Meta label="歌曲" value={entry.songName} />
        <Meta label="艺术家" value={entry.artistName} />
        <Meta label="标签" value={entry.tags.join("、") || null} />
        <Meta label="情绪" value={entry.moods.join("、") || null} />
        <Meta label="评分" value={entry.rating ? `${entry.rating}/10` : null} />
        <Meta label="听歌或感受日期" value={formatDateOnly(entry.listenedAt)} />
        <Meta label="创建时间" value={formatDate(entry.createdAt)} />
        <Meta label="更新时间" value={formatDate(entry.updatedAt)} />
      </div>
      <article className="content-card">{entry.content}</article>
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
      <EntryList entries={entries} />
    </Page>
  );
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

function EmotionUniversePage() {
  const [filters, setFilters] = useState<VisualizationFilters>({ groupBy: "year" });
  const [result, setResult] = useState<EmotionUniverseResult | null>(null);
  const [selectedSong, setSelectedSong] = useState<EmotionUniverseSong | null>(null);
  const [filterOpen, setFilterOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [cameraDistance, setCameraDistance] = useState(118);
  const [sceneResetKey, setSceneResetKey] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    void store.emotionUniverse(filters).then((nextResult) => {
      if (!active) return;
      setResult(nextResult);
      setSelectedSong(null);
    }).catch((err) => {
      if (active) setError(err instanceof Error ? err.message : "情绪宇宙读取失败");
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [filters]);

  function zoom(delta: number) {
    setCameraDistance((current) => Math.max(66, Math.min(178, current + delta)));
  }

  function resetScene() {
    setCameraDistance(118);
    setSceneResetKey((current) => current + 1);
  }

  return (
    <VisualPage title="情绪宇宙" text="每首歌是一颗 3D 星球，位置来自时间、评分和分组深度。">
      <VisualToolbar
        count={result?.totalCount ?? 0}
        summary={filterSummary(filters, false, true)}
        onFilter={() => setFilterOpen(true)}
      />
      {loading ? <VisualLoading text="正在排布 3D 星图。" /> : null}
      {error ? <VisualError text={error} /> : null}
      {!loading && !error && result && !result.totalCount ? <VisualEmpty text="当前筛选下没有星球。重置筛选后再看一次。" /> : null}
      {!loading && !error && result && result.songs.length ? (
        <>
          <section className="universe-panel">
            <div className="universe-panel-head">
              <div>
                <strong>{GROUP_BY_LABELS[filters.groupBy ?? "year"]}</strong>
                <span>{result.displayedCount} / {result.totalCount} 首</span>
              </div>
              <div className="zoom-controls" aria-label="缩放控制">
                <button type="button" onClick={() => zoom(12)} aria-label="缩小">-</button>
                <button type="button" onClick={resetScene} aria-label="重置视图">1x</button>
                <button type="button" onClick={() => zoom(-12)} aria-label="放大">+</button>
              </div>
            </div>
            {result.truncated ? <p className="visual-limit-note">当前展示前 {result.displayedCount} 首，继续缩小筛选可查看更聚焦的星图。</p> : null}
            <Suspense fallback={<div className="universe-stage universe-stage-loading">正在加载 3D 星图。</div>}>
              <EmotionUniverseScene songs={result.songs} cameraDistance={cameraDistance} resetKey={sceneResetKey} onSelect={setSelectedSong} />
            </Suspense>
          </section>
          <div className="group-chip-row">
            {result.groups.slice(0, 8).map((group) => <span key={`${group.type}-${group.name}`}>{group.name} · {group.songCount}</span>)}
          </div>
        </>
      ) : null}
      {filterOpen ? (
        <VisualizationFilterSheet
          title="筛选情绪宇宙"
          filters={filters}
          options={result?.options ?? EMPTY_VISUALIZATION_OPTIONS}
          includeRating
          includeGroup
          onApply={(nextFilters) => {
            setFilters({ ...nextFilters, groupBy: nextFilters.groupBy ?? "year" });
            setFilterOpen(false);
          }}
          onReset={() => {
            setFilters({ groupBy: "year" });
            setFilterOpen(false);
          }}
          onClose={() => setFilterOpen(false)}
        />
      ) : null}
      {selectedSong ? (
        <BottomSheet title={selectedSong.title} text={selectedSong.artistName ?? "未填写艺术家"} onClose={() => setSelectedSong(null)}>
          <VisualSongDetail song={selectedSong} />
        </BottomSheet>
      ) : null}
    </VisualPage>
  );
}

function YearlySummaryPage() {
  const [entries, setEntries] = useState<ReviewEntry[]>([]);
  const [year, setYear] = useState(new Date().getFullYear());
  const [stats, setStats] = useState<YearStats | null>(null);
  const [summary, setSummary] = useState<YearlySummary | null>(null);
  const [message, setMessage] = useState("");
  const years = Array.from(new Set([new Date().getFullYear(), ...entries.map((entry) => entry.year)])).sort((a, b) => b - a);
  const summaryIsStale = summary !== null && stats !== null && summary.sourceEntryCount !== stats.totalEntries;
  useEffect(() => void store.listEntries().then(setEntries), []);
  useEffect(() => void Promise.all([store.getYearStats(year), store.getSummary(year)]).then(([nextStats, saved]) => { setStats(nextStats); setSummary(saved); }), [year]);
  async function generate() {
    setMessage("");
    try {
      const saved = await store.generateSummary(year);
      setSummary(saved);
      setMessage("年度总结已保存");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "生成失败");
    }
  }
  return (
    <Page title="年度总结" text="只基于手机本地已有记录生成。">
      <select value={year} onChange={(event) => setYear(Number(event.target.value))}>{years.map((item) => <option key={item} value={item}>{item}</option>)}</select>
      <div className="stats-grid">
        <Stat label="总记录" value={stats?.totalEntries ?? 0} />
        <Stat label="月份" value={stats?.monthCount ?? 0} />
        <Stat label="专辑" value={stats?.albumCount ?? 0} />
        <Stat label="歌曲" value={stats?.songCount ?? 0} />
      </div>
      <button onClick={generate} className="primary-button full">生成年度总结</button>
      {message ? <p className="hint">{message}</p> : null}
      {summaryIsStale ? <p className="error">当前记录数为 {stats.totalEntries} 条，保存总结基于 {summary.sourceEntryCount} 条记录生成，建议重新生成。</p> : null}
      {summary ? <SummaryContent content={summary.content} /> : <Empty text="还没有保存年度总结。" />}
    </Page>
  );
}

function BackupPage() {
  const [exported, setExported] = useState<ExportedData | null>(null);
  const [importText, setImportText] = useState("");
  const [preview, setPreview] = useState<BackupPreview | null>(null);
  const [undoPreview, setUndoPreview] = useState<BackupPreview | null>(() => store.previewImportUndo());
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function exportData(kind: ExportKind) {
    setMessage("");
    setError("");
    try {
      const content = kind === "json" ? await store.exportBackup() : kind === "txt" ? await store.exportTxt() : await store.exportCsv();
      const meta = EXPORT_FILE_META[kind];
      setExported({ kind, content, fileName: exportFileName(kind), mimeType: meta.mimeType });
      setMessage(`${EXPORT_LABELS[kind]} 已生成`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "导出失败");
    }
  }

  async function saveExportFile() {
    if (!exported) return;
    setMessage("");
    setError("");
    const file = new File([exported.content], exported.fileName, { type: exported.mimeType });
    try {
      if (typeof navigator.canShare === "function" && navigator.canShare({ files: [file] }) && typeof navigator.share === "function") {
        await navigator.share({ files: [file], title: exported.fileName, text: "小懂哥导出文件" });
        setMessage("已打开系统分享");
        return;
      }
      downloadExportFile(file);
      setMessage("已尝试保存文件，请查看系统下载记录");
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        setMessage("已取消分享");
        return;
      }
      try {
        downloadExportFile(file);
        setMessage("系统分享失败，已尝试保存文件");
      } catch {
        setError("保存/分享失败，请复制内容");
      }
    }
  }

  async function copyExport() {
    if (!exported) return;
    setMessage("");
    setError("");
    try {
      await navigator.clipboard.writeText(exported.content);
      setMessage(`${EXPORT_LABELS[exported.kind]} 已复制`);
    } catch {
      setError("复制失败，请手动复制");
    }
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
      const raw = await file.text();
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
    if (!confirm(`导入会覆盖当前手机本地数据。备份包含 ${nextPreview.entryCount} 条记录、${nextPreview.summaryCount} 个总结、${nextPreview.coverCount} 张封面。确认继续？`)) return;
    setMessage("");
    setError("");
    setBusy(true);
    try {
      await store.importBackup(importText);
      setUndoPreview(store.previewImportUndo());
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
    if (!confirm(`撤销会恢复导入前快照：${undoPreview.entryCount} 条记录、${undoPreview.summaryCount} 个总结、${undoPreview.coverCount} 张封面。确认继续？`)) return;
    setMessage("");
    setError("");
    setBusy(true);
    try {
      await store.restoreImportUndo();
      setUndoPreview(store.previewImportUndo());
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
          <div className="export-output-actions">
            <button className="primary-button" type="button" onClick={saveExportFile}>保存/分享文件</button>
            <button className="secondary-button" type="button" onClick={copyExport}>复制内容</button>
          </div>
        </section>
      ) : null}
      {undoPreview ? (
        <section className="form-card">
          <strong>可撤销的导入</strong>
          <p className="hint">导入前快照：{undoPreview.entryCount} 条记录、{undoPreview.summaryCount} 个总结、{undoPreview.coverCount} 张封面；导出时间：{formatDate(undoPreview.exportedAt)}</p>
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
        {preview ? <p className="hint">备份内容：{preview.entryCount} 条记录、{preview.summaryCount} 个总结、{preview.coverCount} 张封面；导出时间：{formatDate(preview.exportedAt)}</p> : null}
        <button className="danger-button" type="submit" disabled={busy}>{busy ? "导入中" : "导入并覆盖当前数据"}</button>
      </form>
      {message ? <p className="hint">{message}</p> : null}
      {error ? <p className="error">{error}</p> : null}
    </Page>
  );
}

function MorePage() {
  const items = [
    ["/abstract-map", "抽象地图", "按情绪把记录放进听歌大陆。"],
    ["/emotion-universe", "情绪宇宙", "用 3D 星图查看歌曲情绪位置。"],
    ["/albums", "专辑", "按专辑名称聚合记录。"],
    ["/songs", "歌曲", "按歌曲名称聚合记录。"],
    ["/backup", "备份", "导出或导入本地 JSON 备份。"],
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

function BottomSheet({ title, text, children, onClose }: { title: string; text?: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="sheet-backdrop" role="presentation" onClick={onClose}>
      <section className="bottom-sheet" role="dialog" aria-modal="true" aria-label={title} onClick={(event) => event.stopPropagation()}>
        <div className="sheet-handle" />
        <div className="sheet-head">
          <div>
            <h2>{title}</h2>
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

function SummaryContent({ content }: { content: string }) {
  return (
    <article className="content-card summary-content">
      {content.split("\n").map((line, index) => renderSummaryLine(line, index))}
    </article>
  );
}

function renderSummaryLine(line: string, index: number) {
  const text = line.trim();
  if (!text) return <br key={index} />;
  if (text.startsWith("### ")) return <h3 key={index}>{text.slice(4)}</h3>;
  if (text.startsWith("## ")) return <h2 key={index}>{text.slice(3)}</h2>;
  if (text.startsWith("# ")) return <h1 key={index}>{text.slice(2)}</h1>;
  if (text.startsWith("- ")) return <p key={index} className="summary-bullet">{text.slice(2)}</p>;
  return <p key={index}>{text}</p>;
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

function inputToCoverTarget(input: EntryInput) {
  if (input.songName) return { kind: "song" as const, target: { albumName: input.albumName, songName: input.songName, artistName: input.artistName } };
  if (input.albumName) return { kind: "album" as const, target: { albumName: input.albumName, artistName: input.artistName } };
  return null;
}

function fillRecognizedFields(form: HTMLFormElement | null, fields: MusicInfoFields) {
  if (!form) return 0;
  let changed = 0;
  changed += setRecognizedField(form, "type", fields.type);
  changed += setRecognizedField(form, "songName", fields.songName);
  changed += setRecognizedField(form, "albumName", fields.albumName);
  changed += setRecognizedField(form, "artistName", fields.artistName);
  changed += setRecognizedField(form, "title", fields.title ?? fields.songName ?? fields.albumName);
  changed += setRecognizedField(form, "content", fields.content);
  return changed;
}

function setRecognizedField(form: HTMLFormElement, name: string, value: string | null | undefined) {
  if (value === undefined) return 0;
  const field = form.elements.namedItem(name);
  if (!(field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement || field instanceof HTMLSelectElement)) return 0;
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
  return value ? new Date(value).toISOString() : null;
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
