import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { _electron as electron } from 'playwright';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const latest = JSON.parse(await readFile(path.join(root, 'release', 'codex_windows_latest.json'), 'utf8'));
const executable = process.argv[2] ? path.resolve(process.argv[2]) : latest.executable;
const runFile = promisify(execFile);
const control = action => runFile('powershell.exe', ['-NoLogo', '-NoProfile', '-NonInteractive',
  '-ExecutionPolicy', 'Bypass', '-File', path.join(root, 'scripts', 'codex_inspect_windows_sessions.ps1'), '-Control', action],
{ windowsHide: true, timeout: 20000 });
const output = path.join(root, 'release', `codex_windows_live_playback_${Date.now()}`);
const profile = path.join(output, 'profile');
await mkdir(output, { recursive: false });
const errors = [];
let restorePlaying = false;
const application = await electron.launch({ executablePath: executable,
  args: [`--codex-profile=${profile}`], cwd: root, timeout: 30000 });
try {
  assert.equal(await application.evaluate(({ app }) => app.getPath('userData')), profile);
  const page = await application.firstWindow();
  page.on('pageerror', error => errors.push(error.message));
  await page.waitForSelector('.desktop-app-shell', { timeout: 30000 });
  const diagnostics = await page.evaluate(() => window.CapacitorCustomPlatform.plugins.NowPlaying.getDiagnostics());
  assert.equal(diagnostics.mediaAvailable, true);
  assert.ok(diagnostics.mediaSessionCount > 0, '请在网易云开启SMTC并保持播放');
  const track = await page.evaluate(() => window.CapacitorCustomPlatform.plugins.NowPlaying.getCurrentTrack());
  assert.equal(track.accessEnabled, true);
  assert.ok(track.title?.trim(), '需要真实播放器正在播放一首歌');
  assert.equal(track.musicMetadata.sourcePackage, 'cloudmusic.exe');
  const queue = JSON.parse(await readFile(path.join(process.env.LOCALAPPDATA,
    'NetEase', 'CloudMusic', 'webdata', 'file', 'playingList'), 'utf8'));
  const matches = queue.list.filter(item => item.resourceType === 'track' && item.track?.name === track.title);
  assert.equal(matches.length, 1, '实播检查需要队列内歌曲身份唯一');
  assert.equal(track.albumName, matches[0].track.album.name);
  assert.equal(track.artistName, matches[0].track.artists.map(artist => artist.name).join(' / '));
  await page.evaluate(() => { location.hash = '/new'; });
  await page.waitForFunction(() => document.querySelector('input[name="songName"]')?.value.trim(), null, { timeout: 30000 });
  assert.equal(await page.locator('input[name="songName"]').inputValue(), track.title);
  assert.equal(await page.locator('select[name="type"]').inputValue(), 'album');
  assert.equal(await page.locator('input[name="title"]').inputValue(), track.albumName);
  assert.equal(await page.locator('input[name="albumName"]').inputValue(), track.albumName);
  assert.equal(await page.locator('input[name="artistName"]').inputValue(), track.musicMetadata.albumArtistName || track.artistName);
  await page.getByRole('button', { name: '读取当前播放', exact: true }).waitFor({ state: 'visible', timeout: 30000 });
  const status = await page.locator('.assist-panel').filter({ has: page.getByText('当前播放', { exact: true }) })
    .locator('[role="status"]').innerText();
  assert.ok(status.includes(track.title), status);
  assert.ok(status.includes(track.albumName), status);
  assert.ok(status.includes(track.artistName), status);
  const screenshot = await application.evaluate(async ({ BrowserWindow }) =>
    (await BrowserWindow.getAllWindows()[0].webContents.capturePage()).toPNG().toString('base64'));
  await writeFile(path.join(output, 'codex_read_now_playing.png'), Buffer.from(screenshot, 'base64'));
  await page.locator('input[name="title"]').fill('codex 手填标题');
  await page.locator('input[name="artistName"]').fill('codex 手填艺术家');
  await page.getByRole('button', { name: '读取当前播放', exact: true }).click();
  await page.getByText(/未覆盖也未关联元数据/).waitFor({ timeout: 30000 });
  assert.equal(await page.locator('input[name="title"]').inputValue(), 'codex 手填标题');
  assert.equal(await page.locator('input[name="artistName"]').inputValue(), 'codex 手填艺术家');
  await page.getByRole('button', { name: '保存草稿', exact: true }).click();
  await page.waitForURL(/#\/drafts/);
  await page.evaluate(() => { location.hash = '/capture'; });
  await page.waitForFunction(album => document.querySelector('.quick-track-card strong')?.textContent === album,
    track.albumName, { timeout: 30000 });
  assert.equal(await page.locator('.quick-identity-fields select').inputValue(), 'album');
  assert.equal(await page.getByLabel('歌曲', { exact: true }).inputValue(), track.title);
  assert.equal(await page.getByLabel('专辑', { exact: true }).inputValue(), track.albumName);
  assert.equal(await page.getByLabel('歌手', { exact: true }).inputValue(), track.musicMetadata.albumArtistName || track.artistName);
  restorePlaying = true;
  await control('Pause');
  await page.waitForFunction(async () => {
    const paused = await window.CapacitorCustomPlatform.plugins.NowPlaying.getCurrentTrack();
    return paused.musicMetadata?.sourcePackage !== 'cloudmusic.exe';
  }, null, { timeout: 15000, polling: 750 });
  const pausedTrack = await page.evaluate(() => window.CapacitorCustomPlatform.plugins.NowPlaying.getCurrentTrack());
  await control('Play');
  await page.waitForFunction(async () => {
    const resumed = await window.CapacitorCustomPlatform.plugins.NowPlaying.getCurrentTrack();
    return resumed.musicMetadata?.sourcePackage === 'cloudmusic.exe' && Boolean(resumed.albumName);
  }, null, { timeout: 15000, polling: 750 });
  restorePlaying = false;
  const resumedTrack = await page.evaluate(() => window.CapacitorCustomPlatform.plugins.NowPlaying.getCurrentTrack());
  const rows = await page.evaluate(() => window.CapacitorCustomPlatform.plugins.CapacitorSQLite.query({
    database: 'music_feelings_archive', statement: 'SELECT COUNT(*) AS count FROM ReviewEntry', values: [], readonly: false }));
  assert.equal(rows.values[0].count, 0, '读取不能自动保存正式记录');
  assert.deepEqual(errors, []);
  const report = { status: 'passed', executable, isolatedProfile: profile,
    diagnostics, track, formStatus: status, defaultEntryType: 'album', existingInputPreserved: true,
    quickCaptureVerified: true, pausedTrack, resumedTrack, formalEntryCount: 0, pageErrors: errors };
  await writeFile(path.join(output, 'codex_actual_playback.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ status: report.status, output, track, formStatus: status }));
} finally {
  try { if (restorePlaying) await control('Play'); }
  finally { await application.close(); }
}
