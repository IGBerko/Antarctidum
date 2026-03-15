const { contextBridge, ipcRenderer } = require('electron');
const path = require('path');

const listeners = new Map();

function safeOn(channel, callback) {
  if (listeners.has(channel)) ipcRenderer.removeListener(channel, listeners.get(channel));
  const wrapper = (_, ...args) => callback(...args);
  listeners.set(channel, wrapper);
  ipcRenderer.on(channel, wrapper);
}

const CHANNELS = [
  'file-opened', 'folder-opened', 'menu-action',
  'terminal-data', 'terminal-exit'
];

contextBridge.exposeInMainWorld('api', {
  // Window
  windowMinimize: () => ipcRenderer.send('window-minimize'),
  windowMaximize: () => ipcRenderer.send('window-maximize'),
  windowClose: () => ipcRenderer.send('window-close'),

  // Files
  readFile: (p) => ipcRenderer.invoke('read-file', p),
  saveFile: (p, c) => ipcRenderer.invoke('save-file', { filePath: p, content: c }),
  saveFileAs: (c, d) => ipcRenderer.invoke('save-file-as', { content: c, defaultPath: d }),
  readDirectory: (p) => ipcRenderer.invoke('read-directory', p),
  createFile: (p) => ipcRenderer.invoke('create-file', p),
  createFolder: (p) => ipcRenderer.invoke('create-folder', p),
  deletePath: (p) => ipcRenderer.invoke('delete-path', p),
  renamePath: (o, n) => ipcRenderer.invoke('rename-path', { oldPath: o, newPath: n }),
  getFileStats: (p) => ipcRenderer.invoke('get-file-stats', p),
  openFileDialog: () => ipcRenderer.invoke('open-file-dialog'),
  openFolderDialog: () => ipcRenderer.invoke('open-folder-dialog'),

  // Settings
  loadSettings: () => ipcRenderer.invoke('load-settings'),
  saveSettings: (s) => ipcRenderer.invoke('save-settings', s),
  getDefaultSettings: () => ipcRenderer.invoke('get-default-settings'),

  // Plugins
  getInstalledPlugins: () => ipcRenderer.invoke('get-installed-plugins'),
  getPluginsPath: () => ipcRenderer.invoke('get-plugins-path'),
  installPlugin: (id, files) => ipcRenderer.invoke('install-plugin', id, files),
  uninstallPlugin: (id) => ipcRenderer.invoke('uninstall-plugin', id),

  // Terminal
  terminalCreate: () => ipcRenderer.invoke('terminal-create'),
  terminalInput: (id, data) => ipcRenderer.invoke('terminal-input', { id, data }),
  terminalResize: (id, cols, rows) => ipcRenderer.invoke('terminal-resize', { id, cols, rows }),
  terminalKill: (id) => ipcRenderer.invoke('terminal-kill', { id }),
  terminalExec: (cmd, cwd) => ipcRenderer.invoke('terminal-exec', { command: cmd, cwd }),
  getProjectPath: () => ipcRenderer.invoke('get-project-path'),
  getHomePath: () => ipcRenderer.invoke('get-home-path'),

  // Search
  searchInFiles: (text, root, opts = {}) => ipcRenderer.invoke('search-in-files', {
    searchText: text, rootPath: root,
    caseSensitive: opts.caseSensitive || false,
    regex: opts.regex || false,
    wholeWord: opts.wholeWord || false
  }),

  // Monaco
  getMonacoPath: () => ipcRenderer.invoke('get-monaco-path'),

  // === XTERM PATH ===
  getXtermPath: () => path.join(__dirname, 'node_modules', 'xterm'),
  getXtermFitPath: () => path.join(__dirname, 'node_modules', 'xterm-addon-fit'),

  // External
  openExternal: (url) => ipcRenderer.invoke('open-external', url),

  // Path helpers
  pathBasename: (p) => path.basename(p),
  pathDirname: (p) => path.dirname(p),
  pathExtname: (p) => path.extname(p),
  pathJoin: (...a) => path.join(...a),

  // IPC
  on: (ch, cb) => { if (CHANNELS.includes(ch)) safeOn(ch, cb); },
  removeListener: (ch) => {
    if (listeners.has(ch)) { ipcRenderer.removeListener(ch, listeners.get(ch)); listeners.delete(ch); }
  },
  removeAllListeners: () => {
    for (const [ch, fn] of listeners) ipcRenderer.removeListener(ch, fn);
    listeners.clear();
  }
});