// 自检：年度/月度标签的滑动切换，以及年度专辑榜单纳入 PNG 导出体系。
// 用法：先起静态服务器（abu_check_yearbook_tabs.mjs <origin>），再运行本脚本。
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { makeJournalFixtures } from '../mobile/codex_journal_fixtures.mjs';

const origin = process.argv[2] || 'http://127.0.0.1:5181';
const output = process.env.ABU_QA_DIR || 'release/abu_yearbook_tabs_qa';
await mkdir(output, { recursive: true });

const albums = [
  { albumName: '夜行列车', artistName: '林一', note: '整张专辑的空间感很好，鼓组留白让人喘得过气。' },
  { albumName: '潮汐记', artistName: '海边的房间', note: '在通勤路上反复听，第三首开始进入状态。' },
  { albumName: '未完成的夏天', artistName: null, note: '' },
];
// 第 4 张没有对应记录，验证「原记录已删除」的兜底分支。
albums.push({ albumName: '已删除的专辑', artistName: '无名', note: '这条用于验证记录缺失时导出不崩。' });
for (let i = 5; i <= 15; i++) {
  albums.push({ albumName: `压力测试专辑 ${i}`, artistName: `艺人 ${i}`, note: '理由'.repeat(80) });
}

const browser = await chromium.launch({ channel: 'chrome', headless: true });
const results = [];
try {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, timezoneId: 'Asia/Shanghai' });
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
  await page.goto(origin);

  const entries = makeJournalFixtures('6');
  entries[0].type = 'album';
  entries[0].albumName = '夜行列车';
  entries[0].artistName = '林一';
  entries[0].rating = 9;
  entries[0].year = 2026;
  entries[0].month = 9;
  await page.evaluate(({ items, top }) => {
    localStorage.clear();
    localStorage.setItem('music-feelings-mobile-entries', JSON.stringify(items));
    localStorage.setItem('music-feelings-mobile-app-data', JSON.stringify({ 'top-albums:2026': JSON.stringify({ albums: top }) }));
  }, { items: entries, top: albums });

  // —— 1) 滑动指示器：年度 → 月度，滑块位移应等于标签宽度的一半 ——
  await page.goto(`${origin}/#/summary?year=2026&view=cover`);
  await page.waitForSelector('.journal-tabs');
  const bar = page.locator('.journal-tabs');
  const indicator = () => page.evaluate(() => {
    const nav = document.querySelector('.journal-tabs');
    const style = getComputedStyle(nav, '::after');
    return { matrix: style.transform, active: nav.dataset.active, width: nav.getBoundingClientRect().width };
  });
  const atCover = await indicator();
  assert.equal(atCover.active, 'cover', `年度标签应为 active，实际 ${atCover.active}`);
  await page.waitForTimeout(400); // 等过渡结束，读稳定值
  const coverShift = await page.evaluate(() => new DOMMatrixReadOnly(getComputedStyle(document.querySelector('.journal-tabs'), '::after').transform).m41 + Number(getComputedStyle(document.querySelector('.journal-tabs')).getPropertyValue('--journal-tab-base').replace('%', '')) * document.querySelector('.journal-tabs').getBoundingClientRect().width / 100);
  results.push(['年度标签滑块归一化位移', Number(coverShift.toFixed(1))]);
  assert.ok(Math.abs(coverShift) < 2, `年度标签下划线应停在左侧，实际位移 ${coverShift}`);
  await page.screenshot({ path: `${output}/01-tabs-cover.png` });

  // —— 2) 点击月度回顾：指示器应滑到右侧 ——
  await page.click('.journal-tabs a:nth-child(2)');
  await page.waitForSelector('.journal-tabs[data-active="months"]', { timeout: 3000 });
  await page.waitForTimeout(400);
  const monthsShift = await page.evaluate(() => {
    const nav = document.querySelector('.journal-tabs');
    return new DOMMatrixReadOnly(getComputedStyle(nav, '::after').transform).m41;
  });
  results.push(['月度标签滑块位移', Number(monthsShift.toFixed(1))]);
  const halfWidth = (await bar.boundingBox()).width / 2;
  assert.ok(Math.abs(monthsShift - halfWidth) < 3, `月度下划线应位移约 ${halfWidth.toFixed(1)}px，实际 ${monthsShift.toFixed(1)}px`);
  await page.screenshot({ path: `${output}/02-tabs-months.png` });

  // —— 3) 标签栏内横向拖拽也应切换（跟手位移的落点判定）——
  await page.click('.journal-tabs a:nth-child(1)');
  await page.waitForSelector('.journal-tabs[data-active="cover"]', { timeout: 3000 });
  const box = await bar.boundingBox();
  const y = box.y + box.height / 2;
  await page.mouse.move(box.x + box.width * 0.75, y);
  await page.mouse.down();
  for (let step = 1; step <= 6; step++) await page.mouse.move(box.x + box.width * 0.75 - step * 20, y);
  const midDrag = await page.evaluate(() => Number(getComputedStyle(document.querySelector('.journal-tabs')).getPropertyValue('--journal-tab-drag').replace('px', '')));
  results.push(['拖拽中的跟手位移', Number(midDrag.toFixed(1))]);
  await page.mouse.up();
  await page.waitForSelector('.journal-tabs[data-active="months"]', { timeout: 3000 });
  results.push(['拖拽落点切换', '切换到月度回顾']);
  await page.screenshot({ path: `${output}/03-tabs-drag.png` });

  // —— 4) 榜单导出：应产出可渲染的多页 ——
  await page.goto(`${origin}/#/summary?year=2026&view=rank`);
  await page.waitForSelector('.journal-rank-list, .journal-empty', { timeout: 5000 });
  const rankItems = await page.locator('.journal-rank-list .journal-rank-item').count();
  results.push(['榜单页渲染条目数', rankItems]);
  assert.ok(rankItems === albums.length, `榜单页应显示 ${albums.length} 条，实际 ${rankItems} 条`);
  await page.screenshot({ path: `${output}/04-rank-page.png`, fullPage: true });

  await page.click('.journal-actions button');
  await page.waitForSelector('.journal-export', { timeout: 5000 });
  await page.waitForSelector('.journal-export-preview, .journal-error', { timeout: 20000 });
  const hasPreview = await page.locator('.journal-export-preview').count();
  const exportError = hasPreview ? '' : (await page.locator('.journal-error').first().textContent().catch(() => ''));
  results.push(['榜单导出预览', hasPreview ? '已生成' : `失败：${exportError}`]);
  assert.ok(hasPreview, `榜单导出未生成预览：${exportError}`);
  const pager = await page.locator('.journal-page-controls').first().textContent();
  results.push(['榜单导出分页', pager.replace(/\s+/g, ' ').trim()]);
  await page.screenshot({ path: `${output}/05-rank-export.png` });

  // 翻到第二页，确认续页标题与内容切分正确
  const pageCount = Number((pager.match(/\/\s*(\d+)\s*页/) || [])[1] ?? 1);
  results.push(['榜单导出总页数', pageCount]);
  assert.ok(pageCount >= 2, `${albums.length} 张榜单应至少 2 页，实际 ${pageCount} 页`);
  await page.click('.journal-page-controls button:last-child');
  await page.waitForTimeout(1800);
  await page.screenshot({ path: `${output}/06-rank-export-page2.png` });
  results.push(['续页可达', '已翻至第 2 页']);

  assert.equal(errors.length, 0, `控制台有报错：${errors.join(' | ')}`);
  results.push(['运行时报错', '0']);

  console.log('ABU_CHECK_YEARBOOK_TABS PASS');
  for (const [name, value] of results) console.log(`  - ${name}: ${value}`);
} finally {
  await browser.close();
}
