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

export function groupMusicEntries(entries: ReviewEntry[], kind: "album" | "song") {
  const matches = kind === "album" ? sameAlbumIdentity : sameMusicIdentity;
  // Known IDs and full names come first, so an incomplete song joins one group without merging distinct known albums.
  const ordered = entries.filter(entry => entry.type === "album" || entry.type === "song").map(entry => {
    const album = normalizeMusicIdentityText(entry.albumName);
    return { entry, album, name: kind === "album" ? album : normalizeMusicIdentityText(entry.songName),
      artist: normalizeMusicIdentityText(entry.artistName),
      id: clean(kind === "album" ? entry.musicMetadata?.catalogAlbumId : entry.musicMetadata?.catalogTrackId) };
  }).filter(item => item.name)
    .sort((left, right) => Number(Boolean(right.id)) - Number(Boolean(left.id))
      || Number(Boolean(right.artist)) - Number(Boolean(left.artist))
      || (kind === "song" ? Number(Boolean(right.album)) - Number(Boolean(left.album)) : 0)
      || left.entry.id.localeCompare(right.entry.id));
  const groups: ReviewEntry[][] = [];
  const index = new Map<string, Set<ReviewEntry[]>>();
  const order = new Map<ReviewEntry[], number>();
  const knownIds = new Map<ReviewEntry[], string>();
  for (const { entry, id, name, artist } of ordered) {
    const keys = [...(id ? [`id:${id}`] : []), ...(artist ? [`name:${JSON.stringify([name, artist])}`] : [])];
    const matchingGroups = new Set(keys.flatMap(key => [...(index.get(key) ?? [])]));
    // ponytail: only an ambiguous same-name/artist bucket can still be quadratic;
    // add album sub-indexes if profiling finds many conflicting albums in that bucket.
    let group = [...matchingGroups].sort((a, b) => order.get(a)! - order.get(b)!).find(items => {
      const knownId = knownIds.get(items);
      return (!id || !knownId || id === knownId) && items.some(item => matches(item, entry));
    });
    if (!group) { group = []; order.set(group, groups.length); groups.push(group); }
    group.push(entry);
    if (id && !knownIds.has(group)) knownIds.set(group, id);
    for (const key of keys) {
      if (!index.has(key)) index.set(key, new Set());
      index.get(key)!.add(group);
    }
  }
  return groups;
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
