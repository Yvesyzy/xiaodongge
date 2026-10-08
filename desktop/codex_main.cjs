const { app, BrowserWindow, clipboard, dialog, ipcMain, net, protocol, session, shell } = require('electron');
const { execFile } = require('node:child_process');
const { promisify } = require('node:util');
const fs = require('node:fs/promises');
const { constants: fsConstants } = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { randomUUID } = require('node:crypto');
const { CodexSQLite } = require('./codex_sqlite.cjs');
const { enrichWindowsTrack } = require('./codex_now_playing.cjs');
const { version } = require('../package.json');

const runFile = promisify(execFile);
const APP_URL = 'xiaodongge://app/';
const ASSETS = path.join(__dirname, 'dist');
const SQLITE_METHODS = new Set(['createConnection', 'open', 'close', 'closeConnection', 'isDBOpen', 'isDatabase',
  'execute', 'executeSet', 'run', 'query', 'beginTransaction', 'commitTransaction', 'rollbackTransaction', 'isTransactionActive']);
// ponytail: exports up to 64 MiB and screenshots up to the existing 12 MiB bound;
// move to streamed export if a measured archive needs larger per-file exports.
const MAX_EXPORT_BYTES = 64 * 1024 * 1024;
const MAX_OCR_BYTES = 12 * 1024 * 1024;
const staged = new Map();
let window;
let sqlite;
let stagingDirectory;

app.setName('小懂哥');
app.setAppUserModelId('xiaodongge.windows');
// Stable across extracted folders and upgrades. QA explicitly supplies an isolated profile.
const profileArgument = process.argv.find(arg => arg.startsWith('--codex-profile='));
app.setPath('userData', profileArgument
  ? path.resolve(profileArgument.slice('--codex-profile='.length))
  : path.join(app.getPath('appData'), 'xiaodongge-windows'));
protocol.registerSchemesAsPrivileged([{ scheme: 'xiaodongge', privileges: {
  standard: true, secure: true, supportFetchAPI: true, corsEnabled: true,
} }]);

function isLocal(url) {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'xiaodongge:' && parsed.hostname === 'app' && !parsed.port
      && !parsed.username && !parsed.password;
  } catch { return false; }
}

function trusted(event) {
  if (!window || window.isDestroyed() || event.sender !== window.webContents
    || event.senderFrame !== window.webContents.mainFrame || !isLocal(event.senderFrame.url)) {
    throw new Error('已拒绝外部页面请求');
  }
}

function text(value, name, maxLength = MAX_EXPORT_BYTES) {
  if (typeof value !== 'string' || value.length > maxLength) throw new Error(`${name}无效或过大`);
  return value;
}

function base64(value, maxBytes) {
  text(value, '文件内容', Math.ceil(maxBytes / 3) * 4 + 4);
  if (!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value)) {
    throw new Error('文件编码无效');
  }
  const data = Buffer.from(value, 'base64');
  if (data.length > maxBytes) throw new Error('文件内容过大');
  return data;
}

