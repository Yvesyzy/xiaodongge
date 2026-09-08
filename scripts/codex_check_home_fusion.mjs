import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { makeJournalFixtures } from '../mobile/codex_journal_fixtures.mjs';
const origin = process.argv[2] || 'http://127.0.0.1:5173';
const output = 'release/codex_home_fusion';
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, timezoneId: 'Asia/Shanghai' });
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await page.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
  await page.goto(origin);
  for (const count of ['0', '6', '128']) {
    const entries = makeJournalFixtures(count);
    await page.evaluate(items => { localStorage.clear(); localStorage.setItem('music-feelings-mobile-entries', JSON.stringify(items)); }, entries);
    await page.reload();
    await page.waitForFunction(() => document.querySelector('.home-stats')?.textContent.includes('今年歌曲'));
    if (entries.length) await page.locator('.home-entry-row').first().waitFor();
    else await page.locator('.home-empty').waitFor();
    assert.equal(await page.locator('.home-entry-row').count(), Math.min(entries.length, 3));
    assert.equal(await page.locator('.home-draft-link').count(), 1);
    assert.equal(await page.locator('.hero-record').isVisible(), true);
    for (const width of [320, 390, 768, 1280]) {
      await page.setViewportSize({ width, height: 844 });
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `No horizontal overflow: ${count} entries at ${width}px`);
      const geometry = await page.evaluate(() => {
        const copy = document.querySelector('.home-hero-copy').getBoundingClientRect();
        const title = document.querySelector('.home-hero h1').getBoundingClientRect();
        const draft = document.querySelector('.home-draft-link').getBoundingClientRect();
        const stats = document.querySelector('.home-stats').getBoundingClientRect();
        return { clear: title.right <= copy.right && draft.bottom <= stats.top, firstRecord: document.querySelector('.home-entry-row')?.getBoundingClientRect().top };
      });
      assert.equal(geometry.clear, true, 'Text and draft do not overlap stats');
      if (entries.length && width === 390) assert.ok(geometry.firstRecord < 550, 'Recent entries remain in the first screen');
      if (width === 390 || (count === '6' && width === 1280)) await page.screenshot({ path: `${output}/codex_home_${count}_${width}.png`, fullPage: true });
    }
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(origin + '/#/new');
  await page.locator('input[name="title"]').fill('还没写完的专辑感受'.repeat(10));
  await page.locator('textarea[name="content"]').fill('这是稍后继续的感受。'.repeat(20));
  await page.getByRole('button', { name: '保存草稿', exact: true }).click();
  await page.goto(origin + '/#/');
  await page.locator('.home-draft-link').getByText(/草稿箱 · 1 条待完成/).waitFor();
  await page.setViewportSize({ width: 320, height: 844 });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  await page.screenshot({ path: `${output}/codex_home_long_draft_320.png`, fullPage: true });
  await page.locator('.home-draft-link').click();
  await page.waitForURL('**/#/drafts');
  for (const [selector, route] of [['.home-annual-link', '/summary'], ['.visual-entry-card.map', '/abstract-map'], ['.visual-entry-card.insights', '/insights'], ['.home-entry-row', '/entries/']]) {
    await page.goto(origin + '/#/');
    await page.locator(selector).first().click();
    assert.ok(page.url().includes('/#' + route));
  }
  assert.deepEqual(errors, []);
  console.log('PASS: 0/6/128 entries, 320/390/768/1280px, visible record and recent entries, long draft persistence, draft/annual/map/insights/detail navigation. Synthetic data only.');
} finally { await browser.close(); }
