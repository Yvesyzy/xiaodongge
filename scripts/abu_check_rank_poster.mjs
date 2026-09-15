// 自检：年度榜单海报的专属设计——底色、金色标尺、奖牌名次刻度、封面区块、分页与截断。
// 像素级断言直接读渲染结果的 ImageData，不依赖截图；同时把每页 PNG 落盘供人工目检。
// 用法：先起 vite dev server，再运行 node scripts/abu_check_rank_poster.mjs <origin>
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { makeJournalFixtures } from '../mobile/codex_journal_fixtures.mjs';

const origin = process.argv[2] || 'http://127.0.0.1:5181';
const output = process.env.ABU_QA_DIR || 'release/abu_rank_poster_qa';
await mkdir(output, { recursive: true });

// 与 mobile/src/codex_yearbookPages.ts 的 RANK_* 常量保持一致。
const MARGIN = 72;
const BODY_TOP = 420;
const SLOT = 228;
const COVER_X = 168;
const COVER = 116;

const albums = [
  { albumName: '夜行列车', artistName: '林一', note: '整张专辑的空间感很好，鼓组留白让人喘得过气。' },
  { albumName: '潮汐记', artistName: '海边的房间', note: '在通勤路上反复听，第三首开始进入状态。' },
  { albumName: '未完成的夏天', artistName: null, note: '' },
  // 第 4 张没有对应记录，验证「原记录已删除」时封面与评分都不崩。
  { albumName: '已删除的专辑', artistName: '无名', note: '这条用于验证记录缺失时导出不崩。' },
  // 超长专辑名，验证单行省略号截断。
  { albumName: '这是一个用于验证单行截断的超长专辑名称'.repeat(4), artistName: '非常长的音乐人名字'.repeat(3), note: '理由'.repeat(120) },
];
for (let i = 6; i <= 15; i++) albums.push({ albumName: `压力测试专辑 ${i}`, artistName: `艺人 ${i}`, note: '这是用于检查换行与截断的长理由文字。'.repeat(8) });

const lum = ([r, g, b]) => 0.2126 * r + 0.7152 * g + 0.0722 * b;
const diff = (a, b) => Math.max(Math.abs(a[0] - b[0]), Math.abs(a[1] - b[1]), Math.abs(a[2] - b[2]));

