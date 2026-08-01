import { localDateOf } from "./format";
import { daysBetween } from "./resurfacing";
import type { ListeningMoment, ReviewEntry } from "./types";

export type RelistenComparison = {
  dayGap: number | null;
  rating: {
    first: number | null;
    latest: number | null;
    difference: number | null;
    direction: "up" | "down" | "same" | "unavailable";
  };
  moods: {
    kept: string[];
    added: string[];
    faded: string[];
  };
  firstContent: string;
  latestContent: string;
};

export function compareRelisten(entry: ReviewEntry, moment: ListeningMoment): RelistenComparison {
  if (entry.id !== moment.entryId) throw new Error("追加听感不属于当前记录");
  const firstDate = localDateOf(entry.listenedAt);
  const latestDate = localDateOf(moment.listenedAt);
  const difference = entry.rating !== null && moment.rating !== null
    ? Math.round((moment.rating - entry.rating) * 10) / 10
    : null;

  const firstMoods = uniqueMoods(entry.moods);
  const latestMoods = uniqueMoods(moment.moods);
  const firstKeys = new Set(firstMoods.map(moodKey));
  const latestKeys = new Set(latestMoods.map(moodKey));
  return {
    dayGap: firstDate && latestDate ? daysBetween(firstDate, latestDate) : null,
    rating: {
      first: entry.rating,
      latest: moment.rating,
      difference,
      direction: difference === null ? "unavailable" : difference > 0 ? "up" : difference < 0 ? "down" : "same",
    },
    moods: {
      kept: firstMoods.filter((mood) => latestKeys.has(moodKey(mood))),
      added: latestMoods.filter((mood) => !firstKeys.has(moodKey(mood))),
      faded: firstMoods.filter((mood) => !latestKeys.has(moodKey(mood))),
    },
    firstContent: entry.content,
    latestContent: moment.content,
  };
}

function uniqueMoods(values: string[]) {
  const result: string[] = [];
  const seen = new Set<string>();
  for (const value of values) {
    const key = moodKey(value);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    result.push(value.trim().normalize("NFKC"));
  }
  return result;
}

function moodKey(value: string) {
  return value.trim().normalize("NFKC").toLocaleLowerCase("zh-CN");
}
