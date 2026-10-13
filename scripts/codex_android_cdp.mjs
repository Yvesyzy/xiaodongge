import { execFileSync } from "node:child_process";
import { performance } from "node:perf_hooks";
import { chromium } from "playwright";

export const DEFAULT_ADB_PATH = "C:/Users/lenovo/AppData/Local/Android/Sdk/platform-tools/adb.exe";
export const DEFAULT_ANDROID_SERIAL = "emulator-5562";
export const PROJECT_AVD_NAME = "codex_np1_api36";

export function createAdbCommand({ adbPath = DEFAULT_ADB_PATH, serial = DEFAULT_ANDROID_SERIAL } = {}) {
  const command = (...args) => execFileSync(adbPath, ["-s", serial, ...args], {
    encoding: "utf8",
    windowsHide: true,
  }).trim();
  return { adbPath, serial, command };
}

export function projectAvdName(command) {
  return command("emu", "avd", "name").replace(/\r/g, "").split("\n")[0];
}

export async function connectAndroidWebView({
  command,
  appId,
  startApp = false,
  attempts = 60,
  delayMs = 500,
  pageAttempts = 40,
  pageDelayMs = 100,
  pageSelector,
  pageTimeout = 30000,
  trace,
}) {
  if (startApp) command("shell", "am", "start", "-n", `${appId}/.MainActivity`);
  const started = performance.now();
  let socket;
  for (let tries = 0; tries < attempts; tries++) {
    let pid;
    try { pid = command("shell", "pidof", appId); }
    catch { await new Promise(resolve => setTimeout(resolve, delayMs)); continue; }
    socket = command("shell", "cat", "/proc/net/unix").split(/\r?\n/)
      .map(line => line.split(/\s+/).at(-1))
      .find(name => name === `@webview_devtools_remote_${pid}`);
    if (socket) break;
    await new Promise(resolve => setTimeout(resolve, delayMs));
  }
  if (!socket) throw new Error("Debug WebView socket unavailable");
  if (trace) trace.socketReadyMs = Math.round(performance.now() - started);
  const port = command("forward", "tcp:0", `localabstract:${socket.slice(1)}`);
  let browser;
  try {
    browser = await chromium.connectOverCDP(`http://127.0.0.1:${port}`, { noDefaults: true });
    if (trace) trace.cdpReadyMs = Math.round(performance.now() - started);
    let page;
    for (let tries = 0; tries < pageAttempts; tries++) {
      page = browser.contexts()[0]?.pages()[0];
      if (page) break;
      await new Promise(resolve => setTimeout(resolve, pageDelayMs));
    }
    if (!page) throw new Error("WebView page unavailable");
    if (pageSelector) {
      await page.locator(pageSelector).waitFor({ timeout: pageTimeout });
      if (trace) trace.headerReadyMs = Math.round(performance.now() - started);
    }
    return { browser, command, port, page };
  } catch (error) {
    const errors = [error];
    try { await browser?.close(); }
    catch (closeError) { errors.push(closeError); }
    try { command("forward", "--remove", `tcp:${port}`); }
    catch (forwardError) { errors.push(forwardError); }
    if (errors.length === 1) throw errors[0];
    throw new AggregateError(errors, "Android WebView connection cleanup failed");
  }
}

export async function closeAndroidWebView(connection) {
  if (!connection) return;
  const errors = [];
  try { await connection.browser?.close(); }
  catch (error) { errors.push(error); }
  if (connection.port) {
    try { connection.command("forward", "--remove", `tcp:${connection.port}`); }
    catch (error) { errors.push(error); }
  }
  if (errors.length === 1) throw errors[0];
  if (errors.length > 1) throw new AggregateError(errors, "Android WebView cleanup failed");
}
