import { registerPlugin, type PluginListenerHandle } from "@capacitor/core";

const SHARE_SESSION_KEY = "shared-music-payload:v1";

type SharedMusicPlugin = {
  consumePendingShare(): Promise<unknown>;
  addListener(eventName: "shareReceived", listener: (value: unknown) => void): Promise<PluginListenerHandle>;
};

export type SharedMusicPayload = {
  id: string;
  subject: string | null;
  text: string;
};

export const SharedMusic = registerPlugin<SharedMusicPlugin>("SharedMusic");

export function parseSharedMusicPayload(value: unknown): SharedMusicPayload | null {
  if (!isRecord(value) || value.hasShare === false) return null;
  const id = clean(value.id);
  const text = clean(value.text);
  const subject = clean(value.subject);
  return id && text ? { id, subject, text } : null;
}

export function rememberSharedMusic(payload: SharedMusicPayload) {
  sessionStorage.setItem(SHARE_SESSION_KEY, JSON.stringify(payload));
}

export function readSharedMusic(id: string | null): SharedMusicPayload | null {
  if (!id) return null;
  try {
    const payload = parseSharedMusicPayload(JSON.parse(sessionStorage.getItem(SHARE_SESSION_KEY) ?? "null"));
    return payload?.id === id ? payload : null;
  } catch {
    return null;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function clean(value: unknown) {
  return typeof value === "string" ? value.trim() || null : null;
}
