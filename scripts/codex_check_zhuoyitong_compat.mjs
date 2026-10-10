import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';
import { createServer } from 'vite';
import { qaOptions, freeLoopbackPort } from './codex_qa_options.mjs';
import { makeJournalFixtures } from '../mobile/codex_journal_fixtures.mjs';

const qa = qaOptions({ output: 'release/codex_zhuoyitong_compat_20261009' });
const output = path.resolve(qa.output);
await mkdir(output, { recursive: true });
const policy = JSON.parse(await readFile('mobile/src/codex_privacy_policy.json', 'utf8'));
const server = process.argv.includes('--origin') ? null : await createServer({ configFile: path.resolve('mobile/vite.config.ts'),
  cacheDir: path.join(output, 'vite-cache'), server: { host: '127.0.0.1', port: await freeLoopbackPort(), strictPort: true, forwardConsole: false } });
await server?.listen();
const origin = server ? `http://127.0.0.1:${server.httpServer.address().port}` : qa.origin;
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const report = { passed: false, checks: [], limitations: ['Synthetic Android bridge and desktop Chrome; not a Zhuoyi/HarmonyOS device test.'] };
async function open(route, missingLocks = false) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, timezoneId: 'Asia/Shanghai' });
  await context.addInitScript(({ version, entries, missingLocks }) => {
    localStorage.setItem('music-feelings-mobile-entries', JSON.stringify(entries));
    if (missingLocks) Object.defineProperty(navigator, 'locks', { configurable: true, get: () => undefined });
    const methods = names => names.map(name => ({ name, rtype: 'promise' }));
    window.androidBridge = {};
    window.codexAdapterCalls = [];
    window.Capacitor = {
      PluginHeaders: [
        { name: 'CodexPrivacy', methods: methods(['getState', 'setConsent']) },
        { name: 'NativeExport', methods: methods(['saveFile', 'shareFile', 'copyText', 'saveImageToGallery']) },
        { name: 'NowPlaying', methods: methods(['getCurrentTrack', 'getDiagnostics']) },
        { name: 'SharedMusic', methods: [...methods(['consumePendingShare', 'removeListener']), { name: 'addListener', rtype: 'callback' }] },
        { name: 'CodexNavigation', methods: [...methods(['exitApp', 'removeListener']), { name: 'addListener', rtype: 'callback' }] },
      ],
      nativeCallback: () => 'codex-adapter-listener',
      nativePromise: async (plugin, method, options) => {
        window.Capacitor.isNativePlatform = () => false;
        if (plugin === 'CodexPrivacy') return { status: 'accepted', policyVersion: version };
        if (plugin === 'NowPlaying' && method === 'getCurrentTrack') return { accessEnabled: false };
        if (plugin === 'NativeExport') {
          window.codexAdapterCalls.push({ method, fileName: options.fileName, mimeType: options.mimeType, length: options.content?.length });
          if (method === 'copyText' && window.codexNativeCopyWorks) { window.codexCopied = options.text; return; }
          if (method === 'saveFile' && window.codexBadSaveResult) return { status: 'saved' };
          if (method === 'saveImageToGallery' && window.codexBadGalleryResult) return { status: 'saved' };
          if (method === 'saveImageToGallery' && !window.codexGalleryFails) return { status: 'saved', uri: 'content://synthetic/gallery/1' };
          throw new Error('合成环境：系统入口不可用');
        }
        return {};
      },
    };
  }, { version: policy.version, entries: makeJournalFixtures('6'), missingLocks });
  const page = await context.newPage();
  page.setDefaultTimeout(15000);
  await page.route('**/*', request => new URL(request.request().url()).origin === origin ? request.continue() : request.abort());
  await page.goto(`${origin}/#${route}`);
  await page.locator('.app-header').waitFor();
  return { context, page };
}
async function check(name, action) {
  try { await action(); report.checks.push({ name, passed: true }); console.log(`PASS ${name}`); }
  catch (error) { report.checks.push({ name, passed: false, error: String(error.stack ?? error) }); console.log(`FAIL ${name}: ${error.message}`); }
}
try {
  await check('copy fallback inside modal cleans temporary text and restores focus', async () => {
    const { context, page } = await open('/more');
    try {
      const copied = await page.evaluate(async () => {
        const { copyText } = await import('/src/nativeExport.ts');
        const modal = document.createElement('dialog');
        const button = document.createElement('button'); button.textContent = '复制检查'; modal.append(button); document.body.append(modal); modal.showModal(); button.focus();
        const original = document.execCommand;
        Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async () => { throw new Error('denied'); } } });
        document.execCommand = () => {
          const input = document.activeElement;
          if (input instanceof HTMLTextAreaElement && input.closest('dialog') === modal) { window.codexCopied = input.value; return true; }
          return false;
        };
        try {
          window.Capacitor.isNativePlatform = () => true;
          await copyText('合成备份原文 🎧');
          const success = { text: window.codexCopied, temporary: modal.querySelectorAll('textarea').length, focus: document.activeElement === button };
          document.execCommand = () => false;
          let rejected = false;
          try { await copyText('最终失败时不留原文副本'); } catch { rejected = true; }
          return { ...success, rejected, afterFailure: modal.querySelectorAll('textarea').length };
        } finally { document.execCommand = original; modal.close(); modal.remove(); }
      });
      assert.deepEqual(copied, { text: '合成备份原文 🎧', temporary: 0, focus: true, rejected: true, afterFailure: 0 });
    } finally { await context.close(); }
  });

  await check('missing system save/share preserves JSON and offers a working copy route', async () => {
    const { context, page } = await open('/backup');
    try {
      await page.getByRole('button', { name: '导出 JSON', exact: true }).click();
      const raw = await page.locator('textarea[readonly]').first().inputValue();
      for (const name of ['保存到文件夹', '系统分享']) {
        await page.evaluate(() => { window.Capacitor.isNativePlatform = () => true; });
        await page.getByRole('button', { name, exact: true }).click();
        await page.getByRole('alert').filter({ hasText: '系统入口不可用' }).waitFor();
        assert.equal(await page.locator('textarea[readonly]').first().inputValue(), raw);
      }
      const healthBefore = await page.evaluate(() => localStorage.getItem('music-feelings-mobile-app-data'));
      await page.evaluate(() => { window.Capacitor.isNativePlatform = () => true; window.codexBadSaveResult = true; });
      await page.getByRole('button', { name: '保存到文件夹', exact: true }).click();
      await page.getByRole('alert').filter({ hasText: '系统未确认文件保存' }).waitFor();
      assert.equal(await page.locator('textarea[readonly]').first().inputValue(), raw);
      assert.equal(await page.evaluate(() => localStorage.getItem('music-feelings-mobile-app-data')), healthBefore);
      await page.evaluate(() => {
        window.Capacitor.isNativePlatform = () => true;
        Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async text => { window.codexCopied = text; } } });
      });
      await page.getByRole('button', { name: '复制内容', exact: true }).click();
      await page.getByText('JSON 内容已复制', { exact: true }).waitFor();
      assert.equal(await page.evaluate(() => window.codexCopied), raw);
      assert.equal(await page.getByLabel('粘贴备份 JSON').count(), 1);
    } finally { await context.close(); }
  });

  await check('missing restore lock is explained before preview, export remains available', async () => {
    const { context, page } = await open('/backup', true);
    try {
      await page.getByRole('button', { name: '导出 JSON', exact: true }).click();
      const raw = await page.locator('textarea[readonly]').first().inputValue();
      await page.getByLabel('粘贴备份 JSON').fill(raw);
      assert.equal(await page.getByRole('button', { name: '预演恢复并查看差异', exact: true }).isDisabled(), true);
      assert.equal(await page.getByRole('button', { name: '导入并覆盖当前数据', exact: true }).isDisabled(), true);
      await page.getByText(/当前环境不支持安全恢复/).waitFor();
      const result = await page.evaluate(async raw => {
        const snapshot = () => JSON.stringify(Object.keys(localStorage).sort().map(key => [key, localStorage.getItem(key)]));
        const before = snapshot(); let rejected = false;
        try { const { store } = await import('/src/store.ts'); await store.importBackup(raw); } catch { rejected = true; }
        return { rejected, unchanged: snapshot() === before };
      }, raw);
      assert.deepEqual(result, { rejected: true, unchanged: true });
      await page.screenshot({ path: path.join(output, 'codex_missing_restore_lock.png') });
    } finally { await context.close(); }
  });

  await check('explicit gallery action and offline Harmony help are available', async () => {
    const { context, page } = await open('/more');
    try {
      await page.getByRole('link', { name: /鸿蒙与兼容环境/ }).click();
      await page.getByRole('heading', { name: '鸿蒙与兼容环境' }).waitFor();
      await page.getByText(/文件互传/).first().waitFor();
      await page.screenshot({ path: path.join(output, 'codex_harmony_help.png') });
      await page.goto(`${origin}/#/summary?year=2026&view=overview`);
      await page.getByRole('button', { name: '保存全年记录索引', exact: true }).click();
      await page.locator('.journal-export-preview').waitFor();
      await page.evaluate(() => { window.codexBadGalleryResult = true; });
      await page.getByRole('button', { name: '保存当前页到相册', exact: true }).click();
      await page.getByRole('alert').filter({ hasText: '系统未确认相册保存' }).waitFor();
      await page.evaluate(() => { window.codexBadGalleryResult = false; });
      await page.getByRole('button', { name: '保存当前页到相册', exact: true }).click();
      await page.getByText(/已保存到当前环境相册/).waitFor();
      assert.equal(await page.evaluate(() => window.codexAdapterCalls.some(call => call.method === 'saveImageToGallery' && call.mimeType === 'image/png')), true);
      await page.evaluate(() => { window.codexGalleryFails = true; });
      await page.getByRole('button', { name: '保存当前页到相册', exact: true }).click();
      await page.getByRole('alert').filter({ hasText: '系统入口不可用' }).waitFor();
      assert.equal(await page.locator('.journal-export-preview').count(), 1);
    } finally { await context.close(); }
  });
  report.passed = report.checks.every(check => check.passed);
  if (!report.passed && process.env.CODEX_ZHUOYI_BASELINE !== '1') process.exitCode = 1;
} finally {
  await browser.close(); await server?.close();
  await writeFile(path.join(output, 'codex_results.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ passed: report.passed, checks: report.checks.map(item => ({ name: item.name, passed: item.passed })), output }));
}
