const { app, BrowserWindow, ipcMain, dialog, Menu, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');

let mainWindow;
let currentProjectPath = null;
let userSettingsPath;
let pluginsPath;
let ptyProcesses = new Map();

let pty;
try { pty = require('node-pty'); console.log('✅ node-pty loaded'); }
catch (e) { console.warn('⚠ node-pty not available:', e.message); pty = null; }

function getDefaultShell() {
  if (process.platform === 'win32') {
    const pwsh7 = 'C:\\Program Files\\PowerShell\\7\\pwsh.exe';
    if (fs.existsSync(pwsh7)) return pwsh7;
    return process.env.COMSPEC || 'cmd.exe';
  }
  return process.env.SHELL || '/bin/bash';
}

function createWindow() {
  userSettingsPath = path.join(app.getPath('userData'), 'settings.json');
  pluginsPath = path.join(app.getPath('userData'), 'plugins');
  if (!fs.existsSync(pluginsPath)) fs.mkdirSync(pluginsPath, { recursive: true });

  // ═══ ИКОНКА ═══
  const iconPath = path.join(__dirname, 'src', 'icon.png');
  const iconIco = path.join(__dirname, 'src', 'icon.ico');
  let icon;
  if (process.platform === 'win32' && fs.existsSync(iconIco)) {
    icon = iconIco;
  } else if (fs.existsSync(iconPath)) {
    icon = iconPath;
  }

  mainWindow = new BrowserWindow({
    width: 1400, height: 900,
    minWidth: 800, minHeight: 600,
    title: 'Antarctidum',
    icon: icon,                    // ← ИКОНКА
    frame: false,
    titleBarStyle: 'hidden',
    backgroundColor: '#1e1e2e',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false               // нужно для require в preload
    }
  });

  mainWindow.loadFile(path.join(__dirname, 'src', 'index.html'));
  mainWindow.on('closed', () => {
    for (const [, proc] of ptyProcesses) { try { proc.kill(); } catch (e) {} }
    ptyProcesses.clear();
    mainWindow = null;
  });
  createMenu();
}

function createMenu() {
  const template = [
    {
      label: 'File', submenu: [
        { label: 'New File', accelerator: 'CmdOrCtrl+N', click: () => mainWindow?.webContents.send('menu-action', 'new-file') },
        { label: 'Open File', accelerator: 'CmdOrCtrl+O', click: () => handleOpenFile() },
        { label: 'Open Folder', accelerator: 'CmdOrCtrl+Shift+O', click: () => handleOpenFolder() },
        { type: 'separator' },
        { label: 'Save', accelerator: 'CmdOrCtrl+S', click: () => mainWindow?.webContents.send('menu-action', 'save') },
        { label: 'Save As', accelerator: 'CmdOrCtrl+Shift+S', click: () => mainWindow?.webContents.send('menu-action', 'save-as') },
        { type: 'separator' },
        { label: 'Settings', accelerator: 'CmdOrCtrl+,', click: () => mainWindow?.webContents.send('menu-action', 'settings') },
        { type: 'separator' },
        { label: 'Exit', accelerator: 'CmdOrCtrl+Q', click: () => app.quit() }
      ]
    },
    {
      label: 'Edit', submenu: [
        { role: 'undo' }, { role: 'redo' }, { type: 'separator' },
        { role: 'cut' }, { role: 'copy' }, { role: 'paste' },
        { type: 'separator' },
        { label: 'Find', accelerator: 'CmdOrCtrl+F', click: () => mainWindow?.webContents.send('menu-action', 'find') },
        { label: 'Replace', accelerator: 'CmdOrCtrl+H', click: () => mainWindow?.webContents.send('menu-action', 'replace') }
      ]
    },
    {
      label: 'View', submenu: [
        { label: 'Toggle Sidebar', accelerator: 'CmdOrCtrl+B', click: () => mainWindow?.webContents.send('menu-action', 'toggle-sidebar') },
        { label: 'Toggle Terminal', accelerator: 'CmdOrCtrl+`', click: () => mainWindow?.webContents.send('menu-action', 'toggle-terminal') },
        { type: 'separator' },
        { label: 'Zoom In', accelerator: 'CmdOrCtrl+=', click: () => mainWindow?.webContents.send('menu-action', 'zoom-in') },
        { label: 'Zoom Out', accelerator: 'CmdOrCtrl+-', click: () => mainWindow?.webContents.send('menu-action', 'zoom-out') },
        { type: 'separator' },
        { label: 'DevTools', accelerator: 'F12', click: () => mainWindow?.webContents.toggleDevTools() }
      ]
    },
    {
      label: 'Help', submenu: [
        { label: 'About', click: () => dialog.showMessageBox(mainWindow, { type: 'info', title: 'Antarctidum', message: 'v2.0.0', detail: 'Modern code editor.\nElectron + Monaco + xterm.js' }) }
      ]
    }
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

// ═══ FILES ═══
async function handleOpenFile() {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile'],
    filters: [
      { name: 'All Files', extensions: ['*'] },
      { name: 'Code', extensions: ['js', 'jsx', 'ts', 'tsx', 'py', 'rs', 'c', 'cpp', 'h', 'go', 'java', 'php'] },
      { name: 'Web', extensions: ['html', 'css', 'scss', 'vue', 'svelte'] },
      { name: 'Data', extensions: ['json', 'xml', 'yaml', 'yml', 'toml'] }
    ]
  });
  if (!result.canceled && result.filePaths.length > 0) {
    const filePath = result.filePaths[0];
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      mainWindow.webContents.send('file-opened', { filePath, content });
    } catch (err) { dialog.showErrorBox('Error', err.message); }
  }
}

