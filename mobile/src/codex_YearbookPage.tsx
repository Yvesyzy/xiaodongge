import { EMPTY_EDITION, JournalEditor, journalQuote } from "./codex_JournalEditor";
import { JOURNAL_EDITION_PREFIX, readJournalEdition, type JournalEdition } from "../../shared/backupAppData";
import { analyzeListeningEntries, applySemanticOverrides, type SemanticOverride } from "../../shared/listeningAnalysis";
import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { excerpt } from "./format";
import { listEntryDrafts } from "./entryDraft";
import { inRecordingPeriod, parseMonthlyListeningSnapshot } from "./listeningYearbook";
import { RecapInsights } from "./codex_RecapInsights";
import { store } from "./store";
import type { MonthlySummary, ReviewEntry } from "./types";
import { normalizeMusicIdentityText } from "./musicIdentity";
import { journalCover, journalDate, journalEntries, journalFuture, journalMonths, journalRating, journalTitle } from "./codex_yearbookModel";
import { JournalExport } from "./codex_JournalExport";
import type { JournalExportKind } from "./codex_yearbookPages";
import "./codex_yearbook.css";
import ReadingTools from "./codex_ReadingTools";
import ReviewShare from "./codex_ReviewShare";

type MonthlyRecapState = "no-records" | "not-generated" | "generated" | "needs-update";

export default function SimpleYearbookPage() {
  const [params, setParams] = useSearchParams();
  const [all, setAll] = useState<ReviewEntry[] | null>(null);
  const [error, setError] = useState("");
  const [reload, setReload] = useState(0);
  const now = new Date();
  const rawYear = Number(params.get("year") ?? now.getFullYear());
  const year = Number.isInteger(rawYear) && rawYear >= 1 && rawYear <= 9999 ? rawYear : now.getFullYear();
  const view = params.get("view") ?? "cover";
  useEffect(() => {
    let active = true;
    setAll(null); setError("");
    void store.listEntries().then((entries) => { if (active) setAll(entries); })
      .catch((e: unknown) => { if (active) setError(e instanceof Error ? e.message : "年度记录读取失败"); });
    return () => { active = false; };
  }, [reload]);
  const years = Array.from(new Set([now.getFullYear(), year, ...(all ?? []).map((entry) => new Date(entry.createdAt).getFullYear()).filter(Number.isFinite)])).sort((a, b) => b - a);
  const tabHref = (nextView: "cover" | "months") => {
    const next = new URLSearchParams(params);
    next.set("year", String(year)); next.set("view", nextView);
    if (nextView === "months") next.delete("entry");
    return `/summary?${next.toString()}`;
  };
  return <section className="journal journal-page">
    <div className="journal-nav"><Link to={view === "cover" ? "/" : `/summary?year=${year}`}>{view === "cover" ? "← 首页" : "← 我的音乐年记"}</Link><label className="journal-year"><span className="journal-sr-only">年度总结年份</span><select aria-label="年度总结年份" value={year} onChange={(e) => { const next = new URLSearchParams(params); next.set("year", e.target.value); setParams(next); }}>{years.map((y) => <option value={y} key={y}>{y}</option>)}</select></label></div>
    <nav className="journal-tabs" aria-label="年度与月度回顾"><Link className={view === "months" ? "" : "active"} aria-current={view === "months" ? undefined : "page"} to={tabHref("cover")}>年度回顾</Link><Link className={view === "months" ? "active" : ""} aria-current={view === "months" ? "page" : undefined} to={tabHref("months")}>月度回顾</Link></nav>
    {error ? <div role="alert"><p className="journal-error">{error}</p><button onClick={() => setReload((n) => n + 1)}>重新读取</button></div> : all === null ? <p role="status">正在读取年度记录…</p> : <JournalContent key={year} year={year} all={all} />}
  </section>;
}

