import { Capacitor } from "@capacitor/core";
import { NativeExport, saveFile } from "./nativeExport";
import { blobToBase64, downloadBlob } from "./shareCard";
import { journalDate, journalRating } from "./codex_yearbookModel";
import { store } from "./store";
import type { ReviewEntry } from "./types";
import type { YearTopAlbums } from "../../shared/backupAppData";
import type { PublicationDraft, PublicationSection } from "./codex_publicationModel";

export const PUBLICATION_MAX_BYTES = 8 * 1024 * 1024;
export const DEFAULT_PUBLICATION_PRIVACY = { hideRating: false, hideDate: false, hideBrand: false, hideContent: false };
const message = (error: unknown) => error instanceof Error ? error.message : "配图读取失败";
export function publicationBlobBytes(blob: Blob): Promise<Uint8Array> {
  return new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => reader.result instanceof ArrayBuffer ? resolve(new Uint8Array(reader.result)) : reject(new Error("文件内容读取无效")); reader.onerror = () => reject(new Error("文件内容读取失败")); reader.readAsArrayBuffer(blob); });
}
function publicationBlobText(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => typeof reader.result === "string" ? resolve(reader.result) : reject(new Error("稿件读取无效")); reader.onerror = () => reject(new Error("稿件读取失败")); reader.readAsText(blob, "utf-8"); });
}

