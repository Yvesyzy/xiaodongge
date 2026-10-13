import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { Capacitor } from "@capacitor/core";
import { copyHtml, copyText } from "./nativeExport";
import { canLeavePage, useBackGuard } from "./codex_Navigation";
import { buildPublication, type PublicationDraft, type PublicationPrivacy, type PublicationSection } from "./codex_publicationModel";
import { buildPublicationZip } from "./codex_publicationZip";
import { loadPublicationDraft, removePublicationDraft, savePublicationDraft } from "./codex_publicationDraft";
import { DEFAULT_PUBLICATION_PRIVACY, publicationBlobBytes, publicationCover, publicationImageBytes, publicationSections, publicationRankSections, savePublicationBlob, sharePublicationBlob } from "./codex_publicationAssets";
import type { ReviewEntry } from "./types";
import type { YearTopAlbums } from "../../shared/backupAppData";
import "./codex_publication.css";

const errorText = (error: unknown) => error instanceof Error ? error.message : "操作失败，请重试。";
type Props = { sections: PublicationSection[]; title?: string; privacy?: PublicationPrivacy; onClose?: () => void; onBusyChange?: (busy: boolean) => void };
function freshDraft(sections: PublicationSection[], title?: string, privacy?: PublicationPrivacy): PublicationDraft {
  return { version: 1, title: title || (sections.length === 1 ? sections[0].title : "我的听感选集"), author: "", intro: "", sections, privacy: { ...DEFAULT_PUBLICATION_PRIVACY, ...privacy } };
}
export default function PublicationComposer({ sections, title, privacy, onClose, onBusyChange }: Props) {
  const ids = useMemo(() => sections.map(section => section.id), [sections]);
  const [initial] = useState(() => {
    const original = freshDraft(sections, title, privacy);
    try {
      const restored = loadPublicationDraft(ids);
      if (!restored) return { draft: original, restored: false, error: "" };
      return { draft: { ...restored, sections: restored.sections.map(section => ({ ...section, coverDataUrl: sections.find(source => source.id === section.id)?.coverDataUrl || null })),
        privacy: { hideContent: restored.privacy.hideContent || original.privacy.hideContent, hideRating: restored.privacy.hideRating || original.privacy.hideRating, hideDate: restored.privacy.hideDate || original.privacy.hideDate, hideBrand: restored.privacy.hideBrand || original.privacy.hideBrand } }, restored: true, error: "" };
    } catch { return { draft: original, restored: false, error: "本机推文草稿读取或校验失败，旧副本已保留。当前稿件仍可复制、导出。" }; }
  });
  const [draft, setDraft] = useState<PublicationDraft>(initial.draft);
  const current = useRef(draft);
  const [restoreError, setRestoreError] = useState(initial.error);
  const restoreBlocked = useRef(Boolean(initial.error));
  const [saveError, setSaveError] = useState("");
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const mounted = useRef(true);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [cover, setCover] = useState<{ blob: Blob; url: string } | null>(null);
  const [coverError, setCoverError] = useState("");
  const [preparedShare, setPreparedShare] = useState<{ draft: PublicationDraft; blob: Blob } | null>(null);
  const lastSaved = useRef("");
  const deferred = useDeferredValue(draft);
  const output = useMemo(() => { try { return { value: buildPublication(deferred), error: "" }; } catch (reason) { return { value: null, error: errorText(reason) }; } }, [deferred]);
  const updating = deferred !== draft;
  const firstImage = draft.sections.find(section => section.includeImage && section.coverDataUrl)?.coverDataUrl;
  const coverInput = useMemo(() => draft, [draft.title, draft.author, draft.privacy.hideBrand, firstImage]);

  function change(update: (value: PublicationDraft) => PublicationDraft) {
    setDraft(value => { const next = update(value); current.current = next; return next; });
    setSaved(false); setStatus(""); setError(""); setPreparedShare(null);
  }
  function saveNow() {
    if (restoreBlocked.current) return false;
    try {
      const signature = JSON.stringify({ ...current.current, sections: current.current.sections.map(section => ({ ...section, coverDataUrl: null })) });
      if (signature !== lastSaved.current) { savePublicationDraft(ids, current.current); lastSaved.current = signature; }
      if (mounted.current) { setSaveError(""); setSaved(true); }
      return true;
    } catch { if (mounted.current) { setSaveError("推文草稿未能自动保存，当前输入仍保留。请先复制或导出稿件。"); setSaved(false); } return false; }
  }
  useBackGuard(() => !lock.current && (saveNow() || window.confirm("这份推文还没有成功保存在本机，确认离开？建议先复制或导出。")));
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; saveNow(); };
  }, []);
  useEffect(() => { const timer = window.setTimeout(saveNow, 450); return () => window.clearTimeout(timer); }, [draft]);
  useEffect(() => {
    const unload = (event: BeforeUnloadEvent) => { if (lock.current || !saveNow()) { event.preventDefault(); event.returnValue = ""; } };
    window.addEventListener("beforeunload", unload); return () => window.removeEventListener("beforeunload", unload);
  }, []);
  useEffect(() => {
    let active = true; let url: string | null = null;
    setCover(null); setCoverError("");
    void publicationCover(coverInput).then(blob => { if (active) { url = URL.createObjectURL(blob); setCover({ blob, url }); } }).catch(reason => { if (active) setCoverError(errorText(reason)); });
    return () => { active = false; if (url) URL.revokeObjectURL(url); };
  }, [coverInput]);

  async function action(run: () => Promise<string>) {
    if (lock.current) return;
    lock.current = true; setBusy(true); onBusyChange?.(true); setError(""); setStatus(""); saveNow();
    try { const result = await run(); if (mounted.current) setStatus(result); }
    catch (reason) { if (mounted.current) setError(errorText(reason)); }
    finally { lock.current = false; onBusyChange?.(false); if (mounted.current) setBusy(false); }
  }
  async function materialPackage() {
    const value = buildPublication(current.current);
    const coverBlob = await publicationCover(current.current);
    const encoder = new TextEncoder();
    const instructions = "公众号稿使用说明\n\n1. 将标题填入公众号标题栏。\n2. 使用“复制排版正文”，或在浏览器打开HTML稿并复制正文。\n3. 正文中的配图位置对应本包PNG，需在公众号编辑器另行上传插入；横版封面可用于封面裁剪。\n4. 排版稿和图片均为本地导出，不代表已上传草稿或发布。\n5. 本包只含当前预览允许的内容；HTML含嵌入图片，单独打开也可阅读。\n";
    const files = [ { name: "codex_publication_article.html", data: encoder.encode(value.htmlDocument) }, { name: "codex_publication_title.txt", data: encoder.encode(value.title) },
      { name: "codex_publication_body.txt", data: encoder.encode(value.plainText) }, { name: "codex_publication_readme.txt", data: encoder.encode(instructions) },
      { name: "codex_publication_cover.png", data: await publicationBlobBytes(coverBlob) }, ...value.images.map(image => ({ name: image.fileName, data: publicationImageBytes(image.dataUrl) })) ];
    const bytes = buildPublicationZip(files);
    return new Blob([new Uint8Array(bytes).buffer], { type: "application/zip" });
  }
  async function shareMaterials() {
    // Preparing images can outlast the browser's user activation. Share the prepared file on the next click.
    if (!Capacitor.isNativePlatform() && preparedShare?.draft !== current.current) {
      const source = current.current;
      const blob = await materialPackage();
      setPreparedShare({ draft: source, blob });
      return "素材包已准备，请再次点击“分享素材包”打开系统分享。";
    }
    const blob = preparedShare?.draft === current.current ? preparedShare.blob : await materialPackage();
    return (await sharePublicationBlob(blob, `codex_publication_${crypto.randomUUID().slice(0,8)}.zip`)) === "cancelled"
      ? "已取消分享，稿件仍保留。" : "已打开系统分享，可把素材包发到电脑；尚未上传公众号。";
  }
  function saveMessage(result: "saved" | "cancelled" | "downloaded", noun: string) {
    return result === "cancelled" ? `已取消保存${noun}，当前稿件仍保留。` : result === "downloaded" ? `已发起下载${noun}，请在下载记录核对。` : `已保存${noun}。`;
  }
  function reset() {
    if (!window.confirm("放弃这份推文草稿并从所选原文重新生成？原乐评不会修改。")) return;
    try { removePublicationDraft(ids); restoreBlocked.current = false; setRestoreError(""); lastSaved.current = ""; change(() => freshDraft(sections, title, privacy)); }
    catch { setError("无法清除推文草稿，旧副本仍保留，请先导出当前稿件。"); }
  }
  return <section className="codex-publication" aria-labelledby="codex-publication-heading">
    <header className="codex-publication-heading"><div><h2 id="codex-publication-heading">生成公众号稿</h2><p>整理选定原文，预览确认后带到公众号后台。</p></div>{onClose ? <button className="secondary-button" type="button" disabled={busy} onClick={() => { if (canLeavePage()) onClose(); }}>返回选择</button> : null}</header>
    <p className="codex-publication-note">不修改原乐评，不联网改写或上传。图片需在公众号编辑器另行上传，粘贴效果以实际编辑器为准。</p>
    {initial.restored ? <p role="status">已恢复这组来源的本机推文草稿。</p> : null}
    {restoreError ? <p role="alert" className="error">{restoreError}</p> : null}
    <div className="codex-publication-layout">
      <div className="codex-publication-editor"><fieldset disabled={busy}>
        <label>推文标题<input value={draft.title} maxLength={200} onChange={event => change(value => ({ ...value, title: event.target.value }))} /></label>
        <label>署名（可选）<input value={draft.author} maxLength={100} onChange={event => change(value => ({ ...value, author: event.target.value }))} /></label>
        <label>导语（可选）<textarea value={draft.intro} rows={3} maxLength={20000} onChange={event => change(value => ({ ...value, intro: event.target.value }))} disabled={draft.privacy.hideContent} placeholder="可以留空，或写下你想说的开场。" /></label>
        <fieldset className="codex-publication-privacy"><legend>出稿内容</legend>{([ ["hideRating", "隐藏评分"], ["hideDate", "隐藏记录日期"], ["hideBrand", "隐藏小懂哥名称"], ["hideContent", "隐藏导语和正文"] ] as const).map(([key, label]) => <label key={key}><input type="checkbox" checked={draft.privacy[key]} onChange={event => change(value => ({ ...value, privacy: { ...value.privacy, [key]: event.target.checked } }))} />{label}</label>)}</fieldset>
        {draft.sections.map((section, index) => <details className="codex-publication-section-editor" key={section.id} open={draft.sections.length === 1}>
          <summary>第 {index + 1} 节 · {section.title || "未命名"}</summary>
          <label>第 {index + 1} 节标题<input value={section.title} maxLength={200} onChange={event => change(value => ({ ...value, sections: value.sections.map((item, i) => i === index ? { ...item, title: event.target.value } : item) }))} /></label>
          <label>第 {index + 1} 节正文<textarea rows={8} value={section.content} disabled={draft.privacy.hideContent} onChange={event => change(value => ({ ...value, sections: value.sections.map((item, i) => i === index ? { ...item, content: event.target.value } : item) }))} /></label>
          {section.coverDataUrl ? <label className="codex-publication-image-option"><input type="checkbox" checked={section.includeImage} onChange={event => change(value => ({ ...value, sections: value.sections.map((item, i) => i === index ? { ...item, includeImage: event.target.checked } : item) }))} />附上这一节的封面配图</label> : <p className="codex-publication-note">这一节没有可导出的本地封面。</p>}
        </details>)}
        <button className="secondary-button" type="button" onClick={reset}>从原文重新生成</button>
      </fieldset><p role="status" className="codex-publication-note">{saved ? "推文草稿已保存在本机。" : restoreError || saveError ? "推文草稿尚未成功保存。" : "正在保存推文草稿…"} 该草稿不属于乐评JSON备份，可导出HTML另存。</p>{saveError ? <p className="error" role="alert">{saveError}</p> : null}</div>
      <div><h3>正文排版预览</h3>{updating ? <p role="status">正在更新预览…</p> : null}{output.value ? <article className="codex-publication-preview" aria-label="公众号正文预览" dangerouslySetInnerHTML={{ __html: output.value.htmlFragment }} /> : <p role="alert" className="error">{output.error}</p>}
        <details className="codex-publication-images"><summary>横版封面与配图素材</summary>{cover ? <figure><img src={cover.url} alt="公众号稿横版封面预览" /><figcaption>横版封面 · 1200×510，可在公众号后台裁剪。</figcaption></figure> : <p role={coverError ? "alert" : "status"}>{coverError || "正在准备横版封面…"}</p>}{output.value?.images.map(image => <figure key={image.fileName}><img src={image.dataUrl} alt={image.caption} loading="lazy" /><figcaption>{image.fileName} · {image.caption}</figcaption></figure>)}</details>
      </div>
    </div>
    <footer className="codex-publication-actions"><div><button className="secondary-button" type="button" disabled={busy || updating || !output.value} onClick={() => void action(async () => { await copyText(buildPublication(current.current).title); return "已复制标题，请填入公众号标题栏。"; })}>复制标题</button><button className="primary-button" type="button" disabled={busy || updating || !output.value} onClick={() => void action(async () => { const value = buildPublication(current.current); await copyHtml(value.plainText, value.htmlFragment); return "已复制排版正文；图片请按位置说明另行上传，尚未发布。"; })}>复制排版正文</button><button className="secondary-button" type="button" disabled={busy || updating || !output.value} onClick={() => void action(async () => { await copyText(buildPublication(current.current).plainText); return "已复制纯文字正文。"; })}>复制纯文字正文</button></div>
      <div><button className="primary-button" type="button" disabled={busy || updating || !output.value} onClick={() => void action(async () => saveMessage(await savePublicationBlob(await materialPackage(), "codex_publication_materials.zip", "application/zip"), "稿件与配图包"))}>导出稿件与配图包</button><button className="secondary-button" type="button" disabled={busy || updating || !output.value} onClick={() => void action(async () => saveMessage(await savePublicationBlob(new Blob([buildPublication(current.current).htmlDocument], { type: "text/html" }), "codex_publication_article.html", "text/html"), "HTML稿"))}>导出HTML稿</button><button className="secondary-button" type="button" disabled={busy || updating || !output.value || !cover} onClick={() => void action(async () => saveMessage(await savePublicationBlob(await publicationCover(current.current), "codex_publication_cover.png", "image/png"), "横版封面"))}>导出横版封面</button><button className="secondary-button" type="button" disabled={busy || updating || !output.value} onClick={() => void action(shareMaterials)}>分享素材包</button></div>
      <p className="codex-publication-note">素材包包含HTML稿、标题、纯文字正文、横版封面、所选PNG配图与使用说明，最大8MiB。配图最长边不超过1024像素。</p>
      {busy ? <p role="status">正在处理，请稍候…</p> : null}{status ? <p role="status" className="codex-publication-status">{status}</p> : null}{error ? <p role="alert" className="error">{error}</p> : null}
    </footer>
  </section>;
}

