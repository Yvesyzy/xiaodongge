import { LISTENING_ANALYSIS_VERSION, analyzeListeningEntries, applySemanticOverrides, mergeListeningAnalyses, type ListeningAnalysis, type SemanticOverride } from "../../shared/listeningAnalysis";
import { classifyDay, parseWeatherRecord, type DayContext, type DayKind, type WeatherRecord } from "../../shared/listeningContext";
import { localDateOf } from "./format";
import type { ReviewEntry } from "./types";

export const LISTENING_YEARBOOK_VERSION = 1;

export const MONTH_THEMES = [
  { id: "frost-record", name: "霜刻唱片封套", eyebrow: "FROST RECORD", accent: "#718a88" },
  { id: "lacquer-seal", name: "漆红方印", eyebrow: "LACQUER SEAL", accent: "#9b332f" },
  { id: "botanical-sheet", name: "植物标本页", eyebrow: "BOTANICAL SHEET", accent: "#617353" },
  { id: "rain-blueprint", name: "雨线蓝图", eyebrow: "RAIN BLUEPRINT", accent: "#4f7180" },
  { id: "sun-paper-cut", name: "日光剪纸", eyebrow: "SUN PAPER CUT", accent: "#c58b32" },
  { id: "water-score", name: "水纹乐谱", eyebrow: "WATER SCORE", accent: "#3c7781" },
  { id: "heat-film", name: "热浪胶片", eyebrow: "HEAT FILM", accent: "#b84b31" },
  { id: "night-navigation", name: "夜航星图", eyebrow: "NIGHT NAVIGATION", accent: "#425382" },
  { id: "specimen-drawer", name: "标本抽屉", eyebrow: "SPECIMEN DRAWER", accent: "#766745" },
  { id: "travel-ticket", name: "旅行票据", eyebrow: "TRAVEL TICKET", accent: "#9c5d3e" },
  { id: "cloth-archive", name: "布面档案册", eyebrow: "CLOTH ARCHIVE", accent: "#5a604d" },
  { id: "sealed-letter", name: "年末封缄信件", eyebrow: "SEALED LETTER", accent: "#7f3638" },
] as const;

export type SummaryMode = "memory" | "compact" | "full";

export type ListeningDaySnapshot = {
  date: string;
  entryIds: string[];
  entryCount: number;
  day: DayContext;
  weather: WeatherRecord | null;
  analysis: ListeningAnalysis;
};

export type ContextInsight = {
  basis: "day-kind" | "weather";
  text: string;
  term: string;
  strongerGroup: string;
  strongerCount: number;
  strongerTotal: number;
  weakerGroup: string;
  weakerCount: number;
  weakerTotal: number;
  evidenceDates: string[];
};

export type ContextOverview = {
  exactDateCount: number;
  dayKinds: Array<{ kind: DayKind; label: string; count: number }>;
  festivals: Array<{ name: string; count: number; dates: string[] }>;
  weather: Array<{ category: WeatherRecord["category"]; label: string; count: number }>;
  insights: ContextInsight[];
};

export type MonthlyListeningSnapshot = {
  version: number;
  dateBasis?: "createdAt";
  scope: "month";
  year: number;
  month: number;
  title: string;
  mode: Exclude<SummaryMode, "compact"> | "full";
  theme: (typeof MONTH_THEMES)[number];
  analysis: ListeningAnalysis;
  days: ListeningDaySnapshot[];
  context: ContextOverview;
  reflectionEntryIds: string[];
};

export type AestheticMigration = {
  kind: "new" | "persistent" | "fading";
  term: string;
  months: number[];
  text: string;
};

export type YearlyListeningSnapshot = {
  version: number;
  dateBasis?: "createdAt";
  scope: "year";
  year: number;
  title: string;
  mode: SummaryMode;
  analysis: ListeningAnalysis;
  months: Array<{
    month: number;
    title: string;
    mode: MonthlyListeningSnapshot["mode"];
    theme: MonthlyListeningSnapshot["theme"];
    entryCount: number;
    topFeeling: string | null;
    topSubject: string | null;
  }>;
  undatedEntryCount: number;
  context: ContextOverview;
  migrations: AestheticMigration[];
};

export function buildDayListeningSnapshot(date: string, entries: ReviewEntry[], weather: WeatherRecord | null, overrides: SemanticOverride[] = []): ListeningDaySnapshot {
  const sourceEntries = automaticEntries(entries).filter((entry) => exactDate(entry) === date);
  return {
    date,
    entryIds: sourceEntries.map((entry) => entry.id),
    entryCount: sourceEntries.length,
    day: classifyDay(date),
    weather,
    analysis: applySemanticOverrides(analyzeListeningEntries(sourceEntries), overrides),
  };
}

