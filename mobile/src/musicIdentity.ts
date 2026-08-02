import type { EntryInput, EntryType, MusicMetadata, ReviewEntry } from "./types";

export type MusicIdentity = {
  songName?: string | null;
  artistName?: string | null;
  albumName?: string | null;
  musicMetadata?: MusicMetadata | null;
};

export type EntryIdentity = MusicIdentity & { type?: EntryType };

export function findMusicIdentityMatches(entries: ReviewEntry[], identity: MusicIdentity) {
  return entries.filter((entry) => entry.type === "song" && sameMusicIdentity(entry, identity));
}

export function findEntryIdentityMatches(entries: ReviewEntry[], identity: EntryIdentity | EntryInput) {
  return identity.type === "album"
    ? entries.filter((entry) => entry.type === "album" && sameAlbumIdentity(entry, identity))
    : findMusicIdentityMatches(entries, identity);
}

export function sameAlbumIdentity(left: MusicIdentity, right: MusicIdentity) {
  const leftAlbumId = clean(left.musicMetadata?.catalogAlbumId);
  const rightAlbumId = clean(right.musicMetadata?.catalogAlbumId);
  if (leftAlbumId && rightAlbumId) return leftAlbumId === rightAlbumId;

  const leftAlbum = normalizeMusicIdentityText(left.albumName);
  const rightAlbum = normalizeMusicIdentityText(right.albumName);
  const leftArtist = normalizeMusicIdentityText(left.artistName);
  const rightArtist = normalizeMusicIdentityText(right.artistName);
  return Boolean(leftAlbum && rightAlbum && leftArtist && rightArtist && leftAlbum === rightAlbum && leftArtist === rightArtist);
}

export function sameMusicIdentity(left: MusicIdentity, right: MusicIdentity) {
  const leftTrackId = clean(left.musicMetadata?.catalogTrackId);
  const rightTrackId = clean(right.musicMetadata?.catalogTrackId);
  if (leftTrackId && rightTrackId) return leftTrackId === rightTrackId;

  const leftSong = normalizeMusicIdentityText(left.songName);
  const rightSong = normalizeMusicIdentityText(right.songName);
  const leftArtist = normalizeMusicIdentityText(left.artistName);
  const rightArtist = normalizeMusicIdentityText(right.artistName);
  if (!leftSong || !rightSong || !leftArtist || !rightArtist || leftSong !== rightSong || leftArtist !== rightArtist) return false;

  const leftAlbum = normalizeMusicIdentityText(left.albumName);
  const rightAlbum = normalizeMusicIdentityText(right.albumName);
  return !leftAlbum || !rightAlbum || leftAlbum === rightAlbum;
}

export function normalizeMusicIdentityText(value: string | null | undefined) {
  return clean(value)?.normalize("NFKC").toLocaleLowerCase("zh-CN").replace(/\s+/g, "") ?? "";
}

function clean(value: string | null | undefined) {
  return typeof value === "string" ? value.trim() || null : null;
}
