import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { Module } from "node:module";
import ts from "typescript";

const require = Module.createRequire(import.meta.url);

function loadModule(path, localModules = {}) {
  const source = readFileSync(new URL(path, import.meta.url), "utf8");
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  });
  const mod = { exports: {} };
  const localRequire = (id) => localModules[id] ?? require(id);
  new Function("exports", "require", "module", outputText)(mod.exports, localRequire, mod);
  return mod.exports;
}

const musicMetadata = loadModule("../mobile/src/musicMetadata.ts");
const {
  canRestoreEditDraft,
  countNewDrafts,
  createNewDraftId,
  deleteEntryDraftByKey,
  entryDraftKey,
  listEntryDrafts,
  MAX_NEW_DRAFTS,
  readEntryDraft,
  removeEntryDraft,
  writeEntryDraft,
} = loadModule("../mobile/src/entryDraft.ts", {
  "./musicMetadata": musicMetadata,
  "./types": { ENTRY_TYPES: ["year", "month", "album", "song"] },
});

function memoryStorage() {
  const values = new Map();
  const storage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => { values.set(key, String(value)); },
    removeItem: (key) => { values.delete(key); },
    get length() { return values.size; },
    key: (index) => {
      if (index < 0 || index >= values.size) return null;
      let i = 0;
      for (const k of values.keys()) {
        if (i === index) return k;
        i++;
      }
      return null;
    },
  };
  return storage;
}

const legacyDraft = {
  version: 1,
  mode: "create",
  entryId: null,
  baseUpdatedAt: null,
  savedAt: "2026-07-29T10:00:00.000Z",
  fields: {
    type: "song",
    title: "稻香随记",
    year: "2026",
    month: "7",
    albumName: "魔杰座",
    songName: "稻香",
    artistName: "周杰伦",
    listenedAt: "2026-07-29",
    tags: "华语",
    rating: "9",
    ratingModifier: "",
    ratingProduction: "",
    ratingSongwriting: "",
    ratingOriginality: "",
    ratingResonance: "",
    content: "继续写下去",
  },
  genreSelection: { level1: "流行", level2: "华语流行", level3: "" },
  selectedGenreTags: ["华语流行"],
  selectedMoodGroupId: "bright",
  selectedMoods: ["温暖"],
  coverDataUrl: "data:image/jpeg;base64,Y292ZXI=",
  coverChanged: true,
  ocrText: "稻香\n周杰伦",
  recognizedFields: { type: "song", title: "稻香", songName: "稻香", artistName: "周杰伦" },
};
const draft = {
  ...legacyDraft,
  version: 2,
  draftId: null,
  musicMetadata: {
    releaseDate: "2008-10-15T07:00:00Z",
    genre: "国语流行",
    sourcePackage: "com.netease.cloudmusic",
    catalogSource: "apple",
    catalogTrackId: "101",
    enrichedAt: "2026-07-29T10:00:00.000Z",
  },
  inspiration: false,
};

const storage = memoryStorage();
assert.equal(entryDraftKey("create", null), "music-feelings-entry-draft:v1:new");
assert.equal(entryDraftKey("edit", "entry-1"), "music-feelings-entry-draft:v1:edit:entry-1");
assert.throws(() => entryDraftKey("edit", null), /记录 ID/);

writeEntryDraft(storage, draft);
assert.deepEqual(readEntryDraft(storage, "create", null), { status: "valid", draft });
removeEntryDraft(storage, "create", null);
assert.deepEqual(readEntryDraft(storage, "create", null), { status: "missing" });

storage.setItem(entryDraftKey("create", null), "not-json");
assert.deepEqual(readEntryDraft(storage, "create", null), { status: "invalid" });
assert.equal(storage.getItem(entryDraftKey("create", null)), "not-json");

storage.setItem(entryDraftKey("create", null), JSON.stringify(legacyDraft));
assert.deepEqual(readEntryDraft(storage, "create", null), {
  status: "valid",
  draft: { ...legacyDraft, version: 2, draftId: null, musicMetadata: null, inspiration: false },
});

