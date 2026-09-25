import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { createServer } from "vite";
import { freeLoopbackPort, qaOptions } from "./codex_qa_options.mjs";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const validPng = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jCeoAAAAASUVORK5CYII=", "base64");
const invalidPng = Buffer.from("not-an-image");

const qa = qaOptions({ output: "release/codex_capture_regressions" });
const requestedOrigin = process.argv.includes("--origin") ? qa.origin : null;
const outputDir = path.resolve(projectRoot, qa.output);
const outputPath = path.join(outputDir, "codex_capture_regressions.json");
let origin = requestedOrigin;
let server = null;
if (!origin) {
  server = await createServer({
    configFile: path.resolve(projectRoot, "mobile/vite.config.ts"),
    cacheDir: path.resolve(projectRoot, "release/codex_capture_vite_cache"),
    server: { host: "127.0.0.1", port: await freeLoopbackPort(), strictPort: true, forwardConsole: false },
  });
  await server.listen();
  const address = server.httpServer?.address();
  if (!address || typeof address === "string") throw new Error("无法读取捕获回归测试端口");
  origin = `http://127.0.0.1:${address.port}`;
}

const browser = await chromium.launch({ headless: true, channel: "chrome" });
const result = { origin, m1: {}, m2: {}, limitations: ["OCR uses a synthetic Capacitor bridge; native OCR recognition quality and Android file-picker behavior remain device checks."] };

function draftValue(draftId = "capture-regression") {
  return {
    version: 2,
    mode: "create",
    captureMode: "quick",
    entryId: null,
    draftId,
    baseUpdatedAt: null,
    savedAt: new Date().toISOString(),
    fields: {
      type: "album",
      title: "旧专辑",
      year: "2026",
      month: "9",
      albumName: "旧专辑",
      songName: "旧歌曲",
      artistName: "旧艺人",
      listenedAt: "2026-09-10",
      tags: "",
      rating: "8",
      ratingModifier: "",
      ratingProduction: "",
      ratingSongwriting: "",
      ratingOriginality: "",
      ratingResonance: "",
      content: "只属于旧专辑的草稿正文",
    },
    genreSelection: { level1: "", level2: "", level3: "" },
    selectedGenreTags: [],
    selectedMoodGroupId: "",
    selectedMoods: [],
    coverDataUrl: null,
    coverChanged: false,
    ocrText: "",
    recognizedFields: null,
    musicMetadata: null,
    compositeRatingLocked: false,
    inspiration: false,
  };
}

function nativeInitScript({ tracks = [], catalog = [], ocr = [] } = {}) {
  return ({ tracks: initialTracks, catalog: initialCatalog, ocr: initialOcr }) => {
    window.CapacitorCustomPlatform = { name: "android" };
    const trackQueue = [...(initialTracks ?? [])];
    const catalogQueue = [...(initialCatalog ?? [])];
    const ocrQueue = [...(initialOcr ?? [])];
    const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
    window.codexTrackStarted = 0;
    window.codexTrackFinished = 0;
    window.codexCatalogStarted = 0;
    window.codexCatalogFinished = 0;
    window.codexOcrCalls = 0;
    window.Capacitor = {
      PluginHeaders: [
        { name: "NowPlaying", methods: [{ name: "getCurrentTrack", rtype: "promise" }, { name: "searchCatalog", rtype: "promise" }, { name: "openNotificationSettings", rtype: "promise" }] },
        { name: "ScreenshotOcr", methods: [{ name: "recognize", rtype: "promise" }] },
        { name: "CapacitorSQLite", methods: ["createConnection", "isDBOpen", "open", "execute", "query", "run"].map(name => ({ name, rtype: "promise" })) },
      ],
      nativePromise: async (plugin, method, options) => {
        if (plugin === "CapacitorSQLite") return window.codexCaptureSQLite(method, options);
        if (plugin === "NowPlaying" && method === "getCurrentTrack") {
          window.codexTrackStarted++;
          const next = trackQueue.shift() ?? { delay: 0, value: { accessEnabled: false } };
          await wait(next.delay ?? 0);
          window.codexTrackFinished++;
          if (next.error) throw new Error(next.error);
          return next.value;
        }
        if (plugin === "NowPlaying" && method === "searchCatalog") {
          const next = catalogQueue.shift() ?? { delay: 0, value: { country: options.country, results: [] } };
          window.codexCatalogStarted++;
          if (next.hold) await new Promise(resolve => { window.codexReleaseCatalog = resolve; });
          await wait(next.delay ?? 0);
          window.codexCatalogFinished++;
          return { country: options.country, ...(next.value ?? { results: [] }) };
        }
        if (plugin === "NowPlaying" && method === "openNotificationSettings") return undefined;
        if (plugin === "ScreenshotOcr" && method === "recognize") {
          window.codexOcrCalls++;
          const next = ocrQueue.shift() ?? { delay: 0, value: { text: "专辑：合成识别", width: 1, height: 1, lines: [] } };
          await wait(next.delay ?? 0);
          if (next.error) throw new Error(next.error);
          return next.value;
        }
        throw new Error(`Unexpected synthetic bridge call: ${plugin}.${method}`);
      },
    };
  };
}

