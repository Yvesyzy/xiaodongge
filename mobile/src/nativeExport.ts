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
  copyText(options: CopyTextOptions): Promise<void>;
};

export const NativeExport = registerPlugin<NativeExportPlugin>("NativeExport", { electron: () => desktopPlugin("NativeExport") });

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
