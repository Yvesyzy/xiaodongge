import type { MusicInfoFields } from "./ocr";
import type { MusicMetadata } from "./types";

export type AlbumFirstRecognition = {
  fields: MusicInfoFields;
  musicMetadata: MusicMetadata | null;
};

export function toAlbumFirstRecognition(fields: MusicInfoFields, metadata: MusicMetadata | null): AlbumFirstRecognition {
  const albumName = clean(fields.albumName);
  const songName = clean(fields.songName) ?? clean(fields.title);
  const artistName = clean(metadata?.albumArtistName) ?? clean(fields.artistName);

  if (!albumName) {
    return {
      fields: {
        ...fields,
        type: "song",
        ...(songName ? { title: songName, songName } : {}),
      },
      musicMetadata: metadata,
    };
  }

  return {
    fields: {
      type: "album",
      title: albumName,
      songName: null,
      albumName,
      ...(artistName ? { artistName } : {}),
    },
    musicMetadata: {
      ...(metadata ?? {}),
      ...(songName && !clean(metadata?.displayTitle) ? { displayTitle: songName } : {}),
    },
  };
}

function clean(value: string | null | undefined) {
  return typeof value === "string" ? value.trim() || null : null;
}
