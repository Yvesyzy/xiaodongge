import { Capacitor, registerPlugin } from "@capacitor/core";
import { desktopPlugin } from "./codex_desktopBridge";
import { requirePrivacyConsent } from "./codex_privacy";

export type NowPlayingPlugin = {
  getDiagnostics(): Promise<{ versionName: string; versionCode: number; notificationAccessEnabled: boolean;
    mediaAvailable?: boolean; ocrAvailable?: boolean; ocrLanguages?: string[] }>;
  getCurrentTrack(): Promise<unknown>;
  searchCatalog(options: { title: string; artistName: string; albumName?: string; country: "CN" | "US" }): Promise<unknown>;
  openNotificationSettings(): Promise<void>;
};

const NativeNowPlaying = registerPlugin<NowPlayingPlugin>("NowPlaying", { electron: () => desktopPlugin("NowPlaying") });
export const NowPlaying: NowPlayingPlugin = {
  getDiagnostics: () => NativeNowPlaying.getDiagnostics(),
  async getCurrentTrack() {
    requirePrivacyConsent();
    const result = await NativeNowPlaying.getCurrentTrack();
    requirePrivacyConsent();
    return result;
  },
  async searchCatalog(options) {
    requirePrivacyConsent();
    const result = await NativeNowPlaying.searchCatalog(options);
    requirePrivacyConsent();
    return result;
  },
  async openNotificationSettings() {
    requirePrivacyConsent();
    await NativeNowPlaying.openNotificationSettings();
  },
};
export const supportsCurrentPlayback = ["android", "electron"].includes(Capacitor.getPlatform());
