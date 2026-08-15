export const HOLIDAY_DATA_VERSION = 1;

export type DayKind = "ordinary_workday" | "adjusted_workday" | "ordinary_holiday" | "public_holiday";

export type DayContext = {
  date: string;
  kind: DayKind;
  kindLabel: string;
  festivals: string[];
  officialHolidayName: string | null;
  officialDataAvailable: boolean;
};

export type WeatherLocation = {
  name: string;
  admin1: string | null;
  country: string;
  countryCode: string;
  latitude: number;
  longitude: number;
  timezone: string;
};

export type WeatherRecord = {
  date: string;
  location: WeatherLocation;
  weatherCode: number;
  category: "sunny" | "cloudy" | "rain" | "snow";
  categoryLabel: string;
  temperatureMax: number;
  temperatureMin: number;
  precipitation: number;
  fetchedAt: string;
};

type HolidayYear = {
  source: string;
  holidays: Array<{ name: string; dates: string[] }>;
  adjustedWorkdays: string[];
};

const HOLIDAYS: Record<number, HolidayYear> = {
  2025: {
    source: "https://www.gov.cn/zhengce/zhengceku/202411/content_6986383.htm",
    holidays: [
      { name: "元旦", dates: dates("2025-01-01", "2025-01-01") },
      { name: "春节", dates: dates("2025-01-28", "2025-02-04") },
      { name: "清明节", dates: dates("2025-04-04", "2025-04-06") },
      { name: "劳动节", dates: dates("2025-05-01", "2025-05-05") },
      { name: "端午节", dates: dates("2025-05-31", "2025-06-02") },
      { name: "国庆节、中秋节", dates: dates("2025-10-01", "2025-10-08") },
    ],
    adjustedWorkdays: ["2025-01-26", "2025-02-08", "2025-04-27", "2025-09-28", "2025-10-11"],
  },
  2026: {
    source: "https://www.gov.cn/zhengce/zhengceku/202511/content_7047091.htm",
    holidays: [
      { name: "元旦", dates: dates("2026-01-01", "2026-01-03") },
      { name: "春节", dates: dates("2026-02-15", "2026-02-23") },
      { name: "清明节", dates: dates("2026-04-04", "2026-04-06") },
      { name: "劳动节", dates: dates("2026-05-01", "2026-05-05") },
      { name: "端午节", dates: dates("2026-06-19", "2026-06-21") },
      { name: "中秋节", dates: dates("2026-09-25", "2026-09-27") },
      { name: "国庆节", dates: dates("2026-10-01", "2026-10-07") },
    ],
    adjustedWorkdays: ["2026-01-04", "2026-02-14", "2026-02-28", "2026-05-09", "2026-09-20", "2026-10-10"],
  },
  // ponytail: 2027年数据根据新版《全国年节及纪念日放假办法》推算，调休补班日待2026年11月官方通知确认后更新
  2027: {
    source: "根据新版《全国年节及纪念日放假办法》（2025年1月1日起实施）推算",
    holidays: [
      { name: "元旦", dates: dates("2027-01-01", "2027-01-03") },
      { name: "春节", dates: dates("2027-02-05", "2027-02-13") },
      { name: "清明节", dates: dates("2027-04-03", "2027-04-05") },
      { name: "劳动节", dates: dates("2027-05-01", "2027-05-05") },
      { name: "端午节", dates: dates("2027-06-19", "2027-06-21") },
      { name: "中秋节", dates: dates("2027-09-25", "2027-09-27") },
      { name: "国庆节", dates: dates("2027-10-01", "2027-10-07") },
    ],
    adjustedWorkdays: [],
  },
};

const FIXED_FESTIVALS: Record<string, string> = {
  "01-01": "元旦",
  "02-14": "情人节",
  "05-01": "劳动节",
  "10-01": "国庆节",
  "12-25": "圣诞节",
};

