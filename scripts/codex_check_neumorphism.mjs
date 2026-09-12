import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { makeJournalFixtures } from '../mobile/codex_journal_fixtures.mjs';

const origin = process.argv[2] || 'http://127.0.0.1:5181';
const before = process.argv.includes('--before');
const output = process.env.CODEX_QA_DIR || 'release/codex_neumorphism_qa';
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, timezoneId: 'Asia/Shanghai' });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
  await page.goto(origin);
  const entries = makeJournalFixtures('6');
  entries[0].title = '一张专辑，留下几个想再听一次的瞬间';
  entries[0].albumName = 'Intro / Roll the Blame / JaJa / 知更鸟的落点 / 佛哦佛 404';
  entries[0].artistName = 'LSGCsikoriot';
  entries[0].type = 'album';
  entries[0].year = 2026;
  entries[0].month = 9;
  entries[0].rating = 8;
  entries[0].ratingModifier = '-';
  entries[0].content = '这是用于排版检查的模拟乐评。\n\n我之前不认识这位歌手，也没听过他的歌。这张专辑让我对他过去的音乐产生了兴趣。\n\n最喜欢的是人声和伴奏之间的空间：有些地方贴得很近，有些地方又留出足够的余韵。重新听的时候，我开始注意那些第一次没有发现的细节。\n\n' + '阅读应该有舒服的留白，也应该完整保留记录。'.repeat(30) + '\n\n' + 'VeryLongUnbrokenMusicTitle'.repeat(12);
  await page.evaluate(items => {
    localStorage.clear(); sessionStorage.clear();
    localStorage.setItem('music-feelings-mobile-entries', JSON.stringify(items));
  }, entries);
  await page.reload();
  const metrics = [];
  for (const [name, route, selector] of [
    ['home', '/', '.home-entry-row'], ['timeline', '/timeline', '.codex-timeline-card'],
    ['albums', '/albums', '.cover-row'], ['songs', '/songs', '.cover-row'], ['search', '/search', '.search-box'],
    ['editor', '/new', '.writing-form'], ['capture', '/capture', '.quick-capture-form'],
    ['yearbook', '/summary', '.journal-page'], ['more', '/more', '.page'],
    ['reader', `/entries/${entries[0].id}`, '.content-card'],
  ]) {
    await page.goto(origin + '/#' + route);
    await page.locator(selector).first().waitFor();
    for (const width of before ? [390] : [320, 390, 430, 768, 1280]) {
      await page.setViewportSize({ width, height: 844 });
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${name} fits ${width}`);
      if (!before && ['albums', 'songs'].includes(name)) {
        const spacing = await page.locator('.cover-row').evaluateAll(rows => rows.map(row => {
          const card = row.getBoundingClientRect();
          const cover = row.querySelector('.cover-art').getBoundingClientRect();
          const copy = row.querySelector('.cover-copy').getBoundingClientRect();
          return { left: cover.left - card.left, right: card.right - copy.right, gap: copy.left - cover.right };
        }));
        assert.ok(spacing.every(row => row.left >= 18 && row.right >= 18 && row.gap >= 14), `${name}: covers and text stay inside padded cards at ${width}px`);
      }
      if (width === 390) await page.screenshot({ path: `${output}/codex_${before ? 'before' : 'after'}_${name}.png`, fullPage: name === 'home' });
    }
  }
  if (!before) {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(origin + '/#/');
    await page.locator('.home-entry-row').first().waitFor();
    const dateClear = await page.locator('.codex-entry-list-item').first().evaluate(el => {
      const date = el.querySelector('time').getBoundingClientRect();
      const menu = el.querySelector('summary').getBoundingClientRect();
      return date.right <= menu.left || date.top >= menu.bottom;
    });
    assert.ok(dateClear, 'Recent-entry date stays clear of share menu');
    const newButton = page.locator('.bottom-nav button');
    await newButton.hover();
    await page.mouse.down();
    await page.waitForTimeout(160);
    assert.equal(await newButton.evaluate(el => getComputedStyle(el).scale), '0.97', 'Navigation visibly compresses when pressed');
    await page.screenshot({ path: `${output}/codex_button_pressed.png` });
    await page.mouse.up();
    await page.locator('.create-choice').waitFor();
    await page.screenshot({ path: `${output}/codex_after_create_sheet.png` });
    await page.getByRole('button', { name: '关闭', exact: true }).click();
    await page.waitForTimeout(160);
    assert.equal(await newButton.evaluate(el => getComputedStyle(el).scale), 'none', 'Press feedback resets after release');
    await page.goto(origin + '/#/new');
    const draftButton = page.getByRole('button', { name: '保存草稿', exact: true });
    await page.keyboard.press('Tab');
    await draftButton.focus();
    assert.equal(await draftButton.evaluate(el => getComputedStyle(el).outlineStyle), 'solid');
    const resting = await draftButton.evaluate(el => getComputedStyle(el).boxShadow);
    await draftButton.hover();
    await page.mouse.down();
    await page.waitForTimeout(160); // Finish the 120ms press transition before measuring.
    assert.equal(await draftButton.evaluate(el => getComputedStyle(el).scale), '0.97');
    assert.notEqual(await draftButton.evaluate(el => getComputedStyle(el).boxShadow), resting, 'Press has visible feedback');
    await page.mouse.move(0, 0);
    await page.mouse.up();
    // The emulated media query needs a frame to repaint before styles reflect it,
    // otherwise this assertion races and fails intermittently.
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.waitForTimeout(120);
    assert.ok(await draftButton.evaluate(el => getComputedStyle(el).transitionDuration.split(',').every(duration => parseFloat(duration) <= .001)), 'Reduced motion has no perceptible press transition');
    await draftButton.hover();
    await page.mouse.down();
    // Assert the settled press state, not a same-tick frame: reading scale
    // immediately after mouse.down() can catch the pre-press value of 1 and
    // "pass" for the wrong reason, which made this assertion flaky.
    await page.waitForTimeout(160);
    assert.equal(await draftButton.evaluate(el => getComputedStyle(el).scale), '1', 'Reduced motion suppresses shrinking');
    assert.notEqual(await draftButton.evaluate(el => getComputedStyle(el).filter), 'none', 'Reduced motion keeps color feedback');
    await page.mouse.move(0, 0);
    await page.mouse.up();
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await page.goto(origin + '/#/summary?year=2026');
    await page.getByRole('link', { name: '开始阅读', exact: true }).click();
    await page.locator('.journal-body').waitFor();
    await page.screenshot({ path: `${output}/codex_after_yearbook_reader.png` });
    for (const width of [320, 390, 1280]) {
      await page.setViewportSize({ width, height: 844 });
      assert.ok(await page.locator('.journal-body').evaluate(el => { const r = el.getBoundingClientRect(); return r.left >= 26 && innerWidth - r.right >= 26; }), 'Yearbook prose shares reading gutters');
    }
    await page.goto(origin + '/#/entries/' + entries[0].id);
  }
  for (const dark of [false, true]) {
    for (const size of ['small', 'normal', 'large']) {
      await page.evaluate(value => localStorage.setItem('codex-reading-preferences-v1', JSON.stringify(value)), { dark, size });
      await page.reload();
      await page.locator('.content-card').waitFor();
      if (!before && dark) {
        const shadow = await page.locator('.codex-reader-actions>button').evaluate(el => getComputedStyle(el).boxShadow);
        assert.ok(!shadow.includes('255, 255, 255'), 'Dark reader does not inherit a white halo');
      }
      for (const width of before ? [390] : [320, 390, 430, 768, 1280]) {
        await page.setViewportSize({ width, height: 844 });
        const geometry = await page.locator('.content-card').evaluate(el => {
          const rect = el.getBoundingClientRect();
          return { left: rect.left, right: innerWidth - rect.right, width: rect.width, font: getComputedStyle(el).fontSize, overflow: document.documentElement.scrollWidth > innerWidth, text: el.textContent };
        });
        metrics.push({ dark, size, viewportWidth: width, ...geometry, text: undefined });
        assert.equal(geometry.text, entries[0].content, 'Original text and line breaks preserved');
        assert.equal(geometry.overflow, false);
        if (!before) {
          assert.ok(geometry.left >= 26 && geometry.right >= 26, 'Reading has at least 26px gutters');
          assert.ok(geometry.width <= 620, 'Long reading lines bounded on desktop');
        }
        if (width === 390 && size === 'normal') {
          await page.evaluate(() => window.scrollTo(0, 0));
          await page.screenshot({ path: `${output}/codex_${before ? 'before' : 'after'}_reader_${dark ? 'dark' : 'light'}.png` });
          await page.locator('.content-card').scrollIntoViewIfNeeded();
          await page.screenshot({ path: `${output}/codex_${before ? 'before' : 'after'}_body_${dark ? 'dark' : 'light'}.png` });
        }
      }
    }
  }
  assert.deepEqual(errors, []);
  await writeFile(`${output}/codex_${before ? 'before' : 'after'}_metrics.json`, JSON.stringify(metrics, null, 2));
  console.log(`PASS ${before ? 'baseline' : 'redesign'}: ten routes; album/song card padding; reader gutters, three sizes, both themes, unchanged text, no runtime errors.`);
} finally { await browser.close(); }
