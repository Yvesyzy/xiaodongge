import { Capacitor, registerPlugin } from "@capacitor/core";
import { desktopPlugin } from "./codex_desktopBridge";

export type ExportFileOptions = {
  fileName: string;
  mimeType: string;
  content: string;
  encoding?: "base64";
};

export type CopyTextOptions = {
  text: string;
};

export type SaveFileResult = { status: "saved"; uri: string } | { status: "cancelled" };

type NativeExportPlugin = {
  stageFile(options: ExportFileOptions): Promise<{ token: string }>;
  shareFiles(options: { tokens: string[] }): Promise<{ status: "opened" }>;
  saveFiles(options: { tokens: string[] }): Promise<{ status: "saved" | "cancelled" | "partial"; saved: string[]; error?: string }>;
  saveFile(options: ExportFileOptions): Promise<SaveFileResult>;
  saveImageToGallery(options: ExportFileOptions): Promise<{ status: "saved"; uri: string }>;
  shareFile(options: ExportFileOptions): Promise<{ status: "opened" }>;
  shareText(options: { text: string; title: string }): Promise<{ status: "opened" }>;
  copyText(options: CopyTextOptions): Promise<void>;
  copyHtml(options: { text: string; html: string }): Promise<{ status: "copied" }>;
};

export const NativeExport = registerPlugin<NativeExportPlugin>("NativeExport", { electron: () => desktopPlugin("NativeExport") });

export async function copyHtml(text: string, html: string): Promise<void> {
  if (!text || !html || new TextEncoder().encode(text).length + new TextEncoder().encode(html).length > 512 * 1024) throw new Error("排版正文为空或超过剪贴板容量，请改用纯文字复制或HTML导出。");
  if (Capacitor.getPlatform() === "android") {
    const result = await NativeExport.copyHtml({ text, html });
    if (result?.status !== "copied") throw new Error("系统未确认排版复制，请改用纯文字或HTML导出。");
    return;
  }
  if (typeof ClipboardItem !== "undefined" && navigator.clipboard?.write) {
    try { await navigator.clipboard.write([new ClipboardItem({ "text/html": new Blob([html], { type: "text/html" }), "text/plain": new Blob([text], { type: "text/plain" }) })]); return; }
    catch { /* Older or restricted browsers can still support the user-initiated copy event. */ }
  }
  const active = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  const input = document.createElement("textarea"); input.value = text; input.readOnly = true;
  input.style.position = "fixed"; input.style.left = "0"; input.style.top = "0"; input.style.opacity = "0";
  const dialogs = document.querySelectorAll<HTMLDialogElement>("dialog[open]"); (dialogs[dialogs.length - 1] || document.body).appendChild(input);
  let copied = false;
  const onCopy = (event: ClipboardEvent) => { if (!event.clipboardData) return; event.clipboardData.setData("text/plain", text); event.clipboardData.setData("text/html", html); event.preventDefault(); copied = true; };
  document.addEventListener("copy", onCopy);
  try { input.focus(); input.select(); if (typeof document.execCommand !== "function" || !document.execCommand("copy") || !copied) throw new Error("当前环境无法复制排版，请改用纯文字复制或HTML导出。"); }
  finally { document.removeEventListener("copy", onCopy); input.remove(); if (active?.isConnected) active.focus({ preventScroll: true }); }
}

export async function shareText(text: string, title: string): Promise<"opened" | "copied" | "cancelled"> {
  if (!text.trim() || text.length > 50000 || title.length > 300) throw new Error("分享内容为空或过长，请先复制部分文字。");
  if (Capacitor.getPlatform() === "android") {
    const result = await NativeExport.shareText({ text, title });
    if (result?.status !== "opened") throw new Error("系统未确认打开分享菜单，请重试或复制文字。");
    return "opened";
  }
  if (typeof navigator.share === "function") {
    try { await navigator.share({ text, title }); return "opened"; }
    catch (error) { if (error instanceof DOMException && error.name === "AbortError") return "cancelled"; throw error; }
  }
  await copyText(text);
  return "copied";
}

export async function saveFile(options: ExportFileOptions): Promise<SaveFileResult> {
  const result = await NativeExport.saveFile(options);
  if (result?.status === "cancelled") return result;
  if (result?.status === "saved" && typeof result.uri === "string" && result.uri.trim()) return result;
  throw new Error("系统未确认文件保存，导出原文或图片仍保留，请重试或改用其他导出方式");
}

export async function copyText(text: string) {
  if (Capacitor.isNativePlatform()) {
    try { await NativeExport.copyText({ text }); return; } catch { /* Try the WebView's allowed copy paths. */ }
  }
  try {
    if (navigator.clipboard?.writeText) { await navigator.clipboard.writeText(text); return; }
  } catch { /* The WebView may deny the asynchronous clipboard API. */ }
  const active = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  const input = document.createElement("textarea");
  input.value = text; input.readOnly = true; input.tabIndex = -1;
  input.style.position = "fixed"; input.style.left = "0"; input.style.top = "0"; input.style.opacity = "0";
  const dialogs = document.querySelectorAll<HTMLDialogElement>("dialog[open]");
  const host = dialogs[dialogs.length - 1] ?? document.body;
  host.appendChild(input);
  try {
    input.focus({ preventScroll: true }); input.select(); input.setSelectionRange(0, text.length);
    if (typeof document.execCommand !== "function" || !document.execCommand("copy")) throw new Error("复制失败，可长按原文选择复制");
  } finally {
    input.remove();
    if (active?.isConnected) active.focus({ preventScroll: true });
  }
}
