import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';

const browser = await chromium.launch({ channel: 'chrome', headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1200, height: 1000 } });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(() => {
    window.paintedText = [];
    window.coverBoxes = [];
    const originalText = CanvasRenderingContext2D.prototype.fillText;
    CanvasRenderingContext2D.prototype.fillText = function(text, x, y, ...rest) {
      const m = this.measureText(text);
      window.paintedText.push({ text, x, y, left: x - m.actualBoundingBoxLeft, right: x + m.actualBoundingBoxRight, top: y - m.actualBoundingBoxAscent, bottom: y + m.actualBoundingBoxDescent });
      return originalText.call(this, text, x, y, ...rest);
    };
    const originalRect = CanvasRenderingContext2D.prototype.rect;
    CanvasRenderingContext2D.prototype.rect = function(x, y, w, h) {
      const m = this.getTransform();
      window.coverBoxes.push({ x: m.e, y: m.f, width: w * m.a, height: h * m.d });
      return originalRect.call(this, x, y, w, h);
    };
  });
  await page.goto(new URL('../docs/designs/codex_rank_collector_preview.html', import.meta.url).href);
  const groups = [[11, 15, 176], [4, 10, 144], [1, 3, 256]];
  const allRanks = [];
  for (const [index, [first, last, coverSize]] of groups.entries()) {
    await page.evaluate(() => { window.paintedText = []; window.coverBoxes = []; });
    await page.locator(`[data-page="${index}"]`).click();
    const result = await page.evaluate(() => {
      const c = document.querySelector('canvas');
      return { width: c.width, height: c.height, text: window.paintedText, covers: window.coverBoxes, image: c.toDataURL('image/png').split(',')[1] };
    });
    assert.deepEqual([result.width, result.height], [1080, 1680]);
    assert.equal(result.covers.length, last - first + 1);
    for (const cover of result.covers) {
      assert.equal(cover.width, coverSize); assert.equal(cover.height, coverSize);
      assert(cover.y >= 420 && cover.y + cover.height <= 1560);
    }
    const ranks = result.text.filter(t => (t.x === 72 || t.x === 95) && t.y >= 420 && t.y <= 1560).map(t => t.text).join('').match(/../g).map(Number);
    assert.deepEqual(ranks, Array.from({ length: last - first + 1 }, (_, i) => first + i));
    allRanks.push(...ranks);
    assert(result.text.some(t => t.text === `第 ${index + 1} / 3 页`));
    for (const t of result.text.filter(t => t.x >= 344 && t.y >= 420 && t.y <= 1560)) {
      assert(t.left >= t.x - 4 && t.right <= 1008, `文字横向溢出 ${JSON.stringify(t)}`);
      assert(t.top >= 420 && t.bottom <= 1560, `文字纵向溢出 ${JSON.stringify(t)}`);
    }
    await writeFile(new URL(`../docs/designs/codex_rank_collector_page_${index + 1}.png`, import.meta.url), Buffer.from(result.image, 'base64'));
    for (const id of ['hideBrand', 'hideDate', 'hideRating', 'hideContent']) {
      await page.evaluate(() => { window.paintedText = []; });
      await page.locator(`#${id}`).check();
      const text = await page.evaluate(() => window.paintedText);
      assert(text.some(t => t.text === `第 ${index + 1} / 3 页`));
      if (id === 'hideBrand') assert(!text.some(t => t.text.includes('小懂哥')));
      if (id === 'hideDate') assert(!text.some(t => t.text.includes('整理于')));
      if (id === 'hideRating') assert(!text.some(t => t.text.includes('/ 10')));
      if (id === 'hideContent') assert.equal(text.filter(t => t.x >= 344 && t.y >= 420 && t.y <= 1560).length, (last - first + 1) * 2);
      await page.locator(`#${id}`).uncheck();
    }
    const download = page.waitForEvent('download');
    await page.getByRole('button', { name: '保存这张 PNG' }).click();
    assert.equal((await download).suggestedFilename(), `codex_rank_collector_page_${index + 1}.png`);
  }
  assert.deepEqual([...allRanks].sort((a, b) => a - b), Array.from({ length: 15 }, (_, i) => i + 1));
  for (const width of [390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  }
  assert.deepEqual(errors, []);
  console.log('PASS: 5/7/3分档、1–15名无遗漏无重复、176/144/256px封面、文字边界、三页隐私开关与下载、三种视口。');
} finally {
  await browser.close();
}