export function classifyDay(date: string): DayContext {
  assertDate(date);
  const year = Number(date.slice(0, 4));
  const official = HOLIDAYS[year];
  const holiday = official?.holidays.find((item) => item.dates.includes(date)) ?? null;
  const adjusted = official?.adjustedWorkdays.includes(date) ?? false;
  const weekday = new Date(`${date}T00:00:00+08:00`).getDay();
  const weekend = weekday === 0 || weekday === 6;
  const kind: DayKind = adjusted ? "adjusted_workday" : holiday ? "public_holiday" : weekend ? "ordinary_holiday" : "ordinary_workday";
  const festivals = new Set<string>();
  if (holiday) festivals.add(holiday.name);
  const fixed = FIXED_FESTIVALS[date.slice(5)];
  if (fixed) festivals.add(fixed);
  return {
    date,
    kind,
    kindLabel: dayKindLabel(kind),
    festivals: Array.from(festivals),
    officialHolidayName: holiday?.name ?? null,
    officialDataAvailable: !!official,
  };
}

export function dayKindLabel(kind: DayKind) {
  if (kind === "adjusted_workday") return "调休工作日";
  if (kind === "ordinary_holiday") return "普通假日";
  if (kind === "public_holiday") return "节假日";
  return "普通工作日";
}

export function officialHolidaySource(year: number) {
  return HOLIDAYS[year]?.source ?? null;
}

export async function searchWeatherLocations(query: string, fetcher: typeof fetch = fetch): Promise<WeatherLocation[]> {
  const name = query.trim();
  if (name.length < 2) return [];
  const url = new URL("https://geocoding-api.open-meteo.com/v1/search");
  url.search = new URLSearchParams({ name, count: "5", language: "zh", countryCode: "CN", format: "json" }).toString();
  const response = await fetcher(url, { signal: createAbortSignal(8_000) });
  if (!response.ok) throw new Error(`城市查询失败（${response.status}）`);
  const data = await response.json() as unknown;
  if (!isRecord(data) || !Array.isArray(data.results)) return [];
  return data.results.flatMap((item) => {
    if (!isRecord(item) || typeof item.name !== "string" || typeof item.country !== "string" || typeof item.country_code !== "string" || typeof item.latitude !== "number" || typeof item.longitude !== "number" || typeof item.timezone !== "string") return [];
    return [{ name: item.name, admin1: typeof item.admin1 === "string" ? item.admin1 : null, country: item.country, countryCode: item.country_code, latitude: roundCoordinate(item.latitude), longitude: roundCoordinate(item.longitude), timezone: item.timezone }];
  });
}

export async function fetchHistoricalWeather(location: WeatherLocation, date: string, fetcher: typeof fetch = fetch): Promise<WeatherRecord> {
  const weather = await fetchHistoricalWeatherRange(location, date, date, fetcher);
  if (!weather[0]) throw new Error("天气数据缺少指定日期");
  return weather[0];
}

export async function fetchHistoricalWeatherRange(location: WeatherLocation, startDate: string, endDate: string, fetcher: typeof fetch = fetch): Promise<WeatherRecord[]> {
  assertDate(startDate);
  assertDate(endDate);
  if (startDate > endDate) throw new Error("天气查询开始日期不能晚于结束日期");
  const url = new URL("https://archive-api.open-meteo.com/v1/archive");
  url.search = new URLSearchParams({
    latitude: String(location.latitude),
    longitude: String(location.longitude),
    start_date: startDate,
    end_date: endDate,
    daily: "weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,snowfall_sum",
    timezone: location.timezone,
  }).toString();
  const response = await fetcher(url, { signal: createAbortSignal(10_000) });
  if (!response.ok) throw new Error(`天气查询失败（${response.status}）`);
  const data = await response.json() as unknown;
  if (!isRecord(data) || !isRecord(data.daily)) throw new Error("天气数据格式无效");
  const daily = data.daily;
  const fetchedAt = new Date().toISOString();
  return readArray(daily.time).map((date, index) => {
    if (typeof date !== "string") throw new Error("天气数据日期格式无效");
    assertDate(date);
    const weatherCode = readNumberAt(daily.weather_code, index);
    const temperatureMax = readNumberAt(daily.temperature_2m_max, index);
    const temperatureMin = readNumberAt(daily.temperature_2m_min, index);
    const precipitation = readNumberAt(daily.precipitation_sum, index);
    return { date, location, weatherCode, ...weatherCategory(weatherCode), temperatureMax, temperatureMin, precipitation, fetchedAt };
  });
}

