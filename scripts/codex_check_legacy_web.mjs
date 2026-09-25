import assert from 'node:assert/strict';
import { spawn, execFileSync } from 'node:child_process';
import { copyFileSync, createWriteStream, existsSync, mkdirSync, readdirSync, readFileSync, symlinkSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { chromium } from 'playwright';
import { freeLoopbackPort, qaOptions } from './codex_qa_options.mjs';

const root = process.cwd();
const { output: outputOption } = qaOptions({ output: `release/codex_legacy_web_${Date.now()}` });
const output = path.resolve(outputOption);
const app = path.join(output, 'app');
if (existsSync(app)) throw new Error('Use a new legacy-web evidence directory');
mkdirSync(app, { recursive: true });
// Copy only the application, never .env or a user database. All generated files stay in this test directory.
// Node 24.13 fs.cpSync crashes on this Windows workspace; copy only ordinary source files.
for (const directory of ['src', 'shared']) {
  for (const file of readdirSync(directory, { recursive: true, withFileTypes: true })) {
    if (!file.isFile()) continue;
    const source = path.join(file.parentPath, file.name);
    const target = path.join(app, path.relative(root, path.resolve(source)));
    mkdirSync(path.dirname(target), { recursive: true });
    copyFileSync(source, target);
  }
}
for (const name of ['package.json', 'tsconfig.json', 'next-env.d.ts', 'next.config.ts', 'postcss.config.js', 'tailwind.config.ts']) {
  copyFileSync(name, path.join(app, name));
}
symlinkSync(path.join(root, 'node_modules'), path.join(app, 'node_modules'), process.platform === 'win32' ? 'junction' : 'dir');
const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
const installed = JSON.parse(readFileSync('node_modules/next/package.json', 'utf8')).version;
assert.equal(installed, pkg.dependencies.next, 'Test the installed version declared by the lock update');
const databasePath = path.join(output, 'codex_legacy_fixture.db');
const database = new DatabaseSync(databasePath);
database.exec(readFileSync('prisma/migrations/20260626035642_init/migration.sql', 'utf8'));
database.close();
const env = { ...process.env, DATABASE_URL: `file:${databasePath.replaceAll('\\', '/')}`, OPENAI_API_KEY: '', NEXT_TELEMETRY_DISABLED: '1' };
const cli = path.join(root, 'node_modules/next/dist/bin/next');
let server;
let browser;
const logStreams = [];
const evidence = { next: installed, database: databasePath, modes: [], passed: false };
function launch(args, logName) {
  const log = createWriteStream(path.join(output, logName)); logStreams.push(log);
  // Vite's parent process sets development; a production Next build must not inherit it.
  const child = spawn(process.execPath, [cli, ...args], { cwd: app, env: { ...env, NODE_ENV: args[0] === 'dev' ? 'development' : 'production' }, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
  child.stdout.pipe(log, { end: false }); child.stderr.pipe(log, { end: false });
  child.on('error', error => { evidence.processError = error.message; });
  return child;
}
async function stopServer() {
  if (!server || server.exitCode !== null) return;
  const child = server; server = undefined;
  const closed = new Promise(resolve => child.once('close', resolve));
  if (process.platform === 'win32') {
    try { execFileSync('taskkill.exe', ['/pid', String(child.pid), '/t', '/f'], { stdio: 'ignore', windowsHide: true }); } catch { /* Already stopped. */ }
  } else child.kill('SIGTERM');
  await closed;
}
async function start(mode) {
  const port = await freeLoopbackPort();
  const command = pkg.scripts[mode].split(/\s+/);
  assert.equal(command.shift(), 'next');
  assert.deepEqual(command.slice(1), ['--hostname', '127.0.0.1'], `${mode} must bind localhost`);
  server = launch([...command, '--port', String(port), ...(mode === 'dev' ? ['--webpack'] : [])], `${mode}.log`);
  const origin = `http://127.0.0.1:${port}`;
  let ready = false;
  for (let attempts = 0; attempts < 120; attempts++) {
    if (server.exitCode !== null || evidence.processError) throw new Error(`${mode} exited before becoming ready`);
    try { const response = await fetch(`${origin}/api/entries`, { signal: AbortSignal.timeout(2000) }); if (response.ok) { ready = true; break; } } catch { /* Compilation may still be starting. */ }
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  assert.ok(ready, `${mode} startup timed out`);
  const listeners = process.platform === 'win32'
    ? execFileSync('netstat.exe', ['-ano', '-p', 'tcp'], { encoding: 'utf8' }).split(/\r?\n/).filter(line => {
      const fields = line.trim().split(/\s+/); return fields[1]?.endsWith(`:${port}`) && fields[3] === 'LISTENING';
    }) : [];
  if (process.platform === 'win32') {
    assert.ok(listeners.length, 'Verify the actual operating-system listener');
    assert.ok(listeners.every(line => line.trim().split(/\s+/)[1] === `127.0.0.1:${port}`), 'No wildcard or other-interface listener');
  }
  evidence.modes.push({ mode, origin, listeners });
  return origin;
}
try {
  const development = await start('dev');
  assert.deepEqual(await (await fetch(`${development}/api/entries`)).json(), []);
  await stopServer();
  const build = launch(['build', '--webpack'], 'build.log');
  server = build;
  const exitCode = await new Promise((resolve, reject) => { build.once('error', reject); build.once('close', resolve); });
  server = undefined;
  assert.equal(exitCode, 0, 'Next production build passes on the synthetic database');
  const origin = await start('start');
  browser = await chromium.launch({ channel: 'chrome', headless: true });
  const page = await browser.newPage();
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await page.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
  await page.goto(`${origin}/entries/new`);
  await page.locator('input[name="title"]').fill('Codex 旧网页合成记录');
  await page.locator('textarea[name="content"]').fill('仅供本机测试，不含个人档案。');
  await page.locator('input[name="year"]').fill('2026');
  const api = `${origin}/api/entries`;
  const abort = route => route.abort('failed');
  const httpError = route => route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: '合成服务失败' }) });
  const malformed = route => route.fulfill({ status: 200, contentType: 'application/json', body: 'not-json' });
  await page.route(api, abort);
  await page.getByRole('button', { name: '保存记录', exact: true }).click();
  await page.getByText(/保存失败/).waitFor();
  assert.equal(await page.getByRole('button', { name: '保存记录', exact: true }).isEnabled(), true);
  assert.equal(await page.locator('textarea[name="content"]').inputValue(), '仅供本机测试，不含个人档案。');
  await page.unroute(api, abort); await page.route(api, httpError);
  await page.getByRole('button', { name: '保存记录', exact: true }).click();
  await page.getByText(/合成服务失败/).waitFor();
  await page.unroute(api, httpError);
  await page.route(api, malformed);
  await page.getByRole('button', { name: '保存记录', exact: true }).click();
  await page.getByText(/服务器未返回有效记录/).waitFor();
  await page.unroute(api, malformed);
  const blankRecord = route => route.fulfill({ status: 200, json: { id: ' ' } });
  await page.route(api, blankRecord);
  await page.getByRole('button', { name: '保存记录', exact: true }).click();
  await page.getByText(/服务器未返回有效记录/).waitFor();
  assert.equal(await page.locator('textarea[name="content"]').inputValue(), '仅供本机测试，不含个人档案。');
  await page.unroute(api, blankRecord);
  await page.getByRole('button', { name: '保存记录', exact: true }).click();
  await page.waitForURL(url => /^\/entries\/[a-z0-9]+$/.test(url.pathname) && url.pathname !== '/entries/new');
  const id = new URL(page.url()).pathname.split('/').at(-1);
  const saved = await (await fetch(`${api}/${id}`)).json();
  assert.equal(saved.title, 'Codex 旧网页合成记录');
  const updated = await fetch(`${api}/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...saved, title: 'Codex 修改后', rating: 8 }) });
  assert.equal(updated.status, 200);
  assert.equal((await updated.json()).rating, 8);
  await page.goto(`${origin}/yearly-summary?year=2026`);
  const summaryApi = `${origin}/api/yearly-summaries/2026/generate`;
  await page.route(summaryApi, abort);
  await page.getByRole('button', { name: '生成年度总结', exact: true }).click();
  await page.getByText(/生成失败/).waitFor();
  assert.equal(await page.getByRole('button', { name: '生成年度总结', exact: true }).isEnabled(), true);
  await page.unroute(summaryApi, abort); await page.route(summaryApi, httpError);
  await page.getByRole('button', { name: '生成年度总结', exact: true }).click();
  await page.getByText(/合成服务失败/).waitFor();
  await page.unroute(summaryApi, httpError);
  await page.route(summaryApi, malformed);
  await page.getByRole('button', { name: '生成年度总结', exact: true }).click();
  await page.getByText(/服务器未返回有效总结/).waitFor();
  await page.unroute(summaryApi, malformed);
  for (const content of ['', ' ']) {
    const blankSummary = route => route.fulfill({ status: 200, json: { year: 2026, content } });
    await page.route(summaryApi, blankSummary);
    await page.getByRole('button', { name: '生成年度总结', exact: true }).click();
    await page.getByText(/服务器未返回有效总结/).waitFor();
    assert.equal(await page.getByRole('button', { name: '生成年度总结', exact: true }).isEnabled(), true);
    await page.unroute(summaryApi, blankSummary);
  }
  await page.getByRole('button', { name: '生成年度总结', exact: true }).click();
  await page.getByText('年度总结已保存', { exact: true }).waitFor();
  await page.goto(`${origin}/entries/${id}`);
  page.on('dialog', dialog => dialog.accept());
  await page.route(`${api}/${id}`, abort);
  await page.getByRole('button', { name: '删除', exact: true }).click();
  await page.getByText(/删除失败/).waitFor();
  assert.equal(await page.getByRole('button', { name: '删除', exact: true }).isEnabled(), true);
  assert.equal((await fetch(`${api}/${id}`)).status, 200, 'Failed delete preserves the record');
  await page.unroute(`${api}/${id}`, abort); await page.route(`${api}/${id}`, httpError);
  await page.getByRole('button', { name: '删除', exact: true }).click();
  await page.getByText(/合成服务失败/).waitFor();
  await page.unroute(`${api}/${id}`, httpError);
  await page.route(`${api}/${id}`, malformed);
  await page.getByRole('button', { name: '删除', exact: true }).click();
  await page.getByText(/服务器未确认删除/).waitFor();
  assert.equal((await fetch(`${api}/${id}`)).status, 200, 'Malformed success cannot delete the fixture');
  await page.unroute(`${api}/${id}`, malformed);
  await page.getByRole('button', { name: '删除', exact: true }).click();
  await page.waitForURL('**/timeline');
  assert.deepEqual(await (await fetch(api)).json(), []);
  assert.deepEqual(errors, [], 'Network errors are handled by each button');
  evidence.passed = true;
  console.log('PASS legacy web: isolated dev/build/start, actual localhost listeners, CRUD, network/HTTP failures and retries');
} catch (error) {
  evidence.error = error instanceof Error ? error.message : String(error);
  throw error;
} finally {
  await browser?.close();
  await stopServer();
  await Promise.all(logStreams.map(stream => new Promise(resolve => stream.end(resolve))));
  writeFileSync(path.join(output, 'codex_legacy_web_results.json'), JSON.stringify(evidence, null, 2));
}
