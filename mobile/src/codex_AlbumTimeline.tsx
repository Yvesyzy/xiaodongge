import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import type { YearTopAlbum } from "../../shared/backupAppData";
import { formatDateOnly } from "./format";
import { groupMusicEntries, normalizeMusicIdentityText } from "./musicIdentity";
import { store } from "./store";
import type { ListeningMoment, ReviewEntry } from "./types";

type SavedYear = { year: number; albums: YearTopAlbum[] };
type RankPoint = { startYear: number; endYear: number; rank: number | null; note: string };
export type AlbumTimeline = {
  key: string;
  albumName: string;
  artistName: string | null;
  ranks: RankPoint[];
  entries: ReviewEntry[];
  moments: ListeningMoment[];
};

function albumKey(albumName: string, artistName: string | null) {
  return JSON.stringify([normalizeMusicIdentityText(albumName), normalizeMusicIdentityText(artistName)]);
}

export function buildAlbumTimelines(saved: SavedYear[], entries: ReviewEntry[], moments: ListeningMoment[]): AlbumTimeline[] {
  const timelines = new Map<string, AlbumTimeline>();
  function get(albumName: string, artistName: string | null) {
    const key = albumKey(albumName, artistName);
    let timeline = timelines.get(key);
    if (!timeline) {
      timeline = { key, albumName, artistName, ranks: [], entries: [], moments: [] };
      timelines.set(key, timeline);
    }
    return timeline;
  }
  for (const year of saved) year.albums.forEach((album, index) => {
    get(album.albumName, album.artistName).ranks.push({ startYear: year.year, endYear: year.year, rank: index + 1, note: album.note });
  });
  const byEntry = new Map<string, AlbumTimeline>();
  for (const entry of entries) {
    if ((entry.type !== "album" && entry.type !== "song") || !normalizeMusicIdentityText(entry.albumName)) continue;
    const timeline = get(entry.albumName as string, entry.artistName);
    timeline.entries.push(entry);
    byEntry.set(entry.id, timeline);
  }
  for (const moment of moments) byEntry.get(moment.entryId)?.moments.push(moment);
  for (const timeline of timelines.values()) {
    timeline.ranks.sort((a, b) => a.startYear - b.startYear);
    const years = timeline.ranks;
    // ponytail: one range row represents a missing span; expand per-year only if users need to inspect long gaps individually.
    timeline.ranks = years.flatMap((rank, index) => index && rank.startYear > years[index - 1].startYear + 1
      ? [{ startYear: years[index - 1].startYear + 1, endYear: rank.startYear - 1, rank: null, note: "" }, rank]
      : [rank]);
    timeline.entries.sort((a, b) => b.createdAt.localeCompare(a.createdAt) || a.id.localeCompare(b.id));
    timeline.moments.sort((a, b) => b.listenedAt.localeCompare(a.listenedAt) || a.id.localeCompare(b.id));
  }
  return [...timelines.values()].sort((a, b) => (b.ranks.at(-1)?.endYear ?? 0) - (a.ranks.at(-1)?.endYear ?? 0)
    || a.albumName.localeCompare(b.albumName, "zh-CN") || (a.artistName ?? "").localeCompare(b.artistName ?? "", "zh-CN"));
}

