import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { Module } from "node:module";
import ts from "typescript";

const require = Module.createRequire(import.meta.url);
const source = readFileSync(new URL("../mobile/src/entryDuplicate.ts", import.meta.url), "utf8");
const { outputText } = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2022,
  },
});
const mod = { exports: {} };
new Function("exports", "require", "module", outputText)(mod.exports, require, mod);
const { findSimilarEntry } = mod.exports;

const entry = {
  id: "entry-1",
  type: "song",
  title: "Paranoid Android",
  year: 2026,
  month: 5,
  albumName: "OK Computer",
  songName: "Paranoid Android",
  artistName: "Radiohead",
  content: "test",
  tags: [],
  moods: [],
  rating: 10,
  listenedAt: "2026-05-20T00:00:00.000Z",
  createdAt: "2026-05-20T00:00:00.000Z",
  updatedAt: "2026-05-20T00:00:00.000Z",
};

assert.equal(findSimilarEntry([entry], {
  type: "song",
  title: "Different note title",
  year: 2026,
  month: 5,
  albumName: "ok computer",
  songName: "paranoid android",
  artistName: "radiohead",
  content: "new",
  tags: [],
  moods: [],
  rating: null,
  listenedAt: "2026-05-20T12:34:00.000Z",
}), entry);

assert.equal(findSimilarEntry([entry], {
  type: "song",
  title: "Paranoid Android",
  year: 2026,
  month: 5,
  albumName: "OK Computer",
  songName: "Paranoid Android",
  artistName: "Radiohead",
  content: "edit",
  tags: [],
  moods: [],
  rating: 9,
  listenedAt: "2026-05-20T00:00:00.000Z",
}, "entry-1"), null);

assert.equal(findSimilarEntry([entry], {
  type: "song",
  title: "Paranoid Android",
  year: 2026,
  month: 5,
  albumName: "OK Computer",
  songName: "Paranoid Android",
  artistName: "Radiohead",
  content: "new day",
  tags: [],
  moods: [],
  rating: 10,
  listenedAt: "2026-05-21T00:00:00.000Z",
}), null);

console.log("mobile entry duplicate check passed");
