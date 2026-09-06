import { chromium } from 'playwright';
import assert from 'node:assert/strict';

const browser = await chromium.launch({ headless: true, channel: 'chrome' });
try {
  const page = await browser.newPage({ timezoneId: 'Asia/Shanghai' });
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('http://127.0.0.1:5173');
  const result = await page.evaluate(async () => {
    const { store } = await import('/src/store.ts');
    const { parseMonthlyListeningSnapshot, inRecordingPeriod } = await import('/src/listeningYearbook.ts');
    const entries = Array.from({ length: 6 }, (_, i) => ({
      id: `codex-review-${i}`, type: i % 2 ? 'song' : 'album', title: `测试作品 ${i + 1}`,
      year: 2026, month: i < 3 ? 5 : 8, albumName: `测试专辑 ${i + 1}`, songName: i % 2 ? `测试歌曲 ${i + 1}` : null,
      artistName: '测试音乐人', musicMetadata: { releaseDate: '1999-01-01' },
      content: '温暖的人声让我平静。鼓点明亮，旋律像回忆里的海。', tags: [], moods: ['平静'],
      rating: 8, ratingModifier: null, ratingProduction: null, ratingSongwriting: null,
      ratingOriginality: null, ratingResonance: null, compositeRatingLocked: false,
      firstListenedAt: '2020-01-01T00:00:00.000Z', listenedAt: '2026-08-10T00:00:00.000Z',
      createdAt: i < 3 ? '2026-05-10T04:00:00.000Z' : '2026-08-10T04:00:00.000Z', updatedAt: '2026-09-05T04:00:00.000Z',
    }));
    localStorage.setItem('music-feelings-mobile-entries', JSON.stringify(entries));
    const monthly = await store.generateMonthlySummary(2026, 5);
    let monthError = null;
    try { parseMonthlyListeningSnapshot(monthly.analysisJson); } catch (error) { monthError = error.message; }
    const annual = await store.generateSummary(2026);
    const oldGenerate = store.generateMonthlySummary;
    let failedYear = '';
    store.generateMonthlySummary = async () => { throw new Error('测试月份失败'); };
    try { await store.generateSummary(2026); } catch (error) { failedYear = error.message; }
    store.generateMonthlySummary = oldGenerate;
    const unchanged = (await store.getSummary(2026)).generatedAt === annual.generatedAt;
    const boundary = inRecordingPeriod({ ...entries[0], createdAt: '2025-12-31T16:00:00.000Z' }, 2026, 1);
    const differingArchive = { ...entries[0], year: 1999, month: null, id: 'codex-extra' };
    const grouping = inRecordingPeriod(differingArchive, 2026, 5);
    return { monthError, annualCount: annual.sourceEntryCount, failedYear, unchanged, boundary, grouping };
  });
  assert.equal(result.monthError, null, 'Generated May report must be readable');
  assert.equal(result.annualCount, 6, 'Annual report must include all six reviews');
  assert.match(result.failedYear, /5 月生成失败/);
  assert.equal(result.unchanged, true, 'Failed generation preserves previous annual report');
  assert.equal(result.boundary, true, 'UTC year boundary uses local recording date');
  assert.equal(result.grouping, true, 'Manual archive year/month do not override recording date');
  await page.evaluate(() => {
    const key = 'music-feelings-mobile-monthly-summaries';
    const summaries = JSON.parse(localStorage.getItem(key));
    const may = summaries.find((summary) => summary.month === 5);
    const snapshot = JSON.parse(may.analysisJson);
    snapshot.days[0].date = '2026-08-10';
    may.analysisJson = JSON.stringify(snapshot);
    localStorage.setItem(key, JSON.stringify(summaries));
  });
  await page.goto('http://127.0.0.1:5173/#/summary/2026/5');
  await page.getByText('已保存的月报无法读取，请重新生成。下方保留文字内容。', { exact: true }).waitFor();
  await page.getByRole('button', { name: '重新生成', exact: true }).click();
  await page.locator('.monthly-artwork').waitFor();
  await page.reload();
  await page.locator('.monthly-artwork').waitFor();
  await page.goto('http://127.0.0.1:5173/#/summary/analysis');
  await page.locator('.yearbook-overview').waitFor();
  const preview = page.getByRole('img', { name: '2026 年度听感标本册海报预览' });
  await preview.waitFor();
  await preview.evaluate((image) => image.decode());
  assert.equal(await preview.evaluate((image) => image.naturalWidth), 1080);
  const downloadEvent = page.waitForEvent('download');
  await page.getByRole('button', { name: '下载 PNG', exact: true }).click();
  const download = await downloadEvent;
  const chunks = [];
  for await (const chunk of await download.createReadStream()) chunks.push(chunk);
  const png = Buffer.concat(chunks);
  assert.equal(png.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
  assert.equal(png.readUInt32BE(16), 1080);
  assert.equal(png.readUInt32BE(20), 1680);
  if (process.env.CODEX_QA_DIR) await download.saveAs(`${process.env.CODEX_QA_DIR}/codex_yearbook-poster.png`);
  assert.equal(await page.locator('.yearbook-bars a').count(), 12);
  if (process.env.CODEX_QA_DIR) {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.locator('.yearbook-overview').scrollIntoViewIfNeeded();
    await page.screenshot({ path: `${process.env.CODEX_QA_DIR}/codex_yearbook-mobile.png` });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, 'No mobile horizontal overflow');
  }
  await page.getByText('查看本册全部 6 篇乐评', { exact: true }).click();
  assert.equal(await page.locator('.yearbook-sources a').count(), 6);
  await page.goto('http://127.0.0.1:5173/#/');
  if (process.env.CODEX_QA_DIR) {
    await page.locator('.home-draft-link').waitFor();
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({ path: `${process.env.CODEX_QA_DIR}/codex_home-mobile.png` });
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.screenshot({ path: `${process.env.CODEX_QA_DIR}/codex_home-desktop.png` });
  }
  await page.getByRole('button', { name: '新建记录', exact: true }).click();
  assert.equal(await page.locator('.create-choice-card').count(), 3);
  await page.getByRole('link', { name: '完整 完整乐评：专辑、曲风、情绪、多维度评分', exact: true }).click();
  await page.locator('input[name="title"]').fill('正文为空的草稿');
  await page.locator('.writing-extras > summary').click();
  await page.locator('input[name="firstListenedAt"]').fill('2020-01-02');
  await page.evaluate(() => {
    window.codexOriginalSetItem = Storage.prototype.setItem;
    Storage.prototype.setItem = function(key, value) {
      if (key.startsWith('music-feelings-entry-draft:')) throw new DOMException('模拟容量不足', 'QuotaExceededError');
      return window.codexOriginalSetItem.call(this, key, value);
    };
  });
  await page.getByRole('button', { name: '保存草稿', exact: true }).click();
  await page.getByText(/本地存储已满，草稿未保存/).waitFor();
  assert.match(page.url(), /#\/new\?draft=/, 'Failed draft save keeps the editor open');
  await page.evaluate(() => { Storage.prototype.setItem = window.codexOriginalSetItem; });
  await page.getByRole('button', { name: '保存草稿', exact: true }).click();
  await page.waitForURL('**/#/drafts');
  await page.getByRole('button', { name: /正文为空的草稿/ }).click();
  await page.waitForFunction(() => document.querySelector('input[name="firstListenedAt"]')?.value === '2020-01-02');
  assert.equal(await page.locator('input[name="firstListenedAt"]').inputValue(), '2020-01-02');
  assert.equal(await page.locator('textarea[name="content"]').inputValue(), '');
  await page.getByRole('button', { name: '保存正式乐评', exact: true }).click();
  assert.equal(await page.locator('textarea[name="content"]:invalid').count(), 1);
  await page.getByRole('button', { name: '保存草稿', exact: true }).click();
  await page.goto('http://127.0.0.1:5173/#/capture');
  await page.getByRole('button', { name: '保存草稿', exact: true }).click();
  await page.waitForURL('**/#/drafts');
  await page.locator('.draft-card').first().waitFor();
  assert.equal(await page.locator('.draft-card').count(), 2);
  await page.locator('.draft-card-main').filter({ hasText: '快速记录' }).click();
  await page.waitForURL('**/#/capture?draft=*');
  assert.deepEqual(errors, [], 'No uncaught app errors');
  console.log('PASS: May reload, six annual sources, failure preservation, date boundaries, 12 bars, three choices, empty drafts, quota failure, full/quick resume, 1080x1680 PNG preview/download');
} finally { await browser.close(); }
