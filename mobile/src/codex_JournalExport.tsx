import { useEffect, useRef, useState } from "react";
import { Capacitor } from "@capacitor/core";
import { NativeExport } from "./nativeExport";
import { blobToBase64, downloadBlob } from "./shareCard";
import { planJournalPages, renderJournalPage, type JournalExportKind, type JournalImagePage } from "./codex_yearbookPages";
import type { ReviewEntry } from "./types";

export function JournalExport({ year, entries, kind, onClose }: { year: number; entries: ReviewEntry[]; kind: JournalExportKind; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const lock = useRef(false);
  const [pages, setPages] = useState<JournalImagePage[]>([]);
  const [page, setPage] = useState(0);
  const [image, setImage] = useState<{ blob: Blob; url: string; page: number } | null>(null);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState<number[]>([]);

  useEffect(() => { dialog.current?.showModal(); }, []);
  useEffect(() => {
    let active = true;
    void planJournalPages(year, entries, kind).then((result) => { if (active) setPages(result); })
      .catch((e: unknown) => { if (active) setError(e instanceof Error ? e.message : "分页失败"); });
    return () => { active = false; };
  }, [year, entries, kind]);
  useEffect(() => {
    if (!pages[page]) return;
    let active = true;
    let url: string | null = null;
    setImage(null); setError(""); setStatus("");
    // ponytail: render only the current 1080×1680 page; keep memory bounded for long yearbooks.
    void renderJournalPage(year, entries, pages[page], page, pages.length).then((blob) => {
      if (!active) return;
      url = URL.createObjectURL(blob); setImage({ blob, url, page });
    }).catch((e: unknown) => { if (active) setError(e instanceof Error ? e.message : "图片生成失败"); });
    return () => { active = false; if (url) URL.revokeObjectURL(url); };
  }, [year, entries, page, pages]);

  async function exportImage(share: boolean) {
    if (!image || image.page !== page || lock.current) return;
    lock.current = true; setBusy(true); setError(""); setStatus("");
    const fileName = `xiaodongge-${year}-${kind}-${String(page + 1).padStart(3, "0")}-of-${pages.length}.png`;
    try {
      if (Capacitor.isNativePlatform()) {
        const options = { fileName, mimeType: "image/png", content: await blobToBase64(image.blob), encoding: "base64" as const };
        if (share) { await NativeExport.shareFile(options); setStatus("已打开系统分享"); }
        else {
          const result = await NativeExport.saveFile(options);
          if (result.status === "cancelled") { setStatus("已取消保存，当前页仍可重试"); return; }
          setSaved((items) => Array.from(new Set([...items, page]))); setStatus(`第 ${page + 1} 页已保存`);
        }
      } else {
        const file = new File([image.blob], fileName, { type: "image/png" });
        if (share && navigator.share && (!navigator.canShare || navigator.canShare({ files: [file] }))) {
          await navigator.share({ files: [file], title: `${year} 我的音乐年记` }); setStatus("已打开系统分享");
        } else {
          downloadBlob(image.blob, fileName);
          setSaved((items) => Array.from(new Set([...items, page])));
          setStatus(`${share ? "浏览器不支持图片分享，" : ""}已开始下载第 ${page + 1} 页`);
        }
      }
    } catch (e) {
      if (e instanceof Error && e.name === "AbortError") setStatus("已取消分享，当前页仍可重试");
      else setError(e instanceof Error ? e.message : "导出失败，请重试");
    } finally { lock.current = false; setBusy(false); }
  }

  return <dialog ref={dialog} className="journal-export journal" aria-labelledby="journal-export-title" onCancel={(event) => { if (lock.current) event.preventDefault(); else onClose(); }}>
    <div className="journal-nav"><h2 id="journal-export-title">{kind === "works" ? "作品全文分页" : kind === "index" ? "全部记录索引" : "图片预览"}</h2><button onClick={onClose} disabled={busy} aria-label="关闭图片预览">关闭</button></div>
    <p className="journal-muted">收录 {entries.length} 篇正式记录{pages.length ? ` · 共 ${pages.length} 页` : " · 正在分页…"}。{kind === "works" ? "长正文续页，保留完整内容。" : kind === "index" ? "包含全年全部记录，不受列表筛选和折叠影响。" : "本图为概览，完整内容可另存作品页。"}</p>
    {pages.length > 0 && <nav className="journal-page-controls" aria-label="导出分页"><button disabled={busy || page === 0} onClick={() => setPage(page - 1)}>上一页</button><label>第 <select aria-label="导出页码" disabled={busy} value={page} onChange={(e) => setPage(Number(e.target.value))}>{pages.map((_, i) => <option key={i} value={i}>{i + 1}</option>)}</select> / {pages.length} 页</label><button disabled={busy || page === pages.length - 1} onClick={() => setPage(page + 1)}>下一页</button></nav>}
    {image?.page === page ? <img className="journal-export-preview" src={image.url} alt={`${year} 年度总结第 ${page + 1} 页预览`} /> : !error ? <p role="status">正在生成当前页图片…</p> : null}
    <p className="journal-muted">{Capacitor.isNativePlatform() ? "已保存" : "已发起下载"} {saved.length} / {pages.length} 页。图片会包含预览中的记录信息。</p>
    <div className="journal-actions"><button className="journal-primary" disabled={image?.page !== page || busy} onClick={() => void exportImage(false)}>{busy ? "处理中…" : Capacitor.isNativePlatform() ? "保存当前页" : "下载当前页 PNG"}</button><button disabled={image?.page !== page || busy} onClick={() => void exportImage(true)}>系统分享</button></div>
    {status && <p role="status">{status}</p>}{error && <p className="journal-error" role="alert">{error}</p>}
  </dialog>;
}
