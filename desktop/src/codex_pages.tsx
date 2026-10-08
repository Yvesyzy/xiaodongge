import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ENTRY_TYPE_LABELS, ENTRY_TYPES, type ReviewEntry } from "../../mobile/src/types";
import { formatDateOnly } from "../../mobile/src/format";
import { store } from "../../mobile/src/store";

function DesktopCover({ src, label, large = false }: { src: string | null; label: string; large?: boolean }) {
  return src ? (
    <img className={large ? "desktop-cover desktop-cover-large" : "desktop-cover"} src={src} alt={`${label}封面`} />
  ) : (
    <div className={large ? "desktop-cover desktop-cover-large desktop-cover-empty" : "desktop-cover desktop-cover-empty"} aria-label={`${label}封面占位`}>
      <span aria-hidden="true">♪</span>
    </div>
  );
}

function ratingText(entry: ReviewEntry) {
  return entry.rating === null ? "未评分" : `${entry.rating}${entry.ratingModifier ?? ""} / 10`;
}

function useEntries() {
  const [entries, setEntries] = useState<ReviewEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    setLoading(true);
    void store.listEntries().then((value) => {
      if (!active) return;
      setEntries(value);
      setLoading(false);
    }).catch((reason) => {
      if (!active) return;
      setError(reason instanceof Error ? reason.message : "记录读取失败");
      setLoading(false);
    });
    return () => { active = false; };
  }, []);
  return { entries, loading, error };
}

function HomeRecord({ entry }: { entry: ReviewEntry }) {
  const [cover, setCover] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    void store.getEntryCover(entry).then((value) => { if (active) setCover(value); }).catch(() => undefined);
    return () => { active = false; };
  }, [entry]);
  return (
    <Link className="desktop-home-record" to={`/entries/${entry.id}`}>
      <DesktopCover src={cover} label={entry.title} />
      <span className="desktop-home-record-copy">
        <strong>{entry.title}</strong>
        <span>{entry.artistName || entry.albumName || entry.songName || "未填写作品信息"}</span>
        <small>{formatDateOnly(entry.createdAt)}</small>
      </span>
      <b>{ratingText(entry)}</b>
    </Link>
  );
}

export function DesktopHomePage() {
  const { entries, loading, error } = useEntries();
  const recent = useMemo(() => [...entries].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 5), [entries]);
  const rated = entries.filter((entry) => entry.rating !== null);
  const average = rated.length ? (rated.reduce((sum, entry) => sum + (entry.rating ?? 0), 0) / rated.length).toFixed(1) : "—";
  const currentYear = new Date().getFullYear();
  const currentYearCount = entries.filter((entry) => entry.year === currentYear).length;

  return (
    <section className="desktop-page desktop-home-page">
      <div className="desktop-home-intro">
        <div>
          <span className="desktop-eyebrow">PRIVATE MUSIC ARCHIVE</span>
          <h2>把听见的，<br /><em>留下来。</em></h2>
          <p>记录一首歌留下的感觉，也记录它后来如何被重新听见。</p>
        </div>
        <div className="desktop-home-actions">
          <Link to="/new" className="desktop-primary-action">＋ 新建完整乐评</Link>
          <Link to="/capture" className="desktop-secondary-action">速记一句感受</Link>
        </div>
      </div>
      {error ? <p className="error" role="alert">{error}</p> : null}
      <div className="desktop-stat-grid" aria-label="档案统计">
        <div><span>全部记录</span><strong>{loading ? "…" : entries.length}</strong><small>条个人听感</small></div>
        <div><span>平均评分</span><strong>{loading ? "…" : average}</strong><small>{rated.length ? `来自 ${rated.length} 条评分` : "填写评分后显示"}</small></div>
        <div><span>{currentYear} 年</span><strong>{loading ? "…" : currentYearCount}</strong><small>今年的记录</small></div>
      </div>
      <div className="desktop-home-section-head">
        <div><span className="desktop-eyebrow">RECENT NOTES</span><h2>最近记录</h2></div>
        <Link to="/timeline">查看全部 →</Link>
      </div>
      {loading ? <p className="desktop-muted">正在读取档案…</p> : recent.length ? (
        <div className="desktop-home-record-list">{recent.map((entry) => <HomeRecord key={entry.id} entry={entry} />)}</div>
      ) : (
        <div className="desktop-empty-panel">
          <strong>档案室还是空的</strong>
          <p>可以先写下一条听感，或从备份与恢复导入已有的音乐记录。</p>
          <div><Link to="/new" className="desktop-primary-action">开始写第一条</Link><Link to="/backup" className="desktop-secondary-action">导入备份</Link></div>
        </div>
      )}
      <div className="desktop-home-link-grid">
        <Link to="/summary"><span>年度回顾</span><strong>回到某一年，看看哪些歌留下来了 →</strong></Link>
        <Link to="/backup"><span>数据安全</span><strong>备份、恢复与数据状态 →</strong></Link>
      </div>
    </section>
  );
}