function JournalContent({ year, all }: { year: number; all: ReviewEntry[] }) {
  const [params, setParams] = useSearchParams();
  const entries = useMemo(() => journalEntries(all, year), [all, year]);
  const counts = useMemo(() => journalMonths(entries), [entries]);
  const [exportKind, setExportKind] = useState<JournalExportKind | null>(null);
  const [sharing, setSharing] = useState(false);
  const view = params.get("view") ?? "cover";
  const selected = entries.find((entry) => entry.id === params.get("entry"));
  const [edition, setEdition] = useState<JournalEdition>(EMPTY_EDITION);
  const [editionReady, setEditionReady] = useState(false);
  const [editionError, setEditionError] = useState("");
  const [monthlySummaries, setMonthlySummaries] = useState<MonthlySummary[] | null>(null);
  const [semanticOverrides, setSemanticOverrides] = useState<SemanticOverride[] | null>(null);
  const [monthlyError, setMonthlyError] = useState("");
  const reflections = all.filter((entry) => (entry.type === "month" || entry.type === "year") && inRecordingPeriod(entry, year));
  const draftCount = useMemo(() => {
    if (typeof localStorage === "undefined") return null;
    try { return listEntryDrafts(localStorage).length; } catch { return null; }
  }, []);
  const recommendations = useMemo(() => entries.filter((entry) => entry.rating !== null).sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0) || b.createdAt.localeCompare(a.createdAt) || a.id.localeCompare(b.id)).slice(0, 3), [entries]);
  useEffect(() => {
    let active = true;
    setEditionReady(false); setEditionError("");
    void store.getStoredAppData(JOURNAL_EDITION_PREFIX + year).then((raw) => {
      if (!active) return;
      const saved = raw ? readJournalEdition(JSON.parse(raw)) : EMPTY_EDITION;
      setEdition({ ...saved, coverId: entries.some((entry) => entry.id === saved.coverId) ? saved.coverId : null, entryIds: saved.entryIds.filter((id) => entries.some((entry) => entry.id === id)), quotes: Object.fromEntries(Object.entries(saved.quotes).filter(([id, quote]) => entries.some((entry) => entry.id === id && entry.content.includes(quote)))) });
      setEditionReady(true);
    }).catch((e: unknown) => { if (active) setEditionError(e instanceof Error ? e.message : "年度精选读取失败"); });
    return () => { active = false; };
  }, [year, entries]);
  useEffect(() => {
    let active = true;
    setMonthlySummaries(null); setSemanticOverrides(null); setMonthlyError("");
    void Promise.all([store.listMonthlySummaries(year), store.getSemanticOverrides()]).then(([summaries, overrides]) => { if (active) { setMonthlySummaries(summaries); setSemanticOverrides(overrides); } })
      .catch((e: unknown) => { if (active) { setMonthlySummaries([]); setSemanticOverrides([]); setMonthlyError(e instanceof Error ? e.message : "月度回顾读取失败"); } });
    return () => { active = false; };
  }, [year, entries]);
  const monthStates = useMemo(() => Array.from({ length: 12 }, (_, index) => monthRecap(year, index + 1, entries, monthlySummaries, semanticOverrides, !!monthlyError)), [year, entries, monthlySummaries, semanticOverrides, monthlyError]);
  const cover = entries.find((entry) => entry.id === edition.coverId) ?? entries.find((entry) => entry.id === params.get("cover")) ?? entries[0];
  const exportEntries = useMemo(() => view === "work" && selected ? [selected] : exportKind === "cover" && cover ? [cover, ...entries.filter((entry) => entry.id !== cover.id)] : entries, [entries, selected, view, cover, exportKind]);
  const href = (nextView: string, entry?: string) => {
    const next = new URLSearchParams(params); next.set("year", String(year)); next.set("view", nextView);
    if (entry) next.set("entry", entry); else next.delete("entry");
    return `/summary?${next.toString()}`;
  };
  const setMonth = (month: string) => { const next = new URLSearchParams(params); next.set("year", String(year)); next.set("view", "overview"); next.set("month", month); next.delete("entry"); setParams(next); };
  const now = new Date();
  const cutoff = year < now.getFullYear() ? `${year}.12.31` : `${now.getFullYear()}.${String(now.getMonth() + 1).padStart(2, "0")}.${String(now.getDate()).padStart(2, "0")}`;
  const secondary = <JournalSecondaryNav year={year} />;
  const exportDialog = exportKind ? <JournalExport year={year} entries={exportEntries} kind={exportKind} edition={edition} onClose={() => setExportKind(null)} /> : null;
  const quoteEntries = [...edition.entryIds.map((id) => entries.find((entry) => entry.id === id)).filter((entry): entry is ReviewEntry => !!entry), ...entries.filter((entry) => !edition.entryIds.includes(entry.id))];

  if (view === "months") return <>
    <MonthRecap year={year} entries={entries} states={monthStates} loading={monthlySummaries === null} error={monthlyError} />
    <RecordScopeSummary musicCount={entries.length} reflectionCount={reflections.length} draftCount={draftCount} />
    <ReflectionLinks entries={reflections} />{secondary}{exportDialog}
  </>;

  if (!entries.length) return <>
    <h1>年度总览</h1><p className="journal-muted">{year} 年 · 按首次正式保存时间</p><p className="journal-stat">0 篇正式音乐记录</p>
    <AnnualFacts entries={entries} /><RecordScopeSummary musicCount={0} reflectionCount={reflections.length} draftCount={draftCount} />
    <div className="journal-empty"><span aria-hidden="true" className="journal-empty-icon">＋</span><h2>这一年还没有正式音乐记录</h2><p>写下一点听歌感受，正式保存后就会出现在这里。</p><p className="journal-muted">草稿不会计入年度总结。</p><div className="journal-stack"><Link className="journal-primary" to="/new">写第一篇记录</Link><Link className="journal-button" to="/drafts">打开草稿箱</Link></div><p className="journal-muted">已有其他年份的记录？可以通过右上角切换年份。</p></div>
    <ReflectionLinks entries={reflections} />{secondary}
  </>;

  return <>
    {view === "cover" && <>
      <h1>我的音乐年记</h1><p className="journal-muted">{year} 年 · 记录截至 {cutoff}</p><p className="journal-stat"><strong>{entries.length}</strong> 篇记录 <span>按记录时间整理</span></p>
      <div className="journal-cover"><JournalCover entry={cover} year={year} /><p>{journalTitle(cover)}{cover.artistName ? ` · ${cover.artistName}` : ""}</p></div>
      <div className="journal-actions"><Link className="journal-primary" to={href("work", entries[0].id)}>开始阅读</Link><button onClick={() => setExportKind("cover")}>分享年记</button></div>
      {edition.message && <div className="journal-quote"><small>给这一年的话</small><p>{edition.message}</p></div>}
      <AnnualFacts entries={entries} /><RecordScopeSummary musicCount={entries.length} reflectionCount={reflections.length} draftCount={draftCount} />
      {editionError && <p className="journal-error" role="alert">{editionError}；重新打开本页可重试。</p>}
      <div className="journal-actions journal-curation-actions"><Link className="journal-button" to={href("edit")}>编辑年度精选</Link>{edition.entryIds.length > 0 ? <span className="journal-muted">已选 {edition.entryIds.length} 篇代表作品</span> : null}</div>
      {edition.entryIds.length > 0 ? <section><h2>我的年度代表作品</h2>{edition.entryIds.map((id) => { const entry = entries.find((item) => item.id === id); return entry ? <Link className="journal-quote journal-representative" key={id} to={href("work", id)}><JournalCover entry={entry} /><div><small>{journalTitle(entry)} · {journalRating(entry)}</small><p>{journalQuote(entry, edition) ?? excerpt(entry.content, 100)}</p></div></Link> : null; })}</section> : <RecommendationSection entries={recommendations} href={href} />}
      <h2>这一年的记录</h2><div className="journal-contents"><Link to={href("overview")}>作品与记录日历 <span>{entries.length} 篇 →</span></Link><Link to={href("quotes")}>年度摘录 <span>查看 →</span></Link></div>
      <div className="journal-quote"><small>原文摘录 · {journalTitle(cover)}</small><p>{journalQuote(cover, edition) ?? excerpt(cover.content, 100)}</p></div>
    </>}
    {view === "overview" && <>
      <h1>年度总览</h1><p className="journal-muted">{year} 年 · 记录截至 {cutoff}</p><p className="journal-stat"><strong>{entries.length}</strong> 篇记录 <span>{counts.filter(Boolean).length} 个记录月份</span></p>
      <AnnualFacts entries={entries} /><RecordScopeSummary musicCount={entries.length} reflectionCount={reflections.length} draftCount={draftCount} />
      {entries.length >= 6 ? <><h2>月份记录</h2><p className="journal-muted">按首次正式保存时间统计；后续修改不改变月份。</p><div className="journal-bars" aria-label="十二个月记录数量">{counts.map((count, i) => <button key={i} aria-label={`${i + 1}月：${count}篇记录`} aria-pressed={params.get("month") === String(i + 1)} onClick={() => setMonth(String(i + 1))}><span className="journal-bar-area"><span className="journal-bar-value">{!count && journalFuture(year, i + 1) ? "—" : count}</span><i style={{ height: `${count / Math.max(1, ...counts) * 124}px` }} /></span><span>{i + 1}月</span></button>)}</div><p className="journal-muted journal-legend">0：暂无记录　—：月份未到</p><RecapInsights entries={entries} /></> : <p className="journal-muted journal-small-data">当前记录较少，先完整呈现作品与原文摘录，暂不做月份趋势解读。</p>}
      {entries.length <= 5 && <JournalQuotes entries={entries} href={href} edition={edition} compact />}
      <JournalList entries={entries} href={href} />
      <div className="journal-stack"><button className="journal-primary" onClick={() => setExportKind("overview")}>保存概览图片</button><button onClick={() => setExportKind("index")}>保存全年记录索引</button><button onClick={() => setExportKind("works")}>分批保存全年作品全文</button></div><p className="journal-muted">导出收录全年 {entries.length} 篇，不受当前筛选或折叠影响。</p>
    </>}
    {view === "edit" && <>
      <div className="journal-nav"><Link to={href("cover")}>← 年度封面</Link><span>{year}</span></div><h1>编辑年度精选</h1><p className="journal-muted">选择封面、代表作品、原句与寄语；保存后会保留在本机并随备份导出。</p>
      {editionError ? <p className="journal-error" role="alert">{editionError}</p> : editionReady ? <JournalEditor entries={entries} edition={edition} onSave={async (value) => { await store.setStoredAppData(JOURNAL_EDITION_PREFIX + year, JSON.stringify(value)); setEdition(value); const next = new URLSearchParams(params); next.set("view", "cover"); next.delete("entry"); setParams(next, { replace: true }); }} /> : <p role="status">正在读取年度精选…</p>}
    </>}
    {view === "work" && (selected ? <ReadingTools key={selected.id} progressKey={`entry:${selected.id}`} title={journalTitle(selected)} backTo={href("overview")} actions={<><button onClick={() => setSharing(true)}>分享</button><details className="codex-reader-menu"><summary aria-label="更多阅读操作">•••</summary><div><Link to={`/entries/${selected.id}/edit`}>编辑乐评</Link><Link to={href("edit")}>编辑年记</Link></div></details></>} footer={<>{entries.indexOf(selected) > 0 && <Link to={href("work", entries[entries.indexOf(selected) - 1].id)}>上一篇</Link>}{entries.indexOf(selected) < entries.length - 1 && <Link to={href("work", entries[entries.indexOf(selected) + 1].id)}>下一篇</Link>}</>}><section className="journal-work-view codex-journal-reading" data-entry-id={selected.id}>
      <p className="journal-muted">{entries.indexOf(selected) + 1} / {entries.length} 篇</p>
      <h1>{journalTitle(selected)}</h1><p>{selected.artistName || "未填写音乐人"} · {selected.type === "song" ? "歌曲" : "专辑"}</p>
      <div className="journal-work-header"><JournalCover entry={selected} /><div><p className="journal-muted">我的评分</p><strong>{journalRating(selected)}</strong></div></div>
      <p className="journal-muted">记录于 {journalDate(selected)}</p><section className="journal-body"><h2>当时的感受</h2>{selected.title !== journalTitle(selected) && <h3>{selected.title}</h3>}<p>{selected.content}</p></section>
      {selected.tags.length > 0 && <section><h2>记录标签</h2><div className="journal-tags">{selected.tags.map((tag) => <span key={tag}>{tag}</span>)}</div></section>}
      {selected.moods.length > 0 && <p className="journal-muted">记录情绪：{selected.moods.join("、")}</p>}
      <Link className="journal-text-link" to={`/entries/${encodeURIComponent(selected.id)}`}>查看完整乐评与编辑 →</Link>
    </section>{sharing && <ReviewShare entry={selected} onClose={() => setSharing(false)} />}</ReadingTools> : <><h1>记录不存在</h1><p>这篇记录已删除或不属于当前年份。</p><Link to={href("overview")}>返回年度总览</Link></>) }
    {view === "quotes" && <ReadingTools progressKey={`quotes:${year}`} title={`${year} 年度摘录`} backTo={href("overview")} actions={<button onClick={() => setExportKind("works")}>分享全年作品</button>}><div className="codex-journal-reading"><JournalQuotes entries={quoteEntries} href={href} edition={edition} /></div></ReadingTools>}
    {!['cover', 'overview', 'work', 'quotes', 'edit'].includes(view) && <Link to={href("cover")}>返回年度封面</Link>}
    {view !== "work" && view !== "quotes" && <><ReflectionLinks entries={reflections} />{secondary}</>}{exportDialog}
  </>;
}

