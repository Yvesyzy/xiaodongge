import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { chromium } from "playwright";

const adb = "C:/Users/lenovo/AppData/Local/Android/Sdk/platform-tools/adb.exe";
const serial = "emulator-5562";
const command = (...args) => execFileSync(adb, ["-s", serial, ...args], { encoding: "utf8", windowsHide: true }).trim();
assert.equal(command("emu", "avd", "name").replace(/\r/g, "").split("\n")[0], "codex_np1_api36");
const output = resolve(process.argv[2] ?? "release/codex_t10_baseline_20260923/codex_ocr_android_profile.json");
const files = process.argv.slice(3);
assert.ok(files.length, "Pass one or more synthetic image files");
const report = { emulator: "codex_np1_api36", files: [], startedAt: new Date().toISOString() };
let browser, port;

function meminfo() {
  const raw = command("shell", "dumpsys", "meminfo", "com.yves.musicarchive");
  const match = raw.match(/TOTAL PSS:\s*(\d+)\s+TOTAL RSS:\s*(\d+)\s+TOTAL SWAP PSS:\s*(\d+)/);
  assert.ok(match, "Android meminfo output did not contain TOTAL PSS/RSS/SWAP PSS");
  return { pssKiB: Number(match[1]), rssKiB: Number(match[2]), swapPssKiB: Number(match[3]) };
}

try {
  command("shell", "am", "start", "-n", "com.yves.musicarchive/.MainActivity");
  let socket;
  for (let tries = 0; tries < 60; tries++) {
    const pid = command("shell", "pidof", "com.yves.musicarchive");
    socket = command("shell", "cat", "/proc/net/unix").split(/\r?\n/).map(line => line.split(/\s+/).at(-1))
      .find(name => name === `@webview_devtools_remote_${pid}`);
    if (socket) break;
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  assert.ok(socket, "Debug WebView socket unavailable");
  port = command("forward", "tcp:0", `localabstract:${socket.slice(1)}`);
  browser = await chromium.connectOverCDP(`http://127.0.0.1:${port}`, { noDefaults: true });
  const page = browser.contexts()[0].pages()[0];
  assert.equal(await page.evaluate(() => typeof window.Capacitor?.Plugins?.ScreenshotOcr?.recognize), "function");

  for (const file of files) {
    const bytes = await readFile(resolve(file));
    const mime = file.toLowerCase().endsWith(".png") ? "image/png" : "image/jpeg";
    const dataUrl = `data:${mime};base64,${bytes.toString("base64")}`;
    const item = { file: resolve(file), bytes: bytes.length, before: meminfo(), samples: [] };
    report.files.push(item);
    let sampling = true;
    let samplingError;
    const sampler = (async () => {
      while (sampling) {
        item.samples.push(meminfo());
        await new Promise(resolve => setTimeout(resolve, 150));
      }
    })().catch(error => { samplingError = error; });
    const started = Date.now();
    try {
      const result = await page.evaluate(data => window.Capacitor.Plugins.ScreenshotOcr.recognize({ dataUrl: data }), dataUrl);
      item.result = { width: result.width, height: result.height, textLength: result.text.length,
        foundAlbum: result.text.includes("罗生门"), foundArtist: result.text.includes("麦浚龙"), lines: result.lines.length };
    } catch (error) {
      item.error = error instanceof Error ? error.message : String(error);
    } finally {
      item.elapsedMs = Date.now() - started;
      sampling = false;
      await sampler;
      if (samplingError) throw samplingError;
      assert.ok(item.samples.length, "No Android memory samples were collected");
      item.after = meminfo();
      item.peak = { pssKiB: Math.max(...item.samples.map(sample => sample.pssKiB), item.before?.pssKiB ?? 0, item.after?.pssKiB ?? 0),
        rssKiB: Math.max(...item.samples.map(sample => sample.rssKiB), item.before?.rssKiB ?? 0, item.after?.rssKiB ?? 0) };
      delete item.samples;
      await writeFile(output, JSON.stringify(report, null, 2));
    }
    if (item.error) break;
  }
} finally {
  await browser?.close();
  if (port) command("forward", "--remove", `tcp:${port}`);
  report.finishedAt = new Date().toISOString();
  await writeFile(output, JSON.stringify(report, null, 2));
}
console.log(JSON.stringify(report));