export function buildMonthlyListeningSnapshot(year: number, month: number, entries: ReviewEntry[], weather: WeatherRecord[] = [], overrides: SemanticOverride[] = []): MonthlyListeningSnapshot {
  if (!Number.isInteger(month) || month < 1 || month > 12) throw new Error("月份范围必须是 1-12");
  const monthEntries = entries.filter((entry) => inRecordingPeriod(entry, year, month));
  const sourceEntries = automaticEntries(monthEntries);
  if (!sourceEntries.length) throw new Error("该月份没有歌曲或专辑乐评，无法生成月度总结");
  const weatherByDate = new Map(weather.map((item) => [item.date, item]));
  const dates = unique(sourceEntries.map(exactDate).filter((date): date is string => !!date)).sort();
  const days = dates.map((date) => buildDayListeningSnapshot(date, sourceEntries, weatherByDate.get(date) ?? null, overrides));
  const analysis = applySemanticOverrides(analyzeListeningEntries(sourceEntries), overrides);
  return {
    version: LISTENING_YEARBOOK_VERSION,
    dateBasis: "createdAt",
    scope: "month",
    year,
    month,
    title: listeningTitle(`${month} 月`, analysis),
    mode: sourceEntries.length <= 2 ? "memory" : "full",
    theme: MONTH_THEMES[month - 1],
    analysis,
    days,
    context: buildContextOverview(days, 6, 2),
    reflectionEntryIds: monthEntries.filter((entry) => entry.type === "month").map((entry) => entry.id),
  };
}

export function buildYearlyListeningSnapshot(year: number, months: MonthlyListeningSnapshot[], undatedEntries: ReviewEntry[], overrides: SemanticOverride[] = []): YearlyListeningSnapshot {
  const orderedMonths = [...months].sort((a, b) => a.month - b.month);
  const undated = automaticEntries(undatedEntries.filter((entry) => entry.year === year && entry.month === null));
  const analyses = [...orderedMonths.map((month) => month.analysis), ...(undated.length ? [applySemanticOverrides(analyzeListeningEntries(undated), overrides)] : [])];
  if (!analyses.length) throw new Error("该年份没有歌曲或专辑乐评，无法生成年度总结");
  const analysis = mergeListeningAnalyses(analyses);
  const days = orderedMonths.flatMap((month) => month.days);
  return {
    version: LISTENING_YEARBOOK_VERSION,
    dateBasis: "createdAt",
    scope: "year",
    year,
    title: listeningTitle(`${year}`, analysis),
    mode: analysis.sourceEntryCount <= 2 ? "memory" : analysis.sourceEntryCount <= 7 ? "compact" : "full",
    analysis,
    months: orderedMonths.map((month) => ({ month: month.month, title: month.title, mode: month.mode, theme: month.theme, entryCount: month.analysis.sourceEntryCount, topFeeling: month.analysis.feelings[0]?.name ?? null, topSubject: month.analysis.subjects[0]?.name ?? null })),
    undatedEntryCount: undated.length,
    context: buildContextOverview(days, 12, 4),
    migrations: buildMigrations(orderedMonths),
  };
}

export function monthlySnapshotToMarkdown(snapshot: MonthlyListeningSnapshot, reflections: ReviewEntry[] = []) {
  return [
    `# ${snapshot.year} 年 ${snapshot.month} 月听感总结`,
    "",
    `主题：${snapshot.theme.name}`,
    `模式：${summaryModeLabel(snapshot.mode)}`,
    `分析乐评：${snapshot.analysis.sourceEntryCount} 篇`,
    "",
    "## 本月主要感受",
    ...metricLines(snapshot.analysis.feelings),
    "",
    "## 最关注的音乐对象",
    ...metricLines(snapshot.analysis.subjects),
    "",
    "## 对象与描述词",
    ...snapshot.analysis.pairs.slice(0, 5).map((pair) => `- ${pair.subject} × ${pair.descriptor}：${pair.count} 次，涉及 ${pair.entryCount} 篇乐评`),
    "",
    "## 表达方式",
    ...metricLines(snapshot.analysis.expressions),
    ...(snapshot.context.insights.length ? ["", "## 日期与天气切片", ...snapshot.context.insights.map((insight) => `- ${insight.text}`)] : []),
    "",
    "## 代表原句",
    ...snapshot.analysis.representativeQuotes.slice(0, 3).map((quote) => `- ${quote.sentence}`),
    ...(reflections.length ? ["", "## 本月自述", ...reflections.map((entry) => `### ${entry.title}\n${entry.content}`)] : []),
  ].join("\n");
}

