import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { chromium } from 'playwright';
import { qaOptions } from './codex_qa_options.mjs';
import { startQaViteServer } from './codex_qa_harness.mjs';
import { makeJournalFixtures } from '../mobile/codex_journal_fixtures.mjs';
import { checkPublicationDraftFailures } from './codex_publication_draft_checks.mjs';

const execFileAsync = promisify(execFile);
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

const execPython = async (argumentsList) => {
  try {
    return await execFileAsync('python', argumentsList, { cwd: workspaceRoot, windowsHide: true, maxBuffer: 2 * 1024 * 1024 });
  } catch (firstError) {
    if (firstError?.code !== 'ENOENT') throw firstError;
    return execFileAsync('python3', argumentsList, { cwd: workspaceRoot, windowsHide: true, maxBuffer: 2 * 1024 * 1024 });
  }
};

async function inspectZip(zipPath) {
  const python = String.raw`
import io
import json
import sys
import zipfile

path = sys.argv[1]
with zipfile.ZipFile(path, "r") as archive:
    names = archive.namelist()
    if archive.testzip() is not None:
        raise RuntimeError("CRC校验失败")
    if any((name in ("", ".", "..") or "/" in name or "\\\\" in name or ".." in name) for name in names):
        raise RuntimeError("ZIP文件名包含路径风险")
    result = {"names": names, "sizes": {name: archive.getinfo(name).file_size for name in names}, "images": {}, "texts": {}}
    for name in names:
        if name.lower().endswith((".html", ".txt")):
            result["texts"][name] = archive.read(name).decode("utf-8")
        if name.lower().endswith(".png"):
            data = archive.read(name)
            if data[:8] != b"\x89PNG\r\n\x1a\n":
                raise RuntimeError("ZIP中PNG签名无效")
            image = {"width": int.from_bytes(data[16:20], "big"), "height": int.from_bytes(data[20:24], "big"), "pillow": False}
            try:
                from PIL import Image
                with Image.open(io.BytesIO(data)) as decoded:
                    decoded.verify()
                image["pillow"] = True
            except ImportError:
                pass
            result["images"][name] = image
print(json.dumps(result, ensure_ascii=True))
`;
  const { stdout } = await execPython(['-c', python, zipPath]);
  return JSON.parse(stdout.trim());
}

async function downloadBytes(page, locator, artifactName) {
  const downloadEvent = page.waitForEvent('download');
  await locator.click();
  const download = await downloadEvent;
  const downloadPath = await download.path();
  assert.ok(downloadPath, `${artifactName} download path is available`);
  const bytes = await readFile(downloadPath);
  await writeFile(path.join(outputDirectory, artifactName), bytes);
  evidence.artifacts[artifactName] = { suggestedFilename: download.suggestedFilename(), bytes: bytes.length };
  return bytes;
}

