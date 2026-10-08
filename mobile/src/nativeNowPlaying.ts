import { Capacitor, registerPlugin } from "@capacitor/core";
import { desktopPlugin } from "./codex_desktopBridge";

export type NowPlayingPlugin = {
  getDiagnostics(): Promise<{ versionName: string; versionCode: number; notificationAccessEnabled: boolean;
    mediaAvailable?: boolean; ocrAvailable?: boolean; ocrLanguages?: string[] }>;
  getCurrentTrack(): Promise<unknown>;
  searchCatalog(options: { title: string; artistName: string; albumName?: string; country: "CN" | "US" }): Promise<unknown>;
  openNotificationSettings(): Promise<void>;
};

export const NowPlaying = registerPlugin<NowPlayingPlugin>("NowPlaying", { electron: () => desktopPlugin("NowPlaying") });
export const supportsCurrentPlayback = ["android", "electron"].includes(Capacitor.getPlatform());
