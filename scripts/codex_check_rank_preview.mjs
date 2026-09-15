import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { writeFile } from 'node:fs/promises';

const input = new URL('../docs/designs/codex_rank_letterpress_preview.html', import.meta.url);
const output = new URL('../docs/designs/codex_rank_letterpress_preview.png', import.meta.url);
const browser = await chromium.launch({ channel: 'chrome', headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1200, height: 1000 } });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(() => {
    window.paintedText = [];
    const original = CanvasRenderingContext2D.prototype.fillText;
    CanvasRenderingContext2D.prototype.fillText = function (text, x, y, ...rest) {
      const metrics = this.measureText(text);
      window.paintedText.push({ text, x, y, left: x - metrics.actualBoundingBoxLeft, right: x + metrics.actualBoundingBoxRight, top: y - metrics.actualBoundingBoxAscent, bottom: y + metrics.actualBoundingBoxDescent });
      return original.call(this, text, x, y, ...rest);
    };
  });
  await page.goto(input.href);
  const result = await page.evaluate(() => {
    const c = document.querySelector('canvas'), ctx = c.getContext('2d');
    return { width: c.width, height: c.height, bg: Array.from(ctx.getImageData(0, 0, 1, 1).data), text: window.paintedText };
  });
  assert.deepEqual([result.width, result.height], [1080, 1680]);
  assert.deepEqual(result.bg, [242, 239, 230, 255]);
  assert.equal(result.text.filter(t => t.x === 316 && /9 \/ 10|8 \/ 10/.test(t.text)).length, 5);
  assert(result.text.some(t => t.text === '暂无封面'));
  assert(result.text.some(t => t.text === '第 1 / 3 页'));
  for (const t of result.text.filter(t => t.x === 316)) {
    assert(t.left >= 312 && t.right <= 1008, `横向溢出: ${JSON.stringify(t)}`);
    assert(t.top >= 420 && t.bottom <= 1560, `纵向溢出: ${JSON.stringify(t)}`);
  }
  const image = await page.locator('canvas').evaluate(c => c.toDataURL('image/png').split(',')[1]);
  await writeFile(output, Buffer.from(image, 'base64'));
  for (const id of ['hideBrand', 'hideDate', 'hideRating', 'hideContent']) {
    await page.evaluate(() => { window.paintedText = []; });
    await page.locator(`#${id}`).check();
    const text = await page.evaluate(() => window.paintedText.map(t => t.text));
    assert(text.includes('第 1 / 3 页'));
    if (id === 'hideBrand') assert(!text.some(t => t.includes('小懂哥')));
    if (id === 'hideDate') assert(!text.some(t => t.includes('整理于')));
    if (id === 'hideRating') assert(!text.some(t => t.includes('/ 10')));
    if (id === 'hideContent') assert(!text.some(t => t.includes('最常在')));
  }
  for (const width of [390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${width}px 出现横向滚动`);
  }
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: '保存这张 PNG' }).click();
  assert.equal((await download).suggestedFilename(), 'codex_rank_letterpress_preview.png');
  assert.deepEqual(errors, []);
  console.log(`PASS: 1080×1680、五条槽位、文字边界、四项隐私开关、三种视口、PNG 下载。\n${fileURLToPath(output)}`);
} finally {
  await browser.close();
}
