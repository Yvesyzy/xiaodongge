import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { createServer } from "vite";
import { freeLoopbackPort, qaOptions } from "./codex_qa_options.mjs";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const policyVersion = JSON.parse(await readFile(path.join(projectRoot, "mobile/src/codex_privacy_policy.json"), "utf8")).version;
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
    cacheDir: path.join(outputDir, "vite-cache"),
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
  return ({ tracks: initialTracks, catalog: initialCatalog, ocr: initialOcr, policyVersion }) => {
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
    window.codexArtworkOptions = [];
    window.Capacitor = {
      PluginHeaders: [
        { name: "CodexPrivacy", methods: ["getState", "setConsent"].map(name => ({ name, rtype: "promise" })) },
        { name: "CodexNavigation", methods: [{ name: "exitApp", rtype: "promise" }, { name: "addListener", rtype: "callback" }, { name: "removeListener", rtype: "callback" }] },
        { name: "NowPlaying", methods: [{ name: "getCurrentTrack", rtype: "promise" }, { name: "searchCatalog", rtype: "promise" }, { name: "openNotificationSettings", rtype: "promise" }] },
        { name: "ScreenshotOcr", methods: [{ name: "recognize", rtype: "promise" }] },
        { name: "CapacitorSQLite", methods: ["createConnection", "isDBOpen", "open", "execute", "query", "run"].map(name => ({ name, rtype: "promise" })) },
      ],
      nativeCallback: (plugin, method, options, callback) => {
        if (plugin === "CodexNavigation" && method === "addListener") {
          window.codexNavigationAdds = (window.codexNavigationAdds ?? 0) + 1;
          window.codexNavigationCallback = callback;
          return "codex-navigation-listener";
        }
        if (plugin === "CodexNavigation" && method === "removeListener") return "codex-navigation-removed";
        throw new Error(`Unexpected synthetic callback: ${plugin}.${method}`);
      },
      nativePromise: async (plugin, method, options) => {
        if (plugin === "CodexNavigation" && method === "exitApp") return undefined;
        if (plugin === "CodexPrivacy") return { status: "accepted", policyVersion };
        if (plugin === "CapacitorSQLite") return window.codexCaptureSQLite(method, options);
        if (plugin === "NowPlaying" && method === "getCurrentTrack") {
          window.codexArtworkOptions.push(options ?? {});
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
    await page.addInitScript(nativeInitScript(native), { ...native, policyVersion });
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
  try {
    await input.setInputFiles(file);
  } catch (error) {
    await mkdir(outputDir, { recursive: true });
    await writeFile(path.join(outputDir, "codex_file_input_failure.json"), JSON.stringify({ url: input.page().url(),
      body: await input.page().locator("body").innerText(), errors: input.page().__captureErrors }, null, 2));
    throw error;
  }
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
  assert.equal(await sameIdentityPage.locator(".quick-track-card + .quick-playback-status [role=status]").textContent(), "表单已有当前歌曲信息，未覆盖用户输入。", "播放读取结果应紧贴读取按钮显示");
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
  assert.equal(await switchPage.locator('details.quick-identity-fields input').nth(1).inputValue(), "切换歌曲", "速记应保留当前歌曲名");
  const savedDrafts = await switchPage.evaluate(() => Object.entries(localStorage)
    .filter(([key]) => key.startsWith("music-feelings-entry-draft:v1:new:"))
    .map(([, value]) => JSON.parse(value).fields.content));
  assert.ok(savedDrafts.includes("只属于旧专辑的草稿正文"));
  result.m1.explicitSwitch = { track: await switchPage.locator(".quick-track-card strong").innerText(), preservedDraft: true, pageErrors: switchPage.__captureErrors };
  await switchPage.locator('textarea').first().fill('这首歌让我想起今晚。');
  await switchPage.getByRole('button', { name: '保存专辑听感' }).click();
  await switchPage.waitForURL(/#\/entries\/[^/]+/);
  const savedQuick = await switchPage.evaluate(async () => (await (await import('/src/store.ts')).store.listEntries()).find(entry => entry.title === '切换专辑'));
  assert.equal(savedQuick?.songName, '切换歌曲', '保存专辑听感时仍需保留当前歌曲名');
  const similarAlbumId = await switchPage.evaluate(async () => {
    const { store } = await import('/src/store.ts');
    const { findSimilarEntry } = await import('/src/entryDuplicate.ts');
    const entries = await store.listEntries();
    const saved = entries.find(entry => entry.title === '切换专辑');
    return findSimilarEntry(entries, { ...saved, songName: '同专辑另一首歌' })?.id;
  });
  assert.equal(similarAlbumId, savedQuick?.id, '同一专辑的不同播放曲目仍应提示相似乐评');
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
      { delay: 20, value: { accessEnabled: true, title: "快 B 歌曲", artistName: "B 艺人", albumName: "快 B 专辑", coverDataUrl: `data:image/png;base64,${validPng.toString('base64')}` } },
    ],
  } });
  await racePage.goto(`${origin}/#/capture`);
  await racePage.waitForFunction(() => window.codexTrackStarted === 1);
  await racePage.evaluate(() => document.dispatchEvent(new Event("visibilitychange")));
  await racePage.waitForFunction(() => window.codexTrackStarted === 2);
  await racePage.waitForFunction(() => window.codexTrackFinished === 2);
  await racePage.waitForFunction(() => document.querySelector('.quick-track-card strong')?.textContent === '快 B 专辑');
  assert.equal(await racePage.locator(".quick-track-card strong").innerText(), "快 B 专辑");
  assert.equal(await racePage.locator(".quick-track-card > img").getAttribute('src'), `data:image/png;base64,${validPng.toString('base64')}`);
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
  const albumOnly = await page.evaluate(async () => (await import('/src/albumFirst.ts')).toAlbumFirstRecognition({ type: 'album', title: '仅有专辑', albumName: '仅有专辑' }, null));
  assert.equal(albumOnly.fields.songName, null, '纯专辑识别不能把专辑标题误填成歌曲');
  await page.getByText('请先授予通知使用权；本应用只读取系统媒体会话中的歌曲信息。', { exact: true }).waitFor();
  await page.getByRole('button', { name: '打开系统设置', exact: true }).click();
  await page.getByRole('button', { name: '读取当前播放', exact: true }).click();
  await page.getByText('没有读到正在播放的歌曲，请确认网易云音乐正在播放后重试。', { exact: true }).waitFor();
  await page.getByRole('button', { name: '读取当前播放', exact: true }).click();
  await page.waitForFunction(() => document.querySelector('input[name="albumName"]')?.value === '播放专辑');
  assert.equal(await page.locator('input[name="songName"]').inputValue(), '播放歌曲', '完整乐评应同时填入歌曲名');
  assert.equal(await page.locator('input[name="artistName"]').inputValue(), '播放艺人');
  assert.equal(await page.locator('input[name="title"]').inputValue(), '播放专辑');
  assert.match(await page.locator('.assist-panel [role="status"]').first().textContent(), /播放歌曲.*播放专辑.*播放艺人/, '读取反馈应列出歌曲、专辑和歌手');
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

async function checkAutomaticArtwork() {
  const fixture = await browser.newPage();
  const png = await fixture.evaluate(() => {
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = 256;
    const context = canvas.getContext('2d');
    context.fillStyle = '#20594a'; context.fillRect(0, 0, 256, 256);
    context.strokeStyle = '#dfc78a'; context.lineWidth = 3;
    for (const radius of [35, 55, 75]) { context.beginPath(); context.arc(128, 112, radius, 0, Math.PI * 2); context.stroke(); }
    context.fillStyle = '#f5f2e9'; context.font = 'bold 22px sans-serif'; context.textAlign = 'center';
    context.fillText('系统封面测试', 128, 224);
    return canvas.toDataURL('image/png');
  });
  await fixture.close();
  result.artwork = {};
  const track = { accessEnabled: true, title: '系统封面歌曲', artistName: '系统封面艺人', albumName: '系统封面专辑', coverDataUrl: png };
  for (const quick of [true, false]) {
    const label = quick ? 'quick' : 'full';
    const page = await newPage({ native: { tracks: [{ value: track }] } });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${origin}/#/${quick ? 'capture' : 'new'}`);
    const image = page.locator(quick ? '.quick-track-card > img' : '.cover-picker > img');
    await image.waitFor();
    assert.equal(await image.getAttribute('src'), png);
    await page.waitForFunction(() => window.codexNavigationAdds >= 1);
    assert.equal(await page.locator('.codex-back-notice').count(), 0);
    await page.locator('textarea').first().fill('系统封面与这一篇听感一起保留。');
    await page.waitForTimeout(500);
    const draft = await page.evaluate(() => Object.entries(localStorage)
      .filter(([key]) => key.startsWith('music-feelings-entry-draft:v1:new:'))
      .map(([, raw]) => JSON.parse(raw)).find(item => item.fields.albumName === '系统封面专辑'));
    assert.equal(draft.coverDataUrl, png);
    assert.equal(draft.coverFromPlayback, true);
    assert.equal(draft.coverChanged, true);
    const coverless = await page.evaluate(async () => {
      const { store } = await import('/src/store.ts');
      const { readStoredEntryDraft } = await import('/src/entryDraft.ts');
      const raw = await store.exportBackup({ includeCovers: false });
      store.previewBackup(raw);
      const item = JSON.parse(raw).drafts.find(item => JSON.parse(item.raw).fields.albumName === '系统封面专辑');
      return readStoredEntryDraft(item.key, item.raw);
    });
    assert.equal(coverless.coverDataUrl, null);
    assert.equal(coverless.coverChanged, false);
    assert.notEqual(coverless.coverFromPlayback, true);
    const options = await page.evaluate(() => window.codexArtworkOptions);
    assert.ok(options.some(item => item.includeArtwork === true));
    // Reload exercises the actual persisted draft parser and origin marker.
    await page.reload();
    await image.waitFor();
    assert.equal(await image.getAttribute('src'), png);
    await mkdir(outputDir, { recursive: true });
    await page.screenshot({ path: path.join(outputDir, `codex_auto_cover_${label}.png`), fullPage: false });
    await page.getByRole('button', { name: quick ? '保存专辑听感' : '保存正式乐评', exact: true }).click();
    await page.waitForURL(/#\/entries\/[^/]+/);
    const persisted = await page.evaluate(async () => {
      const { store } = await import('/src/store.ts');
      return { cover: await store.getCover('album', { albumName: '系统封面专辑', artistName: '系统封面艺人' }), entries: await store.listEntries() };
    });
    assert.equal(persisted.cover, png);
    assert.equal(persisted.entries.length, 1);
    assert.equal(persisted.entries[0].content, '系统封面与这一篇听感一起保留。');
    assert.deepEqual(page.__captureErrors, []);
    result.artwork[label] = { preview: true, draftRoundTrip: true, sqliteCover: true, records: persisted.entries.length, pageErrors: page.__captureErrors };
    await page.close();
  }

  for (const quick of [true, false]) {
    const page = await newPage({ native: { tracks: [{ value: track }] } });
    await page.goto(`${origin}/#/privacy`);
    const manual = await page.evaluate(async () => {
      const canvas = document.createElement('canvas'); canvas.width = canvas.height = 32;
      const context = canvas.getContext('2d'); context.fillStyle = '#12634d'; context.fillRect(0, 0, 32, 32);
      const data = canvas.toDataURL('image/png');
      await (await import('/src/store.ts')).store.setCover('album', { albumName: '系统封面专辑', artistName: '系统封面艺人' }, data);
      return data;
    });
    await page.goto(`${origin}/#/${quick ? 'capture' : 'new'}`);
    const image = page.locator(quick ? '.quick-track-card > img' : '.cover-picker > img');
    await image.waitFor();
    assert.equal(await image.getAttribute('src'), manual);
    // Also verifies the final write cannot replace an existing manual cover.
    await page.evaluate(async (candidate) => (await import('/src/store.ts')).store.setCover('album',
      { albumName: '系统封面专辑', artistName: '系统封面艺人' }, candidate, { onlyIfMissing: true }), png);
    assert.equal(await page.evaluate(async () => (await import('/src/store.ts')).store.getCover('album',
      { albumName: '系统封面专辑', artistName: '系统封面艺人' })), manual);
    assert.deepEqual(page.__captureErrors, []);
    await page.close();
  }
  result.artwork.manualCoverPriority = true;

  const normalized = await newPage({ native: { tracks: [{ value: { ...track, albumName: '  系统封面专辑  ', artistName: '系统封面艺人 ' } }] } });
  await normalized.goto(`${origin}/#/privacy`);
  await normalized.evaluate(async (data) => (await import('/src/store.ts')).store.setCover('album',
    { albumName: '系统封面专辑', artistName: '系统封面艺人' }, data), png);
  const protectedCover = await normalized.evaluate(async () => {
    const { store } = await import('/src/store.ts');
    await store.setCover('album', { albumName: '  系统封面专辑  ', artistName: '系统封面艺人 ' }, 'different-auto-image', { onlyIfMissing: true });
    return store.getCover('album', { albumName: '系统封面专辑', artistName: '系统封面艺人' });
  });
  assert.equal(protectedCover, png);
  await normalized.goto(`${origin}/#/capture`);
  await normalized.locator('.quick-track-card > img').waitFor();
  assert.equal(await normalized.locator('.quick-track-card > img').getAttribute('src'), png);
  await normalized.close();
  result.artwork.normalizedManualCoverPriority = true;

  const catalogCover = await newPage({ native: {
    tracks: [{ value: { ...track, albumName: undefined } }],
    catalog: [{ value: { results: [{ trackName: track.title, artistName: track.artistName, collectionName: track.albumName }] } }],
  } });
  await catalogCover.goto(`${origin}/#/privacy`);
  await catalogCover.evaluate(async () => {
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = 8;
    await (await import('/src/store.ts')).store.setCover('song',
      { songName: '系统封面歌曲', albumName: null, artistName: '系统封面艺人' }, canvas.toDataURL('image/png'));
  });
  await catalogCover.goto(`${origin}/#/new`);
  await catalogCover.waitForFunction(() => document.querySelector('input[name=albumName]')?.value === '系统封面专辑');
  await catalogCover.waitForFunction((data) => document.querySelector('.cover-picker > img')?.getAttribute('src') === data, png);
  await catalogCover.close();
  result.artwork.catalogAlbumCoverRebound = true;

  for (const candidate of [undefined, 'data:text/html;base64,AAAA', 'data:image/png;base64,bm90LWFuLWltYWdl']) {
    const page = await newPage({ native: { tracks: [{ value: { ...track, coverDataUrl: candidate } }] } });
    await page.goto(`${origin}/#/new`);
    await page.waitForFunction(() => document.querySelector('input[name=albumName]')?.value === '系统封面专辑');
    await page.waitForFunction(() => !document.querySelector('.assist-panel button')?.disabled);
    assert.equal(await page.locator('.cover-picker > img').count(), 0);
    await page.locator('textarea[name=content]').fill('没有可用封面也能保存。');
    await page.getByRole('button', { name: '保存正式乐评', exact: true }).click();
    await page.waitForURL(/#\/entries\/[^/]+/);
    assert.equal(await page.evaluate(async () => (await import('/src/store.ts')).store.getCover('album',
      { albumName: '系统封面专辑', artistName: '系统封面艺人' })), null);
    assert.deepEqual(page.__captureErrors, []);
    await page.close();
  }
  result.artwork.badOrMissingImage = true;

  const edited = await newPage({ native: { tracks: [{ value: track }] } });
  await edited.goto(`${origin}/#/new`);
  await edited.locator('.cover-picker > img').waitFor();
  await edited.locator('input[name=artistName]').fill('修改后的艺人');
  await edited.waitForFunction(() => !document.querySelector('.cover-picker > img'));
  await edited.locator('textarea[name=content]').fill('修改作品后不保存旧封面。');
  await edited.getByRole('button', { name: '保存正式乐评', exact: true }).click();
  await edited.waitForURL(/#\/entries\/[^/]+/);
  assert.equal(await edited.evaluate(async () => (await import('/src/store.ts')).store.getCover('album',
    { albumName: '系统封面专辑', artistName: '修改后的艺人' })), null);
  await edited.close();
  result.artwork.identityChangeClearsCover = true;
}

try {
  await checkQuickCapture();
  await checkFullReviewPlayback();
  await checkInputClearing();
  await checkAutomaticArtwork();
  for (const check of Object.values(result.m1)) if (check.pageErrors) assert.deepEqual(check.pageErrors, []);
  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(result, null, 2)}\n`, "utf8");
  console.log(`PASS ${outputPath}`);
  console.log(JSON.stringify(result));
} finally {
  await browser.close();
  if (server) await server.close();
}
