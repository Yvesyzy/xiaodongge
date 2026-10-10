import { normalizeMusicIdentityText } from "./musicIdentity";
import { entryCoverTarget, store } from "./store";
import type { EntryInput } from "./types";

type CoverIdentity = Pick<EntryInput, "type" | "songName" | "albumName" | "artistName">;
export type PlaybackCover = { dataUrl: string | null; fromPlayback: boolean; key: string | null };

export function playbackCoverKey(input: CoverIdentity) {
  const selected = entryCoverTarget(input);
  return selected ? JSON.stringify([selected.kind, normalizeMusicIdentityText(selected.target.albumName),
    normalizeMusicIdentityText(selected.target.songName), normalizeMusicIdentityText(selected.target.artistName)]) : null;
}

export function readPlaybackCover(value: unknown) {
  return typeof value === "string" && value.length <= 1_400_000
    && /^data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(value) ? value : null;
}

export async function preparePlaybackCover(input: CoverIdentity, candidate: unknown): Promise<PlaybackCover> {
  const key = playbackCoverKey(input);
  const selected = entryCoverTarget(input);
  const empty = { dataUrl: null, fromPlayback: false, key };
  if (!selected) return empty;
  // Never offer an automatic replacement when the existing cover cannot be checked.
  let stored: string | null;
  try { stored = await store.getCover(selected.kind, selected.target, { matchNormalizedIdentity: true }); } catch { return empty; }
  if (stored) return { dataUrl: stored, fromPlayback: false, key };
  const dataUrl = readPlaybackCover(candidate);
  if (!dataUrl) return empty;
  return new Promise(resolve => {
    const image = new Image();
    const finish = (valid: boolean) => {
      window.clearTimeout(timer);
      image.onload = image.onerror = null;
      resolve(valid ? { dataUrl, fromPlayback: true, key } : empty);
    };
    const timer = window.setTimeout(() => { image.src = ""; finish(false); }, 2000);
    image.onload = () => finish(image.naturalWidth > 0 && image.naturalHeight > 0
      && image.naturalWidth <= 512 && image.naturalHeight <= 512);
    image.onerror = () => finish(false);
    image.src = dataUrl;
  });
}
