import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { chromium } from "playwright";
import { makeJournalFixtures } from "../mobile/codex_journal_fixtures.mjs";
import { qaOptions } from "./codex_qa_options.mjs";

const { origin, output } = qaOptions({ origin: "http://127.0.0.1:5189", output: "release/codex_storage_integrity" });

const browser = await chromium.launch({ headless: true, channel: "chrome" });
let result;
try {
  const page = await browser.newPage({ timezoneId: "Asia/Shanghai" });
  await page.route("**/*", (route) => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
  await page.goto(`${origin}/#/privacy`);
  result = await page.evaluate(async (fixture) => {
    const {
      STORAGE_CORRUPTION_KEY,
      clearStorageCorruption,
      readSafeJson,
      readStorageCorruptions,
    } = await import("/src/storageSafety.ts");
    const { store } = await import("/src/store.ts");
    const keys = {
      entries: "music-feelings-mobile-entries",
      summaries: "music-feelings-mobile-summaries",
      monthlySummaries: "music-feelings-mobile-monthly-summaries",
      covers: "music-feelings-mobile-covers",
      listeningMoments: "music-feelings-mobile-listening-moments",
      appData: "music-feelings-mobile-app-data",
    };
    const archiveDate = "2026-09-17T00:00:00.000Z";

    const values = new Map([["broken-one", "{one"], ["broken-two", "{two"]]);
    const storage = {
      getItem: (key) => values.get(key) ?? null,
      setItem: (key, value) => values.set(key, value),
      removeItem: (key) => values.delete(key),
    };
    const isolationErrors = [];
    for (const key of ["broken-one", "broken-two"]) {
      try { readSafeJson(storage, key, []); } catch (error) { isolationErrors.push(error.message); }
    }
    const archive = JSON.parse(values.get(STORAGE_CORRUPTION_KEY));
    const isolation = {
      originalOne: values.get("broken-one") ?? null,
      originalTwo: values.get("broken-two") ?? null,
      items: archive.items.map((item) => ({ key: item.key, raw: item.raw })),
      errors: isolationErrors,
    };

    const failingValues = new Map([["broken-write", "{write-failure"]]);
    const failingStorage = {
      getItem: (key) => failingValues.get(key) ?? null,
      setItem: (key, value) => { if (key === STORAGE_CORRUPTION_KEY) throw new Error("模拟隔离槽写入失败"); failingValues.set(key, value); },
      removeItem: (key) => failingValues.delete(key),
    };
    let failureError = "";
    try { readSafeJson(failingStorage, "broken-write", []); } catch (error) { failureError = error.message; }
    const setItemFailure = {
      sourceRetained: failingValues.get("broken-write") === "{write-failure",
      archiveAbsent: !failingValues.has(STORAGE_CORRUPTION_KEY),
      error: failureError,
    };

    const legacyValues = new Map([
      ["legacy-new", "{new"],
      [STORAGE_CORRUPTION_KEY, JSON.stringify({ version: 1, key: "legacy-old", raw: "{old", detectedAt: archiveDate })],
    ]);
    const legacyStorage = {
      getItem: (key) => legacyValues.get(key) ?? null,
      setItem: (key, value) => legacyValues.set(key, value),
      removeItem: (key) => legacyValues.delete(key),
    };
    try { readSafeJson(legacyStorage, "legacy-new", []); } catch { /* expected: the raw source is preserved before the read fails */ }
    const legacyArchive = JSON.parse(legacyValues.get(STORAGE_CORRUPTION_KEY));
    const legacyCompatibility = {
      sourceRemovedAfterAppend: !legacyValues.has("legacy-new"),
      items: legacyArchive.items.map((item) => ({ key: item.key, raw: item.raw })),
    };

    const duplicateValues = new Map([
      ["duplicate", "{new"],
      [STORAGE_CORRUPTION_KEY, JSON.stringify({ version: 1, key: "duplicate", raw: "{old", detectedAt: archiveDate })],
    ]);
    const duplicateStorage = {
      getItem: (key) => duplicateValues.get(key) ?? null,
      setItem: (key, value) => duplicateValues.set(key, value),
      removeItem: (key) => duplicateValues.delete(key),
    };
    let duplicateError = "";
    try { readSafeJson(duplicateStorage, "duplicate", []); } catch (error) { duplicateError = error.message; }
    const occupiedSlot = {
      sourceRetained: duplicateValues.get("duplicate") === "{new",
      priorRawRetained: JSON.parse(duplicateValues.get(STORAGE_CORRUPTION_KEY)).raw === "{old",
      error: duplicateError,
    };

    const malformedArchiveValues = new Map([[STORAGE_CORRUPTION_KEY, "{not-an-archive"]]);
    const malformedArchiveStorage = {
      getItem: (key) => malformedArchiveValues.get(key) ?? null,
      setItem: (key, value) => malformedArchiveValues.set(key, value),
      removeItem: (key) => malformedArchiveValues.delete(key),
    };
    const malformedArchive = readStorageCorruptions(malformedArchiveStorage);
    const malformedArchiveProtection = {
      visible: malformedArchive.length === 1 && malformedArchive[0].key === STORAGE_CORRUPTION_KEY,
      rawRetained: malformedArchive[0]?.raw === "{not-an-archive",
    };
    clearStorageCorruption(malformedArchiveStorage, STORAGE_CORRUPTION_KEY);
    malformedArchiveProtection.clearedOnlyAfterExplicitRequest = !malformedArchiveValues.has(STORAGE_CORRUPTION_KEY);
    localStorage.clear();
    localStorage.setItem(STORAGE_CORRUPTION_KEY, "{not-an-archive");
    let malformedArchiveExportError = "";
    try { await store.exportBackup(); } catch (error) { malformedArchiveExportError = error.message; }
    malformedArchiveProtection.exportBlocked = /阻止写入或导出/.test(malformedArchiveExportError);

    const input = (({ id, createdAt, updatedAt, ...rest }) => rest)(fixture);
    const badEntry = { ...fixture, id: "codex-damaged-row", rating: "damaged-rating", content: "坏行原文：仍可抢救" };
    const entryRaw = JSON.stringify([fixture, badEntry]);
    localStorage.clear();
    localStorage.setItem(keys.entries, entryRaw);
    const readableEntries = await store.listEntries();
    const entryBefore = localStorage.getItem(keys.entries);
    const entryCorruption = readStorageCorruptions(localStorage).find((item) => item.key === keys.entries);
    const operationErrors = {};
    for (const [name, operation] of Object.entries({
      create: () => store.createEntry(input),
      update: () => store.updateEntry(fixture.id, input),
      delete: () => store.deleteEntry(fixture.id),
      jsonExport: () => store.exportBackup(),
      textExport: () => store.exportTxt(),
      csvExport: () => store.exportCsv(),
    })) {
      try { await operation(); } catch (error) { operationErrors[name] = error.message; }
    }
    const entriesAfter = localStorage.getItem(keys.entries);
    const damagedEntryProtection = {
      readableCount: readableEntries.length,
      sourceUnchanged: entryBefore === entriesAfter && entriesAfter === entryRaw,
      rawRetained: entryCorruption?.raw === entryRaw,
      operationErrors,
    };

    const badCover = { dataUrl: "坏封面数组行原文" };
    const coverRaw = JSON.stringify([badCover]);
    localStorage.clear();
    localStorage.setItem(keys.entries, JSON.stringify([fixture]));
    localStorage.setItem(keys.covers, coverRaw);
    const readableCover = await store.getCover("album", { albumName: "错误封面" });
    const coverBefore = localStorage.getItem(keys.covers);
    const coverCorruption = readStorageCorruptions(localStorage).find((item) => item.key === keys.covers);
    const coverOperationErrors = {};
    for (const [name, operation] of Object.entries({
      create: () => store.createEntry(input),
      update: () => store.updateEntry(fixture.id, input),
      delete: () => store.deleteEntry(fixture.id),
      jsonExport: () => store.exportBackup(),
      textExport: () => store.exportTxt(),
      csvExport: () => store.exportCsv(),
    })) {
      try { await operation(); } catch (error) { coverOperationErrors[name] = error.message; }
    }
    const coverAfter = localStorage.getItem(keys.covers);
    const damagedCoverProtection = {
      readable: readableCover,
      sourceUnchanged: coverBefore === coverAfter && coverAfter === coverRaw,
      rawRetained: coverCorruption?.raw === coverRaw,
      operationErrors: coverOperationErrors,
    };

    const multiCollectionRaw = {
      entries: JSON.stringify([fixture, badEntry]),
      summaries: JSON.stringify([{ damaged: "summary-raw" }]),
      monthlySummaries: JSON.stringify([{ damaged: "monthly-summary-raw" }]),
      covers: coverRaw,
      listeningMoments: JSON.stringify([{ damaged: "listening-moment-raw" }]),
      appData: JSON.stringify({ damaged: 42 }),
    };
    localStorage.clear();
    for (const [name, raw] of Object.entries(multiCollectionRaw)) localStorage.setItem(keys[name], raw);
    let multiCollectionError = "";
    try { await store.exportBackup(); } catch (error) { multiCollectionError = error.message; }
    const multiCollectionArchive = readStorageCorruptions(localStorage);
    const multiCollectionProtection = {
      allCollections: Object.keys(multiCollectionRaw).every((name) => multiCollectionArchive.some((item) => item.key === keys[name] && item.raw === multiCollectionRaw[name])),
      sourceUnchanged: Object.entries(multiCollectionRaw).every(([name, raw]) => localStorage.getItem(keys[name]) === raw),
      keys: multiCollectionArchive.map((item) => item.key),
      error: multiCollectionError,
    };

    const multiMalformedRaw = {
      entries: "{entries-invalid-json",
      summaries: "{summaries-invalid-json",
    };
    localStorage.clear();
    for (const [name, raw] of Object.entries(multiMalformedRaw)) localStorage.setItem(keys[name], raw);
    let multiMalformedError = "";
    try { await store.exportBackup(); } catch (error) { multiMalformedError = error.message; }
    const multiMalformedArchive = readStorageCorruptions(localStorage);
    const multiMalformedCollectionProtection = {
      bothRetained: Object.entries(multiMalformedRaw).every(([name, raw]) => multiMalformedArchive.some((item) => item.key === keys[name] && item.raw === raw)),
      sourceRemovedAfterIsolation: Object.keys(multiMalformedRaw).every((name) => localStorage.getItem(keys[name]) === null),
      keys: multiMalformedArchive.map((item) => item.key),
      error: multiMalformedError,
    };

    const tolerantCollections = {};
    for (const [name, key, read] of [
      ["summaries", keys.summaries, () => store.getSummary(2026)],
      ["monthlySummaries", keys.monthlySummaries, () => store.listMonthlySummaries()],
      ["listeningMoments", keys.listeningMoments, () => store.listListeningMoments()],
    ]) {
      localStorage.clear();
      const raw = JSON.stringify([{ damaged: `${name}-raw`, content: "原文保留" }]);
      localStorage.setItem(key, raw);
      const readable = await read();
      const archiveEntry = readStorageCorruptions(localStorage).find((item) => item.key === key);
      let writeError = "";
      try { await store.createEntry(input); } catch (error) { writeError = error.message; }
      tolerantCollections[name] = {
        readableCount: Array.isArray(readable) ? readable.length : readable ? 1 : 0,
        sourceUnchanged: localStorage.getItem(key) === raw,
        rawRetained: archiveEntry?.raw === raw,
        writeBlocked: !!writeError,
      };
    }

    const structuralCases = [
      ["entries", keys.entries, () => store.listEntries()],
      ["summaries", keys.summaries, () => store.getSummary(2026)],
      ["monthlySummaries", keys.monthlySummaries, () => store.listMonthlySummaries()],
      ["covers", keys.covers, () => store.getCover("album", { albumName: "错误集合" })],
      ["listeningMoments", keys.listeningMoments, () => store.listListeningMoments()],
      ["appData", keys.appData, () => store.getStoredAppData("any")],
    ];
    const structuralProtection = {};
    for (const [name, key, read] of structuralCases) {
      localStorage.clear();
      const raw = name === "appData" ? JSON.stringify({ invalid: 42 }) : JSON.stringify({ invalid: `${name}-mapping` });
      localStorage.setItem(key, raw);
      let error = "";
      try { await read(); } catch (caught) { error = caught.message; }
      structuralProtection[name] = {
        sourceUnchanged: localStorage.getItem(key) === raw,
        rawRetained: readStorageCorruptions(localStorage).some((item) => item.key === key && item.raw === raw),
        blocked: !!error,
        error,
      };
    }

    clearStorageCorruption(localStorage);
    return { isolation, setItemFailure, legacyCompatibility, occupiedSlot, malformedArchiveProtection, damagedEntryProtection, damagedCoverProtection, multiCollectionProtection, multiMalformedCollectionProtection, tolerantCollections, structuralProtection };
  }, makeJournalFixtures("6")[0]);

  assert.deepEqual(result.isolation.items, [{ key: "broken-one", raw: "{one" }, { key: "broken-two", raw: "{two" }]);
  assert.equal(result.isolation.originalOne, null);
  assert.equal(result.isolation.originalTwo, null);
  assert.equal(result.setItemFailure.sourceRetained, true);
  assert.equal(result.setItemFailure.archiveAbsent, true);
  assert.match(result.setItemFailure.error, /隔离副本保存失败/);
  assert.deepEqual(result.legacyCompatibility.items, [{ key: "legacy-old", raw: "{old" }, { key: "legacy-new", raw: "{new" }]);
  assert.equal(result.legacyCompatibility.sourceRemovedAfterAppend, true);
  assert.equal(result.occupiedSlot.sourceRetained, true);
  assert.equal(result.occupiedSlot.priorRawRetained, true);
  assert.match(result.occupiedSlot.error, /未覆盖已有原文/);
  assert.equal(result.malformedArchiveProtection.visible, true);
  assert.equal(result.malformedArchiveProtection.rawRetained, true);
  assert.equal(result.malformedArchiveProtection.clearedOnlyAfterExplicitRequest, true);
  assert.equal(result.malformedArchiveProtection.exportBlocked, true);
  assert.equal(result.damagedEntryProtection.readableCount, 1);
  assert.equal(result.damagedEntryProtection.sourceUnchanged, true);
  assert.equal(result.damagedEntryProtection.rawRetained, true);
  for (const name of ["create", "update", "delete", "jsonExport", "textExport", "csvExport"]) assert.match(result.damagedEntryProtection.operationErrors[name], /阻止写入或导出/);
  assert.equal(result.damagedCoverProtection.readable, null);
  assert.equal(result.damagedCoverProtection.sourceUnchanged, true);
  assert.equal(result.damagedCoverProtection.rawRetained, true);
  for (const name of ["create", "update", "delete", "jsonExport", "textExport", "csvExport"]) assert.match(result.damagedCoverProtection.operationErrors[name], /阻止写入或导出/);
  assert.equal(result.multiCollectionProtection.allCollections, true);
  assert.equal(result.multiCollectionProtection.sourceUnchanged, true);
  assert.match(result.multiCollectionProtection.error, /阻止写入或导出/);
  assert.equal(new Set(result.multiCollectionProtection.keys).size, 6);
  assert.equal(result.multiMalformedCollectionProtection.bothRetained, true);
  assert.equal(result.multiMalformedCollectionProtection.sourceRemovedAfterIsolation, true);
  assert.match(result.multiMalformedCollectionProtection.error, /阻止写入或导出/);
  assert.deepEqual(new Set(result.multiMalformedCollectionProtection.keys), new Set(["music-feelings-mobile-entries", "music-feelings-mobile-summaries"]));
  for (const collection of Object.values(result.tolerantCollections)) {
    assert.equal(collection.readableCount, 0);
    assert.equal(collection.sourceUnchanged, true);
    assert.equal(collection.rawRetained, true);
    assert.equal(collection.writeBlocked, true);
  }
  for (const protection of Object.values(result.structuralProtection)) {
    assert.equal(protection.sourceUnchanged, true);
    assert.equal(protection.rawRetained, true);
    assert.equal(protection.blocked, true);
    assert.match(protection.error, /结构无效/);
  }
  const raw = JSON.stringify([makeJournalFixtures("6")[0], { invalid: true }]);
  await page.evaluate(raw => {
    localStorage.clear();
    localStorage.setItem('music-feelings-mobile-entries', raw);
  }, raw);
  await page.goto(`${origin}/#/timeline`);
  await page.getByRole('alert').filter({ hasText: '当前显示可能不完整' }).waitFor();
  await page.getByRole('link', { name: '前往备份页抢救原文', exact: true }).click();
  await page.locator('.corruption-card textarea').waitFor();
  assert.equal(await page.locator('.corruption-card textarea').inputValue(), raw);
  assert.equal(await page.evaluate(() => localStorage.getItem('music-feelings-mobile-entries')), raw);
  result.recoveryUi = { incompleteNotice: true, rawVisible: true, originalPreserved: true };
} finally {
  await browser.close();
}

const payload = { passed: true, ...result };
if (output) {
  await mkdir(output, { recursive: true });
  await writeFile(join(output, "codex_storage_integrity.json"), JSON.stringify(payload, null, 2));
}
console.log(JSON.stringify(payload));