export default function AlbumTimelinePage() {
  const [params] = useSearchParams();
  const [timelines, setTimelines] = useState<AlbumTimeline[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    Promise.all([store.listSavedTopAlbums(), store.listEntries(), store.listListeningMoments()])
      .then(([saved, entries, moments]) => { if (active) setTimelines(buildAlbumTimelines(saved, entries, moments)); })
      .catch(reason => { if (active) setError(reason instanceof Error ? reason.message : "专辑轨迹读取失败"); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);
  const selected = params.has("albumName")
    ? timelines.find(item => item.key === albumKey(params.get("albumName") ?? "", params.get("artistName")))
    : null;
  const sourceGroups = selected ? groupMusicEntries(selected.entries, "album") : [];
  return <section className="page album-timeline-page">
    <h1>跨年专辑轨迹</h1>
    <p className="lead">榜单名次来自当年保存的排序；乐评和重听显示的是当前保存版本，不冒充历史快照。</p>
    {loading ? <p role="status">正在整理本机专辑轨迹…</p> : error ? <p className="error" role="alert">{error}</p> : params.has("albumName") ? (
      selected ? <>
        <Link to="/albums/timeline" className="secondary-button">查看所有专辑</Link>
        <section className="form-card"><strong>{selected.albumName} · {selected.artistName ?? "艺术家未记录"}</strong>
          <p className="hint">{selected.ranks.filter(point => point.rank !== null).length} 个入榜年份 · {selected.entries.length} 条当前乐评 · {selected.moments.length} 次当前保存的重听</p>
          {sourceGroups.length > 1 ? <p>同名同艺人有 {sourceGroups.length} 组不同作品来源。旧榜单未保存目录 ID，名次无法确定归属哪一组。</p> : null}</section>
        <section className="form-card"><strong>榜单轨迹</strong>
          {selected.ranks.length ? <ol className="album-timeline-ranks">{selected.ranks.map(point => <li key={`${point.startYear}-${point.endYear}`}>
            {point.rank === null ? <span>{point.startYear === point.endYear ? point.startYear : `${point.startYear}–${point.endYear}`} · 未记录</span> : <>
              <Link to={`/summary?year=${point.startYear}&view=rank`}>{point.startYear} · 第 {point.rank} 名 · 查看保存的年度榜单</Link>
              {point.note ? <p>{point.note}</p> : null}
            </>}
          </li>)}</ol> : <p className="hint">没有保存过这张专辑的年度榜单名次。</p>}
          <p className="hint">旧榜单没有保存当年的乐评评分；榜单理由也可能在保存后编辑。</p>
        </section>
        <section className="form-card"><strong>当前乐评来源</strong>
          {sourceGroups.length ? sourceGroups.map((group, index) => <div key={group[0].id}>
            {sourceGroups.length > 1 ? <h3>同名来源 {index + 1}</h3> : null}<ul>{group.map(entry => <li key={entry.id}>
            <Link to={`/entries/${entry.id}`}>{entry.type === "album" ? "专辑" : "歌曲"}乐评 · {formatDateOnly(entry.createdAt)} · {entry.title}</Link>
            <span> · 当前评分：{entry.rating === null ? "未评分" : `${entry.rating}${entry.ratingModifier ?? ""}`}</span>
            <p>{entry.content}</p>
          </li>)}</ul></div>) : <p className="hint">原乐评未保留；仍可从上方回到已保存的榜单。</p>}
          <p className="hint">这里显示的是现在的乐评正文与评分；编辑前的版本没有保存。</p>
        </section>
        <section className="form-card"><strong>当前保存的重听</strong>
          {selected.moments.length ? sourceGroups.map((group, index) => {
            const ids = new Set(group.map(entry => entry.id));
            const related = selected.moments.filter(moment => ids.has(moment.entryId));
            return related.length ? <div key={group[0].id}>{sourceGroups.length > 1 ? <h3>同名来源 {index + 1}</h3> : null}<ul>{related.map(moment => <li key={moment.id}>
              <Link to={`/relisten/${moment.entryId}?moment=${encodeURIComponent(moment.id)}`}>{formatDateOnly(moment.listenedAt)} · 查看这次重听及来源</Link>
              <span> · 当前评分：{moment.rating === null ? "未评分" : `${moment.rating}${moment.ratingModifier ?? ""}`}</span><p>{moment.content}</p>
            </li>)}</ul></div> : null;
          }) : <p className="hint">还没有保存重听记录。</p>}
        </section>
      </> : <p className="hint">没有找到这张专辑的本机轨迹。<Link to="/albums/timeline">查看所有专辑</Link></p>
    ) : timelines.length ? <div className="card-list">{timelines.map(item => {
      const search = new URLSearchParams({ albumName: item.albumName, artistName: item.artistName ?? "" });
      return <Link className="entry-card" key={item.key} to={`/albums/timeline?${search.toString()}`}>
        <h2>{item.albumName}</h2><p>{item.artistName ?? "艺术家未记录"}</p>
        <p>入榜 {item.ranks.filter(point => point.rank !== null).length} 年 · 乐评 {item.entries.length} 条 · 重听 {item.moments.length} 次</p>
      </Link>;
    })}</div> : <p className="hint">还没有可整理的专辑乐评或年度榜单。</p>}
  </section>;
}
