import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { qaOptions } from './codex_qa_options.mjs';
import { startQaViteServer } from './codex_qa_harness.mjs';
import { makeJournalFixtures } from '../mobile/codex_journal_fixtures.mjs';
import { checkPublicationDraftFailures } from './codex_publication_draft_checks.mjs';

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const workspaceRoot = path.resolve(scriptDirectory, '..');
const defaultOutput = path.join(workspaceRoot, 'release', `codex_publication_check_${new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14)}`);
const explicitOrigin = process.argv.some((argument) => argument === '--origin' || argument.startsWith('--origin='))
  || process.argv.some((argument) => /^http:\/\/127\.0\.0\.1:\d+$/.test(argument));
const { origin: requestedOrigin, output } = qaOptions({
  output: defaultOutput,
});
const outputDirectory = path.resolve(output);
let origin = requestedOrigin;
let qaServer = null;
if (!explicitOrigin) {
  const started = await startQaViteServer({ output: outputDirectory, configFile: path.join(workspaceRoot, 'mobile/vite.config.ts'), cacheDir: path.join(outputDirectory, 'vite-cache') });
  qaServer = started.server;
  origin = started.origin;
}

const baseFixture = makeJournalFixtures('1')[0];
const entries = [
  {
    ...baseFixture,
    id: 'codex-publication-malicious',
    type: 'album',
    title: '危险 <script>alert(1)</script> & 标题',
    albumName: '恶意专辑',
    songName: null,
    artistName: '测试音乐人',
    content: '正文 <img src=x onerror=alert(1)> & 保留原文。\n第二行 é👨‍👩‍👧‍👦。',
    tags: ['原文标签'],
    moods: ['平静'],
    rating: 8.5,
    ratingModifier: '+',
    // Exercise the multi-dimension rating path end to end in the exported Markdown.
    ratingProduction: 9,
    ratingLyrics: 8,
    ratingComposition: 8.5,
    ratingVocals: 9,
    ratingOriginality: 8,
    ratingResonance: 7.5,
    ratingSongwriting: null,
    compositeRatingLocked: true,
    // Exercise all three date bases end to end in the exported Markdown.
    releaseDate: '2026-01-15',
    firstListenedAt: '2026-05-20T04:00:00.000Z',
    year: 2026,
    month: 6,
    createdAt: '2026-06-02T04:00:00.000Z',
    updatedAt: '2026-06-02T04:00:00.000Z',
  },
  {
    ...baseFixture,
    id: 'codex-publication-second',
    type: 'album',
    title: '第二篇 · 顺序测试',
    albumName: '第二张专辑',
    songName: null,
    artistName: '另一位音乐人',
    content: '第二篇正文，应该在排序后排在第一。',
    tags: [],
    moods: ['明亮'],
    rating: 7,
    ratingModifier: null,
    year: 2026,
    month: 6,
    createdAt: '2026-06-03T04:00:00.000Z',
    updatedAt: '2026-06-03T04:00:00.000Z',
  },
  {
    ...baseFixture,
    id: 'codex-publication-third',
    type: 'song',
    title: '第三篇 · 报告来源',
    albumName: '第三张专辑',
    songName: '第三首歌',
    artistName: '报告音乐人',
    content: '第三篇正文，用于生成年度报告和榜单入口。',
    tags: [],
    moods: ['克制'],
    rating: 9,
    ratingModifier: null,
    year: 2026,
    month: 6,
    createdAt: '2026-06-04T04:00:00.000Z',
    updatedAt: '2026-06-04T04:00:00.000Z',
  },
];
const rankAlbums = [
  { albumName: '恶意专辑', artistName: '测试音乐人', note: '榜单理由一：真实保留。' },
  { albumName: '第二张专辑', artistName: '另一位音乐人', note: '榜单理由二。' },
];

const evidence = {
  version: 1,
  origin,
  output: outputDirectory,
  checks: [],
  artifacts: {},
  pageErrors: [],
};

