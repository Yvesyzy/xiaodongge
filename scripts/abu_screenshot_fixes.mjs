/**
 * QA screenshots for the two UI fixes (album cover size + More page spacing).
 * Usage: node abu_screenshot_fixes.mjs [origin]
 * Output: release/abu_ui_fix_qa/*.png
 */
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import { makeJournalFixtures } from '../mobile/codex_journal_fixtures.mjs';

const origin = process.argv[2] || 'http://127.0.0.1:5184';
const output = 'release/abu_ui_fix_qa';
await mkdir(output, { recursive: true });

const browser = await chromium.launch({ channel: 'chrome', headless: true });
for (const theme of ['light', 'dark']) {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, timezoneId: 'Asia/Shanghai' });
  await page.addInitScript(value => localStorage.setItem('abu-theme-choice-v1', value), theme);
  await page.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
  await page.goto(origin);
  await page.evaluate(items => {
    localStorage.clear(); sessionStorage.clear();
    localStorage.setItem('music-feelings-mobile-entries', JSON.stringify(items));
  }, makeJournalFixtures('6'));
  await page.reload();

  // Albums page: full list + zoom on the first card (HashRouter)
  await page.goto(`${origin}/#/albums`);
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${output}/albums-${theme}.png` });
  await page.locator('.cover-row').first().screenshot({ path: `${output}/albums-card-${theme}.png` });
  const art = await page.locator('.cover-row .cover-art').first().boundingBox();
  console.log(theme, 'cover-art box:', JSON.stringify(art));

  // More page: the appearance section inside card-list
  await page.goto(`${origin}/#/more`);
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${output}/more-${theme}.png` });
  await page.locator('.card-list section.form-card').scrollIntoViewIfNeeded();
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${output}/more-bottom-${theme}.png` });
  const gapInfo = await page.evaluate(() => {
    const list = document.querySelector('.card-list');
    const section = list?.querySelector('section.form-card');
    if (!list || !section) return 'MISSING: section not inside .card-list';
    const prev = section.previousElementSibling;
    const gap = parseFloat(getComputedStyle(list).columnGap || getComputedStyle(list).gap);
    return { sectionInsideList: true, gap, prevTag: prev?.className || prev?.tagName };
  });
  console.log(theme, 'more spacing:', JSON.stringify(gapInfo));
  await page.close();
}
await browser.close();