function pngDimensions(bytes) {
  assert.equal(bytes.subarray(0, 8).toString('hex'), '89504e470d0a1a0a', 'PNG signature');
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
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

const browser = await chromium.launch({ headless: true, channel: 'chrome' });
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

  await page.getByRole('button', { name: '复制排版正文', exact: true }).click();
  await page.getByText('已复制排版正文；图片请按位置说明另行上传，尚未发布。', { exact: true }).waitFor();
  const richClipboard = await page.evaluate(() => ({ ...window.__codexClipboard }));
  assert.ok(richClipboard.text.includes('编辑正文'), 'rich copy includes plain text fallback');
  assert.ok(richClipboard.html.includes('&lt;script&gt;'), 'rich copy escapes user script text');
  assert.equal(/<script|<img/i.test(richClipboard.html), false, 'rich copy contains no executable/image element');
  await page.getByRole('button', { name: '复制纯文字正文', exact: true }).click();
  await page.getByText('已复制纯文字正文。', { exact: true }).waitFor();
  const plainClipboard = await page.evaluate(() => ({ ...window.__codexClipboard }));
  assert.ok(plainClipboard.text.includes('编辑正文'), 'plain copy includes edited body');
  evidence.checks.push('rich and plain copy verified through explicit stub clipboard');

  // Older WebViews provide FileReader but lack Blob.text()/arrayBuffer(). Export must still work.
  await page.evaluate(() => { Blob.prototype.text = undefined; Blob.prototype.arrayBuffer = undefined; });

  // Export and inspect actual browser downloads. ZIP is validated independently with Python zipfile + Pillow.
  const imageDetails = page.locator('details.codex-publication-images');
  await imageDetails.locator('summary').click();
  await page.getByAltText('公众号稿横版封面预览', { exact: true }).waitFor();
  const zipBytes = await downloadBytes(page, page.getByRole('button', { name: '导出稿件与配图包', exact: true }), 'codex_publication_materials.zip');
  const zipInspection = await inspectZip(path.join(outputDirectory, 'codex_publication_materials.zip'));
  const expectedZipNames = [
    'codex_publication_article.html', 'codex_publication_title.txt', 'codex_publication_body.txt',
    'codex_publication_readme.txt', 'codex_publication_cover.png', 'codex_publication_image_001.png',
  ];
  assert.deepEqual(zipInspection.names.slice().sort(), expectedZipNames.slice().sort(), 'ZIP has the expected safe publication files');
  assert.equal(zipInspection.images['codex_publication_cover.png'].width, 1200, 'ZIP cover width is 1200');
  assert.equal(zipInspection.images['codex_publication_cover.png'].height, 510, 'ZIP cover height is 510');
  assert.ok(zipInspection.images['codex_publication_image_001.png'].width <= 1024, 'ZIP section image width is bounded');
  assert.ok(zipBytes.length > 22, 'ZIP contains central directory and payload');

  const htmlBytes = await downloadBytes(page, page.getByRole('button', { name: '导出HTML稿', exact: true }), 'codex_publication_article.html');
  const htmlDocument = htmlBytes.toString('utf8');
  assert.match(htmlDocument, /Content-Security-Policy/, 'HTML export carries a CSP');
  assert.match(htmlDocument, /&lt;script&gt;/, 'HTML export escapes malicious text');
  assert.equal(/<script\b/i.test(htmlDocument), false, 'HTML export has no script element');
  assert.match(htmlDocument, /data:image\/png;base64,/, 'HTML export embeds the selected PNG locally');

  const coverBytes = await downloadBytes(page, page.getByRole('button', { name: '导出横版封面', exact: true }), 'codex_publication_cover.png');
  assert.deepEqual(pngDimensions(coverBytes), { width: 1200, height: 510 }, 'standalone cover export is 1200x510 PNG');
  evidence.checks.push('ZIP/HTML/PNG downloads inspected; ZIP CRC and image dimensions verified independently');

  // Browser sharing needs a second user gesture after ZIP preparation. The stub below explicitly
  // simulates a cancelled system share and verifies edits invalidate the prepared package.
  await page.evaluate(() => {
    window.__codexShareCalls = [];
    Object.defineProperty(navigator, 'canShare', { configurable: true, value: () => true });
    Object.defineProperty(navigator, 'share', { configurable: true, value: async payload => {
      window.__codexShareCalls.push({ name: payload.files?.[0]?.name || '' });
      throw new DOMException('simulated cancellation', 'AbortError');
    } });
  });
  const shareButton = page.getByRole('button', { name: '分享素材包', exact: true });
  await shareButton.click();
  await page.getByText('素材包已准备，请再次点击“分享素材包”打开系统分享。', { exact: true }).waitFor();
  await page.getByLabel('推文标题', { exact: true }).fill('编辑后再次修改以失效素材包');
  await page.waitForTimeout(100);
  await shareButton.click();
  await page.getByText('素材包已准备，请再次点击“分享素材包”打开系统分享。', { exact: true }).waitFor();
  assert.equal(await page.evaluate(() => window.__codexShareCalls.length), 0, 'editing invalidates a prepared browser share package');
  await shareButton.click();
  await page.getByText('已取消分享，稿件仍保留。', { exact: true }).waitFor();
  assert.equal(await page.evaluate(() => window.__codexShareCalls.length), 1, 'second-click browser share invokes the stub once');
  evidence.checks.push('browser ZIP share preparation, edit invalidation, and cancelled share');

  // All four privacy flags are exercised together, including the content-hidden rule.
  for (const label of ['隐藏评分', '隐藏记录日期', '隐藏小懂哥名称', '隐藏导语和正文']) await page.getByLabel(label, { exact: true }).check();
  await page.waitForTimeout(150);
  const hiddenPreview = await preview.innerText();
  assert.doesNotMatch(hiddenPreview, /编辑正文|导语|评分|记录于|小懂哥/, 'all hidden publication fields leave the preview');
  assert.equal(await body.isDisabled(), true, 'hidden content disables intro/body editing');
  await page.getByRole('button', { name: '复制纯文字正文', exact: true }).click();
  await page.getByText('已复制纯文字正文。', { exact: true }).waitFor();
  assert.doesNotMatch(await page.evaluate(() => window.__codexClipboard.text), /编辑正文|导语|8\.5\+|2026\.06\.02|小懂哥/, 'hidden copy has no private fields');
  await page.evaluate(() => {
    window.__codexCoverTexts = [];
    const fill = CanvasRenderingContext2D.prototype.fillText;
    CanvasRenderingContext2D.prototype.fillText = function(text, ...args) { window.__codexCoverTexts.push(text); return fill.call(this, text, ...args); };
  });
  await downloadBytes(page, page.getByRole('button', { name: '导出稿件与配图包', exact: true }), 'codex_publication_hidden.zip');
  const hiddenZip = await inspectZip(path.join(outputDirectory, 'codex_publication_hidden.zip'));
  assert.doesNotMatch(Object.values(hiddenZip.texts).join('\n'), /编辑正文|导语私密|8\.5\+|2026\.06\.02|小懂哥/, 'all ZIP text files, including instructions, respect privacy');
  assert.doesNotMatch(await page.evaluate(() => window.__codexCoverTexts.join('\n')), /编辑正文|导语|8\.5\+|2026\.06\.02|小懂哥/, 'generated cover receives no hidden text');
  evidence.checks.push('privacy applied to preview, copy, actual ZIP HTML/text/readme and generated-cover text');

  // Close/reopen the single-share route and verify the local draft is restored without changing entries.
  await page.getByRole('button', { name: '关闭分享预览', exact: true }).click();
  await page.goto(`${origin}/#/entries/${encodeURIComponent(entries[0].id)}?share=1`);
  await page.reload();
  await page.locator('.review-share-dialog[open]').waitFor();
  await page.getByLabel('公众号稿', { exact: true }).check();
  await waitForComposer(page);
  await page.getByText('已恢复这组来源的本机推文草稿。', { exact: true }).waitFor();
  assert.equal(await page.getByLabel('推文标题', { exact: true }).inputValue(), '编辑后再次修改以失效素材包', 'draft title restored');
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
  await page.getByRole('button', { name: '分享已保存的年度报告', exact: true }).waitFor();
  await page.getByRole('button', { name: '分享已保存的年度报告', exact: true }).click();
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
  console.log(`PASS: publication share/composer editing, clipboard stub, ZIP/HTML/PNG inspection, privacy, draft restore, reorder, report/rank entry points, and 320/390/1280 light/dark layout. Evidence: ${path.join(outputDirectory, 'codex_check_publication.json')}`);
}
