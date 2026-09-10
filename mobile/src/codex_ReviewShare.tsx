import { useEffect, useMemo, useRef, useState } from "react";
import { Capacitor } from "@capacitor/core";
import { JournalExport } from "./codex_JournalExport";
import { journalCover, journalDate, journalRating, journalTitle } from "./codex_yearbookModel";
import { blobToBase64, downloadBlob } from "./shareCard";
import { NativeExport } from "./nativeExport";
import { ENTRY_TYPE_LABELS, type ReviewEntry } from "./types";
import type { JournalImageOptions, JournalShareTheme } from "./codex_yearbookPages";
import "./codex_reviewShare.css";

export type ReviewShareProps = {
  entry: ReviewEntry;
  onClose: () => void;
};

export type ReviewSharePrivacy = {
  hideContent: boolean;
  hideRating: boolean;
  hideDate: boolean;
  hideBrand: boolean;
};

export type ReviewExcerpt = {
  text: string;
  truncated: boolean;
  startsAt: number;
  endsAt: number;
};

const DEFAULT_PRIVACY: ReviewSharePrivacy = { hideContent: false, hideRating: false, hideDate: false, hideBrand: false };
const EXCERPT_LENGTH = 180;
// ponytail: a card holds at most 360 graphemes; longer text uses the existing paginated exporter.
const MAX_EXCERPT_LENGTH = 360;
const CARD_WIDTH = 1080;
const CARD_MIN_HEIGHT = 1440;
const CARD_FONT = '"Microsoft YaHei", "PingFang SC", system-ui, sans-serif';

