// ═══════════════════════════════════════════
// ANTARCTIDUM v2.0 — Full App
// ═══════════════════════════════════════════

(function () {
  'use strict';

  // ═══ i18n ═══
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
      bracketColors: 'Bracket Colors', smoothScrolling: 'Smooth Scrolling',
      renderWhitespace: 'Render Whitespace', cursorStyle: 'Cursor Style',
      cursorBlinking: 'Cursor Blinking', formatOnSave: 'Format on Save',
      formatOnPaste: 'Format on Paste', serverUrl: 'Plugin Server URL',
      aboutText: 'Antarctidum — Modern Code Editor v2.0.0\nElectron + Monaco + xterm.js',
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
      fontSize: 'Размер шрифта', fontFamily: 'Шрифт', tabSize: 'Табуляция',
      wordWrap: 'Перенос строк', minimap: 'Миникарта', lineNumbers: 'Номера строк',
      autoSave: 'Автосохранение', theme: 'Тема', language: 'Язык',
      zoomLevel: 'Масштаб', excludeFiles: 'Исключить файлы',
      terminalFontSize: 'Шрифт терминала', terminalShell: 'Оболочка',
      bracketColors: 'Цветные скобки', smoothScrolling: 'Плавная прокрутка',
      renderWhitespace: 'Пробелы', cursorStyle: 'Стиль курсора',
      cursorBlinking: 'Мигание курсора', formatOnSave: 'Формат при сохранении',
      formatOnPaste: 'Формат при вставке', serverUrl: 'URL сервера плагинов',
      aboutText: 'Antarctidum — Редактор кода v2.0.0\nElectron + Monaco + xterm.js',
      copyPath: 'Копировать путь', closeTab: 'Закрыть', closeOthers: 'Закрыть другие', closeAll: 'Закрыть все',
    }
  };
  let currentLang = 'en', settings = {};
  function t(k) { return LANGS[currentLang]?.[k] || LANGS.en[k] || k; }
  function applyI18n() {
    document.querySelectorAll('[data-i18n]').forEach(el => { el.textContent = t(el.dataset.i18n); });
    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => { el.placeholder = t(el.dataset.i18nPlaceholder); });
  }

  // ═══ STATE ═══
  let editor = null, tabs = [], activeTabId = null, projectRoot = null;
  let commandPaletteVisible = false, terminalVisible = false, sidebarVisible = true;
  let zoomLevel = 0, installedPlugins = [], activePlugins = new Map(), autoSaveTimer = null;
  // Terminal
  let terminalId = null, terminalHasPty = false;
  let commandHistory = [], historyIndex = -1, terminalCwd = '';

  // ═══ INIT ═══
  async function init() {
    settings = await window.api.loadSettings();
    currentLang = settings['appearance.language'] || 'en';
    zoomLevel = settings['appearance.zoomLevel'] || 0;
    applyI18n(); applyZoom();
    await initMonaco();
    initWindowControls(); initActivityBar(); initSidebar();
    initTerminalUI(); initSearch(); initCommandPalette();
    initContextMenu(); initKeyboard(); initWelcome();
    initSettingsPage(); initExtensions(); initIPC(); initResize();
    await loadPlugins();
  }

  // ═══ MONACO ═══
  async function initMonaco() {
    const monacoPath = await window.api.getMonacoPath();
    const monacoUrl = `file:///${monacoPath.replace(/\\/g, '/')}`;
    return new Promise(resolve => {
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
              'editor.background': '#1e1e2e', 'editor.foreground': '#cdd6f4',
              'editor.lineHighlightBackground': '#313244', 'editor.selectionBackground': '#45475a',
              'editorCursor.foreground': '#f5e0dc', 'editorLineNumber.foreground': '#6c7086',
              'editorLineNumber.activeForeground': '#cdd6f4', 'editorBracketMatch.background': '#45475a',
              'editorBracketMatch.border': '#89b4fa', 'editor.findMatchBackground': '#f9e2af40',
              'minimap.background': '#181825', 'scrollbarSlider.background': '#45475a80',
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
            automaticLayout: true, padding: { top: 8 },
            suggestOnTriggerCharacters: true, quickSuggestions: true, folding: true, links: true,
          });
          editor.onDidChangeCursorPosition(() => {
            const p = editor.getPosition();
            document.getElementById('status-cursor').textContent = `Ln ${p.lineNumber}, Col ${p.column}`;
          });
          editor.onDidChangeModelContent(() => {
            if (activeTabId) {
              const tab = tabs.find(t => t.id === activeTabId);
              if (tab && !tab.isModified) { tab.isModified = true; renderTabs(); }
              if (settings['editor.autoSave'] && tab?.filePath) {
                clearTimeout(autoSaveTimer);
                autoSaveTimer = setTimeout(saveCurrentFile, settings['editor.autoSaveDelay'] || 1000);
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

  // ═══ WINDOW ═══
  function initWindowControls() {
    document.getElementById('btn-minimize').onclick = () => window.api.windowMinimize();
    document.getElementById('btn-maximize').onclick = () => window.api.windowMaximize();
    document.getElementById('btn-close').onclick = () => window.api.windowClose();
  }

  // ═══ ACTIVITY BAR ═══
  function initActivityBar() {
    document.querySelectorAll('.activity-btn[data-panel]').forEach(btn => {
      btn.addEventListener('click', () => {
        const panel = btn.dataset.panel;
        const wasActive = btn.classList.contains('active');
        document.querySelectorAll('.activity-btn').forEach(b => b.classList.remove('active'));
        if (wasActive) { sidebarVisible = !sidebarVisible; document.getElementById('sidebar').classList.toggle('hidden', !sidebarVisible); if (!sidebarVisible) return; }
        else { sidebarVisible = true; document.getElementById('sidebar').classList.remove('hidden'); }
        btn.classList.add('active');
        document.querySelectorAll('.sidebar-panel').forEach(p => p.classList.remove('active'));
        document.getElementById('panel-' + panel)?.classList.add('active');
        if (panel === 'settings-panel') showSettingsPage();
      });
    });
  }

  // ═══ SIDEBAR / FILE TREE ═══
  function initSidebar() {
    document.getElementById('btn-open-folder').onclick = () => window.api.openFolderDialog();
    document.getElementById('btn-new-file').onclick = () => projectRoot && createNewFileAt(projectRoot);
    document.getElementById('btn-new-folder').onclick = () => projectRoot && createNewFolderAt(projectRoot);
    document.getElementById('btn-refresh').onclick = () => refreshFileTree();
  }

  function renderFileTree(tree, container, depth = 0) {
    container.innerHTML = '';
    if (!tree?.length) {
      container.innerHTML = `<div class="empty-state"><p>${t('noFolder')}</p><button id="btn-of2" class="primary-btn">${t('openFolder')}</button></div>`;
      document.getElementById('btn-of2')?.addEventListener('click', () => window.api.openFolderDialog());
      return;
    }
    tree.forEach(item => {
      const el = document.createElement('div');
      if (item.isDirectory) {
        const fd = document.createElement('div'); fd.className = 'tree-item'; fd.style.paddingLeft = (16 + depth * 16) + 'px';
        fd.dataset.path = item.path;
        fd.innerHTML = `<span class="tree-chevron">▶</span><span class="tree-item-icon">📁</span><span class="tree-item-name">${esc(item.name)}</span>`;
        const ch = document.createElement('div'); ch.className = 'tree-children';
        fd.onclick = e => { e.stopPropagation(); const open = ch.classList.toggle('open'); fd.querySelector('.tree-chevron').classList.toggle('open', open); fd.querySelector('.tree-item-icon').textContent = open ? '📂' : '📁'; if (open && !ch.children.length && item.children) renderFileTree(item.children, ch, depth + 1); };
        fd.oncontextmenu = e => { e.preventDefault(); showContextMenu(e, treeCtx(item)); };
        el.appendChild(fd); el.appendChild(ch);
        if (depth < 1 && item.children) renderFileTree(item.children, ch, depth + 1);
      } else {
        const fd = document.createElement('div'); fd.className = 'tree-item'; fd.style.paddingLeft = (32 + depth * 16) + 'px';
        fd.innerHTML = `<span class="tree-item-icon">${fileIcon(item.name)}</span><span class="tree-item-name">${esc(item.name)}</span>`;
        fd.onclick = () => openFile(item.path);
        fd.oncontextmenu = e => { e.preventDefault(); showContextMenu(e, treeCtx(item)); };
        el.appendChild(fd);
      }
      container.appendChild(el);
    });
  }

  function treeCtx(item) {
    const r = [];
    if (item.isDirectory) { r.push({ label: t('newFile'), action: () => createNewFileAt(item.path) }); r.push({ label: t('newFolderPrompt'), action: () => createNewFolderAt(item.path) }); r.push({ type: 'separator' }); }
    r.push({ label: t('rename'), action: () => renameItem(item.path) });
    r.push({ label: t('delete'), action: () => deleteItem(item.path) });
    r.push({ type: 'separator' });
    r.push({ label: t('copyPath'), action: () => navigator.clipboard.writeText(item.path) });
    return r;
  }

  async function openFile(filePath) {
    const existing = tabs.find(t => t.filePath === filePath);
    if (existing) { activateTab(existing.id); return; }
    const result = await window.api.readFile(filePath);
    if (!result.success) { notify(result.error, 'error'); return; }
    const name = window.api.pathBasename(filePath), ext = window.api.pathExtname(filePath).replace('.', ''), lang = extToLang(ext);
    const uri = monaco.Uri.file(filePath);
    let model = monaco.editor.getModel(uri);
    if (model) model.setValue(result.content); else model = monaco.editor.createModel(result.content, lang, uri);
    const tab = { id: 'tab-' + Date.now() + '-' + Math.random().toString(36).substr(2, 5), filePath, name, isModified: false, model };
    tabs.push(tab); activateTab(tab.id); renderTabs();
    document.getElementById('status-language').textContent = lang || 'Plain Text';
  }

  async function refreshFileTree() { if (!projectRoot) return; const r = await window.api.readDirectory(projectRoot); if (r.success) renderFileTree(r.tree, document.getElementById('file-tree')); }
  async function createNewFileAt(dir) { const n = prompt(t('newFilePrompt')); if (!n) return; const r = await window.api.createFile(window.api.pathJoin(dir, n)); if (r.success) { refreshFileTree(); openFile(window.api.pathJoin(dir, n)); } else notify(r.error, 'error'); }
  async function createNewFolderAt(dir) { const n = prompt(t('newFolderPrompt')); if (!n) return; const r = await window.api.createFolder(window.api.pathJoin(dir, n)); if (r.success) refreshFileTree(); else notify(r.error, 'error'); }
  async function deleteItem(p) { const r = await window.api.deletePath(p); if (r.success) { const tab = tabs.find(t => t.filePath === p); if (tab) closeTab(tab.id); refreshFileTree(); } }
  async function renameItem(p) {
    const oldName = window.api.pathBasename(p), newName = prompt(t('rename'), oldName);
    if (!newName || newName === oldName) return;
    const np = window.api.pathJoin(window.api.pathDirname(p), newName);
    const r = await window.api.renamePath(p, np);
    if (r.success) { const tab = tabs.find(t => t.filePath === p); if (tab) { tab.filePath = np; tab.name = newName; renderTabs(); } refreshFileTree(); }
    else notify(r.error, 'error');
  }

  // ═══ TABS ═══
  function renderTabs() {
    const c = document.getElementById('tabs-list'); c.innerHTML = '';
    tabs.forEach(tab => {
      const el = document.createElement('div');
      el.className = 'tab' + (tab.id === activeTabId ? ' active' : '') + (tab.isModified ? ' modified' : '');
      el.innerHTML = `<span class="tab-icon">${fileIcon(tab.name)}</span><span class="tab-name">${esc(tab.name)}</span><button class="tab-close">✕</button>`;
      el.onclick = e => { if (!e.target.classList.contains('tab-close')) activateTab(tab.id); };
      el.querySelector('.tab-close').onclick = e => { e.stopPropagation(); closeTab(tab.id); };
      el.oncontextmenu = e => { e.preventDefault(); showContextMenu(e, [
        { label: t('closeTab'), action: () => closeTab(tab.id) },
        { label: t('closeOthers'), action: () => tabs.filter(x => x.id !== tab.id).forEach(x => closeTab(x.id)) },
        { label: t('closeAll'), action: () => tabs.map(x => x.id).forEach(closeTab) },
        { type: 'separator' },
        { label: t('copyPath'), action: () => navigator.clipboard.writeText(tab.filePath || '') },
      ]); };
      c.appendChild(el);
    });
  }

  function activateTab(id) {
    activeTabId = id; const tab = tabs.find(t => t.id === id); if (!tab) return;
    document.getElementById('welcome-screen').style.display = 'none';
    document.getElementById('settings-page').style.display = 'none';
    document.getElementById('monaco-editor').style.display = 'block';
    editor.setModel(tab.model); renderTabs(); updateBreadcrumb(tab.filePath);
    document.getElementById('status-language').textContent = extToLang((tab.name || '').split('.').pop()) || 'Plain Text';
    document.querySelectorAll('.tree-item').forEach(el => el.classList.remove('selected'));
    if (tab.filePath) document.querySelector(`.tree-item[data-path="${CSS.escape(tab.filePath)}"]`)?.classList.add('selected');
  }

  function closeTab(id) {
    const idx = tabs.findIndex(t => t.id === id); if (idx === -1) return;
    tabs[idx].model?.dispose(); tabs.splice(idx, 1);
    if (activeTabId === id) {
      if (tabs.length) activateTab(tabs[Math.min(idx, tabs.length - 1)].id);
      else { activeTabId = null; document.getElementById('monaco-editor').style.display = 'none'; document.getElementById('welcome-screen').style.display = 'flex'; document.getElementById('breadcrumb').innerHTML = ''; }
    }
    renderTabs();
  }

  function updateBreadcrumb(fp) {
    const bc = document.getElementById('breadcrumb');
    if (!fp) { bc.innerHTML = ''; return; }
    let rel = fp; if (projectRoot && fp.startsWith(projectRoot)) rel = fp.substring(projectRoot.length + 1);
    bc.innerHTML = rel.split(/[\/\\]/).map((p, i, a) => `<span class="breadcrumb-item">${esc(p)}</span>${i < a.length - 1 ? '<span class="breadcrumb-separator">›</span>' : ''}`).join('');
  }

  async function saveCurrentFile() {
    const tab = tabs.find(t => t.id === activeTabId); if (!tab) return;
    if (tab.filePath) {
      const r = await window.api.saveFile(tab.filePath, tab.model.getValue());
      if (r.success) { tab.isModified = false; renderTabs(); notify(t('fileSaved'), 'success'); } else notify(r.error, 'error');
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

  // ══════════════════════════════════════════
  // TERMINAL — xterm.js через preload bridge
  // ══════════════════════════════════════════

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
    // Refit xterm when shown
    if (terminalVisible && window.xterm.available) {
      setTimeout(() => window.xterm.fit(), 50);
    }
  }

  async function createTerminal() {
    const container = document.getElementById('terminal-container');
    container.innerHTML = '';

    // Запросить PTY
    const result = await window.api.terminalCreate();
    if (!result.success) { notify('Failed to create terminal', 'error'); return; }

    terminalId = result.id;
    terminalHasPty = result.pty;

    if (terminalHasPty && window.xterm.available) {
      // ═══ XTERM.JS + PTY — полноценный терминал! ═══

      // Catppuccin Mocha theme для xterm
      const created = window.xterm.create('terminal-container', {
        theme: {
          background: '#11111b',
          foreground: '#cdd6f4',
          cursor: '#f5e0dc',
          cursorAccent: '#11111b',
          selectionBackground: '#45475a',
          selectionForeground: '#cdd6f4',
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
        fontFamily: "'Cascadia Code', 'Fira Code', 'JetBrains Mono', 'Consolas', monospace",
        cursorBlink: true,
        cursorStyle: 'bar',
        scrollback: 5000,
        allowTransparency: true,
        drawBoldTextInBrightColors: true,
      });

      if (!created) {
        console.error('Failed to create xterm instance');
        createSimpleTerminal(container);
        return;
      }

      // User types → PTY
      window.xterm.onData((data) => {
        window.api.terminalInput(terminalId, data);
      });

      // Resize → PTY
      window.xterm.onResize((cols, rows) => {
        window.api.terminalResize(terminalId, cols, rows);
      });

      // PTY output → xterm
      window.api.on('terminal-data', ({ id, data }) => {
        if (id === terminalId) {
          window.xterm.write(data);
        }
      });

      // PTY exit
      window.api.on('terminal-exit', ({ id, exitCode }) => {
        if (id === terminalId) {
          window.xterm.writeln(`\r\n\x1b[33m[Process exited: ${exitCode}]\x1b[0m`);
        }
      });

      // Initial resize
      setTimeout(() => {
        window.xterm.fit();
        window.api.terminalResize(terminalId, window.xterm.getCols(), window.xterm.getRows());
      }, 200);

      window.xterm.focus();
      console.log('✅ Terminal: xterm.js + PTY');
      return;
    }

    // ═══ FALLBACK: простой exec-терминал ═══
    console.warn('⚠ Using fallback terminal (no PTY or no xterm.js)');
    createSimpleTerminal(container);
  }

  function createSimpleTerminal(container) {
    container.innerHTML = '';
    const output = document.createElement('div'); output.className = 'terminal-output';
    const inputLine = document.createElement('div'); inputLine.className = 'terminal-input-line';
    const prompt = document.createElement('span'); prompt.className = 'terminal-prompt';
    const input = document.createElement('input'); input.className = 'terminal-input'; input.spellcheck = false;
    inputLine.appendChild(prompt); inputLine.appendChild(input);
    container.appendChild(output); container.appendChild(inputLine);

    (async () => { terminalCwd = await window.api.getProjectPath() || await window.api.getHomePath(); updatePrompt(); })();
    function updatePrompt() { prompt.textContent = `${terminalCwd.split(/[\/\\]/).pop() || '~'} $`; }
    input.focus(); container.onclick = () => input.focus();

    input.onkeydown = async (e) => {
      if (e.key === 'Enter') {
        const cmd = input.value.trim(); if (!cmd) return;
        commandHistory.push(cmd); historyIndex = commandHistory.length;
        output.innerHTML += `<div><span class="terminal-success">${esc(terminalCwd.split(/[\/\\]/).pop())} $</span> ${esc(cmd)}</div>`;
        input.value = '';
        if (cmd.startsWith('cd ')) {
          const dir = cmd.substring(3).trim();
          let nc = dir === '~' ? await window.api.getHomePath() : (dir.match(/^[A-Z]:|^\//i) ? dir : window.api.pathJoin(terminalCwd, dir));
          const st = await window.api.getFileStats(nc);
          if (st.success && st.stats.isDirectory) { terminalCwd = nc; updatePrompt(); } else output.innerHTML += `<div class="terminal-error">cd: no such directory</div>`;
          output.scrollTop = output.scrollHeight; return;
        }
        if (cmd === 'clear' || cmd === 'cls') { output.innerHTML = ''; return; }
        const r = await window.api.terminalExec(cmd, terminalCwd);
        if (r.stdout) output.innerHTML += `<div>${esc(r.stdout)}</div>`;
        if (r.stderr) output.innerHTML += `<div class="terminal-error">${esc(r.stderr)}</div>`;
        if (r.error && !r.stderr) output.innerHTML += `<div class="terminal-error">${esc(r.error)}</div>`;
        output.scrollTop = output.scrollHeight;
      } else if (e.key === 'ArrowUp') { e.preventDefault(); if (historyIndex > 0) input.value = commandHistory[--historyIndex] || ''; }
      else if (e.key === 'ArrowDown') { e.preventDefault(); input.value = (++historyIndex < commandHistory.length) ? commandHistory[historyIndex] : ''; historyIndex = Math.min(historyIndex, commandHistory.length); }
    };
  }

  function clearTerminal() {
    if (window.xterm.available && terminalHasPty) {
      window.xterm.clear();
      window.api.terminalInput(terminalId, process.platform === 'win32' ? 'cls\r' : '\x0c');
    } else {
      const o = document.querySelector('#terminal-container .terminal-output');
      if (o) o.innerHTML = '';
    }
  }

  // ═══ SEARCH ═══
  let searchTimeout = null;
  function initSearch() {
    const inp = document.getElementById('search-input'), repl = document.getElementById('replace-input');
    const cBtn = document.getElementById('search-case-btn'), wBtn = document.getElementById('search-word-btn'), rBtn = document.getElementById('search-regex-btn');
    let cs = false, ww = false, rx = false;
    cBtn.onclick = () => { cs = !cs; cBtn.classList.toggle('active'); doSearch(); };
    wBtn.onclick = () => { ww = !ww; wBtn.classList.toggle('active'); doSearch(); };
    rBtn.onclick = () => { rx = !rx; rBtn.classList.toggle('active'); doSearch(); };
    inp.oninput = () => { clearTimeout(searchTimeout); searchTimeout = setTimeout(doSearch, 300); };
    document.getElementById('btn-replace-all').onclick = () => {
      if (!editor) return; const m = editor.getModel(); if (!m) return;
      const matches = m.findMatches(inp.value, true, rx, cs, ww ? inp.value : null, true);
      if (matches.length) editor.executeEdits('replace-all', matches.map(m => ({ range: m.range, text: repl.value })));
    };
    async function doSearch() {
      const text = inp.value.trim(), rEl = document.getElementById('search-results'), info = document.getElementById('search-info');
      if (!text || !projectRoot) { rEl.innerHTML = ''; info.textContent = ''; return; }
      info.textContent = t('loading');
      const results = await window.api.searchInFiles(text, projectRoot, { caseSensitive: cs, wholeWord: ww, regex: rx });
      info.textContent = `${results.length} ${t('results')}`;
      const grouped = {}; results.forEach(r => { if (!grouped[r.filePath]) grouped[r.filePath] = []; grouped[r.filePath].push(r); });
      rEl.innerHTML = '';
      for (const [fp, items] of Object.entries(grouped)) {
        const fEl = document.createElement('div'); fEl.className = 'search-result-file';
        fEl.innerHTML = `<span>${esc(items[0].relativePath)}</span><span class="search-result-count">${items.length}</span>`;
        fEl.onclick = () => openFile(fp); rEl.appendChild(fEl);
        items.forEach(item => {
          const el = document.createElement('div'); el.className = 'search-result-item';
          el.innerHTML = `<span class="search-result-line">${item.line}</span><span class="search-result-text">${hlSearch(esc(item.content), text)}</span>`;
          el.onclick = () => { openFile(fp).then(() => setTimeout(() => { editor.revealLineInCenter(item.line); editor.setPosition({ lineNumber: item.line, column: 1 }); editor.focus(); }, 100)); };
          rEl.appendChild(el);
        });
      }
      if (!results.length) rEl.innerHTML = `<div class="empty-state" style="padding:20px"><p>${t('noResults')}</p></div>`;
    }
  }
  function hlSearch(t, s) { if (!s) return t; return t.replace(new RegExp(`(${s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'), '<span class="search-highlight">$1</span>'); }

  // ═══ COMMAND PALETTE ═══
  function initCommandPalette() {
    const pal = document.getElementById('command-palette'), inp = document.getElementById('palette-input'), res = document.getElementById('palette-results');
    pal.querySelector('.palette-backdrop').onclick = () => toggleCommandPalette(false);
    const cmds = [
      { label: t('newFile'), icon: '📄', shortcut: 'Ctrl+N', action: createNewFile },
      { label: t('openFile'), icon: '📂', shortcut: 'Ctrl+O', action: () => window.api.openFileDialog() },
      { label: t('openFolder'), icon: '📁', shortcut: 'Ctrl+Shift+O', action: () => window.api.openFolderDialog() },
      { label: t('save'), icon: '💾', shortcut: 'Ctrl+S', action: saveCurrentFile },
      { label: t('saveAs'), icon: '💾', shortcut: 'Ctrl+Shift+S', action: saveCurrentFileAs },
      { label: t('find'), icon: '🔍', shortcut: 'Ctrl+F', action: () => editor?.getAction('actions.find')?.run() },
      { label: t('replace'), icon: '🔄', shortcut: 'Ctrl+H', action: () => editor?.getAction('editor.action.startFindReplaceAction')?.run() },
      { label: t('settings'), icon: '⚙️', shortcut: 'Ctrl+,', action: showSettingsPage },
      { label: t('terminal'), icon: '💻', shortcut: 'Ctrl+`', action: toggleTerminal },
      { label: 'Toggle Sidebar', icon: '📐', shortcut: 'Ctrl+B', action: toggleSidebar },
      { label: 'Format Document', icon: '📝', action: () => editor?.getAction('editor.action.formatDocument')?.run() },
      { label: 'Reload Plugins', icon: '🧩', action: loadPlugins },
    ];
    let si = 0, filtered = cmds;
    inp.oninput = () => { const q = inp.value.toLowerCase().replace(/^>\s*/, ''); filtered = cmds.filter(c => c.label.toLowerCase().includes(q)); si = 0; render(); };
    inp.onkeydown = (e) => { if (e.key === 'ArrowDown') { e.preventDefault(); si = Math.min(si + 1, filtered.length - 1); render(); } else if (e.key === 'ArrowUp') { e.preventDefault(); si = Math.max(si - 1, 0); render(); } else if (e.key === 'Enter') { e.preventDefault(); filtered[si]?.action(); toggleCommandPalette(false); } else if (e.key === 'Escape') toggleCommandPalette(false); };
    function render() { res.innerHTML = ''; filtered.forEach((c, i) => { const el = document.createElement('div'); el.className = 'palette-item' + (i === si ? ' selected' : ''); el.innerHTML = `<span class="palette-item-icon">${c.icon || ''}</span><span class="palette-item-label">${esc(c.label)}</span>${c.shortcut ? `<span class="palette-item-shortcut">${c.shortcut}</span>` : ''}`; el.onclick = () => { c.action(); toggleCommandPalette(false); }; el.onmouseenter = () => { si = i; render(); }; res.appendChild(el); }); }
    window._rp = () => { filtered = cmds; si = 0; render(); };
  }
  function toggleCommandPalette(show) { const p = document.getElementById('command-palette'), i = document.getElementById('palette-input'); if (show === undefined) show = p.classList.contains('hidden'); commandPaletteVisible = show; p.classList.toggle('hidden', !show); if (show) { i.value = '> '; i.focus(); i.setSelectionRange(2, 2); window._rp?.(); } }
  function toggleSidebar() { sidebarVisible = !sidebarVisible; document.getElementById('sidebar').classList.toggle('hidden', !sidebarVisible); }

  // ═══ CONTEXT MENU ═══
  function initContextMenu() { document.addEventListener('click', () => document.getElementById('context-menu').classList.add('hidden')); }
  function showContextMenu(ev, items) {
    const m = document.getElementById('context-menu'), l = m.querySelector('.context-menu-list'); l.innerHTML = '';
    items.forEach(it => { if (it.type === 'separator') { l.innerHTML += '<div class="context-menu-separator"></div>'; return; } const el = document.createElement('div'); el.className = 'context-menu-item'; el.innerHTML = `<span>${esc(it.label)}</span>${it.shortcut ? `<span class="context-menu-shortcut">${it.shortcut}</span>` : ''}`; el.onclick = () => { m.classList.add('hidden'); it.action(); }; l.appendChild(el); });
    m.style.left = Math.min(ev.clientX, innerWidth - 200) + 'px'; m.style.top = Math.min(ev.clientY, innerHeight - items.length * 32) + 'px'; m.classList.remove('hidden');
  }

  // ═══ KEYBOARD ═══
  function initKeyboard() {
    document.addEventListener('keydown', e => {
      const c = e.ctrlKey || e.metaKey;
      if (c && e.shiftKey && e.key === 'P') { e.preventDefault(); toggleCommandPalette(); }
      else if (c && e.key === 's') { e.preventDefault(); e.shiftKey ? saveCurrentFileAs() : saveCurrentFile(); }
      else if (c && e.key === 'n') { e.preventDefault(); createNewFile(); }
      else if (c && e.key === 'b') { e.preventDefault(); toggleSidebar(); }
      else if (c && e.key === '`') { e.preventDefault(); toggleTerminal(); }
      else if (c && e.key === ',') { e.preventDefault(); showSettingsPage(); }
      else if (c && e.key === '=') { e.preventDefault(); changeZoom(1); }
      else if (c && e.key === '-') { e.preventDefault(); changeZoom(-1); }
      else if (c && e.key === 'w') { e.preventDefault(); if (activeTabId) closeTab(activeTabId); }
      else if (e.key === 'Escape') { if (commandPaletteVisible) toggleCommandPalette(false); document.getElementById('context-menu').classList.add('hidden'); }
    });
  }
  function changeZoom(d) { zoomLevel = Math.max(-5, Math.min(5, zoomLevel + d)); applyZoom(); settings['appearance.zoomLevel'] = zoomLevel; window.api.saveSettings(settings); }
  function applyZoom() { document.body.style.zoom = (1 + zoomLevel * 0.1).toFixed(2); }

  // ═══ WELCOME ═══
  function initWelcome() {
    document.getElementById('welcome-new-file')?.addEventListener('click', createNewFile);
    document.getElementById('welcome-open-file')?.addEventListener('click', () => window.api.openFileDialog());
    document.getElementById('welcome-open-folder')?.addEventListener('click', () => window.api.openFolderDialog());
  }

  // ═══ SETTINGS ═══
  function showSettingsPage() {
    document.getElementById('welcome-screen').style.display = 'none'; document.getElementById('monaco-editor').style.display = 'none';
    document.getElementById('settings-page').style.display = 'block'; renderSettingsPage();
    const btn = document.querySelector('.activity-btn[data-panel="settings-panel"]');
    if (btn) { document.querySelectorAll('.activity-btn').forEach(b => b.classList.remove('active')); btn.classList.add('active'); document.querySelectorAll('.sidebar-panel').forEach(p => p.classList.remove('active')); document.getElementById('panel-settings-panel')?.classList.add('active'); sidebarVisible = true; document.getElementById('sidebar').classList.remove('hidden'); }
  }
  function initSettingsPage() {
    document.querySelectorAll('.settings-nav-item').forEach(it => it.addEventListener('click', () => { document.querySelectorAll('.settings-nav-item').forEach(i => i.classList.remove('active')); it.classList.add('active'); renderSettingsPage(it.dataset.section); }));
    document.getElementById('settings-search')?.addEventListener('input', e => renderSettingsPage(null, e.target.value));
  }
  function renderSettingsPage(section = 'editor', search = '') {
    const c = document.getElementById('settings-content'); c.innerHTML = '';
    const defs = getSettingsDefs();
    const filtered = defs.filter(s => search ? (s.label + s.key).toLowerCase().includes(search.toLowerCase()) : s.section === section);
    if (section === 'about' && !search) { c.innerHTML = `<div class="settings-section"><div class="settings-section-title">${t('about')}</div><div style="padding:16px;white-space:pre-line;color:var(--text-dim);line-height:1.8">${t('aboutText')}</div></div>`; return; }
    const groups = {}; filtered.forEach(s => { (groups[s.section] = groups[s.section] || []).push(s); });
    for (const [sec, items] of Object.entries(groups)) {
      const sEl = document.createElement('div'); sEl.className = 'settings-section'; sEl.innerHTML = `<div class="settings-section-title">${t(sec) || sec}</div>`;
      items.forEach(item => {
        const row = document.createElement('div'); row.className = 'setting-row';
        const info = document.createElement('div'); info.className = 'setting-info';
        info.innerHTML = `<div class="setting-label">${esc(item.label)}</div>${item.description ? `<div class="setting-description">${esc(item.description)}</div>` : ''}<div class="setting-id">${item.key}</div>`;
        const ctrl = document.createElement('div'); ctrl.className = 'setting-control';
        const val = settings[item.key] ?? item.default;
        if (item.type === 'boolean') { ctrl.innerHTML = `<label class="toggle-switch"><input type="checkbox" ${val ? 'checked' : ''}><span class="toggle-slider"></span></label>`; ctrl.querySelector('input').onchange = e => { settings[item.key] = e.target.checked; window.api.saveSettings(settings); updateEditorSettings(); }; }
        else if (item.type === 'number') { const i = document.createElement('input'); i.type = 'number'; i.value = val; i.min = item.min || 0; i.max = item.max || 100; i.onchange = () => { settings[item.key] = parseInt(i.value); window.api.saveSettings(settings); updateEditorSettings(); }; ctrl.appendChild(i); }
        else if (item.type === 'select') { const s = document.createElement('select'); (item.options || []).forEach(o => { const op = document.createElement('option'); op.value = o.value || o; op.textContent = o.label || o; if ((o.value || o) === val) op.selected = true; s.appendChild(op); }); s.onchange = () => { settings[item.key] = s.value; window.api.saveSettings(settings); updateEditorSettings(); if (item.key === 'appearance.language') { currentLang = s.value; applyI18n(); renderSettingsPage(section); } }; ctrl.appendChild(s); }
        else if (item.type === 'text') { const i = document.createElement('input'); i.type = 'text'; i.value = val || ''; i.onchange = () => { settings[item.key] = i.value; window.api.saveSettings(settings); updateEditorSettings(); }; ctrl.appendChild(i); }
        row.appendChild(info); row.appendChild(ctrl); sEl.appendChild(row);
      });
      c.appendChild(sEl);
    }
  }
  function getSettingsDefs() { return [
    { key: 'editor.fontSize', label: t('fontSize'), section: 'editor', type: 'number', default: 14, min: 8, max: 40 },
    { key: 'editor.fontFamily', label: t('fontFamily'), section: 'editor', type: 'text', default: "'Cascadia Code', monospace" },
    { key: 'editor.tabSize', label: t('tabSize'), section: 'editor', type: 'number', default: 2, min: 1, max: 8 },
    { key: 'editor.wordWrap', label: t('wordWrap'), section: 'editor', type: 'select', default: 'off', options: ['off', 'on', 'bounded'] },
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
    { key: 'terminal.shell', label: t('terminalShell'), section: 'terminal-settings', type: 'text', default: '', description: 'Empty = default' },
    { key: 'files.exclude', label: t('excludeFiles'), section: 'files', type: 'text', default: 'node_modules,.git,dist' },
    { key: 'plugins.serverUrl', label: t('serverUrl'), section: 'extensions-settings', type: 'text', default: 'https://antarctidum.itrypro.ru/plugins' },
  ]; }

  // ═══ EXTENSIONS ═══
  function initExtensions() {
    document.getElementById('btn-refresh-extensions')?.addEventListener('click', loadExtensions);
    document.getElementById('extensions-search')?.addEventListener('input', e => { const q = e.target.value.toLowerCase(); document.querySelectorAll('.extension-card').forEach(c => c.style.display = c.textContent.toLowerCase().includes(q) ? 'flex' : 'none'); });
  }
  async function loadExtensions() {
    const iL = document.getElementById('installed-list'), mL = document.getElementById('marketplace-list');
    iL.innerHTML = mL.innerHTML = `<div class="marketplace-loading">${t('loading')}</div>`;
    installedPlugins = await window.api.getInstalledPlugins();
    iL.innerHTML = ''; if (!installedPlugins.length) iL.innerHTML = '<div class="empty-state" style="padding:16px"><p>No plugins</p></div>';
    installedPlugins.forEach(p => { const c = document.createElement('div'); c.className = 'extension-card'; c.innerHTML = `<div class="extension-icon">${p.icon}</div><div class="extension-info"><div class="extension-name">${esc(p.name)} <span class="ext-version">v${p.version}</span></div><div class="extension-description">${esc(p.description)}</div></div><div class="extension-actions"><button class="danger-btn u">${t('uninstall')}</button></div>`; c.querySelector('.u').onclick = async e => { e.stopPropagation(); const r = await window.api.uninstallPlugin(p.id); if (r.success) { activePlugins.get(p.id)?.(); activePlugins.delete(p.id); notify(t('pluginUninstalled'), 'success'); loadExtensions(); } else notify(r.error, 'error'); }; iL.appendChild(c); });
    try {
      const url = settings['plugins.serverUrl'] || 'https://antarctidum.itrypro.ru/plugins';
      const data = await (await fetch(url + '?action=list')).json(); mL.innerHTML = '';
      (data.plugins || []).forEach(p => { const inst = installedPlugins.some(x => x.id === p.id); const c = document.createElement('div'); c.className = 'extension-card'; c.innerHTML = `<div class="extension-icon">${p.icon || '🧩'}</div><div class="extension-info"><div class="extension-name">${esc(p.name)} <span class="ext-version">v${p.version || '1.0.0'}</span></div><div class="extension-description">${esc(p.description || '')}</div></div><div class="extension-actions">${inst ? '<span class="extension-badge installed">✓</span>' : `<button class="primary-btn i" style="padding:4px 12px;font-size:12px">${t('install')}</button>`}</div>`;
        if (!inst) c.querySelector('.i').onclick = async ev => { ev.stopPropagation(); ev.target.textContent = '...'; ev.target.disabled = true; try { const d = await (await fetch(url + '?action=download&id=' + encodeURIComponent(p.id))).json(); if (!d.files) throw new Error('No files'); const r = await window.api.installPlugin(p.id, d.files); if (r.success) { notify(t('pluginInstalled'), 'success'); loadExtensions(); loadPlugins(); } else throw new Error(r.error); } catch (err) { notify(err.message, 'error'); ev.target.textContent = t('install'); ev.target.disabled = false; } };
        mL.appendChild(c);
      });
      if (!(data.plugins || []).length) mL.innerHTML = '<div class="empty-state" style="padding:16px"><p>No plugins</p></div>';
    } catch (e) { mL.innerHTML = `<div class="marketplace-error">${esc(e.message)}</div>`; }
  }

  // ═══ PLUGINS ═══
  async function loadPlugins() {
    for (const [, d] of activePlugins) { try { d(); } catch (e) {} } activePlugins.clear();
    document.getElementById('status-plugins').innerHTML = '';
    installedPlugins = await window.api.getInstalledPlugins();
    for (const p of installedPlugins) {
      if (!p.code) continue;
      try {
        const api = {
          editor: { getEditor: () => editor, insertText: t => { if (editor) { editor.executeEdits('plugin', [{ range: editor.getSelection(), text: t }]); } }, getText: () => editor?.getModel()?.getValue() || '', onContentChange: cb => editor?.onDidChangeModelContent(cb) },
          ui: { notify, addStatusItem: (text, onclick) => { const el = document.createElement('span'); el.className = 'status-item'; el.textContent = text; if (onclick) el.onclick = onclick; document.getElementById('status-plugins').appendChild(el); return { update: t => el.textContent = t, remove: () => el.remove() }; } },
          settings: { get: k => settings[k], set: async (k, v) => { settings[k] = v; await window.api.saveSettings(settings); } },
          files: { readFile: p => window.api.readFile(p), saveFile: (p, c) => window.api.saveFile(p, c), getProjectPath: () => projectRoot }
        };
        const result = new Function('api', p.code)(api);
        activePlugins.set(p.id, typeof result === 'function' ? result : result?.deactivate || (() => {}));
      } catch (err) { console.error(`Plugin error (${p.id}):`, err); }
    }
  }

  // ═══ IPC ═══
  function initIPC() {
    window.api.on('file-opened', ({ filePath, content }) => {
      const name = window.api.pathBasename(filePath), lang = extToLang(window.api.pathExtname(filePath).replace('.', ''));
      const uri = monaco.Uri.file(filePath); let model = monaco.editor.getModel(uri);
      if (model) model.setValue(content); else model = monaco.editor.createModel(content, lang, uri);
      if (tabs.find(t => t.filePath === filePath)) { activateTab(tabs.find(t => t.filePath === filePath).id); return; }
      const tab = { id: 'tab-' + Date.now(), filePath, name, isModified: false, model }; tabs.push(tab); activateTab(tab.id); renderTabs();
    });
    window.api.on('folder-opened', ({ rootPath, tree }) => {
      projectRoot = rootPath; renderFileTree(tree, document.getElementById('file-tree'));
      document.querySelector('.titlebar-title').textContent = 'Antarctidum — ' + window.api.pathBasename(rootPath);
    });
    window.api.on('menu-action', a => ({ 'new-file': createNewFile, save: saveCurrentFile, 'save-as': saveCurrentFileAs, settings: showSettingsPage, find: () => editor?.getAction('actions.find')?.run(), replace: () => editor?.getAction('editor.action.startFindReplaceAction')?.run(), 'toggle-sidebar': toggleSidebar, 'toggle-terminal': toggleTerminal, 'zoom-in': () => changeZoom(1), 'zoom-out': () => changeZoom(-1) })[a]?.());
  }

  // ═══ RESIZE ═══
  function initResize() {
    const sr = document.getElementById('sidebar-resize'), tr = document.getElementById('terminal-resize');
    let sd = false, td = false;
    sr.onmousedown = e => { sd = true; sr.classList.add('active'); e.preventDefault(); };
    tr.onmousedown = e => { td = true; tr.classList.add('active'); e.preventDefault(); };
    document.addEventListener('mousemove', e => {
      if (sd) document.getElementById('sidebar').style.width = Math.max(150, Math.min(600, e.clientX - 48)) + 'px';
      if (td) { document.getElementById('terminal-area').style.height = Math.max(100, Math.min(500, document.getElementById('editor-area').getBoundingClientRect().bottom - e.clientY)) + 'px'; if (window.xterm.available) window.xterm.fit(); }
    });
    document.addEventListener('mouseup', () => { sd = td = false; sr.classList.remove('active'); tr.classList.remove('active'); });
    // Window resize → fit xterm
    window.addEventListener('resize', () => { if (terminalVisible && window.xterm.available) window.xterm.fit(); });
    // ResizeObserver for terminal container
    new ResizeObserver(() => { if (terminalVisible && window.xterm.available) window.xterm.fit(); }).observe(document.getElementById('terminal-container'));
  }

  // ═══ NOTIFICATIONS ═══
  function notify(msg, type = 'info') {
    const el = document.createElement('div'); el.className = `notification ${type}`;
    el.innerHTML = `<span>${esc(msg)}</span><button class="notification-close">✕</button>`;
    el.querySelector('.notification-close').onclick = () => el.remove();
    document.getElementById('notification-container').appendChild(el);
    setTimeout(() => el.remove(), 5000);
  }

  // ═══ HELPERS ═══
  function esc(s) { return s ? s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;') : ''; }
  function fileIcon(n) { const e = (n || '').split('.').pop().toLowerCase(); return { js: '📜', jsx: '⚛️', ts: '🔷', tsx: '⚛️', py: '🐍', rs: '🦀', go: '🐹', java: '☕', c: '🔧', cpp: '🔧', html: '🌐', css: '🎨', scss: '🎨', json: '📋', yaml: '📄', yml: '📄', md: '📝', txt: '📄', svg: '🖼️', png: '🖼️', sh: '💻', sql: '🗃️', env: '🔒', php: '🐘', dockerfile: '🐳', lock: '🔒' }[e] || '📄'; }
  function extToLang(e) { return { js: 'javascript', jsx: 'javascript', ts: 'typescript', tsx: 'typescript', py: 'python', rs: 'rust', go: 'go', java: 'java', c: 'c', cpp: 'cpp', h: 'c', cs: 'csharp', html: 'html', css: 'css', scss: 'scss', less: 'less', json: 'json', xml: 'xml', yaml: 'yaml', yml: 'yaml', md: 'markdown', sh: 'shell', ps1: 'powershell', bat: 'bat', sql: 'sql', php: 'php', lua: 'lua', dockerfile: 'dockerfile', vue: 'html', ini: 'ini', env: 'ini' }[(e || '').toLowerCase()] || 'plaintext'; }

  document.addEventListener('DOMContentLoaded', init);
})();