storage.setItem(entryDraftKey("create", null), JSON.stringify({ ...draft, version: 3 }));
assert.deepEqual(readEntryDraft(storage, "create", null), { status: "invalid" });

storage.setItem(entryDraftKey("create", null), JSON.stringify({ ...draft, musicMetadata: { durationMs: -1 } }));
assert.deepEqual(readEntryDraft(storage, "create", null), { status: "invalid" });

storage.setItem(entryDraftKey("create", null), JSON.stringify({ ...draft, fields: { ...draft.fields, content: 3 } }));
assert.deepEqual(readEntryDraft(storage, "create", null), { status: "invalid" });

const editDraft = { ...draft, mode: "edit", entryId: "entry-1", baseUpdatedAt: "2026-07-29T09:00:00.000Z" };
assert.equal(canRestoreEditDraft(editDraft, "entry-1", "2026-07-29T09:00:00.000Z"), true);
assert.equal(canRestoreEditDraft(editDraft, "entry-1", "2026-07-29T09:30:00.000Z"), false);

// 多草稿测试：createNewDraftId 生成唯一 ID
const draftIdA = createNewDraftId();
const draftIdB = createNewDraftId();
assert.notEqual(draftIdA, draftIdB, "createNewDraftId 应生成不同 ID");
assert.ok(typeof draftIdA === "string" && draftIdA.length > 0, "draftId 应为非空字符串");

// 多草稿测试：entryDraftKey 在 create 模式下按 draftId 区分
assert.equal(entryDraftKey("create", null, draftIdA), `music-feelings-entry-draft:v1:new:${draftIdA}`);
assert.equal(entryDraftKey("create", null, null), "music-feelings-entry-draft:v1:new");

// 多草稿测试：countNewDrafts 与 listEntryDrafts
const multiStorage = memoryStorage();
assert.equal(countNewDrafts(multiStorage), 0, "空 storage 应无新建草稿");
assert.deepEqual(listEntryDrafts(multiStorage), [], "空 storage 草稿列表应为空");

// 写入 legacy 新建草稿（无 draftId）
const legacyCreateDraft = { ...draft, mode: "create", entryId: null, draftId: null, baseUpdatedAt: null, savedAt: "2026-07-29T08:00:00.000Z" };
writeEntryDraft(multiStorage, legacyCreateDraft);
assert.equal(countNewDrafts(multiStorage), 1, "legacy 新建草稿应计入 countNewDrafts");

// 写入两个带 draftId 的新建草稿
const draftA = { ...draft, mode: "create", entryId: null, draftId: draftIdA, baseUpdatedAt: null, savedAt: "2026-07-29T09:00:00.000Z", fields: { ...draft.fields, title: "草稿 A" } };
const draftB = { ...draft, mode: "create", entryId: null, draftId: draftIdB, baseUpdatedAt: null, savedAt: "2026-07-29T10:00:00.000Z", fields: { ...draft.fields, title: "草稿 B" } };
writeEntryDraft(multiStorage, draftA);
writeEntryDraft(multiStorage, draftB);
assert.equal(countNewDrafts(multiStorage), 3, "legacy + 2 个新草稿 = 3");

// listEntryDrafts 按 savedAt 降序排序
const metas = listEntryDrafts(multiStorage);
assert.equal(metas.length, 3, "应列出 3 个草稿");
assert.equal(metas[0].title, "草稿 B", "最新草稿应排首位");
assert.equal(metas[1].title, "草稿 A", "次新草稿排第二");
assert.equal(metas[2].title, "稻香随记", "legacy 草稿排末尾");
assert.equal(metas[0].draftId, draftIdB, "草稿 B 的 draftId 应正确");
assert.equal(metas[1].draftId, draftIdA, "草稿 A 的 draftId 应正确");
assert.equal(metas[2].draftId, null, "legacy 草稿 draftId 应为 null");
assert.equal(metas[0].mode, "create", "mode 应为 create");
assert.equal(metas[0].entryId, null, "create 草稿 entryId 应为 null");

