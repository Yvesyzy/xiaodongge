import { Capacitor } from "@capacitor/core";
import { NativeExport, saveFile } from "./nativeExport";
import { blobToBase64, downloadBlob } from "./shareCard";
import { journalDate, journalRating } from "./codex_yearbookModel";
import { entryDate, type DateBasis } from "./dateBasis";
import type { ReviewEntry } from "./types";
import type { YearTopAlbums } from "../../shared/backupAppData";
import type { PublicationMetaField, PublicationSection } from "./codex_publicationModel";

export const PUBLICATION_MAX_BYTES = 8 * 1024 * 1024;
export const DEFAULT_PUBLICATION_PRIVACY = { hideRating: false, hideDate: false, hideBrand: false, hideContent: false };
function publicationBlobText(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => typeof reader.result === "string" ? resolve(reader.result) : reject(new Error("稿件读取无效")); reader.onerror = () => reject(new Error("稿件读取失败")); reader.readAsText(blob, "utf-8"); });
}

// 与乐评表单/详情页的三个时间字段一一对应；缺失时保留「未填写」，读者能看出是没填而非漏导出。
const PUBLICATION_DATE_FIELDS: readonly [string, DateBasis][] = [
  ["专辑/歌曲发行时间", "releaseDate"],
  ["首次收听时间", "firstListenedAt"],
  ["乐评记录时间", "recordedAt"],
];

// 与乐评表单的六项多维评分一致；旧版词曲只是历史兼容字段，不再进入稿件。
function publicationMetaFields(entry: ReviewEntry): PublicationMetaField[] {
  const fields: PublicationMetaField[] = [];
  // 基本信息固定按 专辑 → 艺术家 → 歌曲 排列，与公众号正文的描述顺序一致。
  for (const [label, value] of [["专辑", entry.albumName], ["艺术家", entry.artistName], ["歌曲", entry.songName]] as const) {
    if (value) fields.push({ label, value, kind: "music" });
  }
  fields.push({ label: "评分", value: journalRating(entry), kind: "rating" });
  // 六项维度固定输出，缺项写「未填写」，保证每篇稿件的评分段落结构完全一致。
  const dimensions: [string, number | null | undefined][] = [
    ["制作", entry.ratingProduction], ["词", entry.ratingLyrics], ["曲", entry.ratingComposition],
    ["人声", entry.ratingVocals], ["原创性", entry.ratingOriginality], ["共鸣", entry.ratingResonance],
  ];
  for (const [label, value] of dimensions) {
    fields.push({ label, value: typeof value === "number" ? `${value}/10` : "未填写", kind: "rating" });
  }
  for (const [label, basis] of PUBLICATION_DATE_FIELDS) {
    const date = entryDate(entry, basis);
    fields.push({ label, value: date ? date.replaceAll("-", ".") : "未填写", kind: "date" });
  }
  return fields;
}

export async function publicationSections(entries: ReviewEntry[]): Promise<{ sections: PublicationSection[]; warnings: string[] }> {
  const sections = entries.map((entry): PublicationSection => ({
    id: entry.id, title: entry.title, content: entry.content,
    musicLabel: [entry.albumName, entry.artistName, entry.songName].filter(Boolean).join(" / "),
    ratingText: entry.rating === null ? "" : journalRating(entry), dateText: journalDate(entry),
    metaFields: publicationMetaFields(entry),
  }));
  return { sections, warnings: [] };
}
export async function publicationRankSections(year: number, rank: YearTopAlbums): Promise<{ sections: PublicationSection[]; warnings: string[] }> {
  const sections = rank.albums.map((album, index): PublicationSection => ({
    id: `rank:${year}:${index + 1}:${JSON.stringify([album.albumName, album.artistName])}`,
    title: `第 ${index + 1} 名 · ${album.albumName}`, content: album.note,
    musicLabel: album.artistName || "", ratingText: "", dateText: "",
    metaFields: album.artistName ? [{ label: "艺术家", value: album.artistName, kind: "music" as const }] : [],
  }));
  return { sections, warnings: [] };
}
// ponytail: text/* crosses the bridge as UTF-8; Android rejects base64 for any other binary MIME.
// Previously only text/html took this path, so every new text format was silently mis-encoded.
async function publicationPayload(blob: Blob, mimeType: string) {
  return mimeType.startsWith("text/")
    ? { content: await publicationBlobText(blob) }
    : { content: await blobToBase64(blob), encoding: "base64" as const };
}

export async function savePublicationBlob(blob: Blob, fileName: string, mimeType: string): Promise<"saved" | "cancelled" | "downloaded"> {
  if (!blob.size || blob.size > PUBLICATION_MAX_BYTES) throw new Error("导出内容超过8MiB，请分篇出稿；当前文字仍保留");
  if (!Capacitor.isNativePlatform()) { downloadBlob(blob, fileName); return "downloaded"; }
  const result = await saveFile({ fileName, mimeType, ...(await publicationPayload(blob, mimeType)) });
  return result.status;
}
export async function sharePublicationBlob(blob: Blob, fileName: string, mimeType = "text/plain"): Promise<"opened" | "cancelled"> {
  if (!blob.size || blob.size > PUBLICATION_MAX_BYTES) throw new Error("稿件超过8MiB，请分篇后重试");
  if (Capacitor.isNativePlatform()) {
    const result = await NativeExport.shareFile({ fileName, mimeType, ...(await publicationPayload(blob, mimeType)) });
    if (result?.status !== "opened") throw new Error("系统未确认打开分享菜单");
    return "opened";
  }
  const file = new File([blob], fileName, { type: mimeType });
  if (typeof navigator.share !== "function" || navigator.canShare?.({ files: [file] }) === false) throw new Error("当前浏览器不支持分享稿件，可先下载再发送");
  try { await navigator.share({ files: [file], title: "公众号稿" }); return "opened"; }
  catch (error) { if (error instanceof DOMException && error.name === "AbortError") return "cancelled"; throw error; }
}