async function newPage({ native = null } = {}) {
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  if (native) {
    const database = new DatabaseSync(":memory:");
    page.once("close", () => database.close());
    await page.exposeFunction("codexCaptureSQLite", (method, options = {}) => {
      if (method === "createConnection" || method === "open") return {};
      if (method === "isDBOpen") return { result: true };
      if (method === "execute") { database.exec(options.statements); return { changes: { changes: 0 } }; }
      if (method === "query") return { values: database.prepare(options.statement).all(...(options.values ?? [])) };
      if (method === "run") { database.prepare(options.statement).run(...(options.values ?? [])); return { changes: { changes: 1 } }; }
      throw new Error(`Unsupported capture SQLite method ${method}`);
    });
    await page.addInitScript(nativeInitScript(native), native);
  }
  page.__captureErrors = errors;
  return page;
}

async function seedDraft(page, draftId) {
  await page.goto(`${origin}/#/privacy`);
  await page.evaluate((draft) => {
    localStorage.clear();
    localStorage.setItem(`music-feelings-entry-draft:v1:new:${draft.draftId}`, JSON.stringify(draft));
  }, draftValue(draftId));
}

async function readDraft(page, draftId) {
  return page.evaluate((id) => JSON.parse(localStorage.getItem(`music-feelings-entry-draft:v1:new:${id}`)), draftId);
}

async function chooseFile(input, file) {
  await input.setInputFiles(file);
  await input.page().waitForTimeout(500);
}