// 写入编辑草稿，验证 listEntryDrafts 混合列出
const editDraftMulti = { ...draft, mode: "edit", entryId: "entry-edit-1", draftId: null, baseUpdatedAt: "2026-07-29T07:00:00.000Z", savedAt: "2026-07-29T11:00:00.000Z", fields: { ...draft.fields, title: "编辑草稿" } };
writeEntryDraft(multiStorage, editDraftMulti);
const metasWithEdit = listEntryDrafts(multiStorage);
assert.equal(metasWithEdit.length, 4, "加入编辑草稿后应 4 条");
assert.equal(metasWithEdit[0].title, "编辑草稿", "编辑草稿 savedAt 最新应排首位");
assert.equal(metasWithEdit[0].mode, "edit", "编辑草稿 mode 应为 edit");
assert.equal(metasWithEdit[0].entryId, "entry-edit-1", "编辑草稿 entryId 应正确");
assert.equal(metasWithEdit[0].draftId, null, "编辑草稿 draftId 应为 null");

// countNewDrafts 不应计入编辑草稿
assert.equal(countNewDrafts(multiStorage), 3, "编辑草稿不计入 countNewDrafts");

// deleteEntryDraftByKey 按 key 删除指定草稿
const keyToDelete = metasWithEdit[1].key; // 草稿 B 的 key
deleteEntryDraftByKey(multiStorage, keyToDelete);
assert.equal(countNewDrafts(multiStorage), 2, "删除草稿 B 后剩 2 个新建草稿");
const metasAfterDelete = listEntryDrafts(multiStorage);
assert.equal(metasAfterDelete.length, 3, "删除后列表应剩 3 条");
assert.ok(!metasAfterDelete.some((m) => m.title === "草稿 B"), "草稿 B 应已删除");

// readEntryDraft 按 draftId 读取特定新建草稿
assert.deepEqual(readEntryDraft(multiStorage, "create", null, draftIdA), { status: "valid", draft: draftA });
assert.deepEqual(readEntryDraft(multiStorage, "create", null, draftIdB), { status: "missing" }, "已删除的草稿 B 应 missing");

// removeEntryDraft 按 draftId 删除特定新建草稿
removeEntryDraft(multiStorage, "create", null, draftIdA);
assert.deepEqual(readEntryDraft(multiStorage, "create", null, draftIdA), { status: "missing" }, "删除草稿 A 后应 missing");
assert.equal(countNewDrafts(multiStorage), 1, "只剩 legacy 草稿");

// 灵感草稿测试：inspiration 字段持久化与 listEntryDrafts 返回
const inspirationStorage = memoryStorage();
const inspirationDraftId = createNewDraftId();
const inspirationDraft = {
  ...draft,
  mode: "create",
  entryId: null,
  draftId: inspirationDraftId,
  baseUpdatedAt: null,
  savedAt: "2026-07-29T12:00:00.000Z",
  fields: { ...draft.fields, title: "雨夜灵感", content: "一句话感受" },
  inspiration: true,
};
writeEntryDraft(inspirationStorage, inspirationDraft);
const inspirationResult = readEntryDraft(inspirationStorage, "create", null, inspirationDraftId);
assert.equal(inspirationResult.status, "valid");
assert.equal(inspirationResult.draft.inspiration, true, "灵感草稿的 inspiration 应为 true");

// 旧版草稿（无 inspiration 字段）解析后 inspiration 默认为 false
const noInspirationRaw = JSON.stringify({ ...draft, inspiration: undefined });
inspirationStorage.setItem(entryDraftKey("create", null, draftIdA), noInspirationRaw);
const noInspirationResult = readEntryDraft(inspirationStorage, "create", null, draftIdA);
assert.equal(noInspirationResult.status, "valid");
assert.equal(noInspirationResult.draft.inspiration, false, "无 inspiration 字段的草稿默认 false");

