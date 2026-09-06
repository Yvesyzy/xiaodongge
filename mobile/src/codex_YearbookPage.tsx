import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { excerpt } from "./format";
import { inRecordingPeriod } from "./listeningYearbook";
import { store } from "./store";
import type { ReviewEntry } from "./types";
import { journalCover, journalDate, journalEntries, journalFuture, journalMonths, journalRating, journalTitle } from "./codex_yearbookModel";
import { JournalExport } from "./codex_JournalExport";
import type { JournalExportKind } from "./codex_yearbookPages";
import "./codex_yearbook.css";

export default function SimpleYearbookPage() {
  const [params, setParams] = useSearchParams();
  const [all, setAll] = useState<ReviewEntry[] | null>(null);
  const [error, setError] = useState("");
  const [reload, setReload] = useState(0);
  const now = new Date();
  const rawYear = Number(params.get("year") ?? now.getFullYear());
  const year = Number.isInteger(rawYear) && rawYear >= 1 && rawYear <= 9999 ? rawYear : now.getFullYear();
  useEffect(() => {
    let active = true;
    setAll(null); setError("");
    void store.listEntries().then((entries) => { if (active) setAll(entries); })
      .catch((e: unknown) => { if (active) setError(e instanceof Error ? e.message : "年度记录读取失败"); });
    return () => { active = false; };
  }, [reload]);
  const years = Array.from(new Set([now.getFullYear(), year, ...(all ?? []).map((entry) => new Date(entry.createdAt).getFullYear()).filter(Number.isFinite)])).sort((a, b) => b - a);
  return <section className="journal journal-page">
    <div className="journal-nav"><Link to={params.get("view") ? `/summary?year=${year}` : "/"}>{params.get("view") ? "← 我的音乐年记" : "← 首页"}</Link><label className="journal-year"><span className="journal-sr-only">年度总结年份</span><select aria-label="年度总结年份" value={year} onChange={(e) => setParams({ year: e.target.value })}>{years.map((y) => <option value={y} key={y}>{y}</option>)}</select></label></div>
    {error ? <div role="alert"><p className="journal-error">{error}</p><button onClick={() => setReload((n) => n + 1)}>重新读取</button></div> : all === null ? <p role="status">正在读取年度记录…</p> : <JournalContent key={year} year={year} all={all} />}
  </section>;
}