function MonthRecap({ year, entries, states, loading, error }: { year: number; entries: ReviewEntry[]; states: Array<{ month: number; count: number; state: MonthlyRecapState; summary: MonthlySummary | null }>; loading: boolean; error: string }) {
  return <section className="journal-months-view">
    <h1>月度回顾</h1><p className="journal-muted">{year} 年 · 按首次正式保存时间查看每月正式音乐记录与月报状态。</p><p className="journal-stat"><strong>{entries.length}</strong> 篇正式音乐记录</p>
    {error ? <p className="journal-error" role="alert">{error}；状态已按需要更新保守显示。</p> : null}
    {loading ? <p role="status">正在读取月报状态…</p> : <div className="journal-month-grid">{states.map((item) => <Link key={item.month} className={`journal-month-card journal-month-${item.state}`} to={`/summary/${year}/${item.month}`}><div><span className="journal-month-number">{String(item.month).padStart(2, "0")}</span><strong>{item.count ? `${item.count} 篇正式音乐记录` : "暂无正式音乐记录"}</strong><small>{item.summary ? `月报生成于 ${recapDate(item.summary.generatedAt)}` : item.count ? "进入月报页可生成" : "该月没有计入年度回顾的正式音乐记录"}</small></div><span className="journal-month-status">{monthStateLabel(item.state)}</span><span aria-hidden="true">→</span></Link>)}</div>}
    <p className="journal-muted journal-month-footnote">月报状态依据当前正式音乐记录的来源快照判断；记录变化后会显示“需要更新”。月度、年度自述与草稿单独保留。</p>
  </section>;
}

