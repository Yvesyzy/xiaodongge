import { mkdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { makeJournalFixtures } from '../mobile/codex_journal_fixtures.mjs';
import { qaOptions } from './codex_qa_options.mjs';

const { origin, output: outputDirectory } = qaOptions({ output: 'release/codex_qa/native_export_ui' });
const evidence = { version: 1, origin, checks: [], calls: [], backupHealthBefore: null, backupHealthAfter: null };
const browser = await chromium.launch({ headless: true, channel: 'chrome' });
let activePage = null;

try {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  activePage = page;
  page.setDefaultTimeout(15000);
  await page.addInitScript(() => {
    window.codexExportCalls = [];
    window.codexExportMode = 'cancelled';
    window.Capacitor = {
      PluginHeaders: [{ name: 'NativeExport', methods: ['stageFile', 'saveFiles', 'shareFiles', 'saveFile', 'shareFile'].map(name => ({ name, rtype: 'promise' })) }],
      isNativePlatform: () => false,
      nativePromise: async (plugin, method, options) => {
        window.codexExportCalls.push({ plugin, method, options });
        if (window.codexExportDelay) await new Promise(resolve => setTimeout(resolve, window.codexExportDelay));
        if (method === 'stageFile') return { token: 'staged-' + options.fileName };
        if (method === 'saveFiles') return window.codexExportMode === 'partial'
          ? { status: 'partial', saved: [options.tokens[0]], error: '模拟文件夹写入失败' }
          : { status: 'cancelled', saved: [] };
        if (method === 'shareFiles') return { status: 'opened' };
        if (method === 'saveFile') {
          if (window.codexExportMode === 'failure') throw new Error('模拟输出流关闭失败');
          return window.codexExportMode === 'cancelled' ? { status: 'cancelled' } : { status: 'saved', uri: 'content://codex/saved' };
        }
        if (method === 'shareFile') {
          if (window.codexExportMode === 'share-failure') throw new Error('模拟分享失败');
          if (window.codexExportMode === 'share-cancelled') throw new DOMException('模拟取消分享', 'AbortError');
          return { status: 'opened' };
        }
        throw new Error('Unexpected bridge call ' + plugin + '.' + method);
      },
    };
  });

  await page.goto(origin);
  await page.evaluate(entries => localStorage.setItem('music-feelings-mobile-entries', JSON.stringify(entries)), makeJournalFixtures('128'));
  await page.goto(origin + '/#/summary?year=2026&view=overview');
  await page.getByRole('button', { name: '保存全年记录索引' }).waitFor();
  await page.evaluate(async () => {
    const { store } = await import('/src/store.ts');
    store.getCover = async () => null;
    window.Capacitor.isNativePlatform = () => true;
  });
  await page.getByRole('button', { name: '保存全年记录索引' }).click();
  await page.locator('.journal-export-preview').waitFor();
  await page.getByLabel('选择第 2 页', { exact: true }).check();
  await page.getByRole('button', { name: '保存所选 2 页', exact: true }).click();
  await page.getByText('已取消保存，所选页面仍可重试', { exact: true }).waitFor();
  assert.match(await page.locator('.journal-export-footer').innerText(), /已保存 0 \/ 15 页/);
  await page.evaluate(() => { window.codexExportMode = 'partial'; });
  await page.getByRole('button', { name: '保存所选 2 页', exact: true }).click();
  await page.getByText('已保存 1 / 2 页', { exact: true }).waitFor();
  await page.getByRole('alert').filter({ hasText: '模拟文件夹写入失败' }).waitFor();
  await page.getByRole('button', { name: '选择未保存页' }).click();
  assert.equal(await page.getByLabel('选择第 1 页', { exact: true }).isChecked(), false);
  assert.match(await page.locator('.journal-export-footer').innerText(), /已选 14 页/);
  await page.getByRole('button', { name: '系统分享', exact: true }).click();
  await page.getByText('已打开系统分享 · 本批 9 页', { exact: true }).waitFor();
  await page.getByLabel('分享批次').selectOption('1');
  await page.getByRole('button', { name: '系统分享', exact: true }).click();
  await page.getByText('已打开系统分享 · 本批 5 页', { exact: true }).waitFor();
  const journalCalls = await page.evaluate(() => window.codexExportCalls.map(call => ({ method: call.method, count: call.options.tokens?.length, encoding: call.options.encoding, signature: call.options.content?.slice(0, 12) })));
  assert.deepEqual(journalCalls.filter(call => call.method === 'shareFiles').map(call => call.count), [9, 5]);
  assert.ok(journalCalls.filter(call => call.method === 'stageFile').every(call => call.encoding === 'base64' && call.signature.startsWith('iVBORw0KGgo')));
  evidence.checks.push('yearbook cancellation, partial save mapping, retry selection, and 9+5 share batches');

  const entry = { ...makeJournalFixtures('1')[0], id: 'codex-relisten-entry', type: 'song', title: '同日重听测试', songName: '同日重听歌曲', albumName: '同日重听专辑' };
  const moments = [
    { id: 'codex-moment-a', entryId: entry.id, listenedAt: '2026-09-17T08:00:00.000Z', rating: 7, ratingModifier: null, moods: ['平静'], content: '第一次重听', createdAt: '2026-09-17T08:00:00.000Z', updatedAt: '2026-09-17T08:00:00.000Z' },
    { id: 'codex-moment-b', entryId: entry.id, listenedAt: '2026-09-17T12:00:00.000Z', rating: 8, ratingModifier: null, moods: ['明亮'], content: '第二次重听', createdAt: '2026-09-17T12:00:00.000Z', updatedAt: '2026-09-17T12:00:00.000Z' },
  ];
  const appDataKey = 'music-feelings-mobile-app-data';
  const backupHealthKey = 'backup-health:v1';
  const healthBefore = JSON.stringify({ [backupHealthKey]: 'codex-health-before-native-close-failure' });
  await page.evaluate(({ entry, moments, appDataKey, health }) => {
    window.Capacitor.isNativePlatform = () => false;
    localStorage.setItem('music-feelings-mobile-entries', JSON.stringify([entry]));
    localStorage.setItem('music-feelings-mobile-listening-moments', JSON.stringify(moments));
    localStorage.setItem(appDataKey, health);
    window.codexExportCalls = [];
  }, { entry, moments, appDataKey, health: healthBefore });

  await page.goto(origin + '/#/relisten/' + entry.id + '?moment=' + moments[0].id);
  await page.getByRole('button', { name: '保存重听对比卡' }).or(page.getByRole('button', { name: '下载重听对比卡' })).waitFor();
  await page.evaluate(() => { window.Capacitor.isNativePlatform = () => true; });
  await page.getByLabel('隐藏日期').click();
  await page.evaluate(() => { window.codexExportMode = 'cancelled'; });
  const saveButton = page.getByRole('button', { name: '保存重听对比卡' });
  await saveButton.click();
  await page.getByText('已取消保存重听对比卡', { exact: true }).waitFor();
  await page.evaluate(() => { window.codexExportMode = 'failure'; });
  await saveButton.click();
  await page.getByText('模拟输出流关闭失败', { exact: true }).waitFor();
  assert.equal(await page.getByText('已取消保存重听对比卡', { exact: true }).count(), 0, 'failed save must clear the previous cancellation message');
  await page.evaluate(() => { window.codexExportMode = 'saved'; });
  await saveButton.click();
  await page.getByText(/已保存重听对比卡：xiaodongge-relisten-\d{8}-codex-moment-a\.png/).waitFor();

  // The native bridge mode is only a browser-test mock. Reset it before a hash-only
  // navigation so the page reload reads the web fixture instead of opening SQLite.
  await page.evaluate(() => { window.Capacitor.isNativePlatform = () => false; });
  await page.goto(origin + '/#/relisten/' + entry.id + '?moment=' + moments[1].id);
  await page.locator('.relisten-quotes blockquote').filter({ hasText: '第二次重听' }).waitFor();
  await page.getByRole('button', { name: '保存重听对比卡' }).or(page.getByRole('button', { name: '下载重听对比卡' })).waitFor();
  await page.evaluate(() => { window.Capacitor.isNativePlatform = () => true; window.codexExportMode = 'saved'; });
  await page.getByLabel('隐藏日期').click();
  const secondSave = page.getByRole('button', { name: '保存重听对比卡' });
  const beforeDuplicateClick = await page.evaluate(() => window.codexExportCalls.length);
  await page.evaluate(() => { window.codexExportDelay = 100; });
  await secondSave.evaluate(button => { button.click(); button.click(); });
  await page.getByText(/已保存重听对比卡：xiaodongge-relisten-\d{8}-codex-moment-b\.png/).waitFor();
  await page.waitForTimeout(150);
  const afterDuplicateClick = await page.evaluate(() => window.codexExportCalls.length);
  assert.equal(afterDuplicateClick - beforeDuplicateClick, 1, 'duplicate clicks must issue one bridge call');
  await page.evaluate(() => { window.codexExportMode = 'share-cancelled'; });
  await page.getByRole('button', { name: '系统分享', exact: true }).click();
  await page.getByText('已取消分享，当前设置已保留', { exact: true }).waitFor();
  await page.evaluate(() => { window.codexExportMode = 'opened'; });
  await page.getByRole('button', { name: '系统分享', exact: true }).click();
  await page.getByText('已打开系统分享，可发送这张重听对比卡', { exact: true }).waitFor();
  const relistenCalls = await page.evaluate(() => window.codexExportCalls
    .filter(call => call.method === 'saveFile' || call.method === 'shareFile')
    .map(call => ({ method: call.method, fileName: call.options.fileName, encoding: call.options.encoding, mimeType: call.options.mimeType })));
  const saveNames = relistenCalls.filter(call => call.method === 'saveFile').map(call => call.fileName);
  assert.ok(saveNames.some(name => name.endsWith('-codex-moment-a.png')));
  assert.ok(saveNames.some(name => name.endsWith('-codex-moment-b.png')));
  assert.notEqual(saveNames.find(name => name.endsWith('-codex-moment-a.png')), saveNames.find(name => name.endsWith('-codex-moment-b.png')));
  assert.ok(relistenCalls.filter(call => call.method === 'shareFile').every(call => call.encoding === 'base64' && call.mimeType === 'image/png'));
  evidence.checks.push('same-day relisten filenames, cancellation, failure, retry, share cancellation, and share success');

  await page.evaluate(() => { window.Capacitor.isNativePlatform = () => false; });
  await page.goto(origin + '/#/backup');
  await page.getByRole('button', { name: '导出 JSON', exact: true }).click();
  await page.getByText('导出的 JSON', { exact: true }).waitFor();
  await page.evaluate(() => { window.Capacitor.isNativePlatform = () => true; window.codexExportMode = 'failure'; });
  await page.getByRole('button', { name: '保存到文件夹', exact: true }).click();
  await page.getByRole('alert').filter({ hasText: '模拟输出流关闭失败' }).waitFor();
  const healthAfter = await page.evaluate(({ appDataKey }) => localStorage.getItem(appDataKey), { appDataKey });
  evidence.backupHealthBefore = healthBefore;
  evidence.backupHealthAfter = healthAfter;
  assert.equal(healthAfter, healthBefore, 'native save rejection must not update backup health');
  evidence.checks.push('backup health remains unchanged after native save rejection');

  evidence.calls = await page.evaluate(() => window.codexExportCalls.map(call => ({ method: call.method, fileName: call.options?.fileName, count: call.options?.tokens?.length, encoding: call.options?.encoding, mimeType: call.options?.mimeType })));
  console.log('PASS: native export bridge cancellation, failure/retry, backup-health guard, same-day relisten filenames, and save/share flows. Android system UI itself is not exercised.');
} catch (error) {
  evidence.error = error instanceof Error ? error.stack ?? error.message : String(error);
  if (activePage) {
    evidence.debug = await activePage.evaluate(() => ({
      url: location.href,
      body: document.body.innerText,
      calls: window.codexExportCalls.map(call => ({
        plugin: call.plugin,
        method: call.method,
        fileName: call.options?.fileName,
        count: call.options?.tokens?.length,
        encoding: call.options?.encoding,
        mimeType: call.options?.mimeType,
        contentLength: typeof call.options?.content === 'string' ? call.options.content.length : undefined,
        contentPrefix: typeof call.options?.content === 'string' ? call.options.content.slice(0, 12) : undefined,
      })),
    }));
  }
  throw error;
} finally {
  await browser.close();
  const target = resolve(join(outputDirectory, 'codex_check_native_export_ui.json'));
  await mkdir(outputDirectory, { recursive: true });
  await writeFile(target, JSON.stringify(evidence, null, 2) + '\n', 'utf8');
}