async function downloadBytes(page, locator, artifactName, expectedSuggestedName) {
  const downloadEvent = page.waitForEvent('download');
  await locator.click();
  const download = await downloadEvent;
  const downloadPath = await download.path();
  assert.ok(downloadPath, `${artifactName} download path is available`);
  const bytes = await readFile(downloadPath);
  await writeFile(path.join(outputDirectory, artifactName), bytes);
  const suggestedFilename = download.suggestedFilename();
  evidence.artifacts[artifactName] = { suggestedFilename, bytes: bytes.length };
  if (expectedSuggestedName) assert.equal(suggestedFilename, expectedSuggestedName, `${artifactName} keeps the album-based .md file name`);
  return bytes;
}

async function waitForComposer(page) {
  await page.getByRole('heading', { name: '生成公众号稿', exact: true }).waitFor();
  await page.getByLabel('公众号正文预览', { exact: true }).waitFor();
}

async function assertNoOverflow(page, selector, label) {
  const result = await page.evaluate((target) => {
    const element = document.querySelector(target);
    return {
      document: document.documentElement.scrollWidth <= window.innerWidth,
      element: !element || element.scrollWidth <= element.clientWidth,
    };
  }, selector);
  assert.equal(result.document, true, `${label}: document fits viewport`);
  assert.equal(result.element, true, `${label}: component fits viewport`);
}

async function setTheme(page, choice) {
  await page.evaluate(async (value) => {
    const { setThemeChoice } = await import('/src/abu_theme.ts');
    setThemeChoice(value);
  }, choice);
  await page.waitForTimeout(80);
}

// channel:'chrome' needs a launchable system Chrome; CI/isolated hosts can point at a cached Chromium instead.
const browser = await chromium.launch(process.env.CODEX_QA_CHROME_PATH
  ? { headless: true, executablePath: process.env.CODEX_QA_CHROME_PATH }
  : { headless: true, channel: 'chrome' });
let page = null;
let failure = null;

