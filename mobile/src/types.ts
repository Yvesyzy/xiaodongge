export const ENTRY_TYPES = ["year", "month", "album", "song"] as const;

export type EntryType = (typeof ENTRY_TYPES)[number];

export const ENTRY_TYPE_LABELS: Record<EntryType, string> = {
  year: "年度",
  month: "月份",
  album: "专辑",
  song: "歌曲",
};

export type ReviewEntry = {
  id: string;
  type: EntryType;
  title: string;
  year: number;
  month: number | null;
  albumName: string | null;
  songName: string | null;
  artistName: string | null;
  content: string;
  tags: string[];
  moods: string[];
  rating: number | null;
  listenedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type EntryInput = Omit<ReviewEntry, "id" | "createdAt" | "updatedAt">;

export type YearlySummary = {
  id: string;
  year: number;
  title: string;
  content: string;
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
  summary: string;
};

export type SongAggregate = {
  songName: string;
  artistName: string | null;
  albumName: string | null;
  coverDataUrl: string | null;
  years: number[];
  recordCount: number;
  lastRecordedAt: string;
  summary: string;
};
