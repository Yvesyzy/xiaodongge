import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { Module } from "node:module";
import ts from "typescript";

const require = Module.createRequire(import.meta.url);
const source = readFileSync(new URL("../shared/listeningContext.ts", import.meta.url), "utf8");
const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } });
const mod = { exports: {} };
new Function("exports", "require", "module", outputText)(mod.exports, require, mod);
const { classifyDay, fetchHistoricalWeather, fetchHistoricalWeatherRange, officialHolidaySource, parseWeatherLocation, parseWeatherRecord, searchWeatherLocations, weatherCategory } = mod.exports;

assert.deepEqual(classifyDay("2026-01-04"), { date: "2026-01-04", kind: "adjusted_workday", kindLabel: "调休工作日", festivals: [], officialHolidayName: null, officialDataAvailable: true });
assert.equal(classifyDay("2026-02-16").officialHolidayName, "春节");
assert.equal(classifyDay("2026-02-14").kind, "adjusted_workday");
assert.deepEqual(classifyDay("2026-02-14").festivals, ["情人节"]);
assert.equal(classifyDay("2026-12-25").festivals[0], "圣诞节");
assert.equal(classifyDay("2024-12-29").kind, "ordinary_holiday");
assert.equal(classifyDay("2024-12-29").officialDataAvailable, false);
assert.ok(officialHolidaySource(2026).startsWith("https://www.gov.cn/"));
assert.equal(weatherCategory(0).category, "sunny");
assert.equal(weatherCategory(3).category, "cloudy");
assert.equal(weatherCategory(63).category, "rain");
assert.equal(weatherCategory(75).category, "snow");

const locationResponse = { results: [{ name: "广州", admin1: "广东", country: "中国", country_code: "CN", latitude: 23.1291, longitude: 113.2644, timezone: "Asia/Shanghai" }] };
const locations = await searchWeatherLocations("广州", async () => new Response(JSON.stringify(locationResponse), { status: 200 }));
assert.deepEqual(locations[0], { name: "广州", admin1: "广东", country: "中国", countryCode: "CN", latitude: 23.13, longitude: 113.26, timezone: "Asia/Shanghai" });

const weatherResponse = { daily: { time: ["2026-03-08"], weather_code: [61], temperature_2m_max: [19.2], temperature_2m_min: [12.4], precipitation_sum: [4.1], snowfall_sum: [0] } };
const weather = await fetchHistoricalWeather(locations[0], "2026-03-08", async () => new Response(JSON.stringify(weatherResponse), { status: 200 }));
assert.equal(weather.category, "rain");
assert.equal(weather.temperatureMax, 19.2);
assert.equal(weather.precipitation, 4.1);
const rangeResponse = { daily: { time: ["2026-03-08", "2026-03-09"], weather_code: [61, 2], temperature_2m_max: [19.2, 20.5], temperature_2m_min: [12.4, 13.1], precipitation_sum: [4.1, 0], snowfall_sum: [0, 0] } };
const rangeWeather = await fetchHistoricalWeatherRange(locations[0], "2026-03-08", "2026-03-09", async () => new Response(JSON.stringify(rangeResponse), { status: 200 }));
assert.deepEqual(rangeWeather.map((item) => [item.date, item.category]), [["2026-03-08", "rain"], ["2026-03-09", "cloudy"]]);
assert.deepEqual(parseWeatherLocation(locations[0]), locations[0]);
assert.deepEqual(parseWeatherRecord(weather), weather);
assert.throws(() => parseWeatherLocation({ name: "广州" }), /格式无效/);

console.log("mobile listening context check passed");
