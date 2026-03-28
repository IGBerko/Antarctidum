const { app, BrowserWindow, ipcMain, dialog, Menu, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { exec, spawn } = require('child_process');

let mainWindow;
let currentProjectPath = null;
let userSettingsPath;
let pluginsPath;
let ptyProcesses = new Map();
let runningProcesses = new Map();

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

  const iconPath = path.join(__dirname, 'src', 'icon.png');
  const iconIco = path.join(__dirname, 'src', 'icon.ico');
  let icon;
  if (process.platform === 'win32' && fs.existsSync(iconIco)) icon = iconIco;
  else if (fs.existsSync(iconPath)) icon = iconPath;

  mainWindow = new BrowserWindow({
    width: 1400, height: 900,
    minWidth: 800, minHeight: 600,
    title: 'Antarctidum',
    icon,
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
    for (const [, proc] of ptyProcesses) { try { proc.kill(); } catch (e) {} }
    ptyProcesses.clear();
    for (const [, proc] of runningProcesses) { try { proc.kill(); } catch (e) {} }
    runningProcesses.clear();
    mainWindow = null;
  });
  createMenu();
}

function createMenu() {
  const send = (action) => mainWindow?.webContents.send('menu-action', action);
  const template = [
    {
      label: 'File', submenu: [
        { label: 'New File', accelerator: 'CmdOrCtrl+N', click: () => send('new-file') },
        { label: 'Open File', accelerator: 'CmdOrCtrl+O', click: () => handleOpenFile() },
        { label: 'Open Folder', accelerator: 'CmdOrCtrl+Shift+O', click: () => handleOpenFolder() },
        { type: 'separator' },
        { label: 'Save', accelerator: 'CmdOrCtrl+S', click: () => send('save') },
        { label: 'Save As', accelerator: 'CmdOrCtrl+Shift+S', click: () => send('save-as') },
        { type: 'separator' },
        { label: 'Settings', accelerator: 'CmdOrCtrl+,', click: () => send('settings') },
        { type: 'separator' },
        { label: 'Exit', accelerator: 'CmdOrCtrl+Q', click: () => app.quit() }
      ]
    },
    {
      label: 'Edit', submenu: [
        { role: 'undo' }, { role: 'redo' }, { type: 'separator' },
        { role: 'cut' }, { role: 'copy' }, { role: 'paste' },
        { type: 'separator' },
        { label: 'Find', accelerator: 'CmdOrCtrl+F', click: () => send('find') },
        { label: 'Replace', accelerator: 'CmdOrCtrl+H', click: () => send('replace') }
      ]
    },
    {
      label: 'View', submenu: [
        { label: 'Toggle Sidebar', accelerator: 'CmdOrCtrl+B', click: () => send('toggle-sidebar') },
        { label: 'Toggle Terminal', accelerator: 'CmdOrCtrl+`', click: () => send('toggle-terminal') },
        { type: 'separator' },
        { label: 'Zoom In', accelerator: 'CmdOrCtrl+=', click: () => send('zoom-in') },
        { label: 'Zoom Out', accelerator: 'CmdOrCtrl+-', click: () => send('zoom-out') },
        { type: 'separator' },
        { label: 'DevTools', accelerator: 'F12', click: () => mainWindow?.webContents.toggleDevTools() }
      ]
    },
    // ═══ МЕНЮ RUN ═══
    {
      label: 'Run', submenu: [
        { label: 'Run File', accelerator: 'F5', click: () => send('run-file') },
        { label: 'Run Without Saving', accelerator: 'CmdOrCtrl+F5', click: () => send('run-file-nosave') },
        { label: 'Stop', accelerator: 'Shift+F5', click: () => send('stop-run') },
        { type: 'separator' },
        { label: 'Run Selection', accelerator: 'CmdOrCtrl+Shift+Enter', click: () => send('run-selection') },
        { type: 'separator' },
        { label: 'Configure Run...', click: () => send('configure-run') }
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

// ═══════════════════════════════════════════
// RUN CODE — запуск файлов
// ═══════════════════════════════════════════

// Конфигурация языков
function getRunConfig(filePath, customSettings = {}) {
  const ext = path.extname(filePath).toLowerCase();
  const dir = path.dirname(filePath);
  const file = path.basename(filePath);
  const name = path.basename(filePath, ext);
  const isWin = process.platform === 'win32';

  const configs = {
    // ═══ Python ═══
    '.py': {
      name: 'Python',
      command: customSettings['run.pythonPath'] || 'python',
      args: [filePath],
      cwd: dir,
    },

    // ═══ Java ═══
    '.java': {
      name: 'Java',
      // Компиляция + запуск
      compileCommand: customSettings['run.javacPath'] || 'javac',
      compileArgs: [filePath],
      command: customSettings['run.javaPath'] || 'java',
      args: ['-cp', dir, name],
      cwd: dir,
      needsCompile: true,
    },

    // ═══ JavaScript (Node.js) ═══
    '.js': {
      name: 'JavaScript (Node.js)',
      command: customSettings['run.nodePath'] || 'node',
      args: [filePath],
      cwd: dir,
    },
    '.mjs': {
      name: 'JavaScript (Node.js)',
      command: customSettings['run.nodePath'] || 'node',
      args: [filePath],
      cwd: dir,
    },

    // ═══ TypeScript ═══
    '.ts': {
      name: 'TypeScript',
      command: 'npx',
      args: ['ts-node', filePath],
      cwd: dir,
      // альтернатива: tsc + node
      alt: {
        compileCommand: 'npx',
        compileArgs: ['tsc', filePath],
        command: customSettings['run.nodePath'] || 'node',
        args: [path.join(dir, name + '.js')],
        needsCompile: true,
      }
    },

    // ═══ C ═══
    '.c': {
      name: 'C',
      compileCommand: customSettings['run.gccPath'] || 'gcc',
      compileArgs: [filePath, '-o', path.join(dir, name + (isWin ? '.exe' : ''))],
      command: path.join(dir, name + (isWin ? '.exe' : '')),
      args: [],
      cwd: dir,
      needsCompile: true,
    },

    // ═══ C++ ═══
    '.cpp': {
      name: 'C++',
      compileCommand: customSettings['run.gppPath'] || 'g++',
      compileArgs: [filePath, '-o', path.join(dir, name + (isWin ? '.exe' : ''))],
      command: path.join(dir, name + (isWin ? '.exe' : '')),
      args: [],
      cwd: dir,
      needsCompile: true,
    },
    '.cc': {
      name: 'C++',
      compileCommand: customSettings['run.gppPath'] || 'g++',
      compileArgs: [filePath, '-o', path.join(dir, name + (isWin ? '.exe' : ''))],
      command: path.join(dir, name + (isWin ? '.exe' : '')),
      args: [],
      cwd: dir,
      needsCompile: true,
    },

    // ═══ Go ═══
    '.go': {
      name: 'Go',
      command: 'go',
      args: ['run', filePath],
      cwd: dir,
    },

    // ═══ Rust ═══
    '.rs': {
      name: 'Rust',
      compileCommand: 'rustc',
      compileArgs: [filePath, '-o', path.join(dir, name + (isWin ? '.exe' : ''))],
      command: path.join(dir, name + (isWin ? '.exe' : '')),
      args: [],
      cwd: dir,
      needsCompile: true,
      // альтернатива: cargo run (если в проекте)
    },

    // ═══ PHP ═══
    '.php': {
      name: 'PHP',
      command: customSettings['run.phpPath'] || 'php',
      args: [filePath],
      cwd: dir,
    },

    // ═══ Ruby ═══
    '.rb': {
      name: 'Ruby',
      command: 'ruby',
      args: [filePath],
      cwd: dir,
    },

    // ═══ Lua ═══
    '.lua': {
      name: 'Lua',
      command: 'lua',
      args: [filePath],
      cwd: dir,
    },

    // ═══ Shell ═══
    '.sh': {
      name: 'Bash',
      command: 'bash',
      args: [filePath],
      cwd: dir,
    },
    '.bash': {
      name: 'Bash',
      command: 'bash',
      args: [filePath],
      cwd: dir,
    },

    // ═══ PowerShell ═══
    '.ps1': {
      name: 'PowerShell',
      command: 'powershell',
      args: ['-ExecutionPolicy', 'Bypass', '-File', filePath],
      cwd: dir,
    },

    // ═══ Batch ═══
    '.bat': {
      name: 'Batch',
      command: 'cmd',
      args: ['/c', filePath],
      cwd: dir,
    },
    '.cmd': {
      name: 'Batch',
      command: 'cmd',
      args: ['/c', filePath],
      cwd: dir,
    },

    // ═══ Kotlin ═══
    '.kt': {
      name: 'Kotlin',
      compileCommand: 'kotlinc',
      compileArgs: [filePath, '-include-runtime', '-d', path.join(dir, name + '.jar')],
      command: 'java',
      args: ['-jar', path.join(dir, name + '.jar')],
      cwd: dir,
      needsCompile: true,
    },

    // ═══ Swift ═══
    '.swift': {
      name: 'Swift',
      command: 'swift',
      args: [filePath],
      cwd: dir,
    },

    // ═══ R ═══
    '.r': {
      name: 'R',
      command: 'Rscript',
      args: [filePath],
      cwd: dir,
    },

    // ═══ Perl ═══
    '.pl': {
      name: 'Perl',
      command: 'perl',
      args: [filePath],
      cwd: dir,
    },
  };

  return configs[ext] || null;
}

// Проверить, установлена ли команда
function commandExists(cmd) {
  return new Promise(resolve => {
    const check = process.platform === 'win32'
      ? `where "${cmd}" 2>nul`
      : `which "${cmd}" 2>/dev/null`;
    exec(check, (err) => resolve(!err));
  });
}

// IPC: Запуск файла
ipcMain.handle('run-file', async (_, { filePath, saveFirst }) => {
  if (!filePath) return { success: false, error: 'No file to run' };
  if (!fs.existsSync(filePath)) return { success: false, error: 'File not found' };

  const settings = loadSettings();
  const config = getRunConfig(filePath, settings);

  if (!config) {
    const ext = path.extname(filePath);
    return { success: false, error: `No run configuration for ${ext} files` };
  }

  // Проверяем, установлен ли интерпретатор/компилятор
  const mainCmd = config.needsCompile ? config.compileCommand : config.command;
  const exists = await commandExists(mainCmd);
  if (!exists) {
    return {
      success: false,
      error: `"${mainCmd}" not found. Please install ${config.name} and make sure it's in your PATH.`,
      hint: getInstallHint(config.name)
    };
  }

  return { success: true, config };
});

// IPC: Выполнить команду в реальном времени (через PTY если есть)
ipcMain.handle('run-command', async (_, { command, args, cwd, id }) => {
  return new Promise(resolve => {
    try {
      const proc = spawn(command, args || [], {
        cwd: cwd || currentProjectPath || os.homedir(),
        env: { ...process.env, PYTHONUNBUFFERED: '1', PYTHONIOENCODING: 'utf-8' },
        shell: process.platform === 'win32',
        stdio: ['pipe', 'pipe', 'pipe']
      });

      const runId = id || Date.now().toString();
      runningProcesses.set(runId, proc);

      proc.stdout.on('data', (data) => {
        mainWindow?.webContents.send('run-output', {
          id: runId,
          type: 'stdout',
          data: data.toString()
        });
      });

      proc.stderr.on('data', (data) => {
        mainWindow?.webContents.send('run-output', {
          id: runId,
          type: 'stderr',
          data: data.toString()
        });
      });

      proc.on('close', (code) => {
        runningProcesses.delete(runId);
        mainWindow?.webContents.send('run-output', {
          id: runId,
          type: 'exit',
          code: code
        });
        resolve({ success: true, code, id: runId });
      });

      proc.on('error', (err) => {
        runningProcesses.delete(runId);
        mainWindow?.webContents.send('run-output', {
          id: runId,
          type: 'error',
          data: err.message
        });
        resolve({ success: false, error: err.message, id: runId });
      });

      // Вернуть ID чтобы можно было остановить
      resolve({ success: true, id: runId, pid: proc.pid });
    } catch (err) {
      resolve({ success: false, error: err.message });
    }
  });
});

// IPC: Остановить запущенный процесс
ipcMain.handle('stop-run', async (_, { id }) => {
  const proc = runningProcesses.get(id);
  if (proc) {
    try {
      if (process.platform === 'win32') {
        exec(`taskkill /pid ${proc.pid} /T /F`);
      } else {
        proc.kill('SIGTERM');
        setTimeout(() => { try { proc.kill('SIGKILL'); } catch (e) {} }, 2000);
      }
      runningProcesses.delete(id);
      return { success: true };
    } catch (e) {
      return { success: false, error: e.message };
    }
  }
  return { success: false, error: 'Process not found' };
});

// IPC: Отправить ввод в запущенный процесс
ipcMain.handle('run-input', async (_, { id, data }) => {
  const proc = runningProcesses.get(id);
  if (proc && proc.stdin) {
    try { proc.stdin.write(data); return { success: true }; }
    catch (e) { return { success: false, error: e.message }; }
  }
  return { success: false, error: 'Process not found' };
});

function getInstallHint(lang) {
  const hints = {
    'Python': 'Download from https://python.org\nOr: winget install Python.Python.3',
    'Java': 'Download JDK from https://adoptium.net\nOr: winget install EclipseAdoptium.Temurin.21.JDK',
    'JavaScript (Node.js)': 'Download from https://nodejs.org\nOr: winget install OpenJS.NodeJS',
    'C': 'Install MinGW: https://www.mingw-w64.org\nOr: winget install MSYS2.MSYS2',
    'C++': 'Install MinGW: https://www.mingw-w64.org\nOr: winget install MSYS2.MSYS2',
    'Go': 'Download from https://go.dev\nOr: winget install GoLang.Go',
    'Rust': 'Install from https://rustup.rs\nOr: winget install Rustlang.Rustup',
    'PHP': 'Download from https://php.net\nOr: winget install PHP.PHP',
    'Ruby': 'Download from https://rubyinstaller.org\nOr: winget install RubyInstallerTeam.Ruby',
    'TypeScript': 'npm install -g ts-node typescript',
    'Kotlin': 'Install from https://kotlinlang.org\nOr: sdk install kotlin',
  };
  return hints[lang] || `Install ${lang} and add it to your PATH`;
}

// ═══════════════════════════════════════════
// Остальной код main.js (FILES, SETTINGS, etc.)
// ═══════════════════════════════════════════

async function handleOpenFile() {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile'],
    filters: [
      { name: 'All Files', extensions: ['*'] },
      { name: 'Code', extensions: ['js', 'jsx', 'ts', 'tsx', 'py', 'rs', 'c', 'cpp', 'h', 'go', 'java', 'php', 'rb', 'lua', 'kt', 'swift'] },
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

// IPC: FILES
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
ipcMain.handle('delete-path', async (_, p) => { try { const r = await dialog.showMessageBox(mainWindow, { type: 'warning', buttons: ['Delete', 'Cancel'], defaultId: 1, message: `Delete "${path.basename(p)}"?` }); if (r.response !== 0) return { success: false, canceled: true }; fs.rmSync(p, { recursive: true, force: true }); return { success: true }; } catch (e) { return { success: false, error: e.message }; } });
ipcMain.handle('rename-path', async (_, { oldPath, newPath }) => { try { fs.renameSync(oldPath, newPath); return { success: true }; } catch (e) { return { success: false, error: e.message }; } });
ipcMain.handle('get-file-stats', async (_, p) => { try { const s = fs.statSync(p); return { success: true, stats: { size: s.size, modified: s.mtime, created: s.birthtime, isDirectory: s.isDirectory() } }; } catch (e) { return { success: false, error: e.message }; } });
ipcMain.handle('open-folder-dialog', () => handleOpenFolder());
ipcMain.handle('open-file-dialog', () => handleOpenFile());

// IPC: SETTINGS
ipcMain.handle('load-settings', () => loadSettings());
ipcMain.handle('save-settings', (_, s) => saveSettings(s));
ipcMain.handle('get-default-settings', () => { try { return JSON.parse(fs.readFileSync(path.join(__dirname, 'default-settings.json'), 'utf-8')); } catch (e) { return {}; } });

// IPC: PLUGINS
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

// IPC: WINDOW
ipcMain.on('window-minimize', () => mainWindow?.minimize());
ipcMain.on('window-maximize', () => { if (mainWindow) mainWindow.isMaximized() ? mainWindow.unmaximize() : mainWindow.maximize(); });
ipcMain.on('window-close', () => mainWindow?.close());

// IPC: TERMINAL (PTY)
let termIdCounter = 0;
ipcMain.handle('terminal-create', () => {
  const id = ++termIdCounter;
  if (!pty) return { success: true, id, pty: false };
  const s = loadSettings();
  const shell = s['terminal.shell'] || getDefaultShell();
  const cwd = currentProjectPath || os.homedir();
  try {
    const proc = pty.spawn(shell, [], {
      name: 'xterm-256color', cols: 120, rows: 30, cwd,
      env: { ...process.env, TERM: 'xterm-256color', COLORTERM: 'truecolor' },
      ...(process.platform === 'win32' ? { useConpty: true } : {})
    });
    proc.onData(data => mainWindow?.webContents.send('terminal-data', { id, data }));
    proc.onExit(({ exitCode }) => { mainWindow?.webContents.send('terminal-exit', { id, exitCode }); ptyProcesses.delete(id); });
    ptyProcesses.set(id, proc);
    return { success: true, id, pty: true };
  } catch (e) { return { success: true, id, pty: false, error: e.message }; }
});
ipcMain.handle('terminal-input', (_, { id, data }) => { const p = ptyProcesses.get(id); if (p) { p.write(data); return { success: true }; } return { success: false }; });
ipcMain.handle('terminal-resize', (_, { id, cols, rows }) => { const p = ptyProcesses.get(id); if (p) { try { p.resize(Math.max(cols, 2), Math.max(rows, 2)); } catch (e) {} return { success: true }; } return { success: false }; });
ipcMain.handle('terminal-kill', (_, { id }) => { const p = ptyProcesses.get(id); if (p) { p.kill(); ptyProcesses.delete(id); return { success: true }; } return { success: false }; });
ipcMain.handle('terminal-exec', async (_, { command, cwd }) => {
  return new Promise(resolve => {
    exec(command, { cwd: cwd || currentProjectPath || os.homedir(), timeout: 30000, maxBuffer: 5 * 1024 * 1024 }, (error, stdout, stderr) => {
      resolve({ stdout, stderr, error: error?.message || null, code: error?.code || 0 });
    });
  });
});
ipcMain.handle('get-project-path', () => currentProjectPath);
ipcMain.handle('get-home-path', () => os.homedir());
ipcMain.handle('get-monaco-path', () => path.join(__dirname, 'node_modules', 'monaco-editor', 'min'));

// IPC: SEARCH
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