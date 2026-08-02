import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { Module } from "node:module";
import ts from "typescript";

const require = Module.createRequire(import.meta.url);
function load(path, localModules = {}) {
  const source = readFileSync(new URL(path, import.meta.url), "utf8");
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  });
  const mod = { exports: {} };
  new Function("exports", "require", "module", outputText)(mod.exports, (id) => localModules[id] ?? require(id), mod);
  return mod.exports;
}

const moods = load("../shared/moods.ts");
const albumFirst = load("../mobile/src/albumFirst.ts");
const identity = load("../mobile/src/musicIdentity.ts");
const quickCapture = load("../mobile/src/quickCapture.ts", { "../../shared/moods": moods, "./albumFirst": albumFirst });
const backupHealth = load("../mobile/src/backupHealth.ts");
const storageSafety = load("../mobile/src/storageSafety.ts");

const recognized = albumFirst.toAlbumFirstRecognition({
  type: "song",
  title: "Track One",
  songName: "Track One",
  albumName: "Whole Album",
  artistName: "Track Artist",
}, { albumArtistName: "Album Artist", catalogAlbumId: "album-1" });
assert.deepEqual(recognized.fields, {
  type: "album",
  title: "Whole Album",
  songName: null,
  albumName: "Whole Album",
  artistName: "Album Artist",
});
assert.equal(recognized.musicMetadata.displayTitle, "Track One");

const baseQuick = {
  title: "Track One",
  songName: "Track One",
  artistName: "Album Artist",
  albumName: "Whole Album",
  musicMetadata: recognized.musicMetadata,
  content: "整张专辑像一段完整的夜路。",
  moods: ["平静"],
  rating: 8,
  ratingModifier: null,
  listenedOn: "2026-08-02",
};
const albumEntry = quickCapture.quickCaptureToEntryInput({ ...baseQuick, type: "album" });
assert.equal(albumEntry.type, "album");
assert.equal(albumEntry.title, "Whole Album");
assert.equal(albumEntry.songName, null);
assert.equal(albumEntry.musicMetadata.displayTitle, "Track One");
const oldSongEntry = quickCapture.quickCaptureToEntryInput({ ...baseQuick, type: "song" });
assert.equal(oldSongEntry.type, "song");
assert.equal(oldSongEntry.songName, "Track One");
const fallbackSong = quickCapture.quickCaptureToEntryInput({ ...baseQuick, type: "album", albumName: "" });
assert.equal(fallbackSong.type, "song");

const existingAlbum = { ...albumEntry, id: "album-entry", createdAt: "2026-08-02T00:00:00.000Z", updatedAt: "2026-08-02T00:00:00.000Z" };
assert.equal(identity.sameAlbumIdentity(existingAlbum, { albumName: "other", artistName: "other", musicMetadata: { catalogAlbumId: "album-1" } }), true);
assert.equal(identity.sameAlbumIdentity(existingAlbum, { albumName: " Whole  Album ", artistName: "album artist" }), true);
assert.equal(identity.sameAlbumIdentity(existingAlbum, { albumName: "Whole Album", artistName: null }), false);
assert.deepEqual(identity.findEntryIdentityMatches([existingAlbum], albumEntry).map((entry) => entry.id), ["album-entry"]);

const rawBackup = JSON.stringify({ version: 5, exportedAt: "2026-08-02T00:00:00.000Z", entries: [existingAlbum], summaries: [], monthlySummaries: [], covers: [], listeningMoments: [], appData: {} });
const health = await backupHealth.inspectBackup(rawBackup, {
  exportedAt: "2026-08-02T00:00:00.000Z",
  entryCount: 1,
  summaryCount: 0,
  monthlySummaryCount: 0,
  coverCount: 0,
  listeningMomentCount: 0,
});
assert.equal(health.version, 1);
assert.equal(health.backupVersion, 5);
assert.equal(health.entryCount, 1);
assert.equal(health.sha256.length, 64);
assert.equal(backupHealth.parseBackupHealth(JSON.stringify(health)).sha256, health.sha256);
assert.equal(backupHealth.parseBackupHealth("{}"), null);

function memoryStorage(seed = {}) {
  const data = new Map(Object.entries(seed));
  return {
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => data.set(key, String(value)),
    removeItem: (key) => data.delete(key),
    dump: () => Object.fromEntries(data),
  };
}
const storage = memoryStorage({ archive: "{broken" });
assert.throws(() => storageSafety.readSafeJson(storage, "archive", []), /损坏/);
assert.equal(storage.getItem("archive"), null);
const quarantined = storageSafety.readStorageCorruption(storage);
assert.equal(quarantined.key, "archive");
assert.equal(quarantined.raw, "{broken");
storageSafety.clearStorageCorruption(storage);
assert.equal(storageSafety.readStorageCorruption(storage), null);

console.log("mobile v2.1.9 album-first and reliability check passed");
