import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { store } from "./store";
import { ENTRY_TYPE_LABELS, type ReviewEntry } from "./types";
import { canLeavePage } from "./codex_Navigation";
import PublicationComposer from "./codex_PublicationComposer";
import { publicationSections } from "./codex_publicationAssets";
import type { PublicationSection } from "./codex_publicationModel";
import "./codex_publication.css";

export default function PublicationPage() {
  const [params] = useSearchParams();
  const initialEntry = params.get("entry");
  const [entries, setEntries] = useState<ReviewEntry[] | null>(null);
  const [selected, setSelected] = useState<string[]>(initialEntry ? [initialEntry] : []);
  const [query, setQuery] = useState("");
  const [year, setYear] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [prepared, setPrepared] = useState<{ sections: PublicationSection[]; warnings: string[] } | null>(null);
  async function load() { setError(""); try { setEntries(await store.listEntries()); } catch (reason) { setError(reason instanceof Error ? reason.message : "记录读取失败"); } }
  useEffect(() => { void load(); }, []);
  useEffect(() => {
    const leave = (event: MouseEvent) => { const link = event.target instanceof Element ? event.target.closest<HTMLAnchorElement>("a[href]") : null; if (link && !event.defaultPrevented && event.button === 0 && !event.ctrlKey && !event.metaKey && !event.shiftKey && !event.altKey && link.target !== "_blank" && !link.hasAttribute("download") && link.href !== window.location.href && !canLeavePage()) { event.preventDefault(); event.stopPropagation(); } };
    document.addEventListener("click", leave, true); return () => document.removeEventListener("click", leave, true);
  }, []);
  const years = useMemo(() => [...new Set((entries || []).map(entry => entry.year))].sort((a,b) => b-a), [entries]);
  const visible = useMemo(() => (entries || []).filter(entry => (!year || String(entry.year) === year) && (!query.trim() || [entry.title, entry.albumName, entry.songName, entry.artistName].some(value => value?.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())))), [entries, year, query]);
  function toggle(id: string) { setSelected(current => current.includes(id) ? current.filter(item => item !== id) : [...current, id]); }
  function move(index: number, offset: number) { setSelected(current => { const next = [...current]; [next[index],next[index+offset]] = [next[index+offset],next[index]]; return next; }); }
  async function prepare() {
    if (busy || !entries) return;
    const chosen = selected.map(id => entries.find(entry => entry.id === id)).filter((entry): entry is ReviewEntry => Boolean(entry));
    if (!chosen.length) { setError("请先选择至少一篇正式记录。"); return; }
    setBusy(true); setError("");
    try { setPrepared(await publicationSections(chosen)); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "公众号稿准备失败"); }
    finally { setBusy(false); }
  }
  return <section className="page codex-publication-page"><header className="page-heading codex-publication-page-heading"><div><h1>公众号出稿</h1><p>把选定听感整理成一篇作品，原文留在本机。</p></div><Link className="secondary-button" to="/more">更多</Link></header>
    {prepared ? <>{prepared.warnings.map(warning => <p key={warning} role="status">{warning}</p>)}<PublicationComposer key={JSON.stringify(prepared.sections.map(section => section.id))} sections={prepared.sections} onClose={() => setPrepared(null)} /></> : <>
      <section className="content-card codex-publication-picker"><h2>选择正文来源</h2><p>按选择顺序编排。也可从乐评、月报、年报的分享面板进入，或从年度榜单导出面板生成榜单文章。</p>
        <fieldset disabled={busy}><div className="codex-publication-filter"><label>查找记录<input value={query} onChange={event => setQuery(event.target.value)} placeholder="标题、专辑或音乐人" /></label><label>记录年份<select value={year} onChange={event => setYear(event.target.value)}><option value="">全部年份</option>{years.map(item => <option key={item}>{item}</option>)}</select></label></div>
          {entries === null ? <p role="status">{error ? "记录暂未加载。" : "正在读取本地记录…"}</p> : !visible.length ? <p>没有匹配记录。先保存一篇乐评，再来整理。</p> : <div className="codex-publication-source-list">{visible.map(entry => <label key={entry.id}><input type="checkbox" checked={selected.includes(entry.id)} onChange={() => toggle(entry.id)} /><span><strong>{entry.title}</strong><small>{ENTRY_TYPE_LABELS[entry.type]} · {entry.year} · {[entry.albumName,entry.songName,entry.artistName].filter(Boolean).join(" / ")}</small></span></label>)}</div>}
          {selected.length ? <><h3>出稿顺序 · {selected.length} 篇</h3><ol className="codex-publication-order">{selected.map((id,index) => <li key={id}><span>{entries?.find(entry=>entry.id===id)?.title || "来源已不存在"}</span><div><button className="secondary-button" type="button" aria-label={`第${index+1}篇上移`} disabled={index===0} onClick={()=>move(index,-1)}>上移</button><button className="secondary-button" type="button" aria-label={`第${index+1}篇下移`} disabled={index===selected.length-1} onClick={()=>move(index,1)}>下移</button><button className="secondary-button" type="button" aria-label={`移除第${index+1}篇`} onClick={()=>toggle(id)}>移除</button></div></li>)}</ol></> : null}
          <button className="primary-button" type="button" disabled={!selected.length || !entries} onClick={()=>void prepare()}>{busy ? "正在整理…" : "生成公众号稿"}</button>
        </fieldset>
      </section>{entries===null && error ? <button className="secondary-button" type="button" onClick={()=>void load()}>重新读取记录</button> : null}
    </>}{error ? <p role="alert" className="error">{error}</p> : null}
  </section>;
}
