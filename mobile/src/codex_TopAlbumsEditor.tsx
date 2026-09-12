import { useEffect, useMemo, useState } from "react";
import { readYearTopAlbums, type YearTopAlbums } from "../../shared/backupAppData";
import type { ReviewEntry } from "./types";
import { useBackGuard } from "./codex_Navigation";

export const EMPTY_TOP_ALBUMS: YearTopAlbums = { albums: [] };

export type TopAlbumCandidate = { key: string; albumName: string; artistName: string | null; rating: number | null; ratingLabel: string; entry: ReviewEntry };

const albumKey = (albumName: string, artistName: string | null) => JSON.stringify([albumName, artistName ?? ""]);

export function topAlbumCandidates(entries: ReviewEntry[]): TopAlbumCandidate[] {
  const groups = new Map<string, ReviewEntry[]>();
  for (const entry of entries) {
    if (entry.type !== "album" || !entry.albumName?.trim()) continue;
    const key = albumKey(entry.albumName, entry.artistName);
    groups.set(key, [...(groups.get(key) ?? []), entry]);
  }
  return Array.from(groups.entries()).map(([key, items]) => {
    const latest = [...items].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime() || b.id.localeCompare(a.id))[0];
    const albumName = latest.albumName as string;
    return { key, albumName, artistName: latest.artistName, rating: latest.rating, ratingLabel: latest.rating === null ? "未评分" : `${latest.rating}${latest.ratingModifier ?? ""}`, entry: latest };
  }).sort((a, b) => (b.rating ?? -1) - (a.rating ?? -1) || b.entry.createdAt.localeCompare(a.entry.createdAt) || a.albumName.localeCompare(b.albumName));
}

export function TopAlbumsEditor({ entries, saved, onSave }: { entries: ReviewEntry[]; saved: YearTopAlbums; onSave: (value: YearTopAlbums) => Promise<void> }) {
  const [value, setValue] = useState(saved);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [query, setQuery] = useState("");
  const [limit, setLimit] = useState(20);
  useBackGuard(() => !busy && (JSON.stringify(value) === JSON.stringify(saved) || window.confirm("年度专辑榜单尚未保存，确认放弃修改并返回？")));
  useEffect(() => setValue(saved), [saved]);
  const candidates = useMemo(() => topAlbumCandidates(entries), [entries]);
  const recommendations = candidates.filter((candidate) => candidate.rating !== null).slice(0, 15);
  const matches = candidates.filter((candidate) => `${candidate.albumName} ${candidate.artistName ?? ""}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()));
  async function save() {
    setBusy(true); setNotice("");
    try {
      await onSave(readYearTopAlbums({ ...value }));
      setNotice("年度专辑榜单已保存");
    } catch (e) { setNotice(e instanceof Error ? e.message : "保存失败，请重试"); }
    finally { setBusy(false); }
  }
  function toggle(candidate: TopAlbumCandidate, checked: boolean) {
    setValue((old) => ({ albums: checked ? [...old.albums, { albumName: candidate.albumName, artistName: candidate.artistName, note: "" }] : old.albums.filter((album) => albumKey(album.albumName, album.artistName) !== candidate.key) }));
  }
  function moveAlbum(index: number, offset: -1 | 1) {
    setValue((old) => {
      const nextIndex = index + offset;
      if (nextIndex < 0 || nextIndex >= old.albums.length) return old;
      const albums = [...old.albums];
      [albums[index], albums[nextIndex]] = [albums[nextIndex], albums[index]];
      return { albums };
    });
  }

  return <details className="journal-editor" open><summary>年度专辑榜单设置</summary><fieldset disabled={busy}>
    <div className="journal-editor-heading"><strong>榜单专辑 · 已选 {value.albums.length} / 15 张</strong><span>顺序即名次，第一名在最上</span></div>
    {!candidates.length ? <p className="journal-muted">今年还没有专辑类型的乐评记录，写下专辑乐评后即可入选榜单。</p> : recommendations.length ? <div className="journal-recommendation-box"><p><strong>按实际评分推荐</strong> · 仅作参考，不代替你的选择。</p><div>{recommendations.map((candidate) => <span key={candidate.key}>{candidate.albumName} · {candidate.ratingLabel}</span>)}</div><button type="button" onClick={() => setValue({ albums: recommendations.map((candidate) => { const kept = value.albums.find((album) => albumKey(album.albumName, album.artistName) === candidate.key); return { albumName: candidate.albumName, artistName: candidate.artistName, note: kept?.note ?? "" }; }) })}>使用评分推荐（替换当前选择）</button></div> : <p className="journal-muted">还没有已评分的专辑记录，下面可以手动选择。</p>}
    {!!candidates.length && <label>查找专辑<input value={query} onChange={(e) => { setQuery(e.target.value); setLimit(20); }} /></label>}
    {matches.slice(0, limit).map((candidate) => { const checked = value.albums.some((album) => albumKey(album.albumName, album.artistName) === candidate.key); return <label className="journal-check" key={candidate.key}><input type="checkbox" checked={checked} disabled={value.albums.length === 15 && !checked} onChange={(e) => toggle(candidate, e.target.checked)} /><span>{candidate.albumName}{candidate.artistName ? ` · ${candidate.artistName}` : ""} · {candidate.ratingLabel}</span></label>; })}
    {limit < matches.length && <button type="button" onClick={() => setLimit(limit + 20)}>显示更多专辑</button>}
    {value.albums.length ? <div className="journal-selected-entries"><p>当前名次</p>{value.albums.map((album, index) => <div className="journal-selected-entry" key={albumKey(album.albumName, album.artistName)}><strong>{index + 1}. {album.albumName}{album.artistName ? ` · ${album.artistName}` : ""}</strong><span><button type="button" aria-label={`上移 ${album.albumName}`} disabled={index === 0} onClick={() => moveAlbum(index, -1)}>↑</button><button type="button" aria-label={`下移 ${album.albumName}`} disabled={index === value.albums.length - 1} onClick={() => moveAlbum(index, 1)}>↓</button></span></div>)}</div> : null}
    {value.albums.map((album, index) => <label className="journal-rank-note" key={`${albumKey(album.albumName, album.artistName)}:note`}>{index + 1}. {album.albumName} · 入选理由（选填，最多 500 字）<textarea rows={3} maxLength={500} value={album.note} onChange={(e) => setValue((old) => ({ albums: old.albums.map((item, i) => i === index ? { ...item, note: e.target.value } : item) }))} placeholder="写下你将它选入年度榜单的理由…" /></label>)}
    <button className="journal-primary" type="button" onClick={() => void save()}>{busy ? "保存中…" : "保存年度专辑榜单"}</button>
  </fieldset>{notice && <p role="status">{notice}</p>}</details>;
}