export function yearlySnapshotToMarkdown(snapshot: YearlyListeningSnapshot) {
  return [
    `# ${snapshot.year} 年私人听感标本册`,
    "",
    snapshot.title,
    `分析乐评：${snapshot.analysis.sourceEntryCount} 篇；涉及月份：${snapshot.months.length} 个。`,
    "",
    "## 年度主要感受",
    ...metricLines(snapshot.analysis.feelings),
    "",
    "## 最关注的音乐对象",
    ...metricLines(snapshot.analysis.subjects),
    "",
    "## 对象与描述词",
    ...snapshot.analysis.pairs.slice(0, 8).map((pair) => `- ${pair.subject} × ${pair.descriptor}：${pair.count} 次，涉及 ${pair.entryCount} 篇乐评`),
    "",
    "## 表达方式",
    ...metricLines(snapshot.analysis.expressions),
    ...(snapshot.migrations.length ? ["", "## 审美迁徙", ...snapshot.migrations.map((item) => `- ${item.text}`)] : []),
    ...(snapshot.context.insights.length ? ["", "## 日期与天气背景", ...snapshot.context.insights.map((insight) => `- ${insight.text}`)] : []),
    "",
    "## 年度代表原句",
    ...snapshot.analysis.representativeQuotes.slice(0, 6).map((quote) => `- ${quote.sentence}`),
    "",
    `以上内容只根据本地保存的真实乐评生成，${snapshot.undatedEntryCount ? `${snapshot.undatedEntryCount} 篇无月份乐评只参加全年总体统计。` : "没有重复分析月度总结文案。"}`,
  ].join("\n");
}

export function parseMonthlyListeningSnapshot(value: string): MonthlyListeningSnapshot {
  const parsed = JSON.parse(value) as unknown;
  if (!isMonthlySnapshot(parsed)) throw new Error("月度分析快照格式无效");
  return parsed as MonthlyListeningSnapshot;
}

export function parseYearlyListeningSnapshot(value: string): YearlyListeningSnapshot {
  const parsed = JSON.parse(value) as unknown;
  if (!isYearlySnapshot(parsed)) throw new Error("年度分析快照格式无效");
  return parsed as YearlyListeningSnapshot;
}

function isMonthlySnapshot(value: unknown): value is MonthlyListeningSnapshot {
  if (isRecord(value) && value.dateBasis !== undefined && value.dateBasis !== "createdAt") return false;
  if (!isRecord(value) || value.version !== LISTENING_YEARBOOK_VERSION || value.scope !== "month" || !Number.isInteger(value.year) || !isMonth(value.month) || typeof value.title !== "string" || (value.mode !== "memory" && value.mode !== "full") || !isTheme(value.theme, value.month) || !isListeningAnalysis(value.analysis) || !Array.isArray(value.days) || !value.days.every(isDaySnapshot) || !isContextOverview(value.context) || !isStringArray(value.reflectionEntryIds)) return false;
  // Legacy reports used manual archive months with listening-day context; preserve their validated data.
  // Only reports explicitly generated by recording date require all days to belong to that month.
  return value.dateBasis === undefined || value.days.every((day) => day.date.startsWith(`${value.year}-${String(value.month).padStart(2, "0")}-`));
}

function isYearlySnapshot(value: unknown): value is YearlyListeningSnapshot {
  if (isRecord(value) && value.dateBasis !== undefined && value.dateBasis !== "createdAt") return false;
  if (!isRecord(value) || value.version !== LISTENING_YEARBOOK_VERSION || value.scope !== "year" || !Number.isInteger(value.year) || typeof value.title !== "string" || (value.mode !== "memory" && value.mode !== "compact" && value.mode !== "full") || !isListeningAnalysis(value.analysis) || !Array.isArray(value.months) || !isNonNegativeInt(value.undatedEntryCount) || !isContextOverview(value.context) || !Array.isArray(value.migrations)) return false;
  if (!value.months.every((month) => isRecord(month) && isMonth(month.month) && typeof month.title === "string" && (month.mode === "memory" || month.mode === "full") && isTheme(month.theme, month.month) && isNonNegativeInt(month.entryCount) && isNullableString(month.topFeeling) && isNullableString(month.topSubject))) return false;
  return value.migrations.every((item) => isRecord(item) && (item.kind === "new" || item.kind === "persistent" || item.kind === "fading") && typeof item.term === "string" && Array.isArray(item.months) && item.months.every(isMonth) && typeof item.text === "string");
}