function monthRecap(year: number, month: number, entries: ReviewEntry[], summaries: MonthlySummary[] | null, overrides: SemanticOverride[] | null, unavailable: boolean) {
  const sourceEntries = entries.filter((entry) => inRecordingPeriod(entry, year, month));
  if (!sourceEntries.length) return { month, count: 0, state: "no-records" as const, summary: null };
  const summary = summaries?.find((item) => item.year === year && item.month === month) ?? null;
  if (unavailable || summaries === null || overrides === null) return { month, count: sourceEntries.length, state: "needs-update" as const, summary };
  if (!summary) return { month, count: sourceEntries.length, state: "not-generated" as const, summary };
  try {
    const current = applySemanticOverrides(analyzeListeningEntries(sourceEntries), overrides).sourceFingerprint;
    const snapshot = parseMonthlyListeningSnapshot(summary.analysisJson);
    const generated = snapshot.dateBasis === "createdAt" && typeof summary.sourceFingerprint === "string" && summary.sourceFingerprint.length > 0 && summary.sourceFingerprint === current && snapshot.analysis.sourceFingerprint === current && snapshot.analysis.sourceEntryCount === sourceEntries.length && summary.sourceEntryCount === sourceEntries.length;
    return { month, count: sourceEntries.length, state: generated ? "generated" as const : "needs-update" as const, summary };
  } catch {
    return { month, count: sourceEntries.length, state: "needs-update" as const, summary };
  }
}