function exportData(options) {
  const fileName = text(options?.fileName, '文件名', 180);
  if (!fileName || /[<>:"/\\|?*\u0000-\u001f]/.test(fileName) || /[. ]$/.test(fileName)
    || /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(fileName)
    || !['.json', '.txt', '.csv', '.png'].includes(path.extname(fileName).toLowerCase())) {
    throw new Error('导出文件名无效');
  }
  const content = text(options.content, '文件内容', MAX_EXPORT_BYTES * 2);
  if (options.encoding !== undefined && options.encoding !== 'base64') throw new Error('文件编码不受支持');
  const data = options.encoding === 'base64' ? base64(content, MAX_EXPORT_BYTES) : Buffer.from(content, 'utf8');
  if (data.length > MAX_EXPORT_BYTES) throw new Error('导出文件超过 64 MiB，请分批导出');
  return { fileName, data };
}

async function stageFile(options) {
  const { fileName, data } = exportData(options);
  const token = randomUUID();
  const directory = path.join(stagingDirectory, token);
  await fs.mkdir(directory, { recursive: true });
  const filePath = path.join(directory, fileName);
  await fs.writeFile(filePath, data, { flag: 'wx' });
  staged.set(token, { filePath, fileName });
  return { token };
}

function stagedFiles(options) {
  if (!Array.isArray(options?.tokens) || !options.tokens.length || options.tokens.length > 100) {
    throw new Error('导出批次无效，请每批最多导出 100 页');
  }
  return options.tokens.map(token => {
    if (typeof token !== 'string' || !staged.has(token)) throw new Error('临时文件已失效，请重新生成');
    return staged.get(token);
  });
}

async function saveFile(options) {
  const { fileName, data } = exportData(options);
  const chosen = await dialog.showSaveDialog(window, {
    title: '保存小懂哥导出文件', defaultPath: fileName,
    filters: [{ name: '导出文件', extensions: [path.extname(fileName).slice(1)] }],
  });
  if (chosen.canceled || !chosen.filePath) return { status: 'cancelled' };
  const temporary = path.join(path.dirname(chosen.filePath), `.codex-${randomUUID()}.tmp`);
  try {
    await fs.writeFile(temporary, data, { flag: 'wx' });
    await fs.rename(temporary, chosen.filePath);
  } catch (error) {
    await fs.unlink(temporary).catch(() => undefined);
    throw error;
  }
  return { status: 'saved', uri: pathToFileURL(chosen.filePath).href };
}

async function saveFiles(options) {
  const files = stagedFiles(options);
  const chosen = await dialog.showOpenDialog(window, { title: '选择保存此批导出的文件夹', properties: ['openDirectory', 'createDirectory'] });
  if (chosen.canceled || !chosen.filePaths[0]) return { status: 'cancelled', saved: [] };
  const saved = [];
  for (const file of files) {
    try {
      await fs.copyFile(file.filePath, path.join(chosen.filePaths[0], file.fileName), fsConstants.COPYFILE_EXCL);
      saved.push(file.fileName);
    } catch (error) {
      return { status: 'partial', saved, error: error.code === 'EEXIST'
        ? `文件已存在，未覆盖：${file.fileName}` : `保存失败：${file.fileName}（${error.code || '未知错误'}）` };
    }
  }
  return { status: 'saved', saved };
}

async function shareFiles(options) {
  const files = stagedFiles(options);
  const directory = path.join(stagingDirectory, `share-${randomUUID()}`);
  await fs.mkdir(directory);
  for (const file of files) await fs.copyFile(file.filePath, path.join(directory, file.fileName), fsConstants.COPYFILE_EXCL);
  const error = await shell.openPath(directory);
  if (error) throw new Error('导出文件夹打开失败，请使用保存文件');
  return { status: 'opened' };
}

async function native(action, inputPath) {
  const powershell = path.join(process.env.SystemRoot, 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe');
  const args = ['-NoLogo', '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File',
    path.join(__dirname, 'native', 'codex_windows_native.ps1'), '-Action', action];
  if (inputPath) args.push('-InputPath', inputPath);
  try {
    const result = await runFile(powershell, args, { windowsHide: true, timeout: 20000, maxBuffer: 4 * 1024 * 1024, encoding: 'utf8' });
    return JSON.parse(result.stdout.replace(/^\uFEFF/, '').trim());
  } catch (error) {
    if (error.killed) throw new Error('Windows 接口响应超时，请重试');
    throw new Error(`Windows ${action === 'ocr' ? '截图识别' : '媒体会话'}读取失败：${String(error.stderr || error.message).trim().slice(0, 600)}`);
  }
}

async function recognize(options) {
  const dataUrl = text(options?.dataUrl, '截图', Math.ceil(MAX_OCR_BYTES / 3) * 4 + 100);
  const match = /^data:image\/(png|jpe?g|bmp|webp);base64,(.+)$/i.exec(dataUrl);
  if (!match) throw new Error('截图格式不受支持，请选择 PNG、JPEG、BMP 或 WebP');
  const data = base64(match[2], MAX_OCR_BYTES);
  const imagePath = path.join(stagingDirectory, `ocr-${randomUUID()}.${match[1] === 'jpeg' ? 'jpg' : match[1]}`);
  await fs.writeFile(imagePath, data, { flag: 'wx' });
  try { return await native('ocr', imagePath); }
  finally { await fs.unlink(imagePath).catch(() => undefined); }
}

async function searchCatalog(options) {
  const title = text(options?.title, '歌曲名', 500).trim();
  const artistName = text(options.artistName, '艺术家', 500).trim();
  const albumName = options.albumName === undefined ? '' : text(options.albumName, '专辑名', 500).trim();
  if (!title || !artistName || !['CN', 'US'].includes(options.country)) throw new Error('音乐目录查询参数无效');
  const url = new URL('https://itunes.apple.com/search');
  url.search = new URLSearchParams({ term: [title, artistName, albumName].filter(Boolean).join(' '),
    country: options.country, media: 'music', entity: 'song', limit: '10' }).toString();
  const response = await net.fetch(url.href, { signal: AbortSignal.timeout(8000) });
  if (!response.ok) throw new Error('Apple 音乐目录暂时不可用');
  let size = 0;
  const chunks = [];
  for await (const chunk of response.body) {
    size += chunk.length;
    if (size > 1000000) throw new Error('音乐目录响应过大');
    chunks.push(chunk);
  }
  const payload = JSON.parse(Buffer.concat(chunks).toString('utf8'));
  const results = Array.isArray(payload.results) ? payload.results.filter(item => item.kind === 'song'
    && typeof item.trackName === 'string' && typeof item.artistName === 'string').map(item => ({ ...item,
    ...Object.fromEntries(['trackId', 'collectionId', 'artistId'].filter(key => item[key] !== undefined)
      .map(key => [key, String(item[key])])),
  })) : [];
  return { country: options.country, results };
}

const exportsPlugin = {
  stageFile, saveFile, saveFiles, shareFiles,
  shareFile: async options => shareFiles({ tokens: [(await stageFile(options)).token] }),
  copyText: options => { clipboard.writeText(text(options?.text, '复制内容')); },
};
const playingPlugin = {
  getCurrentTrack: async () => enrichWindowsTrack(await native('nowPlaying')),
  getDiagnostics: async () => {
    const diagnostics = await native('diagnostics');
    return { versionName: version, versionCode: 1, notificationAccessEnabled: diagnostics.mediaAvailable === true, ...diagnostics };
  },
  searchCatalog,
  openNotificationSettings: () => { throw new Error('Windows 通过系统媒体会话读取播放信息，无需 Android 通知使用权'); },
};

function createWindow() {
  window = new BrowserWindow({ title: '小懂哥', width: 1366, height: 860, minWidth: 900, minHeight: 600,
    backgroundColor: '#f7f8f5', autoHideMenuBar: true, show: false,
    webPreferences: { preload: path.join(__dirname, 'codex_preload.cjs'), nodeIntegration: false,
      contextIsolation: true, sandbox: true, webSecurity: true, spellcheck: false },
  });
  window.setMenu(null);
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  window.webContents.on('will-navigate', (event, url) => { if (!isLocal(url)) event.preventDefault(); });
  window.webContents.on('will-attach-webview', event => event.preventDefault());
  window.webContents.on('will-prevent-unload', event => {
    const response = dialog.showMessageBoxSync(window, { type: 'warning', buttons: ['继续编辑', '关闭窗口'],
      defaultId: 0, cancelId: 0, title: '内容尚未保存',
      message: '草稿保存失败或保存任务尚未完成。', detail: '选择关闭窗口会丢失尚未保存的修改。' });
    if (response === 1) event.preventDefault();
  });
  window.webContents.on('before-input-event', (event, input) => {
    if ((input.control || input.meta) && ['+', '=', '-', '0'].includes(input.key) && input.type === 'keyDown') {
      event.preventDefault();
      const current = window.webContents.getZoomFactor();
      window.webContents.setZoomFactor(input.key === '0' ? 1 : Math.max(0.75, Math.min(1.5, current + (input.key === '-' ? -0.1 : 0.1))));
    }
  });
  window.once('ready-to-show', () => window.show());
  void window.loadURL(APP_URL);
}

if (!app.requestSingleInstanceLock()) app.quit();
else {
  app.on('second-instance', () => { if (window) { if (window.isMinimized()) window.restore(); window.focus(); } });
  app.whenReady().then(async () => {
    sqlite = new CodexSQLite(path.join(app.getPath('userData'), 'archive'));
    stagingDirectory = path.join(app.getPath('userData'), 'exports');
    await fs.mkdir(stagingDirectory, { recursive: true });
    protocol.handle('xiaodongge', async request => {
      if (!isLocal(request.url) || !['GET', 'HEAD'].includes(request.method)) return new Response(null, { status: 403 });
      const pathname = decodeURIComponent(new URL(request.url).pathname);
      const asset = path.resolve(ASSETS, `.${pathname === '/' ? '/index.html' : pathname}`);
      const relative = path.relative(ASSETS, asset);
      if (relative.startsWith('..') || path.isAbsolute(relative)) return new Response(null, { status: 403 });
      try {
        const result = await net.fetch(pathToFileURL(asset).href);
        const headers = new Headers(result.headers);
        headers.set('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self' https://geocoding-api.open-meteo.com https://archive-api.open-meteo.com; worker-src 'self' blob:; object-src 'none'; frame-src 'none'; base-uri 'self'");
        return new Response(result.body, { status: result.status, headers });
      } catch { return new Response(null, { status: 404 }); }
    });
    session.defaultSession.setPermissionRequestHandler((_contents, permission, callback) => callback(permission === 'clipboard-sanitized-write'));
    session.defaultSession.setPermissionCheckHandler((_contents, permission) => permission === 'clipboard-sanitized-write');
    ipcMain.handle('codex:desktop', (event, plugin, method, options) => {
      trusted(event);
      if (plugin === 'CapacitorSQLite' && SQLITE_METHODS.has(method)) return sqlite[method](options);
      const implementation = plugin === 'NativeExport' ? exportsPlugin : plugin === 'NowPlaying' ? playingPlugin
        : plugin === 'ScreenshotOcr' ? { recognize } : null;
      if (!implementation || !Object.hasOwn(implementation, method)) throw new Error('桌面接口未开放');
      return implementation[method](options);
    });
    createWindow();
  }).catch(error => { dialog.showErrorBox('小懂哥启动失败', error.message); app.quit(); });
  app.on('window-all-closed', () => app.quit());
  app.on('will-quit', () => sqlite?.dispose());
}
