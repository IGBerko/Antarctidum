// ═══════════════════════════════════════════════════════════
// ANTARCTIDUM v2.0 — Full IDE App (with xterm.js terminal)
// ═══════════════════════════════════════════════════════════

(function () {
  'use strict';

  // ═══════════ i18n ═══════════
  const LANGS = {
    en: {
      explorer: 'EXPLORER', search: 'SEARCH', extensions: 'EXTENSIONS',
      settings: 'SETTINGS', editor: 'Editor', appearance: 'Appearance',
      terminal: 'Terminal', files: 'Files', about: 'About',
      installed: 'INSTALLED', marketplace: 'MARKETPLACE',
      noFolder: 'No folder opened', openFolder: 'Open Folder',
      openFile: 'Open File', newFile: 'New File', start: 'Start', tools: 'Tools',
      commandPalette: 'Command Palette', save: 'Save', saveAs: 'Save As',
      find: 'Find', replace: 'Replace',
      delete: 'Delete', rename: 'Rename', newFilePrompt: 'New File',
      newFolderPrompt: 'New Folder', install: 'Install', uninstall: 'Uninstall',
      pluginInstalled: 'Plugin installed', pluginUninstalled: 'Plugin removed',
      fileSaved: 'File saved', loading: 'Loading...',
      noResults: 'No results', results: 'results',
      fontSize: 'Font Size', fontFamily: 'Font Family', tabSize: 'Tab Size',
      wordWrap: 'Word Wrap', minimap: 'Minimap', lineNumbers: 'Line Numbers',
      autoSave: 'Auto Save', theme: 'Theme', language: 'Language',
      zoomLevel: 'Zoom Level', excludeFiles: 'Exclude Files',
      terminalFontSize: 'Terminal Font Size', terminalShell: 'Shell',
      bracketColors: 'Bracket Pair Colorization',
      smoothScrolling: 'Smooth Scrolling', renderWhitespace: 'Render Whitespace',
      cursorStyle: 'Cursor Style', cursorBlinking: 'Cursor Blinking',
      formatOnSave: 'Format on Save', formatOnPaste: 'Format on Paste',
      serverUrl: 'Plugin Server URL',
      aboutText: 'Antarctidum — Modern Code Editor v2.0.0\nBuilt with Electron, Monaco & xterm.js',
      copyPath: 'Copy Path', closeTab: 'Close', closeOthers: 'Close Others', closeAll: 'Close All',
    },
    ru: {
      explorer: 'ПРОВОДНИК', search: 'ПОИСК', extensions: 'РАСШИРЕНИЯ',
      settings: 'НАСТРОЙКИ', editor: 'Редактор', appearance: 'Внешний вид',
      terminal: 'Терминал', files: 'Файлы', about: 'О программе',
      installed: 'УСТАНОВЛЕННЫЕ', marketplace: 'МАГАЗИН',
      noFolder: 'Папка не открыта', openFolder: 'Открыть папку',
      openFile: 'Открыть файл', newFile: 'Новый файл', start: 'Начало', tools: 'Инструменты',
      commandPalette: 'Палитра команд', save: 'Сохранить', saveAs: 'Сохранить как',
      find: 'Найти', replace: 'Заменить',
      delete: 'Удалить', rename: 'Переименовать', newFilePrompt: 'Новый файл',
      newFolderPrompt: 'Новая папка', install: 'Установить', uninstall: 'Удалить',
      pluginInstalled: 'Плагин установлен', pluginUninstalled: 'Плагин удалён',
      fileSaved: 'Файл сохранён', loading: 'Загрузка...',
      noResults: 'Ничего не найдено', results: 'результатов',
      fontSize: 'Размер шрифта', fontFamily: 'Семейство шрифтов', tabSize: 'Табуляция',
      wordWrap: 'Перенос строк', minimap: 'Миникарта', lineNumbers: 'Номера строк',
      autoSave: 'Автосохранение', theme: 'Тема', language: 'Язык',
      zoomLevel: 'Масштаб', excludeFiles: 'Исключить файлы',
      terminalFontSize: 'Шрифт терминала', terminalShell: 'Оболочка',
      bracketColors: 'Цветные скобки',
      smoothScrolling: 'Плавная прокрутка', renderWhitespace: 'Пробельные символы',
      cursorStyle: 'Стиль курсора', cursorBlinking: 'Мигание курсора',
      formatOnSave: 'Формат при сохранении', formatOnPaste: 'Формат при вставке',
      serverUrl: 'URL сервера плагинов',
      aboutText: 'Antarctidum — Современный редактор кода v2.0.0\nElectron + Monaco + xterm.js',
      copyPath: 'Копировать путь', closeTab: 'Закрыть', closeOthers: 'Закрыть другие', closeAll: 'Закрыть все',
    }
  };

  let currentLang = 'en';
  let settings = {};
  function t(key) { return (LANGS[currentLang] && LANGS[currentLang][key]) || LANGS.en[key] || key; }
  function applyI18n() {
    document.querySelectorAll('[data-i18n]').forEach(el => { el.textContent = t(el.dataset.i18n); });
    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => { el.placeholder = t(el.dataset.i18nPlaceholder); });
  }

  // ═══════════ STATE ═══════════
  let editor = null;
  let tabs = [];
  let activeTabId = null;
  let projectRoot = null;
  let commandPaletteVisible = false;
  let terminalVisible = false;
  let sidebarVisible = true;
  let zoomLevel = 0;
  let installedPlugins = [];
  let activePlugins = new Map();
  let autoSaveTimer = null;

  // === TERMINAL STATE ===
  let xtermInstance = null;       // xterm.Terminal
  let xtermFitAddon = null;      // FitAddon
  let terminalId = null;         // PTY process ID
  let terminalHasPty = false;    // PTY available?
  let xtermLoaded = false;       // xterm.js scripts loaded?

  // Fallback terminal state
  let commandHistory = [];
  let historyIndex = -1;
  let terminalCwd = '';

  // ═══════════ INIT ═══════════
  async function init() {
    settings = await window.api.loadSettings();
    currentLang = settings['appearance.language'] || 'en';
    zoomLevel = settings['appearance.zoomLevel'] || 0;
    applyI18n();
    applyZoom();
    await initMonaco();
    initWindowControls();
    initActivityBar();
    initSidebar();
    initTerminalUI();
    initSearch();
    initCommandPalette();
    initContextMenu();
    initKeyboard();
    initWelcome();
    initSettingsPage();
    initExtensions();
    initIPC();
    initResize();
    await loadPlugins();
  }

  // ═══════════ MONACO ═══════════
  async function initMonaco() {
    const monacoPath = await window.api.getMonacoPath();
    const monacoUrl = `file:///${monacoPath.replace(/\\/g, '/')}`;
    return new Promise((resolve) => {
      window.require = { paths: { vs: monacoUrl + '/vs' } };
      const s = document.createElement('script');
      s.src = monacoUrl + '/vs/loader.js';
      s.onload = () => {
        require(['vs/editor/editor.main'], function () {
          monaco.editor.defineTheme('antarctidum-dark', {
            base: 'vs-dark', inherit: true,
            rules: [
              { token: 'comment', foreground: '6c7086', fontStyle: 'italic' },
              { token: 'keyword', foreground: 'cba6f7' },
              { token: 'string', foreground: 'a6e3a1' },
              { token: 'number', foreground: 'fab387' },
              { token: 'type', foreground: 'f9e2af' },
              { token: 'function', foreground: '89b4fa' },
              { token: 'variable', foreground: 'cdd6f4' },
              { token: 'operator', foreground: '89dceb' },
              { token: 'tag', foreground: 'f38ba8' },
              { token: 'attribute.name', foreground: 'f9e2af' },
              { token: 'attribute.value', foreground: 'a6e3a1' },
            ],
            colors: {
              'editor.background': '#1e1e2e',
              'editor.foreground': '#cdd6f4',
              'editor.lineHighlightBackground': '#313244',
              'editor.selectionBackground': '#45475a',
              'editorCursor.foreground': '#f5e0dc',
              'editorLineNumber.foreground': '#6c7086',
              'editorLineNumber.activeForeground': '#cdd6f4',
              'editorBracketMatch.background': '#45475a',
              'editorBracketMatch.border': '#89b4fa',
              'editor.findMatchBackground': '#f9e2af40',
              'editor.findMatchHighlightBackground': '#f9e2af20',
              'minimap.background': '#181825',
              'scrollbarSlider.background': '#45475a80',
            }
          });
          editor = monaco.editor.create(document.getElementById('monaco-editor'), {
            theme: 'antarctidum-dark',
            fontSize: settings['editor.fontSize'] || 14,
            fontFamily: settings['editor.fontFamily'] || "'Cascadia Code', monospace",
            tabSize: settings['editor.tabSize'] || 2,
            wordWrap: settings['editor.wordWrap'] || 'off',
            minimap: { enabled: settings['editor.minimap'] !== false },
            lineNumbers: settings['editor.lineNumbers'] !== false ? 'on' : 'off',
            bracketPairColorization: { enabled: settings['editor.bracketPairColorization'] !== false },
            smoothScrolling: settings['editor.smoothScrolling'] !== false,
            renderWhitespace: settings['editor.renderWhitespace'] || 'none',
            cursorBlinking: settings['editor.cursorBlinking'] || 'smooth',
            cursorStyle: settings['editor.cursorStyle'] || 'line',
            automaticLayout: true,
            padding: { top: 8 },
            suggestOnTriggerCharacters: true,
            quickSuggestions: true,
            folding: true,
            links: true,
          });
          editor.onDidChangeCursorPosition(() => {
            const pos = editor.getPosition();
            document.getElementById('status-cursor').textContent = `Ln ${pos.lineNumber}, Col ${pos.column}`;
          });
          editor.onDidChangeModelContent(() => {
            if (activeTabId) {
              const tab = tabs.find(t => t.id === activeTabId);
              if (tab && !tab.isModified) { tab.isModified = true; renderTabs(); }
              if (settings['editor.autoSave'] && tab?.filePath) {
                clearTimeout(autoSaveTimer);
                autoSaveTimer = setTimeout(() => saveCurrentFile(), settings['editor.autoSaveDelay'] || 1000);
              }
            }
          });
          resolve();
        });
      };
      document.head.appendChild(s);
    });
  }

  function updateEditorSettings() {
    if (!editor) return;
    editor.updateOptions({
      fontSize: settings['editor.fontSize'] || 14,
      fontFamily: settings['editor.fontFamily'] || "'Cascadia Code', monospace",
      tabSize: settings['editor.tabSize'] || 2,
      wordWrap: settings['editor.wordWrap'] || 'off',
      minimap: { enabled: settings['editor.minimap'] !== false },
      lineNumbers: settings['editor.lineNumbers'] !== false ? 'on' : 'off',
      bracketPairColorization: { enabled: settings['editor.bracketPairColorization'] !== false },
      smoothScrolling: settings['editor.smoothScrolling'] !== false,
      renderWhitespace: settings['editor.renderWhitespace'] || 'none',
      cursorBlinking: settings['editor.cursorBlinking'] || 'smooth',
      cursorStyle: settings['editor.cursorStyle'] || 'line',
    });
  }

  // ═══════════ WINDOW ═══════════
  function initWindowControls() {
    document.getElementById('btn-minimize').onclick = () => window.api.windowMinimize();
    document.getElementById('btn-maximize').onclick = () => window.api.windowMaximize();
    document.getElementById('btn-close').onclick = () => window.api.windowClose();
  }

  // ═══════════ ACTIVITY BAR ═══════════
  function initActivityBar() {
    document.querySelectorAll('.activity-btn[data-panel]').forEach(btn => {
      btn.addEventListener('click', () => {
        const panel = btn.dataset.panel;
        const wasActive = btn.classList.contains('active');
        document.querySelectorAll('.activity-btn').forEach(b => b.classList.remove('active'));
        if (wasActive) {
          sidebarVisible = !sidebarVisible;
          document.getElementById('sidebar').classList.toggle('hidden', !sidebarVisible);
          if (!sidebarVisible) return;
        } else {
          sidebarVisible = true;
          document.getElementById('sidebar').classList.remove('hidden');
        }
        btn.classList.add('active');
        document.querySelectorAll('.sidebar-panel').forEach(p => p.classList.remove('active'));
        document.getElementById('panel-' + panel)?.classList.add('active');
        if (panel === 'settings-panel') showSettingsPage();
      });
    });
  }

  // ═══════════ SIDEBAR / FILE TREE ═══════════
  function initSidebar() {
    document.getElementById('btn-open-folder').onclick = () => window.api.openFolderDialog();
    document.getElementById('btn-new-file').onclick = () => projectRoot && createNewFileAt(projectRoot);
    document.getElementById('btn-new-folder').onclick = () => projectRoot && createNewFolderAt(projectRoot);
    document.getElementById('btn-refresh').onclick = () => refreshFileTree();
  }

  function renderFileTree(tree, container, depth = 0) {
    container.innerHTML = '';
    if (!tree || !tree.length) {
      container.innerHTML = `<div class="empty-state"><p>${t('noFolder')}</p><button id="btn-open-folder-2" class="primary-btn">${t('openFolder')}</button></div>`;
      document.getElementById('btn-open-folder-2')?.addEventListener('click', () => window.api.openFolderDialog());
      return;
    }
    tree.forEach(item => {
      const el = document.createElement('div');
      if (item.isDirectory) {
        const fd = document.createElement('div');
        fd.className = 'tree-item'; fd.style.paddingLeft = (16 + depth * 16) + 'px';
        fd.dataset.path = item.path; fd.dataset.isDir = 'true';
        fd.innerHTML = `<span class="tree-chevron">▶</span><span class="tree-item-icon">📁</span><span class="tree-item-name">${esc(item.name)}</span>`;
        const ch = document.createElement('div'); ch.className = 'tree-children';
        fd.addEventListener('click', e => {
          e.stopPropagation();
          const isOpen = ch.classList.toggle('open');
          fd.querySelector('.tree-chevron').classList.toggle('open', isOpen);
          fd.querySelector('.tree-item-icon').textContent = isOpen ? '📂' : '📁';
          if (isOpen && !ch.children.length && item.children) renderFileTree(item.children, ch, depth + 1);
        });
        fd.addEventListener('contextmenu', e => { e.preventDefault(); showContextMenu(e, treeCtx(item)); });
        el.appendChild(fd); el.appendChild(ch);
        if (depth < 1 && item.children) renderFileTree(item.children, ch, depth + 1);
      } else {
        const fd = document.createElement('div');
        fd.className = 'tree-item'; fd.style.paddingLeft = (32 + depth * 16) + 'px';
        fd.dataset.path = item.path;
        fd.innerHTML = `<span class="tree-item-icon">${fileIcon(item.name)}</span><span class="tree-item-name">${esc(item.name)}</span>`;
        fd.addEventListener('click', () => openFile(item.path));
        fd.addEventListener('contextmenu', e => { e.preventDefault(); showContextMenu(e, treeCtx(item)); });
        el.appendChild(fd);
      }
      container.appendChild(el);
    });
  }

  function treeCtx(item) {
    const items = [];
    if (item.isDirectory) {
      items.push({ label: t('newFile'), action: () => createNewFileAt(item.path) });
      items.push({ label: t('newFolderPrompt'), action: () => createNewFolderAt(item.path) });
      items.push({ type: 'separator' });
    }
    items.push({ label: t('rename'), action: () => renameItem(item.path) });
    items.push({ label: t('delete'), action: () => deleteItem(item.path) });
    items.push({ type: 'separator' });
    items.push({ label: t('copyPath'), action: () => navigator.clipboard.writeText(item.path) });
    return items;
  }

  async function openFile(filePath) {
    const existing = tabs.find(t => t.filePath === filePath);
    if (existing) { activateTab(existing.id); return; }
    const result = await window.api.readFile(filePath);
    if (!result.success) { notify(result.error, 'error'); return; }
    const name = window.api.pathBasename(filePath);
    const ext = window.api.pathExtname(filePath).replace('.', '');
    const lang = extToLang(ext);
    const uri = monaco.Uri.file(filePath);
    let model = monaco.editor.getModel(uri);
    if (model) model.setValue(result.content); else model = monaco.editor.createModel(result.content, lang, uri);
    const tab = { id: 'tab-' + Date.now() + '-' + Math.random().toString(36).substr(2, 5), filePath, name, isModified: false, model };
    tabs.push(tab); activateTab(tab.id); renderTabs();
    document.getElementById('status-language').textContent = lang || 'Plain Text';
  }

  async function refreshFileTree() {
    if (!projectRoot) return;
    const r = await window.api.readDirectory(projectRoot);
    if (r.success) renderFileTree(r.tree, document.getElementById('file-tree'));
  }

  async function createNewFileAt(dir) {
    const name = prompt(t('newFilePrompt')); if (!name) return;
    const r = await window.api.createFile(window.api.pathJoin(dir, name));
    if (r.success) { refreshFileTree(); openFile(window.api.pathJoin(dir, name)); } else notify(r.error, 'error');
  }

  async function createNewFolderAt(dir) {
    const name = prompt(t('newFolderPrompt')); if (!name) return;
    const r = await window.api.createFolder(window.api.pathJoin(dir, name));
    if (r.success) refreshFileTree(); else notify(r.error, 'error');
  }

  async function deleteItem(p) {
    const r = await window.api.deletePath(p);
    if (r.success) { const tab = tabs.find(t => t.filePath === p); if (tab) closeTab(tab.id); refreshFileTree(); }
  }

  async function renameItem(p) {
    const oldName = window.api.pathBasename(p);
    const newName = prompt(t('rename'), oldName);
    if (!newName || newName === oldName) return;
    const newPath = window.api.pathJoin(window.api.pathDirname(p), newName);
    const r = await window.api.renamePath(p, newPath);
    if (r.success) {
      const tab = tabs.find(t => t.filePath === p);
      if (tab) { tab.filePath = newPath; tab.name = newName; renderTabs(); }
      refreshFileTree();
    } else notify(r.error, 'error');
  }

  // ═══════════ TABS ═══════════
  function renderTabs() {
    const container = document.getElementById('tabs-list'); container.innerHTML = '';
    tabs.forEach(tab => {
      const el = document.createElement('div');
      el.className = 'tab' + (tab.id === activeTabId ? ' active' : '') + (tab.isModified ? ' modified' : '');
      el.innerHTML = `<span class="tab-icon">${fileIcon(tab.name)}</span><span class="tab-name">${esc(tab.name)}</span><button class="tab-close">✕</button>`;
      el.addEventListener('click', e => { if (!e.target.classList.contains('tab-close')) activateTab(tab.id); });
      el.querySelector('.tab-close').addEventListener('click', e => { e.stopPropagation(); closeTab(tab.id); });
      el.addEventListener('contextmenu', e => {
        e.preventDefault();
        showContextMenu(e, [
          { label: t('closeTab'), action: () => closeTab(tab.id) },
          { label: t('closeOthers'), action: () => { tabs.filter(t => t.id !== tab.id).forEach(t => closeTab(t.id)); } },
          { label: t('closeAll'), action: () => { tabs.map(t => t.id).forEach(closeTab); } },
          { type: 'separator' },
          { label: t('copyPath'), action: () => navigator.clipboard.writeText(tab.filePath || '') },
        ]);
      });
      container.appendChild(el);
    });
  }

  function activateTab(tabId) {
    activeTabId = tabId;
    const tab = tabs.find(t => t.id === tabId); if (!tab) return;
    document.getElementById('welcome-screen').style.display = 'none';
    document.getElementById('settings-page').style.display = 'none';
    document.getElementById('monaco-editor').style.display = 'block';
    editor.setModel(tab.model); renderTabs();
    updateBreadcrumb(tab.filePath);
    document.getElementById('status-language').textContent = extToLang((tab.name || '').split('.').pop()) || 'Plain Text';
    document.querySelectorAll('.tree-item').forEach(el => el.classList.remove('selected'));
    if (tab.filePath) document.querySelector(`.tree-item[data-path="${CSS.escape(tab.filePath)}"]`)?.classList.add('selected');
  }

  function closeTab(tabId) {
    const idx = tabs.findIndex(t => t.id === tabId); if (idx === -1) return;
    tabs[idx].model?.dispose(); tabs.splice(idx, 1);
    if (activeTabId === tabId) {
      if (tabs.length > 0) activateTab(tabs[Math.min(idx, tabs.length - 1)].id);
      else { activeTabId = null; document.getElementById('monaco-editor').style.display = 'none'; document.getElementById('welcome-screen').style.display = 'flex'; document.getElementById('breadcrumb').innerHTML = ''; }
    }
    renderTabs();
  }

  function updateBreadcrumb(filePath) {
    const bc = document.getElementById('breadcrumb');
    if (!filePath) { bc.innerHTML = ''; return; }
    let rel = filePath;
    if (projectRoot && filePath.startsWith(projectRoot)) rel = filePath.substring(projectRoot.length + 1);
    const parts = rel.split(/[\/\\]/);
    bc.innerHTML = parts.map((p, i) => `<span class="breadcrumb-item">${esc(p)}</span>${i < parts.length - 1 ? '<span class="breadcrumb-separator">›</span>' : ''}`).join('');
  }

  async function saveCurrentFile() {
    const tab = tabs.find(t => t.id === activeTabId); if (!tab) return;
    const content = tab.model.getValue();
    if (tab.filePath) {
      const r = await window.api.saveFile(tab.filePath, content);
      if (r.success) { tab.isModified = false; renderTabs(); notify(t('fileSaved'), 'success'); }
      else notify(r.error, 'error');
    } else saveCurrentFileAs();
  }

  async function saveCurrentFileAs() {
    const tab = tabs.find(t => t.id === activeTabId); if (!tab) return;
    const r = await window.api.saveFileAs(tab.model.getValue(), tab.name);
    if (r.success) { tab.filePath = r.filePath; tab.name = window.api.pathBasename(r.filePath); tab.isModified = false; renderTabs(); updateBreadcrumb(tab.filePath); notify(t('fileSaved'), 'success'); }
  }

  function createNewFile() {
    const model = monaco.editor.createModel('', 'plaintext');
    const tab = { id: 'tab-' + Date.now(), filePath: null, name: 'Untitled', isModified: false, model };
    tabs.push(tab); activateTab(tab.id); renderTabs();
  }

  // ══════════════════════════════════════════════════════
  // TERMINAL — xterm.js + PTY (с fallback на exec)
  // ══════════════════════════════════════════════════════

  function initTerminalUI() {
    document.getElementById('btn-terminal-toggle').onclick = () => toggleTerminal();
    document.getElementById('btn-terminal-clear').onclick = () => clearTerminal();
  }

  async function toggleTerminal() {
    terminalVisible = !terminalVisible;
    document.getElementById('terminal-area').style.display = terminalVisible ? 'flex' : 'none';
    if (terminalVisible && !terminalId) {
      await createTerminal();
    }
    // Fit xterm if visible
    if (terminalVisible && xtermFitAddon) {
      setTimeout(() => {
        try { xtermFitAddon.fit(); } catch (e) {}
      }, 50);
    }
  }

  /**
   * Загрузить xterm.js динамически из node_modules
   */
  async function loadXterm() {
    if (xtermLoaded) return true;

    const xtermPath = window.api.getXtermPath();
    const fitPath = window.api.getXtermFitPath();

    return new Promise((resolve) => {
      // 1. Загрузить CSS
      const css = document.createElement('link');
      css.rel = 'stylesheet';
      css.href = `file:///${xtermPath.replace(/\\/g, '/')}/css/xterm.css`;
      document.head.appendChild(css);

      // 2. Загрузить JS
      const script = document.createElement('script');
      script.src = `file:///${xtermPath.replace(/\\/g, '/')}/lib/xterm.js`;
      script.onload = () => {
        // 3. Загрузить FitAddon
        const fitScript = document.createElement('script');
        fitScript.src = `file:///${fitPath.replace(/\\/g, '/')}/lib/xterm-addon-fit.js`;
        fitScript.onload = () => {
          xtermLoaded = true;
          console.log('✅ xterm.js loaded');
          resolve(true);
        };
        fitScript.onerror = () => {
          console.warn('⚠ xterm-addon-fit not found');
          xtermLoaded = true;
          resolve(true);
        };
        document.head.appendChild(fitScript);
      };
      script.onerror = () => {
        console.warn('⚠ xterm.js not found, using fallback terminal');
        resolve(false);
      };
      document.head.appendChild(script);
    });
  }

  async function createTerminal() {
    const container = document.getElementById('terminal-container');
    container.innerHTML = '';

    // Запросить PTY процесс
    const result = await window.api.terminalCreate();
    if (!result.success) { notify('Failed to create terminal', 'error'); return; }

    terminalId = result.id;
    terminalHasPty = result.pty;

    if (terminalHasPty) {
      // ═══ XTERM.JS + PTY ═══
      const xtermAvailable = await loadXterm();

      if (xtermAvailable && window.Terminal) {
        // Создать xterm.Terminal
        xtermInstance = new window.Terminal({
          theme: {
            background: '#11111b',
            foreground: '#cdd6f4',
            cursor: '#f5e0dc',
            cursorAccent: '#11111b',
            selectionBackground: '#45475a',
            black: '#45475a',
            red: '#f38ba8',
            green: '#a6e3a1',
            yellow: '#f9e2af',
            blue: '#89b4fa',
            magenta: '#cba6f7',
            cyan: '#94e2d5',
            white: '#bac2de',
            brightBlack: '#585b70',
            brightRed: '#f38ba8',
            brightGreen: '#a6e3a1',
            brightYellow: '#f9e2af',
            brightBlue: '#89b4fa',
            brightMagenta: '#cba6f7',
            brightCyan: '#94e2d5',
            brightWhite: '#a6adc8',
          },
          fontSize: settings['terminal.fontSize'] || 13,
          fontFamily: settings['terminal.fontFamily'] || "'Cascadia Code', 'Fira Code', 'JetBrains Mono', monospace",
          cursorBlink: true,
          cursorStyle: 'bar',
          scrollback: 5000,
          allowTransparency: true,
          drawBoldTextInBrightColors: true,
        });

        // FitAddon
        if (window.FitAddon) {
          xtermFitAddon = new window.FitAddon.FitAddon();
          xtermInstance.loadAddon(xtermFitAddon);
        }

        // Открыть в контейнере
        xtermInstance.open(container);

        // Fit to container
        setTimeout(() => {
          if (xtermFitAddon) {
            try {
              xtermFitAddon.fit();
              // Сообщить PTY о размере
              window.api.terminalResize(terminalId, xtermInstance.cols, xtermInstance.rows);
            } catch (e) {}
          }
        }, 100);

        // Ввод → PTY
        xtermInstance.onData((data) => {
          window.api.terminalInput(terminalId, data);
        });

        // Resize → PTY
        xtermInstance.onResize(({ cols, rows }) => {
          window.api.terminalResize(terminalId, cols, rows);
        });

        // PTY output → xterm
        window.api.on('terminal-data', ({ id, data }) => {
          if (id === terminalId && xtermInstance) {
            xtermInstance.write(data);
          }
        });

        // PTY exit
        window.api.on('terminal-exit', ({ id, exitCode }) => {
          if (id === terminalId && xtermInstance) {
            xtermInstance.writeln(`\r\n\x1b[33m[Process exited with code ${exitCode}]\x1b[0m`);
          }
        });

        // Auto-resize observer
        const resizeObserver = new ResizeObserver(() => {
          if (xtermFitAddon && terminalVisible) {
            try { xtermFitAddon.fit(); } catch (e) {}
          }
        });
        resizeObserver.observe(container);

        xtermInstance.focus();
        console.log('✅ xterm.js terminal created with PTY');
        return;
      }

      // xterm.js не загрузился — fallback с PTY, но без красивого рендера
      console.warn('xterm.js not available, using PTY with simple renderer');
      createPtyFallbackTerminal(container);
      return;
    }

    // ═══ NO PTY — SIMPLE EXEC TERMINAL ═══
    createSimpleTerminal(container);
  }

  /**
   * PTY есть, но xterm.js не загрузился — простой текстовый рендер
   */
  function createPtyFallbackTerminal(container) {
    const output = document.createElement('div');
    output.className = 'terminal-output';
    container.appendChild(output);

    // Input capture
    const hiddenInput = document.createElement('input');
    hiddenInput.style.cssText = 'position:absolute;opacity:0;width:0;height:0;';
    container.appendChild(hiddenInput);
    container.addEventListener('click', () => hiddenInput.focus());

    hiddenInput.addEventListener('keydown', (e) => {
      let data = '';
      if (e.key === 'Enter') data = '\r';
      else if (e.key === 'Backspace') data = '\x7f';
      else if (e.key === 'Tab') { data = '\t'; e.preventDefault(); }
      else if (e.key === 'ArrowUp') data = '\x1b[A';
      else if (e.key === 'ArrowDown') data = '\x1b[B';
      else if (e.key === 'ArrowRight') data = '\x1b[C';
      else if (e.key === 'ArrowLeft') data = '\x1b[D';
      else if (e.key === 'Home') data = '\x1b[H';
      else if (e.key === 'End') data = '\x1b[F';
      else if (e.ctrlKey && e.key === 'c') data = '\x03';
      else if (e.ctrlKey && e.key === 'd') data = '\x04';
      else if (e.ctrlKey && e.key === 'l') data = '\x0c';
      else if (e.key.length === 1) data = e.key;
      else return;
      if (data) window.api.terminalInput(terminalId, data);
    });

    // Better ANSI stripping for fallback
    function stripAnsi(str) {
      return str
        .replace(/\x1b\]([^\x07\x1b]*)(\x07|\x1b\\)/g, '')  // OSC
        .replace(/\x1b\[[0-9;?]*[a-zA-Z]/g, '')               // CSI
        .replace(/\x1b\[[0-9;?]*[~^$]/g, '')                   // CSI special
        .replace(/\x1b[^[\]].?/g, '')                           // Other ESC
        .replace(/\r\n/g, '\n')
        .replace(/\r(?!\n)/g, '\n')
        .replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g, '');
    }

    window.api.on('terminal-data', ({ id, data }) => {
      if (id === terminalId) {
        const cleaned = stripAnsi(data);
        if (cleaned) {
          output.textContent += cleaned;
          output.scrollTop = output.scrollHeight;
        }
      }
    });

    hiddenInput.focus();
  }

  /**
   * Полностью без PTY — простой exec-терминал
   */
  function createSimpleTerminal(container) {
    const output = document.createElement('div');
    output.className = 'terminal-output';
    const inputLine = document.createElement('div');
    inputLine.className = 'terminal-input-line';
    const prompt = document.createElement('span');
    prompt.className = 'terminal-prompt';
    const input = document.createElement('input');
    input.className = 'terminal-input'; input.type = 'text'; input.spellcheck = false;
    inputLine.appendChild(prompt); inputLine.appendChild(input);
    container.appendChild(output); container.appendChild(inputLine);

    async function initCwd() {
      terminalCwd = await window.api.getProjectPath() || await window.api.getHomePath();
      updatePrompt();
    }

    function updatePrompt() {
      const short = terminalCwd.split(/[\/\\]/).pop() || '~';
      prompt.textContent = `${short} $`;
    }

    initCwd();
    input.focus();
    container.addEventListener('click', () => input.focus());

    input.addEventListener('keydown', async (e) => {
      if (e.key === 'Enter') {
        const cmd = input.value.trim(); if (!cmd) return;
        commandHistory.push(cmd); historyIndex = commandHistory.length;
        output.innerHTML += `<div><span class="terminal-success">${esc(terminalCwd.split(/[\/\\]/).pop())} $</span> ${esc(cmd)}</div>`;
        input.value = '';

        if (cmd.startsWith('cd ')) {
          const dir = cmd.substring(3).trim();
          let newCwd = dir === '~' ? await window.api.getHomePath()
            : (dir.startsWith('/') || dir.match(/^[A-Z]:\\/i)) ? dir
            : window.api.pathJoin(terminalCwd, dir);
          const stats = await window.api.getFileStats(newCwd);
          if (stats.success && stats.stats.isDirectory) { terminalCwd = newCwd; updatePrompt(); }
          else output.innerHTML += `<div class="terminal-error">cd: ${esc(dir)}: No such directory</div>`;
          output.scrollTop = output.scrollHeight; return;
        }
        if (cmd === 'clear' || cmd === 'cls') { output.innerHTML = ''; return; }

        const r = await window.api.terminalExec(cmd, terminalCwd);
        if (r.stdout) output.innerHTML += `<div>${esc(r.stdout)}</div>`;
        if (r.stderr) output.innerHTML += `<div class="terminal-error">${esc(r.stderr)}</div>`;
        if (r.error && !r.stderr) output.innerHTML += `<div class="terminal-error">${esc(r.error)}</div>`;
        output.scrollTop = output.scrollHeight;
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (historyIndex > 0) { historyIndex--; input.value = commandHistory[historyIndex] || ''; }
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (historyIndex < commandHistory.length - 1) { historyIndex++; input.value = commandHistory[historyIndex] || ''; }
        else { historyIndex = commandHistory.length; input.value = ''; }
      }
    });
  }

  function clearTerminal() {
    if (xtermInstance) {
      xtermInstance.clear();
      if (terminalHasPty) window.api.terminalInput(terminalId, '\x0c');
    } else {
      const output = document.querySelector('#terminal-container .terminal-output');
      if (output) output.innerHTML = '';
    }
  }

  // ═══════════ SEARCH ═══════════
  let searchTimeout = null;
  function initSearch() {
    const input = document.getElementById('search-input');
    const replaceInput = document.getElementById('replace-input');
    const caseBtn = document.getElementById('search-case-btn');
    const wordBtn = document.getElementById('search-word-btn');
    const regexBtn = document.getElementById('search-regex-btn');
    let caseSensitive = false, wholeWord = false, useRegex = false;
    caseBtn.onclick = () => { caseSensitive = !caseSensitive; caseBtn.classList.toggle('active'); doSearch(); };
    wordBtn.onclick = () => { wholeWord = !wholeWord; wordBtn.classList.toggle('active'); doSearch(); };
    regexBtn.onclick = () => { useRegex = !useRegex; regexBtn.classList.toggle('active'); doSearch(); };
    input.addEventListener('input', () => { clearTimeout(searchTimeout); searchTimeout = setTimeout(doSearch, 300); });
    document.getElementById('btn-replace-all').onclick = () => {
      if (!editor) return;
      const model = editor.getModel(); if (!model) return;
      const matches = model.findMatches(input.value, true, useRegex, caseSensitive, wholeWord ? input.value : null, true);
      if (matches.length) editor.executeEdits('replace-all', matches.map(m => ({ range: m.range, text: replaceInput.value })));
    };
    async function doSearch() {
      const text = input.value.trim();
      const results_el = document.getElementById('search-results');
      const info = document.getElementById('search-info');
      if (!text || !projectRoot) { results_el.innerHTML = ''; info.textContent = ''; return; }
      info.textContent = t('loading');
      const results = await window.api.searchInFiles(text, projectRoot, { caseSensitive, wholeWord, regex: useRegex });
      info.textContent = `${results.length} ${t('results')}`;
      const grouped = {};
      results.forEach(r => { if (!grouped[r.filePath]) grouped[r.filePath] = []; grouped[r.filePath].push(r); });
      results_el.innerHTML = '';
      for (const [fp, items] of Object.entries(grouped)) {
        const rel = items[0].relativePath || window.api.pathBasename(fp);
        const fileEl = document.createElement('div'); fileEl.className = 'search-result-file';
        fileEl.innerHTML = `<span>${esc(rel)}</span><span class="search-result-count">${items.length}</span>`;
        fileEl.onclick = () => openFile(fp); results_el.appendChild(fileEl);
        items.forEach(item => {
          const el = document.createElement('div'); el.className = 'search-result-item';
          el.innerHTML = `<span class="search-result-line">${item.line}</span><span class="search-result-text">${hlSearch(esc(item.content), text)}</span>`;
          el.onclick = () => { openFile(fp).then(() => { setTimeout(() => { editor.revealLineInCenter(item.line); editor.setPosition({ lineNumber: item.line, column: 1 }); editor.focus(); }, 100); }); };
          results_el.appendChild(el);
        });
      }
      if (!results.length) results_el.innerHTML = `<div class="empty-state" style="padding:20px"><p>${t('noResults')}</p></div>`;
    }
  }
  function hlSearch(text, search) {
    if (!search) return text;
    return text.replace(new RegExp(`(${search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'), '<span class="search-highlight">$1</span>');
  }

  // ═══════════ COMMAND PALETTE ═══════════
  function initCommandPalette() {
    const palette = document.getElementById('command-palette');
    const input = document.getElementById('palette-input');
    const results = document.getElementById('palette-results');
    palette.querySelector('.palette-backdrop').onclick = () => toggleCommandPalette(false);
    const commands = [
      { label: t('newFile'), icon: '📄', shortcut: 'Ctrl+N', action: () => createNewFile() },
      { label: t('openFile'), icon: '📂', shortcut: 'Ctrl+O', action: () => window.api.openFileDialog() },
      { label: t('openFolder'), icon: '📁', shortcut: 'Ctrl+Shift+O', action: () => window.api.openFolderDialog() },
      { label: t('save'), icon: '💾', shortcut: 'Ctrl+S', action: () => saveCurrentFile() },
      { label: t('saveAs'), icon: '💾', shortcut: 'Ctrl+Shift+S', action: () => saveCurrentFileAs() },
      { label: t('find'), icon: '🔍', shortcut: 'Ctrl+F', action: () => editor?.getAction('actions.find')?.run() },
      { label: t('replace'), icon: '🔄', shortcut: 'Ctrl+H', action: () => editor?.getAction('editor.action.startFindReplaceAction')?.run() },
      { label: t('settings'), icon: '⚙️', shortcut: 'Ctrl+,', action: () => showSettingsPage() },
      { label: t('terminal'), icon: '💻', shortcut: 'Ctrl+`', action: () => toggleTerminal() },
      { label: 'Toggle Sidebar', icon: '📐', shortcut: 'Ctrl+B', action: () => toggleSidebar() },
      { label: 'Format Document', icon: '📝', action: () => editor?.getAction('editor.action.formatDocument')?.run() },
      { label: 'Reload Plugins', icon: '🧩', action: () => loadPlugins() },
    ];
    let selIdx = 0, filtered = commands;
    input.addEventListener('input', () => {
      const q = input.value.toLowerCase().replace(/^>\s*/, '');
      filtered = commands.filter(c => c.label.toLowerCase().includes(q));
      selIdx = 0; renderPR();
    });
    input.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowDown') { e.preventDefault(); selIdx = Math.min(selIdx + 1, filtered.length - 1); renderPR(); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); selIdx = Math.max(selIdx - 1, 0); renderPR(); }
      else if (e.key === 'Enter') { e.preventDefault(); if (filtered[selIdx]) { filtered[selIdx].action(); toggleCommandPalette(false); } }
      else if (e.key === 'Escape') toggleCommandPalette(false);
    });
    function renderPR() {
      results.innerHTML = '';
      filtered.forEach((cmd, i) => {
        const el = document.createElement('div');
        el.className = 'palette-item' + (i === selIdx ? ' selected' : '');
        el.innerHTML = `<span class="palette-item-icon">${cmd.icon || ''}</span><span class="palette-item-label">${esc(cmd.label)}</span>${cmd.shortcut ? `<span class="palette-item-shortcut">${cmd.shortcut}</span>` : ''}`;
        el.onclick = () => { cmd.action(); toggleCommandPalette(false); };
        el.onmouseenter = () => { selIdx = i; renderPR(); };
        results.appendChild(el);
      });
    }
    window._renderPalette = () => { filtered = commands; selIdx = 0; renderPR(); };
  }

  function toggleCommandPalette(show) {
    const palette = document.getElementById('command-palette');
    const input = document.getElementById('palette-input');
    if (show === undefined) show = palette.classList.contains('hidden');
    commandPaletteVisible = show;
    palette.classList.toggle('hidden', !show);
    if (show) { input.value = '> '; input.focus(); input.setSelectionRange(2, 2); window._renderPalette?.(); }
  }

  function toggleSidebar() {
    sidebarVisible = !sidebarVisible;
    document.getElementById('sidebar').classList.toggle('hidden', !sidebarVisible);
  }

  // ═══════════ CONTEXT MENU ═══════════
  function initContextMenu() {
    document.addEventListener('click', () => document.getElementById('context-menu').classList.add('hidden'));
  }
  function showContextMenu(event, items) {
    const menu = document.getElementById('context-menu');
    const list = menu.querySelector('.context-menu-list'); list.innerHTML = '';
    items.forEach(item => {
      if (item.type === 'separator') { list.innerHTML += '<div class="context-menu-separator"></div>'; return; }
      const el = document.createElement('div'); el.className = 'context-menu-item';
      el.innerHTML = `<span>${esc(item.label)}</span>${item.shortcut ? `<span class="context-menu-shortcut">${item.shortcut}</span>` : ''}`;
      el.onclick = () => { menu.classList.add('hidden'); item.action(); };
      list.appendChild(el);
    });
    menu.style.left = Math.min(event.clientX, window.innerWidth - 200) + 'px';
    menu.style.top = Math.min(event.clientY, window.innerHeight - items.length * 32) + 'px';
    menu.classList.remove('hidden');
  }

  // ═══════════ KEYBOARD ═══════════
  function initKeyboard() {
    document.addEventListener('keydown', (e) => {
      const ctrl = e.ctrlKey || e.metaKey;
      if (ctrl && e.shiftKey && e.key === 'P') { e.preventDefault(); toggleCommandPalette(); }
      else if (ctrl && e.key === 's') { e.preventDefault(); if (e.shiftKey) saveCurrentFileAs(); else saveCurrentFile(); }
      else if (ctrl && e.key === 'n') { e.preventDefault(); createNewFile(); }
      else if (ctrl && e.key === 'b') { e.preventDefault(); toggleSidebar(); }
      else if (ctrl && e.key === '`') { e.preventDefault(); toggleTerminal(); }
      else if (ctrl && e.key === ',') { e.preventDefault(); showSettingsPage(); }
      else if (ctrl && e.key === '=') { e.preventDefault(); changeZoom(1); }
      else if (ctrl && e.key === '-') { e.preventDefault(); changeZoom(-1); }
      else if (ctrl && e.key === 'w') { e.preventDefault(); if (activeTabId) closeTab(activeTabId); }
      else if (e.key === 'Escape') { if (commandPaletteVisible) toggleCommandPalette(false); document.getElementById('context-menu').classList.add('hidden'); }
    });
  }

  function changeZoom(d) {
    zoomLevel = Math.max(-5, Math.min(5, zoomLevel + d));
    applyZoom();
    settings['appearance.zoomLevel'] = zoomLevel;
    window.api.saveSettings(settings);
  }
  function applyZoom() { document.body.style.zoom = (1 + zoomLevel * 0.1).toFixed(2); }

  // ═══════════ WELCOME ═══════════
  function initWelcome() {
    document.getElementById('welcome-new-file')?.addEventListener('click', createNewFile);
    document.getElementById('welcome-open-file')?.addEventListener('click', () => window.api.openFileDialog());
    document.getElementById('welcome-open-folder')?.addEventListener('click', () => window.api.openFolderDialog());
  }

  // ═══════════ SETTINGS ═══════════
  function showSettingsPage() {
    document.getElementById('welcome-screen').style.display = 'none';
    document.getElementById('monaco-editor').style.display = 'none';
    document.getElementById('settings-page').style.display = 'block';
    renderSettingsPage();
    const btn = document.querySelector('.activity-btn[data-panel="settings-panel"]');
    if (btn) { document.querySelectorAll('.activity-btn').forEach(b => b.classList.remove('active')); btn.classList.add('active'); document.querySelectorAll('.sidebar-panel').forEach(p => p.classList.remove('active')); document.getElementById('panel-settings-panel')?.classList.add('active'); sidebarVisible = true; document.getElementById('sidebar').classList.remove('hidden'); }
  }

  function initSettingsPage() {
    document.querySelectorAll('.settings-nav-item').forEach(item => {
      item.addEventListener('click', () => { document.querySelectorAll('.settings-nav-item').forEach(i => i.classList.remove('active')); item.classList.add('active'); renderSettingsPage(item.dataset.section); });
    });
    document.getElementById('settings-search')?.addEventListener('input', (e) => renderSettingsPage(null, e.target.value));
  }

  function renderSettingsPage(section = 'editor', search = '') {
    const container = document.getElementById('settings-content'); container.innerHTML = '';
    const defs = getSettingsDefs();
    const filtered = defs.filter(s => search ? (s.label.toLowerCase().includes(search.toLowerCase()) || s.key.toLowerCase().includes(search.toLowerCase())) : s.section === section);
    if (section === 'about' && !search) { container.innerHTML = `<div class="settings-section"><div class="settings-section-title">${t('about')}</div><div style="padding:16px;white-space:pre-line;color:var(--text-dim);line-height:1.8">${t('aboutText')}</div></div>`; return; }
    const groups = {};
    filtered.forEach(s => { if (!groups[s.section]) groups[s.section] = []; groups[s.section].push(s); });
    for (const [sec, items] of Object.entries(groups)) {
      const sEl = document.createElement('div'); sEl.className = 'settings-section';
      sEl.innerHTML = `<div class="settings-section-title">${t(sec) || sec}</div>`;
      items.forEach(item => {
        const row = document.createElement('div'); row.className = 'setting-row';
        const info = document.createElement('div'); info.className = 'setting-info';
        info.innerHTML = `<div class="setting-label">${esc(item.label)}</div>${item.description ? `<div class="setting-description">${esc(item.description)}</div>` : ''}<div class="setting-id">${item.key}</div>`;
        const ctrl = document.createElement('div'); ctrl.className = 'setting-control';
        const val = settings[item.key] ?? item.default;
        if (item.type === 'boolean') {
          ctrl.innerHTML = `<label class="toggle-switch"><input type="checkbox" ${val ? 'checked' : ''}><span class="toggle-slider"></span></label>`;
          ctrl.querySelector('input').onchange = (e) => { settings[item.key] = e.target.checked; window.api.saveSettings(settings); updateEditorSettings(); };
        } else if (item.type === 'number') {
          const inp = document.createElement('input'); inp.type = 'number'; inp.value = val; inp.min = item.min || 0; inp.max = item.max || 100;
          inp.onchange = () => { settings[item.key] = parseInt(inp.value); window.api.saveSettings(settings); updateEditorSettings(); };
          ctrl.appendChild(inp);
        } else if (item.type === 'select') {
          const sel = document.createElement('select');
          (item.options || []).forEach(opt => { const o = document.createElement('option'); o.value = opt.value || opt; o.textContent = opt.label || opt; if ((opt.value || opt) === val) o.selected = true; sel.appendChild(o); });
          sel.onchange = () => { settings[item.key] = sel.value; window.api.saveSettings(settings); updateEditorSettings(); if (item.key === 'appearance.language') { currentLang = sel.value; applyI18n(); renderSettingsPage(section); } };
          ctrl.appendChild(sel);
        } else if (item.type === 'text') {
          const inp = document.createElement('input'); inp.type = 'text'; inp.value = val || '';
          inp.onchange = () => { settings[item.key] = inp.value; window.api.saveSettings(settings); updateEditorSettings(); };
          ctrl.appendChild(inp);
        }
        row.appendChild(info); row.appendChild(ctrl); sEl.appendChild(row);
      });
      container.appendChild(sEl);
    }
  }

  function getSettingsDefs() {
    return [
      { key: 'editor.fontSize', label: t('fontSize'), section: 'editor', type: 'number', default: 14, min: 8, max: 40 },
      { key: 'editor.fontFamily', label: t('fontFamily'), section: 'editor', type: 'text', default: "'Cascadia Code', monospace" },
      { key: 'editor.tabSize', label: t('tabSize'), section: 'editor', type: 'number', default: 2, min: 1, max: 8 },
      { key: 'editor.wordWrap', label: t('wordWrap'), section: 'editor', type: 'select', default: 'off', options: ['off', 'on', 'wordWrapColumn', 'bounded'] },
      { key: 'editor.minimap', label: t('minimap'), section: 'editor', type: 'boolean', default: true },
      { key: 'editor.lineNumbers', label: t('lineNumbers'), section: 'editor', type: 'boolean', default: true },
      { key: 'editor.bracketPairColorization', label: t('bracketColors'), section: 'editor', type: 'boolean', default: true },
      { key: 'editor.smoothScrolling', label: t('smoothScrolling'), section: 'editor', type: 'boolean', default: true },
      { key: 'editor.renderWhitespace', label: t('renderWhitespace'), section: 'editor', type: 'select', default: 'none', options: ['none', 'boundary', 'selection', 'all'] },
      { key: 'editor.cursorStyle', label: t('cursorStyle'), section: 'editor', type: 'select', default: 'line', options: ['line', 'block', 'underline'] },
      { key: 'editor.cursorBlinking', label: t('cursorBlinking'), section: 'editor', type: 'select', default: 'smooth', options: ['blink', 'smooth', 'phase', 'expand', 'solid'] },
      { key: 'editor.autoSave', label: t('autoSave'), section: 'editor', type: 'boolean', default: false },
      { key: 'editor.formatOnSave', label: t('formatOnSave'), section: 'editor', type: 'boolean', default: false },
      { key: 'appearance.language', label: t('language'), section: 'appearance', type: 'select', default: 'en', options: [{ value: 'en', label: 'English' }, { value: 'ru', label: 'Русский' }] },
      { key: 'appearance.zoomLevel', label: t('zoomLevel'), section: 'appearance', type: 'number', default: 0, min: -5, max: 5 },
      { key: 'terminal.fontSize', label: t('terminalFontSize'), section: 'terminal-settings', type: 'number', default: 13, min: 8, max: 30 },
      { key: 'terminal.shell', label: t('terminalShell'), section: 'terminal-settings', type: 'text', default: '' },
      { key: 'files.exclude', label: t('excludeFiles'), section: 'files', type: 'text', default: 'node_modules,.git,dist' },
      { key: 'plugins.serverUrl', label: t('serverUrl'), section: 'extensions-settings', type: 'text', default: 'https://antarctidum.itrypro.ru/plugins' },
    ];
  }

  // ═══════════ EXTENSIONS ═══════════
  function initExtensions() {
    document.getElementById('btn-refresh-extensions')?.addEventListener('click', loadExtensions);
    document.getElementById('extensions-search')?.addEventListener('input', e => {
      const q = e.target.value.toLowerCase();
      document.querySelectorAll('.extension-card').forEach(c => {
        c.style.display = (c.textContent.toLowerCase().includes(q)) ? 'flex' : 'none';
      });
    });
  }

  async function loadExtensions() {
    const iList = document.getElementById('installed-list');
    const mList = document.getElementById('marketplace-list');
    iList.innerHTML = mList.innerHTML = `<div class="marketplace-loading">${t('loading')}</div>`;
    installedPlugins = await window.api.getInstalledPlugins();
    iList.innerHTML = '';
    if (!installedPlugins.length) iList.innerHTML = '<div class="empty-state" style="padding:16px"><p>No plugins</p></div>';
    installedPlugins.forEach(p => {
      const c = document.createElement('div'); c.className = 'extension-card';
      c.innerHTML = `<div class="extension-icon">${p.icon || '🧩'}</div><div class="extension-info"><div class="extension-name">${esc(p.name)} <span class="ext-version">v${p.version}</span></div><div class="extension-description">${esc(p.description)}</div><div class="extension-author">${esc(p.author)}</div></div><div class="extension-actions"><button class="danger-btn btn-uninstall">${t('uninstall')}</button></div>`;
      c.querySelector('.btn-uninstall').onclick = async (e) => {
        e.stopPropagation();
        const r = await window.api.uninstallPlugin(p.id);
        if (r.success) { if (activePlugins.has(p.id)) { try { activePlugins.get(p.id)(); } catch (e) {} activePlugins.delete(p.id); } notify(t('pluginUninstalled'), 'success'); loadExtensions(); }
        else notify(r.error, 'error');
      };
      iList.appendChild(c);
    });
    try {
      const url = settings['plugins.serverUrl'] || 'https://antarctidum.itrypro.ru/plugins';
      const res = await fetch(url + '?action=list'); const data = await res.json();
      mList.innerHTML = '';
      (data.plugins || []).forEach(p => {
        const installed = installedPlugins.some(ip => ip.id === p.id);
        const c = document.createElement('div'); c.className = 'extension-card';
        c.innerHTML = `<div class="extension-icon">${p.icon || '🧩'}</div><div class="extension-info"><div class="extension-name">${esc(p.name)} <span class="ext-version">v${p.version || '1.0.0'}</span></div><div class="extension-description">${esc(p.description || '')}</div><div class="extension-author">${esc(p.author || 'Unknown')}</div></div><div class="extension-actions">${installed ? '<span class="extension-badge installed">✓</span>' : `<button class="primary-btn btn-install" style="padding:4px 12px;font-size:12px">${t('install')}</button>`}</div>`;
        if (!installed) {
          c.querySelector('.btn-install').onclick = async (ev) => {
            ev.stopPropagation(); ev.target.textContent = '...'; ev.target.disabled = true;
            try {
              const r = await fetch(url + '?action=download&id=' + encodeURIComponent(p.id));
              const d = await r.json(); if (!d.files) throw new Error('Invalid data');
              const ir = await window.api.installPlugin(p.id, d.files);
              if (ir.success) { notify(t('pluginInstalled'), 'success'); loadExtensions(); loadPlugins(); }
              else throw new Error(ir.error);
            } catch (err) { notify(err.message, 'error'); ev.target.textContent = t('install'); ev.target.disabled = false; }
          };
        }
        mList.appendChild(c);
      });
      if (!(data.plugins || []).length) mList.innerHTML = '<div class="empty-state" style="padding:16px"><p>No plugins</p></div>';
    } catch (e) { mList.innerHTML = `<div class="marketplace-error">${esc(e.message)}</div>`; }
  }

  // ═══════════ PLUGINS ═══════════
  async function loadPlugins() {
    for (const [, deact] of activePlugins) { try { deact(); } catch (e) {} }
    activePlugins.clear();
    document.getElementById('status-plugins').innerHTML = '';
    installedPlugins = await window.api.getInstalledPlugins();
    for (const plugin of installedPlugins) {
      if (!plugin.code) continue;
      try {
        const api = {
          editor: { getEditor: () => editor, getActiveModel: () => editor?.getModel(), insertText: (text) => { if (editor) { const sel = editor.getSelection(); editor.executeEdits('plugin', [{ range: sel, text }]); } }, getText: () => editor?.getModel()?.getValue() || '', onContentChange: (cb) => editor?.onDidChangeModelContent(cb) },
          ui: { notify: (msg, type) => notify(msg, type), addStatusItem: (text, onclick) => { const el = document.createElement('span'); el.className = 'status-item'; el.textContent = text; if (onclick) el.onclick = onclick; document.getElementById('status-plugins').appendChild(el); return { update: (t) => { el.textContent = t; }, remove: () => el.remove() }; } },
          settings: { get: (k) => settings[k], set: async (k, v) => { settings[k] = v; await window.api.saveSettings(settings); } },
          files: { readFile: (p) => window.api.readFile(p), saveFile: (p, c) => window.api.saveFile(p, c), getProjectPath: () => projectRoot }
        };
        const fn = new Function('api', plugin.code);
        const result = fn(api);
        activePlugins.set(plugin.id, typeof result === 'function' ? result : (result?.deactivate || (() => {})));
      } catch (err) { console.error(`Plugin error (${plugin.id}):`, err); }
    }
  }

  // ═══════════ IPC ═══════════
  function initIPC() {
    window.api.on('file-opened', ({ filePath, content }) => {
      const name = window.api.pathBasename(filePath);
      const lang = extToLang(window.api.pathExtname(filePath).replace('.', ''));
      const uri = monaco.Uri.file(filePath);
      let model = monaco.editor.getModel(uri);
      if (model) model.setValue(content); else model = monaco.editor.createModel(content, lang, uri);
      const existing = tabs.find(t => t.filePath === filePath);
      if (existing) { activateTab(existing.id); return; }
      const tab = { id: 'tab-' + Date.now(), filePath, name, isModified: false, model };
      tabs.push(tab); activateTab(tab.id); renderTabs();
    });
    window.api.on('folder-opened', ({ rootPath, tree }) => {
      projectRoot = rootPath;
      renderFileTree(tree, document.getElementById('file-tree'));
      document.querySelector('.titlebar-title').textContent = 'Antarctidum — ' + window.api.pathBasename(rootPath);
    });
    window.api.on('menu-action', (action) => {
      const map = { 'new-file': createNewFile, 'save': saveCurrentFile, 'save-as': saveCurrentFileAs, 'settings': showSettingsPage, 'find': () => editor?.getAction('actions.find')?.run(), 'replace': () => editor?.getAction('editor.action.startFindReplaceAction')?.run(), 'toggle-sidebar': toggleSidebar, 'toggle-terminal': toggleTerminal, 'zoom-in': () => changeZoom(1), 'zoom-out': () => changeZoom(-1) };
      map[action]?.();
    });
  }

  // ═══════════ RESIZE ═══════════
  function initResize() {
    const sr = document.getElementById('sidebar-resize');
    const tr = document.getElementById('terminal-resize');
    let sDrag = false, tDrag = false;
    sr.addEventListener('mousedown', e => { sDrag = true; sr.classList.add('active'); e.preventDefault(); });
    tr.addEventListener('mousedown', e => { tDrag = true; tr.classList.add('active'); e.preventDefault(); });
    document.addEventListener('mousemove', e => {
      if (sDrag) document.getElementById('sidebar').style.width = Math.max(150, Math.min(600, e.clientX - 48)) + 'px';
      if (tDrag) {
        const rect = document.getElementById('editor-area').getBoundingClientRect();
        const h = Math.max(100, Math.min(500, rect.bottom - e.clientY));
        document.getElementById('terminal-area').style.height = h + 'px';
        // Refit xterm
        if (xtermFitAddon) try { xtermFitAddon.fit(); } catch (e) {}
      }
    });
    document.addEventListener('mouseup', () => { sDrag = tDrag = false; sr.classList.remove('active'); tr.classList.remove('active'); });

    // Window resize → refit xterm
    window.addEventListener('resize', () => {
      if (xtermFitAddon && terminalVisible) {
        try { xtermFitAddon.fit(); } catch (e) {}
      }
    });
  }

  // ═══════════ NOTIFICATIONS ═══════════
  function notify(message, type = 'info') {
    const container = document.getElementById('notification-container');
    const el = document.createElement('div'); el.className = `notification ${type}`;
    el.innerHTML = `<span>${esc(message)}</span><button class="notification-close">✕</button>`;
    el.querySelector('.notification-close').onclick = () => el.remove();
    container.appendChild(el);
    setTimeout(() => el.remove(), 5000);
  }

  // ═══════════ HELPERS ═══════════
  function esc(s) { return s ? s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;') : ''; }

  function fileIcon(name) {
    const ext = (name || '').split('.').pop().toLowerCase();
    const m = { js: '📜', jsx: '⚛️', ts: '🔷', tsx: '⚛️', py: '🐍', rs: '🦀', go: '🐹', rb: '💎', java: '☕', c: '🔧', cpp: '🔧', h: '📋', html: '🌐', css: '🎨', scss: '🎨', json: '📋', xml: '📄', yaml: '📄', yml: '📄', md: '📝', txt: '📄', png: '🖼️', jpg: '🖼️', svg: '🖼️', sh: '💻', sql: '🗃️', env: '🔒', php: '🐘', lua: '🌙', dockerfile: '🐳', lock: '🔒', log: '📋' };
    return m[ext] || '📄';
  }

  function extToLang(ext) {
    const m = { js: 'javascript', jsx: 'javascript', ts: 'typescript', tsx: 'typescript', py: 'python', rs: 'rust', go: 'go', rb: 'ruby', java: 'java', c: 'c', cpp: 'cpp', h: 'c', hpp: 'cpp', cs: 'csharp', html: 'html', htm: 'html', css: 'css', scss: 'scss', less: 'less', json: 'json', xml: 'xml', yaml: 'yaml', yml: 'yaml', md: 'markdown', sh: 'shell', bash: 'shell', ps1: 'powershell', bat: 'bat', sql: 'sql', php: 'php', lua: 'lua', dockerfile: 'dockerfile', vue: 'html', ini: 'ini', env: 'ini', txt: 'plaintext', log: 'plaintext' };
    return m[(ext || '').toLowerCase()] || 'plaintext';
  }

  // ═══════════ START ═══════════
  document.addEventListener('DOMContentLoaded', init);

})();