function monthStateLabel(state: MonthlyRecapState) {
  if (state === "no-records") return "暂无记录";
  if (state === "not-generated") return "未生成";
  if (state === "generated") return "已生成";
  return "需要更新";
}

function recapDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "日期无效" : `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, "0")}.${String(date.getDate()).padStart(2, "0")}`;
}

function AnnualFacts({ entries }: { entries: ReviewEntry[] }) {
  const rated = entries.filter((entry) => entry.rating !== null);
  const average = rated.length ? (rated.reduce((sum, entry) => sum + (entry.rating ?? 0), 0) / rated.length).toFixed(1) : "—";
  const albums = new Set(entries.filter((entry) => entry.albumName?.trim()).map((entry) => musicIdentityKey(entry, "album"))).size;
  const songs = new Set(entries.filter((entry) => entry.songName?.trim()).map((entry) => musicIdentityKey(entry, "song"))).size;
  const months = new Set(entries.map((entry) => new Date(entry.createdAt).getMonth() + 1)).size;
  return <div className="journal-facts" aria-label="年度记录统计"><div><strong>{albums}</strong><span>张不同专辑</span></div><div><strong>{songs}</strong><span>首不同歌曲</span></div><div><strong>{months}</strong><span>个活跃月份</span></div><div><strong>{average}</strong><span>平均评分 · {rated.length} 篇已评分</span></div></div>;
}