// listEntryDrafts 返回 inspiration 字段
const inspirationMetas = listEntryDrafts(inspirationStorage);
assert.equal(inspirationMetas.length, 2, "应列出 2 个草稿");
const inspirationMeta = inspirationMetas.find((m) => m.draftId === inspirationDraftId);
assert.ok(inspirationMeta, "应找到灵感草稿");
assert.equal(inspirationMeta.inspiration, true, "灵感草稿 meta 的 inspiration 应为 true");
assert.equal(inspirationMeta.title, "雨夜灵感", "灵感草稿标题应正确");
const normalMeta = inspirationMetas.find((m) => m.draftId === draftIdA);
assert.equal(normalMeta.inspiration, false, "普通草稿 meta 的 inspiration 应为 false");

const appSource = readFileSync(new URL("../mobile/src/App.tsx", import.meta.url), "utf8");
assert.match(appSource, /onChange=\{handleFormMutation\}/);
assert.match(appSource, /function handleFormMutation[\s\S]*scheduleDraftSave\(\)/);
assert.match(appSource, /visibilitychange/);
assert.match(appSource, /pagehide/);
assert.match(appSource, /removeEntryDraft/);
assert.match(appSource, /草稿已自动保存/);
assert.match(appSource, /draftReady/);
assert.match(appSource, /version: 2/);
assert.match(appSource, /musicMetadata/);
// 多草稿支持：App.tsx 应导入 countNewDrafts/listEntryDrafts/createNewDraftId/deleteEntryDraftByKey/MAX_NEW_DRAFTS
assert.match(appSource, /countNewDrafts/);
assert.match(appSource, /listEntryDrafts/);
assert.match(appSource, /createNewDraftId/);
assert.match(appSource, /deleteEntryDraftByKey/);
assert.match(appSource, /MAX_NEW_DRAFTS/);

// 多维度评分草稿测试：4 维字段持久化与恢复
const dimStorage = memoryStorage();
const dimDraftId = createNewDraftId();
const dimDraft = {
  ...draft,
  mode: "create",
  entryId: null,
  draftId: dimDraftId,
  baseUpdatedAt: null,
  savedAt: "2026-07-31T08:00:00.000Z",
  fields: {
    ...draft.fields,
    title: "四维草稿",
    ratingProduction: "8.5",
    ratingSongwriting: "9",
    ratingOriginality: "7.5",
    ratingResonance: "9.5",
  },
};
writeEntryDraft(dimStorage, dimDraft);
const dimResult = readEntryDraft(dimStorage, "create", null, dimDraftId);
assert.equal(dimResult.status, "valid");
assert.equal(dimResult.draft.fields.ratingProduction, "8.5", "草稿 ratingProduction 应持久化");
assert.equal(dimResult.draft.fields.ratingSongwriting, "9", "草稿 ratingSongwriting 应持久化");
assert.equal(dimResult.draft.fields.ratingOriginality, "7.5", "草稿 ratingOriginality 应持久化");
assert.equal(dimResult.draft.fields.ratingResonance, "9.5", "草稿 ratingResonance 应持久化");

// 旧版草稿（无 4 维字段）解析后兼容为空字符串
const noDimRaw = JSON.stringify({ ...draft, fields: { ...draft.fields, ratingProduction: undefined, ratingSongwriting: undefined, ratingOriginality: undefined, ratingResonance: undefined } });
dimStorage.setItem(entryDraftKey("create", null, draftIdA), noDimRaw);
const noDimResult = readEntryDraft(dimStorage, "create", null, draftIdA);
assert.equal(noDimResult.status, "valid");
assert.equal(noDimResult.draft.fields.ratingProduction, "", "无 4 维字段的草稿应兼容为空字符串");
assert.equal(noDimResult.draft.fields.ratingResonance, "", "无 4 维字段的草稿应兼容为空字符串");

console.log("mobile entry draft check passed");