export function weatherCategory(code: number): Pick<WeatherRecord, "category" | "categoryLabel"> {
  if ([71, 73, 75, 77, 85, 86].includes(code)) return { category: "snow", categoryLabel: "雪" };
  if ([51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82, 95, 96, 99].includes(code)) return { category: "rain", categoryLabel: "雨" };
  if ([1, 2, 3, 45, 48].includes(code)) return { category: "cloudy", categoryLabel: "多云或阴" };
  return { category: "sunny", categoryLabel: "晴" };
}

export function parseWeatherLocation(value: unknown): WeatherLocation {
  if (!isRecord(value) || typeof value.name !== "string" || (value.admin1 !== null && typeof value.admin1 !== "string") || typeof value.country !== "string" || typeof value.countryCode !== "string" || typeof value.latitude !== "number" || typeof value.longitude !== "number" || typeof value.timezone !== "string") throw new Error("天气城市设置格式无效");
  if (!Number.isFinite(value.latitude) || !Number.isFinite(value.longitude) || value.latitude < -90 || value.latitude > 90 || value.longitude < -180 || value.longitude > 180) throw new Error("天气城市坐标无效");
  return { name: value.name, admin1: value.admin1, country: value.country, countryCode: value.countryCode, latitude: value.latitude, longitude: value.longitude, timezone: value.timezone };
}

export function parseWeatherRecord(value: unknown): WeatherRecord {
  if (!isRecord(value) || typeof value.date !== "string" || typeof value.weatherCode !== "number" || typeof value.category !== "string" || typeof value.categoryLabel !== "string" || typeof value.temperatureMax !== "number" || typeof value.temperatureMin !== "number" || typeof value.precipitation !== "number" || typeof value.fetchedAt !== "string") throw new Error("天气缓存格式无效");
  assertDate(value.date);
  const location = parseWeatherLocation(value.location);
  const category = value.category;
  if (category !== "sunny" && category !== "cloudy" && category !== "rain" && category !== "snow") throw new Error("天气分类无效");
  return { date: value.date, location, weatherCode: value.weatherCode, category, categoryLabel: value.categoryLabel, temperatureMax: value.temperatureMax, temperatureMin: value.temperatureMin, precipitation: value.precipitation, fetchedAt: value.fetchedAt };
}

function dates(start: string, end: string) {
  const result: string[] = [];
  const cursor = new Date(`${start}T00:00:00Z`);
  const last = new Date(`${end}T00:00:00Z`);
  while (cursor <= last) {
    result.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return result;
}

function assertDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error("日期必须是有效的 YYYY-MM-DD");
  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) throw new Error("日期必须是有效的 YYYY-MM-DD");
}

function roundCoordinate(value: number) {
  return Math.round(value * 100) / 100;
}

function readNumberAt(value: unknown, index: number) {
  const array = readArray(value);
  const item = array[index];
  if (index < 0 || typeof item !== "number" || !Number.isFinite(item)) throw new Error("天气数据缺少指定日期");
  return item;
}

function readArray(value: unknown): unknown[] {
  if (!Array.isArray(value)) throw new Error("天气数据格式无效");
  return value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

// ponytail: AbortSignal.timeout 在 Android WebView < Chromium 103 不可用，手动实现兼容
function createAbortSignal(timeoutMs: number): AbortSignal {
  const controller = new AbortController();
  setTimeout(() => controller.abort(), timeoutMs);
  return controller.signal;
}