function musicIdentityKey(entry: ReviewEntry, kind: "album" | "song") {
  const catalogId = kind === "album" ? entry.musicMetadata?.catalogAlbumId : entry.musicMetadata?.catalogTrackId;
  if (catalogId?.trim()) return `${kind}:catalog:${catalogId.trim()}`;
  const name = kind === "album" ? entry.albumName : entry.songName;
  return JSON.stringify([kind, normalizeMusicIdentityText(name), normalizeMusicIdentityText(entry.artistName), kind === "song" ? normalizeMusicIdentityText(entry.albumName) : ""]);
}

function RecordScopeSummary({ musicCount, reflectionCount, draftCount }: { musicCount: number; reflectionCount: number; draftCount: number | null }) {
  return <section className="journal-scope-summary" aria-label="记录统计范围"><div><strong>{musicCount}</strong><span>正式音乐记录</span></div><div><strong>{reflectionCount}</strong><span>月度 / 年度自述</span></div><div><strong>{draftCount ?? "—"}</strong><span>草稿箱（未计入）</span></div></section>;
}

function RecommendationSection({ entries, href }: { entries: ReviewEntry[]; href: (view: string, entry?: string) => string }) {
  return <section className="journal-recommendations"><h2>按评分推荐的代表作品</h2>{entries.length ? <><p className="journal-muted">仅依据已保存的数值评分，最多显示 3 篇；可以在编辑页重新选择和排序。</p>{entries.map((entry) => <Link className="journal-quote" key={entry.id} to={href("work", entry.id)}><small>{journalTitle(entry)} · {journalRating(entry)}</small><p>{excerpt(entry.content, 100)}</p></Link>)}</> : <p className="journal-muted">还没有已评分作品，编辑页仍可手动选择代表作品。</p>}</section>;
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
  const listStateKey = `journal-yearbook-list:${params.get("year") ?? ""}:${month}:${query}:${sort}`;
  const defaultGroupLimit = entries.length <= 20 ? 12 : 3;
  const defaultShown = Object.fromEntries(months.map((monthNumber, index) => [monthNumber, entries.length <= 20 || index === 0 ? 20 : 0]));
  const savedListState = readListState(listStateKey);
  const [groupLimit, setGroupLimit] = useState(savedListState?.groupLimit ?? defaultGroupLimit);
  const [shown, setShown] = useState<Record<number, number>>(savedListState?.shown ?? defaultShown);
  useEffect(() => {
    const saved = readListState(listStateKey);
    setGroupLimit(saved?.groupLimit ?? defaultGroupLimit);
    setShown(saved?.shown ?? defaultShown);
  }, [listStateKey, entries]);
  useEffect(() => {
    try { sessionStorage.setItem(listStateKey, JSON.stringify({ groupLimit, shown })); } catch { /* session storage is optional on private WebViews */ }
  }, [listStateKey, groupLimit, shown]);
  const update = (key: string, value: string) => { const next = new URLSearchParams(params); if (value) next.set(key, value); else next.delete(key); setParams(next, { replace: true }); };
  const visibleMonths = months.slice(0, groupLimit);
  const visibleCount = visibleMonths.reduce((sum, monthNumber) => sum + Math.min(shown[monthNumber] ?? 0, matches.filter((entry) => new Date(entry.createdAt).getMonth() + 1 === monthNumber).length), 0);
  return <section className="journal-records">
    <div className="journal-nav"><h2>全部记录</h2><span>全年 {entries.length} 篇</span></div>
    <label className="journal-search"><span className="journal-sr-only">搜索作品或感受</span><input type="search" placeholder="搜索作品或感受" value={searchText} onChange={(e) => setSearchText(e.target.value)} /></label>
    <div className="journal-filters"><select aria-label="记录月份" value={month} onChange={(e) => update("month", e.target.value)}><option value="">全部月份</option>{Array.from({ length: 12 }, (_, i) => <option key={i} value={i + 1}>{i + 1} 月</option>)}</select><select aria-label="记录排序" value={sort} onChange={(e) => update("sort", e.target.value)}><option value="desc">时间倒序</option><option value="asc">时间正序</option></select></div>
    {(month || searchText) && <div className="journal-nav"><p className="journal-muted">匹配 {matches.length} 篇 / 全年 {entries.length} 篇</p><button onClick={() => { setSearchText(""); const next = new URLSearchParams(params); next.delete("month"); next.delete("q"); setParams(next, { replace: true }); }}>清除筛选</button></div>}
    {!matches.length && <p className="journal-empty-result">没有符合筛选条件的记录。可清除筛选查看全年。</p>}
    {visibleMonths.map((monthNumber) => {
      const group = matches.filter((entry) => new Date(entry.createdAt).getMonth() + 1 === monthNumber);
      const count = shown[monthNumber] ?? 0;
      return <section className="journal-month-group" key={monthNumber}><button className="journal-month-toggle" aria-expanded={count > 0} onClick={() => setShown({ ...shown, [monthNumber]: count ? 0 : 20 })}>{monthNumber} 月 · {group.length} 篇 <span>{count ? "收起 −" : "展开 ＋"}</span></button>
        {group.slice(0, count).map((entry) => <Link className="journal-record" key={entry.id} to={href("work", entry.id)}><JournalCover entry={entry} /><div><strong>{journalTitle(entry)}</strong><small>{journalDate(entry)} · {entry.type === "song" ? "歌曲" : "专辑"}</small></div><span aria-hidden="true">›</span></Link>)}
        {count > 0 && count < group.length && <button className="journal-more" onClick={() => setShown({ ...shown, [monthNumber]: count + 20 })}>再显示 {Math.min(20, group.length - count)} 篇（{monthNumber} 月）</button>}
      </section>;
    })}
    {months.length > groupLimit && <button className="journal-more" onClick={() => setGroupLimit((number) => number + 3)}>显示更多月份</button>}
    <p className="journal-muted journal-visible-count">已展开 {visibleCount} 篇 / 匹配 {matches.length} 篇 / 全年 {entries.length} 篇</p>
  </section>;
}