function isListeningAnalysis(value: unknown): value is ListeningAnalysis {
  if (!isRecord(value) || value.version !== LISTENING_ANALYSIS_VERSION || typeof value.sourceFingerprint !== "string" || !isStringArray(value.sourceEntryIds) || !isNonNegativeInt(value.sourceEntryCount) || !isNonNegativeInt(value.characterCount) || !Array.isArray(value.hits)) return false;
  if (!Array.isArray(value.feelings) || !value.feelings.every(isMetric) || !Array.isArray(value.subjects) || !value.subjects.every(isMetric) || !Array.isArray(value.expressions) || !value.expressions.every(isMetric) || !Array.isArray(value.genres) || !value.genres.every(isMetric)) return false;
  if (!Array.isArray(value.pairs) || !value.pairs.every((item) => isRecord(item) && typeof item.subject === "string" && typeof item.descriptor === "string" && isMetricBody(item))) return false;
  return Array.isArray(value.representativeQuotes) && value.representativeQuotes.every((quote) => isRecord(quote) && typeof quote.entryId === "string" && typeof quote.sentence === "string" && typeof quote.score === "number" && Number.isFinite(quote.score));
}

function isMetric(value: unknown) {
  return isRecord(value) && typeof value.name === "string" && typeof value.category === "string" && isMetricBody(value);
}

function isMetricBody(value: Record<string, unknown>) {
  return isNonNegativeInt(value.count) && isNonNegativeInt(value.entryCount) && isStringArray(value.entryIds) && Array.isArray(value.evidence) && value.evidence.every((item) => isRecord(item) && typeof item.entryId === "string" && typeof item.sentence === "string");
}

function isDaySnapshot(value: unknown): value is ListeningDaySnapshot {
  if (!isRecord(value) || typeof value.date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value.date) || !isStringArray(value.entryIds) || !isNonNegativeInt(value.entryCount) || !isRecord(value.day) || !isListeningAnalysis(value.analysis)) return false;
  if (value.weather !== null) {
    try { parseWeatherRecord(value.weather); } catch { return false; }
  }
  return value.day.date === value.date && typeof value.day.kindLabel === "string" && isDayKind(value.day.kind) && isStringArray(value.day.festivals) && isNullableString(value.day.officialHolidayName) && typeof value.day.officialDataAvailable === "boolean";
}

function isContextOverview(value: unknown): value is ContextOverview {
  if (!isRecord(value) || !isNonNegativeInt(value.exactDateCount) || !Array.isArray(value.dayKinds) || !Array.isArray(value.festivals) || !Array.isArray(value.weather) || !Array.isArray(value.insights)) return false;
  return value.dayKinds.every((item) => isRecord(item) && isDayKind(item.kind) && typeof item.label === "string" && isNonNegativeInt(item.count))
    && value.festivals.every((item) => isRecord(item) && typeof item.name === "string" && isNonNegativeInt(item.count) && isStringArray(item.dates))
    && value.weather.every((item) => isRecord(item) && (item.category === "sunny" || item.category === "cloudy" || item.category === "rain" || item.category === "snow") && typeof item.label === "string" && isNonNegativeInt(item.count))
    && value.insights.every((item) => isRecord(item) && (item.basis === "day-kind" || item.basis === "weather") && typeof item.text === "string" && typeof item.term === "string" && typeof item.strongerGroup === "string" && isNonNegativeInt(item.strongerCount) && isNonNegativeInt(item.strongerTotal) && typeof item.weakerGroup === "string" && isNonNegativeInt(item.weakerCount) && isNonNegativeInt(item.weakerTotal) && isStringArray(item.evidenceDates));
}

function isTheme(value: unknown, month: number) {
  const theme = MONTH_THEMES[month - 1];
  return isRecord(value) && value.id === theme.id && value.name === theme.name && value.eyebrow === theme.eyebrow && value.accent === theme.accent;
}

function isMonth(value: unknown): value is number {
  return Number.isInteger(value) && Number(value) >= 1 && Number(value) <= 12;
}

function isNonNegativeInt(value: unknown): value is number {
  return Number.isInteger(value) && Number(value) >= 0;
}

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === "string";
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function isDayKind(value: unknown): value is DayKind {
  return value === "ordinary_workday" || value === "adjusted_workday" || value === "ordinary_holiday" || value === "public_holiday";
}