export async function publicationSections(entries: ReviewEntry[]): Promise<{ sections: PublicationSection[]; warnings: string[] }> {
  const warnings: string[] = [];
  const source = await store.listEntries();
  const covers = await store.getEntryCovers(entries, source);
  const sections: PublicationSection[] = [];
  for (const [index, entry] of entries.entries()) {
    let coverDataUrl: string | null = null;
    if (covers[index]) {
      try { coverDataUrl = await publicationPng(covers[index]!); }
      catch (error) { warnings.push(`${entry.title}：${message(error)}，正文仍可出稿。`); }
    }
    sections.push({ id: entry.id, title: entry.title, content: entry.content,
      musicLabel: [entry.albumName, entry.songName, entry.artistName].filter(Boolean).join(" / "),
      ratingText: entry.rating === null ? "" : journalRating(entry), dateText: journalDate(entry), coverDataUrl, includeImage: Boolean(coverDataUrl) });
  }
  return { sections, warnings };
}
export async function publicationRankSections(year: number, rank: YearTopAlbums): Promise<{ sections: PublicationSection[]; warnings: string[] }> {
  const sections: PublicationSection[] = [];
  const warnings: string[] = [];
  for (const [index, album] of rank.albums.entries()) {
    let coverDataUrl: string | null = null;
    try {
      const cover = await store.getCover("album", { albumName: album.albumName, artistName: album.artistName }, { matchNormalizedIdentity: true });
      if (cover) coverDataUrl = await publicationPng(cover);
    } catch (error) { warnings.push(`${album.albumName}：${message(error)}，入选理由仍保留。`); }
    sections.push({ id: `rank:${year}:${index + 1}:${JSON.stringify([album.albumName, album.artistName])}`, title: `第 ${index + 1} 名 · ${album.albumName}`, content: album.note,
      musicLabel: album.artistName || "", ratingText: "", dateText: "", coverDataUrl, includeImage: Boolean(coverDataUrl) });
  }
  return { sections, warnings };
}
async function localImage(value: string): Promise<HTMLImageElement> {
  if (!/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(value) || value.length > 12 * 1024 * 1024) throw new Error("仅导出有效的本地封面图片");
  const image = new Image();
  await new Promise<void>((resolve, reject) => { image.onload = () => resolve(); image.onerror = () => reject(new Error("本地封面无法解码")); image.src = value; });
  if (!image.naturalWidth || !image.naturalHeight || image.naturalWidth * image.naturalHeight > 16000000) throw new Error("本地图片尺寸过大，请选择较小封面");
  return image;
}
export async function publicationPng(value: string): Promise<string> {
  const image = await localImage(value);
  const scale = Math.min(1, 1024 / Math.max(image.naturalWidth, image.naturalHeight));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(image.naturalWidth * scale)); canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
  const context = canvas.getContext("2d");
  if (!context) throw new Error("当前设备无法准备图片");
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  const result = canvas.toDataURL("image/png");
  canvas.width = 0;
  if (!result.startsWith("data:image/png;base64,")) throw new Error("设备未生成PNG图片");
  return result;
}
export function publicationImageBytes(dataUrl: string): Uint8Array {
  if (!dataUrl.startsWith("data:image/png;base64,")) throw new Error("导出图片必须是PNG");
  const binary = atob(dataUrl.slice("data:image/png;base64,".length));
  return Uint8Array.from(binary, char => char.charCodeAt(0));
}
export async function publicationCover(draft: PublicationDraft): Promise<Blob> {
  const canvas = document.createElement("canvas"); canvas.width = 1200; canvas.height = 510;
  const ctx = canvas.getContext("2d"); if (!ctx) throw new Error("设备无法生成横版封面");
  const gradient = ctx.createLinearGradient(0, 0, 1200, 510); gradient.addColorStop(0, "#0b3029"); gradient.addColorStop(1, "#226357");
  ctx.fillStyle = gradient; ctx.fillRect(0, 0, 1200, 510);
  ctx.strokeStyle = "rgba(232,215,165,.15)"; ctx.lineWidth = 1;
  for (let radius = 70; radius < 600; radius += 25) { ctx.beginPath(); ctx.arc(1160, 30, radius, 0, Math.PI * 2); ctx.stroke(); }
  const imageSection = draft.sections.find(section => section.includeImage && section.coverDataUrl);
  let image: HTMLImageElement | null = null;
  if (imageSection?.coverDataUrl) image = await localImage(imageSection.coverDataUrl);
  const width = image ? 710 : 1050;
  ctx.fillStyle = "#d7ad62"; ctx.font = '600 21px "Microsoft YaHei", sans-serif';
  ctx.fillText(draft.privacy.hideBrand ? "听感作品" : "小懂哥 · 听感作品", 64, 70);
  const wrap = (text: string) => {
    const lines: string[] = []; let line = "";
    for (const char of Array.from(text)) { if (line && ctx.measureText(line + char).width > width) { lines.push(line); line = char; } else line += char; }
    if (line) lines.push(line); return lines;
  };
  let font = 56; let lines: string[] = [];
  while (true) { ctx.font = `700 ${font}px "Microsoft YaHei", sans-serif`; lines = wrap(draft.title || "听感作品"); if (lines.length * font * 1.45 <= 310 || font === 24) break; font -= 2; }
  if (lines.length * font * 1.45 > 310) throw new Error("标题过长，横版封面无法完整放下，请缩短标题后重试");
  ctx.fillStyle = "#fffdf8";
  for (const [index, line] of lines.entries()) ctx.fillText(line, 64, 130 + index * font * 1.45);
  ctx.fillStyle = "#d3dfd7"; ctx.font = '24px "Microsoft YaHei", sans-serif';
  const author = draft.author.trim();
  if (author) {
    let size = 24; while (size > 14 && ctx.measureText(author).width > width) { size--; ctx.font = `${size}px "Microsoft YaHei", sans-serif`; }
    if (ctx.measureText(author).width > width) throw new Error("署名过长，请缩短后再导出封面");
    ctx.fillText(author, 64, 462);
  }
  if (image) { const side = 320; const scale = Math.max(side / image.naturalWidth, side / image.naturalHeight); ctx.save(); ctx.beginPath(); ctx.rect(824, 104, side, side); ctx.clip(); ctx.drawImage(image, 824 + (side - image.naturalWidth * scale) / 2, 104 + (side - image.naturalHeight * scale) / 2, image.naturalWidth * scale, image.naturalHeight * scale); ctx.restore(); }
  return new Promise((resolve, reject) => canvas.toBlob(blob => { canvas.width = 0; blob ? resolve(blob) : reject(new Error("横版封面生成失败")); }, "image/png"));
}
export async function savePublicationBlob(blob: Blob, fileName: string, mimeType: string): Promise<"saved" | "cancelled" | "downloaded"> {
  if (!blob.size || blob.size > PUBLICATION_MAX_BYTES) throw new Error("导出内容超过8MiB，请减少配图或分篇出稿；当前文字仍保留");
  if (!Capacitor.isNativePlatform()) { downloadBlob(blob, fileName); return "downloaded"; }
  const result = await saveFile({ fileName, mimeType, content: mimeType === "text/html" ? await publicationBlobText(blob) : await blobToBase64(blob), ...(mimeType === "text/html" ? {} : { encoding: "base64" as const }) });
  return result.status;
}
export async function sharePublicationBlob(blob: Blob, fileName: string): Promise<"opened" | "cancelled"> {
  if (!blob.size || blob.size > PUBLICATION_MAX_BYTES) throw new Error("素材包超过8MiB，请减少配图后重试");
  if (Capacitor.isNativePlatform()) {
    const result = await NativeExport.shareFile({ fileName, mimeType: "application/zip", encoding: "base64", content: await blobToBase64(blob) });
    if (result?.status !== "opened") throw new Error("系统未确认打开分享菜单");
    return "opened";
  }
  const file = new File([blob], fileName, { type: "application/zip" });
  if (typeof navigator.share !== "function" || navigator.canShare?.({ files: [file] }) === false) throw new Error("当前浏览器不支持分享素材包，可先下载再发送");
  try { await navigator.share({ files: [file], title: "公众号稿与配图" }); return "opened"; }
  catch (error) { if (error instanceof DOMException && error.name === "AbortError") return "cancelled"; throw error; }
}
