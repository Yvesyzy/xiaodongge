import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { makeJournalFixtures } from '../mobile/codex_journal_fixtures.mjs';
const browser = await chromium.launch({ headless: true, channel: 'chrome' });
try {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  page.setDefaultTimeout(15000);
  await page.addInitScript(() => {
    window.codexExportCalls = []; window.codexExportMode = 'cancelled';
    window.Capacitor = {
      PluginHeaders: [{ name: 'NativeExport', methods: ['stageFile', 'saveFiles', 'shareFiles', 'saveFile', 'shareFile'].map(name => ({ name, rtype: 'promise' })) }],
      nativePromise: async (plugin, method, options) => {
        window.codexExportCalls.push({ method, options });
        if (method === 'stageFile') return { token: 'staged-' + options.fileName };
        if (method === 'saveFiles') return window.codexExportMode === 'partial' ? { status: 'partial', saved: [options.tokens[0]], error: '模拟文件夹写入失败' } : { status: 'cancelled', saved: [] };
        if (method === 'shareFiles') return { status: 'opened' };
        if (method === 'saveFile') return { status: 'cancelled' };
        throw new Error('Unexpected bridge call ' + plugin + '.' + method);
      }
    };
  });
  await page.goto('http://127.0.0.1:5173');
  await page.evaluate(entries => localStorage.setItem('music-feelings-mobile-entries', JSON.stringify(entries)), makeJournalFixtures('128'));
  await page.goto('http://127.0.0.1:5173/#/summary?year=2026&view=overview');
  await page.getByRole('button', { name: '保存全年记录索引' }).waitFor();
  await page.evaluate(async () => {
    const { store } = await import('/src/store.ts'); store.getCover = async () => null;
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
  const calls = await page.evaluate(() => window.codexExportCalls.map(c => ({ method: c.method, count: c.options.tokens?.length, encoding: c.options.encoding, signature: c.options.content?.slice(0, 12) })));
  assert.deepEqual(calls.filter(c => c.method === 'shareFiles').map(c => c.count), [9, 5]);
  assert.ok(calls.filter(c => c.method === 'stageFile').every(c => c.encoding === 'base64' && c.signature.startsWith('iVBORw0KGgo')));
  console.log('PASS: simulated native bridge cancellation, partial saved-page mapping, retry selection, PNG staging, 9+5 multi-image batches. Android system UI itself is not exercised.');
} finally { await browser.close(); }
