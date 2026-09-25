import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { performance } from "node:perf_hooks";
import { chromium } from "playwright";

const adb = "C:/Users/lenovo/AppData/Local/Android/Sdk/platform-tools/adb.exe";
const serial = "emulator-5562";
const app = "com.yves.musicarchive";
const phase = process.argv[2];
const output = resolve(process.argv[3] ?? "");
assert.ok(["before", "after"].includes(phase), "Usage: node scripts/codex_check_performance.mjs before|after release/<new-report>.json");
assert.ok(process.argv[3], "A fresh report path is required");
const command = (...args) => execFileSync(adb, ["-s", serial, ...args], { encoding: "utf8", windowsHide: true }).trim();
assert.equal(command("emu", "avd", "name").replace(/\r/g, "").split("\n")[0], "codex_np1_api36");
assert.equal(command("shell", "getprop", "sys.boot_completed"), "1");
assert.equal(command("shell", "settings", "get", "global", "wifi_on"), "0", "Project AVD Wi-Fi must be disabled");
assert.equal(command("shell", "settings", "get", "global", "mobile_data"), "0", "Project AVD mobile data must be disabled");

const apk = await readFile(resolve("android/app/build/outputs/apk/debug/app-debug.apk"));
const assets = await readdir(resolve("mobile/dist/assets"), { withFileTypes: true });
const bundle = assets.filter(item => item.isFile() && /^index-.*\.js$/.test(item.name));
assert.equal(bundle.length, 1, "Expected one initial Vite JS bundle");
const js = await readFile(resolve("mobile/dist/assets", bundle[0].name));
const report = {
  phase, avd: "codex_np1_api36", app, apkSha256: createHash("sha256").update(apk).digest("hex"),
  initialJs: { file: bundle[0].name, bytes: js.length },
  startedAt: new Date().toISOString(), cold: [], warm: [], rankExports: [],
};
const sleep = ms => new Promise(done => setTimeout(done, ms));
let browser;
let port;

async function attach(trace = {}) {
  const start = performance.now();
  let socket;
  for (let i = 0; i < 80; i++) {
    let pid;
    try { pid = command("shell", "pidof", app); } catch { await sleep(200); continue; }
    socket = command("shell", "cat", "/proc/net/unix").split(/\r?\n/).map(line => line.split(/\s+/).at(-1))
      .find(name => name === `@webview_devtools_remote_${pid}`);
    if (socket) break;
    await sleep(200);
  }
  assert.ok(socket, "Debug WebView socket unavailable");
  trace.socketReadyMs = Math.round(performance.now() - start);
  port = command("forward", "tcp:0", `localabstract:${socket.slice(1)}`);
  browser = await chromium.connectOverCDP(`http://127.0.0.1:${port}`, { noDefaults: true });
  trace.cdpReadyMs = Math.round(performance.now() - start);
  let page;
  for (let i = 0; i < 40; i++) {
    page = browser.contexts()[0]?.pages()[0];
    if (page) break;
    await sleep(100);
  }
  assert.ok(page, "WebView page unavailable");
  await page.locator(".app-header").waitFor({ timeout: 30000 });
  trace.headerReadyMs = Math.round(performance.now() - start);
  return page;
}

async function detach() {
  await browser?.close();
  browser = undefined;
  if (port) command("forward", "--remove", `tcp:${port}`);
  port = undefined;
}

function memory() {
  const raw = command("shell", "dumpsys", "meminfo", app);
  const match = raw.match(/TOTAL PSS:\s*(\d+)\s+TOTAL RSS:\s*(\d+)\s+TOTAL SWAP PSS:\s*(\d+)/);
  assert.ok(match, "Android meminfo lacks TOTAL PSS/RSS/SWAP PSS");
  return { pssKiB: Number(match[1]), rssKiB: Number(match[2]), swapPssKiB: Number(match[3]) };
}

function stats(samples) {
  const ordered = samples.map(item => item.uiReadyMs).sort((a, b) => a - b);
  return { medianMs: (ordered[4] + ordered[5]) / 2, p90Ms: ordered[8] };
}