async function checkQuickCapture() {
  const draftId = "capture-regression";
  const page = await newPage({ native: {
    tracks: [{ delay: 80, value: { accessEnabled: true, title: "新播放歌曲", artistName: "新艺人", albumName: "新播放专辑" } }],
    catalog: [],
  } });
  await seedDraft(page, draftId);
  await page.goto(`${origin}/#/capture?draft=${draftId}`);
  try {
    await page.getByText("当前播放已经变化", { exact: true }).waitFor({ timeout: 5000 });
  } catch (error) {
    throw new Error(`M1 pending-track evidence missing: ${error instanceof Error ? error.message : String(error)}\n${await page.locator("body").innerText()}`);
  }
  const beforeAutosave = {
    body: await page.locator("textarea").first().inputValue(),
    identity: await page.locator("details.quick-identity-fields input").evaluateAll((inputs) => inputs.map((input) => input.value)),
  };
  await page.waitForTimeout(700);
  const persisted = await readDraft(page, draftId);
  assert.equal(beforeAutosave.body, "只属于旧专辑的草稿正文");
  assert.deepEqual(beforeAutosave.identity, ["旧专辑", "旧歌曲", "旧艺人", "旧专辑"]);
  assert.equal(persisted.fields.albumName, "旧专辑");
  assert.equal(persisted.fields.songName, "旧歌曲");
  assert.equal(persisted.fields.artistName, "旧艺人");
  assert.equal(persisted.fields.rating, "8");
  assert.equal(persisted.fields.content, "只属于旧专辑的草稿正文");
  result.m1.draftRecovery = { beforeAutosave, persisted: persisted.fields, pageErrors: page.__captureErrors };

  await page.goto(`${origin}/#/privacy`);
  await page.goto(`${origin}/#/capture?draft=${draftId}`);
  await page.waitForTimeout(700);
  const reopened = await readDraft(page, draftId);
  assert.equal(reopened.fields.albumName, "旧专辑");
  assert.equal(reopened.fields.content, "只属于旧专辑的草稿正文");
  result.m1.reopenAfterAutosave = { albumName: reopened.fields.albumName, rating: reopened.fields.rating, content: reopened.fields.content };
  await page.close();

  const sameIdentityPage = await newPage({ native: {
    tracks: [{ delay: 80, value: { accessEnabled: true, title: "旧歌曲", artistName: "旧艺人", albumName: "旧专辑" } }],
  } });
  await seedDraft(sameIdentityPage, "same-identity");
  await sameIdentityPage.evaluate(() => {
    const key = "music-feelings-entry-draft:v1:new:same-identity";
    const draft = JSON.parse(localStorage.getItem(key));
    draft.fields.title = "用户自定义标题";
    localStorage.setItem(key, JSON.stringify(draft));
  });
  await sameIdentityPage.goto(`${origin}/#/capture?draft=same-identity`);
  await sameIdentityPage.getByText("表单已有当前歌曲信息，未覆盖用户输入。", { exact: true }).waitFor({ timeout: 5000 });
  assert.equal(await sameIdentityPage.locator("details.quick-identity-fields input").first().inputValue(), "用户自定义标题");
  assert.equal(await sameIdentityPage.locator("textarea").first().inputValue(), "只属于旧专辑的草稿正文");
  result.m1.sameIdentityUserEdit = { title: await sameIdentityPage.locator("details.quick-identity-fields input").first().inputValue(), content: await sameIdentityPage.locator("textarea").first().inputValue(), pageErrors: sameIdentityPage.__captureErrors };
  await sameIdentityPage.close();

  const switchPage = await newPage({ native: {
    tracks: [{ delay: 40, value: { accessEnabled: true, title: "切换歌曲", artistName: "切换艺人", albumName: "切换专辑" } }],
    catalog: [],
  } });
  await seedDraft(switchPage, "switch-success");
  await switchPage.goto(`${origin}/#/capture?draft=switch-success`);
  await switchPage.getByText("当前播放已经变化", { exact: true }).waitFor({ timeout: 5000 });
  await switchPage.getByRole("button", { name: "保存并切换", exact: true }).click();
  await switchPage.getByText("原草稿已保存，已切换到新的当前播放", { exact: true }).waitFor({ timeout: 5000 });
  assert.equal(await switchPage.locator(".quick-track-card strong").innerText(), "切换专辑");
  const savedDrafts = await switchPage.evaluate(() => Object.entries(localStorage)
    .filter(([key]) => key.startsWith("music-feelings-entry-draft:v1:new:"))
    .map(([, value]) => JSON.parse(value).fields.content));
  assert.ok(savedDrafts.includes("只属于旧专辑的草稿正文"));
  result.m1.explicitSwitch = { track: await switchPage.locator(".quick-track-card strong").innerText(), preservedDraft: true, pageErrors: switchPage.__captureErrors };
  await switchPage.close();

  const guardedSwitchPage = await newPage({ native: {
    tracks: [{ delay: 40, value: { accessEnabled: true, title: "延迟切换歌曲", artistName: "延迟艺人", albumName: "延迟专辑" } }],
    catalog: [{ delay: 300, value: { results: [{ trackName: "延迟切换歌曲", artistName: "延迟艺人", collectionName: "延迟专辑", trackId: "delayed-switch-1", collectionId: "delayed-switch-album-1" }] } }],
  } });
  await seedDraft(guardedSwitchPage, "switch-guard");
  await guardedSwitchPage.goto(`${origin}/#/capture?draft=switch-guard`);
  await guardedSwitchPage.getByText("当前播放已经变化", { exact: true }).waitFor({ timeout: 5000 });
  await guardedSwitchPage.getByRole("button", { name: "保存并切换", exact: true }).click();
  await guardedSwitchPage.locator("textarea").first().fill("切换期间用户正文");
  await guardedSwitchPage.locator("details.quick-extras > summary").click();
  await guardedSwitchPage.locator("details.quick-identity-fields > summary").click();
  await guardedSwitchPage.locator("details.quick-identity-fields input").first().fill("切换期间用户标题");
  await guardedSwitchPage.waitForTimeout(500);
  assert.equal(await guardedSwitchPage.locator("textarea").first().inputValue(), "切换期间用户正文");
  assert.equal(await guardedSwitchPage.locator("details.quick-identity-fields input").first().inputValue(), "切换期间用户标题");
  result.m1.explicitSwitchEditGuard = { title: await guardedSwitchPage.locator("details.quick-identity-fields input").first().inputValue(), content: await guardedSwitchPage.locator("textarea").first().inputValue(), pageErrors: guardedSwitchPage.__captureErrors };
  await guardedSwitchPage.close();

  const racePage = await newPage({ native: {
    tracks: [
      { delay: 800, value: { accessEnabled: true, title: "慢 A 歌曲", artistName: "A 艺人", albumName: "慢 A 专辑" } },
      { delay: 20, value: { accessEnabled: true, title: "快 B 歌曲", artistName: "B 艺人", albumName: "快 B 专辑" } },
    ],
  } });
  await racePage.goto(`${origin}/#/capture`);
  await racePage.waitForFunction(() => window.codexTrackStarted === 1);
  await racePage.evaluate(() => document.dispatchEvent(new Event("visibilitychange")));
  await racePage.waitForFunction(() => window.codexTrackStarted === 2);
  await racePage.waitForFunction(() => window.codexTrackFinished === 2);
  await racePage.waitForFunction(() => document.querySelector('.quick-track-card strong')?.textContent === '快 B 专辑');
  assert.equal(await racePage.locator(".quick-track-card strong").innerText(), "快 B 专辑");
  result.m1.slowA_fastB = { track: await racePage.locator(".quick-track-card strong").innerText(), pageErrors: racePage.__captureErrors };
  await racePage.close();

  const editPage = await newPage({ native: {
    tracks: [{ delay: 0, value: { accessEnabled: true, title: "目录歌曲", artistName: "目录艺人", albumName: "目录专辑" } }],
    catalog: [{ delay: 300, value: { results: [{ trackName: "目录歌曲", artistName: "目录艺人", collectionName: "目录专辑", trackId: "catalog-1", collectionId: "catalog-album-1" }] } }],
  } });
  await editPage.goto(`${origin}/#/capture`);
  await editPage.locator("details.quick-extras > summary").click();
  await editPage.locator("details.quick-identity-fields > summary").click();
  await editPage.locator("details.quick-identity-fields input").first().fill("用户编辑标题");
  await editPage.locator("textarea").first().fill("用户编辑正文");
  await editPage.waitForTimeout(500);
  assert.equal(await editPage.locator("details.quick-identity-fields input").first().inputValue(), "用户编辑标题");
  assert.equal(await editPage.locator("textarea").first().inputValue(), "用户编辑正文");
  result.m1.userEditDuringCatalog = { title: await editPage.locator("details.quick-identity-fields input").first().inputValue(), content: await editPage.locator("textarea").first().inputValue(), pageErrors: editPage.__captureErrors };
  await editPage.close();
}

