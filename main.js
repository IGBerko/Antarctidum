const { app, BrowserWindow, ipcMain, dialog, Menu, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');

let mainWindow;
let currentProjectPath = null;
let userSettingsPath;
let pluginsPath;
let ptyProcesses = new Map();

// ═══════════ PTY (опционально) ═══════════
let pty;
try {
  pty = require('node-pty');
} catch (e) {
  console.warn('node-pty not available, using exec fallback');
  pty = null;
}

function getDefaultShell() {
  if (process.platform === 'win32') return 'powershell.exe';
  return process.env.SHELL || '/bin/bash';
}

// ═══════════ WINDOW ═══════════
function createWindow() {
  userSettingsPath = path.join(app.getPath('userData'), 'settings.json');
  pluginsPath = path.join(app.getPath('userData'), 'plugins');

  if (!fs.existsSync(pluginsPath)) {
    fs.mkdirSync(pluginsPath, { recursive: true });
  }

  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 800,
    minHeight: 600,
    title: 'Antarctidum',
    frame: false,
    titleBarStyle: 'hidden',
    backgroundColor: '#1e1e2e',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  mainWindow.loadFile(path.join(__dirname, 'src', 'index.html'));
  mainWindow.on('closed', () => {
    for (const [id, proc] of ptyProcesses) {
      try { proc.kill(); } catch (e) {}
    }
    ptyProcesses.clear();
    mainWindow = null;
  });

  createMenu();
}

function createMenu() {
  const template = [
    {
      label: 'File',
      submenu: [
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
      label: 'Edit',
      submenu: [
        { role: 'undo' }, { role: 'redo' }, { type: 'separator' },
        { role: 'cut' }, { role: 'copy' }, { role: 'paste' },
        { type: 'separator' },
        { label: 'Find', accelerator: 'CmdOrCtrl+F', click: () => mainWindow?.webContents.send('menu-action', 'find') },
        { label: 'Replace', accelerator: 'CmdOrCtrl+H', click: () => mainWindow?.webContents.send('menu-action', 'replace') }
      ]
    },
    {
      label: 'View',
      submenu: [
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
      label: 'Help',
      submenu: [
        {
          label: 'About', click: () => {
            dialog.showMessageBox(mainWindow, {
              type: 'info', title: 'Antarctidum',
              message: 'Antarctidum beta 0.0.1',
              detail: 'Modern code editor with plugin system.\nBuilt with Electron & Monaco.'
            });
          }
        }
      ]
    }
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

// ═══════════ FILES ═══════════
async function handleOpenFile() {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile'],
    filters: [
      { name: 'All Files', extensions: ['*'] },
      { name: 'Code', extensions: ['js', 'jsx', 'ts', 'tsx', 'py', 'rs', 'c', 'cpp', 'h', 'hpp', 'go', 'java', 'rb', 'php'] },
      { name: 'Web', extensions: ['html', 'css', 'scss', 'less', 'vue', 'svelte'] },
      { name: 'Data', extensions: ['json', 'xml', 'yaml', 'yml', 'toml', 'ini', 'env'] }
    ]
  });
  if (!result.canceled && result.filePaths.length > 0) {
    const filePath = result.filePaths[0];
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      mainWindow.webContents.send('file-opened', { filePath, content });
    } catch (err) {
      dialog.showErrorBox('Error', `Cannot read file: ${err.message}`);
    }
  }
}

async function handleOpenFolder() {
  const result = await dialog.showOpenDialog(mainWindow, { properties: ['openDirectory'] });
  if (!result.canceled && result.filePaths.length > 0) {
    currentProjectPath = result.filePaths[0];
    const settings = loadSettings();
    const tree = readDirectoryTree(currentProjectPath, 0, settings['files.exclude'] || []);
    mainWindow.webContents.send('folder-opened', { rootPath: currentProjectPath, tree });
  }
}

function readDirectoryTree(dirPath, depth = 0, excludeList = []) {
  if (depth > 15) return [];
  const entries = [];
  try {
    const items = fs.readdirSync(dirPath, { withFileTypes: true }).sort((a, b) => {
      if (a.isDirectory() && !b.isDirectory()) return -1;
      if (!a.isDirectory() && b.isDirectory()) return 1;
      return a.name.localeCompare(b.name);
    });
    for (const item of items) {
      if (item.name.startsWith('.') && !['.env', '.gitignore', '.eslintrc', '.prettierrc'].includes(item.name)) continue;
      if (excludeList.some(ex => item.name === ex || item.name.match(new RegExp(ex.replace(/\*/g, '.*'))))) continue;
      const fullPath = path.join(dirPath, item.name);
      const entry = { name: item.name, path: fullPath, isDirectory: item.isDirectory() };
      if (item.isDirectory()) entry.children = readDirectoryTree(fullPath, depth + 1, excludeList);
      entries.push(entry);
    }
  } catch (e) { }
  return entries;
}

// ═══════════ SETTINGS ═══════════
function loadSettings() {
  let defaults = {};
  try {
    defaults = JSON.parse(fs.readFileSync(path.join(__dirname, 'default-settings.json'), 'utf-8'));
  } catch (e) { }
  try {
    if (fs.existsSync(userSettingsPath)) {
      const user = JSON.parse(fs.readFileSync(userSettingsPath, 'utf-8'));
      return { ...defaults, ...user };
    }
  } catch (e) { }
  return defaults;
}

function saveSettings(settings) {
  try {
    fs.writeFileSync(userSettingsPath, JSON.stringify(settings, null, 2), 'utf-8');
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

// ═══════════ IPC: FILES ═══════════
ipcMain.handle('read-file', async (_, filePath) => {
  try { return { success: true, content: fs.readFileSync(filePath, 'utf-8') }; }
  catch (e) { return { success: false, error: e.message }; }
});

ipcMain.handle('save-file', async (_, { filePath, content }) => {
  try { fs.writeFileSync(filePath, content, 'utf-8'); return { success: true }; }
  catch (e) { return { success: false, error: e.message }; }
});

ipcMain.handle('save-file-as', async (_, { content, defaultPath }) => {
  const result = await dialog.showSaveDialog(mainWindow, {
    defaultPath: defaultPath || 'untitled.txt',
    filters: [{ name: 'All Files', extensions: ['*'] }]
  });
  if (result.canceled) return { success: false, canceled: true };
  try {
    fs.writeFileSync(result.filePath, content, 'utf-8');
    return { success: true, filePath: result.filePath };
  } catch (e) { return { success: false, error: e.message }; }
});

ipcMain.handle('read-directory', async (_, dirPath) => {
  try {
    const settings = loadSettings();
    return { success: true, tree: readDirectoryTree(dirPath, 0, settings['files.exclude'] || []) };
  } catch (e) { return { success: false, error: e.message }; }
});

ipcMain.handle('create-file', async (_, filePath) => {
  try {
    if (fs.existsSync(filePath)) return { success: false, error: 'File exists' };
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, '', 'utf-8');
    return { success: true };
  } catch (e) { return { success: false, error: e.message }; }
});

ipcMain.handle('create-folder', async (_, folderPath) => {
  try {
    if (fs.existsSync(folderPath)) return { success: false, error: 'Folder exists' };
    fs.mkdirSync(folderPath, { recursive: true });
    return { success: true };
  } catch (e) { return { success: false, error: e.message }; }
});

ipcMain.handle('delete-path', async (_, targetPath) => {
  try {
    const r = await dialog.showMessageBox(mainWindow, {
      type: 'warning', buttons: ['Delete', 'Cancel'], defaultId: 1,
      title: 'Confirm Delete', message: `Delete "${path.basename(targetPath)}"?`
    });
    if (r.response !== 0) return { success: false, canceled: true };
    fs.rmSync(targetPath, { recursive: true, force: true });
    return { success: true };
  } catch (e) { return { success: false, error: e.message }; }
});

ipcMain.handle('rename-path', async (_, { oldPath, newPath }) => {
  try { fs.renameSync(oldPath, newPath); return { success: true }; }
  catch (e) { return { success: false, error: e.message }; }
});

ipcMain.handle('get-file-stats', async (_, filePath) => {
  try {
    const s = fs.statSync(filePath);
    return { success: true, stats: { size: s.size, modified: s.mtime, created: s.birthtime, isDirectory: s.isDirectory() } };
  } catch (e) { return { success: false, error: e.message }; }
});

ipcMain.handle('open-folder-dialog', () => handleOpenFolder());
ipcMain.handle('open-file-dialog', () => handleOpenFile());

// ═══════════ IPC: SETTINGS ═══════════
ipcMain.handle('load-settings', () => loadSettings());
ipcMain.handle('save-settings', (_, settings) => saveSettings(settings));
ipcMain.handle('get-default-settings', () => {
  try { return JSON.parse(fs.readFileSync(path.join(__dirname, 'default-settings.json'), 'utf-8')); }
  catch (e) { return {}; }
});

// ═══════════ IPC: PLUGINS ═══════════
ipcMain.handle('get-plugins-path', () => pluginsPath);

ipcMain.handle('get-installed-plugins', () => {
  const plugins = [];
  try {
    const dirs = fs.readdirSync(pluginsPath, { withFileTypes: true });
    for (const dir of dirs) {
      if (!dir.isDirectory()) continue;
      const pluginDir = path.join(pluginsPath, dir.name);
      const manifestPath = path.join(pluginDir, 'plugin.json');
      let manifest = { id: dir.name, name: dir.name };
      try {
        if (fs.existsSync(manifestPath)) manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
      } catch (e) { }
      const mainFile = manifest.main || 'index.js';
      let code = '';
      try {
        const codePath = path.join(pluginDir, mainFile);
        if (fs.existsSync(codePath)) code = fs.readFileSync(codePath, 'utf-8');
      } catch (e) { }
      plugins.push({
        id: manifest.id || dir.name, name: manifest.name || dir.name,
        version: manifest.version || '1.0.0', description: manifest.description || '',
        author: manifest.author || 'Unknown', icon: manifest.icon || '🧩',
        main: mainFile, code, installed: true, dirPath: pluginDir
      });
    }
  } catch (e) { }
  return plugins;
});

ipcMain.handle('install-plugin', async (_, pluginId, files) => {
  if (!pluginId || !files) return { success: false, error: 'Invalid args' };
  const safeId = pluginId.replace(/[^a-zA-Z0-9\-_]/g, '-').substring(0, 100);
  if (!safeId) return { success: false, error: 'Invalid ID' };
  try {
    const pluginDir = path.join(pluginsPath, safeId);
    fs.mkdirSync(pluginDir, { recursive: true });
    const written = [];
    for (const [fileName, content] of Object.entries(files)) {
      const safeName = fileName.replace(/\.\./g, '').replace(/^[\/\\]+/, '');
      if (!safeName) continue;
      const filePath = path.join(pluginDir, safeName);
      if (!path.resolve(filePath).startsWith(path.resolve(pluginDir))) continue;
      fs.mkdirSync(path.dirname(filePath), { recursive: true });
      fs.writeFileSync(filePath, content, 'utf-8');
      written.push(safeName);
    }
    return { success: true, path: pluginDir, files: written };
  } catch (e) { return { success: false, error: e.message }; }
});

ipcMain.handle('uninstall-plugin', async (_, pluginId) => {
  if (!pluginId) return { success: false, error: 'No ID' };
  const safeId = pluginId.replace(/[^a-zA-Z0-9\-_]/g, '-').substring(0, 100);
  try {
    const pluginDir = path.join(pluginsPath, safeId);
    if (!path.resolve(pluginDir).startsWith(path.resolve(pluginsPath))) return { success: false, error: 'Invalid path' };
    if (fs.existsSync(pluginDir)) {
      fs.rmSync(pluginDir, { recursive: true, force: true });
      return { success: true };
    }
    return { success: false, error: 'Not found' };
  } catch (e) { return { success: false, error: e.message }; }
});

// ═══════════ IPC: WINDOW ═══════════
ipcMain.on('window-minimize', () => mainWindow?.minimize());
ipcMain.on('window-maximize', () => {
  if (mainWindow) mainWindow.isMaximized() ? mainWindow.unmaximize() : mainWindow.maximize();
});
ipcMain.on('window-close', () => mainWindow?.close());

// ═══════════ IPC: TERMINAL (PTY) ═══════════
let termIdCounter = 0;

ipcMain.handle('terminal-create', (event) => {
  const id = ++termIdCounter;
  if (pty) {
    const shell = loadSettings()['terminal.shell'] || getDefaultShell();
    const cwd = currentProjectPath || os.homedir();
    const proc = pty.spawn(shell, [], {
      name: 'xterm-256color',
      cols: 120,
      rows: 30,
      cwd,
      env: { ...process.env, TERM: 'xterm-256color' }
    });
    proc.onData((data) => {
      mainWindow?.webContents.send('terminal-data', { id, data });
    });
    proc.onExit(({ exitCode }) => {
      mainWindow?.webContents.send('terminal-exit', { id, exitCode });
      ptyProcesses.delete(id);
    });
    ptyProcesses.set(id, proc);
    return { success: true, id, pty: true };
  }
  return { success: true, id, pty: false };
});

ipcMain.handle('terminal-input', (_, { id, data }) => {
  const proc = ptyProcesses.get(id);
  if (proc) { proc.write(data); return { success: true }; }
  return { success: false };
});

ipcMain.handle('terminal-resize', (_, { id, cols, rows }) => {
  const proc = ptyProcesses.get(id);
  if (proc) { try { proc.resize(cols, rows); } catch (e) { } return { success: true }; }
  return { success: false };
});

ipcMain.handle('terminal-kill', (_, { id }) => {
  const proc = ptyProcesses.get(id);
  if (proc) { proc.kill(); ptyProcesses.delete(id); return { success: true }; }
  return { success: false };
});

// Fallback exec для терминала без PTY
ipcMain.handle('terminal-exec', async (_, { command, cwd }) => {
  const { exec } = require('child_process');
  return new Promise(resolve => {
    const workDir = cwd || currentProjectPath || os.homedir();
    exec(command, { cwd: workDir, timeout: 30000, maxBuffer: 5 * 1024 * 1024 }, (error, stdout, stderr) => {
      resolve({ stdout, stderr, error: error?.message || null, code: error?.code || 0 });
    });
  });
});

ipcMain.handle('get-project-path', () => currentProjectPath);
ipcMain.handle('get-home-path', () => os.homedir());

// ═══════════ IPC: MONACO ═══════════
ipcMain.handle('get-monaco-path', () => path.join(__dirname, 'node_modules', 'monaco-editor', 'min'));

// ═══════════ IPC: SEARCH ═══════════
ipcMain.handle('search-in-files', async (_, { searchText, rootPath, caseSensitive, regex, wholeWord }) => {
  const results = [];
  if (!rootPath || !searchText) return results;
  const settings = loadSettings();
  const excludeList = settings['files.exclude'] || [];
  const MAX = 1000;

  function searchDir(dirPath, depth = 0) {
    if (depth > 12 || results.length >= MAX) return;
    try {
      const items = fs.readdirSync(dirPath, { withFileTypes: true });
      for (const item of items) {
        if (results.length >= MAX) return;
        if (excludeList.includes(item.name) || item.name.startsWith('.')) continue;
        const fullPath = path.join(dirPath, item.name);
        if (item.isDirectory()) { searchDir(fullPath, depth + 1); continue; }
        try {
          const content = fs.readFileSync(fullPath, 'utf-8');
          const lines = content.split('\n');
          let pattern;
          if (regex) { try { pattern = new RegExp(searchText, caseSensitive ? 'g' : 'gi'); } catch { continue; } }
          lines.forEach((line, idx) => {
            if (results.length >= MAX) return;
            let match = false;
            if (regex && pattern) { match = pattern.test(line); pattern.lastIndex = 0; }
            else if (wholeWord) {
              const escaped = searchText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
              match = new RegExp(`\\b${escaped}\\b`, caseSensitive ? '' : 'i').test(line);
            } else {
              match = caseSensitive ? line.includes(searchText) : line.toLowerCase().includes(searchText.toLowerCase());
            }
            if (match) results.push({ filePath: fullPath, line: idx + 1, content: line.trim().substring(0, 200), relativePath: path.relative(rootPath, fullPath) });
          });
        } catch { }
      }
    } catch { }
  }
  searchDir(rootPath);
  return results;
});

ipcMain.handle('open-external', (_, url) => shell.openExternal(url));

// ═══════════ APP ═══════════
app.whenReady().then(createWindow);
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });