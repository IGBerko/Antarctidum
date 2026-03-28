const { contextBridge, ipcRenderer } = require('electron');
const path = require('path');
const fs = require('fs');

// ═══════════════════════════════════
// IPC LISTENERS
// ═══════════════════════════════════
const listeners = new Map();
function safeOn(channel, callback) {
  if (listeners.has(channel)) ipcRenderer.removeListener(channel, listeners.get(channel));
  const wrapper = (_, ...args) => callback(...args);
  listeners.set(channel, wrapper);
  ipcRenderer.on(channel, wrapper);
}
const CHANNELS = ['file-opened', 'folder-opened', 'menu-action', 'terminal-data', 'terminal-exit'];

// ═══════════════════════════════════
// XTERM.JS BRIDGE (загружаем через require!)
// ═══════════════════════════════════
let xtermTerm = null;
let xtermFit = null;
let xtermDataCb = null;
let xtermResizeCb = null;
let xtermDisposables = [];
let xtermCssInjected = false;

const xtermBridge = (() => {
  try {
    const { Terminal } = require('xterm');
    const { FitAddon } = require('xterm-addon-fit');

    return {
      available: true,

      create(containerId, options) {
        // Inject CSS once
        if (!xtermCssInjected) {
          try {
            const cssPath = path.join(__dirname, 'node_modules', 'xterm', 'css', 'xterm.css');
            const css = fs.readFileSync(cssPath, 'utf-8');
            const style = document.createElement('style');
            style.id = 'xterm-styles';
            style.textContent = css;
            document.head.appendChild(style);
            xtermCssInjected = true;
          } catch (e) {
            console.warn('Could not load xterm CSS:', e.message);
          }
        }

        // Dispose previous terminal
        if (xtermTerm) {
          xtermDisposables.forEach(d => { try { d.dispose(); } catch(e) {} });
          xtermDisposables = [];
          try { xtermTerm.dispose(); } catch(e) {}
          xtermTerm = null;
          xtermFit = null;
        }

        const el = document.getElementById(containerId);
        if (!el) {
          console.error('Terminal container not found:', containerId);
          return false;
        }

        // Clear container
        el.innerHTML = '';

        xtermTerm = new Terminal(options);
        xtermFit = new FitAddon();
        xtermTerm.loadAddon(xtermFit);
        xtermTerm.open(el);

        // Register callbacks
        xtermDisposables.push(
          xtermTerm.onData(data => {
            if (xtermDataCb) xtermDataCb(data);
          })
        );
        xtermDisposables.push(
          xtermTerm.onResize(({ cols, rows }) => {
            if (xtermResizeCb) xtermResizeCb(cols, rows);
          })
        );

        // Initial fit
        setTimeout(() => {
          try { xtermFit.fit(); } catch (e) {}
        }, 100);

        console.log('✅ xterm.js terminal created');
        return true;
      },

      write(data) { if (xtermTerm) xtermTerm.write(data); },
      writeln(data) { if (xtermTerm) xtermTerm.writeln(data); },
      clear() { if (xtermTerm) xtermTerm.clear(); },
      focus() { if (xtermTerm) xtermTerm.focus(); },
      fit() { try { if (xtermFit) xtermFit.fit(); } catch (e) {} },
      dispose() {
        xtermDisposables.forEach(d => { try { d.dispose(); } catch(e) {} });
        xtermDisposables = [];
        try { if (xtermTerm) xtermTerm.dispose(); } catch(e) {}
        xtermTerm = null; xtermFit = null;
        xtermDataCb = null; xtermResizeCb = null;
      },
      getCols() { return xtermTerm ? xtermTerm.cols : 80; },
      getRows() { return xtermTerm ? xtermTerm.rows : 24; },

      // Callback setters (renderer вызывает эти, preload хранит ссылки)
      onData(cb) { xtermDataCb = cb; },
      onResize(cb) { xtermResizeCb = cb; },
    };
  } catch (e) {
    console.warn('⚠ xterm.js not available:', e.message);
    return { available: false };
  }
})();

// ═══════════════════════════════════
// EXPOSE API
// ═══════════════════════════════════
contextBridge.exposeInMainWorld('xterm', xtermBridge);

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

  // External
  openExternal: (url) => ipcRenderer.invoke('open-external', url),

  // Path
  pathBasename: (p) => path.basename(p),
  pathDirname: (p) => path.dirname(p),
  pathExtname: (p) => path.extname(p),
  pathJoin: (...a) => path.join(...a),

  // IPC
  on: (ch, cb) => { if (CHANNELS.includes(ch)) safeOn(ch, cb); },
  removeListener: (ch) => { if (listeners.has(ch)) { ipcRenderer.removeListener(ch, listeners.get(ch)); listeners.delete(ch); } },
  removeAllListeners: () => { for (const [ch, fn] of listeners) ipcRenderer.removeListener(ch, fn); listeners.clear(); }
});