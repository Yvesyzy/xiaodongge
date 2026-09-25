import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { createServer } from "vite";
import { freeLoopbackPort, qaOptions } from "./codex_qa_options.mjs";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const qa = qaOptions({ output: "release/codex_draft_records" });
const outputDir = path.resolve(projectRoot, qa.output);
const suppliedOrigin = process.argv.some((arg) => arg === "--origin" || arg.startsWith("--origin="));
let origin = suppliedOrigin ? qa.origin : null;
let server = null;

if (!origin) {
  server = await createServer({
    configFile: path.resolve(projectRoot, "mobile/vite.config.ts"),
    cacheDir: path.resolve(projectRoot, "release/codex_t06_drafts_vite_cache"),
    server: { host: "127.0.0.1", port: await freeLoopbackPort(), strictPort: true, forwardConsole: false },
  });
  await server.listen();
  const address = server.httpServer?.address();
  if (!address || typeof address === "string") throw new Error("无法读取草稿回归测试端口");
  origin = `http://127.0.0.1:${address.port}`;
}

const browser = await chromium.launch({ headless: true, channel: "chrome" });
const result = { origin, damage: {}, compatibility: {}, conflict: {}, pageErrors: [] };

function makeDraft({ version = 2, mode = "create", entryId = null, draftId = "fixture-id", baseUpdatedAt = null, title = "合成草稿" } = {}) {
  const draft = {
    version,
    mode,
    captureMode: "full",
    entryId,
    draftId,
    baseUpdatedAt,
    savedAt: "2026-09-23T00:00:00.000Z",
    fields: {
      type: "album",
      title,
      year: "2026",
      month: "9",
      albumName: "草稿专辑",
      songName: "草稿歌曲",
      artistName: "草稿艺人",
      listenedAt: "2026-09-23",
      tags: "",
      rating: "8",
      ratingModifier: "",
      ratingProduction: "",
      ratingSongwriting: "",
      ratingOriginality: "",
      ratingResonance: "",
      content: "必须完整保留的冲突正文",
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
  if (version === 1) {
    delete draft.musicMetadata;
    delete draft.draftId;
  }
  return draft;
}

async function newPage() {
  const context = await browser.newContext({ acceptDownloads: true });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.__codexContext = context;
  page.__codexErrors = errors;
  return page;
}

async function seed(page, entries) {
  await page.goto(`${origin}/#/privacy`);
  await page.evaluate((items) => {
    localStorage.clear();
    for (const [key, raw] of items) localStorage.setItem(key, raw);
  }, entries);
}

async function closePage(page) {
  result.pageErrors.push(...page.__codexErrors);
  await page.__codexContext.close();
}

async function checkCorruptDraftUi() {
  const page = await newPage();
  const damaged = [
    ["music-feelings-entry-draft:v1:new:broken-json", "{broken-json"],
    ["music-feelings-entry-draft:v1:new:empty", ""],
    ["music-feelings-entry-draft:v1:new:key-mismatch", JSON.stringify(makeDraft({ draftId: "different-id", title: "键内容不符" }))],
    ["music-feelings-entry-draft:v1:new:edit-payload", JSON.stringify(makeDraft({ mode: "edit", entryId: "edit-payload", draftId: null, baseUpdatedAt: "2026-09-20T00:00:00.000Z", title: "模式不符" }))],
    ["music-feelings-entry-draft:v1:new:unknown-suffix", JSON.stringify(makeDraft({ draftId: "payload-id", title: "未知新建后缀" }))],
    ["music-feelings-entry-draft:v1:unknown", JSON.stringify(makeDraft({ title: "未知键前缀" }))],
  ];
  await seed(page, damaged);
  await page.goto(`${origin}/#/drafts`);
  await page.getByRole("heading", { name: "草稿箱", exact: true }).waitFor();
  await page.locator(".draft-damaged").nth(5).waitFor();
  assert.equal(await page.locator(".draft-damaged").count(), 6);
  assert.match(await page.locator("body").innerText(), /新建占位 5\/5/);
  assert.match(await page.locator("body").innerText(), /损坏 6/);
  await page.goto(`${origin}/#/`);
  await page.locator(".home-draft-link").waitFor();
  assert.match(await page.locator(".home-draft-link").innerText(), /新建占位 5/);
  assert.match(await page.locator(".home-draft-link").innerText(), /损坏 6/);
  await page.goto(`${origin}/#/more`);
  const moreDraftCard = page.locator(".entry-card").filter({ hasText: "草稿箱" });
  await moreDraftCard.waitFor();
  assert.match(await moreDraftCard.innerText(), /新建占位 5/);
  assert.match(await moreDraftCard.innerText(), /损坏 6/);
  await page.goto(`${origin}/#/drafts`);
  await page.getByRole("heading", { name: "草稿箱", exact: true }).waitFor();
  const unknownCard = page.locator(".draft-damaged").filter({ hasText: "music-feelings-entry-draft:v1:unknown" });
  assert.equal(await unknownCard.count(), 1);
  await unknownCard.getByText("查看原文", { exact: true }).click();
  assert.equal(await unknownCard.locator(".draft-raw").textContent(), JSON.stringify(makeDraft({ title: "未知键前缀" })));

  const exportCard = page.locator(".draft-damaged").filter({ hasText: "music-feelings-entry-draft:v1:new:broken-json" });
  const downloadPromise = page.waitForEvent("download");
  await exportCard.getByRole("button", { name: "导出原文", exact: true }).click();
  const download = await downloadPromise;
  const exportedPath = path.join(outputDir, "codex_draft_damaged_raw.json");
  await mkdir(outputDir, { recursive: true });
  await download.saveAs(exportedPath);
  assert.equal(await readFile(exportedPath, "utf8"), "{broken-json");

  const unchangedRaw = await page.evaluate(() => localStorage.getItem("music-feelings-entry-draft:v1:new:empty"));
  page.once("dialog", (dialog) => dialog.dismiss());
  await page.locator(".draft-damaged").filter({ hasText: "music-feelings-entry-draft:v1:new:empty" }).getByRole("button", { name: "删除", exact: true }).click();
  await page.waitForTimeout(150);
  assert.equal(await page.evaluate(() => localStorage.getItem("music-feelings-entry-draft:v1:new:empty")), unchangedRaw);
  assert.equal(await page.locator(".draft-damaged").count(), 6);

  page.once("dialog", (dialog) => dialog.accept());
  await exportCard.getByRole("button", { name: "删除", exact: true }).click();
  await page.waitForTimeout(200);
  assert.equal(await page.evaluate(() => localStorage.getItem("music-feelings-entry-draft:v1:new:broken-json")), null);
  assert.match(await page.locator("body").innerText(), /新建占位 4\/5/);
  await page.goto(`${origin}/#/new`);
  await page.locator("form.writing-form").waitFor();
  assert.equal(await page.locator(".writing-form").count(), 1, "删除一份损坏新建草稿后应释放新建名额");
  await page.screenshot({ path: path.join(outputDir, "codex_draft_records.png"), fullPage: true });
  result.damage = {
    damagedNewVisible: 5,
    unknownPrefixVisible: true,
    rawKeyVisible: true,
    rawExported: true,
    cancelDeletePreserved: true,
    confirmedDeleteReleasedSlot: true,
    evidence: ["codex_draft_damaged_raw.json", "codex_draft_records.png"],
  };
  await closePage(page);
}

async function checkCompatibilityApi() {
  const page = await newPage();
  await seed(page, []);
  const data = await page.evaluate(async ({ legacy, v2, edit, mismatch, badEdit }) => {
    const drafts = await import("/src/entryDraft.ts");
    const map = new Map();
    const storage = {
      getItem: (key) => map.has(key) ? map.get(key) : null,
      setItem: (key, value) => map.set(key, value),
      removeItem: (key) => map.delete(key),
      key: (index) => [...map.keys()][index] ?? null,
      get length() { return map.size; },
    };
    map.set("music-feelings-entry-draft:v1:new", JSON.stringify(legacy));
    map.set("music-feelings-entry-draft:v1:new:free-form-id", JSON.stringify(v2));
    map.set("music-feelings-entry-draft:v1:edit:entry-1", JSON.stringify(edit));
    map.set("music-feelings-entry-draft:v1:new:wrong-key", JSON.stringify(mismatch));
    map.set("music-feelings-entry-draft:v1:edit:entry-1-bad", JSON.stringify(badEdit));
    return {
      legacyV1: !!drafts.readStoredEntryDraft("music-feelings-entry-draft:v1:new", JSON.stringify(legacy)),
      v2FreeFormId: !!drafts.readStoredEntryDraft("music-feelings-entry-draft:v1:new:free-form-id", JSON.stringify(v2)),
      editWithNullDraftId: !!drafts.readStoredEntryDraft("music-feelings-entry-draft:v1:edit:entry-1", JSON.stringify(edit)),
      keyMismatchRejected: drafts.readStoredEntryDraft("music-feelings-entry-draft:v1:new:wrong-key", JSON.stringify(mismatch)) === null,
      editDraftIdRejected: drafts.readStoredEntryDraft("music-feelings-entry-draft:v1:edit:entry-1-bad", JSON.stringify(badEdit)) === null,
      rawCount: drafts.listRawEntryDrafts(storage).length,
      invalidCount: drafts.listEntryDrafts(storage).filter((item) => item.status === "invalid").length,
      matchingRecordValid: drafts.listEntryDrafts(storage, [{ id: "entry-1", updatedAt: edit.baseUpdatedAt }]).find((item) => item.key === "music-feelings-entry-draft:v1:edit:entry-1")?.status,
      missingRecordConflict: drafts.listEntryDrafts(storage, []).find((item) => item.key === "music-feelings-entry-draft:v1:edit:entry-1")?.status,
    };
  }, {
    legacy: makeDraft({ version: 1, draftId: null, title: "legacy v1" }),
    v2: makeDraft({ draftId: "free-form-id", title: "v2 new" }),
    edit: makeDraft({ mode: "edit", entryId: "entry-1", draftId: null, baseUpdatedAt: "2026-09-22T00:00:00.000Z", title: "edit" }),
    mismatch: makeDraft({ draftId: "payload-id", title: "mismatch" }),
    badEdit: makeDraft({ mode: "edit", entryId: "entry-1-bad", draftId: "must-be-null", baseUpdatedAt: "2026-09-22T00:00:00.000Z", title: "bad edit" }),
  });
  assert.equal(data.legacyV1, true);
  assert.equal(data.v2FreeFormId, true);
  assert.equal(data.editWithNullDraftId, true);
  assert.equal(data.keyMismatchRejected, true);
  assert.equal(data.editDraftIdRejected, true);
  assert.equal(data.rawCount, 5);
  assert.equal(data.invalidCount, 2);
  assert.equal(data.matchingRecordValid, "valid");
  assert.equal(data.missingRecordConflict, "conflict");
  result.compatibility = data;
  await closePage(page);
}

async function checkConflictTransfer() {
  const page = await newPage();
  const conflict = makeDraft({ mode: "edit", entryId: "missing-entry", draftId: null, baseUpdatedAt: "2026-09-20T00:00:00.000Z", title: "冲突原文标题" });
  const seedItems = [["music-feelings-entry-draft:v1:edit:missing-entry", JSON.stringify(conflict)]];
  for (let i = 0; i < 5; i++) seedItems.push([`music-feelings-entry-draft:v1:new:occupied-${i}`, JSON.stringify(makeDraft({ draftId: `occupied-${i}`, title: `占位 ${i}` }))]);
  await seed(page, seedItems);
  await page.goto(`${origin}/#/drafts`);
  const conflictCard = page.locator(".draft-conflict").filter({ hasText: "music-feelings-entry-draft:v1:edit:missing-entry" });
  await conflictCard.waitFor();
  await conflictCard.getByText("查看原文", { exact: true }).click();
  assert.equal(await conflictCard.locator(".draft-raw").textContent(), JSON.stringify(conflict));
  await conflictCard.getByRole("button", { name: "转为新建草稿", exact: true }).click();
  await page.getByText(/冲突草稿原文已保留/, { exact: false }).waitFor();
  assert.equal(await page.evaluate(() => localStorage.getItem("music-feelings-entry-draft:v1:edit:missing-entry")), JSON.stringify(conflict));

  page.once("dialog", (dialog) => dialog.accept());
  await page.locator(".draft-card").filter({ hasText: "占位 0" }).getByRole("button", { name: "删除", exact: true }).click();
  await page.waitForTimeout(200);
  await conflictCard.getByRole("button", { name: "转为新建草稿", exact: true }).click();
  await page.waitForURL(/#\/new\?draft=/);
  const transferred = await page.evaluate(() => Object.entries(localStorage)
    .find(([key, raw]) => key.startsWith("music-feelings-entry-draft:v1:new:") && JSON.parse(raw).fields.title === "冲突原文标题"));
  assert.ok(transferred, "冲突草稿转存后必须生成新建草稿");
  const transferredDraft = JSON.parse(transferred[1]);
  assert.equal(transferredDraft.mode, "create");
  assert.equal(transferredDraft.entryId, null);
  assert.equal(transferredDraft.baseUpdatedAt, null);
  assert.equal(transferredDraft.fields.content, conflict.fields.content);
  assert.equal(await page.evaluate(() => localStorage.getItem("music-feelings-entry-draft:v1:edit:missing-entry")), null);
  result.conflict = {
    conflictVisible: true,
    fullQuotaPreservedRaw: true,
    transferredAfterSlotFreed: true,
    fieldsPreserved: transferredDraft.fields,
  };
  await closePage(page);
}

try {
  await mkdir(outputDir, { recursive: true });
  await checkCorruptDraftUi();
  await checkCompatibilityApi();
  await checkConflictTransfer();
  assert.deepEqual(result.pageErrors, []);
  const outputPath = path.join(outputDir, "codex_draft_records.json");
  await writeFile(outputPath, `${JSON.stringify({ passed: true, ...result }, null, 2)}\n`, "utf8");
  console.log(`PASS ${outputPath}`);
  console.log(JSON.stringify({ passed: true, ...result }));
} finally {
  await browser.close();
  if (server) await server.close();
}