function buildContextOverview(days: ListeningDaySnapshot[], minimumDays: number, minimumGroupDays: number): ContextOverview {
  const dayKinds = countNamed(days, (day) => day.day.kind, (kind) => dayKindLabel(kind as DayKind)).map((item) => ({ kind: item.name as DayKind, label: item.label, count: item.count }));
  const festivalMap = new Map<string, string[]>();
  for (const day of days) for (const festival of day.day.festivals) festivalMap.set(festival, [...(festivalMap.get(festival) ?? []), day.date]);
  const festivals = Array.from(festivalMap, ([name, dates]) => ({ name, count: dates.length, dates })).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, "zh-CN"));
  const weather = countNamed(days.filter((day) => day.weather), (day) => (day.weather as WeatherRecord).category, (category) => days.find((day) => day.weather?.category === category)?.weather?.categoryLabel ?? category)
    .map((item) => ({ category: item.name as WeatherRecord["category"], label: item.label, count: item.count }));
  const insights: ContextInsight[] = [];
  if (days.length >= minimumDays) {
    const dayKindInsight = compareTwoGroups(days, "day-kind", (day) => day.day.kind === "ordinary_workday" || day.day.kind === "adjusted_workday" ? "工作日" : "假日", minimumGroupDays);
    if (dayKindInsight) insights.push(dayKindInsight);
    const weatherInsight = compareWeatherGroups(days, minimumGroupDays);
    if (weatherInsight) insights.push(weatherInsight);
  }
  return { exactDateCount: days.length, dayKinds, festivals, weather, insights };
}

function compareWeatherGroups(days: ListeningDaySnapshot[], minimumGroupDays: number) {
  const available = days.filter((day) => day.weather);
  const groups = groupDays(available, (day) => (day.weather as WeatherRecord).categoryLabel).filter(([, items]) => items.length >= minimumGroupDays);
  let result: ContextInsight | null = null;
  for (let left = 0; left < groups.length; left += 1) {
    for (let right = left + 1; right < groups.length; right += 1) {
      const compared = compareGroups("weather", groups[left], groups[right]);
      if (compared && (!result || coverageGap(compared) > coverageGap(result))) result = compared;
    }
  }
  return result;
}

function compareTwoGroups(days: ListeningDaySnapshot[], basis: ContextInsight["basis"], keyOf: (day: ListeningDaySnapshot) => string, minimumGroupDays: number) {
  const groups = groupDays(days, keyOf).filter(([, items]) => items.length >= minimumGroupDays);
  return groups.length === 2 ? compareGroups(basis, groups[0], groups[1]) : null;
}

function compareGroups(basis: ContextInsight["basis"], left: [string, ListeningDaySnapshot[]], right: [string, ListeningDaySnapshot[]]) {
  const terms = unique([...left[1].flatMap(dayFeelingNames), ...right[1].flatMap(dayFeelingNames)]);
  const comparisons = terms.map((term) => {
    const leftDates = left[1].filter((day) => dayFeelingNames(day).includes(term)).map((day) => day.date);
    const rightDates = right[1].filter((day) => dayFeelingNames(day).includes(term)).map((day) => day.date);
    const leftCoverage = leftDates.length / left[1].length;
    const rightCoverage = rightDates.length / right[1].length;
    const stronger = leftCoverage >= rightCoverage ? { group: left, dates: leftDates } : { group: right, dates: rightDates };
    const weaker = leftCoverage >= rightCoverage ? { group: right, dates: rightDates } : { group: left, dates: leftDates };
    return { term, difference: Math.abs(leftCoverage - rightCoverage), stronger, weaker };
  }).filter((item) => item.difference >= 0.3 && item.stronger.dates.length >= 2)
    .sort((a, b) => b.difference - a.difference || b.stronger.dates.length - a.stronger.dates.length || a.term.localeCompare(b.term, "zh-CN"));
  const best = comparisons[0];
  if (!best) return null;
  const insight: ContextInsight = {
    basis,
    text: `在有记录的${best.stronger.group[0]}里，“${best.term}”覆盖 ${best.stronger.dates.length}/${best.stronger.group[1].length} 个乐评日；${best.weaker.group[0]}为 ${best.weaker.dates.length}/${best.weaker.group[1].length}。`,
    term: best.term,
    strongerGroup: best.stronger.group[0],
    strongerCount: best.stronger.dates.length,
    strongerTotal: best.stronger.group[1].length,
    weakerGroup: best.weaker.group[0],
    weakerCount: best.weaker.dates.length,
    weakerTotal: best.weaker.group[1].length,
    evidenceDates: [...best.stronger.dates, ...best.weaker.dates],
  };
  return insight;
}

