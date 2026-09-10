import { useEffect, useMemo, useState } from "react";
import { readJournalEdition, type JournalEdition } from "../../shared/backupAppData";
import { journalTitle } from "./codex_yearbookModel";
import type { ReviewEntry } from "./types";

export const EMPTY_EDITION: JournalEdition = { coverId: null, entryIds: [], quotes: {}, message: "" };
export function journalQuote(entry: ReviewEntry, edition: JournalEdition) {
  const quote = edition.quotes[entry.id];
  return quote && entry.content.includes(quote) ? quote : null;
}

export function JournalEditor({ entries, edition, onSave }: { entries: ReviewEntry[]; edition: JournalEdition; onSave: (value: JournalEdition) => Promise<void> }) {
  const [value, setValue] = useState(edition);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [query, setQuery] = useState("");
  const [limit, setLimit] = useState(20);
  useEffect(() => setValue(edition), [edition]);
  const recommendations = useMemo(() => entries.filter((entry) => entry.rating !== null).sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0) || b.createdAt.localeCompare(a.createdAt) || a.id.localeCompare(b.id)).slice(0, 3), [entries]);
  const matches = entries.filter((e) => `${journalTitle(e)} ${e.artistName ?? ""}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()));
  async function save() {
    setBusy(true); setNotice("");
    try {
      const quotes = Object.fromEntries(Object.entries(value.quotes).filter(([, quote]) => quote.trim()));
      for (const [id, quote] of Object.entries(quotes)) {
        if (!entries.find((e) => e.id === id)?.content.includes(quote)) throw new Error("摘录须为对应正文中连续的一段原话，请检查后保存。");
      }
      await onSave(readJournalEdition({ ...value, quotes })); setNotice("年度精选已保存");
    } catch (e) { setNotice(e instanceof Error ? e.message : "保存失败，请重试"); }
    finally { setBusy(false); }
  }
  function toggleEntry(id: string, checked: boolean) {
    setValue((old) => ({ ...old, entryIds: checked ? [...old.entryIds.filter((item) => item !== id), id] : old.entryIds.filter((item) => item !== id) }));
  }

  function moveEntry(id: string, offset: -1 | 1) {
    setValue((old) => {
      const index = old.entryIds.indexOf(id);
      const nextIndex = index + offset;
      if (index < 0 || nextIndex < 0 || nextIndex >= old.entryIds.length) return old;
      const entryIds = [...old.entryIds]; [entryIds[index], entryIds[nextIndex]] = [entryIds[nextIndex], entryIds[index]];
      return { ...old, entryIds };
    });
  }

  return <details className="journal-editor" open><summary>年度精选设置</summary><fieldset disabled={busy}>
    <label>封面作品<select aria-label="封面作品" value={value.coverId ?? entries[0]?.id} onChange={(e) => setValue({ ...value, coverId: e.target.value })}>{entries.map((e) => <option key={e.id} value={e.id}>{journalTitle(e)}</option>)}</select></label>
    <label>给这一年的话（选填，最多 120 字）<textarea value={value.message} maxLength={120} rows={3} onChange={(e) => setValue({ ...value, message: e.target.value })} /></label>
    <div className="journal-editor-heading"><strong>代表作品 · 已选 {value.entryIds.length} / 3 篇</strong><span>顺序会显示在年度封面</span></div>
    {recommendations.length ? <div className="journal-recommendation-box"><p><strong>按实际评分推荐</strong> · 仅作参考，不代替你的选择。</p><div>{recommendations.map((entry) => <span key={entry.id}>{journalTitle(entry)} · {entry.rating}{entry.ratingModifier ?? ""}</span>)}</div><button type="button" onClick={() => setValue({ ...value, entryIds: recommendations.map((entry) => entry.id) })}>使用评分推荐（替换当前选择）</button></div> : <p className="journal-muted">还没有已评分作品，下面可以手动选择。</p>}
    <label>查找代表作品<input value={query} onChange={(e) => { setQuery(e.target.value); setLimit(20); }} /></label>
    {matches.slice(0, limit).map((entry) => <label className="journal-check" key={entry.id}><input type="checkbox" checked={value.entryIds.includes(entry.id)} disabled={value.entryIds.length === 3 && !value.entryIds.includes(entry.id)} onChange={(e) => toggleEntry(entry.id, e.target.checked)} /><span>{journalTitle(entry)}{entry.rating === null ? " · 未评分" : ` · ${entry.rating}${entry.ratingModifier ?? ""}`}</span></label>)}
    {limit < matches.length && <button type="button" onClick={() => setLimit(limit + 20)}>显示更多作品</button>}
    {value.entryIds.length ? <div className="journal-selected-entries"><p>当前顺序</p>{value.entryIds.map((id, index) => { const entry = entries.find((item) => item.id === id); return entry ? <div className="journal-selected-entry" key={id}><strong>{index + 1}. {journalTitle(entry)}</strong><span><button type="button" aria-label={`上移 ${journalTitle(entry)}`} disabled={index === 0} onClick={() => moveEntry(id, -1)}>↑</button><button type="button" aria-label={`下移 ${journalTitle(entry)}`} disabled={index === value.entryIds.length - 1} onClick={() => moveEntry(id, 1)}>↓</button></span></div> : null; })}</div> : null}
    {Array.from(new Set([value.coverId ?? entries[0]?.id, ...value.entryIds])).map((id) => { const entry = entries.find((e) => e.id === id); return entry ? <div key={id}><label>{journalTitle(entry)} · 自选原句<textarea rows={3} maxLength={180} value={value.quotes[id] ?? ""} onChange={(e) => setValue({ ...value, quotes: { ...value.quotes, [id]: e.target.value } })} placeholder="从下面的原文中复制一句；留空则使用正文开头" /></label><details><summary>查看这篇原文</summary><p className="journal-source">{entry.content}</p></details></div> : null; })}
    <button className="journal-primary" type="button" onClick={() => void save()}>{busy ? "保存中…" : "保存年度精选"}</button>
    </fieldset>{notice && <p role="status">{notice}</p>}</details>;
}