function readListState(key: string) {
  if (typeof sessionStorage === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { groupLimit?: unknown; shown?: unknown };
    const groupLimit = typeof parsed.groupLimit === "number" && Number.isInteger(parsed.groupLimit) && parsed.groupLimit > 0 ? parsed.groupLimit : null;
    const shown = parsed.shown && typeof parsed.shown === "object" && !Array.isArray(parsed.shown) ? Object.fromEntries(Object.entries(parsed.shown).filter(([, value]) => typeof value === "number" && Number.isInteger(value) && value >= 0)) as Record<number, number> : null;
    return groupLimit || shown ? { groupLimit, shown } : null;
  } catch { return null; }
}

function JournalQuotes({ entries, href, edition, compact = false, onExport }: { entries: ReviewEntry[]; href: (view: string, entry?: string) => string; edition: JournalEdition; compact?: boolean; onExport?: () => void }) {
  const [limit, setLimit] = useState(20);
  return <section className={compact ? "journal-quotes-preview" : "journal-quotes-page"}><h1 className={compact ? "journal-section-title" : undefined}>{compact ? "年度摘录" : "年度摘录"}</h1><p className="journal-muted">优先使用你选的原句，其余取正文开头；点击作品查看完整原文。</p>{entries.slice(0, limit).map((entry) => <Link className="journal-quote" to={href("work", entry.id)} key={entry.id}><small>{journalTitle(entry)} · {journalDate(entry)}</small><p>{journalQuote(entry, edition) ?? excerpt(entry.content, 180)}</p></Link>)}{limit < entries.length && <button onClick={() => setLimit(limit + 20)}>显示更多摘录</button>}{onExport ? <div className="journal-actions"><button className="journal-primary" onClick={onExport}>保存摘录所在作品全文</button></div> : null}</section>;
}