function ArchiveDetail({ entry }: { entry: ReviewEntry | null }) {
  const [cover, setCover] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    setCover(null);
    if (entry) void store.getEntryCover(entry).then((value) => { if (active) setCover(value); }).catch(() => undefined);
    return () => { active = false; };
  }, [entry]);
  if (!entry) {
    return <section className="desktop-archive-detail desktop-detail-empty"><strong>选择一条记录开始阅读</strong><p>列表中的记录会保留在当前筛选上下文中。</p></section>;
  }
  const paragraphs = entry.content.trim() ? entry.content.trim().split(/\n{2,}/) : ["暂无正文。"];
  return (
    <article className="desktop-archive-detail">
      <div className="desktop-detail-toolbar">
        <span className="desktop-detail-tab active">阅读</span>
        <div><Link to={`/entries/${entry.id}`}>打开完整阅读</Link><Link to={`/entries/${entry.id}/edit`}>编辑</Link></div>
      </div>
      <header className="desktop-detail-head">
        <DesktopCover src={cover} label={entry.title} large />
        <div>
          <span className="desktop-eyebrow">{ENTRY_TYPE_LABELS[entry.type]} · {formatDateOnly(entry.createdAt)}</span>
          <h2>{entry.title}</h2>
          <p>{[entry.artistName, entry.albumName, entry.songName].filter(Boolean).join(" · ") || "未填写作品信息"}</p>
          <strong className="desktop-detail-rating">{ratingText(entry)}</strong>
        </div>
      </header>
      <div className="desktop-detail-rule" />
      <div className="desktop-detail-body">
        {paragraphs.map((paragraph, index) => <p key={`${entry.id}-${index}`}>{paragraph}</p>)}
      </div>
      <div className="desktop-detail-meta">
        {entry.tags.length ? <div><span>曲风</span><strong>{entry.tags.join(" · ")}</strong></div> : null}
        {entry.moods.length ? <div><span>情绪</span><strong>{entry.moods.join(" · ")}</strong></div> : null}
        <div><span>更新于</span><strong>{formatDateOnly(entry.updatedAt)}</strong></div>
      </div>
      <div className="desktop-detail-actions">
        <Link to={`/relisten/${entry.id}`} className="desktop-primary-action">再听一次</Link>
        <Link to={`/entries/${entry.id}`} className="desktop-secondary-action">查看重听与详情</Link>
      </div>
    </article>
  );
}

