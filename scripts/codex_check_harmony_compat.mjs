import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { chromium } from 'playwright';
import { createServer, preview } from 'vite';
import { freeLoopbackPort } from './codex_qa_options.mjs';
import { DAILY_RESURFACING_KEY } from '../shared/backupAppData.ts';

const { values } = parseArgs({ options: { output: { type: 'string' }, build: { type: 'string' }, baseline: { type: 'boolean' } } });
const output = path.resolve(values.output ?? 'release/codex_harmony_compat_20261009');
await mkdir(output, { recursive: true });
const policy = JSON.parse(await readFile('mobile/src/codex_privacy_policy.json', 'utf8'));
const server = await createServer({ configFile: path.resolve('mobile/vite.config.ts'), cacheDir: path.join(output, 'vite-cache'),
  server: { host: '127.0.0.1', port: await freeLoopbackPort(), strictPort: true, forwardConsole: false } });
await server.listen();
const origin = `http://127.0.0.1:${server.httpServer.address().port}`;
let production;
if (values.build) production = await preview({ configFile: path.resolve('mobile/vite.config.ts'),
  build: { outDir: path.resolve(values.build) }, preview: { host: '127.0.0.1', port: await freeLoopbackPort(), strictPort: true } });
const productionOrigin = production ? `http://127.0.0.1:${production.httpServer.address().port}` : origin;
const report = { passed: false, baseline: !!values.baseline, startedAt: new Date().toISOString(), checks: [],
  limitations: ['Desktop Chrome with missing APIs and CSS :has rules removed; not a Huawei device or an old Chromium binary.', 'Synthetic data only; no personal archive read.'] };
