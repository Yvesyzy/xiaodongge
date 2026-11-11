import { strict as assert } from "node:assert";
import { test } from "node:test";
import { activeMonths, entryDate, inPeriod, isNewRelease, releaseYearOf } from "./dateBasis.ts";
import type { ReviewEntry } from "./types.ts";

function entry(extra: Partial<ReviewEntry> = {}): ReviewEntry {
  return {
    id: "x", type: "album", title: "x", year: 2026, month: 5,
    albumName: "A", songName: null, artistName: null, musicMetadata: null,
    content: "", tags: [], moods: [], rating: null, ratingModifier: null,
    ratingProduction: null, ratingSongwriting: null, ratingOriginality: null,
    ratingResonance: null, compositeRatingLocked: false,
    firstListenedAt: null, listenedAt: null,
    createdAt: "2026-05-10T04:00:00.000Z", updatedAt: "2026-05-10T04:00:00.000Z",
    ...extra,
  };
}

test("三种时间各自精确到年月日", () => {
  const item = entry({
    releaseDate: "2026-03-08",
    firstListenedAt: new Date(2026, 2, 20, 12).toISOString(),
    createdAt: new Date(2026, 3, 2, 12).toISOString(),
  });
  assert.equal(entryDate(item, "releaseDate"), "2026-03-08");
  assert.equal(entryDate(item, "firstListenedAt"), "2026-03-20");
  assert.equal(entryDate(item, "recordedAt"), "2026-04-02");
  assert.equal(entryDate(item, "createdAt"), "2026-04-02");
});

test("发行日期优先用可编辑字段，目录日期作回退，只有年份不伪造具体日期", () => {
  const fromForm = entry({ releaseDate: "2026-01-02", musicMetadata: { releaseDate: "1999-05-05" } });
  assert.equal(entryDate(fromForm, "releaseDate"), "2026-01-02");
  const fromCatalog = entry({ musicMetadata: { releaseDate: "1999-05-05" } });
  assert.equal(entryDate(fromCatalog, "releaseDate"), "1999-05-05");
  assert.equal(isNewRelease(fromCatalog, 1999), true);
  const yearOnly = entry({ musicMetadata: { releaseYear: 2026 } });
  assert.equal(entryDate(yearOnly, "releaseDate"), null);
  assert.equal(releaseYearOf(yearOnly), 2026);
  assert.equal(isNewRelease(yearOnly, 2026), true);
  assert.equal(isNewRelease(entry(), 2026), false, "没有发行信息的作品不算新专辑");
});

test("非法日期不会进入统计", () => {
  assert.equal(entryDate(entry({ releaseDate: "2026-02-30" }), "releaseDate"), null);
  assert.equal(entryDate(entry({ releaseDate: "2026-1-2" }), "releaseDate"), null);
  assert.equal(inPeriod(entry({ releaseDate: "2026-02-30" }), "releaseDate", 2026, 2), false);
});

test("月报年报按所选口径归期，不读归档年月", () => {
  const item = entry({ releaseDate: "2026-02-01", firstListenedAt: "2025-11-03T00:00:00.000Z", year: 1999, month: null });
  assert.equal(inPeriod(item, "releaseDate", 2026, 2), true);
  assert.equal(inPeriod(item, "firstListenedAt", 2026, 2), false);
  assert.equal(inPeriod(item, "firstListenedAt", 2025, 11), true);
  assert.equal(inPeriod(item, "recordedAt", 2026, 5), true);
  assert.equal(inPeriod(item, "releaseDate", 2026), true);
});

test("activeMonths 按口径去重并升序", () => {
  const items = [
    entry({ id: "a", releaseDate: "2026-03-01" }),
    entry({ id: "b", releaseDate: "2026-01-05" }),
    entry({ id: "c", releaseDate: "2026-03-21" }),
    entry({ id: "d", releaseDate: "2025-12-31" }),
  ];
  assert.deepEqual(activeMonths(items, "releaseDate", 2026), [1, 3]);
});
