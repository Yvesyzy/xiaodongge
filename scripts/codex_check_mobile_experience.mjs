import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { makeJournalFixtures } from '../mobile/codex_journal_fixtures.mjs';

const origin = process.argv[2] || 'http://127.0.0.1:5180';
const output = process.env.CODEX_QA_DIR;
if (!output) throw new Error('Set CODEX_QA_DIR to an absolute screenshot output directory');
await mkdir(output, { recursive: true });
// Browser plugin not available; isolated Playwright context with synthetic records only.
const browser = await chromium.launch({ channel: 'chrome', headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await page.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
  await page.goto(origin);
  const base = makeJournalFixtures('6')[0];
  const entries = [
    { ...base, id: 'codex-cover-album', title: '封面同步测试', albumName: '封面同步测试', songName: 'cut：甲/乙', year: 2026, month: 7 },
    { ...base, id: 'codex-cover-other', title: '另一艺人的同名专辑', albumName: '封面同步测试', songName: 'cut：甲/乙', artistName: '另一艺人', year: 2026, month: 7 },
    { ...base, id: 'codex-cover-song', title: '歌曲独立封面', type: 'song', albumName: '封面同步测试', songName: '单曲', year: 2026, month: 7 },
  ];
  await page.evaluate(items => { localStorage.clear(); sessionStorage.clear(); localStorage.setItem('music-feelings-mobile-entries', JSON.stringify(items)); }, entries);
  const legacy = await page.evaluate(async entry => {
    const { store } = await import('/src/store.ts');
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = 40;
    const ctx = canvas.getContext('2d'); ctx.fillStyle = '#c9973f'; ctx.fillRect(0, 0, 40, 40);
    const picture = canvas.toDataURL('image/png');
    await store.setCover('song', { songName: entry.songName, albumName: entry.albumName, artistName: entry.artistName }, picture);
    return { picture, album: await store.getCover('album', { albumName: entry.albumName, artistName: entry.artistName }) };
  }, entries[0]);
  assert.equal(legacy.album, legacy.picture, 'Legacy album-type review cover is visible in album display');
  console.log('PASS legacy album fallback');
  const storageChecks = await page.evaluate(async items => {
    const { store, entryCoverTarget } = await import('/src/store.ts');
    const album = items[0];
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = 40;
    const ctx = canvas.getContext('2d'); ctx.fillStyle = '#245448'; ctx.fillRect(0, 0, 40, 40);
    const replacement = canvas.toDataURL('image/png');
    const old = await store.getEntryCover(album);
    const other = await store.getEntryCover(items[1]);
    // Two disagreeing historical images must not pick an arbitrary winner.
    const conflict = { ...album, id: 'codex-cover-conflict', songName: '另一组cut' };
    localStorage.setItem('music-feelings-mobile-entries', JSON.stringify([...items, conflict]));
    await store.setCover('song', conflict, replacement);
    const conflictingAlbum = await store.getCover('album', album);
    localStorage.setItem('music-feelings-mobile-entries', JSON.stringify(items));
    const target = entryCoverTarget(album);
    await store.setCover(target.kind, target.target, replacement);
    await store.setCover('song', items[2], old);
    return { kind: target.kind, target, other, conflictingAlbum, old, replacement,
      entry: await store.getEntryCover(album), album: await store.getCover('album', album),
      aggregate: (await store.albumAggregates()).find(row => row.artistName === album.artistName)?.coverDataUrl,
      song: await store.getEntryCover(items[2]) };
  }, entries);
  assert.equal(storageChecks.kind, 'album');
  assert.equal(storageChecks.other, null);
  assert.equal(storageChecks.conflictingAlbum, null);
  for (const key of ['entry', 'album', 'aggregate']) assert.equal(storageChecks[key], storageChecks.replacement, key);
  assert.equal(storageChecks.song, storageChecks.old);
  console.log('PASS album ownership, artist isolation, ambiguous legacy preservation, album priority, independent song cover');

  await page.goto(origin + '/#/timeline'); await page.reload();
  const card = page.locator('.codex-timeline-card').filter({ has: page.getByRole('heading', { name: entries[0].title, exact: true }) });
  const image = card.locator('.cover-art');
  await image.waitFor();
  assert.equal(await image.getAttribute('src'), storageChecks.replacement);
  const beforeUrl = page.url();
  const chooserPromise = page.waitForEvent('filechooser');
  await card.locator('.codex-cover-pick').click();
  const chooser = await chooserPromise;
  await chooser.setFiles({ name: 'codex-cover.png', mimeType: 'image/png', buffer: Buffer.from(legacy.picture.split(',')[1], 'base64') });
  await card.getByRole('status').filter({ hasText: '封面已更新' }).waitFor();
  assert.equal(page.url(), beforeUrl, 'Choosing a cover never opens the review');
  const uploaded = await image.getAttribute('src');
  assert.notEqual(uploaded, storageChecks.replacement);
  for (const width of [320, 390, 1280]) {
    await page.setViewportSize({ width, height: 844 });
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `Timeline fits ${width}px`);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: `${output}/codex_timeline_direct_cover.png` });
  await card.getByRole('link').first().click();
  await page.locator('.codex-reader-toolbar').waitFor();
  assert.equal(await page.locator('.detail-hero .cover-art').getAttribute('src'), uploaded);
  assert.equal(await page.locator('.codex-reader-toolbar > span').count(), 0);
  assert.equal(await page.locator('.codex-reader-footer').count(), 0);
  const backButton = page.getByRole('button', { name: '← 返回', exact: true });
  assert.equal(await backButton.evaluate(el => getComputedStyle(el).borderTopWidth), '0px');
  const menuButton = page.getByLabel('更多阅读操作');
  await menuButton.click();
  await page.getByLabel('阅读字号').selectOption('large');
  await page.getByRole('button', { name: '深色', exact: true }).click();
  assert.equal(await page.locator('.codex-reader-dark').count(), 1);
  await page.waitForFunction(() => getComputedStyle(document.querySelector('.codex-reader .danger-button')).backgroundColor === getComputedStyle(document.querySelector('.codex-reader')).backgroundColor);
  await page.screenshot({ path: `${output}/codex_reading_settings_menu.png` });
  const back = () => page.evaluate(async () => { const { requestBack } = await import('/src/codex_Navigation.tsx'); requestBack(); });
  const readingUrl = page.url();
  await back();
  assert.equal(page.url(), readingUrl);
  assert.equal(await page.locator('.codex-reader-menu[open]').count(), 0);
  await page.locator('.codex-reader-toolbar').getByRole('button', { name: '分享', exact: true }).click();
  await page.locator('.review-share-dialog').waitFor();
  await back(); await page.locator('.review-share-dialog').waitFor({ state: 'detached' });
  assert.equal(page.url(), readingUrl);
  await backButton.click(); await page.waitForURL(beforeUrl);
  await page.locator('.bottom-nav a[href="#/albums"]').click();
  const albumRow = page.locator('.cover-row').filter({ has: page.getByRole('heading', { name: entries[0].albumName, exact: true }) }).filter({ hasText: entries[0].artistName });
  await albumRow.waitFor(); assert.equal(await albumRow.locator('img').getAttribute('src'), uploaded);
  await page.reload(); await albumRow.waitFor(); assert.equal(await albumRow.locator('img').getAttribute('src'), uploaded);
  await back(); await page.waitForURL(origin + '/#/');
  await page.getByRole('button', { name: '新建记录' }).click(); await page.getByRole('dialog').waitFor();
  await back(); await page.getByRole('dialog').waitFor({ state: 'detached' });
  console.log('PASS direct file chooser, immediate/persisted cross-page covers, single reader menu, borderless return, overlay-first navigation, top-level return');
  assert.equal(await page.locator('vite-error-overlay').count(), 0);
  assert.deepEqual(errors, []);
} finally { await browser.close(); }
