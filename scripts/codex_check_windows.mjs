import assert from 'node:assert/strict';
import { cp, mkdir, readFile, writeFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { _electron as electron } from 'playwright';
import { demoCover, makeJournalFixtures } from '../mobile/codex_journal_fixtures.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const output = path.join(root, 'release', `codex_windows_qa_${Date.now()}`);
const profile = path.join(output, 'profile');
const executablePath = process.argv[2] ? path.resolve(process.argv[2]) : require('electron');
const launchArguments = [...(process.argv[2] ? [] : [root]), `--codex-profile=${profile}`];
await mkdir(output, { recursive: true });
const errors = [];
let application;
let page;
const checks = [];
const layouts = [];
const tables = ['ReviewEntry', 'ListeningMoment', 'YearlySummary', 'MonthlySummary', 'CoverImage', 'AppData', 'UndoBackup'];

async function launch({ executable = executablePath, offline = false } = {}) {
  application = await electron.launch({ executablePath: executable, args: launchArguments, cwd: root, timeout: 30000 });
  if (offline) {
    await application.evaluate(({ session }) => {
      session.defaultSession.webRequest.onBeforeRequest({ urls: ['http://*/*', 'https://*/*'] }, (_request, callback) => callback({ cancel: true }));
    });
    await application.context().setOffline(true);
  }
  page = await application.firstWindow();
  page.setDefaultTimeout(15000);
  page.on('pageerror', error => errors.push(error.message));
  page.on('dialog', dialog => {
    // Electron owns the native close warning; Playwright handles only this profile's UI confirmations.
    if (dialog.type() !== 'beforeunload') void dialog.accept().catch(error => errors.push(error.message));
  });
  await page.waitForSelector('.desktop-app-shell', { timeout: 30000 });
}

async function navigate(route) {
  await page.evaluate(route => { location.hash = route; }, route);
}

async function snapshot() {
  return page.evaluate(async tables => {
    const plugin = window.CapacitorCustomPlatform.plugins.CapacitorSQLite;
    const data = {};
    for (const table of tables) data[table] = (await plugin.query({ database: 'music_feelings_archive',
      statement: `SELECT * FROM ${table}`, values: [], readonly: false })).values.map(row => JSON.stringify(row)).sort();
    return { data, drafts: Object.fromEntries(Object.keys(localStorage).filter(key => key.startsWith('music-feelings-entry-draft:v1:'))
      .sort().map(key => [key, localStorage.getItem(key)])) };
  }, tables);
}

async function captureWindow(file) {
  // Electron captures the actual Windows surface; Playwright viewport capture crops it at high display DPI.
  const data = await application.evaluate(async ({ BrowserWindow }) => (await BrowserWindow.getAllWindows()[0].webContents.capturePage()).toPNG().toString('base64'));
  await writeFile(path.join(output, file), Buffer.from(data, 'base64'));
}

async function exportBackup() {
  await navigate('/backup');
  await page.getByRole('heading', { name: '备份', exact: true }).waitFor();
  const textarea = page.locator('section.form-card').filter({ has: page.getByText('导出的 JSON', { exact: true }) }).locator('textarea');
  const previous = await textarea.count() ? await textarea.inputValue() : null;
  await page.getByRole('button', { name: '导出 JSON', exact: true }).click();
  await page.waitForFunction(previous => {
    const section = [...document.querySelectorAll('section.form-card')].find(section => section.querySelector('strong')?.textContent === '导出的 JSON');
    const field = section?.querySelector('textarea');
    return field && field.value !== previous;
  }, previous);
  return JSON.parse(await textarea.inputValue());
}

async function rehearse(payload) {
  await page.getByLabel('粘贴备份 JSON').fill(JSON.stringify(payload));
  await page.getByRole('button', { name: '预演恢复并查看差异', exact: true }).click();
  await page.getByText('Windows 隔离数据库恢复与回读通过', { exact: true }).waitFor();
}

async function importPayload(payload) {
  await rehearse(payload);
  await page.getByRole('button', { name: '导入并覆盖当前数据', exact: true }).click();
  await page.getByText(/导入完成：/).waitFor();
}

async function restoreUndo() {
  await page.getByRole('button', { name: '撤销上次导入', exact: true }).click();
  await page.getByText('已撤销上次导入', { exact: true }).waitFor();
}

try {
  await launch();
  assert.equal(await page.evaluate(() => window.CapacitorCustomPlatform?.name), 'electron');
  assert.equal(await page.evaluate(() => typeof window.require), 'undefined');
  assert.equal(await page.locator('.bottom-nav').count(), 0);
  assert.equal(await application.evaluate(({ BrowserWindow }) => {
    const preferences = BrowserWindow.getAllWindows()[0].webContents.getLastWebPreferences();
    return preferences.contextIsolation && preferences.sandbox && !preferences.nodeIntegration;
  }), true);
  await page.screenshot({ path: path.join(output, 'codex_home_empty.png'), fullPage: true });
  checks.push('real Electron, native SQLite startup, custom platform, renderer sandbox and empty state');

  const coverDataUrl = await page.evaluate(demoCover);
  const coverPath = path.join(output, 'codex_synthetic_cover.png');
  await writeFile(coverPath, Buffer.from(coverDataUrl.split(',')[1], 'base64'));
  await navigate('/new');
  await page.locator('input[name="title"]').fill('codex Windows 正式乐评');
  await page.locator('input[name="artistName"]').fill('林间（合成验证）');
  await page.locator('input[name="albumName"]').fill('合成专辑');
  await page.getByLabel('选择封面图片', { exact: true }).setInputFiles(coverPath);
  await page.locator('textarea[name="content"]').fill("中文正文与引号 '、换行和 🎵\n\nWindows 本地记录保存验证。");
  await page.getByLabel('多维度评分（制作 / 词 / 曲 / 人声 / 原创性 / 共鸣）').check();
  for (const [label, value] of [['制作', 8], ['词', 7], ['曲', 9], ['人声', 8.5], ['原创性', 9], ['共鸣', 8]]) {
    const slider = page.getByRole('slider', { name: label, exact: true });
    await slider.press('End');
    for (let step = 0; step < (10 - value) * 2; step++) await slider.press('ArrowLeft');
    assert.equal(await slider.getAttribute('aria-valuenow'), String(value));
  }
  assert.equal(await page.locator('input[name="rating"]').inputValue(), '8.3');
  await page.getByRole('button', { name: '保存正式乐评', exact: true }).click();
  await page.waitForURL(/#\/entries\//);
  const savedId = new URL(page.url()).hash.split('/')[2].split('?')[0];
  let baseline = await exportBackup();
  assert.equal(baseline.version, 6);
  assert.equal(baseline.entries.length, 1);
  assert.equal(baseline.entries[0].rating, 8.3);
  assert.equal(baseline.entries[0].ratingSongwriting, null);
  assert.equal(baseline.entries[0].ratingComposition, 9);
  assert.match(baseline.entries[0].content, /🎵/u);
  assert.equal(baseline.covers.length, 1);
  assert.equal(baseline.covers[0].dataUrl.startsWith('data:image/jpeg;base64,'), true);
  checks.push('editor keyboard six ratings, one-decimal average, formal save and v6 export');

  await application.evaluate(({ dialog }) => { dialog.showSaveDialog = async () => ({ canceled: true, filePath: undefined }); });
  await page.getByRole('button', { name: '保存到文件夹', exact: true }).click();
  await page.getByText('已取消保存', { exact: true }).waitFor();
  assert.equal((await snapshot()).data.AppData.length, 0, 'Cancel must not claim a saved backup');
  const savedBackupPath = path.join(output, 'codex_saved_backup.json');
  await application.evaluate(({ dialog }, filePath) => { dialog.showSaveDialog = async () => ({ canceled: false, filePath }); }, savedBackupPath);
  await page.getByRole('button', { name: '保存到文件夹', exact: true }).click();
  await page.getByText(/文件已保存：/).waitFor();
  assert.equal(JSON.parse(await readFile(savedBackupPath, 'utf8')).entries[0].id, savedId);
  await page.getByRole('button', { name: '复制内容', exact: true }).click();
  assert.match(await application.evaluate(({ clipboard }) => clipboard.readText()), /codex Windows 正式乐评/);
  checks.push('native save cancellation, atomic file save, actual saved bytes and clipboard');

  const batchDirectory = path.join(output, 'codex_batch_export');
  await mkdir(batchDirectory);
  await writeFile(path.join(batchDirectory, 'codex_existing.txt'), 'original bytes');
  await application.evaluate(({ dialog }, directory) => {
    dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [directory] });
  }, batchDirectory);
  const partial = await page.evaluate(async () => {
    const plugin = window.CapacitorCustomPlatform.plugins.NativeExport;
    const first = await plugin.stageFile({ fileName: 'codex_first.txt', content: 'first bytes' });
    const second = await plugin.stageFile({ fileName: 'codex_existing.txt', content: 'replacement bytes' });
    return plugin.saveFiles({ tokens: [first.token, second.token] });
  });
  assert.equal(partial.status, 'partial');
  assert.deepEqual(partial.saved, ['codex_first.txt']);
  assert.equal(await readFile(path.join(batchDirectory, 'codex_existing.txt'), 'utf8'), 'original bytes');
  assert.equal(await readFile(path.join(batchDirectory, 'codex_first.txt'), 'utf8'), 'first bytes');
  checks.push('native batch collision reports partial save and preserves existing file bytes');

  await navigate('/new');
  await page.locator('input[name="title"]').fill('codex 关窗草稿');
  await page.locator('textarea[name="content"]').fill('关闭窗口前的最后一次输入。');
  await application.close();
  application = undefined;
  await launch();
  await navigate('/drafts');
  await page.getByRole('button', { name: /codex 关窗草稿/ }).click();
  assert.equal(await page.locator('textarea[name="content"]').inputValue(), '关闭窗口前的最后一次输入。');
  baseline = await exportBackup();
  assert.equal(baseline.entries[0].id, savedId);
  assert.equal(baseline.drafts.length, 1);
  checks.push('immediate close flushes draft, profile persistence and draft resume after restart');

  await navigate('/drafts');
  await page.getByRole('button', { name: /codex 关窗草稿/ }).click();
  await page.evaluate(() => {
    const original = Storage.prototype.setItem;
    window.__codexRestoreStorage = () => { Storage.prototype.setItem = original; };
    Storage.prototype.setItem = function(key, value) {
      if (key.startsWith('music-feelings-entry-draft:v1:')) throw new DOMException('codex QA quota', 'QuotaExceededError');
      return original.call(this, key, value);
    };
  });
  await page.locator('textarea[name="content"]').fill('保存失败时仍应保留在编辑页的最后输入。');
  await page.getByText('本地存储已满，草稿未保存。请在设置页导出备份后清理旧记录', { exact: true }).waitFor();
  await page.getByRole('link', { name: '首页', exact: true }).click();
  assert.match(page.url(), /#\/new/);
  const closePrompt = await application.evaluate(({ BrowserWindow, dialog }) => new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Close protection did not show its native warning')), 5000);
    dialog.showMessageBoxSync = (_window, options) => { clearTimeout(timer); resolve(options); return 0; };
    BrowserWindow.getAllWindows()[0].close();
  }));
  assert.equal(closePrompt.defaultId, 0);
  assert.equal(closePrompt.buttons[0], '继续编辑');
  assert.equal(await page.locator('textarea[name="content"]').inputValue(), '保存失败时仍应保留在编辑页的最后输入。');
  await page.evaluate(() => { window.__codexRestoreStorage(); delete window.__codexRestoreStorage; });
  await page.getByRole('button', { name: '保存草稿', exact: true }).click();
  await page.waitForURL(/#\/drafts/);
  baseline = await exportBackup();
  assert.equal(baseline.drafts.length, 1);
  checks.push('draft quota failure blocks sidebar navigation and native close; continuing editing preserves input');

  const fixtureEntries = makeJournalFixtures('6').slice(0, 3).map((entry, index) => ({ ...entry,
    id: `codex_windows_fixture_${index}`, title: ['海边的慢拍（合成）', '夜航日记（合成）', '沿途的风（合成）'][index], year: 2026,
  }));
  fixtureEntries[0] = { ...fixtureEntries[0], rating: 8.5, ratingModifier: '+', ratingProduction: 8,
    ratingSongwriting: 7.5, compositeRatingLocked: true };
  const date = new Date().toISOString();
  const coverEntry = fixtureEntries[0];
  const payload = { version: 6, exportedAt: date, entries: fixtureEntries,
    summaries: [{ id: 'codex_windows_yearly_legacy', year: 2026, title: '合成年报原文', content: '旧年报原文完整保留。',
      analysisJson: null, analysisVersion: null, sourceFingerprint: null, sourceEntryCount: 3,
      generatedAt: date, createdAt: date, updatedAt: date }],
    monthlySummaries: [], covers: [{ coverKey: JSON.stringify(['album', coverEntry.albumName ?? '', '', coverEntry.artistName ?? '']),
      kind: 'album', albumName: coverEntry.albumName, songName: null, artistName: coverEntry.artistName, dataUrl: coverDataUrl, updatedAt: date }],
    listeningMoments: [{ id: 'codex_windows_moment', entryId: coverEntry.id, listenedAt: date, rating: 9,
      ratingModifier: '-', moods: ['平静'], content: '再次收听的合成听感。', createdAt: date, updatedAt: date }],
    appData: { 'top-albums:2026': JSON.stringify({ albums: [{ albumName: coverEntry.albumName, artistName: coverEntry.artistName, note: '合成精选备注' }] }) }, drafts: [] };
  const beforePreview = await snapshot();
  await rehearse(payload);
  assert.deepEqual(await snapshot(), beforePreview, 'Rehearsal must not change main tables, drafts or undo');
  assert.equal((await readdir(path.join(profile, 'archive'))).some(name => name.includes('preview')), false);
  checks.push('actual native restore preview writes/readbacks memory SQLite and preserves main archive');

  for (let version = 1; version <= 6; version++) {
    const legacy = structuredClone(payload);
    legacy.version = version;
    if (version === 1) legacy.entries.forEach(entry => { delete entry.musicMetadata; });
    if (version < 3) { delete legacy.monthlySummaries; delete legacy.appData; }
    if (version < 4) delete legacy.listeningMoments;
    if (version < 6) delete legacy.drafts;
    await importPayload(legacy);
    const imported = await exportBackup();
    assert.equal(imported.entries.length, 3);
    assert.equal(imported.entries.find(entry => entry.id === 'codex_windows_fixture_0').ratingSongwriting, 7.5);
    assert.deepEqual(imported.covers, payload.covers);
    assert.equal(imported.summaries[0].content, payload.summaries[0].content);
    assert.deepEqual(imported.listeningMoments, version >= 4 ? payload.listeningMoments : []);
    if (version >= 3) assert.equal(imported.appData['top-albums:2026'], payload.appData['top-albums:2026']);
    assert.equal(imported.drafts.length, version < 6 ? 1 : 0, `v${version} draft replacement contract`);
    await restoreUndo();
    assert.equal((await exportBackup()).entries[0].id, savedId);
    assert.equal((await snapshot()).drafts[baseline.drafts[0].key], baseline.drafts[0].raw);
  }
  checks.push('v1-v6 import, old score preservation, absent/present drafts and undo to original raw draft');

  await rehearse(payload);
  const beforeFailure = await snapshot();
  await application.evaluate(({ app }, marker) => {
    const mainRequire = process.getBuiltinModule('module').createRequire(`${app.getAppPath()}/package.json`);
    const { CodexSQLite } = mainRequire('./desktop/codex_sqlite.cjs');
    const original = CodexSQLite.prototype.executeSet;
    CodexSQLite.prototype.executeSet = function(options) {
      const result = original.call(this, options);
      if (options.database === 'music_feelings_archive' && options.set.some(item => item.statement === 'DELETE FROM ReviewEntry')) {
        CodexSQLite.prototype.executeSet = original;
        throw new Error(marker);
      }
      return result;
    };
  }, 'codex QA failure after committed replacement');
  await page.getByRole('button', { name: '导入并覆盖当前数据', exact: true }).click();
  await page.getByText(/codex QA failure after committed replacement/).waitFor();
  assert.deepEqual(await snapshot(), beforeFailure, 'Failure after SQLite commit must roll back rows, drafts and undo');
  checks.push('fault after committed replacement rolls back tables, app data, raw drafts and undo snapshot');
  await application.close();
  application = undefined;
  await launch();
  assert.deepEqual(await snapshot(), beforeFailure, 'Restart must recover the retained restore barrier');
  checks.push('restart clears retained recovery barrier after verified rollback');

  const beforeCrashBackup = await exportBackup();
  const beforeCrash = await snapshot();
  await page.evaluate(async ({ backup, state }) => {
    const plugin = window.CapacitorCustomPlatform.plugins.CapacitorSQLite;
    const journal = { kind: 'codex-import-undo', version: 1, operation: 'import', phase: 'data-written',
      beforeBackup: JSON.stringify({ ...backup, drafts: [] }),
      beforeDrafts: Object.entries(state.drafts).map(([key, raw]) => ({ key, raw })),
      beforeAppData: Object.fromEntries(state.data.AppData.map(raw => { const row = JSON.parse(raw); return [row.key, row.value]; })),
      beforeUndo: state.data.UndoBackup.length ? JSON.parse(state.data.UndoBackup[0]).value : null };
    await plugin.run({ database: 'music_feelings_archive', statement: 'INSERT OR REPLACE INTO AppData (key, value) VALUES (?, ?)',
      values: ['codex-restore-journal:v1', JSON.stringify(journal)], readonly: false });
    await plugin.run({ database: 'music_feelings_archive', statement: 'UPDATE ReviewEntry SET content = ?',
      values: ['codex synthetic unfinished restore'], readonly: false });
    Object.keys(state.drafts).forEach(key => localStorage.removeItem(key));
    localStorage.setItem('music-feelings-restore-gate:v1', '1');
  }, { backup: beforeCrashBackup, state: beforeCrash });
  await application.close();
  application = undefined;
  await launch();
  assert.deepEqual(await snapshot(), beforeCrash, 'Native pending journal must recover original rows, covers, app data, drafts and undo at startup');
  checks.push('native data-written journal and damaged draft state recover original bytes at startup');
  await navigate('/backup');
  await page.getByRole('heading', { name: '备份', exact: true }).waitFor();

  await importPayload(payload);
  await navigate('/entries/codex_windows_fixture_0/edit');
  await page.locator('input[name="title"]').waitFor();
  assert.equal(await page.locator('input[name="rating"]').inputValue(), '8.5');
  assert.equal(await page.locator('input[name="ratingSongwriting"]').inputValue(), '7.5');
  await page.getByRole('button', { name: '保存正式乐评', exact: true }).click();
  await page.waitForURL(/#\/entries\/codex_windows_fixture_0(?:\?|$)/);
  const legacySaved = (await exportBackup()).entries.find(entry => entry.id === 'codex_windows_fixture_0');
  assert.equal(legacySaved.rating, 8.5);
  assert.equal(legacySaved.ratingModifier, '+');
  assert.equal(legacySaved.ratingSongwriting, 7.5);
  assert.equal(legacySaved.ratingLyrics, null);
  checks.push('legacy aggregate and separate songwriting score survive desktop editing without splitting');

  await navigate('/summary/2026/5');
  await page.getByRole('button', { name: '生成月度报告', exact: true }).click();
  await page.getByText('月度听感作品已保存', { exact: true }).waitFor();
  await navigate('/summary/analysis?year=2026');
  await page.getByRole('button', { name: '重新生成年度标本册', exact: true }).click();
  await page.getByText('年度私人听感标本册已保存', { exact: true }).waitFor();
  const fullBackup = await exportBackup();
  assert.ok(fullBackup.summaries[0].analysisJson);
  assert.ok(fullBackup.monthlySummaries.length > 0);
  const fullState = await snapshot();
  await importPayload(fullBackup);
  const roundTrip = await exportBackup();
  for (const key of ['entries', 'summaries', 'monthlySummaries', 'covers', 'listeningMoments', 'appData', 'drafts']) {
    assert.deepEqual(roundTrip[key], fullBackup[key], `Full backup ${key}`);
  }
  await restoreUndo();
  assert.deepEqual(await snapshot(), { ...fullState, data: { ...fullState.data, UndoBackup: [] } }, 'Successful undo restores data and consumes its one-use undo snapshot');
  checks.push('actual month/year generation and full v6 roundtrip preserve analysis, covers, relistens, selections and undo');

  const stress = structuredClone(fullBackup);
  stress.entries.push(...makeJournalFixtures('128').slice(0, 60));
  stress.entries.find(entry => entry.id === 'codex_windows_fixture_0').content = ('长正文包含中文、引号与 emoji 🎧。'.repeat(80) + '\n\n').repeat(8);
  await importPayload(stress);
  await navigate('/timeline?type=album&year=2026&q=合成&entry=codex_windows_fixture_0');
  await page.locator('.desktop-record-row').first().waitFor();
  assert.equal(await page.locator('.desktop-record-row').count(), 2);
  assert.equal(await page.getByRole('textbox', { name: '搜索记录', exact: true }).inputValue(), '合成');
  await page.locator('.desktop-filter-row select').nth(1).selectOption('all');
  await page.getByRole('textbox', { name: '搜索记录', exact: true }).fill('');
  await page.getByRole('button', { name: '执行搜索', exact: true }).click();
  await page.waitForFunction(() => document.querySelectorAll('.desktop-record-row').length > 30);
  await page.locator('.desktop-record-row').filter({ has: page.getByText('海边的慢拍（合成）', { exact: true }) }).click();
  await page.waitForURL(url => url.hash.includes('entry=codex_windows_fixture_0'));
  const listY = await page.locator('.desktop-archive-list').evaluate(element => { element.scrollTop = 250; return element.scrollTop; });
  assert.ok(listY >= 200);
  const archiveRoute = new URL(page.url()).hash;
  await page.getByRole('link', { name: '打开完整阅读', exact: true }).click();
  await page.locator('.codex-reader').waitFor();
  await page.keyboard.press('PageDown');
  await page.waitForFunction(() => window.scrollY > 160);
  await page.getByRole('button', { name: '← 返回', exact: true }).click();
  await page.waitForURL(url => url.hash === archiveRoute);
  await page.locator('.desktop-record-row').first().waitFor();
  assert.ok(Math.abs(await page.locator('.desktop-archive-list').evaluate(element => element.scrollTop) - listY) < 2);
  await page.getByRole('link', { name: '打开完整阅读', exact: true }).click();
  await page.getByRole('button', { name: '继续阅读', exact: true }).click();
  await page.waitForFunction(() => window.scrollY > 160);
  await exportBackup();
  await restoreUndo();
  checks.push('archive search/type/year, selected record and internal list scroll return; full reader resumes long content');

  await navigate('/diagnostics');
  await page.getByRole('heading', { name: '本机诊断', exact: true }).waitFor();
  await page.getByText(/已安装 Windows 包：/).waitFor();
  assert.match(await page.locator('pre').innerText(), /windows-/);
  assert.match(await page.locator('pre').innerText(), /Windows 媒体与 OCR：/);
  checks.push('Windows diagnostics and actual web build identifier');

  const nativeState = await page.evaluate(() => window.CapacitorCustomPlatform.plugins.NowPlaying.getCurrentTrack());
  assert.equal(nativeState.accessEnabled, true);
  const dataUrl = await page.evaluate(() => {
    const canvas = document.createElement('canvas'); canvas.width = 1200; canvas.height = 360;
    const context = canvas.getContext('2d'); context.fillStyle = '#fff'; context.fillRect(0, 0, 1200, 360);
    context.fillStyle = '#111'; context.font = 'bold 56px Arial';
    context.fillText('CODEX SYNTHETIC TITLE', 50, 110); context.fillText('SYNTHETIC ARTIST 2026', 50, 230);
    return canvas.toDataURL('image/png');
  });
  await writeFile(path.join(output, 'codex_ocr_fixture.png'), Buffer.from(dataUrl.split(',')[1], 'base64'));
  const recognized = await page.evaluate(dataUrl => window.CapacitorCustomPlatform.plugins.ScreenshotOcr.recognize({ dataUrl }), dataUrl);
  assert.equal(recognized.width, 1200);
  assert.equal(recognized.height, 360);
  assert.ok(recognized.lines.length >= 2 && recognized.lines.every(line => line.right > line.left && line.bottom > line.top));
  checks.push('real Windows media bridge and real OCR text/dimensions/boxes');

  for (const theme of ['light', 'dark']) {
    await navigate('/more');
    await page.getByRole('button', { name: theme === 'light' ? '浅色' : '深色', exact: true }).click();
    for (const [width, height] of [[1366, 768], [1920, 1080]]) {
      for (const scale of [1, 1.25, 1.5]) {
        await application.evaluate(({ BrowserWindow }, bounds) => {
          const window = BrowserWindow.getAllWindows()[0];
          window.setContentSize(bounds.width, bounds.height);
          window.webContents.setZoomFactor(bounds.scale);
        }, { width, height, scale });
        await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
        await navigate('/timeline?entry=codex_windows_fixture_0');
        await page.locator('.desktop-record-row').first().waitFor();
        await page.evaluate(() => document.fonts.ready);
        const layout = await page.evaluate(() => {
          const detail = document.querySelector('.desktop-archive-detail');
          return { viewport: innerWidth, scroll: document.documentElement.scrollWidth,
            detailWidth: detail.clientWidth, detailScroll: detail.scrollWidth,
            detailRight: detail.getBoundingClientRect().right, devicePixelRatio,
            theme: document.documentElement.dataset.theme, nav: getComputedStyle(document.querySelector('.desktop-nav')).display };
        });
        assert.ok(layout.scroll <= layout.viewport + 1, `overflow ${JSON.stringify({ width, height, scale, layout })}`);
        assert.equal(layout.theme, theme);
        assert.notEqual(layout.nav, 'none');
        assert.ok(layout.detailScroll <= layout.detailWidth + 1, `detail clipped ${JSON.stringify({ width, height, scale, layout })}`);
        assert.ok(layout.detailRight <= layout.viewport + 1, `detail outside window ${JSON.stringify(layout)}`);
        layouts.push({ width, height, scale, ...layout });
        await captureWindow(`codex_archive_${width}_${scale}_${theme}.png`);
        await navigate('/new');
        await page.locator('input[name="title"]').waitFor();
        const contrast = await page.locator('input[name="title"]').evaluate(element => {
          const color = getComputedStyle(element).color.match(/\d+/g).slice(0, 3).map(Number);
          const background = getComputedStyle(element).backgroundColor.match(/\d+/g).slice(0, 3).map(Number);
          const luminance = values => values.map(value => value / 255).map(value => value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4)
            .reduce((sum, value, index) => sum + value * [.2126, .7152, .0722][index], 0);
          const a = luminance(color), b = luminance(background);
          return (Math.max(a, b) + .05) / (Math.min(a, b) + .05);
        });
        assert.ok(contrast >= 4.5, `editor input contrast ${contrast} ${theme}`);
        if (width === 1366 && scale === 1) await page.screenshot({ path: path.join(output, `codex_editor_${theme}.png`), fullPage: true });
      }
    }
  }
  checks.push('1366x768 and 1920x1080 logical window matrix, 100/125/150 percent, light/dark, no horizontal overflow');
  await application.evaluate(({ BrowserWindow }) => {
    const window = BrowserWindow.getAllWindows()[0]; window.setContentSize(1366, 768); window.webContents.setZoomFactor(1);
  });
  await navigate('/new');
  await page.locator('textarea[name="content"]').waitFor();
  await page.screenshot({ path: path.join(output, 'codex_editor.png'), fullPage: true });
  await navigate('/');
  await page.locator('.desktop-home-record').first().waitFor();
  await page.screenshot({ path: path.join(output, 'codex_home_populated.png'), fullPage: true });
  if (process.argv[2]) {
    await navigate('/new');
    await page.locator('input[name="title"]').fill('codex 便携包搬移草稿');
    await page.locator('textarea[name="content"]').fill('打包后离线重开与移动目录保留这份草稿。');
    await page.getByRole('button', { name: '保存草稿', exact: true }).click();
    await page.waitForURL(/#\/drafts/);
    const beforeMove = await snapshot();
    await application.close();
    application = undefined;
    const moved = path.join(output, 'codex_moved_portable');
    await cp(path.dirname(executablePath), moved, { recursive: true });
    await launch({ executable: path.join(moved, path.basename(executablePath)), offline: true });
    await page.reload();
    await page.waitForSelector('.desktop-app-shell');
    assert.equal(await application.evaluate(({ app }) => app.getPath('userData')), profile);
    assert.deepEqual(await snapshot(), beforeMove);
    await navigate('/drafts');
    await page.getByRole('button', { name: /codex 便携包搬移草稿/ }).click();
    assert.equal(await page.locator('textarea[name="content"]').inputValue(), '打包后离线重开与移动目录保留这份草稿。');
    await page.getByRole('button', { name: '保存正式乐评', exact: true }).click();
    await page.waitForURL(/#\/entries\//);
    const offlineBackup = await exportBackup();
    assert.equal(offlineBackup.entries.length, 4);
    assert.equal(offlineBackup.covers.length, 1);
    assert.ok(offlineBackup.monthlySummaries.length > 0);
    await page.screenshot({ path: path.join(output, 'codex_packaged_offline_backup.png'), fullPage: true });
    checks.push('packaged executable folder move preserves archive, covers, reports, undo and raw draft; blocked HTTP/HTTPS cold reload and offline save/export pass');
  }
  assert.deepEqual(errors, []);
  const result = { status: 'passed', profile, output, checks, layouts, versions: await application.evaluate(() => process.versions) };
  await writeFile(path.join(output, 'codex_windows_checks.json'), JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result, null, 2));
} catch (error) {
  await writeFile(path.join(output, 'codex_windows_checks.json'), JSON.stringify({ status: 'failed', profile, output, checks,
    error: error.stack || String(error), pageErrors: errors }, null, 2));
  if (application) {
    const pages = application.windows();
    if (pages[0]) {
      await pages[0].screenshot({ path: path.join(output, 'codex_failure.png'), fullPage: true }).catch(() => undefined);
      console.error((await pages[0].locator('body').innerText().catch(() => '')).slice(0, 2000));
    }
  }
  console.error(errors);
  console.error(JSON.stringify({ status: 'failed', output, checks, error: String(error.message || error).slice(0, 1200),
    frames: String(error.stack || '').split('\n').filter(line => /^\s+at /.test(line)).slice(0, 8) }, null, 2));
  process.exitCode = 1;
} finally {
  await application?.close();
}