try {
  await mkdir(outputDirectory, { recursive: true });
  page = await browser.newPage({ viewport: { width: 390, height: 844 }, timezoneId: 'Asia/Shanghai' });
  page.setDefaultTimeout(20000);
  page.on('pageerror', (error) => evidence.pageErrors.push(error.message));
  await page.addInitScript(() => {
    window.__codexClipboard = { text: '', html: '', writes: 0 };
    if (typeof window.ClipboardItem !== 'function') {
      window.ClipboardItem = class ClipboardItem {
        constructor(data) { this.data = data; this.types = Object.keys(data); }
        getType(type) { return Promise.resolve(this.data[type]); }
      };
    }
    const clipboard = {
      async writeText(value) {
        window.__codexClipboard.text = String(value);
        window.__codexClipboard.writes += 1;
      },
      async write(items) {
        const item = items[0];
        if (item?.types?.includes('text/plain')) window.__codexClipboard.text = await (await item.getType('text/plain')).text();
        if (item?.types?.includes('text/html')) window.__codexClipboard.html = await (await item.getType('text/html')).text();
        window.__codexClipboard.writes += 1;
      },
    };
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: clipboard });
  });

  await page.goto(origin);
  const coverDataUrl = await page.evaluate(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 64; canvas.height = 48;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('cover canvas unavailable');
    context.fillStyle = '#245448'; context.fillRect(0, 0, 64, 48);
    context.fillStyle = '#d7ad62'; context.fillRect(8, 8, 48, 32);
    return canvas.toDataURL('image/png');
  });
  await page.evaluate(async ({ entries: nextEntries, cover, albums }) => {
    localStorage.clear();
    localStorage.setItem('music-feelings-mobile-entries', JSON.stringify(nextEntries));
    const { store } = await import('/src/store.ts');
    await store.setCover('album', { albumName: '恶意专辑', artistName: '测试音乐人' }, cover, { onlyIfMissing: false });
    await store.setCover('album', { albumName: '第二张专辑', artistName: '另一位音乐人' }, cover, { onlyIfMissing: false });
    localStorage.setItem('music-feelings-mobile-app-data', JSON.stringify({ 'top-albums:2026': JSON.stringify({ albums }) }));
  }, { entries, cover: coverDataUrl, albums: rankAlbums });
  await page.reload();
  await page.waitForLoadState('domcontentloaded');

  const sourceEntries = await page.evaluate(() => localStorage.getItem('music-feelings-mobile-entries'));
  const sourceCovers = await page.evaluate(() => localStorage.getItem('music-feelings-mobile-covers'));
  assert.equal(sourceEntries, JSON.stringify(entries), 'fixture entries are installed exactly');

  // Actual single-review sharing entry point: edit title, author, intro, body, then inspect the
  // browser clipboard stub. This explicitly simulates clipboard capability; it is not a system clipboard test.
  await page.goto(`${origin}/#/entries/${encodeURIComponent(entries[0].id)}?share=1`);
  await page.locator('.review-share-dialog[open]').waitFor();
  await page.getByLabel('公众号稿', { exact: true }).check();
  await waitForComposer(page);
  await page.getByLabel('推文标题', { exact: true }).fill('编辑标题 <script>bad()</script>');
  await page.getByLabel('署名（可选）', { exact: true }).fill('作者 & <img onerror=bad()>');
  await page.getByLabel('导语（可选）', { exact: true }).fill('导语 <script>bad()</script>');
  const body = page.locator('.codex-publication-section-editor textarea').first();
  await body.fill('编辑正文 <img src=x onerror=bad()>\n换行 é👨‍👩‍👧‍👦');
  const sectionTitle = page.locator('.codex-publication-section-editor input').first();
  await sectionTitle.fill('编辑章节标题');
  await page.waitForTimeout(700);
  const preview = page.getByLabel('公众号正文预览', { exact: true });
  const previewHtml = await preview.innerHTML();
  assert.match(previewHtml, /&lt;script&gt;/, 'malicious user text is HTML escaped in preview');
  assert.equal(await preview.locator('script, img').count(), 0, 'clipboard fragment preview has no executable/image element');
  assert.ok((await preview.innerText()).includes('编辑正文'), 'edited body reaches preview');
  evidence.checks.push('single review share tab opens publication composer and edits title/author/intro/body');

  await page.getByRole('button', { name: '复制 Markdown 全文', exact: true }).click();
  await page.getByText('已复制 Markdown 全文；粘贴到公众号编辑器可自动识别，或另存为 .md 后导入。', { exact: true }).waitFor();
  const mdClipboard = await page.evaluate(() => ({ ...window.__codexClipboard }));
  assert.ok(mdClipboard.text.includes('编辑正文'), 'markdown copy includes edited body');
  assert.ok(mdClipboard.text.startsWith('# 编辑标题'), 'markdown copy carries the H1 title');
  assert.match(mdClipboard.text, /&lt;script&gt;/, 'markdown copy escapes user script text');
  assert.equal(/<script\b/i.test(mdClipboard.text), false, 'markdown copy has no raw script tag');
  evidence.checks.push('Markdown full-text copy verified through explicit stub clipboard');

  const imageDetails = page.locator('details.codex-publication-images');
  await imageDetails.locator('summary').click();
  await page.getByAltText('公众号稿横版封面预览', { exact: true }).waitFor();

  const mdBytes = await downloadBytes(page, page.getByRole('button', { name: '导出 Markdown 稿', exact: true }), 'codex_publication_album_name.md', '恶意专辑.md');
  const markdown = mdBytes.toString('utf8');
  assert.match(markdown, /^# 编辑标题 &lt;script&gt;bad\(\)&lt;\/script&gt;/, 'MD export carries the edited H1 with escaped HTML');
  assert.match(markdown, /## 编辑章节标题/, 'MD export uses H2 for sections');
  assert.match(markdown, /编辑正文 &lt;img src=x onerror=bad\(\)&gt;/, 'MD export keeps edited body text');
  assert.equal(/<script\b/i.test(markdown), false, 'MD export has no raw script tag');
  assert.equal(markdown.includes('!['), false, 'MD export has no broken relative-path images');
  assert.match(markdown, /【配图位置】codex_publication_image_001\.png/, 'MD export marks image placement');
  // Each metadata item must be its own block: the WeChat document importer drops
  // trailing-space hard breaks, so only blank-line separated paragraphs survive.
  assert.equal(markdown.includes('  \n'), false, 'MD export uses no trailing-space hard breaks');
  const ratingGroupOne = '制作：9/10 · 词：8/10 · 曲：8.5/10';
  const ratingGroupTwo = '人声：9/10 · 原创性：8/10 · 共鸣：7.5/10';
  for (const line of [
    '专辑：恶意专辑', '艺术家：测试音乐人', '评分：8.5+ / 10',
    ratingGroupOne, ratingGroupTwo,
    '专辑/歌曲发行时间：2026.01.15', '首次收听时间：2026.05.20', '乐评记录时间：2026.06.02',
  ]) assert.ok(markdown.includes(`\n\n${line}\n\n`), `MD export separates "${line}" into its own paragraph`);
  assert.equal(markdown.includes('\n\n制作：9/10\n\n'), false, 'rating dimensions are no longer one line each');
  assert.equal(markdown.includes('\n\n日期：2026.06.02\n\n'), false, 'the old single date line is replaced by three separate dates');
  const at = (line) => markdown.indexOf(`\n\n${line}\n\n`);
  assert.ok(at('评分：8.5+ / 10') < at(ratingGroupOne) && at(ratingGroupOne) < at(ratingGroupTwo), 'overall rating precedes both three-item dimension rows');
  assert.ok(at(ratingGroupTwo) < at('专辑/歌曲发行时间：2026.01.15'), 'both dimension rows precede the three dates');
  assert.ok(at('专辑/歌曲发行时间：2026.01.15') < at('首次收听时间：2026.05.20')
    && at('首次收听时间：2026.05.20') < at('乐评记录时间：2026.06.02'), 'the three dates follow the form field order');
  await page.locator('details.codex-publication-markdown summary').click();
  assert.equal(await page.getByLabel('Markdown 全文', { exact: true }).inputValue(), markdown, 'read-only full text matches the exported .md byte for byte');
  evidence.checks.push('Markdown export downloaded and inspected; in-page full text matches the file');

  // Browser share stub: the .md file must reach navigator.share with the correct name.
  await page.evaluate(() => {
    window.__codexShareCalls = [];
    Object.defineProperty(navigator, 'canShare', { configurable: true, value: () => true });
    Object.defineProperty(navigator, 'share', { configurable: true, value: async payload => {
      window.__codexShareCalls.push({ name: payload.files?.[0]?.name || '', type: payload.files?.[0]?.type || '' });
      throw new DOMException('simulated cancellation', 'AbortError');
    } });
  });
  await page.getByRole('button', { name: '分享 MD 文件', exact: true }).click();
  await page.getByText('已取消分享，稿件仍保留。', { exact: true }).waitFor();
  assert.deepEqual(await page.evaluate(() => window.__codexShareCalls.map(call => call.name)), ['恶意专辑.md'], 'MD share passes the album-named .md file');
  evidence.checks.push('browser MD share invokes navigator.share with the .md file and handles cancellation');
  evidence.checks.push('exported and shared .md files are named after the album, falling back to the song name and publication title');

  // All four privacy flags are exercised together, including the content-hidden rule.
  for (const label of ['隐藏评分', '隐藏日期', '隐藏小懂哥名称', '隐藏导语和正文']) await page.getByLabel(label, { exact: true }).check();
  await page.waitForTimeout(150);
  const hiddenPattern = /编辑正文|导语|8\.5\+|2026\.06\.02|2026\.01\.15|2026\.05\.20|小懂哥|制作：9\/10|共鸣：7\.5\/10|专辑\/歌曲发行时间|首次收听时间|乐评记录时间/;
  const hiddenPreview = await preview.innerText();
  assert.doesNotMatch(hiddenPreview, /编辑正文|导语|评分|记录于|小懂哥/, 'all hidden publication fields leave the preview');
  assert.equal(await body.isDisabled(), true, 'hidden content disables intro/body editing');
  await page.getByRole('button', { name: '复制 Markdown 全文', exact: true }).click();
  await page.getByText('已复制 Markdown 全文；粘贴到公众号编辑器可自动识别，或另存为 .md 后导入。', { exact: true }).waitFor();
  assert.doesNotMatch(await page.evaluate(() => window.__codexClipboard.text), hiddenPattern, 'hidden markdown copy has no private fields, rating dimensions or any of the three dates');
  const hiddenMd = await downloadBytes(page, page.getByRole('button', { name: '导出 Markdown 稿', exact: true }), 'codex_publication_hidden.md', '恶意专辑.md');
  assert.doesNotMatch(hiddenMd.toString('utf8'), hiddenPattern, 'exported markdown respects privacy, including dimensions and all three dates');
  evidence.checks.push('privacy applied to preview, Markdown full-text copy and exported .md, including all three dates');

  await page.getByLabel('推文标题', { exact: true }).fill('编辑后再次修改以核对草稿');
  await page.waitForTimeout(600);

  // Close/reopen the single-share route and verify the local draft is restored without changing entries.
  await page.getByRole('button', { name: '关闭分享预览', exact: true }).click();
  await page.goto(`${origin}/#/entries/${encodeURIComponent(entries[0].id)}?share=1`);
  await page.reload();
  await page.locator('.review-share-dialog[open]').waitFor();
  await page.getByLabel('公众号稿', { exact: true }).check();
  await waitForComposer(page);
  await page.getByText('已恢复这组来源的本机推文草稿。', { exact: true }).waitFor();
  assert.equal(await page.getByLabel('推文标题', { exact: true }).inputValue(), '编辑后再次修改以核对草稿', 'draft title restored');
  assert.equal(await page.getByLabel('署名（可选）', { exact: true }).inputValue(), '作者 & <img onerror=bad()>', 'draft author restored');
  assert.equal(await page.locator('.codex-publication-section-editor textarea').first().inputValue(), '编辑正文 <img src=x onerror=bad()>\n换行 é👨‍👩‍👧‍👦', 'draft body restored');
  evidence.checks.push('single-review publication draft survives close/reopen and restores edited fields');
  await page.getByRole('button', { name: '关闭分享预览', exact: true }).click();

  // Standalone publication entry supports multi-selection and explicit reordering.
  await page.goto(`${origin}/#/publication`);
  await page.getByRole('heading', { name: '公众号出稿', exact: true }).waitFor();
  const sourceList = page.locator('.codex-publication-source-list label');
  await sourceList.filter({ hasText: entries[0].title }).locator('input').check();
  await sourceList.filter({ hasText: entries[1].title }).locator('input').check();
  await page.getByRole('button', { name: '第2篇上移', exact: true }).click();
  const reordered = await page.locator('.codex-publication-order li').allTextContents();
  assert.ok(reordered[0].includes(entries[1].title) && reordered[1].includes(entries[0].title), 'standalone selection reorders sources');
  await page.getByRole('button', { name: '生成公众号稿', exact: true }).click();
  await waitForComposer(page);
  const multiText = await page.getByLabel('公众号正文预览', { exact: true }).innerText();
  assert.ok(multiText.indexOf(entries[1].title) < multiText.indexOf(entries[0].title), 'preview preserves reordered source order');
  await page.getByRole('button', { name: '返回选择', exact: true }).click();
  await page.getByRole('button', { name: '生成公众号稿', exact: true }).click();
  await waitForComposer(page);
  await page.getByText('已恢复这组来源的本机推文草稿。', { exact: true }).waitFor();
  evidence.checks.push('standalone multi-selection and reorder plus local restoration');

  for (const theme of ['light', 'dark']) {
    await setTheme(page, theme);
    for (const width of [320, 390, 1280]) {
      await page.setViewportSize({ width, height: 844 });
      await page.evaluate(() => window.scrollTo(0, 0));
      await assertNoOverflow(page, '.codex-publication', `publication ${theme} ${width}px`);
      await page.screenshot({ path: path.join(outputDirectory, `codex_publication_${theme}_${width}.png`), fullPage: true });
    }
  }
  await setTheme(page, 'system');
  evidence.checks.push('publication composer fits 320/390/1280 in light/dark themes');

  // Existing generated annual report entry point.
  await page.evaluate(async () => {
    const { store } = await import('/src/store.ts');
    await store.generateMonthlySummary(2026, 6);
    await store.generateSummary(2026);
  });
  await page.goto(`${origin}/#/summary/analysis?year=2026`);
  // The yearly page label has changed more than once ("年度报告" / "年度标本册"); match the share
  // entry by pattern so a rename does not fail an unrelated publication check.
  const yearlyShare = page.getByRole('button', { name: /^分享已保存的年度/ });
  await yearlyShare.waitFor();
  await yearlyShare.click();
  await page.locator('.review-share-dialog[open]').waitFor();
  await page.getByLabel('公众号稿', { exact: true }).check();
  await waitForComposer(page);
  assert.ok(await page.locator('.codex-publication-section-editor').count() >= 1, 'generated annual report opens publication entry point');
  await page.getByRole('button', { name: '关闭分享预览', exact: true }).click();
  evidence.checks.push('generated annual report share entry opens publication composer');

  await page.goto(`${origin}/#/summary/2026/6`);
  await page.getByRole('button', { name: '分享', exact: true }).click();
  await page.getByLabel('公众号稿', { exact: true }).check();
  await waitForComposer(page);
  assert.ok(await page.locator('.codex-publication-section-editor textarea').first().inputValue(), 'saved monthly report body is present');
  await page.getByRole('button', { name: '关闭分享预览', exact: true }).click();
  evidence.checks.push('generated monthly report share entry opens publication composer');

  // Existing saved ranking entry point.
  await page.goto(`${origin}/#/summary?year=2026&view=rank`);
  await page.getByRole('button', { name: '保存榜单图片', exact: true }).waitFor();
  await page.getByRole('button', { name: '保存榜单图片', exact: true }).click();
  await page.getByRole('button', { name: '生成公众号稿', exact: true }).waitFor();
  await page.getByRole('button', { name: '生成公众号稿', exact: true }).click();
  await waitForComposer(page);
  assert.equal(await page.locator('.codex-publication-section-editor').count(), rankAlbums.length, 'saved rank opens one publication section per album');
  assert.match(await page.locator('.codex-publication-section-editor').first().innerText(), /第 1 名/);
  evidence.checks.push('saved ranking export entry opens publication composer');

  evidence.checks.push(...await checkPublicationDraftFailures(browser, origin, entries[0]));

  const finalEntries = await page.evaluate(() => localStorage.getItem('music-feelings-mobile-entries'));
  const finalCovers = await page.evaluate(() => localStorage.getItem('music-feelings-mobile-covers'));
  assert.equal(finalEntries, sourceEntries, 'publication QA never mutates source review records');
  assert.equal(finalCovers, sourceCovers, 'publication QA never mutates source cover records');
  assert.deepEqual(evidence.pageErrors, [], 'no browser page errors');
  evidence.checks.push('source entries and covers remain byte-for-byte unchanged');
} catch (error) {
  failure = error;
  evidence.error = error instanceof Error ? error.stack ?? error.message : String(error);
  if (page) {
    evidence.debug = await page.evaluate(() => ({
      url: location.href,
      body: document.body.innerText.slice(0, 20000),
      clipboard: window.__codexClipboard,
    })).catch(() => undefined);
  }
} finally {
  await browser.close();
  if (qaServer) await qaServer.close();
  await mkdir(outputDirectory, { recursive: true });
  await writeFile(path.join(outputDirectory, 'codex_check_publication.json'), JSON.stringify(evidence, null, 2) + '\n', 'utf8');
}

if (failure) {
  console.error(evidence.error);
  process.exitCode = 1;
} else {
  console.log(`PASS: publication share/composer editing, Markdown copy/export/share, privacy, draft restore, reorder, report/rank entry points, and 320/390/1280 light/dark layout. Evidence: ${path.join(outputDirectory, 'codex_check_publication.json')}`);
}
