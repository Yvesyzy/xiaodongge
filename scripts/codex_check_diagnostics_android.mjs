import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { closeAndroidWebView, connectAndroidWebView, createAdbCommand, projectAvdName, PROJECT_AVD_NAME } from "./codex_android_cdp.mjs";

const { command } = createAdbCommand();
const output = resolve(process.argv[2] ?? "release/codex_t17_android_diagnostics");
assert.equal(projectAvdName(command), PROJECT_AVD_NAME);
await mkdir(output, { recursive: true });
const report = { passed: false, device: "project-owned codex_np1_api36, Android 36", checks: [] };
let connection;
try {
  command("shell", "am", "start", "-n", "com.yves.musicarchive/.MainActivity");
  connection = await connectAndroidWebView({ command, appId: "com.yves.musicarchive", pageSelector: ".app-header" });
  const { page } = connection;
  const before = await page.evaluate(() => JSON.stringify(Object.fromEntries(Object.keys(localStorage).sort().map(key => [key, localStorage.getItem(key)]))));
  const result = await page.evaluate(async () => {
    const original = window.Capacitor.nativePromise.bind(window.Capacitor);
    const calls = [];
    window.Capacitor.nativePromise = async (plugin, method, options) => { calls.push(`${plugin}.${method}`); return original(plugin, method, options); };
    try { return { value: await window.Capacitor.nativePromise("NowPlaying", "getDiagnostics", {}), calls }; }
    finally { window.Capacitor.nativePromise = original; }
  });
  const after = await page.evaluate(() => JSON.stringify(Object.fromEntries(Object.keys(localStorage).sort().map(key => [key, localStorage.getItem(key)]))));
  const packageDump = command("shell", "dumpsys", "package", "com.yves.musicarchive");
  const versionCode = Number(packageDump.match(/versionCode=(\d+)/)?.[1]);
  const versionName = packageDump.match(/versionName=([^\s]+)/)?.[1];
  assert.ok(Number.isSafeInteger(versionCode) && versionName);
  const diagnosticKeys = ["androidApi", "clipboardAvailable", "manufacturer", "mediaAvailable", "model", "notificationAccessEnabled", "notificationAccessKnown", "versionCode", "versionName", "webViewPackage", "webViewVersion"];
  assert.deepEqual(Object.keys(result.value).sort(), diagnosticKeys);
  assert.equal(result.value.versionCode, versionCode);
  assert.equal(result.value.versionName, versionName);
  assert.equal(typeof result.value.notificationAccessEnabled, "boolean");
  assert.equal(typeof result.value.notificationAccessKnown, "boolean");
  assert.equal(typeof result.value.mediaAvailable, "boolean");
  assert.equal(typeof result.value.clipboardAvailable, "boolean");
  assert.equal(result.value.androidApi, Number(command("shell", "getprop", "ro.build.version.sdk")));
  assert.equal(result.value.manufacturer, command("shell", "getprop", "ro.product.manufacturer"));
  assert.equal(result.value.model, command("shell", "getprop", "ro.product.model"));
  assert.equal(typeof result.value.webViewPackage, "string");
  assert.equal(typeof result.value.webViewVersion, "string");
  assert.equal(result.value.notificationAccessEnabled, command("shell", "settings", "get", "secure", "enabled_notification_listeners").includes("com.yves.musicarchive"));
  assert.deepEqual(result.calls.filter(call => call.startsWith("NowPlaying.")), ["NowPlaying.getDiagnostics"]);
  assert.ok(result.calls.every(call => call === "NowPlaying.getDiagnostics" || call === "CapacitorSQLite.query"));
  assert.equal(after, before);
  report.result = result.value;
  report.checks.push("actual installed APK version matches PackageManager; notification listener state matches secure setting; no track metadata or storage writes");
  const originalListeners = command("shell", "settings", "get", "secure", "enabled_notification_listeners");
  const withoutApp = originalListeners === "null" ? [] : originalListeners.split(":").filter(item => !item.includes("com.yves.musicarchive"));
  try {
    if (withoutApp.length) command("shell", "settings", "put", "secure", "enabled_notification_listeners", withoutApp.join(":"));
    else command("shell", "settings", "delete", "secure", "enabled_notification_listeners");
    const denied = await page.evaluate(() => window.Capacitor.nativePromise("NowPlaying", "getDiagnostics", {}));
    assert.equal(denied.notificationAccessEnabled, false);
    assert.deepEqual(Object.keys(denied).sort(), diagnosticKeys);
    report.checks.push("revoked notification-listener access reports false without reading a track");
  } finally {
    if (originalListeners === "null") command("shell", "settings", "delete", "secure", "enabled_notification_listeners");
    else command("shell", "settings", "put", "secure", "enabled_notification_listeners", originalListeners);
  }
  assert.equal(command("shell", "settings", "get", "secure", "enabled_notification_listeners"), originalListeners);
  report.passed = true;
} catch (error) { report.error = error instanceof Error ? error.stack : String(error); process.exitCode = 1; }
finally {
  try { await writeFile(join(output, "codex_results.json"), JSON.stringify(report, null, 2)); }
  finally { await closeAndroidWebView(connection); }
}
console.log(JSON.stringify({ passed: report.passed, checks: report.checks, error: report.error }));