async function handleOpenFolder() {
  const result = await dialog.showOpenDialog(mainWindow, { properties: ['openDirectory'] });
  if (!result.canceled && result.filePaths.length > 0) {
    currentProjectPath = result.filePaths[0];
    const s = loadSettings();
    const tree = readDirectoryTree(currentProjectPath, 0, s['files.exclude'] || []);
    mainWindow.webContents.send('folder-opened', { rootPath: currentProjectPath, tree });
  }
}

function readDirectoryTree(dirPath, depth = 0, excludeList = []) {
  if (depth > 15) return [];
  const entries = [];
  try {
    const items = fs.readdirSync(dirPath, { withFileTypes: true }).sort((a, b) => {
      if (a.isDirectory() !== b.isDirectory()) return a.isDirectory() ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
    for (const item of items) {
      if (item.name.startsWith('.') && !['.env', '.gitignore'].includes(item.name)) continue;
      if (excludeList.includes(item.name)) continue;
      const fullPath = path.join(dirPath, item.name);
      const entry = { name: item.name, path: fullPath, isDirectory: item.isDirectory() };
      if (item.isDirectory()) entry.children = readDirectoryTree(fullPath, depth + 1, excludeList);
      entries.push(entry);
    }
  } catch (e) {}
  return entries;
}

// ═══ SETTINGS ═══
function loadSettings() {
  let defaults = {};
  try { defaults = JSON.parse(fs.readFileSync(path.join(__dirname, 'default-settings.json'), 'utf-8')); } catch (e) {}
  try {
    if (fs.existsSync(userSettingsPath)) {
      return { ...defaults, ...JSON.parse(fs.readFileSync(userSettingsPath, 'utf-8')) };
    }
  } catch (e) {}
  return defaults;
}
function saveSettings(s) {
  try { fs.writeFileSync(userSettingsPath, JSON.stringify(s, null, 2)); return { success: true }; }
  catch (e) { return { success: false, error: e.message }; }
}

// ═══ IPC: FILES ═══
ipcMain.handle('read-file', async (_, p) => { try { return { success: true, content: fs.readFileSync(p, 'utf-8') }; } catch (e) { return { success: false, error: e.message }; } });
ipcMain.handle('save-file', async (_, { filePath, content }) => { try { fs.writeFileSync(filePath, content, 'utf-8'); return { success: true }; } catch (e) { return { success: false, error: e.message }; } });
ipcMain.handle('save-file-as', async (_, { content, defaultPath }) => {
  const r = await dialog.showSaveDialog(mainWindow, { defaultPath: defaultPath || 'untitled.txt', filters: [{ name: 'All', extensions: ['*'] }] });
  if (r.canceled) return { success: false, canceled: true };
  try { fs.writeFileSync(r.filePath, content, 'utf-8'); return { success: true, filePath: r.filePath }; } catch (e) { return { success: false, error: e.message }; }
});
ipcMain.handle('read-directory', async (_, p) => { try { return { success: true, tree: readDirectoryTree(p, 0, loadSettings()['files.exclude'] || []) }; } catch (e) { return { success: false, error: e.message }; } });
ipcMain.handle('create-file', async (_, p) => { try { if (fs.existsSync(p)) return { success: false, error: 'Exists' }; fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, ''); return { success: true }; } catch (e) { return { success: false, error: e.message }; } });
ipcMain.handle('create-folder', async (_, p) => { try { if (fs.existsSync(p)) return { success: false, error: 'Exists' }; fs.mkdirSync(p, { recursive: true }); return { success: true }; } catch (e) { return { success: false, error: e.message }; } });
ipcMain.handle('delete-path', async (_, p) => {
  try {
    const r = await dialog.showMessageBox(mainWindow, { type: 'warning', buttons: ['Delete', 'Cancel'], defaultId: 1, message: `Delete "${path.basename(p)}"?` });
    if (r.response !== 0) return { success: false, canceled: true };
    fs.rmSync(p, { recursive: true, force: true }); return { success: true };
  } catch (e) { return { success: false, error: e.message }; }
});
ipcMain.handle('rename-path', async (_, { oldPath, newPath }) => { try { fs.renameSync(oldPath, newPath); return { success: true }; } catch (e) { return { success: false, error: e.message }; } });
ipcMain.handle('get-file-stats', async (_, p) => { try { const s = fs.statSync(p); return { success: true, stats: { size: s.size, modified: s.mtime, created: s.birthtime, isDirectory: s.isDirectory() } }; } catch (e) { return { success: false, error: e.message }; } });
ipcMain.handle('open-folder-dialog', () => handleOpenFolder());
ipcMain.handle('open-file-dialog', () => handleOpenFile());

// ═══ IPC: SETTINGS ═══
ipcMain.handle('load-settings', () => loadSettings());
ipcMain.handle('save-settings', (_, s) => saveSettings(s));
ipcMain.handle('get-default-settings', () => { try { return JSON.parse(fs.readFileSync(path.join(__dirname, 'default-settings.json'), 'utf-8')); } catch (e) { return {}; } });

// ═══ IPC: PLUGINS ═══
ipcMain.handle('get-plugins-path', () => pluginsPath);
ipcMain.handle('get-installed-plugins', () => {
  const plugins = [];
  try {
    for (const dir of fs.readdirSync(pluginsPath, { withFileTypes: true })) {
      if (!dir.isDirectory()) continue;
      const pluginDir = path.join(pluginsPath, dir.name);
      let manifest = { id: dir.name, name: dir.name };
      try { const mp = path.join(pluginDir, 'plugin.json'); if (fs.existsSync(mp)) manifest = JSON.parse(fs.readFileSync(mp, 'utf-8')); } catch (e) {}
      let code = '';
      try { const cp = path.join(pluginDir, manifest.main || 'index.js'); if (fs.existsSync(cp)) code = fs.readFileSync(cp, 'utf-8'); } catch (e) {}
      plugins.push({ id: manifest.id || dir.name, name: manifest.name || dir.name, version: manifest.version || '1.0.0', description: manifest.description || '', author: manifest.author || 'Unknown', icon: manifest.icon || '🧩', main: manifest.main || 'index.js', code, installed: true, dirPath: pluginDir });
    }
  } catch (e) {}
  return plugins;
});
ipcMain.handle('install-plugin', async (_, pluginId, files) => {
  if (!pluginId || !files) return { success: false, error: 'Invalid args' };
  const safeId = pluginId.replace(/[^a-zA-Z0-9\-_]/g, '-').substring(0, 100);
  try {
    const d = path.join(pluginsPath, safeId); fs.mkdirSync(d, { recursive: true });
    const written = [];
    for (const [fn, content] of Object.entries(files)) {
      const s = fn.replace(/\.\./g, '').replace(/^[\/\\]+/, ''); if (!s) continue;
      const fp = path.join(d, s); if (!path.resolve(fp).startsWith(path.resolve(d))) continue;
      fs.mkdirSync(path.dirname(fp), { recursive: true }); fs.writeFileSync(fp, content); written.push(s);
    }
    return { success: true, path: d, files: written };
  } catch (e) { return { success: false, error: e.message }; }
});
ipcMain.handle('uninstall-plugin', async (_, id) => {
  if (!id) return { success: false, error: 'No ID' };
  const safeId = id.replace(/[^a-zA-Z0-9\-_]/g, '-').substring(0, 100);
  try {
    const d = path.join(pluginsPath, safeId);
    if (!path.resolve(d).startsWith(path.resolve(pluginsPath))) return { success: false, error: 'Invalid' };
    if (fs.existsSync(d)) { fs.rmSync(d, { recursive: true, force: true }); return { success: true }; }
    return { success: false, error: 'Not found' };
  } catch (e) { return { success: false, error: e.message }; }
});

// ═══ IPC: WINDOW ═══
ipcMain.on('window-minimize', () => mainWindow?.minimize());
ipcMain.on('window-maximize', () => { if (mainWindow) mainWindow.isMaximized() ? mainWindow.unmaximize() : mainWindow.maximize(); });
ipcMain.on('window-close', () => mainWindow?.close());

// ═══ IPC: TERMINAL (PTY) ═══
let termIdCounter = 0;

ipcMain.handle('terminal-create', () => {
  const id = ++termIdCounter;
  if (!pty) return { success: true, id, pty: false };

  const s = loadSettings();
  const shell = s['terminal.shell'] || getDefaultShell();
  const cwd = currentProjectPath || os.homedir();

  try {
    const env = { ...process.env };
    // Windows: для cmd.exe / powershell
    if (process.platform === 'win32') {
      env.TERM = 'xterm-256color';
    } else {
      env.TERM = 'xterm-256color';
      env.COLORTERM = 'truecolor';
    }

    const proc = pty.spawn(shell, [], {
      name: 'xterm-256color',
      cols: 120,
      rows: 30,
      cwd,
      env,
      // Windows: useConpty для лучшей совместимости
      ...(process.platform === 'win32' ? { useConpty: true } : {})
    });

    proc.onData((data) => {
      mainWindow?.webContents.send('terminal-data', { id, data });
    });

    proc.onExit(({ exitCode }) => {
      mainWindow?.webContents.send('terminal-exit', { id, exitCode });
      ptyProcesses.delete(id);
    });

    ptyProcesses.set(id, proc);
    console.log(`✅ PTY #${id}: shell=${shell} cwd=${cwd}`);
    return { success: true, id, pty: true };
  } catch (e) {
    console.error('❌ PTY spawn failed:', e.message);
    return { success: true, id, pty: false, error: e.message };
  }
});

ipcMain.handle('terminal-input', (_, { id, data }) => {
  const proc = ptyProcesses.get(id);
  if (proc) { proc.write(data); return { success: true }; }
  return { success: false };
});

ipcMain.handle('terminal-resize', (_, { id, cols, rows }) => {
  const proc = ptyProcesses.get(id);
  if (proc) {
    try { proc.resize(Math.max(cols, 2), Math.max(rows, 2)); } catch (e) {}
    return { success: true };
  }
  return { success: false };
});

ipcMain.handle('terminal-kill', (_, { id }) => {
  const proc = ptyProcesses.get(id);
  if (proc) { proc.kill(); ptyProcesses.delete(id); return { success: true }; }
  return { success: false };
});

ipcMain.handle('terminal-exec', async (_, { command, cwd }) => {
  const { exec } = require('child_process');
  return new Promise(resolve => {
    exec(command, { cwd: cwd || currentProjectPath || os.homedir(), timeout: 30000, maxBuffer: 5 * 1024 * 1024 }, (error, stdout, stderr) => {
      resolve({ stdout, stderr, error: error?.message || null, code: error?.code || 0 });
    });
  });
});

ipcMain.handle('get-project-path', () => currentProjectPath);
ipcMain.handle('get-home-path', () => os.homedir());
ipcMain.handle('get-monaco-path', () => path.join(__dirname, 'node_modules', 'monaco-editor', 'min'));

// ═══ IPC: SEARCH ═══
ipcMain.handle('search-in-files', async (_, { searchText, rootPath, caseSensitive, regex, wholeWord }) => {
  const results = []; if (!rootPath || !searchText) return results;
  const excl = loadSettings()['files.exclude'] || []; const MAX = 1000;
  function search(dir, depth = 0) {
    if (depth > 12 || results.length >= MAX) return;
    try {
      for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
        if (results.length >= MAX || excl.includes(item.name) || item.name.startsWith('.')) continue;
        const fp = path.join(dir, item.name);
        if (item.isDirectory()) { search(fp, depth + 1); continue; }
        try {
          fs.readFileSync(fp, 'utf-8').split('\n').forEach((line, idx) => {
            if (results.length >= MAX) return;
            let match = false;
            if (regex) { try { match = new RegExp(searchText, caseSensitive ? '' : 'i').test(line); } catch {} }
            else if (wholeWord) { match = new RegExp(`\\b${searchText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, caseSensitive ? '' : 'i').test(line); }
            else { match = caseSensitive ? line.includes(searchText) : line.toLowerCase().includes(searchText.toLowerCase()); }
            if (match) results.push({ filePath: fp, line: idx + 1, content: line.trim().substring(0, 200), relativePath: path.relative(rootPath, fp) });
          });
        } catch {}
      }
    } catch {}
  }
  search(rootPath); return results;
});

ipcMain.handle('open-external', (_, url) => shell.openExternal(url));

app.whenReady().then(createWindow);
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });