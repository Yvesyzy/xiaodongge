import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { makeJournalFixtures } from '../mobile/codex_journal_fixtures.mjs';

const origin = 'http://127.0.0.1:5173';
const output = process.env.CODEX_QA_DIR || 'docs/designs/codex_yearbook_qa';
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true, channel: 'chrome' });
const errors = [];
try {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, timezoneId: 'Asia/Shanghai' });
  page.on('pageerror', e => errors.push(e.message));
  async function seed(entries) {
    await page.goto(origin);
    await page.evaluate(items => localStorage.setItem('music-feelings-mobile-entries', JSON.stringify(items)), entries);
    await page.goto(`${origin}/#/summary?year=2026`);
    await page.reload();
    await page.locator('.journal-page h1').waitFor();
  }
  async function overview() {
    await page.goto(`${origin}/#/summary?year=2026&view=overview`);
    await page.getByRole('heading', { name: '年度总览', exact: true }).waitFor();
  }
  async function noOverflow() { assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, 'No horizontal overflow'); }
  async function screenshot(name) { await page.evaluate(() => window.scrollTo(0, 0)); await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))); await page.screenshot({ path: `${output}/${name}`, fullPage: true }); }
  async function preview() {
    await page.locator('.journal-export-preview').waitFor();
    await page.locator('.journal-export-preview').evaluate(img => img.decode());
  }
  const previous = { ...makeJournalFixtures('1')[0], id: 'previous-year', createdAt: '2025-12-31T15:59:00.000Z' };
  await seed([previous]);
  await page.getByRole('heading', { name: '这一年还没有正式音乐记录' }).waitFor();
  assert.equal(await page.getByRole('link', { name: '写第一篇记录', exact: true }).getAttribute('href'), '#/new');
  assert.equal(await page.getByRole('link', { name: '打开草稿箱', exact: true }).getAttribute('href'), '#/drafts');
  assert.equal(await page.locator('.journal-bars').count(), 0);
  await noOverflow(); await screenshot('codex_empty.png');
  await page.getByLabel('年度总结年份').selectOption('2025');
  await page.getByRole('heading', { name: '我的音乐年记', exact: true }).waitFor();
  assert.match(await page.locator('.journal-stat').innerText(), /1.*篇记录/s);

  const six = makeJournalFixtures('6');
  await seed(six);
  await screenshot('codex_cover.png');
  await page.getByRole('link', { name: '开始阅读', exact: true }).click();
  await page.locator('.journal-body').waitFor();
  assert.equal(await page.locator('.journal-body > p').innerText(), six.at(-1).content);
  await screenshot('codex_work.png');
  await page.getByRole('link', { name: '下一篇 →', exact: true }).click();
  assert.match(page.url(), /entry=codex-journal-4/);
  await page.reload(); assert.match(await page.locator('.journal-body > p').innerText(), /模拟记录 5/);
  await overview();
  assert.equal(await page.locator('.journal-bars button').count(), 12);
  assert.equal(await page.locator('.journal-record').count(), 6);
  await page.getByRole('button', { name: '5月：2篇记录', exact: true }).click();
  assert.equal(await page.locator('.journal-record').count(), 2);
  const search = page.getByRole('searchbox', { name: '搜索作品或感受' });
  await search.pressSequentially('模拟记录 1');
  assert.equal(await search.inputValue(), '模拟记录 1', 'Search keeps focus through URL updates');
  assert.equal(await page.locator('.journal-record').count(), 1);
  await search.fill('没有这个作品');
  await page.getByText('没有符合筛选条件的记录。可清除筛选查看全年。', { exact: true }).waitFor();
  await page.getByRole('button', { name: '清除筛选', exact: true }).click();
  await page.waitForFunction(() => document.querySelectorAll('.journal-record').length === 6);
  assert.equal(await page.locator('.journal-record').count(), 6);
  await noOverflow(); await screenshot('codex_overview.png');

  await page.getByRole('button', { name: '保存概览图片', exact: true }).click();
  await preview();
  assert.equal(await page.locator('.journal-export-preview').evaluate(img => img.naturalWidth), 1080);
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: '下载当前页 PNG', exact: true }).click();
  const download = await downloadPromise;
  await download.saveAs(`${output}/codex_overview_export.png`);
  const chunks = []; for await (const chunk of await download.createReadStream()) chunks.push(chunk);
  const png = Buffer.concat(chunks);
  assert.equal(png.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
  assert.equal(png.readUInt32BE(16), 1080); assert.equal(png.readUInt32BE(20), 1680);
  await page.evaluate(() => {
    Object.defineProperty(navigator, 'canShare', { configurable: true, value: () => true });
    Object.defineProperty(navigator, 'share', { configurable: true, value: async () => { throw new DOMException('cancelled', 'AbortError'); } });
  });
  await page.getByRole('button', { name: '系统分享', exact: true }).click();
  await page.getByText('已取消分享，当前页仍可重试', { exact: true }).waitFor();
  await page.keyboard.press('Escape');
  assert.equal(await page.locator('dialog[open]').count(), 0);

  await seed(makeJournalFixtures('128')); await overview();
  assert.match(await page.locator('.journal-visible-count').innerText(), /已展开 5 篇.*全年 128 篇/);
  assert.equal(await page.locator('.journal-record').count(), 5);
  await page.getByRole('button', { name: /8 月 · 20 篇/ }).click();
  assert.equal(await page.locator('.journal-record').count(), 25);
  await page.getByRole('button', { name: /8 月 · 20 篇/ }).click();
  await noOverflow(); await screenshot('codex_many.png');
  await page.getByLabel('记录月份').selectOption('9');
  await page.getByRole('button', { name: '保存全年记录索引', exact: true }).click(); await preview();
  await page.getByText(/收录 128 篇正式记录/).waitFor();
  const totalPages = await page.getByLabel('导出页码').locator('option').count();
  assert.ok(totalPages > 1);
  await page.getByLabel('导出页码').selectOption({ value: String(totalPages - 1) }); await preview();
  await page.getByRole('img', { name: `2026 年度总结第 ${totalPages} 页预览`, exact: true }).waitFor();
  const lastDownload = page.waitForEvent('download');
  await page.getByRole('button', { name: '下载当前页 PNG', exact: true }).click();
  await (await lastDownload).saveAs(`${output}/codex_index_last.png`);
  await page.getByRole('button', { name: '关闭图片预览', exact: true }).click();

  await seed(makeJournalFixtures('45')); await overview();
  assert.equal(await page.locator('.journal-record').count(), 20);
  await page.getByRole('button', { name: '再显示 20 篇（5 月）', exact: true }).click();
  assert.equal(await page.locator('.journal-record').count(), 40);
  await page.getByRole('button', { name: '再显示 5 篇（5 月）', exact: true }).click();
  assert.equal(await page.locator('.journal-record').count(), 45);

  const long = makeJournalFixtures('long');
  await seed(long);
  const coverage = await page.evaluate(async ({ many, long }) => {
    const { journalEntries, journalMonths } = await import('/src/codex_yearbookModel.ts');
    const { planJournalPages, renderJournalPage, wrapJournalText } = await import('/src/codex_yearbookPages.ts');
    const annual = journalEntries(many, 2026);
    const index = await planJournalPages(2026, annual, 'index');
    const works = await planJournalPages(2026, long, 'works');
    const longPages = works.filter(p => p.entryIds.includes(long[0].id));
    const combined = longPages.flatMap(p => p.lines).join('');
    const boundary = journalEntries([{ ...long[0], createdAt: '2025-12-31T16:00:00.000Z' }], 2026).length;
    const noFutureType = journalEntries([{ ...long[0], type: 'month' }], 2026).length;
    const originalSegmenter = Intl.Segmenter;
    let fallback;
    try {
      Intl.Segmenter = undefined;
      const ctx = document.createElement('canvas').getContext('2d');
      ctx.font = '32px sans-serif';
      fallback = wrapJournalText(ctx, 'é👨‍👩‍👧‍👦'.repeat(40), 100).join('') === 'é👨‍👩‍👧‍👦'.repeat(40);
    } finally { Intl.Segmenter = originalSegmenter; }
    // Render the final continuation page to check the actual canvas path as well as the plan.
    const last = longPages.at(-1);
    const blob = await renderJournalPage(2026, long, last, works.indexOf(last), works.length);
    const reader = new FileReader(); const dataUrl = await new Promise(resolve => { reader.onload = () => resolve(reader.result); reader.readAsDataURL(blob); });
    return { total: annual.length, counts: journalMonths(annual), ids: [...new Set(index.flatMap(p => p.entryIds))],
      longPages: longPages.length, exactBody: combined.endsWith(long[0].content.replace(/\r\n?|\n/g, '')),
      boundary, noFutureType, fallback, dataUrl, indexPages: index.length, worksPages: works.length };
  }, { many: makeJournalFixtures('128'), long });
  assert.equal(coverage.total, 128); assert.equal(coverage.counts.reduce((a, b) => a + b), 128);
  assert.equal(coverage.ids.length, 128); assert.ok(coverage.longPages > 1); assert.equal(coverage.exactBody, true);
  assert.equal(coverage.boundary, 1); assert.equal(coverage.noFutureType, 0);
  assert.equal(coverage.fallback, true, 'Older WebViews keep all text without Intl.Segmenter');
  const { writeFile } = await import('node:fs/promises');
  await writeFile(`${output}/codex_long_last.png`, Buffer.from(coverage.dataUrl.split(',')[1], 'base64'));
  await page.goto(`${origin}/#/summary?year=2026&view=work&entry=codex-journal-0`);
  await page.locator('.journal-body').waitFor(); await noOverflow();
  await page.setViewportSize({ width: 1280, height: 900 }); await overview(); await noOverflow();
  await page.screenshot({ path: `${output}/codex_desktop.png`, fullPage: true });
  await page.goto('http://127.0.0.1:5174/codex-prototype.html');
  const app = page.frameLocator('#app');
  await app.getByRole('heading', { name: '我的音乐年记', exact: true }).waitFor();
  await app.locator('.journal-cover img').waitFor();
  await app.locator('.journal-cover img').evaluate(img => img.decode());
  await page.screenshot({ path: `${output}/codex_prototype.png`, fullPage: true });
  await app.getByRole('button', { name: '保存封面', exact: true }).click();
  await app.locator('.journal-export-preview').waitFor();
  await app.locator('.journal-export-preview').evaluate(img => img.decode());
  const coverDownload = page.waitForEvent('download');
  await app.getByRole('button', { name: '下载当前页 PNG', exact: true }).click();
  await (await coverDownload).saveAs(`${output}/codex_cover_export.png`);
  await app.getByRole('button', { name: '关闭图片预览', exact: true }).click();
  await page.locator('#scenario').selectOption('128');
  await app.getByText('128', { exact: true }).waitFor();
  await page.getByRole('button', { name: '年度总览', exact: true }).click();
  await app.getByRole('heading', { name: '年度总览', exact: true }).waitFor();
  await app.getByText(/已展开 5 篇.*全年 128 篇/).waitFor();
  await page.locator('#scenario').selectOption('0');
  await app.getByRole('heading', { name: '这一年还没有正式音乐记录', exact: true }).waitFor();
  await page.evaluate(() => localStorage.setItem('music-feelings-mobile-entries', '[{"id":"changed-data"}]'));
  await page.locator('#scenario').selectOption('6');
  await page.getByText('模拟记录已被修改或替换，未覆盖。请使用新的独立浏览器环境预览。', { exact: true }).waitFor();
  assert.equal(await page.evaluate(() => localStorage.getItem('music-feelings-mobile-entries')), '[{"id":"changed-data"}]');
  // A dedicated demo origin still refuses unmarked data; opening the prototype must not silently replace it.
  const guardContext = await browser.newContext(); const guard = await guardContext.newPage();
  await guard.goto('http://127.0.0.1:5174');
  await guard.evaluate(() => localStorage.setItem('music-feelings-mobile-entries', '[]'));
  await guard.goto('http://127.0.0.1:5174/codex-prototype.html');
  await guard.getByText('此预览地址已存在非演示数据，未覆盖。请使用独立浏览器环境。', { exact: true }).waitFor();
  assert.equal(await guard.evaluate(() => localStorage.getItem('music-feelings-mobile-entries')), '[]');
  await guardContext.close();
  assert.deepEqual(errors, []);
  console.log(`PASS: 0/1/6/128 records, 45 in one month, filters/navigation, long Unicode body, 128 unique sources in ${coverage.indexPages} index pages, 1080×1680 PNG, cancellation, mobile/desktop layout. All data simulated.`);
} finally { await browser.close(); }
