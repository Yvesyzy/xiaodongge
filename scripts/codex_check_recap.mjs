import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { makeJournalFixtures } from '../mobile/codex_journal_fixtures.mjs';
const origin = process.argv[2] || 'http://127.0.0.1:5180';
const output = process.env.CODEX_QA_DIR || 'D:/codex/.codex-home/visualizations/2026/09/05/01a06f8f-96fb-7e20-b8f6-bc4c8b62363f';
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, timezoneId: 'Asia/Shanghai' });
  page.setDefaultTimeout(10000);
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await page.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
  const go = path => page.goto(origin + '/#' + path);
  async function seed(entries) {
    await page.goto(origin);
    await page.evaluate(items => { localStorage.clear(); sessionStorage.clear(); localStorage.setItem('music-feelings-mobile-entries', JSON.stringify(items)); }, entries);
    await go('/summary?year=2026'); await page.reload();
    await page.locator('.journal-scope-summary').waitFor();
  }
  for (const count of [0, 3, 6, 128]) {
    const entries = count === 3 ? makeJournalFixtures('6').slice(0, 3) : makeJournalFixtures(String(count));
    await seed(entries);
    assert.equal(await page.locator('.journal-scope-summary strong').first().innerText(), String(count));
    assert.equal(await page.locator('.journal-editor').count(), 0, 'editing is separate from reading');
    for (const width of [320, 390, 1280]) {
      await page.setViewportSize({ width, height: 844 });
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `${count} records fit ${width}px`);
    }
    await page.setViewportSize({ width: 390, height: 844 });
    if (count === 6) await page.screenshot({ path: `${output}/codex_recap_cover.png`, fullPage: true });
    if (!count) { assert.equal(await page.locator('.journal-bars').count(), 0); continue; }
    await go('/summary?year=2026&view=overview');
    await page.locator('.journal-records').waitFor();
    assert.equal(await page.locator('.journal-bars').count(), count >= 6 ? 1 : 0);
    if (count === 128) {
      await page.getByRole('button', { name: '显示更多月份', exact: true }).click();
      const group = page.locator('.journal-month-group').nth(4);
      await group.locator('.journal-month-toggle').click();
      await group.locator('.journal-record').first().scrollIntoViewIfNeeded();
      const y = await page.evaluate(() => scrollY);
      await group.locator('.journal-record').first().click();
      await page.locator('.codex-reader').waitFor();
      assert.equal(await page.locator('.bottom-nav').isVisible(), false);
      await page.getByRole('button', { name: '← 返回', exact: true }).click();
      await page.waitForFunction(position => Math.abs(scrollY - position) < 5, y);
      assert.equal(await page.locator('.journal-month-group').count(), 6);
      assert.equal(await page.locator('.journal-month-group').nth(4).locator('.journal-month-toggle').getAttribute('aria-expanded'), 'true');
      await page.getByLabel('记录月份').selectOption('5');
      await page.waitForURL(/month=5/);
      await page.getByLabel('记录排序').selectOption('asc');
      await page.waitForURL(/sort=asc/);
      const filteredUrl = page.url();
      await page.locator('.journal-record').first().click();
      await page.getByRole('link', { name: '目录', exact: true }).click();
      await page.waitForURL(filteredUrl);
      assert.equal(await page.getByLabel('记录月份').inputValue(), '5');
      assert.equal(await page.getByLabel('记录排序').inputValue(), 'asc');
    }
  }
  const six = makeJournalFixtures('6');
  await seed(six);
  await page.getByRole('link', { name: '编辑年度精选', exact: true }).click();
  await page.getByRole('button', { name: '使用评分推荐（替换当前选择）', exact: true }).click();
  await page.locator('.journal-editor textarea').first().fill('我的年度寄语，更新月报也应保留。');
  await page.getByRole('button', { name: /^下移 / }).first().click();
  const order = await page.locator('.journal-selected-entry strong').allTextContents();
  await page.getByRole('button', { name: '保存年度精选', exact: true }).click();
  await page.getByRole('heading', { name: '我的音乐年记', exact: true }).waitFor();
  await page.getByText('我的年度寄语，更新月报也应保留。', { exact: true }).waitFor();
  assert.equal(await page.locator('.journal-representative').count(), 3);
  const savedEdition = await page.evaluate(async () => { const { store } = await import('/src/store.ts'); return store.getStoredAppData('journal-edition:2026'); });
  assert.equal(JSON.parse(savedEdition).entryIds.length, order.length);
  await page.getByRole('button', { name: '分享年记', exact: true }).click();
  await page.locator('.journal-export-preview').waitFor();
  await page.locator('.journal-export-preview').evaluate(image => image.decode());
  await page.getByLabel('关闭图片预览').click();
  await page.evaluate(async () => {
    const { store } = await import('/src/store.ts');
    await store.setSemanticOverride({ layer: 'feeling', term: '平静', action: 'exclude', targetLayer: null });
    await store.generateMonthlySummary(2026, 5);
  });
  await go('/summary?year=2026&view=months'); await page.reload();
  await page.locator('.journal-month-grid').waitFor();
  assert.match(await page.locator('.journal-month-card').nth(4).innerText(), /已生成/);
  assert.match(await page.locator('.journal-month-card').nth(5).innerText(), /未生成/);
  assert.match(await page.locator('.journal-month-card').first().innerText(), /暂无记录/);
  await page.screenshot({ path: `${output}/codex_recap_months.png`, fullPage: true });
  await page.evaluate(() => {
    const items = JSON.parse(localStorage.getItem('music-feelings-mobile-monthly-summaries'));
    items[0].sourceFingerprint = null;
    localStorage.setItem('music-feelings-mobile-monthly-summaries', JSON.stringify(items));
  });
  await page.reload(); await page.locator('.journal-month-grid').waitFor();
  assert.match(await page.locator('.journal-month-card').nth(4).innerText(), /需要更新/);
  assert.equal(await page.evaluate(async () => { const { store } = await import('/src/store.ts'); return store.getStoredAppData('journal-edition:2026'); }), savedEdition);
  const evidence = await page.evaluate(async entries => {
    const { buildRecapPatterns } = await import('/src/codex_RecapInsights.tsx');
    const sample = entries.map((entry, i) => ({ ...entry, createdAt: `2026-0${i < 3 ? 1 : 2}-01T12:00:00.000Z`, tags: i < 3 || i === 3 ? ['器乐'] : [], moods: [] }));
    return { patterns: buildRecapPatterns(sample), sparse: buildRecapPatterns(sample.slice(0, 3)) };
  }, six);
  assert.equal(evidence.sparse.length, 0);
  assert.ok(evidence.patterns.length > 0);
  assert.deepEqual(evidence.patterns[0].entryIds.sort(), six.slice(0, 4).map(entry => entry.id).sort());
  assert.deepEqual(errors, []);
  console.log('PASS recap: 0/3/6/128 density, 320/390/1280px; expanded directory/filter/scroll restored; independent curation/reorder/save return; annual image exporter; monthly absent/not-generated/generated/stale states with semantic overrides; evidence links; curation preserved.');
} finally { await browser.close(); }
