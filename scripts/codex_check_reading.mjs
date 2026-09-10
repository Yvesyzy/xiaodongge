import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { makeJournalFixtures } from '../mobile/codex_journal_fixtures.mjs';

// Browser plugin not available. Synthetic data in an isolated browser context only.
const origin = process.argv[2] || 'http://127.0.0.1:5180';
const output = process.env.CODEX_QA_DIR || 'D:/codex/.codex-home/visualizations/2026/09/05/01a06f8f-96fb-7e20-b8f6-bc4c8b62363f';
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, timezoneId: 'Asia/Shanghai' });
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await page.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
  await page.goto(origin);
  const entries = makeJournalFixtures('128');
  entries[0].content = '第一段原文。\n\n' + '这是长篇乐评原文，节奏和空间感来自真实记录。\n'.repeat(100) + '最后一段完整保留。';
  for (const type of ['month', 'year']) entries.push({ ...entries[0], id: `codex-reader-${type}`, type, title: `${type} 自述`, content: `完整的 ${type} 自述正文。` });
  await page.evaluate(items => { localStorage.clear(); sessionStorage.clear(); localStorage.setItem('music-feelings-mobile-entries', JSON.stringify(items)); }, entries);
  await page.goto(origin + '/#/search?q=' + encodeURIComponent('模拟记录'));
  await page.reload();
  await page.locator('.entry-card').first().waitFor();
  const count = await page.locator('.entry-card').count();
  assert.ok(count > 20);
  await page.locator('.entry-card').nth(10).scrollIntoViewIfNeeded();
  const listY = await page.evaluate(() => scrollY);
  const listUrl = page.url();
  await page.locator('.entry-card').nth(10).click();
  await page.locator('.codex-reader-toolbar').waitFor();
  assert.equal(await page.locator('.bottom-nav').isVisible(), false);
  assert.equal(await page.locator('.codex-reader-menu button').isVisible(), false);
  await page.getByRole('button', { name: '← 返回', exact: true }).click();
  await page.waitForURL(listUrl);
  await page.waitForFunction(y => Math.abs(scrollY - y) < 5, listY);
  assert.equal(await page.locator('.entry-card').count(), count);
  assert.equal(await page.getByPlaceholder('输入关键词').inputValue(), '模拟记录');

  await page.goto(origin + '/#/entries/' + entries[0].id);
  await page.locator('.codex-reader-toolbar').waitFor();
  await page.getByLabel('阅读字号').selectOption('large');
  await page.getByRole('button', { name: '深色', exact: true }).click();
  assert.equal(await page.locator('.content-card').first().evaluate(el => getComputedStyle(el).fontSize), '21px');
  for (const width of [320, 390, 1280]) {
    await page.setViewportSize({ width, height: 844 });
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `Reader fits ${width}px`);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: `${output}/codex_reader_dark_large.png` });
  await page.mouse.wheel(0, 700);
  await page.waitForFunction(() => scrollY > 500);
  const readY = await page.evaluate(() => scrollY);
  await page.getByRole('button', { name: '← 返回', exact: true }).click();
  await page.goto(origin + '/#/entries/' + entries[0].id);
  await page.getByRole('button', { name: '继续阅读', exact: true }).click();
  await page.waitForFunction(y => Math.abs(scrollY - y) < 5, readY, { timeout: 3000 }).catch(async error => { console.error({ expected: readY, actual: await page.evaluate(() => ({ y: scrollY, saved: localStorage.getItem('codex-reading-progress-v1') })) }); throw error; });
  assert.equal(await page.getByLabel('阅读字号').inputValue(), 'large');
  assert.equal(await page.locator('.codex-reader-dark').count(), 1);

  for (const type of ['song', 'album', 'month', 'year']) {
    const entry = entries.find(item => item.type === type);
    await page.goto(origin + '/#/entries/' + entry.id + '?share=1');
    await page.locator('.review-share-dialog').waitFor();
    assert.equal(await page.locator('.review-share-preview').isVisible(), true);
    await page.keyboard.press('Escape');
    await page.locator('.review-share-dialog').waitFor({ state: 'detached' });
  }
  await page.goto(origin + '/#/summary/2026/1');
  await page.getByRole('button', { name: '生成月度报告', exact: true }).click();
  await page.getByRole('button', { name: '更新月度报告', exact: true }).waitFor();
  await page.locator('.codex-reader-toolbar').getByRole('button', { name: '分享', exact: true }).click();
  await page.locator('.review-share-preview').waitFor();
  await page.keyboard.press('Escape');
  await page.screenshot({ path: `${output}/codex_month_reader.png` });
  const savedReport = await page.evaluate(() => localStorage.getItem('music-feelings-mobile-monthly-summaries'));
  await page.evaluate(async () => { const { store } = await import('/src/store.ts'); store.generateMonthlySummary = async () => { throw new Error('模拟保存失败'); }; });
  await page.getByRole('button', { name: '更新月度报告', exact: true }).click();
  await page.getByText('生成失败，已保留上一次报告：模拟保存失败', { exact: true }).waitFor();
  assert.equal(await page.evaluate(() => localStorage.getItem('music-feelings-mobile-monthly-summaries')), savedReport);
  assert.deepEqual(await page.evaluate(() => JSON.parse(localStorage.getItem('music-feelings-mobile-entries'))), entries, 'Reading and sharing never mutate reviews');
  assert.equal(await page.locator('vite-error-overlay').count(), 0);
  assert.deepEqual(errors, []);
  console.log('PASS reading: search query/result/scroll return; hidden app navigation and delete menu; persistent large/dark preferences and continue reading; 320/390/1280px; all four types share; monthly generation/share; reviews unchanged; no runtime errors.');
} finally { await browser.close(); }
