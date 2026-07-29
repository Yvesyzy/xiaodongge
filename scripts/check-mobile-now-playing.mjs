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
const { mergeMusicMetadata } = musicMetadata;
const {
  applyAppleCatalogMatch,
  findAppleCatalogMatch,
  parseCatalogSearchResult,
  parseNowPlayingResult,
} = loadModule("../mobile/src/nowPlaying.ts", { "./musicMetadata": musicMetadata });

const parsedNowPlaying = parseNowPlayingResult({
  accessEnabled: true,
  title: "  稻香  ",
  artistName: " 周杰伦 ",
  albumName: " 魔杰座 ",
  musicMetadata: {
    composerName: " 周杰伦 ",
    releaseYear: 2008,
    durationMs: 223000,
    sourcePackage: "com.netease.cloudmusic",
  },
});
assert.deepEqual(parsedNowPlaying, {
  accessEnabled: true,
  fields: {
    type: "song",
    title: "稻香",
    songName: "稻香",
    artistName: "周杰伦",
    albumName: "魔杰座",
  },
  musicMetadata: {
    composerName: "周杰伦",
    sourcePackage: "com.netease.cloudmusic",
    releaseYear: 2008,
    durationMs: 223000,
  },
});
assert.deepEqual(parseNowPlayingResult({ accessEnabled: false }), {
  accessEnabled: false,
  fields: null,
  musicMetadata: null,
});
assert.equal(parseNowPlayingResult({ accessEnabled: true, title: "  " }).fields, null);
assert.throws(() => parseNowPlayingResult({ accessEnabled: "yes" }), /返回格式无效/);
assert.throws(() => parseNowPlayingResult({ accessEnabled: true, title: "稻香", musicMetadata: { durationMs: -1 } }), /非负整数/);
assert.deepEqual(
  mergeMusicMetadata(
    { sourcePackage: "com.netease.cloudmusic", durationMs: 223000 },
    { sourcePackage: "old.package", releaseDate: "2008-10-15T07:00:00Z", catalogSource: "apple" },
  ),
  {
    releaseDate: "2008-10-15T07:00:00Z",
    sourcePackage: "com.netease.cloudmusic",
    durationMs: 223000,
    catalogSource: "apple",
  },
);

const search = parseCatalogSearchResult({
  country: "CN",
  results: [
    {
      trackName: "稻香",
      artistName: "周杰伦",
      collectionName: "魔杰座",
      releaseDate: "2008-10-15T07:00:00Z",
      primaryGenreName: "国语流行",
      trackTimeMillis: 223000,
      trackNumber: 6,
      trackCount: 11,
      discNumber: 1,
      discCount: 1,
      trackExplicitness: "notExplicit",
      trackId: "101",
      collectionId: "201",
      artistId: "301",
    },
    { trackName: "稻香", artistName: "周杰伦", collectionName: "现场专辑", trackId: "102" },
  ],
});
const match = findAppleCatalogMatch(parsedNowPlaying.fields, search);
assert.equal(match.trackId, "101");
assert.equal(findAppleCatalogMatch({ songName: "稻香 Live", artistName: "周杰伦" }, search), null);
assert.equal(findAppleCatalogMatch({ songName: "稻香", artistName: "周杰伦" }, search), null);
assert.equal(findAppleCatalogMatch({ songName: "稻香", artistName: "温岚" }, {
  country: "CN",
  results: [{ trackName: "稻香", artistName: "周杰伦 & 温岚", trackId: "103" }],
})?.trackId, "103");

const enriched = applyAppleCatalogMatch(
  { type: "song", title: "稻香", songName: "稻香", artistName: "周杰伦" },
  { genre: "华语流行", composerName: "周杰伦", sourcePackage: "com.netease.cloudmusic" },
  match,
  "2026-07-29T12:00:00.000Z",
);
assert.equal(enriched.fields.albumName, "魔杰座");
assert.deepEqual(enriched.musicMetadata, {
  releaseDate: "2008-10-15T07:00:00Z",
  genre: "华语流行",
  sourcePackage: "com.netease.cloudmusic",
  catalogTrackId: "101",
  catalogAlbumId: "201",
  catalogArtistId: "301",
  composerName: "周杰伦",
  releaseYear: 2008,
  durationMs: 223000,
  trackNumber: 6,
  trackCount: 11,
  discNumber: 1,
  discCount: 1,
  explicitness: "notExplicit",
  catalogSource: "apple",
  enrichedAt: "2026-07-29T12:00:00.000Z",
});

const manifest = readFileSync(new URL("../android/app/src/main/AndroidManifest.xml", import.meta.url), "utf8");
const activity = readFileSync(new URL("../android/app/src/main/java/com/yves/musicarchive/MainActivity.java", import.meta.url), "utf8");
const plugin = readFileSync(new URL("../android/app/src/main/java/com/yves/musicarchive/NowPlayingPlugin.java", import.meta.url), "utf8");
const app = readFileSync(new URL("../mobile/src/App.tsx", import.meta.url), "utf8");
const store = readFileSync(new URL("../mobile/src/store.ts", import.meta.url), "utf8");

assert.match(manifest, /android\.permission\.INTERNET/);
assert.match(manifest, /\.NowPlayingNotificationService/);
assert.match(manifest, /android\.permission\.BIND_NOTIFICATION_LISTENER_SERVICE/);
assert.match(activity, /registerPlugin\(NowPlayingPlugin\.class\)/);
for (const key of [
  "METADATA_KEY_TITLE", "METADATA_KEY_ARTIST", "METADATA_KEY_ALBUM", "METADATA_KEY_ALBUM_ARTIST",
  "METADATA_KEY_AUTHOR", "METADATA_KEY_WRITER", "METADATA_KEY_COMPOSER", "METADATA_KEY_COMPILATION",
  "METADATA_KEY_DATE", "METADATA_KEY_YEAR", "METADATA_KEY_GENRE", "METADATA_KEY_DURATION",
  "METADATA_KEY_TRACK_NUMBER", "METADATA_KEY_NUM_TRACKS", "METADATA_KEY_DISC_NUMBER", "METADATA_KEY_MEDIA_ID",
  "METADATA_KEY_MEDIA_URI", "METADATA_KEY_ALBUM_ART_URI", "METADATA_KEY_DISPLAY_SUBTITLE", "METADATA_KEY_DISPLAY_DESCRIPTION",
]) assert.match(plugin, new RegExp(`MediaMetadata\\.${key}`));
assert.match(plugin, /searchCatalog/);
assert.match(plugin, /itunes\.apple\.com\/search/);
assert.match(plugin, /setConnectTimeout\(5_000\)/);
assert.match(plugin, /setReadTimeout\(8_000\)/);
assert.match(plugin, /MAX_RESPONSE_BYTES/);
assert.doesNotMatch(plugin, /previewUrl|trackPrice|collectionPrice|currency/);
assert.doesNotMatch(plugin, /Notification\.EXTRA_(TITLE|TEXT)/);
assert.ok(app.indexOf('country: "CN"') < app.indexOf('country: "US"'));
assert.match(app, /联网补全只会把当前歌曲名、歌手和专辑发送给 Apple 音乐目录/);
assert.match(app, /完整音乐元数据/);
assert.match(store, /ALTER TABLE ReviewEntry ADD COLUMN musicMetadata TEXT/);
assert.match(store, /version: 3/);

console.log("mobile now-playing metadata enrichment check passed");
