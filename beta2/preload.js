const { contextBridge, ipcRenderer } = require('electron');
const path = require('path');
const fs = require('fs');

const listeners = new Map();
function safeOn(channel, callback) {
  if (listeners.has(channel)) ipcRenderer.removeListener(channel, listeners.get(channel));
  const wrapper = (_, ...args) => callback(...args);
  listeners.set(channel, wrapper);
  ipcRenderer.on(channel, wrapper);
}
const CHANNELS = ['file-opened', 'folder-opened', 'menu-action', 'terminal-data', 'terminal-exit', 'run-output'];

// ═══ XTERM BRIDGE ═══
let xtermTerm = null, xtermFit = null, xtermDataCb = null, xtermResizeCb = null, xtermDisposables = [], xtermCssInjected = false;
const xtermBridge = (() => {
  try {
    const { Terminal } = require('xterm');
    const { FitAddon } = require('xterm-addon-fit');
    return {
      available: true,
      create(containerId, options) {
        if (!xtermCssInjected) { try { const css = fs.readFileSync(path.join(__dirname, 'node_modules', 'xterm', 'css', 'xterm.css'), 'utf-8'); const s = document.createElement('style'); s.textContent = css; document.head.appendChild(s); xtermCssInjected = true; } catch (e) {} }
        if (xtermTerm) { xtermDisposables.forEach(d => { try { d.dispose(); } catch(e) {} }); xtermDisposables = []; try { xtermTerm.dispose(); } catch(e) {} xtermTerm = null; xtermFit = null; }
        const el = document.getElementById(containerId); if (!el) return false; el.innerHTML = '';
        xtermTerm = new Terminal(options); xtermFit = new FitAddon(); xtermTerm.loadAddon(xtermFit); xtermTerm.open(el);
        xtermDisposables.push(xtermTerm.onData(data => { if (xtermDataCb) xtermDataCb(data); }));
        xtermDisposables.push(xtermTerm.onResize(({ cols, rows }) => { if (xtermResizeCb) xtermResizeCb(cols, rows); }));
        setTimeout(() => { try { xtermFit.fit(); } catch (e) {} }, 100);
        return true;
      },
      write(d) { if (xtermTerm) xtermTerm.write(d); },
      writeln(d) { if (xtermTerm) xtermTerm.writeln(d); },
      clear() { if (xtermTerm) xtermTerm.clear(); },
      focus() { if (xtermTerm) xtermTerm.focus(); },
      fit() { try { if (xtermFit) xtermFit.fit(); } catch (e) {} },
      dispose() { xtermDisposables.forEach(d => { try { d.dispose(); } catch(e) {} }); xtermDisposables = []; try { if (xtermTerm) xtermTerm.dispose(); } catch(e) {} xtermTerm = null; xtermFit = null; },
      getCols() { return xtermTerm ? xtermTerm.cols : 80; },
      getRows() { return xtermTerm ? xtermTerm.rows : 24; },
      onData(cb) { xtermDataCb = cb; },
      onResize(cb) { xtermResizeCb = cb; },
    };
  } catch (e) { return { available: false }; }
})();

contextBridge.exposeInMainWorld('xterm', xtermBridge);

contextBridge.exposeInMainWorld('api', {
  windowMinimize: () => ipcRenderer.send('window-minimize'),
  windowMaximize: () => ipcRenderer.send('window-maximize'),
  windowClose: () => ipcRenderer.send('window-close'),

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

  loadSettings: () => ipcRenderer.invoke('load-settings'),
  saveSettings: (s) => ipcRenderer.invoke('save-settings', s),
  getDefaultSettings: () => ipcRenderer.invoke('get-default-settings'),

  getInstalledPlugins: () => ipcRenderer.invoke('get-installed-plugins'),
  getPluginsPath: () => ipcRenderer.invoke('get-plugins-path'),
  installPlugin: (id, files) => ipcRenderer.invoke('install-plugin', id, files),
  uninstallPlugin: (id) => ipcRenderer.invoke('uninstall-plugin', id),

  // ═══ RUN ═══
  runFile: (filePath, saveFirst) => ipcRenderer.invoke('run-file', { filePath, saveFirst }),
  runCommand: (command, args, cwd, id) => ipcRenderer.invoke('run-command', { command, args, cwd, id }),
  stopRun: (id) => ipcRenderer.invoke('stop-run', { id }),
  runInput: (id, data) => ipcRenderer.invoke('run-input', { id, data }),

  terminalCreate: () => ipcRenderer.invoke('terminal-create'),
  terminalInput: (id, data) => ipcRenderer.invoke('terminal-input', { id, data }),
  terminalResize: (id, cols, rows) => ipcRenderer.invoke('terminal-resize', { id, cols, rows }),
  terminalKill: (id) => ipcRenderer.invoke('terminal-kill', { id }),
  terminalExec: (cmd, cwd) => ipcRenderer.invoke('terminal-exec', { command: cmd, cwd }),
  getProjectPath: () => ipcRenderer.invoke('get-project-path'),
  getHomePath: () => ipcRenderer.invoke('get-home-path'),

  searchInFiles: (text, root, opts = {}) => ipcRenderer.invoke('search-in-files', { searchText: text, rootPath: root, caseSensitive: opts.caseSensitive || false, regex: opts.regex || false, wholeWord: opts.wholeWord || false }),
  getMonacoPath: () => ipcRenderer.invoke('get-monaco-path'),
  openExternal: (url) => ipcRenderer.invoke('open-external', url),

  pathBasename: (p) => path.basename(p),
  pathDirname: (p) => path.dirname(p),
  pathExtname: (p) => path.extname(p),
  pathJoin: (...a) => path.join(...a),

  on: (ch, cb) => { if (CHANNELS.includes(ch)) safeOn(ch, cb); },
  removeListener: (ch) => { if (listeners.has(ch)) { ipcRenderer.removeListener(ch, listeners.get(ch)); listeners.delete(ch); } },
  removeAllListeners: () => { for (const [ch, fn] of listeners) ipcRenderer.removeListener(ch, fn); listeners.clear(); }
});