const browser = await chromium.launch({ channel: 'chrome', headless: true });
async function check(name, action) {
  try { await action(); report.checks.push({ name, passed: true }); console.log(`PASS ${name}`); }
  catch (error) { report.checks.push({ name, passed: false, error: String(error.stack ?? error) }); console.log(`FAIL ${name}: ${error.message}`); }
}
async function pageFor(address, native = false) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, timezoneId: 'Asia/Shanghai' });
  if (native) await context.addInitScript(version => {
    const methods = names => names.map(name => ({ name, rtype: 'promise' }));
    window.androidBridge = {};
    window.Capacitor = {
      PluginHeaders: [
        { name: 'CodexPrivacy', methods: methods(['getState', 'setConsent']) },
        { name: 'NowPlaying', methods: methods(['getCurrentTrack', 'getDiagnostics']) },
        { name: 'SharedMusic', methods: [...methods(['consumePendingShare', 'removeListener']), { name: 'addListener', rtype: 'callback' }] },
        { name: 'CodexNavigation', methods: [...methods(['exitApp', 'removeListener']), { name: 'addListener', rtype: 'callback' }] },
      ],
      nativeCallback: () => 'codex-harmony-test-listener',
      nativePromise: async (plugin, method, options) => {
        window.Capacitor.isNativePlatform = () => false;
        if (plugin === 'CodexPrivacy') return { status: method === 'setConsent' && !options.accepted ? 'declined' : 'accepted', policyVersion: version };
        if (plugin === 'NowPlaying' && method === 'getCurrentTrack') {
          window.codexMediaWaiting = true;
          return new Promise(resolve => { window.codexReleaseMedia = () => resolve({ accessEnabled: false }); });
        }
        return {};
      },
    };
  }, policy.version);
  const page = await context.newPage();
  page.setDefaultTimeout(15000);
  await page.route('**/*', route => new URL(route.request().url()).origin === address ? route.continue() : route.abort());
  return { context, page };
}
try {
  await check('production without at/hasOwn/replaceAll/randomUUID; save and read', async () => {
    const { context, page } = await pageFor(productionOrigin);
    try {
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await context.addInitScript(() => {
        for (const [object, key] of [[Array.prototype, 'at'], [Object, 'hasOwn'], [String.prototype, 'replaceAll'], [Crypto.prototype, 'randomUUID']]) {
          Object.defineProperty(object, key, { configurable: true, writable: true, value: undefined });
        }
        const supports = CSS.supports.bind(CSS);
        CSS.supports = (...args) => args[0].includes('selector(') ? false : supports(...args);
      });
      await page.goto(productionOrigin);
      await page.locator('.app-header').waitFor();
      const apis = await page.evaluate(() => {
        let nonGlobalRejected = false;
        try { 'aa'.replaceAll(/a/, 'b'); } catch (error) { nonGlobalRejected = error instanceof TypeError; }
        const object = Object.create(null); object.x = 1;
        return { last: [1, 2].at(-1), fractional: [1, 2].at(-1.7), outside: [1, 2].at(-3),
          generic: Array.prototype.at.call({ length: 3, 2: 'last' }, -1),
          own: Object.hasOwn(object, 'x'), inherited: Object.hasOwn({}, 'toString'),
          replace: 'a-a'.replaceAll('-', '.'), punctuation: 'a.b.a'.replaceAll('.', '$$'),
          empty: 'ab'.replaceAll('', '-'), callback: 'aa'.replaceAll('a', (_, index) => String(index)),
          regex: 'a-a'.replaceAll(/a/g, 'b'), nonGlobalRejected, uuid: crypto.randomUUID(),
          unique: new Set(Array.from({ length: 100 }, () => crypto.randomUUID())).size };
      });
      assert.equal(apis.last, 2); assert.equal(apis.own, true); assert.equal(apis.replace, 'a.a');
      assert.equal(apis.fractional, 2); assert.equal(apis.outside, undefined); assert.equal(apis.generic, 'last');
      assert.equal(apis.inherited, false); assert.equal(apis.punctuation, 'a$b$a'); assert.equal(apis.empty, '-a-b-');
      assert.equal(apis.callback, '01'); assert.equal(apis.regex, 'b-b'); assert.equal(apis.nonGlobalRejected, true);
      assert.equal(apis.unique, 100);
      assert.match(apis.uuid, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
      await page.evaluate(() => { location.hash = '/new'; });
      await page.locator('input[name="title"]').fill('旧内核兼容检查');
      await page.locator('textarea[name="content"]').fill('合成测试：手动保存与阅读保持可用。');
      await page.getByRole('button', { name: '保存正式乐评', exact: true }).click();
      await page.waitForURL(/#\/entries\//);
      await page.locator('.codex-reader').waitFor();
      // Simulate the browser discarding unsupported :has selectors, including lazy CSS.
      await page.evaluate(() => {
        const strip = sheet => { for (let i = sheet.cssRules.length - 1; i >= 0; i--) {
          const rule = sheet.cssRules[i];
          if (rule.selectorText?.includes(':has(')) sheet.deleteRule(i);
          else if (rule.cssRules) strip(rule);
        } };
        for (const sheet of document.styleSheets) strip(sheet);
      });
      assert.equal(await page.locator('.app-header').evaluate(element => getComputedStyle(element).display), 'none');
      assert.equal(await page.locator('.bottom-nav').evaluate(element => getComputedStyle(element).display), 'none');
      assert.deepEqual(errors, []);
      await page.screenshot({ path: path.join(output, 'codex_legacy_reader.png') });
    } finally { await context.close(); }
  });

  await check('home uses one record and one cover scan, visible before media returns', async () => {
    const { context, page } = await pageFor(productionOrigin, true);
    try {
      await page.goto(`${productionOrigin}/#/more`);
      await page.locator('.app-header').waitFor();
      await page.evaluate(async resurfacingKey => {
        const year = new Date().getFullYear();
        const entries = Array.from({ length: 1000 }, (_, index) => {
          const createdAt = new Date(Date.UTC(year, 0, 1, 0, 0, index)).toISOString();
          return { id: `codex-harmony-${index}`, type: 'album', title: `合成记录 ${index}`, year, month: 1,
            albumName: `合成专辑 ${index}`, songName: null, artistName: `合成音乐人 ${index}`, musicMetadata: null,
            content: '性能检查合成正文。'.repeat(20), tags: [], moods: [], rating: 8, ratingModifier: null,
            ratingProduction: null, ratingSongwriting: null, ratingLyrics: null, ratingComposition: null,
            ratingVocals: null, ratingOriginality: null, ratingResonance: null, compositeRatingLocked: false,
            firstListenedAt: null, listenedAt: '2025-01-01', createdAt, updatedAt: createdAt };
        });
        localStorage.setItem('music-feelings-mobile-entries', JSON.stringify(entries));
        const today = new Date().toLocaleDateString('sv-SE');
        localStorage.setItem('music-feelings-mobile-app-data', JSON.stringify({
          [resurfacingKey]: JSON.stringify({ date: today, entryId: 'codex-harmony-0', dismissed: false }),
        }));
        window.codexHomeReads = { entries: 0, covers: 0 };
        const original = Storage.prototype.getItem;
        Storage.prototype.getItem = function (key) {
          if (key === 'music-feelings-mobile-entries') window.codexHomeReads.entries++;
          if (key === 'music-feelings-mobile-covers') window.codexHomeReads.covers++;
          return original.call(this, key);
        };
        window.codexHomeStarted = performance.now();
        location.hash = '/';
      }, DAILY_RESURFACING_KEY);
      await page.waitForFunction(() => window.codexMediaWaiting, { timeout: 60000 });
      report.home = await page.evaluate(() => ({ reads: window.codexHomeReads,
        beforeMedia: document.querySelectorAll('.home-entry-row').length,
        mediaRequestMs: performance.now() - window.codexHomeStarted }));
      assert.equal(report.home.beforeMedia, 3, 'Recent records must not wait for media');
      // readJsonWithRaw captures raw text and readSafeJson reads it again: two
      // Storage.getItem calls represent one validated collection read.
      assert.equal(report.home.reads.entries, 2, 'The same record snapshot must be reused');
      assert.equal(report.home.reads.covers, 2, 'Covers must be loaded in one batch');
      await page.evaluate(() => window.codexReleaseMedia());
      assert.equal(await page.locator('.home-entry-row').count(), 3);
      await page.screenshot({ path: path.join(output, 'codex_home_1000.png') });
    } finally { await context.close(); }
  });

  await check('old WebView privacy cancellation and response body', async () => {
    const { context, page } = await pageFor(origin, true);
    try {
      await context.addInitScript(() => { Object.defineProperty(AbortSignal, 'any', { configurable: true, value: undefined }); });
      await page.goto(`${origin}/#/privacy`);
      await page.getByRole('button', { name: '撤回同意并退出', exact: true }).waitFor();
      const result = await page.evaluate(async () => {
        const { privacyFetch, setPrivacyConsent } = await import('/src/codex_privacy.ts');
        const original = window.fetch;
        const outcomes = [];
        try {
          for (const mode of ['external', 'withdraw', 'pre-aborted', 'body']) {
            await setPrivacyConsent(true);
            const external = new AbortController();
            let bodySignal;
            window.fetch = async (_, options) => {
              if (options.signal.aborted) throw new DOMException('Aborted', 'AbortError');
              if (mode === 'body') {
                bodySignal = options.signal;
                return new Response(new ReadableStream({ start(controller) {
                  options.signal.addEventListener('abort', () => controller.error(new DOMException('Aborted', 'AbortError')), { once: true });
                } }));
              }
              return new Promise((_, reject) => options.signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true }));
            };
            if (mode === 'pre-aborted') external.abort();
            const request = privacyFetch('https://archive-api.open-meteo.com/codex-check', { signal: external.signal });
            if (mode === 'body') {
              const response = await request;
              const body = response.text().then(() => false, () => true);
              await setPrivacyConsent(false);
              outcomes.push({ bodyRejected: await body, signalAborted: bodySignal.aborted });
            } else {
              const outcome = request.then(() => 'allowed', error => error.name);
              if (mode === 'withdraw') await setPrivacyConsent(false);
              else external.abort();
              outcomes.push(await outcome);
            }
          }
          return outcomes;
        } finally { window.fetch = original; }
      });
      assert.deepEqual(result, ['AbortError', 'AbortError', 'AbortError', { bodyRejected: true, signalAborted: true }]);
    } finally { await context.close(); }
  });

  await check('grouping 1000 distinct works retains all identities', async () => {
    const { context, page } = await pageFor(origin);
    try {
      await page.goto(`${origin}/#/more`);
      report.grouping = await page.evaluate(async () => {
        const { groupMusicEntries, sameAlbumIdentity, sameMusicIdentity, normalizeMusicIdentityText } = await import('/src/musicIdentity.ts');
        // Frozen pre-optimization behavior: compare complete ordered memberships,
        // including aliases, conflicting catalog IDs and incomplete music names.
        function legacy(values, kind) {
          const id = entry => (kind === 'album' ? entry.musicMetadata?.catalogAlbumId : entry.musicMetadata?.catalogTrackId)?.trim() || null;
          const matches = kind === 'album' ? sameAlbumIdentity : sameMusicIdentity;
          const ordered = values.filter(entry => (entry.type === 'album' || entry.type === 'song')
            && normalizeMusicIdentityText(kind === 'album' ? entry.albumName : entry.songName))
            .sort((a, b) => Number(Boolean(id(b))) - Number(Boolean(id(a)))
              || Number(Boolean(normalizeMusicIdentityText(b.artistName))) - Number(Boolean(normalizeMusicIdentityText(a.artistName)))
              || (kind === 'song' ? Number(Boolean(normalizeMusicIdentityText(b.albumName))) - Number(Boolean(normalizeMusicIdentityText(a.albumName))) : 0)
              || a.id.localeCompare(b.id));
          const groups = [];
          for (const entry of ordered) {
            const group = groups.find(items => {
              const knownId = items.map(id).find(Boolean);
              return (!id(entry) || !knownId || id(entry) === knownId) && items.some(item => matches(item, entry));
            });
            if (group) group.push(entry); else groups.push([entry]);
          }
          return groups;
        }
        const memberships = groups => JSON.stringify(groups.map(group => group.map(entry => entry.id)));
        let seed = 711;
        const next = length => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed % length; };
        for (let run = 0; run < 20; run++) {
          const names = ['', null, ' Echo ', 'ｅＣＨＯ', 'Other', 'Third'];
          const values = Array.from({ length: 80 }, (_, index) => ({ id: `${run}-${index}`, type: ['album', 'song', 'year'][next(3)],
            albumName: names[next(names.length)], songName: names[next(names.length)], artistName: names[next(names.length)],
            musicMetadata: next(3) ? null : { catalogAlbumId: `album-${next(4)}`, catalogTrackId: `track-${next(4)}` } }));
          for (const kind of ['album', 'song']) {
            if (memberships(groupMusicEntries(values, kind)) !== memberships(legacy(values, kind))) throw new Error(`Grouping changed: ${run}/${kind}`);
          }
        }
        const entries = Array.from({ length: 1000 }, (_, index) => ({ id: String(index), type: 'song',
          songName: `Song ${index}`, albumName: `Album ${index}`, artistName: `Artist ${index}`, musicMetadata: null }));
        const referenceStarted = performance.now();
        const referenceAlbums = legacy(entries, 'album');
        const referenceSongs = legacy(entries, 'song');
        const referenceElapsedMs = performance.now() - referenceStarted;
        const started = performance.now();
        const albums = groupMusicEntries(entries, 'album');
        const songs = groupMusicEntries(entries, 'song');
        const elapsedMs = performance.now() - started;
        if (memberships(albums) !== memberships(referenceAlbums) || memberships(songs) !== memberships(referenceSongs)) {
          throw new Error('The 1000-work benchmark changed ordered memberships');
        }
        return { albums: albums.length, songs: songs.length, elapsedMs, referenceElapsedMs, differentialCases: 40 };
      });
      assert.equal(report.grouping.albums, 1000); assert.equal(report.grouping.songs, 1000);
    } finally { await context.close(); }
  });
  report.passed = report.checks.every(item => item.passed);
  if (!report.passed && !values.baseline) process.exitCode = 1;
} finally {
  report.finishedAt = new Date().toISOString();
  await browser.close(); await production?.close(); await server.close();
  await writeFile(path.join(output, 'codex_results.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ passed: report.passed, home: report.home, grouping: report.grouping, output }));
}