function JournalContent({ year, all }: { year: number; all: ReviewEntry[] }) {
  const [params, setParams] = useSearchParams();
  const entries = useMemo(() => journalEntries(all, year), [all, year]);
  const counts = useMemo(() => journalMonths(entries), [entries]);
  const [exportKind, setExportKind] = useState<JournalExportKind | null>(null);
  const view = params.get("view") ?? "cover";
  const selected = entries.find((entry) => entry.id === params.get("entry"));
  const cover = entries.find((entry) => entry.id === params.get("cover")) ?? entries[0];
  const exportEntries = useMemo(() => view === "work" && selected ? [selected] : exportKind === "cover" && cover ? [cover, ...entries.filter((e) => e.id !== cover.id)] : entries, [entries, selected, view, cover, exportKind]);
  const reflections = all.filter((e) => (e.type === "month" || e.type === "year") && inRecordingPeriod(e, year));
  const href = (nextView: string, entry?: string) => {
    const next = new URLSearchParams(params); next.set("year", String(year)); next.set("view", nextView);
    if (entry) next.set("entry", entry); else next.delete("entry");
    return `/summary?${next}`;
  };
  const setMonth = (month: string) => { const next = new URLSearchParams(params); next.set("year", String(year)); next.set("view", "overview"); next.set("month", month); next.delete("entry"); setParams(next); };
  const now = new Date();
  const cutoff = year < now.getFullYear() ? `${year}.12.31` : `${now.getFullYear()}.${String(now.getMonth() + 1).padStart(2, "0")}.${String(now.getDate()).padStart(2, "0")}`;
  useEffect(() => { window.scrollTo(0, 0); }, [view, selected?.id]);

  if (!entries.length) return <>
    <h1>年度总览</h1><p className="journal-muted">{year} 年 · 按首次正式保存时间</p><p className="journal-stat">0 篇正式音乐记录</p>
    <div className="journal-empty"><span aria-hidden="true" className="journal-empty-icon">＋</span><h2>这一年还没有正式音乐记录</h2><p>写下一点听歌感受，正式保存后就会出现在这里。</p><p className="journal-muted">草稿不会计入年度总结。</p><div className="journal-stack"><Link className="journal-primary" to="/new">写第一篇记录</Link><Link className="journal-button" to="/drafts">打开草稿箱</Link></div><p className="journal-muted">已有其他年份的记录？可以通过右上角切换年份。</p></div>
    <ReflectionLinks entries={reflections} />
  </>;

  return <>
    {view === "cover" && <>
      <h1>我的音乐年记</h1><p className="journal-muted">{year} 年 · 记录截至 {cutoff}</p><p className="journal-stat"><strong>{entries.length}</strong> 篇记录 <span>按记录时间整理</span></p>
      <div className="journal-cover"><JournalCover entry={cover} /><p>{journalTitle(cover)}{cover.artistName ? ` · ${cover.artistName}` : ""}</p><label className="journal-muted">封面作品<select aria-label="封面作品" value={cover.id} onChange={(e) => { const next = new URLSearchParams(params); next.set("cover", e.target.value); setParams(next, { replace: true }); }}>{entries.map((entry) => <option key={entry.id} value={entry.id}>{journalTitle(entry)}</option>)}</select></label></div>
      <h2>这一年的记录</h2><div className="journal-contents"><Link to={href("overview")}>作品与感受 <span>{entries.length} 篇 →</span></Link><Link to={href("overview")}>记录日历 <span>查看 →</span></Link><Link to={href("quotes")}>年度摘录 <span>查看 →</span></Link></div>
      <div className="journal-quote"><small>原文摘录 · {journalTitle(cover)}</small><p>{excerpt(cover.content, 100)}</p></div>
      <div className="journal-actions"><Link className="journal-primary" to={href("work", entries[0].id)}>开始阅读</Link><button onClick={() => setExportKind("cover")}>保存封面</button></div>
    </>}
    {view === "overview" && <>
      <h1>年度总览</h1><p className="journal-muted">{year} 年 · 记录截至 {cutoff}</p><p className="journal-stat"><strong>{entries.length}</strong> 篇记录 <span>{counts.filter(Boolean).length} 个记录月份</span></p>
      <h2>月份分布</h2><p className="journal-muted">按首次正式保存时间统计；后续修改不改变月份。</p>
      <div className="journal-bars" aria-label="十二个月记录数量">{counts.map((count, i) => <button key={i} aria-label={`${i + 1}月：${count}篇记录`} aria-pressed={params.get("month") === String(i + 1)} onClick={() => setMonth(String(i + 1))}><span className="journal-bar-area"><span className="journal-bar-value">{!count && journalFuture(year, i + 1) ? "—" : count}</span><i style={{ height: `${count / Math.max(1, ...counts) * 124}px` }} /></span><span>{i + 1}月</span></button>)}</div>
      <p className="journal-muted journal-legend">0：暂无记录　—：月份未到</p>
      <JournalList entries={entries} href={href} />
      <div className="journal-stack"><button className="journal-primary" onClick={() => setExportKind("overview")}>保存概览图片</button><button onClick={() => setExportKind("index")}>保存全年记录索引</button><button onClick={() => setExportKind("works")}>分批保存全年作品全文</button></div><p className="journal-muted">导出收录全年 {entries.length} 篇，不受当前筛选或折叠影响。</p>
    </>}
    {view === "work" && (selected ? <>
      <div className="journal-nav"><Link to={href("overview")}>← 作品与感受</Link><span>{entries.indexOf(selected) + 1} / {entries.length}</span></div>
      <h1>{journalTitle(selected)}</h1><p>{selected.artistName || "未填写音乐人"} · {selected.type === "song" ? "歌曲" : "专辑"}</p>
      <div className="journal-work-header"><JournalCover entry={selected} /><div><p className="journal-muted">我的评分</p><strong>{journalRating(selected)}</strong></div></div>
      <p className="journal-muted">记录于 {journalDate(selected)}</p><section className="journal-body"><h2>当时的感受</h2>{selected.title !== journalTitle(selected) && <h3>{selected.title}</h3>}<p>{selected.content}</p></section>
      {selected.tags.length > 0 && <section><h2>记录标签</h2><div className="journal-tags">{selected.tags.map((tag) => <span key={tag}>{tag}</span>)}</div></section>}
      {selected.moods.length > 0 && <p className="journal-muted">记录情绪：{selected.moods.join("、")}</p>}
      <Link className="journal-text-link" to={`/entries/${encodeURIComponent(selected.id)}`}>查看完整乐评与编辑 →</Link>
      <div className="journal-actions"><button onClick={() => setExportKind("works")} className="journal-primary">保存作品全文</button>{entries.indexOf(selected) < entries.length - 1 ? <Link className="journal-button" to={href("work", entries[entries.indexOf(selected) + 1].id)}>下一篇 →</Link> : <Link className="journal-button" to={href("overview")}>返回总览</Link>}</div>
      {entries.indexOf(selected) > 0 && <Link className="journal-text-link" to={href("work", entries[entries.indexOf(selected) - 1].id)}>← 上一篇</Link>}
    </> : <><h1>记录不存在</h1><p>这篇记录已删除或不属于当前年份。</p><Link to={href("overview")}>返回年度总览</Link></>)}
    {view === "quotes" && <JournalQuotes entries={entries} href={href} />}
    {!["cover", "overview", "work", "quotes"].includes(view) && <Link to={href("cover")}>返回年度封面</Link>}
    <ReflectionLinks entries={reflections} />
    <div className="journal-secondary-nav"><Link to={`/summary/analysis?year=${year}`}>月报与听感分析 →</Link><span>草稿不计入；月度、年度自述单独保留。</span></div>
    {exportKind && <JournalExport year={year} entries={exportEntries} kind={exportKind} onClose={() => setExportKind(null)} />}
  </>;
}