export function ArchivePage() {
  const { entries, loading, error } = useEntries();
  const listRef = useRef<HTMLElement>(null);
  const [params, setParams] = useSearchParams();
  const [searchDraft, setSearchDraft] = useState(params.get("q") ?? "");
  const query = params.get("q") ?? "";
  const selectedId = params.get("entry") ?? "";
  const type = params.get("type") ?? "all";
  const year = params.get("year") ?? "all";
  useLayoutEffect(() => {
    if (loading || !listRef.current) return;
    const list = listRef.current;
    const key = "codex-desktop-archive-scroll:v1";
    try {
      const saved = JSON.parse(sessionStorage.getItem(key) ?? "null");
      if (saved?.query === query && saved.type === type && saved.year === year && Number.isFinite(saved.y) && saved.y >= 0) list.scrollTop = saved.y;
    } catch { /* Optional navigation position. */ }
    return () => {
      // ponytail: retain one archive list position; use a bounded map if separate filter histories are needed.
      try { sessionStorage.setItem(key, JSON.stringify({ query, type, year, y: list.scrollTop })); } catch { /* Browsing remains available. */ }
    };
  }, [loading, query, type, year]);
  const years = useMemo(() => Array.from(new Set(entries.map((entry) => entry.year))).sort((a, b) => b - a), [entries]);
  const filtered = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase();
    return entries.filter((entry) => {
      if (type !== "all" && entry.type !== type) return false;
      if (year !== "all" && String(entry.year) !== year) return false;
      if (!normalized) return true;
      return [entry.title, entry.content, entry.artistName, entry.albumName, entry.songName].some((value) => value?.toLocaleLowerCase().includes(normalized));
    }).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [entries, query, type, year]);
  const selected = filtered.find((entry) => entry.id === selectedId) ?? filtered[0] ?? null;

  useEffect(() => {
    setSearchDraft(query);
  }, [query]);

  useEffect(() => {
    if (loading || error) return;
    if (selected?.id === selectedId || (!selected && !selectedId)) return;
    const next = new URLSearchParams(params);
    if (selected) next.set("entry", selected.id); else next.delete("entry");
    setParams(next, { replace: true });
  }, [loading, error, params, selected, selectedId, setParams]);

  function updateFilter(key: string, value: string) {
    const next = new URLSearchParams(params);
    if (!value || value === "all") next.delete(key); else next.set(key, value);
    setParams(next, { replace: true });
  }

  function submitSearch(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    updateFilter("q", searchDraft.trim());
  }

  return (
    <section className="desktop-page desktop-archive-page">
      <div className="desktop-archive-layout">
        <section ref={listRef} className="desktop-archive-list" aria-label="记录列表">
          <div className="desktop-archive-heading"><div><span className="desktop-eyebrow">ARCHIVE</span><h2>全部记录</h2></div><span>{filtered.length} 条</span></div>
          <form className="desktop-archive-search" onSubmit={submitSearch} role="search">
            <label htmlFor="desktop-archive-query">搜索记录</label>
            <input id="desktop-archive-query" value={searchDraft} onChange={(event) => setSearchDraft(event.target.value)} placeholder="搜索标题、作品或正文" />
            <button type="submit" aria-label="执行搜索">⌕</button>
          </form>
          <div className="desktop-filter-row">
            <label>类型<select value={type} onChange={(event) => updateFilter("type", event.target.value)}><option value="all">全部类型</option>{ENTRY_TYPES.map((entryType) => <option key={entryType} value={entryType}>{ENTRY_TYPE_LABELS[entryType]}</option>)}</select></label>
            <label>年份<select value={year} onChange={(event) => updateFilter("year", event.target.value)}><option value="all">全部年份</option>{years.map((value) => <option key={value} value={value}>{value}</option>)}</select></label>
          </div>
          {error ? <p className="error" role="alert">{error}</p> : null}
          {loading ? <p className="desktop-muted">正在读取档案…</p> : filtered.length ? (
            <div className="desktop-record-list" aria-label="可阅读记录">
              {filtered.map((entry) => <ArchiveRow key={entry.id} entry={entry} selected={entry.id === selected?.id} onSelect={() => updateFilter("entry", entry.id)} />)}
            </div>
          ) : <div className="desktop-list-empty"><strong>没有匹配记录</strong><p>调整筛选条件，或新建一条记录。</p><Link to="/new" className="desktop-secondary-action">新建记录</Link></div>}
        </section>
        <ArchiveDetail entry={selected} />
      </div>
    </section>
  );
}

function ArchiveRow({ entry, selected, onSelect }: { entry: ReviewEntry; selected: boolean; onSelect: () => void }) {
  const [cover, setCover] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    void store.getEntryCover(entry).then((value) => { if (active) setCover(value); }).catch(() => undefined);
    return () => { active = false; };
  }, [entry]);
  return (
    <button type="button" className={`desktop-record-row${selected ? " selected" : ""}`} aria-pressed={selected} onClick={onSelect}>
      <DesktopCover src={cover} label={entry.title} />
      <span><strong>{entry.title}</strong><small>{entry.artistName || entry.albumName || entry.songName || ENTRY_TYPE_LABELS[entry.type]}</small><time>{formatDateOnly(entry.createdAt)}</time></span>
      <b>{ratingText(entry)}</b>
    </button>
  );
}
