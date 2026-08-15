import { strict as assert } from "node:assert";
import { test } from "node:test";
import {
  classifyDay,
  dayKindLabel,
  fetchHistoricalWeatherRange,
  officialHolidaySource,
  parseWeatherLocation,
  parseWeatherRecord,
  weatherCategory,
  type WeatherLocation,
} from "./listeningContext.ts";

test("2025 官方节假日与调休", () => {
  const newYear = classifyDay("2025-01-01");
  assert.equal(newYear.kind, "public_holiday");
  assert.equal(newYear.kindLabel, "节假日");
  assert.ok(newYear.festivals.includes("元旦"));
  assert.equal(newYear.officialHolidayName, "元旦");
  assert.equal(newYear.officialDataAvailable, true);
  assert.equal(classifyDay("2025-01-26").kind, "adjusted_workday"); // 春节调休补班(周日)
  assert.equal(classifyDay("2025-05-01").kind, "public_holiday"); // 劳动节
});

test("2026 官方节假日与调休", () => {
  const spring = classifyDay("2026-02-15");
  assert.equal(spring.kind, "public_holiday");
  assert.ok(spring.festivals.includes("春节"));
  assert.equal(classifyDay("2026-01-04").kind, "adjusted_workday"); // 元旦调休补班
  assert.equal(classifyDay("2026-09-20").kind, "adjusted_workday"); // 中秋前补班(周日)
});

test("普通工作日与普通假日", () => {
  assert.equal(classifyDay("2025-07-15").kind, "ordinary_workday");
  assert.equal(classifyDay("2025-07-15").kindLabel, "普通工作日");
  assert.equal(classifyDay("2025-07-12").kind, "ordinary_holiday"); // 周六
  assert.equal(classifyDay("2025-07-13").kind, "ordinary_holiday"); // 周日
  assert.deepEqual(classifyDay("2025-07-12").festivals, []);
});

test("固定节日独立于法定节假日", () => {
  const valentine = classifyDay("2025-02-14"); // 周五
  assert.equal(valentine.kind, "ordinary_workday");
  assert.deepEqual(valentine.festivals, ["情人节"]);
  const xmas = classifyDay("2025-12-25");
  assert.ok(xmas.festivals.includes("圣诞节"));
});

test("无官方数据年份仍保留固定节日", () => {
  const d = classifyDay("2028-01-01"); // 周六,2028 无官方数据
  assert.equal(d.officialDataAvailable, false);
  assert.equal(d.officialHolidayName, null);
  assert.ok(d.festivals.includes("元旦"));
  assert.equal(d.kind, "ordinary_holiday");
});

test("2027 推算数据可用", () => {
  const spring = classifyDay("2027-02-05");
  assert.equal(spring.kind, "public_holiday");
  assert.equal(spring.officialDataAvailable, true);
  assert.equal(classifyDay("2027-10-11").kind, "ordinary_workday");
});

test("非法日期抛错", () => {
  assert.throws(() => classifyDay("2025-13-01"), /有效的 YYYY-MM-DD/);
  assert.throws(() => classifyDay("2025-2-01"), /有效的 YYYY-MM-DD/);
});

test("官方数据来源", () => {
  assert.match(officialHolidaySource(2025), /gov\.cn/);
  assert.equal(officialHolidaySource(2028), null);
});

test("天气码分类", () => {
  assert.deepEqual(weatherCategory(71), { category: "snow", categoryLabel: "雪" });
  assert.deepEqual(weatherCategory(95), { category: "rain", categoryLabel: "雨" });
  assert.deepEqual(weatherCategory(2), { category: "cloudy", categoryLabel: "多云或阴" });
  assert.deepEqual(weatherCategory(0), { category: "sunny", categoryLabel: "晴" });
});

const LOCATION: WeatherLocation = {
  name: "北京",
  admin1: "北京市",
  country: "中国",
  countryCode: "CN",
  latitude: 39.9,
  longitude: 116.41,
  timezone: "Asia/Shanghai",
};

test("历史天气请求参数与解析", async () => {
  const seen = new Map<string, string>();
  const fetcher = async (input: string | URL | Request) => {
    const url = new URL(String(input));
    for (const key of url.searchParams.keys()) seen.set(key, url.searchParams.get(key) ?? "");
    return new Response(JSON.stringify({
      daily: {
        time: ["2025-07-01", "2025-07-02"],
        weather_code: [61, 0],
        temperature_2m_max: [30.1, 31.5],
        temperature_2m_min: [25, 26],
        precipitation_sum: [1.2, 0],
        snowfall_sum: [0, 0],
      },
    }), { status: 200 });
  };
  const records = await fetchHistoricalWeatherRange(LOCATION, "2025-07-01", "2025-07-02", fetcher);
  assert.equal(records.length, 2);
  assert.equal(records[0].category, "rain");
  assert.equal(records[0].weatherCode, 61);
  assert.equal(records[1].category, "sunny");
  assert.equal(records[1].temperatureMax, 31.5);
  assert.equal(seen.get("latitude"), "39.9");
  assert.equal(seen.get("start_date"), "2025-07-01");
  assert.equal(seen.get("timezone"), "Asia/Shanghai");
});

test("天气范围与格式校验", async () => {
  await assert.rejects(fetchHistoricalWeatherRange(LOCATION, "2025-07-02", "2025-07-01", async () => new Response("{}", { status: 200 })), /不能晚于/);
  await assert.rejects(fetchHistoricalWeatherRange(LOCATION, "2025-07-01", "2025-07-01", async () => new Response("{}", { status: 200 })), /格式无效/);
  assert.throws(() => parseWeatherLocation({ ...LOCATION, latitude: 91 }), /坐标无效/);
  assert.throws(() => parseWeatherRecord({}), /格式无效/);
});
