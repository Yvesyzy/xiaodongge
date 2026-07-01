import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { Module } from "node:module";
import ts from "typescript";

const require = Module.createRequire(import.meta.url);
const source = readFileSync(new URL("../mobile/src/ocr.ts", import.meta.url), "utf8");
const { outputText } = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2022,
  },
});
const mod = { exports: {} };
new Function("exports", "require", "module", outputText)(mod.exports, require, mod);
const { parseMusicInfoText } = mod.exports;

assert.deepEqual(parseMusicInfoText("歌名：七里香\n歌手：周杰伦\n专辑：七里香"), {
  songName: "七里香",
  artistName: "周杰伦",
  albumName: "七里香",
  title: "七里香",
});

assert.deepEqual(parseMusicInfoText("OK Computer - Radiohead\nOK Computer"), {
  songName: "OK Computer",
  artistName: "Radiohead",
  albumName: "OK Computer",
  title: "OK Computer",
});

const pablo = parseMusicInfoText({
  width: 1080,
  height: 1920,
  text: [
    "00:36 n",
    "THE LIFE OF",
    "PABLO",
    "The Life Of Pablo",
    "发行公司： Rock The World/IDJ/Kanye LP7",
    "专辑类别： 录音室版",
    "×Kanye West的最新录音室专辑《THE LIFE OF PABLO》",
    "于2016年2月14日在Tidal独家上线，后解除独占。",
  ].join("\n"),
  lines: [
    { text: "00:36 n", left: 60, top: 34, right: 170, bottom: 70 },
    { text: "THE LIFE OF", left: 336, top: 312, right: 564, bottom: 360 },
    { text: "PABLO", left: 662, top: 312, right: 790, bottom: 360 },
    { text: "The Life Of Pablo", left: 352, top: 826, right: 730, bottom: 874 },
    { text: "发行公司： Rock The World/IDJ/Kanye LP7", left: 94, top: 1002, right: 802, bottom: 1044 },
    { text: "专辑类别： 录音室版", left: 94, top: 1066, right: 448, bottom: 1108 },
    { text: "×Kanye West的最新录音室专辑《THE LIFE OF PABLO》", left: 94, top: 1182, right: 886, bottom: 1226 },
    { text: "于2016年2月14日在Tidal独家上线，后解除独占。", left: 94, top: 1238, right: 890, bottom: 1282 },
  ],
});
assert.equal(pablo.type, "album");
assert.equal(pablo.title, "The Life Of Pablo");
assert.equal(pablo.albumName, "The Life Of Pablo");
assert.equal(pablo.songName, null);
assert.equal(pablo.artistName, "Kanye West");
assert.match(pablo.content, /发行公司/);
assert.match(pablo.content, /Kanye West的最新录音室专辑/);

console.log("mobile OCR parser check passed");