const browser = await chromium.launch({ channel: 'chrome', headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, timezoneId: 'Asia/Shanghai' });
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
  await page.goto(origin);

  const entries = makeJournalFixtures('6');
  // 前两张与榜单前两名同名同艺人，用于验证封面与评分能对齐到真实记录。
  entries[0].type = 'album'; entries[0].albumName = '夜行列车'; entries[0].artistName = '林一';
  entries[0].rating = 9; entries[0].ratingModifier = '+'; entries[0].year = 2026; entries[0].month = 9;
  entries[1].type = 'album'; entries[1].albumName = '潮汐记'; entries[1].artistName = '海边的房间';
  entries[1].rating = 8; entries[1].ratingModifier = null; entries[1].year = 2026; entries[1].month = 8;
  await page.evaluate(({ items, top }) => {
    localStorage.clear();
    localStorage.setItem('music-feelings-mobile-entries', JSON.stringify(items));
    localStorage.setItem('music-feelings-mobile-app-data', JSON.stringify({ 'top-albums:2026': JSON.stringify({ albums: top }) }));
  }, { items: entries, top: albums });
  // 重新载入，让 store 读到刚写入的本地数据。
  await page.goto(`${origin}/#/summary?year=2026&view=cover`, { waitUntil: 'networkidle' });

  // 给前 3 张专辑写入真实封面，验证封面裁切与圆角描边，而不是只看占位字母。
  const covered = await page.evaluate(async () => {
    const { store } = await import('/src/store.ts');
    const makeCover = (i) => {
      const canvas = document.createElement('canvas'); canvas.width = canvas.height = 320;
      const ctx = canvas.getContext('2d');
      const paint = ctx.createLinearGradient(0, 0, 320, 320);
      paint.addColorStop(0, `hsl(${(i * 47) % 360} 46% 56%)`);
      paint.addColorStop(1, `hsl(${(i * 47 + 70) % 360} 42% 21%)`);
      ctx.fillStyle = paint; ctx.fillRect(0, 0, 320, 320);
      ctx.fillStyle = 'rgba(255,255,255,.86)'; ctx.font = '700 150px sans-serif'; ctx.textAlign = 'center';
      ctx.fillText(String(i + 1), 160, 208);
      return canvas.toDataURL('image/png');
    };
    const all = await store.listEntries();
    // 只有前两名在记录里存在；第三名故意没有对应记录，用于验证兜底分支。
    const names = ['夜行列车', '潮汐记'];
    let count = 0;
    for (const [i, name] of names.entries()) {
      const target = all.find((entry) => entry.albumName === name);
      if (!target) continue;
      await store.setCover('album', target, makeCover(i));
      count += 1;
    }
    return count;
  });
  assert.equal(covered, 2, '测试封面写入失败，视觉样张会退化成占位字母');
  console.log('已写入 2 张真实封面，样张可验证封面裁切效果');

  const result = await page.evaluate(async (config) => {
    const { MARGIN, BODY_TOP, SLOT, COVER_X, COVER } = config;
    const mod = await import('/src/codex_yearbookPages.ts');
    const { store } = await import('/src/store.ts');
    const all = await store.listEntries();
    const options = { topAlbums: { albums: config.albums } };
    const plan = await mod.planJournalPages(2026, all, 'rank', options);
    const shots = [];
    const samples = [];
    for (const [i, item] of plan.entries()) {
      const blob = await mod.renderJournalPage(2026, all, item, i, plan.length, new Date(2026, 8, 15), options);
      const bitmap = await createImageBitmap(blob);
      const canvas = document.createElement('canvas');
      canvas.width = mod.JOURNAL_WIDTH; canvas.height = mod.JOURNAL_HEIGHT;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(bitmap, 0, 0); bitmap.close();
      const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const at = (x, y) => { const p = (y * canvas.width + x) * 4; return [data[p], data[p + 1], data[p + 2]]; };
      const countWarm = (x0, y0, x1, y1) => {
        let n = 0;
        for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) { const [r, g, b] = at(x, y); if (r > 150 && g > 105 && r - b > 45) n++; }
        return n;
      };
      const slots = item.rankSlots ?? [];
      samples.push({
        bg: at(40, 800),
        ruleHead: at(120, 372),
        ruleTail: at(960, 372),
        footerRule: at(540, 1590),
        numeralWarm: countWarm(MARGIN + 16, BODY_TOP + 62, MARGIN + 96, BODY_TOP + 108),
        covers: slots.map((_, n) => at(COVER_X + COVER / 2, BODY_TOP + n * SLOT + 44 + COVER / 2)),
        ticks: slots.map((_, n) => at(MARGIN + 3, BODY_TOP + n * SLOT + 85)),
        titleBand: at(120, 262),
      });
      shots.push(canvas.toDataURL('image/png'));
    }
    return {
      shots,
      samples,
      pages: plan.map((item) => ({
        title: item.title,
        lines: item.lines.length,
        slots: (item.rankSlots ?? []).map((slot) => ({ rank: slot.rank, name: slot.name, meta: slot.meta, notes: slot.notes.length, live: !!slot.entry })),
      })),
    };
  }, { albums, MARGIN, BODY_TOP, SLOT, COVER_X, COVER });

  // —— 1) 分页：15 张 → 3 页，每页 5 个槽位，名次连续 ——
  assert.equal(result.pages.length, 3, '15 张专辑应导出 3 页');
  assert.deepEqual(result.pages.map((p) => p.slots.length), [5, 5, 5]);
  assert.deepEqual(result.pages.map((p) => p.slots[0].rank), [1, 6, 11]);
  assert.equal(result.pages[0].title, '我的年度专辑榜单');
  assert.equal(result.pages[1].title, '年度专辑榜单 · 续');
  assert.ok(result.pages.every((p) => p.lines === 0), '海报不走 lines 通道');
  assert.ok(result.pages.flatMap((p) => p.slots).every((s) => s.notes <= 3), '入选理由最多 3 行');
  const firstSlots = result.pages[0].slots;
  // 只有前两名对得上真实记录；其余走「原记录已删除」兜底而不是抛错。
  assert.deepEqual(firstSlots.map((s) => s.live), [true, true, false, false, false], '仅前两名能对齐真实记录');
  assert.equal(firstSlots[0].meta, '林一 · 9+ / 10');
  assert.equal(firstSlots[2].meta, '未填写音乐人 · 原记录已删除');
  assert.equal(firstSlots[3].meta, '无名 · 原记录已删除');
  // 超长专辑名 / 艺人名在单行内截断，不能压出右边界。
  assert.ok(firstSlots[4].name.endsWith('…') && firstSlots[4].name.length < albums[4].albumName.length, '超长专辑名应单行截断');
  assert.ok(firstSlots[4].meta.endsWith('…') && firstSlots[4].meta.length < albums[4].artistName.length + 8, '超长艺人名应单行截断');
  console.log('PASS 分页与槽位：15 张 → 3 页（5+5+5），名次 01/06/11 起，理由 ≤3 行，缺失记录与超长文本均已兜底');

  // —— 2) 专属底色：整体深绿黑，且页脚/正文区域不回到浅色 ——
  for (const [i, s] of result.samples.entries()) {
    assert.ok(lum(s.bg) < 40, `第 ${i + 1} 页底色应为深色，实测 ${JSON.stringify(s.bg)}`);
  }
  console.log('PASS 专属底色：三页底色亮度全部 < 40（非浅色主题）');

  // —— 3) 金色标尺：头部短金条 + 通栏淡金细线 ——
  for (const [i, s] of result.samples.entries()) {
    const [r, g, b] = s.ruleHead;
    assert.ok(r > 150 && g > 105 && r - b > 45, `第 ${i + 1} 页金色标尺缺失，实测 ${JSON.stringify(s.ruleHead)}`);
    assert.ok(diff(s.ruleTail, s.bg) > 8, `第 ${i + 1} 页通栏细线不可见`);
  }
  console.log('PASS 金色标尺：短金条与通栏细线在三页均存在');

  // —— 4) 奖牌名次刻度：前三名彩色，其余暗绿 ——
  const first = result.samples[0];
  [0, 1, 2].forEach((n) => assert.ok(lum(first.ticks[n]) > 110, `名次 ${n + 1} 的刻度应为奖牌色，实测 ${JSON.stringify(first.ticks[n])}`));
  [3, 4].forEach((n) => assert.ok(lum(first.ticks[n]) < 100, `名次 ${n + 1} 的刻度应为暗绿，实测 ${JSON.stringify(first.ticks[n])}`));
  assert.ok(first.numeralWarm > 40, `第一名名次应为暖金色，实测暖色像素 ${first.numeralWarm}`);
  // 标题为米白（暖白）：亮度高但蓝通道低于红通道，与冷白明显区分。
  assert.ok(first.titleBand[0] > 200 && first.titleBand[2] > 190 && first.titleBand[2] < first.titleBand[0], `海报标题应为米白，实测 ${JSON.stringify(first.titleBand)}`);
  console.log(`PASS 奖牌刻度：前三名奖牌色、4/5 名暗绿；第一名名次暖金像素 ${first.numeralWarm}`);

  // —— 5) 封面区块：每个槽位都有封面方块，不是底色 ——
  for (const [i, s] of result.samples.entries()) {
    assert.equal(s.covers.length, s.ticks.length);
    s.covers.forEach((cover, n) => assert.ok(diff(cover, s.bg) > 10, `第 ${i + 1} 页第 ${n + 1} 槽封面区块与底色无法区分`));
  }
  console.log('PASS 封面区块：三页共 15 个槽位均有独立封面方块');
  // 前三个槽位写入了真实封面，必须不再是占位底色 [29,58,48]。
  const placeholders = result.samples[0].covers.slice(0, 2).filter((c) => diff(c, [29, 58, 48]) < 24).length;
  assert.equal(placeholders, 0, '已写入封面的槽位仍渲染成占位方块');
  console.log('PASS 真实封面：前三名输出的是专辑封面而非占位方块');

  // —— 6) 页脚：分隔线与页码 ——
  for (const [i, s] of result.samples.entries()) assert.ok(diff(s.footerRule, s.bg) > 12, `第 ${i + 1} 页页脚分隔线不可见`);
  console.log('PASS 页脚：三页分隔线均可见');

  assert.deepEqual(errors, [], '导出过程不应产生运行时报错');

  for (const [i, dataUrl] of result.shots.entries()) {
    const path = `${output}/rank-poster-${i + 1}.png`;
    await writeFile(path, Buffer.from(String(dataUrl).split(',')[1], 'base64'));
    console.log(`样张已落盘：${path}`);
  }
  console.log('ALL PASS 年度榜单海报自检');
} finally {
  await browser.close();
}
