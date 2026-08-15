import { localDateOf } from "./format";
import type { ListeningMoment, ReviewEntry } from "./types";
import { DAILY_RESURFACING_KEY, parseDailyResurfacingState } from "../../shared/backupAppData";
import type { DailyResurfacingState } from "../../shared/backupAppData";

export { DAILY_RESURFACING_KEY, parseDailyResurfacingState };
export type { DailyResurfacingState };

export function resolveDailyResurfacing(
  entries: ReviewEntry[],
  moments: ListeningMoment[],
  today: string,
  saved: DailyResurfacingState | null,
) {
  assertDateKey(today);
  if (saved?.date === today) {
    if (saved.dismissed || saved.entryId === null) return { entry: null, state: saved };
    const entry = entries.find((item) => item.id === saved.entryId);
    if (entry?.type === "song" && !hasMomentOnDate(moments, entry.id, today)) return { entry, state: saved };
  }
  const entry = selectDailyResurfacing(entries, moments, today);
  return { entry, state: { date: today, entryId: entry?.id ?? null, dismissed: false } satisfies DailyResurfacingState };
}

export function dismissDailyResurfacing(state: DailyResurfacingState) {
  return { ...state, dismissed: true };
}

export function selectDailyResurfacing(entries: ReviewEntry[], moments: ListeningMoment[], today: string) {
  assertDateKey(today);
  const latestByEntry = new Map<string, string>();
  for (const moment of moments) {
    const date = localDateOf(moment.listenedAt);
    if (!date) continue;
    const current = latestByEntry.get(moment.entryId);
    if (!current || current < date) latestByEntry.set(moment.entryId, date);
  }

  const scored = entries.flatMap((entry) => {
    const firstDate = localDateOf(entry.listenedAt);
    if (entry.type !== "song" || !entry.songName || !firstDate) return [];
    const age = daysBetween(firstDate, today);
    if (age < 30) return [];
    const latestMoment = latestByEntry.get(entry.id);
    if (latestMoment && daysBetween(latestMoment, today) <= 30) return [];
    const latestDate = latestMoment && latestMoment > firstDate ? latestMoment : firstDate;
    return [{
      entry,
      anniversary: anniversaryDistance(firstDate, today) <= 7 ? 1 : 0,
      longAbsent: daysBetween(latestDate, today) >= 90 ? 1 : 0,
      rating: entry.rating ?? -1,
      absentDays: daysBetween(latestDate, today),
    }];
  });

  scored.sort((a, b) => (
    b.anniversary - a.anniversary
    || b.longAbsent - a.longAbsent
    || b.rating - a.rating
    || b.absentDays - a.absentDays
    || a.entry.id.localeCompare(b.entry.id)
  ));
  return scored[0]?.entry ?? null;
}

export function daysBetween(from: string, to: string) {
  return Math.floor((dateKeyToUtc(to) - dateKeyToUtc(from)) / 86_400_000);
}

function hasMomentOnDate(moments: ListeningMoment[], entryId: string, date: string) {
  return moments.some((moment) => moment.entryId === entryId && localDateOf(moment.listenedAt) === date);
}

function anniversaryDistance(firstDate: string, today: string) {
  const [firstYear, month, day] = firstDate.split("-").map(Number);
  const todayYear = Number(today.slice(0, 4));
  if (!firstYear) return Number.POSITIVE_INFINITY;
  return Math.min(...[todayYear - 1, todayYear, todayYear + 1].map((year) => {
    const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
    const anniversary = String(year) + "-" + String(month).padStart(2, "0") + "-" + String(Math.min(day, lastDay)).padStart(2, "0");
    return Math.abs(daysBetween(anniversary, today));
  }));
}

function dateKeyToUtc(value: string) {
  assertDateKey(value);
  const [year, month, day] = value.split("-").map(Number);
  const timestamp = Date.UTC(year, month - 1, day);
  const date = new Date(timestamp);
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) throw new Error("本地日期无效");
  return timestamp;
}

function assertDateKey(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error("本地日期格式无效");
}