function JournalList({ entries, href }: { entries: ReviewEntry[]; href: (view: string, entry?: string) => string }) {
  const [params, setParams] = useSearchParams();
  const month = params.get("month") ?? "";
  const query = params.get("q") ?? "";
  const [searchText, setSearchText] = useState(query);
  const sort = params.get("sort") ?? "desc";
  useEffect(() => { setSearchText(query); }, [query]);
  useEffect(() => {
    if (searchText === query) return;
    const timer = window.setTimeout(() => { const next = new URLSearchParams(params); if (searchText) next.set("q", searchText); else next.delete("q"); setParams(next, { replace: true }); }, 250);
    return () => clearTimeout(timer);
  }, [searchText, query, params, setParams]);
  const matches = entries.filter((entry) => (!month || new Date(entry.createdAt).getMonth() + 1 === Number(month)) && `${entry.title} ${entry.albumName ?? ""} ${entry.songName ?? ""} ${entry.artistName ?? ""} ${entry.content} ${entry.tags.join(" ")}`.toLocaleLowerCase().includes(searchText.trim().toLocaleLowerCase()));
  if (sort === "asc") matches.reverse();
  const months = Array.from(new Set(matches.map((entry) => new Date(entry.createdAt).getMonth() + 1)));
  const [groupLimit, setGroupLimit] = useState(entries.length <= 20 ? 12 : 3);
  const [shown, setShown] = useState<Record<number, number>>(() => Object.fromEntries(months.map((m, i) => [m, entries.length <= 20 || i === 0 ? 20 : 0])));
  useEffect(() => {
    setGroupLimit(entries.length <= 20 ? 12 : 3);
    setShown(Object.fromEntries(months.map((m, i) => [m, entries.length <= 20 || i === 0 ? 20 : 0])));
  }, [month, searchText, sort, entries]);
  const update = (key: string, value: string) => { const next = new URLSearchParams(params); if (value) next.set(key, value); else next.delete(key); setParams(next, { replace: true }); };
  const visibleMonths = months.slice(0, groupLimit);
  const visibleCount = visibleMonths.reduce((sum, m) => sum + Math.min(shown[m] ?? 0, matches.filter((e) => new Date(e.createdAt).getMonth() + 1 === m).length), 0);
  return <section className="journal-records">
    <div className="journal-nav"><h2>全部记录</h2><span>全年 {entries.length} 篇</span></div>
    <label className="journal-search"><span className="journal-sr-only">搜索作品或感受</span><input type="search" placeholder="搜索作品或感受" value={searchText} onChange={(e) => setSearchText(e.target.value)} /></label>
    <div className="journal-filters"><select aria-label="记录月份" value={month} onChange={(e) => update("month", e.target.value)}><option value="">全部月份</option>{Array.from({ length: 12 }, (_, i) => <option key={i} value={i + 1}>{i + 1} 月</option>)}</select><select aria-label="记录排序" value={sort} onChange={(e) => update("sort", e.target.value)}><option value="desc">时间倒序</option><option value="asc">时间正序</option></select></div>
    {(month || searchText) && <div className="journal-nav"><p className="journal-muted">匹配 {matches.length} 篇 / 全年 {entries.length} 篇</p><button onClick={() => { setSearchText(""); const next = new URLSearchParams(params); next.delete("month"); next.delete("q"); setParams(next, { replace: true }); }}>清除筛选</button></div>}
    {!matches.length && <p className="journal-empty-result">没有符合筛选条件的记录。可清除筛选查看全年。</p>}
    {visibleMonths.map((m) => {
      const group = matches.filter((entry) => new Date(entry.createdAt).getMonth() + 1 === m);
      const count = shown[m] ?? 0;
      return <section className="journal-month-group" key={m}><button className="journal-month-toggle" aria-expanded={count > 0} onClick={() => setShown({ ...shown, [m]: count ? 0 : 20 })}>{m} 月 · {group.length} 篇 <span>{count ? "收起 −" : "展开 ＋"}</span></button>
        {group.slice(0, count).map((entry) => <Link className="journal-record" key={entry.id} to={href("work", entry.id)}><JournalCover entry={entry} /><div><strong>{journalTitle(entry)}</strong><small>{journalDate(entry)} · {entry.type === "song" ? "歌曲" : "专辑"}</small></div><span aria-hidden="true">›</span></Link>)}
        {count > 0 && count < group.length && <button className="journal-more" onClick={() => setShown({ ...shown, [m]: count + 20 })}>再显示 {Math.min(20, group.length - count)} 篇（{m} 月）</button>}
      </section>;
    })}
    {months.length > groupLimit && <button className="journal-more" onClick={() => setGroupLimit((n) => n + 3)}>显示更多月份</button>}
    <p className="journal-muted journal-visible-count">已展开 {visibleCount} 篇 / 匹配 {matches.length} 篇 / 全年 {entries.length} 篇</p>
  </section>;
}

