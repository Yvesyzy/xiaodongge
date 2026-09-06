import { useState } from "react";
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
  return <details className="journal-editor"><summary>编辑年度精选、封面与寄语</summary><fieldset disabled={busy}>
    <label>封面作品<select aria-label="封面作品" value={value.coverId ?? entries[0]?.id} onChange={(e) => setValue({ ...value, coverId: e.target.value })}>{entries.map((e) => <option key={e.id} value={e.id}>{journalTitle(e)}</option>)}</select></label>
    <label>给这一年的话（选填，最多 120 字）<textarea value={value.message} maxLength={120} rows={3} onChange={(e) => setValue({ ...value, message: e.target.value })} /></label>
    <p>代表作品 · 已选 {value.entryIds.length} / 3 篇</p>
    <label>查找代表作品<input value={query} onChange={(e) => { setQuery(e.target.value); setLimit(20); }} /></label>
    {matches.slice(0, limit).map((entry) => <label className="journal-check" key={entry.id}><input type="checkbox" checked={value.entryIds.includes(entry.id)} disabled={value.entryIds.length === 3 && !value.entryIds.includes(entry.id)} onChange={(e) => setValue({ ...value, entryIds: e.target.checked ? [...value.entryIds, entry.id] : value.entryIds.filter((id) => id !== entry.id) })} />{journalTitle(entry)}</label>)}
    {limit < matches.length && <button type="button" onClick={() => setLimit(limit + 20)}>显示更多作品</button>}
    {Array.from(new Set([value.coverId ?? entries[0]?.id, ...value.entryIds])).map((id) => { const entry = entries.find((e) => e.id === id); return entry ? <div key={id}><label>{journalTitle(entry)} · 自选原句<textarea rows={3} maxLength={180} value={value.quotes[id] ?? ""} onChange={(e) => setValue({ ...value, quotes: { ...value.quotes, [id]: e.target.value } })} placeholder="从下面的原文中复制一句；留空则使用正文开头" /></label><details><summary>查看这篇原文</summary><p className="journal-source">{entry.content}</p></details></div> : null; })}
    <button className="journal-primary" type="button" onClick={() => void save()}>{busy ? "保存中…" : "保存年度精选"}</button>
    </fieldset>{notice && <p role="status">{notice}</p>}</details>;
}
