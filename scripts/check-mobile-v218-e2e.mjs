import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { once } from "node:events";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const port = await findFreePort();
const baseUrl = `http://127.0.0.1:${port}`;
const projectRoot = fileURLToPath(new URL("..", import.meta.url));
const viteBin = fileURLToPath(new URL("../node_modules/vite/bin/vite.js", import.meta.url));
const server = spawn(process.execPath, [viteBin, "--host", "127.0.0.1", "--config", "mobile/vite.config.ts", "--port", String(port), "--strictPort"], {
  cwd: projectRoot,
  stdio: ["ignore", "pipe", "pipe"],
  windowsHide: true,
});
let serverOutput = "";
server.stdout.on("data", (chunk) => { serverOutput += chunk; });
server.stderr.on("data", (chunk) => { serverOutput += chunk; });

let browser;
try {
  await waitForServer();
  console.log("E2E: Vite ready");
  const executablePath = process.env.PLAYWRIGHT_CHROME_PATH || [
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  ].find(existsSync);
  browser = await chromium.launch({ headless: true, ...(executablePath ? { executablePath } : {}) });
  console.log("E2E: browser ready");
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const browserErrors = [];
  page.on("pageerror", (error) => browserErrors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") browserErrors.push(message.text());
  });

  await page.goto(baseUrl, { waitUntil: "networkidle" });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: "networkidle" });
  console.log("E2E: app ready");

  const createButton = page.getByRole("button", { name: "新建记录" });
  await createButton.click();
  const dialog = page.getByRole("dialog", { name: "新建" });
  await dialog.waitFor();
  assert.equal(await page.evaluate(() => document.querySelector('[role="dialog"]')?.contains(document.activeElement)), true, "BottomSheet should move focus inside");
  await page.keyboard.press("Escape");
  await dialog.waitFor({ state: "hidden" });
  assert.equal(await createButton.evaluate((element) => element === document.activeElement), true, "BottomSheet should restore trigger focus");
  console.log("E2E: BottomSheet accessibility passed");

  await createButton.click();
  await dialog.getByRole("link", { name: /^速记/ }).click();
  await page.waitForURL(/#\/capture/);
  assert.equal(await page.getByRole("heading", { name: "快速记下" }).isVisible(), true);
  await page.goto(`${baseUrl}/#/new`, { waitUntil: "networkidle" });
  assert.equal(await page.locator('select[name="type"]').inputValue(), "album", "new full records should default to album");
  console.log("E2E: album-first routes passed");

  await page.evaluate(() => localStorage.setItem("music-feelings-mobile-entries", "{broken"));
  await page.goto(baseUrl, { waitUntil: "networkidle" });
  await page.goto(`${baseUrl}/#/backup`, { waitUntil: "networkidle" });
  assert.equal(await page.getByText("发现并隔离了损坏的本地数据").isVisible(), true, "corrupt local data should be visible in backup health");
  assert.equal(await page.evaluate(() => localStorage.getItem("music-feelings-mobile-entries")), null);
  assert.match(await page.evaluate(() => localStorage.getItem("music-feelings-storage-corruption:v1") ?? ""), /\{broken/);
  console.log("E2E: corrupt storage quarantine passed");

  assert.deepEqual(browserErrors, []);
  console.log("mobile v2.1.8 end-to-end regression check passed");
} catch (error) {
  throw new Error(`${error instanceof Error ? error.message : String(error)}\nVite output:\n${serverOutput.slice(-4000)}`);
} finally {
  if (browser) await browser.close();
  server.kill();
  if (server.exitCode === null) await Promise.race([once(server, "exit"), new Promise((resolve) => setTimeout(resolve, 3000))]);
}

async function waitForServer() {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    if (server.exitCode !== null) throw new Error(`Vite exited before startup:\n${serverOutput.slice(-4000)}`);
    try {
      const response = await fetch(baseUrl);
      if (response.ok) return;
    } catch { /* retry while Vite starts */ }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`Timed out waiting for Vite:\n${serverOutput.slice(-4000)}`);
}

async function findFreePort() {
  const probe = createServer();
  probe.listen(0, "127.0.0.1");
  await once(probe, "listening");
  const address = probe.address();
  assert(address && typeof address === "object");
  const freePort = address.port;
  probe.close();
  await once(probe, "close");
  return freePort;
}
