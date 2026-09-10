import { mkdir, readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import process from 'node:process';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const origin = process.argv[2] || 'http://127.0.0.1:5180';
const repo = process.cwd();
const output = process.env.CODEX_REVIEW_SHARE_QA_DIR || 'D:/codex/.codex-home/visualizations/2026/09/05/01a06f8f-96fb-7e20-b8f6-bc4c8b62363f';
const ENTRY_TYPE_LABELS = { year: '年度', month: '月份', album: '专辑', song: '歌曲' };
const longBody = '第一行 é👨‍👩‍👧‍👦。\n第二行保留换行和连续原文。'.repeat(180);

function fixture(type, index, content = `这是${type}记录的正文。`) {
  return {
    id: `review-share-${type}-${index}`,
    type,
    title: `${type}分享测试标题 ${index}`,
    year: 2026,
    month: type === 'year' ? null : type === 'month' ? 5 : 6,
    albumName: type === 'album' ? `分享专辑 ${index}` : type === 'song' ? `分享专辑 ${index}` : null,
    songName: type === 'song' ? `分享歌曲 ${index}` : null,
    artistName: type === 'song' || type === 'album' ? '测试音乐人' : null,
    musicMetadata: null,
    content,
    tags: ['连续原文'],
    moods: ['平静'],
    rating: 8.5,
    ratingModifier: '+',
    ratingProduction: null,
    ratingSongwriting: null,
    ratingOriginality: null,
    ratingResonance: null,
    compositeRatingLocked: false,
    firstListenedAt: '2026-06-01T00:00:00.000Z',
    listenedAt: '2026-06-01T00:00:00.000Z',
    createdAt: '2026-06-01T00:00:00.000Z',
    updatedAt: '2026-06-01T00:00:00.000Z',
  };
}

async function waitForServer(url) {
  const deadline = Date.now() + 30000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {
      // Vite is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`开发服务器未在 ${url} 启动`);
}


const entries = [fixture('song', 1, longBody), fixture('album', 2), fixture('month', 3), fixture('year', 4)];
const browser = await chromium.launch({ headless: true, channel: 'chrome' });
try {
  await mkdir(output, { recursive: true });
  await waitForServer(origin);
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, timezoneId: 'Asia/Shanghai' });
  page.setDefaultTimeout(15000);
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(origin);
  await page.evaluate((items) => localStorage.setItem('music-feelings-mobile-entries', JSON.stringify(items)), entries);

  const sourceBefore = JSON.stringify(entries);
  const coverage = await page.evaluate(async (items) => {
    const { planJournalPages } = await import('/src/codex_yearbookPages.ts');
    const pagesByType = {};
    for (const entry of items) {
      const pages = await planJournalPages(entry.year, [entry], 'works', { review: true });
      pagesByType[entry.type] = {
        pages: pages.length,
        ids: [...new Set(pages.flatMap((page) => page.entryIds))],
        containsContent: pages.flatMap((page) => page.lines).join('').includes(entry.content.replace(/\r\n?|\n/g, '')),
      };
    }
    return pagesByType;
  }, entries);
  for (const entry of entries) {
    assert.deepEqual(coverage[entry.type].ids, [entry.id], `${entry.type} pages keep one work identifier`);
    assert.equal(coverage[entry.type].containsContent, true, `${entry.type} full body is present`);
  }
  assert.ok(coverage.song.pages > 1, 'long song body is paginated');
  const empty = await page.evaluate(async entry => {
    const { planJournalPages } = await import('/src/codex_yearbookPages.ts');
    const { buildReviewExcerpt } = await import('/src/codex_ReviewShare.tsx');
    return { pages: (await planJournalPages(entry.year, [{ ...entry, content: '' }], 'works', { review: true })).length, excerpt: buildReviewExcerpt('').text };
  }, entries[0]);
  assert.deepEqual(empty, { pages: 1, excerpt: '' }, 'empty original content remains exportable');

  await page.goto(`${origin}/#/entries/${entries[0].id}?share=1`);
  await page.locator('.review-share-dialog[open]').waitFor();
  await page.locator('.review-share-preview').waitFor();
  assert.equal(await page.locator('input[type="radio"][name="review-share-mode"]').first().isChecked(), true, 'excerpt mode is default');
  for (const width of [320, 390, 1280]) {
    await page.setViewportSize({ width, height: 844 });
    assert.ok(await page.locator('.review-share-dialog').evaluate(el => el.scrollWidth <= el.clientWidth), `Share fits ${width}px`);
    assert.ok(await page.getByLabel('隐藏评分', { exact: true }).evaluate(el => el.parentElement.getBoundingClientRect().height < 60), 'Checkbox label stays on one line');
  }
  await page.setViewportSize({ width: 390, height: 844 });

  const excerptSource = await page.locator('[data-source-excerpt]').getAttribute('data-source-excerpt');
  assert.ok(excerptSource && entries[0].content.includes(excerptSource), 'default excerpt is a contiguous source substring');
  const rangeLength = Math.min(48, Math.max(1, Array.from(entries[0].content).length));
  await page.locator('#review-share-excerpt-length').fill(String(rangeLength));
  const rangeStartMax = Math.max(0, Array.from(entries[0].content).length - rangeLength);
  await page.locator('#review-share-excerpt-start').fill(String(Math.min(9, rangeStartMax)));
  const selectedExcerpt = await page.locator('[data-source-excerpt]').getAttribute('data-source-excerpt');
  assert.ok(selectedExcerpt && entries[0].content.includes(selectedExcerpt), 'selected excerpt stays contiguous in original');
  assert.equal(await page.locator('.review-share-preview').getByText('连续原文', { exact: true }).count(), 0, 'preview uses original excerpt rather than a tag');

  await page.getByLabel('深色', { exact: true }).check();
  assert.equal(await page.locator('.review-share-preview').getAttribute('data-theme'), 'dark');
  await page.getByLabel('隐藏评分', { exact: true }).check();
  await page.getByLabel('隐藏日期', { exact: true }).check();
  await page.getByLabel('隐藏小懂哥名称', { exact: true }).check();
  assert.doesNotMatch(await page.locator('.review-share-accessible').textContent(), /评分|记录于|小懂哥/);

  let copied = '';
  await page.evaluate(() => Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async (value) => { window.__codexCopied = value; } } }));
  await page.getByRole('button', { name: '复制分享文字', exact: true }).click();
  copied = await page.evaluate(() => window.__codexCopied || '');
  assert.ok(copied.includes(entries[0].content), 'copy text retains full original body');
  assert.doesNotMatch(copied, /评分|记录于|小懂哥/);

  await page.evaluate(() => Object.defineProperty(navigator, 'share', { configurable: true, value: async () => { throw new DOMException('cancelled', 'AbortError'); } }));
  await page.evaluate(() => Object.defineProperty(navigator, 'canShare', { configurable: true, value: () => true }));
  await page.getByRole('button', { name: '系统分享', exact: true }).click();
  await page.getByText('已取消分享，当前设置已保留', { exact: true }).waitFor();
  assert.equal(await page.getByLabel('深色', { exact: true }).isChecked(), true, 'cancel keeps selected theme');
  assert.equal(await page.getByLabel('隐藏评分', { exact: true }).isChecked(), true, 'cancel keeps privacy settings');
  await page.locator('.review-share-image').scrollIntoViewIfNeeded();
  await page.locator('.review-share-image').evaluate(image => image.decode());
  const previewHash = await page.locator('.review-share-image').evaluate(async image => {
    const bytes = await (await fetch(image.src)).arrayBuffer();
    return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), byte => byte.toString(16).padStart(2, '0')).join('');
  });
  const downloadEvent = page.waitForEvent('download');
  await page.getByRole('button', { name: '下载摘录卡', exact: true }).click();
  const download = await downloadEvent;
  assert.equal(createHash('sha256').update(await readFile(await download.path())).digest('hex'), previewHash, 'download matches the actual preview image exactly');
  await page.evaluate(() => Object.defineProperty(navigator, 'share', { configurable: true, value: async value => { window.__codexSharePayload = { hasText: 'text' in value, files: value.files.length }; } }));
  await page.getByRole('button', { name: '系统分享', exact: true }).click();
  assert.deepEqual(await page.evaluate(() => window.__codexSharePayload), { hasText: false, files: 1 }, 'excerpt sharing never includes the full private body');
  await page.locator('.review-share-dialog').screenshot({ path: path.join(output, 'codex_review_share_excerpt.png') });

  await page.getByLabel('完整分页', { exact: true }).check();
  await page.locator('.review-journal-export .journal-export-preview').waitFor();
  assert.ok(await page.locator('.review-journal-export [aria-label="导出页码"] option').count() > 1, 'full review preview exposes all pages');
  await page.locator('.journal-export-preview').scrollIntoViewIfNeeded();
  await page.locator('.review-share-dialog').screenshot({ path: path.join(output, 'codex_review_share_song.png') });

  for (const entry of entries.slice(1)) {
    await page.goto(`${origin}/#/entries/${entry.id}?share=1`);
    await page.locator('.review-share-dialog[open]').waitFor();
    await page.locator('.review-share-preview').waitFor();
    assert.equal(await page.locator('.review-share-preview').getByText(ENTRY_TYPE_LABELS[entry.type] ?? '', { exact: false }).count() > 0, true, `${entry.type} preview renders`);
  }
  assert.deepEqual(await page.evaluate(() => JSON.parse(localStorage.getItem('music-feelings-mobile-entries')), entries), entries, 'stored entries remain unchanged');
  assert.deepEqual(JSON.stringify(entries), sourceBefore, 'fixture objects remain unchanged');
  assert.deepEqual(errors, [], 'no browser errors');
  console.log(`PASS: four entry types, contiguous selectable excerpt, full-body paginated review, paper/dark themes, privacy, copy, cancellation preservation. Screenshots: ${output}`);
} finally {
  await browser.close();
}
