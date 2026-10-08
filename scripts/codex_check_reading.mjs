import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { makeJournalFixtures } from '../mobile/codex_journal_fixtures.mjs';
import { qaOptions } from './codex_qa_options.mjs';

// Browser plugin not available. Synthetic data in an isolated browser context only.
const { origin, output } = qaOptions({ origin: 'http://127.0.0.1:5180', output: 'release/codex_mobile_experience_qa' });
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, timezoneId: 'Asia/Shanghai' });
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await page.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
  await page.goto(origin);
  const entries = makeJournalFixtures('128');
  entries[0].content = '模拟记录：第一段原文。\n\n' + '这是长篇乐评原文，节奏和空间感来自真实记录。\n'.repeat(100) + '最后一段完整保留。';
  for (const type of ['month', 'year']) entries.push({ ...entries[0], id: `codex-reader-${type}`, type, title: `${type} 自述`, content: '  正文 ABC，123。\n第二行🎵  ' });
  await page.evaluate(items => { localStorage.clear(); sessionStorage.clear(); localStorage.setItem('music-feelings-mobile-entries', JSON.stringify(items)); }, entries);
  await page.goto(origin + '/#/search?q=' + encodeURIComponent('模拟记录'));
  await page.reload();
  await page.locator('.entry-card').first().waitFor();
  const count = await page.locator('.entry-card').count();
  assert.ok(count > 20);
  await page.locator('.entry-card').nth(10).scrollIntoViewIfNeeded();
  const listY = await page.evaluate(() => scrollY);
  const listUrl = page.url();
  await page.locator('.entry-card').nth(10).click();
  await page.locator('.codex-reader-toolbar').waitFor();
  assert.equal(await page.locator('.bottom-nav').isVisible(), false);
  assert.equal(await page.locator('.codex-reader-menu .danger-button').isVisible(), false);
  await page.getByRole('button', { name: '← 返回', exact: true }).click();
  await page.waitForURL(listUrl).catch(async error => {
    console.error(await page.evaluate(() => ({ url: location.href, history: history.state, openDetails: Array.from(document.querySelectorAll('details[open]')).map(el => ({ className: el.className, text: el.querySelector('summary')?.textContent })) })));
    throw error;
  });
  await page.waitForFunction(y => Math.abs(scrollY - y) < 5, listY);
  assert.equal(await page.locator('.entry-card').count(), count);
  assert.equal(await page.getByPlaceholder('输入关键词').inputValue(), '模拟记录');

  await page.locator(`.entry-card[href$="/entries/${entries[0].id}"]`).click();
  await page.locator('.codex-reader-toolbar').waitFor();
  assert.equal(await page.locator('.content-word-count').count(), 1, 'A word count appears once at the end of the body');
  const actionGap = await page.locator('.action-row').evaluate(el => el.getBoundingClientRect().top - el.previousElementSibling.getBoundingClientRect().bottom);
  assert.ok(Math.abs(actionGap - 16) < 1, 'Reader relisten action stays clear of the hero divider');
  await page.getByLabel('更多阅读操作', { exact: true }).click();
  await page.getByLabel('阅读字号').selectOption('large');
  await page.getByRole('button', { name: '深色', exact: true }).click();
  assert.equal(await page.locator('.content-card').first().evaluate(el => getComputedStyle(el).fontSize), '21px');
  for (const width of [320, 390, 1280]) {
    await page.setViewportSize({ width, height: 844 });
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `Reader fits ${width}px`);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: `${output}/codex_reader_dark_large.png` });
  await page.keyboard.press('Escape');
  await page.mouse.wheel(0, 700);
  await page.waitForFunction(() => scrollY > 500);
  const readY = await page.evaluate(() => scrollY);
  await page.waitForFunction(({ id, y }) => JSON.parse(localStorage.getItem('codex-reading-progress-v1') || '{}')[`entry:${id}`] === y, { id: entries[0].id, y: readY });
  await page.getByRole('button', { name: '← 返回', exact: true }).click();
  await page.waitForURL(listUrl).catch(async error => {
    console.error(await page.evaluate(() => ({ url: location.href, history: history.state, menus: document.querySelectorAll('details[open]').length, progress: localStorage.getItem('codex-reading-progress-v1') })));
    throw error;
  });
  await page.locator(`.entry-card[href$="/entries/${entries[0].id}"]`).click();
  await page.getByRole('button', { name: '继续阅读', exact: true }).click();
  await page.waitForFunction(y => Math.abs(scrollY - y) < 5, readY, { timeout: 3000 }).catch(async error => { console.error({ expected: readY, actual: await page.evaluate(() => ({ y: scrollY, saved: localStorage.getItem('codex-reading-progress-v1') })) }); throw error; });
  assert.equal(await page.getByLabel('阅读字号').inputValue(), 'large');
  assert.equal(await page.locator('.codex-reader-dark').count(), 1);

  for (const type of ['song', 'album', 'month', 'year']) {
    const entry = entries.find(item => item.type === type);
    await page.goto(origin + '/#/entries/' + entry.id);
    const counter = page.locator('.content-word-count');
    await counter.waitFor();
    assert.equal(await counter.innerText(), `字数：${['month', 'year'].includes(type) ? 17 : entry.content.trim().length}`);
    assert.equal(await page.locator('.content-card').evaluate(el => el.firstChild.textContent), entry.content, 'Body text is retained verbatim');
    for (const dark of [true, false]) {
      await page.getByLabel('更多阅读操作', { exact: true }).click();
      if (Boolean(await page.locator('.codex-reader-dark').count()) !== dark) {
        await page.getByRole('button', { name: dark ? '深色' : '浅色', exact: true }).click();
      }
      await page.keyboard.press('Escape');
      for (const width of [320, 390, 1280]) {
        await page.setViewportSize({ width, height: 844 });
        const layout = await counter.evaluate(el => {
          const article = el.closest('article');
          const text = document.createRange(); text.selectNodeContents(article.firstChild);
          const body = text.getBoundingClientRect(), count = el.getBoundingClientRect();
          const note = article.nextElementSibling;
          return { alignment: getComputedStyle(el).textAlign, afterBody: count.top >= body.bottom,
            endsArticle: article.lastElementChild === el, rightInset: article.getBoundingClientRect().right - count.right,
            beforeNote: !note || count.bottom <= note.getBoundingClientRect().top,
            fits: document.documentElement.scrollWidth <= innerWidth };
        });
        assert.equal(layout.alignment, 'right');
        assert.ok(layout.afterBody && layout.endsArticle && layout.beforeNote && layout.fits, `${type} ${width}px ${dark ? 'dark' : 'light'} body-end count: ${JSON.stringify(layout)}`);
        assert.ok(Math.abs(layout.rightInset) < 1, 'Word count aligns with the body right edge');
      }
      if (type === 'month') {
        await page.setViewportSize({ width: 390, height: 844 });
        await page.locator('.content-card').screenshot({ path: `${output}/codex_word_count_${dark ? 'dark' : 'light'}.png` });
      }
    }
    await page.goto(origin + '/#/entries/' + entry.id + '?share=1');
    await page.reload();
    await page.locator('.review-share-dialog').waitFor();
    assert.equal(await page.locator('.review-share-preview').isVisible(), true);
    await page.keyboard.press('Escape');
    await page.locator('.review-share-dialog').waitFor({ state: 'detached' });
  }
  await page.goto(origin + '/#/summary/2026/1');
  await page.getByRole('button', { name: '生成月度报告', exact: true }).click();
  await page.getByRole('button', { name: '更新月度报告', exact: true }).waitFor();
  await page.locator('.codex-reader-toolbar').getByRole('button', { name: '分享', exact: true }).click();
  await page.locator('.review-share-preview').waitFor();
  await page.keyboard.press('Escape');
  await page.screenshot({ path: `${output}/codex_month_reader.png` });
  const savedReport = await page.evaluate(() => localStorage.getItem('music-feelings-mobile-monthly-summaries'));
  await page.evaluate(async () => { const { store } = await import('/src/store.ts'); store.generateMonthlySummary = async () => { throw new Error('模拟保存失败'); }; });
  await page.getByRole('button', { name: '更新月度报告', exact: true }).click();
  await page.getByText('生成失败，已保留上一次报告：模拟保存失败', { exact: true }).waitFor();
  assert.equal(await page.evaluate(() => localStorage.getItem('music-feelings-mobile-monthly-summaries')), savedReport);
  assert.deepEqual(await page.evaluate(() => JSON.parse(localStorage.getItem('music-feelings-mobile-entries'))), entries, 'Reading and sharing never mutate reviews');
  const editedEntry = entries.find(item => item.type === 'album');
  await page.goto(origin + '/#/entries/' + editedEntry.id + '/edit');
  await page.locator('textarea[name="content"]').fill('正文变更后。');
  await page.getByRole('button', { name: '保存正式乐评', exact: true }).click();
  await page.waitForURL(/\?saved=1/);
  assert.equal(await page.locator('.content-word-count').innerText(), '字数：6', 'Saving edited prose updates the displayed count');
  const stored = await page.evaluate(async id => (await (await import('/src/store.ts')).store.getEntry(id)), editedEntry.id);
  assert.equal(stored.content, '正文变更后。', 'Count is never appended to stored prose');
  assert.deepEqual([stored.rating, stored.ratingModifier], [editedEntry.rating, editedEntry.ratingModifier]);
  assert.equal(await page.locator('vite-error-overlay').count(), 0);
  assert.deepEqual(errors, []);
  console.log('PASS reading: search/scroll return; reader preferences/resume; body-end counts for short/long prose and four types, light/dark at 320/390/1280px; edit updates count without storing it; sharing/reports; reviews unchanged by reading; no runtime errors.');
} finally { await browser.close(); }