export function EntryPublication({ entry, privacy, onBusyChange }: { entry: ReviewEntry; privacy?: PublicationPrivacy; onBusyChange?: (busy: boolean) => void }) {
  const [result, setResult] = useState<{ entry: ReviewEntry; sections: PublicationSection[]; warnings: string[] } | null>(null);
  const [error, setError] = useState("");
  useEffect(() => { let active = true; setError(""); void publicationSections([entry]).then(value => { if (active) setResult({ ...value, entry }); }).catch(reason => { if (active) setError(errorText(reason)); }); return () => { active = false; }; }, [entry]);
  return result?.entry === entry ? <>{result.warnings.map(warning => <p role="status" key={warning}>{warning}</p>)}<PublicationComposer key={JSON.stringify(result.sections.map(section => section.id))} sections={result.sections} title={entry.title} privacy={privacy} onBusyChange={onBusyChange} /></> : <p role={error ? "alert" : "status"}>{error || "正在准备公众号稿…"}</p>;
}
export function RankPublication({ year, rank, privacy, onClose, onBusyChange }: { year: number; rank: YearTopAlbums; privacy?: PublicationPrivacy; onClose: () => void; onBusyChange?: (busy:boolean)=>void }) {
  const [result, setResult] = useState<{ year: number; rank: YearTopAlbums; sections: PublicationSection[]; warnings: string[] } | null>(null);
  const [error, setError] = useState("");
  useEffect(() => { let active = true; setError(""); void publicationRankSections(year, rank).then(value => { if (active) setResult({ ...value, year, rank }); }).catch(reason => { if (active) setError(errorText(reason)); }); return () => { active = false; }; }, [year, rank]);
  return result?.year === year && result.rank === rank ? <>{result.warnings.map(warning => <p role="status" key={warning}>{warning}</p>)}<PublicationComposer key={JSON.stringify(result.sections.map(section => section.id))} sections={result.sections} title={`${year} 年度专辑榜单`} privacy={privacy} onClose={onClose} onBusyChange={onBusyChange} /></> : <><button className="secondary-button" type="button" onClick={onClose}>返回榜单</button><p role={error ? "alert" : "status"}>{error || "正在准备榜单推文…"}</p></>;
}