function JournalQuotes({ entries, href }: { entries: ReviewEntry[]; href: (view: string, entry?: string) => string }) {
  const [limit, setLimit] = useState(20);
  return <><h1>年度摘录</h1><p className="journal-muted">每篇取正文开头；点击作品查看完整原文。</p>{entries.slice(0, limit).map((entry) => <Link className="journal-quote" to={href("work", entry.id)} key={entry.id}><small>{journalTitle(entry)} · {journalDate(entry)}</small><p>{excerpt(entry.content, 180)}</p></Link>)}{limit < entries.length && <button onClick={() => setLimit(limit + 20)}>显示更多摘录</button>}</>;
}

function ReflectionLinks({ entries }: { entries: ReviewEntry[] }) {
  return entries.length ? <details className="journal-reflections"><summary>月度与年度自述 · {entries.length} 篇</summary>{entries.map((entry) => <Link key={entry.id} to={`/entries/${encodeURIComponent(entry.id)}`}>{entry.title} →</Link>)}</details> : null;
}

function JournalCover({ entry }: { entry: ReviewEntry }) {
  const [source, setSource] = useState<string | null>(null);
  useEffect(() => {
    let active = true; setSource(null);
    void journalCover(entry).then((value) => { if (active) setSource(value); }).catch(() => { if (active) setSource(null); });
    return () => { active = false; };
  }, [entry]);
  return source ? <img className="journal-art" src={source} alt={`${journalTitle(entry)}封面`} loading="lazy" onError={() => setSource(null)} /> : <div className="journal-art journal-placeholder" aria-label={`${journalTitle(entry)}暂无封面`}>{Array.from(journalTitle(entry))[0] || "音"}</div>;
}
