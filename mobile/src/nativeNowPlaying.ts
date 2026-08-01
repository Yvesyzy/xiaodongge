import { registerPlugin } from "@capacitor/core";

export type NowPlayingPlugin = {
  getCurrentTrack(): Promise<unknown>;
  searchCatalog(options: { title: string; artistName: string; albumName?: string; country: "CN" | "US" }): Promise<unknown>;
  openNotificationSettings(): Promise<void>;
};

export const NowPlaying = registerPlugin<NowPlayingPlugin>("NowPlaying");
