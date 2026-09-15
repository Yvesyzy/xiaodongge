// 直接把榜单每一页渲染成 PNG 落盘，绕过 UI 预览，用于人工检查排版。
import { chromium } from 'playwright';
import { makeJournalFixtures } from '../mobile/codex_journal_fixtures.mjs';
import { writeFile, mkdir } from 'node:fs/promises';

const origin = process.argv[2] || 'http://127.0.0.1:5188';
const output = process.env.ABU_QA_DIR || 'release/abu_yearbook_tabs_qa';
await mkdir(output, { recursive: true });

const albums = [
  { albumName: '夜行列车', artistName: '林一', note: '整张专辑的空间感很好，鼓组留白让人喘得过气。' },
  { albumName: '潮汐记', artistName: '海边的房间', note: '在通勤路上反复听，第三首开始进入状态。' },
  { albumName: '未完成的夏天', artistName: null, note: '' },
  { albumName: '已删除的专辑', artistName: '无名', note: '这条用于验证记录缺失时导出不崩。' },
];
for (let i = 5; i <= 15; i++) albums.push({ albumName: `压力测试专辑 ${i}`, artistName: `艺人 ${i}`, note: '这是用于检查换行与截断的长理由文字。'.repeat(8) });

const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, timezoneId: 'Asia/Shanghai' });
const entries = makeJournalFixtures('6');
entries[0].type = 'album'; entries[0].albumName = '夜行列车'; entries[0].artistName = '林一';
entries[0].rating = 9; entries[0].ratingModifier = '+'; entries[0].year = 2026; entries[0].month = 9;
entries[1].type = 'album'; entries[1].albumName = '潮汐记'; entries[1].artistName = '海边的房间';
entries[1].rating = 8; entries[1].ratingModifier = null; entries[1].year = 2026; entries[1].month = 8;

await page.goto(origin);
await page.evaluate(({ items, top }) => {
  localStorage.clear();
  localStorage.setItem('music-feelings-mobile-entries', JSON.stringify(items));
  localStorage.setItem('music-feelings-mobile-app-data', JSON.stringify({ 'top-albums:2026': JSON.stringify({ albums: top }) }));
}, { items: entries, top: albums });

await page.goto(`${origin}/#/summary?year=2026&view=rank-edit`, { waitUntil: 'networkidle' });
await page.waitForTimeout(1200);

// 通过 UI 打开导出对话框，然后从 <img> 里取 blob 的实际像素
await page.goto(`${origin}/#/summary?year=2026&view=rank`, { waitUntil: 'networkidle' });
await page.waitForSelector('.journal-rank-list');
await page.click('.journal-actions button');
await page.waitForSelector('.journal-export', { timeout: 5000 });
await page.waitForSelector('.journal-export-preview', { timeout: 20000 });

const total = await page.locator('.journal-page-controls').first().textContent();
const pages = Number((total.match(/\/\s*(\d+)\s*页/) || [])[1] ?? 1);
console.log('导出总页数 =', pages);

for (let i = 0; i < pages; i++) {
  if (i > 0) {
    await page.click('.journal-page-controls button:last-child');
    // The preview clears while the next page renders; wait for it to come back rather than a fixed delay.
    await page.waitForSelector('.journal-export-preview', { timeout: 20000 });
  }
  const dataUrl = await page.locator('.journal-export-preview').getAttribute('src');
  if (!dataUrl) { console.log(`第 ${i + 1} 页：无预览图`); continue; }
  const base64 = await page.evaluate(async (url) => {
    const blob = await (await fetch(url)).blob();
    return await new Promise((resolve) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result).split(',')[1]); reader.readAsDataURL(blob); });
  }, dataUrl);
  const buffer = Buffer.from(base64, 'base64');
  const path = `${output}/rank-page-${i + 1}.png`;
  await writeFile(path, buffer);
  console.log(`第 ${i + 1} 页已落盘：${path}（${buffer.length} 字节）`);
}
await browser.close();
