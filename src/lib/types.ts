import type { EntryType } from "./constants";

export type SerializedEntry = {
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
  summary: string;
  musicLabel: string;
};

export type FrequencyItem = {
  name: string;
  count: number;
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
  years: number[];
  recordCount: number;
  lastRecordedAt: string;
  summary: string;
};

export type SongAggregate = {
  songName: string;
  artistName: string | null;
  albumName: string | null;
  years: number[];
  recordCount: number;
  lastRecordedAt: string;
  summary: string;
};