function ReflectionLinks({ entries }: { entries: ReviewEntry[] }) {
  return entries.length ? <details className="journal-reflections"><summary>月度与年度自述 · {entries.length} 篇（单独保存）</summary>{entries.map((entry) => <Link key={entry.id} to={`/entries/${encodeURIComponent(entry.id)}`}><span>{entry.type === "month" ? "月度自述" : "年度自述"}</span> {entry.title} →</Link>)}</details> : null;
}

function JournalSecondaryNav({ year }: { year: number }) {
  return <div className="journal-secondary-nav"><Link to={`/summary/analysis?year=${year}`}>月报与听感分析 →</Link><span>这是独立的语义分析入口；草稿不计入，月度与年度自述单独保留。</span></div>;
}

function JournalCover({ entry, year }: { entry: ReviewEntry; year?: number }) {
  const [source, setSource] = useState<string | null>(null);
  useEffect(() => {
    let active = true; setSource(null);
    void journalCover(entry).then((value) => { if (active) setSource(value); }).catch(() => { if (active) setSource(null); });
    return () => { active = false; };
  }, [entry]);
  return source ? <img className="journal-art" src={source} alt={`${journalTitle(entry)}封面`} loading="lazy" onError={() => setSource(null)} /> : year ? <div className="journal-type-cover"><small>我的音乐年记</small><strong>{year}</strong><span>{journalTitle(entry)}</span></div> : <div className="journal-art journal-placeholder" aria-label={`${journalTitle(entry)}暂无封面`}>{Array.from(journalTitle(entry))[0] || "音"}</div>;
}