try {
  for (const mode of ["cold", "warm"]) {
    for (let i = 0; i < 10; i++) {
      if (mode === "cold") command("shell", "am", "force-stop", app);
      else command("shell", "input", "keyevent", "KEYCODE_HOME");
      const start = performance.now();
      const launch = command("shell", "am", "start", "-W", "-n", `${app}/.MainActivity`);
      const androidCommandDoneMs = Math.round(performance.now() - start);
      const trace = {};
      const page = await attach(trace);
      const item = {
        uiReadyMs: Math.round(performance.now() - start),
        androidCommandDoneMs, attachTrace: trace,
        androidLaunch: Object.fromEntries([...launch.matchAll(/^(ThisTime|TotalTime|WaitTime):\s*(\d+)/gm)].map(match => [match[1], Number(match[2])])),
        memory: memory(),
        location: await page.evaluate(() => location.href),
      };
      if (i === 0) {
        item.homeRequests = await page.evaluate(() => performance.getEntriesByType("resource")
          .map(entry => new URL(entry.name).pathname).filter(path => /\.(?:js|css|woff2?|png|svg)$/.test(path)));
        item.fixture = await page.evaluate(async () => {
          const query = statement => window.Capacitor.nativePromise("CapacitorSQLite", "query", {
            database: "music_feelings_archive", statement, values: [], readonly: false,
          });
          const entries = await query("SELECT COUNT(*) AS total FROM ReviewEntry");
          const years = await query("SELECT key FROM AppData WHERE key LIKE 'top-albums:%'");
          return { entryCount: entries.values?.[0]?.total, topAlbumKeys: years.values?.map(row => row.key) };
        });
      }
      report[mode].push(item);
      await detach();
      console.log(`${phase} ${mode} ${i + 1}/10 ${item.uiReadyMs}ms`);
    }
    report[`${mode}Stats`] = stats(report[mode]);
  }
  assert.deepEqual(report.cold[0].fixture, { entryCount: 15, topAlbumKeys: ["top-albums:2026"] }, "Fixed 15-album fixture required");
  command("shell", "am", "force-stop", app);
  command("shell", "am", "start", "-n", `${app}/.MainActivity`);
  const page = await attach();
  await page.evaluate(() => { location.hash = "/summary?year=2026&view=rank"; });
  await page.locator(".journal-rank-list li").first().waitFor();
  assert.equal(await page.locator(".journal-rank-list li").count(), 15);
  report.rankFontReadyBeforeClick = await page.evaluate(() => Array.from(document.fonts)
    .some(font => font.family === "Codex Rank Sans" && font.status === "loaded"));
  for (let i = 0; i < 3; i++) {
    const samples = [memory().pssKiB];
    let sampling = true;
    const sampler = (async () => {
      while (sampling) { await sleep(300); if (sampling) samples.push(memory().pssKiB); }
    })();
    const start = performance.now();
    try {
      await page.getByRole("button", { name: "保存榜单图片", exact: true }).click();
      for (let n = 1; n <= 3; n++) {
        if (n > 1) await page.getByRole("button", { name: "下一页", exact: true }).click();
        const preview = page.locator(`img.journal-export-preview[alt="2026 年度总结第 ${n} 页预览"]`);
        await preview.waitFor({ timeout: 60000 });
        await preview.evaluate(image => image.decode());
        if (n === 1) report.rankExports.push({ firstPreviewMs: Math.round(performance.now() - start) });
      }
      report.rankExports[i].allFifteenPreviewMs = Math.round(performance.now() - start);
    } finally {
      sampling = false;
      await sampler;
      samples.push(memory().pssKiB);
      if (report.rankExports[i]) report.rankExports[i].peakPssKiB = Math.max(...samples);
    }
    await page.getByRole("button", { name: "关闭图片预览", exact: true }).click();
    await page.locator("dialog.journal-export").waitFor({ state: "hidden" });
    console.log(`${phase} rank ${i + 1}/3 ${report.rankExports[i].firstPreviewMs}/${report.rankExports[i].allFifteenPreviewMs}ms`);
  }
  report.rankRequests = await page.evaluate(() => performance.getEntriesByType("resource")
    .map(entry => new URL(entry.name).pathname).filter(path => /\.(?:js|css|woff2?)$/.test(path)));
  await detach();
  report.finishedAt = new Date().toISOString();
  await writeFile(output, JSON.stringify(report, null, 2), { flag: "wx" });
  console.log(JSON.stringify({ phase, initialJsBytes: report.initialJs.bytes, cold: report.coldStats, warm: report.warmStats, output }));
} finally {
  await detach();
}