function buildMigrations(months: MonthlyListeningSnapshot[]) {
  if (months.length < 3) return [];
  const terms = new Map<string, number[]>();
  for (const month of months) for (const metric of month.analysis.feelings) terms.set(metric.name, [...(terms.get(metric.name) ?? []), month.month]);
  return Array.from(terms, ([term, rawMonths]) => {
    const present = unique(rawMonths).sort((a, b) => a - b);
    if (present.length >= 3 && present[present.length - 1] - present[0] >= 5) return { kind: "persistent" as const, term, months: present, text: `“${term}”贯穿 ${present[0]} 月至 ${present[present.length - 1]} 月，是持续出现的听感词。` };
    if (present[0] >= 7) return { kind: "new" as const, term, months: present, text: `“${term}”从 ${present[0]} 月开始进入你的评价语言。` };
    if (present[present.length - 1] <= 6) return { kind: "fading" as const, term, months: present, text: `“${term}”主要出现在上半年，最后一次出现在 ${present[present.length - 1]} 月。` };
    return null;
  }).filter((item): item is AestheticMigration => !!item)
    .sort((a, b) => ({ persistent: 0, new: 1, fading: 2 }[a.kind] - { persistent: 0, new: 1, fading: 2 }[b.kind]) || b.months.length - a.months.length || a.term.localeCompare(b.term, "zh-CN"))
    .slice(0, 6);
}

function automaticEntries(entries: ReviewEntry[]): ReviewEntry[] {
  return entries.filter((entry) => entry.type === "song" || entry.type === "album");
}

function exactDate(entry: ReviewEntry) {
  return localDateOf(entry.createdAt);
}

// Reports use the first formal save; editing or changing listening metadata never moves a review.
export function inRecordingPeriod(entry: ReviewEntry, year: number, month?: number) {
  const date = new Date(entry.createdAt);
  return date.getFullYear() === year && (month === undefined || date.getMonth() + 1 === month);
}

function listeningTitle(prefix: string, analysis: ListeningAnalysis) {
  const feeling = analysis.feelings[0]?.name;
  const subject = analysis.subjects[0]?.name;
  if (feeling && subject) return `${prefix}，${feeling}落在${subject}上`;
  if (feeling) return `${prefix}，${feeling}留下了回声`;
  if (subject) return `${prefix}，凝视${subject}`;
  return `${prefix} 的音乐感受`;
}

function metricLines(metrics: ListeningAnalysis["feelings"]) {
  return metrics.length ? metrics.slice(0, 8).map((metric) => `- ${metric.name}：${metric.count} 次，涉及 ${metric.entryCount} 篇乐评`) : ["本期较少描述这一方面。"];
}

function summaryModeLabel(mode: SummaryMode) {
  if (mode === "memory") return "记忆卡";
  if (mode === "compact") return "精简版";
  return "完整作品";
}

function dayFeelingNames(day: ListeningDaySnapshot) {
  return day.analysis.feelings.map((item) => item.name);
}

function groupDays(days: ListeningDaySnapshot[], keyOf: (day: ListeningDaySnapshot) => string) {
  const grouped = new Map<string, ListeningDaySnapshot[]>();
  for (const day of days) grouped.set(keyOf(day), [...(grouped.get(keyOf(day)) ?? []), day]);
  return Array.from(grouped.entries()).sort(([a], [b]) => a.localeCompare(b, "zh-CN"));
}

function countNamed(days: ListeningDaySnapshot[], keyOf: (day: ListeningDaySnapshot) => string, labelOf: (key: string) => string) {
  return groupDays(days, keyOf).map(([name, items]) => ({ name, label: labelOf(name), count: items.length })).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, "zh-CN"));
}

function dayKindLabel(kind: DayKind) {
  if (kind === "ordinary_workday") return "普通工作日";
  if (kind === "adjusted_workday") return "调休工作日";
  if (kind === "ordinary_holiday") return "普通假日";
  return "节假日";
}

function coverageGap(insight: ContextInsight) {
  return insight.strongerCount / insight.strongerTotal - insight.weakerCount / insight.weakerTotal;
}

function unique<T>(values: T[]) {
  return Array.from(new Set(values));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

