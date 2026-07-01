export const ENTRY_TYPES = ["year", "month", "album", "song"] as const;

export type EntryType = (typeof ENTRY_TYPES)[number];

export const ENTRY_TYPE_LABELS: Record<EntryType, string> = {
  year: "年度",
  month: "月份",
  album: "专辑",
  song: "歌曲",
};
