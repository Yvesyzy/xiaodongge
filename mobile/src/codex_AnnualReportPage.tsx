import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ANNUAL_REPORT_ALBUMS_PREFIX, readYearTopAlbums, type YearTopAlbum, type YearTopAlbums } from "../../shared/backupAppData";
import { EMPTY_TOP_ALBUMS, TopAlbumsEditor, topAlbumCandidates } from "./codex_TopAlbumsEditor";
import { entryDate, isNewRelease, releaseYearOf } from "./dateBasis";
import { store } from "./store";
import type { ReviewEntry } from "./types";
import "./codex_yearbook.css";

const albumKey = (album: YearTopAlbum) => JSON.stringify([album.albumName, album.artistName ?? ""]);

export default function AnnualReportPage() {
  const [params, setParams] = useSearchParams();
  const now = new Date();
  const rawYear = Number(params.get("year") ?? now.getFullYear());
  const year = Number.isInteger(rawYear) && rawYear >= 1 && rawYear <= 9999 ? rawYear : now.getFullYear();
  const view = params.get("view") ?? "report";
  const [all, setAll] = useState<ReviewEntry[] | null>(null);
  const [saved, setSaved] = useState<YearTopAlbums | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    let active = true;
    setAll(null); setError("");
    void store.listEntries().then((entries) => { if (active) setAll(entries); })
      .catch((e: unknown) => { if (active) setError(e instanceof Error ? e.message : "年度记录读取失败"); });
    return () => { active = false; };
  }, [year]);
  useEffect(() => {
    let active = true;
    setSaved(null);
    void store.getStoredAppData(ANNUAL_REPORT_ALBUMS_PREFIX + year).then((raw) => {
      if (active) setSaved(raw ? readYearTopAlbums(JSON.parse(raw)) : EMPTY_TOP_ALBUMS);
    }).catch((e: unknown) => { if (active) setError(e instanceof Error ? e.message : "年度报告榜单读取失败"); });
    return () => { active = false; };
  }, [year]);

  const data = useMemo(() => {
    const entries = all ?? [];
    const albumEntries = entries.filter((entry) => entry.type === "album" && !!entry.albumName?.trim());
    const freshEntries = albumEntries.filter((entry) => isNewRelease(entry, year));
    const backlistEntries = albumEntries.filter((entry) => releaseYearOf(entry) !== null && !isNewRelease(entry, year));
    const fresh = topAlbumCandidates(freshEntries);
    const backlist = topAlbumCandidates(backlistEntries).length;
    const rated = freshEntries.filter((entry) => entry.rating !== null);
    const average = rated.length ? (rated.reduce((sum, entry) => sum + (entry.rating ?? 0), 0) / rated.length).toFixed(1) : "—";
    const years = Array.from(new Set([now.getFullYear(), year, ...entries.map(releaseYearOf).filter((value): value is number => value !== null)])).sort((a, b) => b - a);
    return { entries, freshEntries, fresh, backlist, average, years, withFirstListen: freshEntries.filter((entry) => entryDate(entry, "firstListenedAt")).length };
  }, [all, year, now.getFullYear()]);

  const href = (nextView: "report" | "edit") => {
    const next = new URLSearchParams(params);
    next.set("year", String(year));
    if (nextView === "edit") next.set("view", "edit"); else next.delete("view");
    return `/annual-report?${next.toString()}`;
  };
  const ranked: YearTopAlbum[] = saved && saved.albums.length
    ? saved.albums
    : data.fresh.slice(0, 15).map((candidate) => ({ albumName: candidate.albumName, artistName: candidate.artistName, note: "" }));

  return <section className="journal journal-page annual-report-page">
    <div className="journal-nav">
      <Link to={`/summary?year=${year}`}>← 年度总结</Link>
      <label className="journal-year"><span className="journal-sr-only">年度报告年份</span>
        <select aria-label="年度报告年份" value={year} onChange={(event) => { const next = new URLSearchParams(params); next.set("year", event.target.value); next.delete("view"); setParams(next); }}>
          {data.years.map((item) => <option key={item} value={item}>{item}</option>)}
        </select>
      </label>
    </div>
    <span className="eyebrow">ANNUAL REPORT · NEW RELEASES</span>
    <h1>{year} 年度报告</h1>
    <p className="journal-muted">只统计 {year} 年发行、并且你已经写下乐评的专辑；按专辑/歌曲发行日期自动识别新老。年度总结与它分开，同时收录新专辑和往年专辑。</p>
    {error ? <p className="journal-error" role="alert">{error}</p> : null}
    {notice ? <p role="status" className="journal-muted">{notice}</p> : null}
    {all === null ? <p role="status">正在读取年度记录…</p> : <>
      <p className="journal-stat"><strong>{data.fresh.length}</strong> 张新专辑 <span>年度总结另收录 {data.backlist} 张往年专辑</span></p>
      <div className="journal-facts annual-report-facts">
        <div><strong>{data.freshEntries.length}</strong><span>篇新专辑乐评</span></div>
        <div><strong>{data.withFirstListen}</strong><span>填了首次收听</span></div>
        <div><strong>{data.fresh.length}</strong><span>张可判定发行日期</span></div>
        <div><strong>{data.average}</strong><span>平均评分 · {data.freshEntries.filter((entry) => entry.rating !== null).length} 篇已评分</span></div>
      </div>

      {view === "edit" ? <section className="annual-report-editor">
        <div className="journal-nav"><Link to={href("report")}>← 返回年度报告</Link><span>{year}</span></div>
        <h2>编辑年度前十五专辑</h2>
        <p className="journal-muted">候选只包含 {year} 年发行的新专辑；顺序即名次，理由由你书写。榜单与年度总结的专辑榜单分开保存，并随本地备份导出。</p>
        {saved ? <TopAlbumsEditor entries={data.freshEntries} saved={saved} onSave={async (value) => {
          await store.setStoredAppData(ANNUAL_REPORT_ALBUMS_PREFIX + year, JSON.stringify(value));
          setSaved(value);
          setNotice("年度报告榜单已保存");
          const next = new URLSearchParams(params); next.delete("view"); setParams(next, { replace: true });
        }} /> : <p role="status">正在读取榜单…</p>}
      </section> : <>
        <section className="annual-report-rank">
          <span className="eyebrow">TOP 15 · {year}</span>
          <h2>年度前十五专辑</h2>
          <p className="journal-muted">{saved && saved.albums.length ? "按你保存的名次与入选理由呈现。" : "尚无手动榜单，先按实际评分自动排出前 15 张；可在下方编辑名次与理由。"}</p>
          {ranked.length ? <ol className="journal-rank-list annual-report-rank-list">
            {ranked.map((album, index) => {
              const candidate = data.fresh.find((item) => item.key === albumKey(album));
              return <li className="journal-rank-item" key={albumKey(album)}>
                <span className="journal-rank-number" aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>
                {candidate ? <ReportCover entry={candidate.entry} /> : <div className="journal-art journal-placeholder" aria-label="暂无封面">♪</div>}
                <div className="journal-rank-info">
                  <strong>{album.albumName}<span className="journal-era-badge">NEW</span></strong>
                  <small>{album.artistName || "未填写音乐人"} · {candidate?.ratingLabel ?? "原记录已删除"}</small>
                  {candidate ? <p className="journal-muted annual-report-dates">发行 {entryDate(candidate.entry, "releaseDate") ?? "未填写"} · 首次收听 {entryDate(candidate.entry, "firstListenedAt") ?? "未填写"} · 乐评记录 {entryDate(candidate.entry, "recordedAt") ?? "未填写"}</p> : null}
                  {album.note.trim() ? <p>{album.note}</p> : null}
                  {candidate ? <Link className="journal-text-link" to={`/entries/${candidate.entry.id}`}>打开乐评 →</Link> : null}
                </div>
              </li>;
            })}
          </ol> : <div className="journal-empty"><span aria-hidden="true" className="journal-empty-icon">♪</span><h2>这一年还没有新专辑记录</h2><p>在乐评里填写专辑/歌曲发行日期，写下一张 {year} 年发行的专辑后，它会自动出现在这里。</p><div className="journal-stack"><Link className="journal-primary" to="/new">写一篇乐评</Link></div></div>}
        </section>
        <div className="journal-actions"><Link className="journal-button" to={href("edit")}>编辑年度前十五专辑</Link><Link className="journal-button" to={`/summary?year=${year}`}>返回年度总结</Link></div>
        {data.fresh.length > ranked.length ? <details className="annual-report-all"><summary>这一年发行的全部 {data.fresh.length} 张新专辑</summary>
          {data.fresh.map((candidate, index) => <p className="journal-muted" key={candidate.key}>{String(index + 1).padStart(2, "0")} · {candidate.albumName}{candidate.artistName ? ` / ${candidate.artistName}` : ""} · 发行 {entryDate(candidate.entry, "releaseDate") ?? "未填写"} · 首次收听 {entryDate(candidate.entry, "firstListenedAt") ?? "未填写"} · 乐评记录 {entryDate(candidate.entry, "recordedAt") ?? "未填写"}</p>)}
        </details> : null}
      </>}
      <p className="journal-muted annual-report-footnote">三种时间都精确到年月日；发行日期由乐评中的「专辑/歌曲发行日期」或当前播放补全的目录信息提供。没有发行日期的作品不会被误判为新专辑。</p>
    </>}
  </section>;
}

function ReportCover({ entry }: { entry: ReviewEntry }) {
  const [source, setSource] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    setSource(null);
    void store.getEntryCover(entry).then((value) => { if (active) setSource(value); }).catch(() => { if (active) setSource(null); });
    return () => { active = false; };
  }, [entry]);
  return source
    ? <img className="journal-art" src={source} alt={`${entry.albumName ?? entry.title}封面`} loading="lazy" onError={() => setSource(null)} />
    : <div className="journal-art journal-placeholder" aria-label="暂无封面">♪</div>;
}
