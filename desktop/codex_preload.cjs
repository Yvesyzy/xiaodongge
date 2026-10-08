const { contextBridge, ipcRenderer } = require('electron');

const methods = {
  CapacitorSQLite: ['createConnection', 'open', 'close', 'closeConnection', 'isDBOpen', 'isDatabase',
    'execute', 'executeSet', 'run', 'query', 'beginTransaction', 'commitTransaction', 'rollbackTransaction', 'isTransactionActive'],
  NativeExport: ['stageFile', 'saveFile', 'saveFiles', 'shareFile', 'shareFiles', 'copyText'],
  NowPlaying: ['getDiagnostics', 'getCurrentTrack', 'searchCatalog', 'openNotificationSettings'],
  ScreenshotOcr: ['recognize'],
};
const plugins = Object.fromEntries(Object.entries(methods).map(([plugin, names]) => [plugin,
  Object.fromEntries(names.map(method => [method, options => ipcRenderer.invoke('codex:desktop', plugin, method, options)])),
]));

// Capacitor core and its installed SQLite plugin read this before renderer imports run.
contextBridge.exposeInMainWorld('CapacitorCustomPlatform', { name: 'electron', plugins });
