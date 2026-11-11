import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { startQaViteServer } from './codex_qa_harness.mjs';

// UI 回归：三种时间、归档/月报双口径切换、年度报告、新老专辑识别。
// 本机 Chrome 不可启动，使用 Edge 无头内核；不写任何项目数据。
const output = await mkdtemp(path.join(tmpdir(), 'abu-time-basis-'));
const { server, origin } = await startQaViteServer({ output });
const browser = await chromium.launch({ headless: true, channel: 'msedge' });
const errors = [];
try {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, timezoneId: 'Asia/Shanghai' });
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(origin);
  await page.locator('.app-shell').waitFor();

  await page.evaluate(() => {
    const base = {
      type: 'album', year: 2026, month: 5, songName: null, artistName: '测试音乐人', musicMetadata: null,
      content: '温暖的人声让我平静。', tags: [], moods: ['平静'], rating: 8, ratingModifier: null,
      ratingProduction: null, ratingSongwriting: null, ratingOriginality: null, ratingResonance: null,
      compositeRatingLocked: false, listenedAt: null, updatedAt: '2026-07-01T04:00:00.000Z',
    };
    const rows = [
      { ...base, id: 'abu-a', title: '新专辑A', albumName: '新专辑A', releaseDate: '2026-03-08', firstListenedAt: '2026-03-20T04:00:00.000Z', createdAt: '2026-05-10T04:00:00.000Z' },
      { ...base, id: 'abu-b', title: '老专辑B', albumName: '老专辑B', releaseDate: '1999-01-01', firstListenedAt: '2026-04-02T04:00:00.000Z', createdAt: '2026-06-01T04:00:00.000Z' },
      { ...base, id: 'abu-c', title: '未标注C', albumName: '未标注C', firstListenedAt: null, createdAt: '2026-07-01T04:00:00.000Z' },
    ];
    localStorage.setItem('music-feelings-mobile-entries', JSON.stringify(rows));
    localStorage.setItem('music-feelings-mobile-listening-moments', JSON.stringify([
      { id: 'abu-m1', entryId: 'abu-a', listenedAt: '2026-06-15T04:00:00.000Z', rating: 8, ratingModifier: null, moods: [], content: '再听一次', createdAt: '2026-06-15T04:00:00.000Z', updatedAt: '2026-06-15T04:00:00.000Z' },
    ]));
  });

  // 1. 录入表单：三个日期 + 自动归档年月
  await page.goto(`${origin}/#/new`);
  await page.locator('.date-triad').waitFor();
  assert.equal(await page.locator('input[name="releaseDate"]').count(), 1, '发行日期输入');
  assert.equal(await page.locator('input[name="firstListenedAt"]').count(), 1, '首次收听输入');
  assert.equal(await page.locator('input[name="year"][type="hidden"]').count(), 1, '归档年份改为自动');
  assert.equal(await page.locator('input[name="month"][type="hidden"]').count(), 1, '归档月份改为自动');
  assert.equal(await page.locator('.recording-date-card').count(), 1, '乐评记录时间说明');
  assert.equal(await page.locator('input[type="date"]').count(), 0, '不再使用原生月历控件');

  // 滚轮：三列独立滚动、年份一步跳到很久以前、确定写回并触发表单变更
  await page.evaluate(() => {
    window.__abuChanges = 0;
    document.querySelector('form.writing-form')?.addEventListener('change', () => { window.__abuChanges += 1; });
  });
  await page.locator('input[name="firstListenedAt"]').fill('2020-01-02');
  assert.equal(await page.locator('input[name="firstListenedAt"]').inputValue(), '2020-01-02', '兼容既有用例的 fill()');
  // 草稿恢复是命令式写 DOM value，滚轮打开时必须从已存年份开始。
  await page.evaluate(() => { document.querySelector('input[name="releaseDate"]').value = '1988-07-07'; });
  await page.getByRole('button', { name: /滚动选择专辑\/歌曲发行日期/ }).click();
  await page.locator('.abu-wheel-sheet').waitFor();
  assert.match(await page.locator('.abu-wheel-col').first().locator('.abu-wheel-item.is-active').innerText(), /1988/, '草稿恢复后滚轮从已存年份开始');
  assert.equal(await page.locator('.abu-wheel-col').count(), 3, '年 / 月 / 日三列');
  assert.equal(await page.locator('input[type="date"]').count(), 0, '弹层内也没有月历');
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, '弹层不产生横向溢出');
  await page.locator('.abu-wheel-col').nth(1).evaluate((element) => { element.scrollTop = 4 * 44; });
  await page.waitForFunction(() => document.querySelectorAll('.abu-wheel-col')[1]?.querySelector('.abu-wheel-item.is-active')?.textContent?.trim() === '5月', null, { timeout: 5000 });
  await page.getByLabel('跳到年份').fill('1999');
  await page.getByRole('button', { name: '跳转', exact: true }).click();
  await page.waitForFunction(() => document.querySelector('.abu-wheel-col .abu-wheel-item.is-active')?.textContent?.includes('1999'));
  await page.getByRole('button', { name: '确定', exact: true }).click();
  await page.locator('.abu-wheel-sheet').waitFor({ state: 'detached' });
  assert.match(await page.locator('input[name="releaseDate"]').inputValue(), /^1999-05-\d{2}$/, '旧年份一步写入且月份列独立生效');
  assert.equal(await page.evaluate(() => window.__abuChanges > 0), true, '确定后触发表单 change，草稿自动保存可用');

  // 2. 时间轴：归档双口径切换 + 同时统计
  await page.goto(`${origin}/#/timeline`);
  await page.locator('.basis-switch').waitFor();
  assert.equal(await page.locator('.basis-switch button').count(), 2);
  assert.equal(await page.locator('.archive-basis-stats .stat-card').count(), 2);
  assert.match(await page.locator('.archive-basis-stats').innerText(), /3 篇/, '记录时间口径应有 3 篇');
  assert.match(await page.locator('.archive-basis-stats').innerText(), /2 篇/, '发行时间口径应有 2 篇');
  assert.equal(await page.locator('.entry-card').filter({ hasText: '追加 1 次，最近 2026.06.15' }).count(), 1, '乐评记录时间包含后续追加收听');
  await page.getByRole('button', { name: '按发行时间', exact: true }).click();
  assert.match(page.url(), /basis=releaseDate/, '归档口径写入 URL');
  await page.getByText('未填写专辑/歌曲发行时间').waitFor();

  // 3. 年报：双口径切换
  await page.goto(`${origin}/#/summary/analysis?year=2026`);
  await page.locator('.basis-switch').waitFor();
  assert.equal(await page.locator('.basis-switch button').count(), 2);
  assert.equal(await page.locator('.basis-counts .stat-card').count(), 2);
  assert.equal(await page.getByRole('button', { name: '按首次收听', exact: true }).getAttribute('aria-pressed'), 'true', '默认首次收听口径');
  await page.getByRole('button', { name: '按发行时间', exact: true }).click();
  assert.match(page.url(), /basis=releaseDate/);

  // 4. 月报页也带口径切换
  await page.goto(`${origin}/#/summary/2026/3?basis=releaseDate`);
  await page.locator('.basis-switch').waitFor();
  assert.equal(await page.locator('.basis-switch button').count(), 2);

  // 5. 年度报告：只收录 2026 年发行的新专辑，含前十五
  await page.goto(`${origin}/#/annual-report?year=2026`);
  await page.locator('.annual-report-rank').waitFor();
  assert.match(await page.locator('h1').first().innerText(), /2026 年度报告/);
  assert.equal(await page.locator('.annual-report-rank-list .journal-rank-item').count(), 1, '只有一张 2026 年新专辑');
  assert.match(await page.locator('.annual-report-rank-list').innerText(), /新专辑A/);
  assert.match(await page.locator('.annual-report-rank-list').innerText(), /发行 2026-03-08/);
  assert.match(await page.locator('.annual-report-rank-list').innerText(), /首次收听 2026-03-20/);
  assert.match(await page.locator('.annual-report-rank-list').innerText(), /乐评记录 2026-05-10/);
  assert.equal(await page.locator('.journal-era-badge').count(), 1);
  await page.getByRole('link', { name: '编辑年度前十五专辑' }).click();
  await page.locator('.journal-editor').waitFor();

  // 6. 年度总结同时统计新老专辑
  await page.goto(`${origin}/#/summary?year=2026`);
  await page.locator('.journal-era-summary').waitFor();
  const era = await page.locator('.journal-era-summary').innerText();
  assert.match(era, /新老专辑一起统计/);
  assert.match(era, /1\s*2026 年新专辑/);
  assert.match(era, /1\s*往年专辑/);
  assert.match(era, /1\s*未填发行日期/);

  // 6b. 速记页：受控 state 与滚轮写回同步
  await page.goto(`${origin}/#/capture`);
  await page.getByRole('button', { name: /滚动选择收听日期/ }).click();
  await page.locator('.abu-wheel-sheet').waitFor();
  await page.getByLabel('跳到年份').fill('1998');
  await page.getByRole('button', { name: '跳转', exact: true }).click();
  await page.waitForFunction(() => document.querySelector('.abu-wheel-col .abu-wheel-item.is-active')?.textContent?.includes('1998'));
  await page.getByRole('button', { name: '确定', exact: true }).click();
  assert.match(await page.locator('input[name="listenedOn"]').inputValue(), /^1998-\d{2}-\d{2}$/);
  await page.getByRole('button', { name: '保存草稿', exact: true }).click();
  await page.waitForURL('**/#/drafts');
  const quickDraftDate = await page.evaluate(() => {
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i);
      if (!key?.startsWith('music-feelings-entry-draft:')) continue;
      try {
        const draft = JSON.parse(localStorage.getItem(key));
        if (draft?.captureMode === 'quick' && draft?.fields?.listenedAt) return draft.fields.listenedAt;
      } catch { /* 忽略损坏草稿 */ }
    }
    return null;
  });
  assert.match(String(quickDraftDate), /^1998-/, '速记页受控值与滚轮写回同步');

  // 7. 报告生成链路：旧默认口径不变，新口径写入 reportBasis
  const chain = await page.evaluate(async () => {
    const { store } = await import('/src/store.ts');
    const { parseMonthlyListeningSnapshot, parseYearlyListeningSnapshot } = await import('/src/listeningYearbook.ts');
    const base = {
      type: 'album', year: 2026, month: 5, songName: null, artistName: '测试音乐人', musicMetadata: null,
      content: '温暖的人声让我平静。', tags: [], moods: [], rating: 8, ratingModifier: null,
      ratingProduction: null, ratingSongwriting: null, ratingOriginality: null, ratingResonance: null,
      compositeRatingLocked: false, listenedAt: null, updatedAt: '2026-09-01T04:00:00.000Z',
    };
    const rows = Array.from({ length: 6 }, (_, i) => ({
      ...base, id: `chain-${i}`, title: `作品 ${i + 1}`, albumName: `专辑 ${i + 1}`,
      firstListenedAt: i < 3 ? '2026-05-10T04:00:00.000Z' : '2026-08-10T04:00:00.000Z',
      createdAt: i < 3 ? '2026-05-10T04:00:00.000Z' : '2026-08-10T04:00:00.000Z',
    }));
    localStorage.setItem('music-feelings-mobile-entries', JSON.stringify(rows));
    const month = await store.generateMonthlySummary(2026, 5);
    const monthSnapshot = parseMonthlyListeningSnapshot(month.analysisJson);
    const year = await store.generateSummary(2026);
    const yearSnapshot = parseYearlyListeningSnapshot(year.analysisJson);
    const freshMonth = await store.generateMonthlySummary(2026, 5, 'firstListenedAt');
    const freshSnapshot = parseMonthlyListeningSnapshot(freshMonth.analysisJson);
    const freshYear = await store.generateSummary(2026, 'firstListenedAt');
    const freshYearSnapshot = parseYearlyListeningSnapshot(freshYear.analysisJson);
    return {
      monthCount: month.sourceEntryCount, yearCount: year.sourceEntryCount,
      legacyMonthBasis: monthSnapshot.reportBasis ?? null, legacyYearBasis: yearSnapshot.reportBasis ?? null,
      freshMonthCount: freshMonth.sourceEntryCount, freshMonthBasis: freshSnapshot.reportBasis,
      freshYearCount: freshYear.sourceEntryCount, freshYearBasis: freshYearSnapshot.reportBasis,
    };
  });
  assert.deepEqual(chain, {
    monthCount: 3, yearCount: 6, legacyMonthBasis: null, legacyYearBasis: null,
    freshMonthCount: 3, freshMonthBasis: 'firstListenedAt',
    freshYearCount: 6, freshYearBasis: 'firstListenedAt',
  }, '默认口径保持兼容，新口径写入 reportBasis');

  assert.deepEqual(errors, [], '页面不应有未捕获错误');
  console.log('PASS: 三个日期录入、归档/月报双口径切换、年度报告前十五、新老专辑识别、报告链路兼容、无运行时错误');
} finally {
  await browser.close();
  await server.close();
  await rm(output, { recursive: true, force: true });
}
