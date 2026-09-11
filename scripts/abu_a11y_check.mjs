/**
 * Accessibility audit for the mobile web UI: text contrast (WCAG AA) and
 * touch-target sizes. Feeds the design review with measurements instead of
 * impressions.
 *
 * Usage: node scripts/abu_a11y_check.mjs [origin]
 * Output: release/abu_a11y_qa/abu_a11y_report.json
 */
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import { makeJournalFixtures } from '../mobile/codex_journal_fixtures.mjs';

const origin = process.argv[2] || 'http://127.0.0.1:5182';
const output = process.env.ABU_QA_DIR || 'release/abu_a11y_qa';
await mkdir(output, { recursive: true });

const channel = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
const luminance = ([r, g, b]) => 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
const contrast = (a, b) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

const page = await (await chromium.launch({ channel: 'chrome', headless: true })).newPage({
  viewport: { width: 390, height: 844 },
  timezoneId: 'Asia/Shanghai',
});
await page.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
await page.goto(origin);
const entries = makeJournalFixtures('6');
await page.evaluate(items => {
  localStorage.clear(); sessionStorage.clear();
  localStorage.setItem('music-feelings-mobile-entries', JSON.stringify(items));
}, entries);
await page.reload();

// Runs in the page: walks visible text and controls, resolving the effective
// background by climbing ancestors until an opaque fill is found.
const collect = () => {
  const parse = (value) => {
    const m = value.match(/rgba?\(([^)]+)\)/);
    if (!m) return null;
    const p = m[1].split(/[,/]/).map(s => parseFloat(s));
    return { rgb: p.slice(0, 3), alpha: p.length > 3 ? p[3] : 1 };
  };
  const backgroundOf = (el) => {
    let node = el;
    while (node && node !== document.documentElement) {
      const s = getComputedStyle(node);
      const bg = parse(s.backgroundColor);
      if (bg && bg.alpha > 0.85) return bg.rgb;
      // Raised buttons and dark cards paint with a gradient while
      // background-color stays transparent; without this the walk escapes to
      // the page paper and reports white-on-green text as white-on-paper.
      const stops = s.backgroundImage && s.backgroundImage.match(/rgba?\([^)]+\)/g);
      if (stops) {
        const first = parse(stops[0]);
        if (first && first.alpha > 0.5) return first.rgb;
      }
      node = node.parentElement;
    }
    const body = parse(getComputedStyle(document.body).backgroundColor);
    return body ? body.rgb : [255, 255, 255];
  };
  const visible = (el) => {
    const r = el.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) return false;
    const s = getComputedStyle(el);
    return s.visibility !== 'hidden' && s.display !== 'none' && parseFloat(s.opacity) > 0.1;
  };

  const texts = [];
  for (const el of document.querySelectorAll('p, span, small, h1, h2, h3, label, time, strong, button, a, summary, div')) {
    const own = Array.from(el.childNodes).some(n => n.nodeType === 3 && n.textContent.trim().length > 1);
    if (!own || !visible(el)) continue;
    const s = getComputedStyle(el);
    const text = el.textContent.trim().slice(0, 40);
    if (!text) continue;
    const fg = parse(s.color);
    if (!fg || fg.alpha < 0.5) continue;
    texts.push({
      text,
      size: parseFloat(s.fontSize),
      weight: parseInt(s.fontWeight, 10) || 400,
      fg: fg.rgb,
      bg: backgroundOf(el),
    });
  }

  const smallTargets = [];
  for (const el of document.querySelectorAll('button, a[href], summary, input:not([type="hidden"]), select, textarea, [role="button"]')) {
    if (!visible(el)) continue;
    const r = el.getBoundingClientRect();
    if (r.width >= 44 && r.height >= 44) continue;
    const parent = el.parentElement;
    smallTargets.push({
      tag: el.tagName.toLowerCase(),
      cls: (el.className || '').toString().slice(0, 60),
      // Without the parent, class-less chips are impossible to target from CSS.
      parent: parent
        ? parent.tagName.toLowerCase() + (parent.className ? '.' + String(parent.className).trim().split(/\s+/).join('.') : '')
        : '',
      type: el.getAttribute('type') || '',
      w: Math.round(r.width),
      h: Math.round(r.height),
      text: (el.getAttribute('aria-label') || el.textContent || '').trim().slice(0, 30),
    });
  }
  return { texts, smallTargets };
};

const routes = [
  ['home', '/'], ['albums', '/albums'], ['songs', '/songs'], ['timeline', '/timeline'],
  ['capture', '/capture'], ['editor', '/new'], ['search', '/search'],
  ['yearbook', '/summary'], ['more', '/more'], ['reader', `/entries/${entries[0].id}`],
];

const report = [];
for (const [name, route] of routes) {
  await page.goto(origin + '/#' + route);
  await page.waitForTimeout(400);
  const { texts, smallTargets } = await page.evaluate(collect);
  const scored = texts.map(t => ({
    ...t,
    ratio: Math.round(contrast(t.fg, t.bg) * 100) / 100,
    // WCAG AA: 3:1 for large text (>=18.66px bold or >=24px), else 4.5:1.
    required: (t.size >= 24 || (t.size >= 18.66 && t.weight >= 700)) ? 3 : 4.5,
  }));
  report.push({
    page: name,
    route,
    failures: scored.filter(t => t.ratio < t.required).sort((a, b) => a.ratio - b.ratio),
    checked: scored.length,
    smallTargets,
  });
}

await writeFile(`${output}/abu_a11y_report.json`, JSON.stringify(report, null, 2));
for (const r of report) {
  console.log(`\n== ${r.page} (${r.checked} text nodes) — ${r.failures.length} contrast failures, ${r.smallTargets.length} small targets`);
  for (const f of r.failures.slice(0, 6)) {
    console.log(`   ${f.ratio} < ${f.required}  ${f.size}px/${f.weight}  "${f.text}"  rgb(${f.fg}) on rgb(${f.bg})`);
  }
  for (const s of r.smallTargets.slice(0, 6)) {
    console.log(`   target ${s.w}x${s.h}  <${s.tag}> "${s.text}"`);
  }
}
console.log(`\nreport: ${output}/abu_a11y_report.json`);
process.exit(0);