async function checkFullReviewPlayback() {
  const page = await newPage({ native: { tracks: [
    { value: { accessEnabled: false } },
    { value: { accessEnabled: true } },
    { value: { accessEnabled: true, title: "播放歌曲", artistName: "播放艺人", albumName: "播放专辑" } },
  ] } });
  await page.goto(`${origin}/#/new`);
  await page.locator('.writing-extras > summary').click();
  await page.getByText('请先授予通知使用权；本应用只读取系统媒体会话中的歌曲信息。', { exact: true }).waitFor();
  await page.getByRole('button', { name: '打开系统设置', exact: true }).click();
  await page.getByRole('button', { name: '读取当前播放', exact: true }).click();
  await page.getByText('没有读到正在播放的歌曲，请确认网易云音乐正在播放后重试。', { exact: true }).waitFor();
  await page.getByRole('button', { name: '读取当前播放', exact: true }).click();
  await page.waitForFunction(() => document.querySelector('input[name="albumName"]')?.value === '播放专辑');
  assert.equal(await page.locator('input[name="artistName"]').inputValue(), '播放艺人');
  assert.equal(await page.locator('input[name="title"]').inputValue(), '播放专辑');
  assert.deepEqual(page.__captureErrors, []);
  result.fullReviewPlayback = { permissionPrompt: true, missingSessionPrompt: true, retryFillsIdentity: true, evidenceLevel: 'synthetic native bridge; phone fault remains unconfirmed' };
  await page.close();

  const failure = await newPage({ native: { tracks: [
    { value: { accessEnabled: true } },
    { error: '无法读取媒体会话，请重新授予通知使用权' },
    { value: { accessEnabled: true, title: '重试歌曲', artistName: '重试艺人', albumName: '重试专辑' } },
  ] } });
  await failure.setViewportSize({ width: 390, height: 844 });
  await failure.goto(`${origin}/#/new`);
  await failure.locator('.writing-extras > summary').click();
  await failure.getByText('没有读到正在播放的歌曲，请确认网易云音乐正在播放后重试。', { exact: true }).waitFor();
  const playbackPanel = failure.locator('.assist-panel').filter({ has: failure.getByText('当前播放', { exact: true }) });
  await playbackPanel.getByRole('button', { name: '读取当前播放', exact: true }).click();
  await failure.waitForFunction(() => window.codexTrackFinished === 2);
  await failure.waitForFunction(() => !document.querySelector('.assist-panel button')?.disabled);
  await mkdir(outputDir, { recursive: true });
  await failure.screenshot({ path: path.join(outputDir, 'codex_playback_error.png') });
  assert.match(await playbackPanel.innerText(), /无法读取媒体会话，请重新授予通知使用权/, '播放读取异常必须在读取按钮旁显示，不能只写到长表单底部');
  assert.equal(await playbackPanel.locator('[role="status"]').evaluate(element => {
    const message = element.getBoundingClientRect();
    const actions = document.querySelector('.entry-save-actions').getBoundingClientRect();
    return message.top >= 0 && message.bottom <= Math.min(innerHeight, actions.top);
  }), true, '手机视口中的播放提示不能被固定保存栏遮挡');
  await playbackPanel.getByRole('button', { name: '读取当前播放', exact: true }).click();
  await failure.waitForFunction(() => document.querySelector('input[name="albumName"]')?.value === '重试专辑');
  assert.equal(await failure.locator('input[name="artistName"]').inputValue(), '重试艺人');
  assert.deepEqual(failure.__captureErrors, []);
  result.fullReviewPlayback.errorVisibleBesideButtonAndRetry = true;
  await failure.close();

  const stale = await newPage({ native: {
    tracks: [{ value: { accessEnabled: true, title: '旧播放歌曲', artistName: '旧播放艺人', albumName: '旧播放专辑' } }],
    catalog: [{ hold: true, value: { results: [{ trackName: '旧播放歌曲', artistName: '旧播放艺人', collectionName: '旧播放专辑', trackId: 'old-track', collectionId: 'old-album' }] } }],
  } });
  await stale.goto(`${origin}/#/new`);
  await stale.locator('.writing-extras > summary').click();
  await stale.waitForFunction(() => window.codexCatalogStarted === 1);
  await stale.locator('input[name="artistName"]').fill('手动新艺人');
  await stale.locator('input[name="albumName"]').fill('手动新专辑');
  await stale.locator('textarea[name="content"]').fill('只属于新作品的正文');
  await stale.evaluate(() => window.codexReleaseCatalog());
  await stale.waitForFunction(() => window.codexCatalogFinished === 1 && !document.querySelector('.assist-panel button')?.disabled);
  await stale.waitForFunction(() => [...document.querySelectorAll('[role="status"]')].some(element => element.textContent.includes('草稿已自动保存')));
  const draft = await stale.evaluate(() => Object.entries(localStorage)
    .filter(([key]) => key.startsWith('music-feelings-entry-draft:v1:new:'))
    .map(([, value]) => JSON.parse(value)).find(item => item.fields.artistName === '手动新艺人'));
  assert.equal(draft.fields.albumName, '手动新专辑');
  assert.equal(draft.fields.content, '只属于新作品的正文');
  assert.equal(draft.musicMetadata, null, '身份修改后不能写回旧歌曲的目录元数据');
  result.fullReviewPlayback.staleCatalogCannotChangeEditedIdentity = true;
  await stale.close();
}

