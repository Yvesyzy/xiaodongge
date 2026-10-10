import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve, join } from "node:path";
import { chromium } from "playwright";
import { createServer } from "vite";
import { freeLoopbackPort, qaOptions } from "./codex_qa_options.mjs";

const qa = qaOptions({ output: "release/codex_diagnostics_qa" });
const output = resolve(qa.output);
await mkdir(output, { recursive: true });
let origin = qa.origin;
let server;
if (!process.argv.includes("--origin")) {
  server = await createServer({ configFile: resolve("mobile/vite.config.ts"), cacheDir: join(output, "vite-cache"),
    server: { host: "127.0.0.1", port: await freeLoopbackPort(), strictPort: true, forwardConsole: false } });
  await server.listen();
  origin = `http://127.0.0.1:${server.httpServer.address().port}`;
}
const marker = "CODEX_PRIVATE_T17_Q71";
const health = { version: 1, backupVersion: 6, exportedAt: "2026-09-23T10:00:00.000Z",
  verifiedAt: "2026-09-24T10:00:00.000Z", lastSavedAt: "2026-09-24T11:00:00.000Z",
  lastSavedFileName: `D:\\secret\\${marker}.json`, byteLength: 99, sha256: "a".repeat(64),
  entryCount: 1, summaryCount: 0, monthlySummaryCount: 0, coverCount: 1, listeningMomentCount: 0, draftCount: 1 };
const draft = { version: 2, mode: "create", captureMode: "full", entryId: null, draftId: "t17-valid",
  baseUpdatedAt: null, savedAt: "2026-09-24T09:00:00.000Z",
  fields: { type: "album", title: marker, year: "2026", month: "9", albumName: marker,
    songName: "", artistName: marker, listenedAt: "2026-09-24", tags: "", rating: "8", ratingModifier: "",
    ratingProduction: "", ratingSongwriting: "", ratingOriginality: "", ratingResonance: "", content: marker },
  genreSelection: { level1: "", level2: "", level3: "" }, selectedGenreTags: [], selectedMoodGroupId: "",
  selectedMoods: [], coverDataUrl: `data:image/png;base64,${marker}`, coverChanged: true, ocrText: marker,
  recognizedFields: null, musicMetadata: null, compositeRatingLocked: false, inspiration: false };