export default function ReviewShare({ entry, onClose }: ReviewShareProps) {
  const dialog = useRef<HTMLDialogElement>(null);
  const lock = useRef(false);
  const [mode, setMode] = useState<"excerpt" | "pages">("excerpt");
  const [theme, setTheme] = useState<JournalShareTheme>("paper");
  const [privacy, setPrivacy] = useState<ReviewSharePrivacy>(DEFAULT_PRIVACY);
  const [excerptStart, setExcerptStart] = useState(0);
  const [excerptLength, setExcerptLength] = useState(EXCERPT_LENGTH);
  const [cover, setCover] = useState<string | null>(null);
  const [card, setCard] = useState<{ blob: Blob; url: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const native = Capacitor.isNativePlatform();
  const imageOptions = useMemo<JournalImageOptions>(() => ({ ...privacy, theme, review: true }), [privacy, theme]);
  const title = shareTitle(entry);
  const contentLength = useMemo(() => graphemes(entry.content).length, [entry.content]);
  const excerpt = useMemo(() => buildReviewExcerpt(entry.content, excerptLength, excerptStart), [entry.content, excerptLength, excerptStart]);
  const shareText = useMemo(() => buildReviewShareText(entry, privacy), [entry, privacy]);

  useEffect(() => {
    if (dialog.current && !dialog.current.open) dialog.current.showModal();
  }, []);

  useEffect(() => {
    let active = true;
    setCover(null);
    setExcerptStart(0);
    setExcerptLength(Math.min(EXCERPT_LENGTH, graphemes(entry.content).length));
    if (entry.type !== "song" && entry.type !== "album") return () => { active = false; };
    void journalCover(entry).then((value) => { if (active) setCover(value ?? null); }).catch(() => { if (active) setCover(null); });
    return () => { active = false; };
  }, [entry]);

  useEffect(() => {
    if (mode !== "excerpt") return;
    let active = true;
    let objectUrl: string | null = null;
    setCard(null);
    void renderReviewShareCard(entry, cover, privacy, theme, excerpt).then((blob) => {
      objectUrl = URL.createObjectURL(blob);
      if (!active) {
        URL.revokeObjectURL(objectUrl);
        return;
      }
      setCard({ blob, url: objectUrl });
    }).catch((reason: unknown) => {
      if (active) setError(reason instanceof Error ? reason.message : "摘录卡生成失败");
    });
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [entry, cover, privacy, theme, mode, excerpt]);

  function close() {
    if (!lock.current) onClose();
  }

  function updatePrivacy(key: keyof ReviewSharePrivacy, checked: boolean) {
    setError("");
    setStatus("");
    setPrivacy((current) => ({ ...current, [key]: checked }));
  }

  function updateExcerptStart(value: number) {
    setExcerptStart(Math.max(0, Math.min(value, Math.max(0, contentLength - excerptLength))));
  }

  function updateExcerptLength(value: number) {
    const nextLength = Math.max(0, Math.min(value, contentLength, MAX_EXCERPT_LENGTH));
    setExcerptLength(nextLength);
    setExcerptStart((current) => Math.min(current, Math.max(0, contentLength - nextLength)));
  }

  async function saveExcerpt() {
    if (!card || lock.current) return;
    lock.current = true;
    setBusy(true); setError(""); setStatus("");
    const fileName = reviewFileName(entry);
    try {
      if (native) {
        const result = await NativeExport.saveFile({ fileName, mimeType: "image/png", encoding: "base64", content: await blobToBase64(card.blob) });
        setStatus(result.status === "cancelled" ? "已取消保存摘录卡，当前设置已保留" : `已保存摘录卡：${fileName}`);
      } else {
        downloadBlob(card.blob, fileName);
        setStatus(`已开始下载摘录卡：${fileName}`);
      }
    } catch (reason) {
      setError(reason instanceof Error ? `保存失败：${reason.message}` : "保存失败，请重试");
    } finally {
      lock.current = false; setBusy(false);
    }
  }

  async function shareExcerpt() {
    if (!card || lock.current) return;
    lock.current = true;
    setBusy(true); setError(""); setStatus("");
    const fileName = reviewFileName(entry);
    try {
      if (native) {
        await NativeExport.shareFile({ fileName, mimeType: "image/png", encoding: "base64", content: await blobToBase64(card.blob) });
        setStatus("已打开系统分享，可发送这张摘录卡");
      } else {
        const file = new File([card.blob], fileName, { type: "image/png" });
        const shareAvailable = typeof navigator.share === "function"
          && (typeof navigator.canShare !== "function" || navigator.canShare({ files: [file] }));
        if (!shareAvailable) {
          downloadBlob(card.blob, fileName);
          setStatus("当前浏览器不支持直接分享，已改为下载摘录卡");
          return;
        }
        await navigator.share({ files: [file], title });
        setStatus("已打开系统分享，可发送这张摘录卡");
      }
    } catch (reason) {
      if (reason instanceof DOMException && reason.name === "AbortError") setStatus("已取消分享，当前设置已保留");
      else setError(reason instanceof Error ? `分享失败：${reason.message}` : "分享失败，请重试");
    } finally {
      lock.current = false; setBusy(false);
    }
  }

  async function copyShareText() {
    if (lock.current) return;
    lock.current = true;
    setBusy(true); setError(""); setStatus("");
    try {
      if (native) await NativeExport.copyText({ text: shareText });
      else if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(shareText);
      else throw new Error("当前浏览器不支持复制文字");
      setStatus("分享文字已复制");
    } catch (reason) {
      setError(reason instanceof Error ? `复制失败：${reason.message}` : "复制失败，请重试");
    } finally {
      lock.current = false; setBusy(false);
    }
  }

  return <dialog ref={dialog} className="review-share-dialog" aria-labelledby="review-share-title" onCancel={(event) => { if (lock.current) event.preventDefault(); else close(); }}>
    <div className="review-share-scroll">
      <header className="review-share-header">
        <div>
          <span className="review-share-eyebrow">SHARE THIS REVIEW</span>
          <h2 id="review-share-title">分享这篇记录</h2>
          <p>先看摘录卡，再选择完整分页；原文始终保留，长内容会自动续页。</p>
        </div>
        <button type="button" onClick={close} disabled={busy} aria-label="关闭分享预览">关闭</button>
      </header>

      <fieldset className="review-share-fieldset" disabled={busy}>
        <legend>分享内容</legend>
        <label><input type="radio" name="review-share-mode" checked={mode === "excerpt"} onChange={() => setMode("excerpt")} />摘录卡（默认）</label>
        <label><input type="radio" name="review-share-mode" checked={mode === "pages"} onChange={() => setMode("pages")} />完整分页</label>
      </fieldset>

      <fieldset className="review-share-fieldset" disabled={busy}>
        <legend>图片主题</legend>
        <label><input type="radio" name="review-share-theme" checked={theme === "paper"} onChange={() => setTheme("paper")} />纸张浅色</label>
        <label><input type="radio" name="review-share-theme" checked={theme === "dark"} onChange={() => setTheme("dark")} />深色</label>
      </fieldset>

      <fieldset className="review-share-fieldset review-share-privacy" disabled={busy}>
        <legend>隐私设置</legend>
        {([[
          "hideRating", "隐藏评分",
        ], [
          "hideDate", "隐藏日期",
        ], [
          "hideBrand", "隐藏小懂哥名称",
        ], [
          "hideContent", "隐藏正文",
        ]] as const).map(([key, label]) => <label key={key}><input type="checkbox" checked={privacy[key]} onChange={(event) => updatePrivacy(key, event.target.checked)} />{label}</label>)}
      </fieldset>

      {mode === "excerpt" ? <>
        <fieldset className="review-share-fieldset review-share-excerpt-controls" disabled={busy || privacy.hideContent}>
          <legend>选择摘录范围</legend>
          <label htmlFor="review-share-excerpt-start">摘录起点 <output>{excerpt.startsAt + 1 > contentLength ? 0 : excerpt.startsAt + 1}</output></label>
          <input id="review-share-excerpt-start" type="range" min="0" max={Math.max(0, contentLength - excerptLength)} value={excerptStart} onChange={(event) => updateExcerptStart(Number(event.target.value))} />
          <label htmlFor="review-share-excerpt-length">摘录长度 <output>{excerptLength}</output></label>
          <input id="review-share-excerpt-length" type="range" min="0" max={Math.min(contentLength, MAX_EXCERPT_LENGTH)} value={excerptLength} onChange={(event) => updateExcerptLength(Number(event.target.value))} />
          <p>选取最多 360 字连续原文；更长内容可切换完整分页。不会修改原记录。</p>
        </fieldset>
        <ReviewSharePreview entry={entry} imageUrl={card?.url ?? null} privacy={privacy} theme={theme} excerpt={excerpt} />
        <div className="review-share-actions">
          <button type="button" className="review-share-primary" onClick={() => void saveExcerpt()} disabled={!card || busy}>{busy ? "处理中…" : native ? "保存摘录卡" : "下载摘录卡"}</button>
          <button type="button" onClick={() => void shareExcerpt()} disabled={!card || busy}>系统分享</button>
          <button type="button" onClick={() => void copyShareText()} disabled={busy}>复制分享文字</button>
        </div>
      </> : <JournalExport year={entry.year} entries={[entry]} kind="works" review imageOptions={imageOptions} onClose={() => setMode("excerpt")} />}

      {status ? <p className="review-share-status" role="status" aria-live="polite">{status}</p> : null}
      {error ? <p className="review-share-error" role="alert">{error}</p> : null}
    </div>
  </dialog>;
}

export function buildReviewExcerpt(value: string, maxLength = EXCERPT_LENGTH, start = 0): ReviewExcerpt {
  const segments = graphemes(value);
  const safeStart = Math.max(0, Math.min(start, segments.length));
  const safeLength = Math.max(0, maxLength);
  if (safeLength <= 0) return { text: "", truncated: safeStart < segments.length, startsAt: safeStart, endsAt: safeStart };
  const selected = segments.slice(safeStart, safeStart + safeLength);
  return { text: selected.join(""), truncated: safeStart > 0 || safeStart + selected.length < segments.length, startsAt: safeStart, endsAt: safeStart + selected.length };
}

export function buildReviewShareText(entry: ReviewEntry, privacy: ReviewSharePrivacy): string {
  const lines = [shareTitle(entry), `${entry.artistName || "未填写音乐人"} · ${ENTRY_TYPE_LABELS[entry.type]}`];
  if (!privacy.hideDate) lines.push(`记录于 ${journalDate(entry)}`);
  if (!privacy.hideRating && entry.rating !== null) lines.push(`评分：${journalRating(entry)}`);
  if (!privacy.hideContent && entry.tags.length) lines.push(`标签：${entry.tags.join("、")}`);
  if (!privacy.hideContent && entry.moods.length) lines.push(`情绪：${entry.moods.join("、")}`);
  lines.push(privacy.hideContent ? "正文已隐藏" : entry.content);
  if (!privacy.hideBrand) lines.push("小懂哥 · 私人音乐档案");
  return lines.join("\n");
}

function ReviewSharePreview({ entry, imageUrl, privacy, theme, excerpt }: { entry: ReviewEntry; imageUrl: string | null; privacy: ReviewSharePrivacy; theme: JournalShareTheme; excerpt: ReviewExcerpt }) {
  const excerptText = privacy.hideContent ? "正文已隐藏" : excerpt.text || "暂无正文";
  return <article className="review-share-preview" data-theme={theme} aria-label="分享摘录预览">
    {imageUrl ? <img className="review-share-image" src={imageUrl} alt={`${shareTitle(entry)}的摘录分享图片`} /> : <p role="status">正在生成摘录预览…</p>}
    <div className="review-share-accessible">
    <span className="review-share-preview-eyebrow">分享摘录 · {ENTRY_TYPE_LABELS[entry.type]}</span>
    <h3>{shareTitle(entry)}</h3>
    <p className="review-share-preview-subtitle">{entry.artistName || "未填写音乐人"}</p>
    <div className="review-share-preview-meta">
      {!privacy.hideDate ? <span>记录于 {journalDate(entry)}</span> : null}
      {!privacy.hideRating && entry.rating !== null ? <span>评分 {journalRating(entry)}</span> : null}
    </div>
    <p className="review-share-preview-excerpt" data-source-excerpt={privacy.hideContent ? "" : excerpt.text}>{excerptText}{!privacy.hideContent && excerpt.truncated ? "…" : ""}</p>
    {!privacy.hideBrand ? <p className="review-share-preview-brand">小懂哥 · 私人音乐档案</p> : null}
    </div>
  </article>;
}

function shareTitle(entry: ReviewEntry) {
  return (entry.type === "month" || entry.type === "year" ? entry.title : journalTitle(entry)).trim() || "未命名记录";
}

function reviewFileName(entry: ReviewEntry) {
  const safeTitle = shareTitle(entry).replace(/[\\/:*?"<>|\u0000-\u001f]/g, " ").trim().replace(/\s+/g, "-").slice(0, 48) || "review";
  return `xiaodongge-review-${safeTitle}-${entry.year}.png`;
}

async function renderReviewShareCard(entry: ReviewEntry, cover: string | null, privacy: ReviewSharePrivacy, theme: JournalShareTheme, excerpt: ReviewExcerpt) {
  const canvas = document.createElement("canvas");
  canvas.width = CARD_WIDTH;
  canvas.height = CARD_MIN_HEIGHT;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("当前设备无法生成图片");
  const dark = theme === "dark";
  const palette = {
    background: dark ? "#142a24" : "#fafaf7",
    panel: dark ? "#1e3a31" : "#eef2ed",
    ink: dark ? "#f2f5ef" : "#202724",
    muted: dark ? "#adc0b6" : "#68726d",
    accent: dark ? "#9bd4bf" : "#245448",
    rule: dark ? "#36564a" : "#d6ddd7",
  };
  const titleLines = wrapCanvasText(ctx, shareTitle(entry), 896, 70, `700 70px ${CARD_FONT}`);
  const subtitle = `${entry.artistName || "未填写音乐人"} · ${ENTRY_TYPE_LABELS[entry.type]}`;
  const subtitleLines = wrapCanvasText(ctx, subtitle, 896, 32, `400 32px ${CARD_FONT}`);
  const excerptValue = privacy.hideContent ? "正文已隐藏" : excerpt.text || "暂无正文";
  const excerptLines = wrapCanvasText(ctx, excerptValue + (!privacy.hideContent && excerpt.truncated ? "…" : ""), 896, 30, `400 30px ${CARD_FONT}`);
  const optionalLines = [
    !privacy.hideDate ? `记录于 ${journalDate(entry)}` : null,
    !privacy.hideRating && entry.rating !== null ? `评分 ${journalRating(entry)}` : null,
  ].filter((line): line is string => !!line);
  let y = 666 + titleLines.length * 98 + 18 + subtitleLines.length * 46 + optionalLines.length * 60 + 76 + excerptLines.length * 48 + 130;
  if (y > 16000) throw new Error("标题或摘录过长，请缩短摘录范围或使用完整分页。");
  canvas.height = Math.max(CARD_MIN_HEIGHT, y);
  ctx.fillStyle = palette.background; ctx.fillRect(0, 0, canvas.width, canvas.height);
  await drawCardCover(ctx, cover, palette, 72, 64, 936, 450);
  y = 590;
  drawCanvasLines(ctx, "分享摘录", 72, y, 896, 28, 600, palette.accent);
  y += 76;
  drawCanvasLines(ctx, shareTitle(entry), 72, y, 896, 70, 700, palette.ink); y += titleLines.length * 98 + 18;
  drawCanvasLines(ctx, subtitle, 72, y, 896, 32, 400, palette.muted); y += subtitleLines.length * 46;
  for (const line of optionalLines) { y += 18; drawCanvasLines(ctx, line, 72, y, 896, 28, 500, palette.ink); y += 42; }
  ctx.strokeStyle = palette.rule; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(72, y + 16); ctx.lineTo(1008, y + 16); ctx.stroke(); y += 76;
  drawCanvasLines(ctx, excerptValue + (!privacy.hideContent && excerpt.truncated ? "…" : ""), 72, y, 896, 30, 400, palette.ink); y += excerptLines.length * 48 + 70;
  if (!privacy.hideBrand) drawCanvasLines(ctx, "小懂哥 · 私人音乐档案", 72, y, 896, 24, 500, palette.muted);
  return new Promise<Blob>((resolve, reject) => canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("图片生成失败")), "image/png"));
}

function wrapCanvasText(ctx: CanvasRenderingContext2D, value: string, width: number, size: number, font: string) {
  ctx.font = font;
  const lines: string[] = [];
  for (const paragraph of value.replace(/\r\n?/g, "\n").split("\n")) {
    let line = "";
    for (const segment of graphemes(paragraph)) {
      if (line && ctx.measureText(line + segment).width > width) { lines.push(line); line = ""; }
      line += segment;
    }
    lines.push(line);
  }
  return lines;
}

function drawCanvasLines(ctx: CanvasRenderingContext2D, value: string, x: number, y: number, width: number, size: number, weight: number, fill: string) {
  const lines = wrapCanvasText(ctx, value, width, size, `${weight} ${size}px ${CARD_FONT}`);
  ctx.font = `${weight} ${size}px ${CARD_FONT}`; ctx.fillStyle = fill;
  lines.forEach((line, index) => ctx.fillText(line, x, y + index * Math.round(size * 1.4)));
}

async function drawCardCover(ctx: CanvasRenderingContext2D, source: string | null, palette: { panel: string; accent: string }, x: number, y: number, width: number, height: number) {
  ctx.save(); roundedRect(ctx, x, y, width, height, 28); ctx.clip();
  ctx.fillStyle = palette.panel; ctx.fillRect(x, y, width, height);
  if (source?.startsWith("data:image/")) {
    try {
      const image = await loadImage(source);
      const scale = Math.max(width / image.naturalWidth, height / image.naturalHeight);
      const drawnWidth = image.naturalWidth * scale; const drawnHeight = image.naturalHeight * scale;
      ctx.drawImage(image, x + (width - drawnWidth) / 2, y + (height - drawnHeight) / 2, drawnWidth, drawnHeight);
      ctx.restore();
      return;
    } catch {
      // A missing or unreadable cover keeps the text card usable.
    }
  }
  ctx.strokeStyle = palette.accent; ctx.lineWidth = 3;
  for (let radius = 56; radius < 320; radius += 30) { ctx.beginPath(); ctx.arc(x + width / 2, y + height / 2, radius, 0, Math.PI * 2); ctx.stroke(); }
  ctx.restore();
}

function roundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number) {
  ctx.beginPath(); ctx.roundRect(x, y, width, height, radius);
}

function loadImage(source: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    const timer = window.setTimeout(() => { image.src = ""; reject(new Error("封面读取超时")); }, 4000);
    image.onload = () => { clearTimeout(timer); resolve(image); };
    image.onerror = () => { clearTimeout(timer); reject(new Error("封面读取失败")); };
    image.src = source;
  });
}

function graphemes(value: string) {
  if (typeof Intl.Segmenter === "function") return Array.from(new Intl.Segmenter("zh-CN", { granularity: "grapheme" }).segment(value), (part) => part.segment);
  return Array.from(value).reduce<string[]>((parts, char) => {
    if (parts.length && (/^[\p{Mark}\p{Emoji_Modifier}\u200d\ufe0f]$/u.test(char) || parts[parts.length - 1].endsWith("\u200d"))) parts[parts.length - 1] += char;
    else parts.push(char);
    return parts;
  }, []);
}