async function checkInputClearing() {
  for (const route of ['/new', '/albums/detail?albumName=codex封面&artistName=codex艺人']) {
    const locked = await newPage();
    await locked.goto(`${origin}/#${route}`);
    await locked.evaluate(() => {
      const source = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, 'src');
      window.codexCoverReadStarted = 0;
      Object.defineProperty(HTMLImageElement.prototype, 'src', { ...source, set(value) {
        if (!value.startsWith('blob:')) return source.set.call(this, value);
        window.codexCoverReadStarted++;
        window.codexReleaseCover = () => {
          Object.defineProperty(HTMLImageElement.prototype, 'src', source);
          source.set.call(this, value);
        };
      } });
    });
    const input = locked.locator('input[type="file"]').first();
    await input.setInputFiles({ name: 'held-cover.png', mimeType: 'image/png', buffer: validPng });
    await locked.waitForFunction(() => window.codexCoverReadStarted === 1);
    assert.equal(await input.isDisabled(), true, '封面转换和保存完成前禁止再次选图');
    await input.dispatchEvent('change');
    assert.equal(await locked.evaluate(() => window.codexCoverReadStarted), 1, '重复事件不得并发转换封面');
    await locked.evaluate(() => window.codexReleaseCover());
    await locked.waitForFunction(() => {
      const input = document.querySelector('input[type=file]');
      return !input.disabled && input.value === '';
    });
    assert.deepEqual(locked.__captureErrors, []);
    await locked.close();
  }
  result.m2.concurrentCoverSelectionBlocked = true;
  const page = await newPage();
  await page.goto(`${origin}/#/new`);
  await page.locator(".writing-form").waitFor();
  const inputs = page.locator('input[type="file"]');
  assert.equal(await inputs.count(), 2);
  const cover = inputs.nth(0);
  await chooseFile(cover, { name: "same-cover.png", mimeType: "image/png", buffer: validPng });
  assert.equal(await cover.inputValue(), "");
  await page.locator('.cover-picker img').evaluate(image => image.decode());
  await chooseFile(cover, { name: "same-cover.png", mimeType: "image/png", buffer: validPng });
  assert.equal(await cover.inputValue(), "");
  await chooseFile(cover, { name: "failed-cover.png", mimeType: "image/png", buffer: invalidPng });
  assert.equal(await cover.inputValue(), "");
  await chooseFile(cover, { name: "failed-cover.png", mimeType: "image/png", buffer: validPng });
  assert.equal(await cover.inputValue(), "");
  assert.deepEqual(page.__captureErrors, []);
  result.m2.entryCover = { inputClearedAfterSuccessFailureAndRepeat: true, pageErrors: page.__captureErrors };
  await page.close();

  const aggregate = await newPage();
  await aggregate.goto(`${origin}/#/albums/detail?albumName=${encodeURIComponent("合成专辑")}&artistName=${encodeURIComponent("合成艺人")}`);
  const aggregateInput = aggregate.locator('input[type="file"]');
  await chooseFile(aggregateInput, { name: "aggregate.png", mimeType: "image/png", buffer: validPng });
  assert.equal(await aggregateInput.inputValue(), "");
  await aggregate.locator('img.cover-art').evaluate(image => image.decode());
  await chooseFile(aggregateInput, { name: "aggregate.png", mimeType: "image/png", buffer: invalidPng });
  assert.equal(await aggregateInput.inputValue(), "");
  await chooseFile(aggregateInput, { name: "aggregate.png", mimeType: "image/png", buffer: validPng });
  assert.equal(await aggregateInput.inputValue(), "");
  assert.deepEqual(aggregate.__captureErrors, []);
  result.m2.aggregateCover = { repeatedSelection: true, pageErrors: aggregate.__captureErrors };
  await aggregate.close();

  const ocr = await newPage({ native: {
    tracks: [{ delay: 0, value: { accessEnabled: false } }],
    ocr: [
      { delay: 20, error: "合成 OCR 失败" },
      { delay: 20, value: { text: "专辑：合成识别", width: 1, height: 1, lines: [] } },
      { delay: 20, error: "第二张截图识别失败" },
    ],
  } });
  await ocr.goto(`${origin}/#/new`);
  const ocrInput = ocr.locator('input[type="file"]').nth(1);
  await chooseFile(ocrInput, { name: "ocr-same.png", mimeType: "image/png", buffer: validPng });
  assert.equal(await ocrInput.inputValue(), "");
  await ocr.getByText('合成 OCR 失败', { exact: true }).waitFor({ state: 'attached' });
  await chooseFile(ocrInput, { name: "ocr-same.png", mimeType: "image/png", buffer: validPng });
  assert.equal(await ocrInput.inputValue(), "");
  assert.equal(await ocr.locator('.ocr-text pre').textContent(), '专辑：合成识别');
  await ocr.locator('input[name="title"]').fill('OCR 原表单仍在');
  await chooseFile(ocrInput, { name: "ocr-fails-after-success.png", mimeType: "image/png", buffer: validPng });
  await ocr.getByText('第二张截图识别失败', { exact: true }).waitFor({ state: 'attached' });
  assert.equal(await ocr.locator('.ocr-text pre').textContent(), '专辑：合成识别');
  assert.equal(await ocr.locator('input[name="title"]').inputValue(), 'OCR 原表单仍在');
  const byteLimit = 12 * 1024 * 1024;
  async function chooseSizedOcrFile(size) {
    await ocrInput.evaluate((input, bytes) => {
      const transfer = new DataTransfer();
      transfer.items.add(new File([new Uint8Array(bytes)], 'codex-ocr-size.jpg', { type: 'image/jpeg' }));
      input.files = transfer.files;
      input.dispatchEvent(new Event('change', { bubbles: true }));
    }, size);
  }
  await chooseSizedOcrFile(byteLimit - 1);
  await ocr.waitForFunction(() => window.codexOcrCalls === 4);
  await ocrInput.waitFor({ state: 'attached' });
  await chooseSizedOcrFile(byteLimit);
  await ocr.waitForFunction(() => window.codexOcrCalls === 5);
  await chooseSizedOcrFile(byteLimit + 1);
  await ocr.getByText(/图片过大/).waitFor();
  assert.equal(await ocr.evaluate(() => window.codexOcrCalls), 5, 'oversized file never crossed the bridge');
  assert.equal(await ocr.locator('input[name="title"]').inputValue(), 'OCR 原表单仍在');
  assert.deepEqual(ocr.__captureErrors, []);
  result.m2.ocr = { repeatedSelectionAfterFailure: true, priorResultAfterLaterFailure: true, byteBoundary: [byteLimit - 1, byteLimit, byteLimit + 1], pageErrors: ocr.__captureErrors };
  await ocr.close();
}

try {
  await checkQuickCapture();
  await checkFullReviewPlayback();
  await checkInputClearing();
  for (const check of Object.values(result.m1)) if (check.pageErrors) assert.deepEqual(check.pageErrors, []);
  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(result, null, 2)}\n`, "utf8");
  console.log(`PASS ${outputPath}`);
  console.log(JSON.stringify(result));
} finally {
  await browser.close();
  if (server) await server.close();
}
