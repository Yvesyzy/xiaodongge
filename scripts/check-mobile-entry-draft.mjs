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
  entryDraftKey,
  readEntryDraft,
  removeEntryDraft,
  writeEntryDraft,
} = loadModule("../mobile/src/entryDraft.ts", {
  "./musicMetadata": musicMetadata,
  "./types": { ENTRY_TYPES: ["year", "month", "album", "song"] },
});

function memoryStorage() {
  const values = new Map();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
    values,
  };
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
  musicMetadata: {
    releaseDate: "2008-10-15T07:00:00Z",
    genre: "国语流行",
    sourcePackage: "com.netease.cloudmusic",
    catalogSource: "apple",
    catalogTrackId: "101",
    enrichedAt: "2026-07-29T10:00:00.000Z",
  },
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
  draft: { ...legacyDraft, version: 2, musicMetadata: null },
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

const appSource = readFileSync(new URL("../mobile/src/App.tsx", import.meta.url), "utf8");
assert.match(appSource, /onInput=\{handleFormMutation\}/);
assert.match(appSource, /function handleFormMutation[\s\S]*scheduleDraftSave\(\)/);
assert.match(appSource, /visibilitychange/);
assert.match(appSource, /pagehide/);
assert.match(appSource, /removeEntryDraft/);
assert.match(appSource, /草稿已自动保存/);
assert.match(appSource, /draftReady/);
assert.match(appSource, /version: 2/);
assert.match(appSource, /musicMetadata/);

console.log("mobile entry draft check passed");
