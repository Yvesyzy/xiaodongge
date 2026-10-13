import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { closeAndroidWebView, connectAndroidWebView, createAdbCommand, projectAvdName, PROJECT_AVD_NAME } from "./codex_android_cdp.mjs";

const { command } = createAdbCommand();
assert.equal(projectAvdName(command), PROJECT_AVD_NAME);
const output = resolve(process.argv[2] ?? "release/codex_t10_baseline_20260923/codex_ocr_android_profile.json");
const files = process.argv.slice(3);
assert.ok(files.length, "Pass one or more synthetic image files");
const report = { emulator: "codex_np1_api36", files: [], startedAt: new Date().toISOString() };
let connection;

function meminfo() {
  const raw = command("shell", "dumpsys", "meminfo", "com.yves.musicarchive");
  const match = raw.match(/TOTAL PSS:\s*(\d+)\s+TOTAL RSS:\s*(\d+)\s+TOTAL SWAP PSS:\s*(\d+)/);
  assert.ok(match, "Android meminfo output did not contain TOTAL PSS/RSS/SWAP PSS");
  return { pssKiB: Number(match[1]), rssKiB: Number(match[2]), swapPssKiB: Number(match[3]) };
}

try {
  command("shell", "am", "start", "-n", "com.yves.musicarchive/.MainActivity");
  connection = await connectAndroidWebView({ command, appId: "com.yves.musicarchive", pageAttempts: 1, pageDelayMs: 0 });
  const { page } = connection;
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
  await closeAndroidWebView(connection);
  report.finishedAt = new Date().toISOString();
  await writeFile(output, JSON.stringify(report, null, 2));
}
console.log(JSON.stringify(report));
