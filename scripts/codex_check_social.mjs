import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { chromium } from 'playwright';
import { startQaViteServer } from './codex_qa_harness.mjs';
import { createSocialServer } from '../social/codex_server.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { values } = parseArgs({ options: { output: { type: 'string' }, origin: { type: 'string' } } });
const output = path.resolve(values.output || process.env.CODEX_SOCIAL_QA_DIR || path.join(root, `release/codex_social_qa_${Date.now()}`));
await mkdir(output, { recursive: true });
if (values.origin && !/^http:\/\/127\.0\.0\.1:\d+$/.test(values.origin)) throw new Error('QA origin must be exact HTTP IPv4 loopback');
const { server: vite, origin } = values.origin ? { server: null, origin: values.origin } : await startQaViteServer({ output });
const social = createSocialServer({ dbPath: path.join(output, 'codex_synthetic.sqlite'), allowedOrigins: [origin] });
await new Promise((resolve, reject) => { social.server.once('error', reject); social.server.listen(0, '127.0.0.1', resolve); });
const endpoint = `http://127.0.0.1:${social.server.address().port}`;
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const result = { passed: false, origin, endpoint, browser: 'Installed Chrome via Playwright; no Browser MCP available', viewports: ['390×844', '320×844', '1280×900'], checks: [], errors: [], limitations: ['Synthetic local browser accounts; no public host, Android Keystore runtime or WeChat receiver verified.'] };
const pages = [];
let expectedOffline = false;
async function page() {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const value = await context.newPage(); value.setDefaultTimeout(15000);
  value.on('pageerror', error => result.errors.push(error.message));
  value.on('console', entry => { if (entry.type() === 'error' && !(expectedOffline && /ERR_INTERNET_DISCONNECTED/.test(entry.text()))) result.errors.push(entry.text()); });
  pages.push(value);
  await value.goto(origin + '/#/social');
  await value.getByRole('heading', { name: '好友圈', exact: true }).waitFor();
  return value;
}
async function register(page, username, nickname) {
  await page.getByRole('button', { name: '注册账号', exact: true }).click();
  await page.getByLabel('好友圈服务地址', { exact: true }).fill(endpoint);
  await page.getByLabel('用户名', { exact: true }).fill(username);
  await page.getByLabel('昵称', { exact: true }).fill(nickname);
  await page.getByLabel('密码', { exact: true }).fill('CodexSynthetic_password_2026');
  await page.getByRole('button', { name: '注册并进入好友圈' }).click();
  await page.getByRole('button', { name: '写动态', exact: true }).waitFor();
}
async function tab(page, name) { await page.getByRole('navigation', { name: '好友圈页面' }).getByRole('button', { name, exact: true }).click(); }
async function noOverflow(page) { assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true); }
try {
  const alice = await page(), bob = await page(), carol = await page();
  await alice.screenshot({ path: path.join(output, 'codex_social_login.png'), animations: 'disabled' });
  await register(alice, 'codex_alice', '听见山川');
  await register(bob, 'codex_bob', '夜航听友');
  await register(carol, 'codex_carol', '另一位听友');
  result.checks.push('Three isolated browser accounts register against the real local service');

  await tab(alice, '朋友');
  await alice.getByRole('button', { name: '生成邀请码' }).click();
  await alice.locator('.codex-social-invitation code').waitFor();
  const invite = await alice.locator('.codex-social-invitation code').textContent();
  await alice.evaluate(() => { window.codexOriginalShare = Object.getOwnPropertyDescriptor(navigator, 'share'); Object.defineProperty(navigator, 'share', { configurable: true, value: async value => { window.codexSharedInvite = value; } }); });
  await alice.getByRole('button', { name: '分享邀请', exact: true }).click();
  await alice.getByText('已打开系统分享，请选择接收方。', { exact: true }).waitFor();
  const sharedInvite = await alice.evaluate(() => window.codexSharedInvite);
  assert.ok(sharedInvite.text.includes(invite)); assert.ok(sharedInvite.text.includes(endpoint));
  await alice.evaluate(() => { Object.defineProperty(navigator, 'share', { configurable: true, value: async () => { throw new DOMException('Cancelled', 'AbortError'); } }); });
  await alice.getByRole('button', { name: '分享邀请', exact: true }).click();
  await alice.getByText('已取消分享。', { exact: true }).waitFor();
  await alice.evaluate(() => { if (window.codexOriginalShare) Object.defineProperty(navigator, 'share', window.codexOriginalShare); else delete navigator.share; });
  result.checks.push('Share invocation contains only invitation text and endpoint; cancellation never reports a sent invitation (browser stub)');
  await tab(bob, '朋友');
  await bob.getByLabel('朋友的邀请码').fill(invite);
  await bob.getByRole('button', { name: '发送好友申请' }).click();
  await bob.getByText('好友申请已发送，等待对方确认。', { exact: true }).waitFor();
  await alice.getByRole('button', { name: '刷新朋友' }).click();
  await alice.getByRole('button', { name: '接受申请' }).click();
  await alice.getByRole('heading', { name: '我的听友 · 1' }).waitFor();
  await noOverflow(alice);
  await alice.screenshot({ path: path.join(output, 'codex_social_friends.png'), fullPage: true, animations: 'disabled' });
  result.checks.push('Invite -> request -> explicit acceptance establishes mutual friendship in UI');

  const entryId = await alice.evaluate(async () => {
    const { store } = await import('/src/store.ts');
    const entry = await store.createEntry({ type: 'album', title: '夜航时，听见温柔的回声', year: 2026, month: 10, albumName: '夜航', songName: null, artistName: '合成测试艺人', musicMetadata: { mediaUri: 'private://must-not-upload' }, content: '今晚又听了一遍这张专辑。\n旋律像慢慢亮起来的路灯，鼓点把一天的疲倦轻轻放下。\n想把这一刻的温柔，分享给也在路上的你。', tags: ['private-tag'], moods: ['private-mood'], rating: 8.5, ratingModifier: null, ratingProduction: 8.5, ratingSongwriting: 8.5, ratingLyrics: 8.5, ratingComposition: 8.5, ratingVocals: 8.5, ratingOriginality: 8.5, ratingResonance: 8.5, compositeRatingLocked: false, firstListenedAt: null, listenedAt: '2026-10-10T00:00:00.000Z' });
    const canvas = document.createElement('canvas'); canvas.width = 240; canvas.height = 240;
    const ctx = canvas.getContext('2d'); const gradient = ctx.createLinearGradient(0, 0, 240, 240); gradient.addColorStop(0, '#143b40'); gradient.addColorStop(1, '#ba9e78'); ctx.fillStyle = gradient; ctx.fillRect(0, 0, 240, 240); ctx.fillStyle = '#f4ead9'; ctx.font = 'bold 32px sans-serif'; ctx.fillText('夜 航', 45, 133);
    await store.setCover('album', { albumName: entry.albumName, artistName: entry.artistName }, canvas.toDataURL('image/png'));
    return entry.id;
  });
  await tab(alice, '动态');
  await alice.getByRole('button', { name: '写动态', exact: true }).click();
  await alice.getByLabel('关联本地乐评').selectOption(entryId);
  await alice.getByLabel('分享本地封面').check();
  const publish = alice.getByRole('button', { name: '发布到好友圈', exact: true });
  await publish.waitFor();
  await alice.waitForFunction(() => !document.querySelector('.codex-social-composer button[type="submit"]')?.disabled);
  const publication = alice.waitForRequest(request => request.url() === endpoint + '/v1/posts' && request.method() === 'POST');
  await publish.click();
  const payload = (await publication).postDataJSON();
  assert.equal(payload.review.rating, null); assert.equal(payload.review.listenedAt, null);
  assert.match(payload.review.coverDataUrl, /^data:image\/jpeg;base64,/);
  assert.equal(JSON.stringify(payload).includes('private://'), false);
  assert.equal(JSON.stringify(payload).includes('private-tag'), false);
  assert.equal(JSON.stringify(payload).includes('private-mood'), false);
  assert.deepEqual(Object.keys(payload.review).sort(), ['type', 'title', 'albumName', 'songName', 'artistName', 'rating', 'listenedAt', 'coverDataUrl'].sort());
  await alice.getByText('已发布到好友圈，仅你和当前好友可见。', { exact: true }).waitFor();
  await tab(bob, '动态');
  await bob.getByRole('button', { name: '刷新动态' }).click();
  const bobPost = bob.locator('.codex-social-post').filter({ hasText: '夜航时，听见温柔的回声' });
  await bobPost.waitFor();
  await bobPost.getByRole('button', { name: /^点赞/ }).click();
  await bobPost.getByRole('button', { name: /^已赞 1/ }).waitFor();
  await bobPost.getByRole('button', { name: /^评论/ }).click();
  await bobPost.getByLabel('写评论').fill('也喜欢这一段旋律，下次一起听。');
  await bobPost.getByRole('button', { name: '发送评论', exact: true }).click();
  await bobPost.getByText('也喜欢这一段旋律，下次一起听。', { exact: true }).waitFor();
  await bobPost.getByRole('button', { name: /^评论/ }).click();
  await bobPost.getByRole('button', { name: /^评论/ }).click();
  await bobPost.getByLabel('写评论').fill('折叠评论时保留的输入');
  await bobPost.getByRole('button', { name: /^评论/ }).click();
  await bobPost.getByRole('button', { name: /^评论/ }).click();
  assert.equal(await bobPost.getByLabel('写评论').inputValue(), '折叠评论时保留的输入');
  await bobPost.getByLabel('写评论').fill('');
  result.checks.push('Review preview publishes an explicit metadata allowlist; selected cover re-encoded; friend likes and comments; collapsed input survives');

  await alice.getByRole('button', { name: '刷新动态' }).click();
  const alicePost = alice.locator('.codex-social-post').filter({ hasText: '夜航时，听见温柔的回声' });
  await alicePost.getByRole('button', { name: /^评论 1/ }).click();
  await alicePost.getByText('也喜欢这一段旋律，下次一起听。', { exact: true }).waitFor();
  await noOverflow(alice);
  assert.equal(await alice.title(), '私人音乐档案');
  assert.match(alice.url(), /#\/social$/);
  assert.equal(await alice.locator('vite-error-overlay').count(), 0);
  await alice.evaluate(() => window.scrollTo(0, 0));
  await alice.screenshot({ path: path.join(output, 'codex_social_feed_light.png'), animations: 'disabled' });
  await alice.evaluate(() => { document.documentElement.dataset.theme = 'dark'; });
  await alice.screenshot({ path: path.join(output, 'codex_social_feed_dark.png'), animations: 'disabled' });
  await alice.setViewportSize({ width: 320, height: 844 }); await noOverflow(alice);
  await alice.screenshot({ path: path.join(output, 'codex_social_320.png'), animations: 'disabled' });
  await alice.evaluate(() => { document.documentElement.dataset.theme = 'light'; });
  await alice.setViewportSize({ width: 1280, height: 900 }); await noOverflow(alice);
  await alice.screenshot({ path: path.join(output, 'codex_social_desktop.png'), animations: 'disabled' });
  result.checks.push('Meaningful page, correct identity, no framework overlay, light/dark and 320/390/1280 viewport evidence');

  await alice.evaluate(async id => { const { store } = await import('/src/store.ts'); const value = await store.getEntry(id); const { id: _, createdAt, updatedAt, ...input } = value; await store.updateEntry(id, { ...input, content: '修改后的本地私人正文，不能改变动态。' }); }, entryId);
  await alice.getByRole('button', { name: '刷新动态' }).click();
  await alicePost.getByText(/今晚又听了一遍这张专辑/).waitFor();
  assert.equal(await carol.locator('.codex-social-post').count(), 0);
  await carol.getByRole('button', { name: '刷新动态' }).click();
  await carol.getByText('听感，从第一次分享开始', { exact: true }).waitFor();
  result.checks.push('Local review edit leaves published snapshot unchanged; non-friend sees no private posts');

  await alice.setViewportSize({ width: 390, height: 844 });
  await alice.getByRole('button', { name: '写动态', exact: true }).click();
  await alice.getByLabel('动态正文').fill('断网重试仍保留的输入。');
  let leavePrompted = false;
  alice.once('dialog', async dialog => { leavePrompted = true; await dialog.dismiss(); });
  await alice.locator('.bottom-nav a').filter({ hasText: '首页' }).click();
  assert.equal(leavePrompted, true);
  assert.match(alice.url(), /#\/social$/);
  assert.equal(await alice.getByLabel('动态正文').inputValue(), '断网重试仍保留的输入。');
  result.checks.push('Declining navigation preserves an unpublished post when using the main app navigation');
  expectedOffline = true;
  await alice.route(endpoint + '/v1/posts', route => route.abort('internetdisconnected'));
  const failedRequest = alice.waitForRequest(request => request.url() === endpoint + '/v1/posts' && request.method() === 'POST');
  await alice.getByRole('button', { name: '发布到好友圈', exact: true }).click();
  const firstAttempt = (await failedRequest).postDataJSON();
  await alice.getByRole('alert').filter({ hasText: '无法连接好友圈服务' }).waitFor();
  assert.equal(await alice.getByLabel('动态正文').inputValue(), '断网重试仍保留的输入。');
  await alice.unroute(endpoint + '/v1/posts');
  expectedOffline = false;
  const retriedRequest = alice.waitForRequest(request => request.url() === endpoint + '/v1/posts' && request.method() === 'POST');
  await alice.getByRole('button', { name: '发布到好友圈', exact: true }).click();
  assert.equal((await retriedRequest).postDataJSON().clientId, firstAttempt.clientId);
  await alice.locator('.codex-social-post').filter({ hasText: '断网重试仍保留的输入。' }).waitFor();
  result.checks.push('Failed publish preserves text and retries with the same idempotency key');

  await tab(alice, '朋友');
  alice.once('dialog', dialog => dialog.accept());
  await alice.getByRole('button', { name: '解除好友', exact: true }).click();
  await alice.getByText('已解除好友关系。双方不再能查看彼此动态。', { exact: true }).waitFor();
  await bob.getByRole('button', { name: '刷新动态' }).click();
  await bob.getByText('听感，从第一次分享开始', { exact: true }).waitFor();
  result.checks.push('Removing a friendship immediately removes former friend posts on refresh');

  await tab(alice, '账号');
  await alice.getByRole('button', { name: '退出登录', exact: true }).click();
  await alice.getByRole('button', { name: '登录好友圈', exact: true }).waitFor();
  assert.equal(await alice.getByLabel('密码', { exact: true }).inputValue(), '');
  const stored = await bob.evaluate(() => Object.entries(localStorage).filter(([key]) => /social/i.test(key)));
  assert.deepEqual(stored, [['codex.social.endpoint.v1', endpoint]]);
  await bob.reload(); await bob.getByRole('button', { name: '登录好友圈', exact: true }).waitFor();
  result.checks.push('Logout clears UI state; browser refresh requires login; only endpoint stored, no bearer/password');
  assert.deepEqual(result.errors, []);
  result.passed = true;
} catch (error) {
  result.error = error.stack;
  for (const [index, page] of pages.entries()) await page.screenshot({ path: path.join(output, `codex_failure_${index}.png`), fullPage: true }).catch(() => {});
  throw error;
} finally {
  await writeFile(path.join(output, 'codex_social_checks.json'), JSON.stringify(result, null, 2));
  await browser.close(); await social.close(); await vite?.close();
  console.log(JSON.stringify({ passed: result.passed, checks: result.checks, errors: result.errors, output }));
}
