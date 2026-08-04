import { registerPlugin } from "@capacitor/core";

export type ExportFileOptions = {
  fileName: string;
  mimeType: string;
  content: string;
};

export type CopyTextOptions = {
  text: string;
};

export type SaveFileResult = {
  status: "saved" | "cancelled";
  uri?: string;
};

type NativeExportPlugin = {
  saveFile(options: ExportFileOptions): Promise<SaveFileResult>;
  shareFile(options: ExportFileOptions): Promise<{ status: "opened" }>;
  copyText(options: CopyTextOptions): Promise<void>;
};

export const NativeExport = registerPlugin<NativeExportPlugin>("NativeExport");
