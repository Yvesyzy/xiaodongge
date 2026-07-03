import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { Module } from "node:module";
import ts from "typescript";

const require = Module.createRequire(import.meta.url);
function loadSharedModule(path, localModules = {}) {
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

const genres = loadSharedModule("../shared/genres.ts");
const { buildAbstractMusicMap, buildEmotionUniverse, UNCLASSIFIED_REGION_ID } = loadSharedModule("../shared/visualizations.ts", { "./genres": genres });
const { GENRE_TAGS, genreMatchesFilter, findGenrePath } = genres;
assert.equal(new Set(GENRE_TAGS).size, GENRE_TAGS.length);

function entry(overrides) {
  return {
    id: overrides.id,
    type: "song",
    title: overrides.title ?? overrides.songName,
    year: overrides.year ?? 2026,
    month: overrides.month ?? 6,
    albumName: overrides.albumName ?? "OK Computer",
    songName: overrides.songName,
    artistName: overrides.artistName ?? "Radiohead",
    content: overrides.content ?? "A remembered listening note.",
    tags: overrides.tags ?? [],
    moods: overrides.moods ?? [],
    rating: overrides.rating ?? null,
    listenedAt: overrides.listenedAt ?? null,
    createdAt: overrides.createdAt ?? "2026-06-01T00:00:00.000Z",
    updatedAt: overrides.updatedAt ?? "2026-06-01T00:00:00.000Z",
  };
}

const entries = [
  entry({ id: "song-1", songName: "No Surprises", moods: ["孤独"], rating: 9, listenedAt: "2026-01-02T00:00:00.000Z" }),
  entry({ id: "song-2", songName: "Idioteque", moods: ["激烈"], tags: ["Brostep"], rating: 10, listenedAt: "2026-02-02T00:00:00.000Z" }),
  entry({ id: "song-3", songName: "Night Note", tags: ["深夜"], rating: 6, listenedAt: "2026-03-02T00:00:00.000Z" }),
  entry({ id: "song-4", songName: "Plain Note", moods: ["未知"], albumName: "Kid A", rating: 4, listenedAt: "2026-04-02T00:00:00.000Z" }),
];

const map = buildAbstractMusicMap(entries);
assert.equal(map.regions.find((region) => region.id === "lonely_island").songCount, 1);
assert.equal(map.regions.find((region) => region.id === "rock_peninsula").songCount, 1);
assert.equal(map.regions.find((region) => region.id === "insomnia_city").songCount, 1);
assert.equal(map.regions.find((region) => region.id === UNCLASSIFIED_REGION_ID).songCount, 1);
assert.deepEqual(buildAbstractMusicMap(entries, { mood: "孤独" }).regions.find((region) => region.id === "lonely_island").songs.map((song) => song.id), ["song-1"]);
assert.deepEqual(buildAbstractMusicMap(entries, { tag: "电子" }).regions.flatMap((region) => region.songs).map((song) => song.id), ["song-2"]);
assert.deepEqual(buildAbstractMusicMap(entries, { tag: "Dubstep" }).regions.flatMap((region) => region.songs).map((song) => song.id), ["song-2"]);
assert.deepEqual(findGenrePath("Gothic Rock"), ["摇滚", "Post-Punk / New Wave", "Gothic Rock"]);
assert.equal(genreMatchesFilter("Gothic Rock", "摇滚"), true);
assert.deepEqual(findGenrePath("Nu-Metalcore"), ["金属", "Metalcore / Deathcore", "Nu-Metalcore"]);
assert.equal(genreMatchesFilter("Nu-Metalcore", "金属"), true);
assert.deepEqual(findGenrePath("Crust Punk"), ["朋克", "Anarcho-Punk / Crust", "Crust Punk"]);
assert.equal(genreMatchesFilter("Crust Punk", "朋克"), true);
assert.equal(genreMatchesFilter("Blues Rock", "蓝调"), true);
assert.deepEqual(findGenrePath("Techstep"), ["电子", "Drum and Bass", "Techstep"]);
assert.equal(genreMatchesFilter("Techstep", "电子"), true);
assert.deepEqual(findGenrePath("Jazz Fusion"), ["爵士", "Fusion", "Jazz Fusion"]);
assert.equal(genreMatchesFilter("Jazz Fusion", "爵士"), true);
assert.deepEqual(findGenrePath("Quiet Storm"), ["R&B / Soul", "Contemporary R&B", "Quiet Storm"]);
assert.equal(genreMatchesFilter("Quiet Storm", "R&B / Soul"), true);
assert.equal(genreMatchesFilter("Future Funk", "R&B / Soul"), true);
assert.deepEqual(findGenrePath("Concerto Grosso"), ["古典", "Baroque", "Concerto Grosso"]);
assert.equal(genreMatchesFilter("Concerto Grosso", "古典"), true);
assert.deepEqual(findGenrePath("Piedmont Blues"), ["蓝调", "Acoustic Blues", "Piedmont Blues"]);
assert.equal(genreMatchesFilter("Piedmont Blues", "蓝调"), true);
assert.deepEqual(findGenrePath("Outlaw Country"), ["民谣 / 世界 / 乡村", "Country", "Outlaw Country"]);
assert.equal(genreMatchesFilter("Outlaw Country", "民谣 / 世界 / 乡村"), true);
assert.deepEqual(findGenrePath("Raï"), ["民谣 / 世界 / 乡村", "Asian / Middle Eastern World", "Raï"]);
assert.equal(genreMatchesFilter("Raï", "民谣 / 世界 / 乡村"), true);

const universe = buildEmotionUniverse(entries, { groupBy: "year" });
assert.deepEqual(universe.songs.map((song) => song.id), ["song-1", "song-2", "song-3", "song-4"]);
assert.ok(universe.songs[1].x > universe.songs[0].x);
assert.ok(universe.songs[1].y < universe.songs[3].y);
assert.equal(universe.songs[0].z, 50);
assert.equal(universe.songs[0].depth, 0);
assert.ok(universe.songs[1].ringStrength > universe.songs[3].ringStrength);
assert.equal(universe.groups[0].name, "2026");
assert.equal(universe.groups[0].songCount, 4);

const albumUniverse = buildEmotionUniverse(entries, { groupBy: "album" });
assert.ok(new Set(albumUniverse.songs.map((song) => song.z)).size > 1);
assert.ok(albumUniverse.songs.every((song) => Number.isFinite(song.x) && song.x >= 6 && song.x <= 94));
assert.ok(albumUniverse.songs.every((song) => Number.isFinite(song.y) && song.y >= 8 && song.y <= 94));
assert.ok(albumUniverse.songs.every((song) => Number.isFinite(song.z) && song.z >= 10 && song.z <= 90));
assert.ok(albumUniverse.songs.every((song) => Number.isFinite(song.depth) && song.depth >= -1 && song.depth <= 1));
assert.ok(albumUniverse.songs.every((song) => Number.isFinite(song.ringStrength) && song.ringStrength >= 0.32 && song.ringStrength <= 1));

const tagUniverse = buildEmotionUniverse(entries, { groupBy: "tag" });
assert.ok(tagUniverse.groups.some((group) => group.name === "Brostep" && group.songCount === 1));
assert.deepEqual(buildEmotionUniverse(entries, { tag: "电子" }).songs.map((song) => song.id), ["song-2"]);
assert.deepEqual(buildEmotionUniverse(entries, { tag: "Dubstep" }).songs.map((song) => song.id), ["song-2"]);
assert.ok(buildEmotionUniverse(entries).options.tags.includes("Brostep"));

const rockGenreEntries = [entry({ id: "song-rock-style", songName: "Bela Lugosi's Dead", tags: ["Gothic Rock"], rating: 8, listenedAt: "2026-05-02T00:00:00.000Z" })];
assert.deepEqual(buildEmotionUniverse(rockGenreEntries, { tag: "摇滚" }).songs.map((song) => song.id), ["song-rock-style"]);
assert.deepEqual(buildEmotionUniverse(rockGenreEntries, { tag: "Post-Punk / New Wave" }).songs.map((song) => song.id), ["song-rock-style"]);

const many = Array.from({ length: 301 }, (_, index) => entry({
  id: `many-${index}`,
  songName: `Song ${index}`,
  rating: 5,
  listenedAt: `2026-01-${String((index % 28) + 1).padStart(2, "0")}T00:00:00.000Z`,
}));
const limited = buildEmotionUniverse(many);
assert.equal(limited.displayedCount, 300);
assert.equal(limited.truncated, true);
assert.ok(new Set(limited.songs.slice(0, 40).map((song) => song.z)).size > 1);
assert.ok(new Set(limited.songs.slice(0, 40).map((song) => song.y)).size > 1);

console.log("mobile visualization check passed");