const report = { passed: false, checks: [], externalRequests: [] };
let browser;
try {
  browser = await chromium.launch({ channel: "chrome", headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  page.setDefaultTimeout(15000);
  await page.route("**/*", route => {
    if (new URL(route.request().url()).origin === origin) return route.continue();
    report.externalRequests.push(route.request().url());
    return route.abort();
  });
  await page.goto(`${origin}/#/privacy`);
  await page.evaluate(({ marker, health, draft }) => {
    localStorage.clear();
    localStorage.setItem("music-feelings-entry-draft:v1:new:t17-valid", JSON.stringify(draft));
    localStorage.setItem("music-feelings-entry-draft:v1:new:t17-damaged", `{${marker}`);
    localStorage.setItem("music-feelings-mobile-app-data", JSON.stringify({ "backup-health:v1": JSON.stringify(health) }));
    localStorage.setItem("music-feelings-mobile-covers", JSON.stringify({ secret: `data:image/png;base64,${marker}` }));
    localStorage.setItem("music-feelings-storage-corruption:v1", JSON.stringify({ version: 1, key: "sensitive", raw: marker, detectedAt: "2026-09-24T00:00:00.000Z" }));
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: async text => { window.codexCopiedDiagnostics = text; } } });
  }, { marker, health, draft });
  const before = await page.evaluate(() => JSON.stringify(Object.fromEntries(Object.keys(localStorage).sort().map(key => [key, localStorage.getItem(key)]))));
  await page.goto(`${origin}/#/diagnostics`);
  await page.getByRole("heading", { name: "本机诊断" }).waitFor();
  await page.getByText("格式有效草稿：1").waitFor();
  await page.getByText("损坏草稿：1").waitFor();
  await page.getByText(/Web 构建标识：web-\d{4}-/).waitFor();
  await page.getByText("通知读取权限：仅 Android 可读").waitFor();
  await page.getByRole("button", { name: "复制脱敏诊断" }).click();
  const copied = await page.evaluate(() => window.codexCopiedDiagnostics);
  assert.ok(copied.includes("备份验证时间：2026-09-24T10:00:00.000Z"));
  assert.ok(copied.includes("备份保存时间：2026-09-24T11:00:00.000Z"));
  assert.ok(!copied.includes(marker) && !copied.includes("D:\\secret"));
  const after = await page.evaluate(() => JSON.stringify(Object.fromEntries(Object.keys(localStorage).sort().map(key => [key, localStorage.getItem(key)]))));
  assert.equal(after, before, "Reading and copying diagnostics must not alter stored data");
  assert.deepEqual(report.externalRequests, []);
  report.checks.push("real build/version and backup timestamps, valid/damaged drafts, offline local read and white-listed copy preserve storage and hide title/body/OCR/cover/path markers");

  await page.evaluate(() => {
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: undefined });
    window.codexOriginalExecCommand = document.execCommand;
    document.execCommand = () => false;
  });
  await page.getByRole("button", { name: "复制脱敏诊断" }).click();
  await page.getByText("复制失败，可长按上方摘要选择复制").waitFor();
  await page.evaluate(() => { document.execCommand = window.codexOriginalExecCommand; });
  await page.evaluate(() => Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: async text => { window.codexCopiedDiagnostics = text; } } }));
  report.checks.push("all copy paths unavailable reports a visible failure without throwing or exposing diagnostics");

  const injected = await page.evaluate(async marker => {
    const { store } = await import("/src/store.ts");
    const { readDiagnostics, diagnosticsCopyText } = await import("/src/codex_DiagnosticsPage.tsx");
    const original = store.getStoredAppData;
    store.getStoredAppData = async () => { throw new Error(marker); };
    try { const snapshot = await readDiagnostics(); return { codes: snapshot.errorCodes, text: diagnosticsCopyText(snapshot) }; }
    finally { store.getStoredAppData = original; }
  }, marker);
  assert.deepEqual(injected.codes, ["backup_read_failed"]);
  assert.match(injected.text, /应用数据读取失败，数据库状态未知/);
  assert.ok(!injected.text.includes(marker));
  report.checks.push("raw storage exception is reduced to a fixed stage code and cannot enter copied diagnostics");

  const environment = await page.evaluate(async marker => {
    const { NowPlaying } = await import("/src/nativeNowPlaying.ts");
    const { readDiagnostics, diagnosticsCopyText } = await import("/src/codex_DiagnosticsPage.tsx");
    const platform = window.Capacitor.getPlatform;
    const original = NowPlaying.getDiagnostics;
    window.Capacitor.getPlatform = () => "android";
    NowPlaying.getDiagnostics = async () => ({ versionName: "synthetic", versionCode: 1, notificationAccessEnabled: false,
      manufacturer: "合成厂商", model: "合成型号", androidApi: 24,
      webViewPackage: "com.huawei.webview", webViewVersion: "10.0.0.0", deviceId: marker });
    try {
      const snapshot = await readDiagnostics();
      return { runtime: snapshot.runtimeEnvironment, engine: snapshot.webEngine, copy: diagnosticsCopyText(snapshot) };
    } finally { window.Capacitor.getPlatform = platform; NowPlaying.getDiagnostics = original; }
  }, marker);
  assert.equal(environment.runtime, "合成厂商 合成型号；Android API 24");
  assert.equal(environment.engine, "com.huawei.webview 10.0.0.0");
  assert.ok(!environment.copy.includes(marker));
  report.checks.push("synthetic Android provider/version and non-unique model/API are shown; unrequested device ID is excluded");

  await page.evaluate(async value => { const { markRecoveryError } = await import("/src/codex_restoreState.ts"); markRecoveryError(new Error(value)); }, marker);
  await page.evaluate(() => { location.hash = "/more"; });
  await page.getByRole("link", { name: "查看本机诊断" }).waitFor();
  await context.setOffline(true);
  await page.getByRole("link", { name: "查看本机诊断" }).click();
  await page.getByRole("heading", { name: "本机诊断" }).waitFor();
  await page.getByText(/存储状态：只读：恢复屏障或错误/).waitFor();
  await page.getByRole("button", { name: "复制脱敏诊断" }).click();
  assert.ok(!(await page.evaluate(() => window.codexCopiedDiagnostics)).includes(marker));
  await context.setOffline(false);
  report.checks.push("offline diagnostics remains reachable through the recovery read-only barrier; raw recovery error is excluded from copied text");
  report.passed = true;
} catch (error) { report.error = error instanceof Error ? error.stack : String(error); process.exitCode = 1; }
finally { await browser?.close(); await server?.close(); await writeFile(join(output, "codex_results.json"), JSON.stringify(report, null, 2)); }
console.log(JSON.stringify({ passed: report.passed, checks: report.checks, error: report.error }));
