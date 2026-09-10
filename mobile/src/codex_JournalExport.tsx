import { useEffect, useMemo, useRef, useState } from "react";
import { Capacitor } from "@capacitor/core";
import { NativeExport } from "./nativeExport";
import { blobToBase64, downloadBlob } from "./shareCard";
import { planJournalPages, renderJournalPage, type JournalExportKind, type JournalImagePage } from "./codex_yearbookPages";
import type { JournalEdition } from "../../shared/backupAppData";
import type { JournalImageOptions } from "./codex_yearbookPages";
import type { ReviewEntry } from "./types";

export type JournalExportProps = {
  year: number;
  entries: ReviewEntry[];
  kind: JournalExportKind;
  edition?: JournalEdition;
  onClose: () => void;
  /** Render the exporter inside another share surface instead of opening a dialog. */
  review?: boolean;
  imageOptions?: JournalImageOptions;
};

export function JournalExport({ year, entries, kind, edition, onClose, review = false, imageOptions }: JournalExportProps) {
  const dialog = useRef<HTMLDialogElement>(null);
  const lock = useRef(false);
  const [pages, setPages] = useState<JournalImagePage[]>([]);
  const [page, setPage] = useState(0);
  const [image, setImage] = useState<{ blob: Blob; url: string; page: number } | null>(null);
  const [privacy, setPrivacy] = useState({ hideContent: imageOptions?.hideContent ?? false, hideRating: imageOptions?.hideRating ?? false, hideDate: imageOptions?.hideDate ?? false, hideBrand: imageOptions?.hideBrand ?? false });
  const options = useMemo(() => ({ ...privacy, ...imageOptions, edition: edition ?? imageOptions?.edition, review: review || imageOptions?.review }), [privacy, imageOptions, edition, review]);
  const [selected, setSelected] = useState<number[]>([]);
  const [saved, setSaved] = useState<number[]>([]);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const [prepared, setPrepared] = useState<{ files: File[]; indexes: number[] } | null>(null);
  const [thumbs, setThumbs] = useState<Record<number, string>>({});
  const [batch, setBatch] = useState(0);
  const [exportDate] = useState(() => new Date());
  const native = Capacitor.isNativePlatform();
  const selectedPages = selected.slice().sort((a, b) => a - b);
  const sharePages = selectedPages.slice(batch * 9, batch * 9 + 9);
  const fileName = (index: number) => `${review ? "xiaodongge-review" : "xiaodongge"}-${year}-${kind}-${String(index + 1).padStart(3, "0")}-of-${pages.length}.png`;
  const render = (index: number) => renderJournalPage(year, entries, pages[index], index, pages.length, exportDate, options);

  useEffect(() => {
    if (!review && dialog.current && !dialog.current.open) dialog.current.showModal();
  }, [review]);
  useEffect(() => {
    let active = true;
    setPages([]); setImage(null); setSaved([]); setPrepared(null); setThumbs({}); setError(""); setStatus(""); setPage(0); setBatch(0);
    void planJournalPages(year, entries, kind, options).then((result) => {
      if (active) { setPages(result); setSelected(result.length ? [0] : []); }
    }).catch((e: unknown) => { if (active) setError(e instanceof Error ? e.message : "分页失败"); });
    return () => { active = false; };
  }, [year, entries, kind, options]);
  useEffect(() => {
    if (!pages[page]) return;
    let active = true; let url: string | null = null;
    setImage(null); setError("");
    void renderJournalPage(year, entries, pages[page], page, pages.length, exportDate, options).then((blob) => {
      if (!active) return;
      url = URL.createObjectURL(blob); setImage({ blob, url, page });
    }).catch((e: unknown) => { if (active) setError(e instanceof Error ? e.message : "图片生成失败"); });
    return () => { active = false; if (url) URL.revokeObjectURL(url); };
  }, [year, entries, page, pages, options, exportDate]);
  useEffect(() => {
    let active = true; setThumbs({});
    // ponytail: five nearby thumbnails, generated sequentially; virtualize before expanding this window.
    void (async () => {
      for (let i = Math.max(0, page - 2); i < Math.min(pages.length, page + 3); i++) {
        if (!active) return;
        const blob = await renderJournalPage(year, entries, pages[i], i, pages.length, exportDate, options);
        if (!active) return;
        const bitmap = await createImageBitmap(blob);
        try {
          if (!active) return;
          const canvas = document.createElement("canvas"); canvas.width = 86; canvas.height = 134;
          const ctx = canvas.getContext("2d"); if (!ctx) return;
          ctx.drawImage(bitmap, 0, 0, 86, 134);
          const url = canvas.toDataURL("image/png"); canvas.width = 0;
          setThumbs((old) => ({ ...old, [i]: url }));
        } finally { bitmap.close(); }
      }
    })().catch(() => { /* Numbered navigation remains available if thumbnails cannot render. */ });
    return () => { active = false; };
  }, [year, entries, page, pages, options, exportDate]);

  function choose(indexes: number[]) { setSelected(indexes); setBatch(0); setPrepared(null); setStatus(""); }
  function markSaved(indexes: number[]) { setSaved((old) => Array.from(new Set([...old, ...indexes]))); }
  async function saveImages(indexes: number[]) {
    if (!indexes.length || lock.current || !image) return;
    lock.current = true; setBusy(true); setError(""); setStatus("");
    try {
      if (native && indexes.length > 1) {
        const tokens: string[] = [];
        for (const [n, index] of indexes.entries()) {
          setStatus(`正在准备 ${n + 1} / ${indexes.length} 页…`);
          const result = await NativeExport.stageFile({ fileName: fileName(index), mimeType: "image/png", encoding: "base64", content: await blobToBase64(await render(index)) });
          tokens.push(result.token);
        }
        setStatus("请选择保存图片的文件夹");
        const result = await NativeExport.saveFiles({ tokens });
        markSaved(indexes.filter((_, i) => result.saved.includes(tokens[i])));
        setStatus(result.status === "cancelled" ? "已取消保存，所选页面仍可重试" : `已保存 ${result.saved.length} / ${indexes.length} 页`);
        if (result.error) setError(`部分图片未保存：${result.error}。可点击“选择未保存页”重试。`);
      } else {
        for (const index of indexes) {
          const blob = index === image.page ? image.blob : await render(index);
          if (native) {
            const result = await NativeExport.saveFile({ fileName: fileName(index), mimeType: "image/png", encoding: "base64", content: await blobToBase64(blob) });
            if (result.status === "cancelled") { setStatus("已取消保存，当前页仍可重试"); return; }
          } else downloadBlob(blob, fileName(index));
          markSaved([index]);
        }
        setStatus(native ? `已保存 ${indexes.length} 页` : `已发起 ${indexes.length} 页下载；若浏览器拦截多文件，请允许下载或逐页保存。`);
      }
    } catch (e) { setError(e instanceof Error ? e.message : "保存失败，请重试"); }
    finally { lock.current = false; setBusy(false); }
  }

  async function shareImages() {
    if (!sharePages.length || lock.current || !image) return;
    lock.current = true; setBusy(true); setError(""); setStatus("");
    try {
      if (native) {
        const tokens: string[] = [];
        for (const index of sharePages) {
          const blob = index === image.page ? image.blob : await render(index);
          const result = await NativeExport.stageFile({ fileName: fileName(index), mimeType: "image/png", encoding: "base64", content: await blobToBase64(blob) }); tokens.push(result.token);
        }
        await NativeExport.shareFiles({ tokens }); setStatus(`已打开系统分享 · 本批 ${tokens.length} 页`);
      } else {
        // Prepare multiple images before the next click to preserve Web Share user activation.
        let ready = prepared;
        if (!ready && sharePages.length === 1 && sharePages[0] === image.page) ready = { files: [new File([image.blob], fileName(page), { type: "image/png" })], indexes: sharePages };
        if (ready) {
          if (navigator.share && (!navigator.canShare || navigator.canShare({ files: ready.files }))) {
            await navigator.share({ files: ready.files, title: `${year} 我的音乐年记` }); setStatus("已打开系统分享");
          } else {
            for (const file of ready.files) downloadBlob(file, file.name);
            markSaved(ready.indexes); setStatus("浏览器不支持图片分享，已发起本批图片下载。");
          }
        } else {
          const files: File[] = []; let bytes = 0;
          for (const index of sharePages) {
            const blob = await render(index); bytes += blob.size;
            // ponytail: 32 MiB bounds browser share memory; use fewer pages for large covers.
            if (bytes > 32 * 1024 * 1024) throw new Error("本批图片超过 32 MB，请减少所选页数后重试。");
            files.push(new File([blob], fileName(index), { type: "image/png" }));
          }
          setPrepared({ files, indexes: sharePages }); setStatus("本批图片已准备，请再次点击系统分享。");
        }
      }
    } catch (e) {
      if (e instanceof Error && e.name === "AbortError") setStatus(sharePages.length === 1 ? "已取消分享，当前页仍可重试" : "已取消分享，所选页面仍可重试");
      else setError(e instanceof Error ? e.message : "分享失败，请重试");
    } finally { lock.current = false; setBusy(false); }
  }

  const nearby = pages.map((_, i) => i).slice(Math.max(0, page - 2), page + 3);
  const content = <>
    <div className="journal-export-scroll">
      <div className="journal-nav"><h2 id="journal-export-title">{review ? "完整作品分页" : kind === "works" ? "作品全文分页" : kind === "index" ? "全部记录索引" : "图片预览"}</h2><button onClick={onClose} disabled={busy} aria-label={review ? "返回摘录预览" : "关闭图片预览"}>{review ? "返回摘录预览" : "关闭"}</button></div>
      <p className="journal-muted">收录 {entries.length} 篇正式记录 · 共 {pages.length} 页。{review ? "完整正文自动续页。" : kind === "works" ? "长正文自动续页。" : kind === "index" ? "收录全年全部记录，不受筛选影响。" : "本图为概览，完整内容可另存作品页。"}导出与预览一致。</p>
      {!review && <details className="journal-privacy"><summary>图片隐私设置</summary>{([['hideRating', '隐藏评分'], ['hideDate', '隐藏具体日期（保留年度和月份统计）'], ['hideContent', '隐藏正文、摘录、寄语与标签']] as const).map(([key, label]) => <label className="journal-check" key={key}><input type="checkbox" checked={privacy[key]} disabled={busy} onChange={(e) => { setImage(null); setPrivacy({ ...privacy, [key]: e.target.checked }); }} />{label}</label>)}</details>}
      {pages.length > 0 && <>
        <nav className="journal-page-controls" aria-label="导出分页"><button disabled={busy || page === 0} onClick={() => setPage(page - 1)}>上一页</button><label>第 <select aria-label="导出页码" disabled={busy} value={page} onChange={(e) => setPage(Number(e.target.value))}>{pages.map((_, i) => <option key={i} value={i}>{i + 1}</option>)}</select> / {pages.length} 页</label><button disabled={busy || page === pages.length - 1} onClick={() => setPage(page + 1)}>下一页</button></nav>
        <div className="journal-thumbnails" aria-label="页面缩略图">{nearby.map((i) => <div key={i}><button aria-label={`预览第 ${i + 1} 页`} aria-current={i === page ? "page" : undefined} disabled={busy} onClick={() => setPage(i)}>{thumbs[i] ? <img src={thumbs[i]} alt="" /> : <span className="journal-thumb-placeholder">{i + 1}</span>}</button><label className="journal-check"><input type="checkbox" aria-label={`选择第 ${i + 1} 页`} checked={selected.includes(i)} disabled={busy} onChange={(e) => choose(e.target.checked ? [...selected, i] : selected.filter((n) => n !== i))} />{i + 1}{saved.includes(i) ? " ✓" : ""}</label></div>)}</div>
        <div className="journal-select-actions"><button disabled={busy} onClick={() => choose(selected.length === pages.length ? [] : pages.map((_, i) => i))}>{selected.length === pages.length ? "取消全选" : "选择全部页"}</button><button disabled={busy} onClick={() => choose(pages.map((_, i) => i).filter((i) => !saved.includes(i)))}>选择未保存页</button></div>
      </>}
      {image?.page === page ? <img className="journal-export-preview" src={image.url} alt={`${review ? "完整乐评" : `${year} 年度总结`}第 ${page + 1} 页预览`} /> : !error ? <p role="status">正在生成当前页图片…</p> : null}
    </div>
    <footer className="journal-export-footer">
      <p className="journal-muted">已选 {selected.length} 页 · {native ? "已保存" : "已发起下载"} {saved.length} / {pages.length} 页</p>
      {selected.length > 9 && <label className="journal-share-batch">每批最多 9 张 · 分享批次<select aria-label="分享批次" value={batch} disabled={busy} onChange={(e) => { setBatch(Number(e.target.value)); setPrepared(null); setStatus(""); }}>{Array.from({ length: Math.ceil(selected.length / 9) }, (_, i) => <option key={i} value={i}>第 {i + 1} 批</option>)}</select></label>}
      <div className="journal-actions"><button className="journal-primary" disabled={!image || busy || !selected.length || selected.length > 5000} onClick={() => void saveImages(selectedPages)}>{busy ? "处理中…" : `保存所选 ${selected.length} 页`}</button><button disabled={!image || busy || !selected.length} onClick={() => void shareImages()}>{prepared ? "系统分享（已准备）" : "系统分享"}</button></div>
      <button className="journal-save-current" disabled={image?.page !== page || busy} onClick={() => void saveImages([page])}>{native ? "保存当前页" : "下载当前页 PNG"}</button>
      {selected.length > 5000 && <p role="alert">单次文件夹保存最多 5000 页，请减少所选页数。</p>}
      {status && <p role="status">{status}</p>}{error && <p className="journal-error" role="alert">{error}</p>}
    </footer>
  </>;
  if (review) return <section className="journal-export journal review-journal-export" aria-labelledby="journal-export-title">{content}</section>;
  return <dialog ref={dialog} className="journal-export journal" aria-labelledby="journal-export-title" onCancel={(event) => { if (lock.current) event.preventDefault(); else onClose(); }}>{content}</dialog>;
}
