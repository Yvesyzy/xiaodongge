import type { ReviewEntry } from "./types";
import type { WeatherRecord } from "../../shared/listeningContext";

export type InsightKind = "weather-mood" | "weather-rating" | "season-mood" | "season-rating";

export type Insight = {
  kind: InsightKind;
  eyebrow: string;
  title: string;
  body: string;
  strong: string;
  weak: string | null;
  strongValue: number;
  weakValue: number | null;
  evidence: string[];
};

const SEASONS = ["春", "夏", "秋", "冬"] as const;
export type Season = (typeof SEASONS)[number];

const WEATHER_LABEL: Record<WeatherRecord["category"], string> = {
  sunny: "晴天",
  cloudy: "阴天",
  rain: "雨天",
  snow: "雪天",
};

const MIN_ENTRIES = 5;
const MIN_GROUP_SIZE = 3;
const MIN_RATING_GAP = 0.5;
const MIN_MOOD_REPEAT = 2;

export function seasonOf(month: number): Season {
  if (month >= 3 && month <= 5) return "春";
  if (month >= 6 && month <= 8) return "夏";
  if (month >= 9 && month <= 11) return "秋";
  return "冬";
}

type DatedEntry = {
  entry: ReviewEntry;
  date: string;
  weather: WeatherRecord | null;
  season: Season;
};

export function buildInsights(entries: ReviewEntry[], weather: WeatherRecord[]): Insight[] {
  const weatherByDate = new Map(weather.map((record) => [record.date, record]));
  const dated: DatedEntry[] = entries
    .filter((entry) => entry.type === "song" || entry.type === "album")
    .map((entry) => {
      const date = entry.listenedAt?.slice(0, 10) ?? null;
      if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
      const month = Number(date.slice(5, 7));
      return { entry, date, weather: weatherByDate.get(date) ?? null, season: seasonOf(month) };
    })
    .filter((item): item is DatedEntry => item !== null);

  if (dated.length < MIN_ENTRIES) return [];

  const insights: Insight[] = [];
  const weatherMood = topMoodByGroup(dated, (item) => (item.weather ? WEATHER_LABEL[item.weather.category] : null), "weather-mood");
  if (weatherMood) insights.push(weatherMood);
  const seasonMood = topMoodByGroup(dated, (item) => item.season, "season-mood");
  if (seasonMood) insights.push(seasonMood);
  const weatherRating = ratingGapByGroup(dated, (item) => (item.weather ? WEATHER_LABEL[item.weather.category] : null), "weather-rating");
  if (weatherRating) insights.push(weatherRating);
  const seasonRating = ratingGapByGroup(dated, (item) => item.season, "season-rating");
  if (seasonRating) insights.push(seasonRating);
  return insights;
}

function topMoodByGroup(items: DatedEntry[], keyOf: (item: DatedEntry) => string | null, kind: InsightKind): Insight | null {
  const groups = new Map<string, DatedEntry[]>();
  for (const item of items) {
    const key = keyOf(item);
    if (!key) continue;
    groups.set(key, [...(groups.get(key) ?? []), item]);
  }
  let best: { group: string; mood: string; count: number; total: number; dates: string[] } | null = null;
  for (const [group, groupItems] of groups) {
    if (groupItems.length < MIN_GROUP_SIZE) continue;
    const moodCounts = new Map<string, number>();
    const moodDates = new Map<string, string[]>();
    for (const { entry, date } of groupItems) {
      for (const mood of entry.moods) {
        moodCounts.set(mood, (moodCounts.get(mood) ?? 0) + 1);
        moodDates.set(mood, [...(moodDates.get(mood) ?? []), date]);
      }
    }
    const sorted = Array.from(moodCounts.entries()).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "zh-CN"));
    const top = sorted[0];
    if (!top || top[1] < MIN_MOOD_REPEAT) continue;
    if (!best || top[1] > best.count) {
      best = { group, mood: top[0], count: top[1], total: groupItems.length, dates: moodDates.get(top[0]) ?? [] };
    }
  }
  if (!best) return null;
  return {
    kind,
    eyebrow: kind === "weather-mood" ? "天气 × 情绪" : "季节 × 情绪",
    title: `${best.group}你最爱听的情绪是「${best.mood}」`,
    body: `在 ${best.total} 篇${best.group}乐评里，「${best.mood}」出现 ${best.count} 次，是最常被标记的情绪。`,
    strong: best.mood,
    weak: null,
    strongValue: best.count,
    weakValue: null,
    evidence: best.dates.slice(0, 6),
  };
}

function ratingGapByGroup(items: DatedEntry[], keyOf: (item: DatedEntry) => string | null, kind: InsightKind): Insight | null {
  const groups = new Map<string, DatedEntry[]>();
  for (const item of items) {
    const key = keyOf(item);
    if (!key) continue;
    groups.set(key, [...(groups.get(key) ?? []), item]);
  }
  const stats: Array<{ group: string; avg: number; count: number; dates: string[] }> = [];
  for (const [group, groupItems] of groups) {
    const rated = groupItems.filter((item) => item.entry.rating !== null);
    if (rated.length < MIN_GROUP_SIZE) continue;
    const avg = rated.reduce((sum, item) => sum + (item.entry.rating as number), 0) / rated.length;
    stats.push({ group, avg, count: rated.length, dates: rated.map((item) => item.date) });
  }
  if (stats.length < 2) return null;
  stats.sort((a, b) => b.avg - a.avg);
  const high = stats[0];
  let low = stats[stats.length - 1];
  for (let i = stats.length - 1; i > 0; i -= 1) {
    if (high.avg - stats[i].avg >= MIN_RATING_GAP) { low = stats[i]; break; }
  }
  const gap = high.avg - low.avg;
  if (gap < MIN_RATING_GAP) return null;
  const gapLabel = gap.toFixed(1);
  return {
    kind,
    eyebrow: kind === "weather-rating" ? "天气 × 评分" : "季节 × 评分",
    title: `${high.group}你的评分比${low.group}高 ${gapLabel} 分`,
    body: `${high.group}平均 ${high.avg.toFixed(2)} 分（${high.count} 篇），${low.group}平均 ${low.avg.toFixed(2)} 分（${low.count} 篇）。`,
    strong: high.group,
    weak: low.group,
    strongValue: Number(high.avg.toFixed(2)),
    weakValue: Number(low.avg.toFixed(2)),
    evidence: [...high.dates.slice(0, 3), ...low.dates.slice(0, 3)],
  };
}
