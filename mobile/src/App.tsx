import { ChangeEvent, FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { Capacitor, registerPlugin } from "@capacitor/core";
import { Link, NavLink, Route, Routes, useNavigate, useParams, useSearchParams } from "react-router-dom";
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
type HomeEntry = ReviewEntry & { coverDataUrl: string | null };
type ScreenshotOcrLine = { text: string; left: number; top: number; right: number; bottom: number };
type ScreenshotOcrResult = { text: string; width: number; height: number; lines: ScreenshotOcrLine[] };
type ScreenshotOcrPlugin = { recognize(options: { dataUrl: string }): Promise<ScreenshotOcrResult> };

const ScreenshotOcr = registerPlugin<ScreenshotOcrPlugin>("ScreenshotOcr");

export default function App() {
  return (
    <div className="app-shell">
      <header className="app-header">
        <Link to="/" className="brand">小懂哥 v1</Link>
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
        tags: parseList(readText(form, "tags")),
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
        <label>标签<input name="tags" defaultValue={source?.tags.join(", ") ?? ""} /></label>
        <label>情绪关键词<input name="moods" defaultValue={source?.moods.join(", ") ?? ""} /></label>
        <label>评分<input name="rating" type="number" min="1" max="10" defaultValue={source?.rating ?? ""} /></label>
        <label>正文<textarea name="content" rows={12} defaultValue={source?.content ?? ""} required /></label>
        {notice ? <p className="hint">{notice}</p> : null}
        {error ? <p className="error">{error}</p> : null}
        <button className="primary-button" type="submit" disabled={saving}>{saving ? "保存中" : "保存"}</button>
      </form>
    </Page>
  );
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
  const [backup, setBackup] = useState("");
  const [importText, setImportText] = useState("");
  const [preview, setPreview] = useState<BackupPreview | null>(null);
  const [undoPreview, setUndoPreview] = useState<BackupPreview | null>(() => store.previewImportUndo());
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function exportData() {
    setMessage("");
    setError("");
    try {
      setBackup(await store.exportBackup());
      setMessage("备份 JSON 已生成");
    } catch (err) {
      setError(err instanceof Error ? err.message : "导出失败");
    }
  }

  async function copyBackup() {
    setMessage("");
    setError("");
    try {
      await navigator.clipboard.writeText(backup);
      setMessage("备份 JSON 已复制");
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
      setBackup("");
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
      setBackup("");
      setMessage("已撤销上次导入");
    } catch (err) {
      setError(err instanceof Error ? err.message : "撤销失败");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Page title="备份" text="导出或导入手机本地 JSON 备份。">
      <button className="primary-button full" type="button" onClick={exportData}>导出 JSON</button>
      {backup ? (
        <label className="form-card">
          导出的 JSON
          <textarea readOnly rows={10} value={backup} />
          <button className="secondary-button" type="button" onClick={copyBackup}>复制 JSON</button>
        </label>
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
