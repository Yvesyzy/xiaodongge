export const ENTRY_TYPES = ["year", "month", "album", "song"] as const;

export type EntryType = (typeof ENTRY_TYPES)[number];

export const ENTRY_TYPE_LABELS: Record<EntryType, string> = {
  year: "年度",
  month: "月份",
  album: "专辑",
  song: "歌曲",
};

export type MusicMetadata = {
  albumArtistName?: string;
  authorName?: string;
  writerName?: string;
  composerName?: string;
  compilation?: string;
  releaseDate?: string;
  releaseYear?: number;
  genre?: string;
  durationMs?: number;
  trackNumber?: number;
  trackCount?: number;
  discNumber?: number;
  discCount?: number;
  explicitness?: "explicit" | "cleaned" | "notExplicit";
  mediaId?: string;
  mediaUri?: string;
  artworkUri?: string;
  displayTitle?: string;
  displaySubtitle?: string;
  displayDescription?: string;
  sourcePackage?: string;
  catalogSource?: "apple";
  catalogTrackId?: string;
  catalogAlbumId?: string;
  catalogArtistId?: string;
  enrichedAt?: string;
};

export type RatingModifier = "+" | "-";

export type ReviewEntry = {
  id: string;
  type: EntryType;
  title: string;
  year: number;
  month: number | null;
  albumName: string | null;
  songName: string | null;
  artistName: string | null;
  musicMetadata: MusicMetadata | null;
  content: string;
  tags: string[];
  moods: string[];
  rating: number | null;
  ratingModifier: RatingModifier | null;
  ratingProduction: number | null;
  ratingSongwriting: number | null;
  ratingOriginality: number | null;
  ratingResonance: number | null;
  compositeRatingLocked: boolean;
  firstListenedAt: string | null;
  listenedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type EntryInput = Omit<ReviewEntry, "id" | "createdAt" | "updatedAt">;

export type ListeningMoment = {
  id: string;
  entryId: string;
  listenedAt: string;
  rating: number | null;
  ratingModifier: RatingModifier | null;
  moods: string[];
  content: string;
  createdAt: string;
  updatedAt: string;
};

export type ListeningMomentInput = Omit<ListeningMoment, "id" | "entryId" | "createdAt" | "updatedAt">;

export type YearlySummary = {
  id: string;
  year: number;
  title: string;
  content: string;
  analysisJson: string | null;
  analysisVersion: number | null;
  sourceFingerprint: string | null;
  sourceEntryCount: number;
  generatedAt: string;
  createdAt: string;
  updatedAt: string;
};

export type MonthlySummary = {
  id: string;
  year: number;
  month: number;
  title: string;
  content: string;
  themeId: string;
  analysisJson: string;
  analysisVersion: number;
  sourceFingerprint: string | null;
  sourceEntryCount: number;
  generatedAt: string;
  createdAt: string;
  updatedAt: string;
};

export type FrequencyItem = {
  name: string;
  count: number;
};

export type CoverKind = "album" | "song";

export type CoverTarget = {
  albumName: string | null;
  songName?: string | null;
  artistName: string | null;
};

export type YearStats = {
  year: number;
  totalEntries: number;
  createdThisYear: number;
  monthCount: number;
  albumCount: number;
  songCount: number;
  topTags: FrequencyItem[];
  topMoods: FrequencyItem[];
  averageRating: number | null;
  mostActiveMonth: FrequencyItem | null;
  topAlbum: FrequencyItem | null;
  topSong: FrequencyItem | null;
};

export type AlbumAggregate = {
  albumName: string;
  artistName: string | null;
  coverDataUrl: string | null;
  years: number[];
  recordCount: number;
  lastRecordedAt: string;
  averageRating: number | null;
};

export type SongAggregate = {
  songName: string;
  artistName: string | null;
  albumName: string | null;
  coverDataUrl: string | null;
  years: number[];
  recordCount: number;
  lastRecordedAt: string;
  averageRating: number | null;
};
