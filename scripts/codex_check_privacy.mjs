import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { createServer } from 'vite';
import { freeLoopbackPort } from './codex_qa_options.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const output = path.resolve(process.env.CODEX_QA_DIR || path.join(root, `release/codex_privacy_qa_${Date.now()}`));
await mkdir(output, { recursive: true });
const policy = JSON.parse(await readFile(path.join(root, 'mobile/src/codex_privacy_policy.json'), 'utf8'));
const server = await createServer({ configFile: path.join(root, 'mobile/vite.config.ts'), cacheDir: path.join(output, 'vite-cache'),
  server: { host: '127.0.0.1', port: await freeLoopbackPort(), strictPort: true, forwardConsole: false } });
await server.listen();
const origin = `http://127.0.0.1:${server.httpServer.address().port}`;
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const result = { passed: false, checks: [], limitations: ['Browser bridge simulation; native SDK behavior and network telemetry require Android device verification.'] };
async function open({ status = 'pending', version = policy.version, failLoad = false, failSave = false, platform = 'android' } = {}) {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  page.setDefaultTimeout(15000);
  await page.addInitScript(({ status, version, failLoad, failSave, platform }) => {
    window.CapacitorCustomPlatform = { name: platform };
    window.codexPrivacyCalls = [];
    window.codexPrivacyFailLoad = failLoad;
    window.codexPrivacyFailSave = failSave;
    const methods = names => names.map(name => ({ name, rtype: 'promise' }));
    window.Capacitor = {
      PluginHeaders: [
        { name: 'CodexPrivacy', methods: methods(['getState', 'setConsent']) },
        { name: 'NowPlaying', methods: methods(['getCurrentTrack', 'searchCatalog', 'openNotificationSettings', 'getDiagnostics']) },
        { name: 'ScreenshotOcr', methods: methods(['recognize']) },
        { name: 'SharedMusic', methods: [...methods(['consumePendingShare', 'removeListener']), { name: 'addListener', rtype: 'callback' }] },
        { name: 'CodexNavigation', methods: [...methods(['exitApp', 'removeListener']), { name: 'addListener', rtype: 'callback' }] },
      ],
      nativeCallback: () => 'codex-privacy-test-listener',
      nativePromise: async (plugin, method, options) => {
        window.codexPrivacyCalls.push({ plugin, method });
        // The test exercises privacy routing with browser storage, not a simulated SQLite engine.
        window.Capacitor.isNativePlatform = () => false;
        if (plugin === 'CodexPrivacy') {
          if (method === 'getState' && window.codexPrivacyFailLoad) throw new Error('模拟选择读取失败');
          if (method === 'setConsent') {
            if (window.codexPrivacyFailSave) throw new Error('模拟选择保存失败');
            localStorage.setItem('codex-test-privacy-state', JSON.stringify({ status: options.accepted ? 'accepted' : 'declined', policyVersion: version }));
          }
          return JSON.parse(localStorage.getItem('codex-test-privacy-state') || JSON.stringify({ status, policyVersion: version }));
        }
        if (plugin === 'NowPlaying' && method === 'getCurrentTrack') return { accessEnabled: false };
        if (plugin === 'NowPlaying' && method === 'searchCatalog') return { country: options.country, results: [] };
        return {};
      },
    };
    // Non-Android pages have no native privacy bootstrap to switch storage mode.
    if (platform === 'web') Object.defineProperty(window.Capacitor, 'isNativePlatform', { get: () => () => false, set: () => {}, configurable: true });
  }, { status, version, failLoad, failSave, platform });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.route('https://geocoding-api.open-meteo.com/**', route => route.fulfill({ contentType: 'application/json', body: '{"results":[]}' }));
  await page.goto(origin, { waitUntil: 'networkidle' });
  return { page, errors };
}
try {
  const { page, errors } = await open();
  await page.getByRole('heading', { name: '欢迎使用小懂哥' }).waitFor();
  assert.equal(await page.locator('.app-header').count(), 0);
  assert.deepEqual(await page.evaluate(() => [...new Set(window.codexPrivacyCalls.map(item => item.plugin))]), ['CodexPrivacy']);
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  await page.screenshot({ path: path.join(output, 'codex_privacy_first_light.png'), animations: 'disabled' });
  await page.evaluate(() => { document.documentElement.dataset.theme = 'dark'; });
  await page.screenshot({ path: path.join(output, 'codex_privacy_first_dark.png'), animations: 'disabled' });
  result.darkButtonStyles = await page.locator('.codex-privacy-actions button').evaluateAll(buttons => buttons.map(button => {
    const style = getComputedStyle(button);
    return { text: button.textContent, color: style.color, background: style.backgroundColor, image: style.backgroundImage, disabled: button.disabled };
  }));
  result.checks.push('First launch blocks application and sensitive native calls; readable light/dark screen');

  await page.getByRole('button', { name: '仅使用本地功能', exact: true }).click();
  await page.locator('.app-header').waitFor();
  await page.goto(origin + '/#/new');
  await page.locator('input[name="title"]').fill('仅本地隐私验收');
  await page.locator('textarea[name="content"]').fill('拒绝增强功能后，手动记录仍能保存。');
  await page.getByText('上传信息截图', { exact: true }).locator('input').setInputFiles({ name: 'codex_privacy.png', mimeType: 'image/png', buffer: Buffer.from('privacy-guard-test') });
  await page.getByText('请先在“更多 → 隐私说明”中同意增强功能的数据处理，仍可手动记录。', { exact: true }).waitFor();
  await page.getByRole('button', { name: '保存正式乐评', exact: true }).click();
  await page.waitForURL(/#\/entries\//);
  const blocked = await page.evaluate(async () => {
    const privacy = await import('/src/codex_privacy.ts');
    const { NowPlaying } = await import('/src/nativeNowPlaying.ts');
    const { store } = await import('/src/store.ts');
    const outcomes = [];
    for (const action of [() => NowPlaying.getCurrentTrack(), () => NowPlaying.searchCatalog({ title: 'song', artistName: 'artist', country: 'CN' }), () => NowPlaying.openNotificationSettings(), () => store.searchWeatherLocations('广州')]) {
      try { await action(); outcomes.push('allowed'); } catch { outcomes.push('blocked'); }
    }
    return { outcomes, images: [privacy.privacyAllowsImage('https://example.invalid/cover.jpg'), privacy.privacyAllowsImage('content://local/cover'), privacy.privacyAllowsImage('data:image/png;base64,')], entries: (await store.listEntries()).length,
      sensitiveCalls: window.codexPrivacyCalls.filter(item => ['NowPlaying', 'ScreenshotOcr'].includes(item.plugin)).length };
  });
  assert.deepEqual(blocked.outcomes, ['blocked', 'blocked', 'blocked', 'blocked']);
  assert.deepEqual(blocked.images, [false, true, true]);
  assert.equal(blocked.entries, 1);
  assert.equal(blocked.sensitiveCalls, 0);
  await page.reload({ waitUntil: 'networkidle' });
  await page.locator('.app-shell').waitFor();
  assert.equal(await page.getByRole('heading', { name: '欢迎使用小懂哥' }).count(), 0);
  result.checks.push('Refusal survives reload; manual save, media/catalog/settings/weather guards and remote-image restriction pass');

  await page.goto(origin + '/#/privacy');
  await page.getByRole('button', { name: '同意并开启增强功能', exact: true }).click();
  await page.getByRole('button', { name: '撤回同意并退出', exact: true }).waitFor();
  const accepted = await page.evaluate(async () => {
    const { NowPlaying } = await import('/src/nativeNowPlaying.ts');
    const { store } = await import('/src/store.ts');
    await NowPlaying.getCurrentTrack();
    await store.searchWeatherLocations('广州');
    return window.codexPrivacyCalls.some(item => item.plugin === 'NowPlaying');
  });
  assert.equal(accepted, true);
  await page.reload({ waitUntil: 'networkidle' });
  await page.getByRole('button', { name: '撤回同意并退出', exact: true }).waitFor();
  await page.route('https://archive-api.open-meteo.com/codex-privacy-abort', () => {});
  const inFlight = page.waitForRequest('https://archive-api.open-meteo.com/codex-privacy-abort');
  await page.evaluate(async () => {
    const { privacyFetch } = await import('/src/codex_privacy.ts');
    window.codexPrivacyPending = privacyFetch('https://archive-api.open-meteo.com/codex-privacy-abort').then(() => 'allowed', error => error.name);
  });
  await inFlight;
  page.once('dialog', dialog => dialog.accept());
  await page.getByRole('button', { name: '撤回同意并退出', exact: true }).click();
  await page.getByRole('button', { name: '同意并开启增强功能', exact: true }).waitFor();
  assert.equal(await page.evaluate(() => window.codexPrivacyPending), 'AbortError');
  assert.equal(await page.evaluate(async () => (await (await import('/src/store.ts')).store.listEntries()).length), 1);
  await page.reload({ waitUntil: 'networkidle' });
  await page.getByRole('button', { name: '同意并开启增强功能', exact: true }).waitFor();
  result.checks.push('Acceptance persists; explicit withdrawal aborts in-flight weather, persists and keeps local records');
  assert.deepEqual(errors, []);
  await page.close();

  for (const settings of [{ version: 'old-version', status: 'accepted' }, { status: 'invalid' }, { status: ['accepted'] }, { failSave: true }]) {
    const { page } = await open(settings);
    if (settings.status === 'invalid' || Array.isArray(settings.status)) await page.getByRole('button', { name: '重试读取隐私选择' }).waitFor();
    else {
      await page.getByRole('heading', { name: '欢迎使用小懂哥' }).waitFor();
      if (settings.failSave) {
        await page.getByRole('button', { name: '同意并开启增强功能' }).click();
        await page.getByRole('alert').filter({ hasText: '模拟选择保存失败' }).waitFor();
      }
    }
    assert.equal(await page.locator('.app-header').count(), 0);
    await page.close();
  }
  const retry = await open({ failLoad: true });
  await retry.page.getByRole('button', { name: '重试读取隐私选择' }).waitFor();
  await retry.page.evaluate(() => { window.codexPrivacyFailLoad = false; });
  await retry.page.getByRole('button', { name: '重试读取隐私选择' }).click();
  await retry.page.getByRole('heading', { name: '欢迎使用小懂哥' }).waitFor();
  await retry.page.close();
  result.checks.push('Old policy, invalid state, failed persistence and failed loading fail closed; loading can retry');

  const web = await open({ platform: 'web' });
  await web.page.locator('.app-header').waitFor();
  assert.equal(await web.page.getByRole('heading', { name: '欢迎使用小懂哥' }).count(), 0);
  assert.equal(await web.page.evaluate(async () => {
    const privacy = await import('/src/codex_privacy.ts');
    window.Capacitor.getPlatform = () => 'electron';
    return privacy.hasPrivacyConsent();
  }), true);
  await web.page.close();
  result.checks.push('Web has no Android prompt; Electron consent guard remains allowed');
  result.passed = true;
  console.log(JSON.stringify(result, null, 2));
} catch (error) {
  result.error = error.stack;
  throw error;
} finally {
  await writeFile(path.join(output, 'codex_privacy_checks.json'), JSON.stringify(result, null, 2));
  await browser.close();
  await server.close();
}
