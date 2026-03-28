// ═══════════════════════════════════════════
// ANTARCTIDUM v2.0 — Full App (FIXED)
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
      copyPath: 'Copy Path', closeTab: 'Close', closeOthers: 'Close Others',
      closeAll: 'Close All', run: 'Run',
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
      copyPath: 'Копировать путь', closeTab: 'Закрыть', closeOthers: 'Закрыть другие',
      closeAll: 'Закрыть все', run: 'Запуск',
    }
  };
  let currentLang = 'en', settings = {};
  function t(k) { return LANGS[currentLang]?.[k] || LANGS.en[k] || k; }
  function applyI18n() {
    document.querySelectorAll('[data-i18n]').forEach(el => {
      el.textContent = t(el.dataset.i18n);
    });
    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
      el.placeholder = t(el.dataset.i18nPlaceholder);
    });
  }

  // ═══ STATE ═══
  let editor = null, tabs = [], activeTabId = null, projectRoot = null;
  let commandPaletteVisible = false, terminalVisible = false, sidebarVisible = true;
  let zoomLevel = 0, installedPlugins = [], autoSaveTimer = null;

  // ─── Plugin state ───
  let activePlugins = new Map();       // id → { deactivate, cleanup[] }
  let pluginCommands = [];             // Команды зарегистрированные плагинами
  let pluginStatusItems = [];          // Status bar items от плагинов
  let pluginSidebarPanels = [];        // Sidebar panels от плагинов
  let pluginActivityButtons = [];      // Activity bar buttons от плагинов
  let pluginDisposables = new Map();   // id → [disposable, ...]
  let pluginEventListeners = new Map(); // id → [{ event, handler }, ...]

  // Terminal
  let terminalId = null, terminalHasPty = false;
  let commandHistory = [], historyIndex = -1, terminalCwd = '';

  // Run
  let currentRunId = null;
  let runStartTime = null;

  // ═══ INIT ═══
  async function init() {
    settings = await window.api.loadSettings();
    currentLang = settings['appearance.language'] || 'en';
    zoomLevel = settings['appearance.zoomLevel'] || 0;
    applyI18n(); applyZoom();
    await initMonaco();
    initWindowControls(); initActivityBar(); initSidebar();
    initTerminalUI(); initRun();
    initSearch(); initCommandPalette();
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
            bracketPairColorization: {
              enabled: settings['editor.bracketPairColorization'] !== false
            },
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
            const p = editor.getPosition();
            document.getElementById('status-cursor').textContent =
              `Ln ${p.lineNumber}, Col ${p.column}`;
          });
          editor.onDidChangeModelContent(() => {
            if (activeTabId) {
              const tab = tabs.find(t => t.id === activeTabId);
              if (tab && !tab.isModified) {
                tab.isModified = true;
                renderTabs();
              }
              if (settings['editor.autoSave'] && tab?.filePath) {
                clearTimeout(autoSaveTimer);
                autoSaveTimer = setTimeout(
                  saveCurrentFile,
                  settings['editor.autoSaveDelay'] || 1000
                );
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
      bracketPairColorization: {
        enabled: settings['editor.bracketPairColorization'] !== false
      },
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

  // ═══ SIDEBAR / FILE TREE ═══
  function initSidebar() {
    document.getElementById('btn-open-folder').onclick = () => window.api.openFolderDialog();
    document.getElementById('btn-new-file').onclick = () =>
      projectRoot && createNewFileAt(projectRoot);
    document.getElementById('btn-new-folder').onclick = () =>
      projectRoot && createNewFolderAt(projectRoot);
    document.getElementById('btn-refresh').onclick = () => refreshFileTree();
  }

  function renderFileTree(tree, container, depth = 0) {
    container.innerHTML = '';
    if (!tree?.length) {
      container.innerHTML = `
        <div class="empty-state">
          <p>${t('noFolder')}</p>
          <button id="btn-of2" class="primary-btn">${t('openFolder')}</button>
        </div>`;
      document.getElementById('btn-of2')?.addEventListener('click', () =>
        window.api.openFolderDialog()
      );
      return;
    }
    tree.forEach(item => {
      const el = document.createElement('div');
      if (item.isDirectory) {
        const fd = document.createElement('div');
        fd.className = 'tree-item';
        fd.style.paddingLeft = (16 + depth * 16) + 'px';
        fd.dataset.path = item.path;
        fd.innerHTML = `
          <span class="tree-chevron">▶</span>
          <span class="tree-item-icon">📁</span>
          <span class="tree-item-name">${esc(item.name)}</span>`;
        const ch = document.createElement('div');
        ch.className = 'tree-children';
        fd.onclick = e => {
          e.stopPropagation();
          const open = ch.classList.toggle('open');
          fd.querySelector('.tree-chevron').classList.toggle('open', open);
          fd.querySelector('.tree-item-icon').textContent = open ? '📂' : '📁';
          if (open && !ch.children.length && item.children)
            renderFileTree(item.children, ch, depth + 1);
        };
        fd.oncontextmenu = e => { e.preventDefault(); showContextMenu(e, treeCtx(item)); };
        el.appendChild(fd);
        el.appendChild(ch);
        if (depth < 1 && item.children) renderFileTree(item.children, ch, depth + 1);
      } else {
        const fd = document.createElement('div');
        fd.className = 'tree-item';
        fd.style.paddingLeft = (32 + depth * 16) + 'px';
        fd.innerHTML = `
          <span class="tree-item-icon">${fileIcon(item.name)}</span>
          <span class="tree-item-name">${esc(item.name)}</span>`;
        fd.onclick = () => openFile(item.path);
        fd.oncontextmenu = e => { e.preventDefault(); showContextMenu(e, treeCtx(item)); };
        el.appendChild(fd);
      }
      container.appendChild(el);
    });
  }

  function treeCtx(item) {
    const r = [];
    if (item.isDirectory) {
      r.push({ label: t('newFile'), action: () => createNewFileAt(item.path) });
      r.push({ label: t('newFolderPrompt'), action: () => createNewFolderAt(item.path) });
      r.push({ type: 'separator' });
    }
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
    const name = window.api.pathBasename(filePath);
    const ext = window.api.pathExtname(filePath).replace('.', '');
    const lang = extToLang(ext);
    const uri = monaco.Uri.file(filePath);
    let model = monaco.editor.getModel(uri);
    if (model) model.setValue(result.content);
    else model = monaco.editor.createModel(result.content, lang, uri);
    const tab = {
      id: 'tab-' + Date.now() + '-' + Math.random().toString(36).substr(2, 5),
      filePath, name, isModified: false, model
    };
    tabs.push(tab);
    activateTab(tab.id);
    renderTabs();
    document.getElementById('status-language').textContent = lang || 'Plain Text';
  }

  async function refreshFileTree() {
    if (!projectRoot) return;
    const r = await window.api.readDirectory(projectRoot);
    if (r.success) renderFileTree(r.tree, document.getElementById('file-tree'));
  }

  async function createNewFileAt(dir) {
    const n = prompt(t('newFilePrompt'));
    if (!n) return;
    const fullPath = window.api.pathJoin(dir, n);
    const r = await window.api.createFile(fullPath);
    if (r.success) { refreshFileTree(); openFile(fullPath); }
    else notify(r.error, 'error');
  }

  async function createNewFolderAt(dir) {
    const n = prompt(t('newFolderPrompt'));
    if (!n) return;
    const r = await window.api.createFolder(window.api.pathJoin(dir, n));
    if (r.success) refreshFileTree();
    else notify(r.error, 'error');
  }

  async function deleteItem(p) {
    const r = await window.api.deletePath(p);
    if (r.success) {
      const tab = tabs.find(t => t.filePath === p);
      if (tab) closeTab(tab.id);
      refreshFileTree();
    }
  }

  async function renameItem(p) {
    const oldName = window.api.pathBasename(p);
    const newName = prompt(t('rename'), oldName);
    if (!newName || newName === oldName) return;
    const np = window.api.pathJoin(window.api.pathDirname(p), newName);
    const r = await window.api.renamePath(p, np);
    if (r.success) {
      const tab = tabs.find(t => t.filePath === p);
      if (tab) { tab.filePath = np; tab.name = newName; renderTabs(); }
      refreshFileTree();
    } else notify(r.error, 'error');
  }

  // ═══ TABS ═══
  function renderTabs() {
    const c = document.getElementById('tabs-list');
    c.innerHTML = '';
    tabs.forEach(tab => {
      const el = document.createElement('div');
      el.className = 'tab'
        + (tab.id === activeTabId ? ' active' : '')
        + (tab.isModified ? ' modified' : '');
      el.innerHTML = `
        <span class="tab-icon">${fileIcon(tab.name)}</span>
        <span class="tab-name">${esc(tab.name)}</span>
        <button class="tab-close">✕</button>`;
      el.onclick = e => {
        if (!e.target.classList.contains('tab-close')) activateTab(tab.id);
      };
      el.querySelector('.tab-close').onclick = e => {
        e.stopPropagation(); closeTab(tab.id);
      };
      el.oncontextmenu = e => {
        e.preventDefault();
        showContextMenu(e, [
          { label: t('closeTab'), action: () => closeTab(tab.id) },
          {
            label: t('closeOthers'),
            action: () => tabs.filter(x => x.id !== tab.id).forEach(x => closeTab(x.id))
          },
          { label: t('closeAll'), action: () => [...tabs].forEach(x => closeTab(x.id)) },
          { type: 'separator' },
          { label: t('copyPath'), action: () => navigator.clipboard.writeText(tab.filePath || '') },
        ]);
      };
      c.appendChild(el);
    });
  }

  function activateTab(id) {
    activeTabId = id;
    const tab = tabs.find(t => t.id === id);
    if (!tab) return;
    document.getElementById('welcome-screen').style.display = 'none';
    document.getElementById('settings-page').style.display = 'none';
    document.getElementById('monaco-editor').style.display = 'block';
    editor.setModel(tab.model);
    renderTabs();
    updateBreadcrumb(tab.filePath);
    document.getElementById('status-language').textContent =
      extToLang((tab.name || '').split('.').pop()) || 'Plain Text';
    document.querySelectorAll('.tree-item').forEach(el => el.classList.remove('selected'));
    if (tab.filePath) {
      document.querySelector(
        `.tree-item[data-path="${CSS.escape(tab.filePath)}"]`
      )?.classList.add('selected');
    }
  }

  function closeTab(id) {
    const idx = tabs.findIndex(t => t.id === id);
    if (idx === -1) return;
    tabs[idx].model?.dispose();
    tabs.splice(idx, 1);
    if (activeTabId === id) {
      if (tabs.length) activateTab(tabs[Math.min(idx, tabs.length - 1)].id);
      else {
        activeTabId = null;
        document.getElementById('monaco-editor').style.display = 'none';
        document.getElementById('welcome-screen').style.display = 'flex';
        document.getElementById('breadcrumb').innerHTML = '';
      }
    }
    renderTabs();
  }

  function updateBreadcrumb(fp) {
    const bc = document.getElementById('breadcrumb');
    if (!fp) { bc.innerHTML = ''; return; }
    let rel = fp;
    if (projectRoot && fp.startsWith(projectRoot))
      rel = fp.substring(projectRoot.length + 1);
    bc.innerHTML = rel.split(/[\/\\]/).map((p, i, a) =>
      `<span class="breadcrumb-item">${esc(p)}</span>` +
      (i < a.length - 1 ? '<span class="breadcrumb-separator">›</span>' : '')
    ).join('');
  }

  async function saveCurrentFile() {
    const tab = tabs.find(t => t.id === activeTabId);
    if (!tab) return;
    if (tab.filePath) {
      const r = await window.api.saveFile(tab.filePath, tab.model.getValue());
      if (r.success) {
        tab.isModified = false;
        renderTabs();
        notify(t('fileSaved'), 'success');
      } else notify(r.error, 'error');
    } else saveCurrentFileAs();
  }

  async function saveCurrentFileAs() {
    const tab = tabs.find(t => t.id === activeTabId);
    if (!tab) return;
    const r = await window.api.saveFileAs(tab.model.getValue(), tab.name);
    if (r.success) {
      tab.filePath = r.filePath;
      tab.name = window.api.pathBasename(r.filePath);
      tab.isModified = false;
      renderTabs();
      updateBreadcrumb(tab.filePath);
      notify(t('fileSaved'), 'success');
    }
  }

  function createNewFile() {
    const model = monaco.editor.createModel('', 'plaintext');
    const tab = {
      id: 'tab-' + Date.now(),
      filePath: null,
      name: 'Untitled',
      isModified: false,
      model
    };
    tabs.push(tab);
    activateTab(tab.id);
    renderTabs();
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
    document.getElementById('terminal-area').style.display =
      terminalVisible ? 'flex' : 'none';
    if (terminalVisible && !terminalId) {
      await createTerminal();
    }
    if (terminalVisible && window.xterm && window.xterm.available) {
      setTimeout(() => window.xterm.fit(), 50);
    }
  }

  async function createTerminal() {
    const container = document.getElementById('terminal-container');
    container.innerHTML = '';

    const result = await window.api.terminalCreate();
    if (!result.success) { notify('Failed to create terminal', 'error'); return; }

    terminalId = result.id;
    terminalHasPty = result.pty;

    if (terminalHasPty && window.xterm && window.xterm.available) {
      const created = window.xterm.create('terminal-container', {
        theme: {
          background: '#11111b', foreground: '#cdd6f4',
          cursor: '#f5e0dc', cursorAccent: '#11111b',
          selectionBackground: '#45475a', selectionForeground: '#cdd6f4',
          black: '#45475a', red: '#f38ba8', green: '#a6e3a1',
          yellow: '#f9e2af', blue: '#89b4fa', magenta: '#cba6f7',
          cyan: '#94e2d5', white: '#bac2de',
          brightBlack: '#585b70', brightRed: '#f38ba8',
          brightGreen: '#a6e3a1', brightYellow: '#f9e2af',
          brightBlue: '#89b4fa', brightMagenta: '#cba6f7',
          brightCyan: '#94e2d5', brightWhite: '#a6adc8',
        },
        fontSize: settings['terminal.fontSize'] || 13,
        fontFamily: "'Cascadia Code', 'Fira Code', monospace",
        cursorBlink: true, cursorStyle: 'bar',
        scrollback: 5000, allowTransparency: true,
        drawBoldTextInBrightColors: true,
      });

      if (!created) {
        console.error('Failed to create xterm instance');
        createSimpleTerminal(container);
        return;
      }

      window.xterm.onData(data => window.api.terminalInput(terminalId, data));
      window.xterm.onResize((cols, rows) =>
        window.api.terminalResize(terminalId, cols, rows));

      window.api.on('terminal-data', ({ id, data }) => {
        if (id === terminalId) window.xterm.write(data);
      });
      window.api.on('terminal-exit', ({ id, exitCode }) => {
        if (id === terminalId)
          window.xterm.writeln(`\r\n\x1b[33m[Process exited: ${exitCode}]\x1b[0m`);
      });

      setTimeout(() => {
        window.xterm.fit();
        window.api.terminalResize(
          terminalId, window.xterm.getCols(), window.xterm.getRows()
        );
      }, 200);

      window.xterm.focus();
      return;
    }

    createSimpleTerminal(container);
  }

  function createSimpleTerminal(container) {
    container.innerHTML = '';
    const output = document.createElement('div');
    output.className = 'terminal-output';
    const inputLine = document.createElement('div');
    inputLine.className = 'terminal-input-line';
    const prompt = document.createElement('span');
    prompt.className = 'terminal-prompt';
    const input = document.createElement('input');
    input.className = 'terminal-input';
    input.spellcheck = false;
    inputLine.appendChild(prompt);
    inputLine.appendChild(input);
    container.appendChild(output);
    container.appendChild(inputLine);

    (async () => {
      terminalCwd = await window.api.getProjectPath() || await window.api.getHomePath();
      updatePrompt();
    })();

    function updatePrompt() {
      prompt.textContent = `${terminalCwd.split(/[\/\\]/).pop() || '~'} $`;
    }

    input.focus();
    container.onclick = () => input.focus();

    input.onkeydown = async (e) => {
      if (e.key === 'Enter') {
        const cmd = input.value.trim();
        if (!cmd) return;
        commandHistory.push(cmd);
        historyIndex = commandHistory.length;
        output.innerHTML += `<div><span class="terminal-success">${
          esc(terminalCwd.split(/[\/\\]/).pop())
        } $</span> ${esc(cmd)}</div>`;
        input.value = '';

        if (cmd.startsWith('cd ')) {
          const dir = cmd.substring(3).trim();
          let nc = dir === '~'
            ? await window.api.getHomePath()
            : (dir.match(/^[A-Z]:|^\//i) ? dir : window.api.pathJoin(terminalCwd, dir));
          const st = await window.api.getFileStats(nc);
          if (st.success && st.stats.isDirectory) {
            terminalCwd = nc;
            updatePrompt();
          } else {
            output.innerHTML += `<div class="terminal-error">cd: no such directory</div>`;
          }
          output.scrollTop = output.scrollHeight;
          return;
        }

        if (cmd === 'clear' || cmd === 'cls') { output.innerHTML = ''; return; }

        const r = await window.api.terminalExec(cmd, terminalCwd);
        if (r.stdout) output.innerHTML += `<div>${esc(r.stdout)}</div>`;
        if (r.stderr) output.innerHTML += `<div class="terminal-error">${esc(r.stderr)}</div>`;
        if (r.error && !r.stderr)
          output.innerHTML += `<div class="terminal-error">${esc(r.error)}</div>`;
        output.scrollTop = output.scrollHeight;
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (historyIndex > 0) input.value = commandHistory[--historyIndex] || '';
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        input.value = (++historyIndex < commandHistory.length)
          ? commandHistory[historyIndex] : '';
        historyIndex = Math.min(historyIndex, commandHistory.length);
      }
    };
  }

  function clearTerminal() {
    if (window.xterm && window.xterm.available && terminalHasPty) {
      window.xterm.clear();
    } else {
      const o = document.querySelector('#terminal-container .terminal-output');
      if (o) o.innerHTML = '';
    }
  }

  // ═══ SEARCH ═══
  let searchTimeout = null;
  function initSearch() {
    const inp = document.getElementById('search-input');
    const repl = document.getElementById('replace-input');
    const cBtn = document.getElementById('search-case-btn');
    const wBtn = document.getElementById('search-word-btn');
    const rBtn = document.getElementById('search-regex-btn');
    let cs = false, ww = false, rx = false;

    cBtn.onclick = () => { cs = !cs; cBtn.classList.toggle('active'); doSearch(); };
    wBtn.onclick = () => { ww = !ww; wBtn.classList.toggle('active'); doSearch(); };
    rBtn.onclick = () => { rx = !rx; rBtn.classList.toggle('active'); doSearch(); };
    inp.oninput = () => {
      clearTimeout(searchTimeout);
      searchTimeout = setTimeout(doSearch, 300);
    };

    document.getElementById('btn-replace-all').onclick = () => {
      if (!editor) return;
      const m = editor.getModel();
      if (!m) return;
      const matches = m.findMatches(inp.value, true, rx, cs, ww ? inp.value : null, true);
      if (matches.length) {
        editor.executeEdits('replace-all',
          matches.map(m => ({ range: m.range, text: repl.value }))
        );
      }
    };

    async function doSearch() {
      const text = inp.value.trim();
      const rEl = document.getElementById('search-results');
      const info = document.getElementById('search-info');
      if (!text || !projectRoot) { rEl.innerHTML = ''; info.textContent = ''; return; }

      info.textContent = t('loading');
      const results = await window.api.searchInFiles(
        text, projectRoot, { caseSensitive: cs, wholeWord: ww, regex: rx }
      );
      info.textContent = `${results.length} ${t('results')}`;

      const grouped = {};
      results.forEach(r => {
        if (!grouped[r.filePath]) grouped[r.filePath] = [];
        grouped[r.filePath].push(r);
      });

      rEl.innerHTML = '';
      for (const [fp, items] of Object.entries(grouped)) {
        const fEl = document.createElement('div');
        fEl.className = 'search-result-file';
        fEl.innerHTML = `
          <span>${esc(items[0].relativePath)}</span>
          <span class="search-result-count">${items.length}</span>`;
        fEl.onclick = () => openFile(fp);
        rEl.appendChild(fEl);

        items.forEach(item => {
          const el = document.createElement('div');
          el.className = 'search-result-item';
          el.innerHTML = `
            <span class="search-result-line">${item.line}</span>
            <span class="search-result-text">${hlSearch(esc(item.content), text)}</span>`;
          el.onclick = () => {
            openFile(fp).then(() => setTimeout(() => {
              editor.revealLineInCenter(item.line);
              editor.setPosition({ lineNumber: item.line, column: 1 });
              editor.focus();
            }, 100));
          };
          rEl.appendChild(el);
        });
      }

      if (!results.length) {
        rEl.innerHTML = `<div class="empty-state" style="padding:20px">
          <p>${t('noResults')}</p></div>`;
      }
    }
  }

  function hlSearch(t, s) {
    if (!s) return t;
    return t.replace(
      new RegExp(`(${s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'),
      '<span class="search-highlight">$1</span>'
    );
  }

  // ═══════════════════════════════════════════
  // COMMAND PALETTE (FIXED — includes plugin commands)
  // ═══════════════════════════════════════════

  function getBuiltinCommands() {
    return [
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
      { label: 'Run: Run File', icon: '▶️', shortcut: 'F5', action: runCurrentFile },
      { label: 'Run: Stop', icon: '⏹️', shortcut: 'Shift+F5', action: stopCurrentRun },
      { label: 'Run: Run Selection', icon: '▶️', shortcut: 'Ctrl+Shift+Enter', action: runSelection },
      { label: 'Run: Configure...', icon: '⚙️', action: showRunSettings },
    ];
  }

  /** Собрать все команды: встроенные + плагинные */
  function getAllCommands() {
    const builtin = getBuiltinCommands();
    // Добавляем команды от плагинов
    const fromPlugins = pluginCommands.map(pc => ({
      label: pc.label || pc.id,
      icon: pc.icon || '⚡',
      shortcut: pc.shortcut || '',
      action: pc.handler,
      isPlugin: true,
    }));
    return [...builtin, ...fromPlugins];
  }

  function initCommandPalette() {
    const pal = document.getElementById('command-palette');
    const inp = document.getElementById('palette-input');
    const res = document.getElementById('palette-results');
    pal.querySelector('.palette-backdrop').onclick = () => toggleCommandPalette(false);

    let si = 0, filtered = [];

    function getAllFiltered(query) {
      const cmds = getAllCommands();
      if (!query) return cmds;
      const q = query.toLowerCase();
      return cmds.filter(c => c.label.toLowerCase().includes(q));
    }

    inp.oninput = () => {
      const q = inp.value.replace(/^>\s*/, '');
      filtered = getAllFiltered(q);
      si = 0;
      render();
    };

    inp.onkeydown = (e) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        si = Math.min(si + 1, filtered.length - 1);
        render();
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        si = Math.max(si - 1, 0);
        render();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (filtered[si]) {
          filtered[si].action();
          toggleCommandPalette(false);
        }
      } else if (e.key === 'Escape') {
        toggleCommandPalette(false);
      }
    };

    function render() {
      res.innerHTML = '';
      filtered.forEach((c, i) => {
        const el = document.createElement('div');
        el.className = 'palette-item' + (i === si ? ' selected' : '');
        el.innerHTML = `
          <span class="palette-item-icon">${c.icon || ''}</span>
          <span class="palette-item-label">${esc(c.label)}${
            c.isPlugin ? ' <span style="opacity:0.5;font-size:11px">(plugin)</span>' : ''
          }</span>
          ${c.shortcut
            ? `<span class="palette-item-shortcut">${c.shortcut}</span>`
            : ''}`;
        el.onclick = () => {
          c.action();
          toggleCommandPalette(false);
        };
        el.onmouseenter = () => { si = i; render(); };
        res.appendChild(el);
      });
    }

    // Сохраняем ссылку для внешнего вызова
    window._refreshPalette = () => {
      const q = (inp.value || '').replace(/^>\s*/, '');
      filtered = getAllFiltered(q);
      si = 0;
      render();
    };
  }

  function toggleCommandPalette(show) {
    const p = document.getElementById('command-palette');
    const i = document.getElementById('palette-input');
    if (show === undefined) show = p.classList.contains('hidden');
    commandPaletteVisible = show;
    p.classList.toggle('hidden', !show);
    if (show) {
      i.value = '> ';
      i.focus();
      i.setSelectionRange(2, 2);
      window._refreshPalette?.();
    }
  }

  function toggleSidebar() {
    sidebarVisible = !sidebarVisible;
    document.getElementById('sidebar').classList.toggle('hidden', !sidebarVisible);
  }

  // ═══ CONTEXT MENU ═══
  function initContextMenu() {
    document.addEventListener('click', () =>
      document.getElementById('context-menu').classList.add('hidden')
    );
  }

  function showContextMenu(ev, items) {
    const m = document.getElementById('context-menu');
    const l = m.querySelector('.context-menu-list');
    l.innerHTML = '';
    items.forEach(it => {
      if (it.type === 'separator') {
        l.innerHTML += '<div class="context-menu-separator"></div>';
        return;
      }
      const el = document.createElement('div');
      el.className = 'context-menu-item';
      el.innerHTML = `
        <span>${esc(it.label)}</span>
        ${it.shortcut ? `<span class="context-menu-shortcut">${it.shortcut}</span>` : ''}`;
      el.onclick = () => { m.classList.add('hidden'); it.action(); };
      l.appendChild(el);
    });
    m.style.left = Math.min(ev.clientX, innerWidth - 200) + 'px';
    m.style.top = Math.min(ev.clientY, innerHeight - items.length * 32) + 'px';
    m.classList.remove('hidden');
  }

  // ═══ KEYBOARD ═══
  function initKeyboard() {
    document.addEventListener('keydown', e => {
      const c = e.ctrlKey || e.metaKey;

      // Run shortcuts
      if (e.key === 'F5' && !e.shiftKey && !c) { e.preventDefault(); runCurrentFile(); }
      else if (e.key === 'F5' && e.shiftKey && !c) { e.preventDefault(); stopCurrentRun(); }
      else if (c && e.shiftKey && e.key === 'Enter') { e.preventDefault(); runSelection(); }

      // Existing shortcuts
      else if (c && e.shiftKey && e.key === 'P') { e.preventDefault(); toggleCommandPalette(); }
      else if (c && e.key === 's') { e.preventDefault(); e.shiftKey ? saveCurrentFileAs() : saveCurrentFile(); }
      else if (c && e.key === 'n') { e.preventDefault(); createNewFile(); }
      else if (c && e.key === 'b') { e.preventDefault(); toggleSidebar(); }
      else if (c && e.key === '`') { e.preventDefault(); toggleTerminal(); }
      else if (c && e.key === ',') { e.preventDefault(); showSettingsPage(); }
      else if (c && e.key === '=') { e.preventDefault(); changeZoom(1); }
      else if (c && e.key === '-') { e.preventDefault(); changeZoom(-1); }
      else if (c && e.key === 'w') { e.preventDefault(); if (activeTabId) closeTab(activeTabId); }
      else if (e.key === 'Escape') {
        if (commandPaletteVisible) toggleCommandPalette(false);
        document.getElementById('context-menu').classList.add('hidden');
      }
    });
  }

  function changeZoom(d) {
    zoomLevel = Math.max(-5, Math.min(5, zoomLevel + d));
    applyZoom();
    settings['appearance.zoomLevel'] = zoomLevel;
    window.api.saveSettings(settings);
  }

  function applyZoom() {
    document.body.style.zoom = (1 + zoomLevel * 0.1).toFixed(2);
  }

  // ═══ WELCOME ═══
  function initWelcome() {
    document.getElementById('welcome-new-file')?.addEventListener('click', createNewFile);
    document.getElementById('welcome-open-file')?.addEventListener('click', () =>
      window.api.openFileDialog());
    document.getElementById('welcome-open-folder')?.addEventListener('click', () =>
      window.api.openFolderDialog());
  }

  // ═══ SETTINGS ═══
  function showSettingsPage() {
    document.getElementById('welcome-screen').style.display = 'none';
    document.getElementById('monaco-editor').style.display = 'none';
    document.getElementById('settings-page').style.display = 'block';
    renderSettingsPage();
    const btn = document.querySelector('.activity-btn[data-panel="settings-panel"]');
    if (btn) {
      document.querySelectorAll('.activity-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      document.querySelectorAll('.sidebar-panel').forEach(p => p.classList.remove('active'));
      document.getElementById('panel-settings-panel')?.classList.add('active');
      sidebarVisible = true;
      document.getElementById('sidebar').classList.remove('hidden');
    }
  }

  function initSettingsPage() {
    document.querySelectorAll('.settings-nav-item').forEach(it =>
      it.addEventListener('click', () => {
        document.querySelectorAll('.settings-nav-item').forEach(i =>
          i.classList.remove('active'));
        it.classList.add('active');
        renderSettingsPage(it.dataset.section);
      })
    );
    document.getElementById('settings-search')?.addEventListener('input', e =>
      renderSettingsPage(null, e.target.value));
  }

  function renderSettingsPage(section = 'editor', search = '') {
    const c = document.getElementById('settings-content');
    c.innerHTML = '';
    const defs = getSettingsDefs();
    const filtered = defs.filter(s =>
      search
        ? (s.label + s.key).toLowerCase().includes(search.toLowerCase())
        : s.section === section
    );

    if (section === 'about' && !search) {
      c.innerHTML = `
        <div class="settings-section">
          <div class="settings-section-title">${t('about')}</div>
          <div style="padding:16px;white-space:pre-line;color:var(--text-dim);line-height:1.8">
            ${t('aboutText')}
          </div>
        </div>`;
      return;
    }

    const groups = {};
    filtered.forEach(s => { (groups[s.section] = groups[s.section] || []).push(s); });

    for (const [sec, items] of Object.entries(groups)) {
      const sEl = document.createElement('div');
      sEl.className = 'settings-section';
      sEl.innerHTML = `<div class="settings-section-title">${t(sec) || sec}</div>`;

      items.forEach(item => {
        const row = document.createElement('div');
        row.className = 'setting-row';
        const info = document.createElement('div');
        info.className = 'setting-info';
        info.innerHTML = `
          <div class="setting-label">${esc(item.label)}</div>
          ${item.description
            ? `<div class="setting-description">${esc(item.description)}</div>`
            : ''}
          <div class="setting-id">${item.key}</div>`;
        const ctrl = document.createElement('div');
        ctrl.className = 'setting-control';
        const val = settings[item.key] ?? item.default;

        if (item.type === 'boolean') {
          ctrl.innerHTML = `
            <label class="toggle-switch">
              <input type="checkbox" ${val ? 'checked' : ''}>
              <span class="toggle-slider"></span>
            </label>`;
          ctrl.querySelector('input').onchange = e => {
            settings[item.key] = e.target.checked;
            window.api.saveSettings(settings);
            updateEditorSettings();
          };
        } else if (item.type === 'number') {
          const i = document.createElement('input');
          i.type = 'number'; i.value = val;
          i.min = item.min || 0; i.max = item.max || 100;
          i.onchange = () => {
            settings[item.key] = parseInt(i.value);
            window.api.saveSettings(settings);
            updateEditorSettings();
          };
          ctrl.appendChild(i);
        } else if (item.type === 'select') {
          const s = document.createElement('select');
          (item.options || []).forEach(o => {
            const op = document.createElement('option');
            op.value = o.value || o;
            op.textContent = o.label || o;
            if ((o.value || o) === val) op.selected = true;
            s.appendChild(op);
          });
          s.onchange = () => {
            settings[item.key] = s.value;
            window.api.saveSettings(settings);
            updateEditorSettings();
            if (item.key === 'appearance.language') {
              currentLang = s.value;
              applyI18n();
              renderSettingsPage(section);
            }
          };
          ctrl.appendChild(s);
        } else if (item.type === 'text') {
          const i = document.createElement('input');
          i.type = 'text'; i.value = val || '';
          i.onchange = () => {
            settings[item.key] = i.value;
            window.api.saveSettings(settings);
            updateEditorSettings();
          };
          ctrl.appendChild(i);
        }

        row.appendChild(info);
        row.appendChild(ctrl);
        sEl.appendChild(row);
      });
      c.appendChild(sEl);
    }
  }

  function getSettingsDefs() {
    return [
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
      // Run
      { key: 'run.saveBeforeRun', label: currentLang === 'ru' ? 'Сохранять перед запуском' : 'Save Before Run', section: 'run', type: 'boolean', default: true },
      { key: 'run.clearBeforeRun', label: currentLang === 'ru' ? 'Очищать вывод' : 'Clear Output Before Run', section: 'run', type: 'boolean', default: true },
      { key: 'run.pythonPath', label: 'Python Path', section: 'run', type: 'text', default: 'python' },
      { key: 'run.javaPath', label: 'Java Path', section: 'run', type: 'text', default: 'java' },
      { key: 'run.javacPath', label: 'Javac Path', section: 'run', type: 'text', default: 'javac' },
      { key: 'run.nodePath', label: 'Node.js Path', section: 'run', type: 'text', default: 'node' },
      { key: 'run.gccPath', label: 'GCC Path', section: 'run', type: 'text', default: 'gcc' },
      { key: 'run.gppPath', label: 'G++ Path', section: 'run', type: 'text', default: 'g++' },
      { key: 'run.phpPath', label: 'PHP Path', section: 'run', type: 'text', default: 'php' },
    ];
  }

  // ═══════════════════════════════════════════
  // EXTENSIONS UI
  // ═══════════════════════════════════════════

   // ═══════════════════════════════════════════
  // EXTENSIONS UI — FIXED
  // ═══════════════════════════════════════════

  function initExtensions() {
    document.getElementById('btn-refresh-extensions')?.addEventListener('click', loadExtensions);
    document.getElementById('extensions-search')?.addEventListener('input', e => {
      const q = e.target.value.toLowerCase();
      document.querySelectorAll('.extension-card').forEach(c =>
        c.style.display = c.textContent.toLowerCase().includes(q) ? 'flex' : 'none'
      );
    });
  }

  /**
   * Нормализовать URL сервера плагинов.
   * Убедиться что он корректный и заканчивается на PHP-файл или /.
   */
  function getPluginServerUrl() {
    let url = (settings['plugins.serverUrl'] || '').trim();

    // Если пустой — дефолт
    if (!url) {
      url = 'https://antarctidum.itrypro.ru/plugins/index.php';
    }

    // Убрать trailing slash если есть
    url = url.replace(/\/+$/, '');

    // Если URL заканчивается на директорию (без .php), добавить /index.php
    if (!url.match(/\.\w+$/)) {
      url += '/index.php';
    }

    return url;
  }

  /**
   * Безопасный fetch с таймаутом и отладкой
   */
  async function safeFetch(url, timeoutMs = 10000) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      console.log('[Plugins] Fetching:', url);

      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          'Accept': 'application/json',
        },
      });

      clearTimeout(timer);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const text = await response.text();

      // Попробовать распарсить JSON
      try {
        return JSON.parse(text);
      } catch (parseErr) {
        console.error('[Plugins] Invalid JSON response:', text.substring(0, 500));
        throw new Error(
          `Server returned invalid JSON. ` +
          `First 100 chars: "${text.substring(0, 100)}..."`
        );
      }
    } catch (err) {
      clearTimeout(timer);

      if (err.name === 'AbortError') {
        throw new Error(`Request timeout (${timeoutMs / 1000}s) — server not responding`);
      }

      throw err;
    }
  }

  async function loadExtensions() {
    const iL = document.getElementById('installed-list');
    const mL = document.getElementById('marketplace-list');

    // ═══ 1. INSTALLED PLUGINS ═══
    iL.innerHTML = `<div class="marketplace-loading">${t('loading')}</div>`;
    installedPlugins = await window.api.getInstalledPlugins();
    iL.innerHTML = '';

    if (!installedPlugins.length) {
      iL.innerHTML = `
        <div class="empty-state" style="padding:16px">
          <p>No plugins installed</p>
        </div>`;
    }

    installedPlugins.forEach(p => {
      const c = document.createElement('div');
      c.className = 'extension-card';
      c.innerHTML = `
        <div class="extension-icon">${p.icon || '🧩'}</div>
        <div class="extension-info">
          <div class="extension-name">
            ${esc(p.name)}
            <span class="ext-version">v${p.version || '1.0.0'}</span>
          </div>
          <div class="extension-description">${esc(p.description || '')}</div>
        </div>
        <div class="extension-actions">
          <button class="danger-btn uninstall-btn">${t('uninstall')}</button>
        </div>`;

      c.querySelector('.uninstall-btn').onclick = async e => {
        e.stopPropagation();
        const btn = e.target;
        btn.textContent = '...';
        btn.disabled = true;

        try {
          const r = await window.api.uninstallPlugin(p.id);
          if (r.success) {
            deactivatePlugin(p.id);
            notify(t('pluginUninstalled'), 'success');
            loadExtensions();
          } else {
            throw new Error(r.error || 'Unknown error');
          }
        } catch (err) {
          notify('Uninstall failed: ' + err.message, 'error');
          btn.textContent = t('uninstall');
          btn.disabled = false;
        }
      };

      iL.appendChild(c);
    });

    // ═══ 2. MARKETPLACE ═══
    mL.innerHTML = `<div class="marketplace-loading">${t('loading')}</div>`;

    const serverUrl = getPluginServerUrl();

    try {
      // Сначала проверим доступность сервера
      console.log('[Plugins] Server URL:', serverUrl);

      const listUrl = serverUrl + '?action=list';
      const data = await safeFetch(listUrl);

      // Проверить формат ответа
      if (!data || typeof data !== 'object') {
        throw new Error('Server returned unexpected data format');
      }

      if (data.error) {
        throw new Error('Server error: ' + data.error);
      }

      const plugins = data.plugins || [];

      mL.innerHTML = '';

      if (!plugins.length) {
        mL.innerHTML = `
          <div class="empty-state" style="padding:16px">
            <p>No plugins available</p>
            <p style="font-size:11px;opacity:0.5;margin-top:8px">
              Server: ${esc(serverUrl)}
            </p>
          </div>`;
        return;
      }

      plugins.forEach(p => {
        const isInstalled = installedPlugins.some(x => x.id === p.id);
        const c = document.createElement('div');
        c.className = 'extension-card';

        c.innerHTML = `
          <div class="extension-icon">${p.icon || '🧩'}</div>
          <div class="extension-info">
            <div class="extension-name">
              ${esc(p.name || p.id)}
              <span class="ext-version">v${p.version || '1.0.0'}</span>
            </div>
            <div class="extension-description">
              ${esc(p.description || 'No description')}
            </div>
            ${p.author ? `<div class="extension-author" style="font-size:11px;opacity:0.5;margin-top:2px">by ${esc(p.author)}</div>` : ''}
          </div>
          <div class="extension-actions">
            ${isInstalled
              ? '<span class="extension-badge installed">✓ Installed</span>'
              : `<button class="primary-btn install-btn"
                   style="padding:4px 12px;font-size:12px">
                   ${t('install')}
                 </button>`
            }
          </div>`;

        // ═══ INSTALL BUTTON ═══
        if (!isInstalled) {
          c.querySelector('.install-btn').onclick = async ev => {
            ev.stopPropagation();
            const btn = ev.target;
            const originalText = btn.textContent;
            btn.textContent = '⏳ ...';
            btn.disabled = true;

            try {
              // FIX: используем serverUrl, а не несуществующую переменную url
              const downloadUrl = serverUrl
                + '?action=download&id=' + encodeURIComponent(p.id);

              console.log('[Plugins] Downloading:', downloadUrl);

              const downloadData = await safeFetch(downloadUrl, 30000);

              if (downloadData.error) {
                throw new Error(downloadData.error);
              }

              if (!downloadData.files || Object.keys(downloadData.files).length === 0) {
                throw new Error('Plugin has no files');
              }

              console.log('[Plugins] Got', Object.keys(downloadData.files).length, 'files');

              const installResult = await window.api.installPlugin(p.id, downloadData.files);

              if (installResult.success) {
                notify(
                  `${t('pluginInstalled')}: ${p.name || p.id}`,
                  'success'
                );
                // Перезагрузить списки и активировать плагины
                await loadExtensions();
                await loadPlugins();
              } else {
                throw new Error(installResult.error || 'Install failed');
              }
            } catch (err) {
              console.error('[Plugins] Install error:', err);
              notify(`Install failed: ${err.message}`, 'error');
              btn.textContent = originalText;
              btn.disabled = false;
            }
          };
        }

        mL.appendChild(c);
      });

    } catch (err) {
      console.error('[Plugins] Marketplace error:', err);

      mL.innerHTML = `
        <div class="marketplace-error" style="padding:16px">
          <div style="color:#f38ba8;font-weight:bold;margin-bottom:8px">
            ❌ Failed to load marketplace
          </div>
          <div style="color:#cdd6f4;opacity:0.7;font-size:12px;margin-bottom:12px">
            ${esc(err.message)}
          </div>
          <div style="color:#6c7086;font-size:11px;margin-bottom:12px">
            Server URL: ${esc(serverUrl)}
          </div>
          <div style="display:flex;gap:8px">
            <button class="primary-btn retry-btn"
                    style="padding:4px 12px;font-size:12px">
              🔄 Retry
            </button>
            <button class="primary-btn test-btn"
                    style="padding:4px 12px;font-size:12px;background:#45475a">
              🔧 Test Server
            </button>
          </div>
          <div class="test-result" style="margin-top:8px;font-size:11px;display:none"></div>
        </div>`;

      // Кнопка Retry
      mL.querySelector('.retry-btn')?.addEventListener('click', () => loadExtensions());

      // Кнопка Test Server — для диагностики
      mL.querySelector('.test-btn')?.addEventListener('click', async () => {
        const resultEl = mL.querySelector('.test-result');
        resultEl.style.display = 'block';
        resultEl.innerHTML = '<span style="color:#f9e2af">Testing...</span>';

        try {
          const pingUrl = serverUrl + '?action=ping';
          resultEl.innerHTML += `<br>→ Trying: ${esc(pingUrl)}`;

          const data = await safeFetch(pingUrl, 5000);

          resultEl.innerHTML += `<br><span style="color:#a6e3a1">✓ Server responds!</span>`;
          resultEl.innerHTML += `<br>  Status: ${data.status || '?'}`;
          resultEl.innerHTML += `<br>  Plugins: ${data.plugins_count ?? '?'}`;
          resultEl.innerHTML += `<br>  Version: ${data.version || '?'}`;
        } catch (testErr) {
          resultEl.innerHTML += `<br><span style="color:#f38ba8">✕ ${esc(testErr.message)}</span>`;

          // Подсказки
          resultEl.innerHTML += `<br><br><span style="color:#f9e2af">Possible fixes:</span>`;
          if (testErr.message.includes('Failed to fetch') || testErr.message.includes('NetworkError')) {
            resultEl.innerHTML += `<br>• Check if server is running`;
            resultEl.innerHTML += `<br>• Check URL in Settings → Extensions`;
            resultEl.innerHTML += `<br>• URL should point to PHP file, e.g.:`;
            resultEl.innerHTML += `<br>  https://example.com/plugins/index.php`;
          }
          if (testErr.message.includes('timeout')) {
            resultEl.innerHTML += `<br>• Server is too slow or unreachable`;
          }
          if (testErr.message.includes('JSON')) {
            resultEl.innerHTML += `<br>• Server returns HTML instead of JSON`;
            resultEl.innerHTML += `<br>• Check PHP errors on server`;
          }
        }
      });
    }
  }

  // ═══════════════════════════════════════════
  // PLUGIN SYSTEM v2 — ПОЛНОСТЬЮ ПЕРЕПИСАНА
  // ═══════════════════════════════════════════

  /**
   * Полная очистка одного плагина: деактивация,
   * удаление sidebar-панелей, activity-кнопок,
   * status-items, зарегистрированных команд,
   * dispose monaco-disposables, снятие listeners.
   */
  function deactivatePlugin(pluginId) {
    // 1. Вызываем deactivate
    const pluginData = activePlugins.get(pluginId);
    if (pluginData) {
      try {
        if (typeof pluginData.deactivate === 'function') {
          pluginData.deactivate();
        }
      } catch (e) {
        console.warn(`Plugin ${pluginId} deactivate error:`, e);
      }

      // 2. Удаляем все cleanup-элементы
      if (Array.isArray(pluginData.cleanupElements)) {
        pluginData.cleanupElements.forEach(el => {
          try { el.remove(); } catch (_) {}
        });
      }
    }

    // 3. Удаляем sidebar-панели этого плагина
    pluginSidebarPanels = pluginSidebarPanels.filter(p => {
      if (p.pluginId === pluginId) {
        try { p.element.remove(); } catch (_) {}
        return false;
      }
      return true;
    });

    // 4. Удаляем activity-кнопки этого плагина
    pluginActivityButtons = pluginActivityButtons.filter(b => {
      if (b.pluginId === pluginId) {
        try { b.element.remove(); } catch (_) {}
        return false;
      }
      return true;
    });

    // 5. Удаляем status-items этого плагина
    pluginStatusItems = pluginStatusItems.filter(si => {
      if (si.pluginId === pluginId) {
        try { si.element.remove(); } catch (_) {}
        return false;
      }
      return true;
    });

    // 6. Удаляем команды этого плагина
    pluginCommands = pluginCommands.filter(c => c.pluginId !== pluginId);

    // 7. Dispose monaco-disposables
    const disposables = pluginDisposables.get(pluginId);
    if (disposables) {
      disposables.forEach(d => {
        try { d.dispose(); } catch (_) {}
      });
      pluginDisposables.delete(pluginId);
    }

    // 8. Удаляем event listeners
    pluginEventListeners.delete(pluginId);

    // 9. Удаляем из activePlugins
    activePlugins.delete(pluginId);
  }

  /**
   * Загружает и активирует все установленные плагины.
   * Сначала деактивирует все текущие.
   */
  async function loadPlugins() {
    // Деактивировать все текущие плагины
    for (const [id] of activePlugins) {
      deactivatePlugin(id);
    }

    // Очистить контейнер статуса плагинов
    const statusPlugins = document.getElementById('status-plugins');
    if (statusPlugins) statusPlugins.innerHTML = '';

    // Загрузить список установленных
    installedPlugins = await window.api.getInstalledPlugins();

    for (const plugin of installedPlugins) {
      if (!plugin.code) continue;
      activatePlugin(plugin);
    }

    console.log(`✅ Loaded ${activePlugins.size} plugins`);
  }

  /**
   * Активирует один плагин, создавая для него изолированный API.
   */
  function activatePlugin(plugin) {
    const pluginId = plugin.id;

    // Массив элементов для cleanup при деактивации
    const cleanupElements = [];
    const disposables = [];

    try {
      const api = createPluginAPI(pluginId, cleanupElements, disposables);

      // Выполняем код плагина
      const pluginFunc = new Function('api', plugin.code);
      const result = pluginFunc(api);

      // Определяем функцию деактивации
      let deactivateFn = () => {};
      if (typeof result === 'function') {
        deactivateFn = result;
      } else if (result && typeof result === 'object') {
        if (typeof result.deactivate === 'function') {
          deactivateFn = result.deactivate;
        }
        // Плагин может вернуть { activate, deactivate }
        if (typeof result.activate === 'function') {
          result.activate();
        }
      }

      // Сохраняем данные плагина
      activePlugins.set(pluginId, {
        deactivate: deactivateFn,
        cleanupElements,
      });
      pluginDisposables.set(pluginId, disposables);

    } catch (err) {
      console.error(`❌ Plugin error (${pluginId}):`, err);
      notify(`Plugin "${plugin.name || pluginId}" failed: ${err.message}`, 'error');
    }
  }

  /**
   * Создаёт API-объект для плагина с трекингом всех ресурсов.
   */
  function createPluginAPI(pluginId, cleanupElements, disposables) {
    return {

      // ═══ EDITOR API ═══
      editor: {
        /** Получить экземпляр Monaco Editor */
        getEditor() { return editor; },

        /** Получить Monaco namespace */
        getMonaco() { return typeof monaco !== 'undefined' ? monaco : null; },

        /** Вставить текст в текущую позицию */
        insertText(text) {
          if (!editor) return;
          editor.executeEdits('plugin-' + pluginId, [{
            range: editor.getSelection(),
            text: text
          }]);
        },

        /** Получить весь текст текущего файла */
        getText() {
          return editor?.getModel()?.getValue() || '';
        },

        /** Установить весь текст */
        setText(text) {
          const model = editor?.getModel();
          if (model) model.setValue(text);
        },

        /** Получить выделенный текст */
        getSelectedText() {
          if (!editor) return '';
          return editor.getModel().getValueInRange(editor.getSelection());
        },

        /** Заменить выделенный текст */
        replaceSelection(text) {
          if (!editor) return;
          editor.executeEdits('plugin-' + pluginId, [{
            range: editor.getSelection(),
            text: text
          }]);
        },

        /** Подписаться на изменение содержимого */
        onContentChange(callback) {
          if (!editor) return { dispose: () => {} };
          const d = editor.onDidChangeModelContent(callback);
          disposables.push(d);
          return d;
        },

        /** Подписаться на смену модели (открытие другого файла) */
        onModelChange(callback) {
          if (!editor) return { dispose: () => {} };
          const d = editor.onDidChangeModel(callback);
          disposables.push(d);
          return d;
        },

        /** Получить текущую позицию курсора */
        getCursorPosition() {
          return editor?.getPosition() || null;
        },

        /** Установить позицию курсора */
        setCursorPosition(line, column) {
          editor?.setPosition({ lineNumber: line, column });
        },

        /** Получить текущий язык */
        getLanguage() {
          return editor?.getModel()?.getLanguageId() || 'plaintext';
        },

        /** Добавить декорации (подсветки, маркеры) */
        addDecorations(decorations) {
          if (!editor) return [];
          return editor.deltaDecorations([], decorations);
        },

        /** Удалить декорации */
        removeDecorations(ids) {
          if (!editor || !ids) return;
          editor.deltaDecorations(ids, []);
        },

        /** Зарегистрировать провайдер автодополнения */
        registerCompletionProvider(languageId, provider) {
          const d = monaco.languages.registerCompletionItemProvider(languageId, provider);
          disposables.push(d);
          return d;
        },

        /** Зарегистрировать провайдер hover */
        registerHoverProvider(languageId, provider) {
          const d = monaco.languages.registerHoverProvider(languageId, provider);
          disposables.push(d);
          return d;
        },

        /** Добавить действие (action) в контекстное меню редактора */
        addAction(actionDescriptor) {
          if (!editor) return null;
          const d = editor.addAction(actionDescriptor);
          disposables.push(d);
          return d;
        },
      },

      // ═══ UI API ═══
      ui: {
        /** Показать уведомление */
        notify(message, type = 'info') {
          notify(message, type);
        },

        /** Добавить элемент в status bar */
        addStatusItem(text, onclick, tooltip) {
          const el = document.createElement('span');
          el.className = 'status-item';
          el.textContent = text;
          if (tooltip) el.title = tooltip;
          if (onclick) {
            el.style.cursor = 'pointer';
            el.onclick = onclick;
          }
          document.getElementById('status-plugins').appendChild(el);

          // Трекинг
          cleanupElements.push(el);
          pluginStatusItems.push({ pluginId, element: el });

          return {
            update(newText) { el.textContent = newText; },
            setTooltip(tip) { el.title = tip; },
            remove() { el.remove(); },
            element: el,
          };
        },

        /** Показать input dialog */
        prompt(message, defaultValue) {
          return prompt(message, defaultValue);
        },

        /** Показать confirm dialog */
        confirm(message) {
          return confirm(message);
        },

        /** Показать контекстное меню */
        showContextMenu(event, items) {
          showContextMenu(event, items);
        },
      },

      // ═══ SIDEBAR API ═══
      sidebar: {
        /**
         * Добавить панель в sidebar с кнопкой в activity bar.
         * Возвращает объект для управления панелью.
         */
        addPanel(title, icon = '🎮', htmlContent = '') {
          const panelId = 'plugin-panel-' + pluginId + '-' + Date.now();
          const sidebar = document.getElementById('sidebar');
          const activityBar = document.getElementById('activity-bar');

          // Создаём sidebar-панель
          const panel = document.createElement('div');
          panel.className = 'sidebar-panel';
          panel.id = panelId;
          panel.innerHTML = `
            <div class="panel-header">
              <span>${esc(icon)} ${esc(title)}</span>
            </div>
            <div class="panel-content" style="padding:10px;overflow-y:auto;flex:1;">
              ${htmlContent}
            </div>`;
          sidebar.appendChild(panel);

          // Создаём кнопку в activity bar
          const btn = document.createElement('button');
          btn.className = 'activity-btn';
          btn.dataset.panel = panelId;
          btn.innerHTML = `<span style="font-size:18px">${icon}</span>`;
          btn.title = title;
          btn.onclick = () => {
            const wasActive = btn.classList.contains('active');
            document.querySelectorAll('.activity-btn').forEach(b =>
              b.classList.remove('active'));

            if (wasActive) {
              sidebarVisible = !sidebarVisible;
              document.getElementById('sidebar').classList.toggle('hidden', !sidebarVisible);
              if (!sidebarVisible) return;
            } else {
              sidebarVisible = true;
              document.getElementById('sidebar').classList.remove('hidden');
            }

            btn.classList.add('active');
            document.querySelectorAll('.sidebar-panel').forEach(p =>
              p.classList.remove('active'));
            panel.classList.add('active');
          };

          // Вставляем кнопку перед разделителем настроек (если есть)
          const settingsBtn = activityBar.querySelector(
            '.activity-btn[data-panel="settings-panel"]'
          );
          if (settingsBtn) {
            activityBar.insertBefore(btn, settingsBtn);
          } else {
            activityBar.appendChild(btn);
          }

          // Трекинг для cleanup
          cleanupElements.push(panel);
          cleanupElements.push(btn);
          pluginSidebarPanels.push({ pluginId, element: panel, buttonElement: btn });
          pluginActivityButtons.push({ pluginId, element: btn });

          return {
            id: panelId,
            element: panel,
            button: btn,
            /** Получить DOM-элемент содержимого */
            getContentElement() {
              return panel.querySelector('.panel-content');
            },
            /** Заменить HTML-содержимое */
            setContent(html) {
              const content = panel.querySelector('.panel-content');
              if (content) content.innerHTML = html;
            },
            /** Добавить HTML к содержимому */
            appendContent(html) {
              const content = panel.querySelector('.panel-content');
              if (content) content.innerHTML += html;
            },
            /** Активировать (показать) панель */
            activate() {
              btn.click();
            },
            /** Удалить панель */
            remove() {
              panel.remove();
              btn.remove();
            },
          };
        },
      },

      // ═══ COMMANDS API ═══
      commands: {
        /**
         * Зарегистрировать команду для Command Palette.
         * Автоматически появится в палитре команд.
         */
        register(id, handler, label, icon = '⚡', shortcut = '') {
          const cmdId = pluginId + '.' + id;

          // Удаляем если уже есть (при перезагрузке)
          pluginCommands = pluginCommands.filter(c => c.id !== cmdId);

          const cmd = {
            id: cmdId,
            pluginId,
            label: label || id,
            icon,
            shortcut,
            handler,
          };
          pluginCommands.push(cmd);
          return cmd;
        },

        /** Выполнить зарегистрированную команду по id */
        execute(id) {
          const cmd = pluginCommands.find(c => c.id === id || c.id === pluginId + '.' + id);
          if (cmd) {
            try { cmd.handler(); } catch (e) { console.error('Command error:', e); }
          }
        },

        /** Получить список всех зарегистрированных команд */
        getAll() {
          return pluginCommands.filter(c => c.pluginId === pluginId);
        },
      },

      // ═══ SETTINGS API ═══
      settings: {
        /** Получить значение настройки */
        get(key) { return settings[key]; },

        /** Установить значение настройки */
        async set(key, value) {
          settings[key] = value;
          await window.api.saveSettings(settings);
        },

        /** Получить все настройки */
        getAll() { return { ...settings }; },

        /** Подписаться на изменение настроек (polling-based) */
        onChange(callback) {
          let lastJson = JSON.stringify(settings);
          const interval = setInterval(() => {
            const newJson = JSON.stringify(settings);
            if (newJson !== lastJson) {
              lastJson = newJson;
              callback(settings);
            }
          }, 1000);
          // При деактивации плагина очистим интервал
          const cleanup = { remove: () => clearInterval(interval) };
          cleanupElements.push(cleanup);
          return cleanup;
        },
      },

      // ═══ FILES API ═══
      files: {
        readFile(path) { return window.api.readFile(path); },
        saveFile(path, content) { return window.api.saveFile(path, content); },
        getProjectPath() { return projectRoot; },
        getActiveFilePath() {
          const tab = tabs.find(t => t.id === activeTabId);
          return tab?.filePath || null;
        },
        getActiveFileName() {
          const tab = tabs.find(t => t.id === activeTabId);
          return tab?.name || null;
        },
        openFile(path) { return openFile(path); },
      },

      // ═══ TABS API ═══
      tabs: {
        /** Получить список открытых вкладок */
        getAll() {
          return tabs.map(t => ({
            id: t.id,
            name: t.name,
            filePath: t.filePath,
            isModified: t.isModified,
            isActive: t.id === activeTabId,
          }));
        },
        /** Получить активную вкладку */
        getActive() {
          const tab = tabs.find(t => t.id === activeTabId);
          if (!tab) return null;
          return {
            id: tab.id, name: tab.name,
            filePath: tab.filePath, isModified: tab.isModified,
          };
        },
        /** Переключиться на вкладку */
        activate(tabId) { activateTab(tabId); },
        /** Закрыть вкладку */
        close(tabId) { closeTab(tabId); },
      },

      // ═══ TERMINAL API ═══
      terminal: {
        /** Выполнить команду в терминале */
        async exec(command, cwd) {
          return window.api.terminalExec(command, cwd || projectRoot);
        },
        /** Показать/скрыть терминал */
        toggle() { toggleTerminal(); },
        /** Отправить ввод в PTY */
        sendInput(data) {
          if (terminalId) window.api.terminalInput(terminalId, data);
        },
      },

      // ═══ EVENTS API ═══
      events: {
        /** Подписаться на событие приложения */
        on(event, handler) {
          if (!pluginEventListeners.has(pluginId)) {
            pluginEventListeners.set(pluginId, []);
          }
          pluginEventListeners.get(pluginId).push({ event, handler });

          // Подписываемся через window.api если это IPC-событие
          window.api.on(event, handler);

          return {
            dispose() {
              const listeners = pluginEventListeners.get(pluginId);
              if (listeners) {
                const idx = listeners.findIndex(l =>
                  l.event === event && l.handler === handler);
                if (idx !== -1) listeners.splice(idx, 1);
              }
            }
          };
        },
      },

      // ═══ PLUGIN INFO ═══
      info: {
        id: pluginId,
        version: '2.0.0',
        editorName: 'Antarctidum',
      },
    };
  }

  // ═══ IPC ═══
  function initIPC() {
    window.api.on('file-opened', ({ filePath, content }) => {
      const name = window.api.pathBasename(filePath);
      const lang = extToLang(window.api.pathExtname(filePath).replace('.', ''));
      const uri = monaco.Uri.file(filePath);
      let model = monaco.editor.getModel(uri);
      if (model) model.setValue(content);
      else model = monaco.editor.createModel(content, lang, uri);
      if (tabs.find(t => t.filePath === filePath)) {
        activateTab(tabs.find(t => t.filePath === filePath).id);
        return;
      }
      const tab = { id: 'tab-' + Date.now(), filePath, name, isModified: false, model };
      tabs.push(tab);
      activateTab(tab.id);
      renderTabs();
    });

    window.api.on('folder-opened', ({ rootPath, tree }) => {
      projectRoot = rootPath;
      renderFileTree(tree, document.getElementById('file-tree'));
      document.querySelector('.titlebar-title').textContent =
        'Antarctidum — ' + window.api.pathBasename(rootPath);
    });

    window.api.on('menu-action', a => {
      const map = {
        'new-file': createNewFile,
        save: saveCurrentFile,
        'save-as': saveCurrentFileAs,
        settings: showSettingsPage,
        find: () => editor?.getAction('actions.find')?.run(),
        replace: () => editor?.getAction('editor.action.startFindReplaceAction')?.run(),
        'toggle-sidebar': toggleSidebar,
        'toggle-terminal': toggleTerminal,
        'zoom-in': () => changeZoom(1),
        'zoom-out': () => changeZoom(-1),
        'run-file': runCurrentFile,
        'stop-run': stopCurrentRun,
        'run-selection': runSelection,
        'configure-run': showRunSettings,
      };
      map[a]?.();
    });
  }

  // ═══ RESIZE ═══
  function initResize() {
    const sr = document.getElementById('sidebar-resize');
    const tr = document.getElementById('terminal-resize');
    let sd = false, td = false;

    sr.onmousedown = e => { sd = true; sr.classList.add('active'); e.preventDefault(); };
    tr.onmousedown = e => { td = true; tr.classList.add('active'); e.preventDefault(); };

    document.addEventListener('mousemove', e => {
      if (sd) {
        document.getElementById('sidebar').style.width =
          Math.max(150, Math.min(600, e.clientX - 48)) + 'px';
      }
      if (td) {
        document.getElementById('terminal-area').style.height =
          Math.max(100, Math.min(500,
            document.getElementById('editor-area').getBoundingClientRect().bottom - e.clientY
          )) + 'px';
        if (window.xterm && window.xterm.available) window.xterm.fit();
      }
    });

    document.addEventListener('mouseup', () => {
      sd = td = false;
      sr.classList.remove('active');
      tr.classList.remove('active');
    });

    window.addEventListener('resize', () => {
      if (terminalVisible && window.xterm && window.xterm.available) window.xterm.fit();
    });

    new ResizeObserver(() => {
      if (terminalVisible && window.xterm && window.xterm.available) window.xterm.fit();
    }).observe(document.getElementById('terminal-container'));
  }

  // ═══ NOTIFICATIONS ═══
  function notify(msg, type = 'info') {
    const el = document.createElement('div');
    el.className = `notification ${type}`;
    el.innerHTML = `
      <span>${esc(msg)}</span>
      <button class="notification-close">✕</button>`;
    el.querySelector('.notification-close').onclick = () => el.remove();
    document.getElementById('notification-container').appendChild(el);
    setTimeout(() => { if (el.parentNode) el.remove(); }, 5000);
  }

  // ══════════════════════════════════════════
  // RUN CODE (INSIDE IIFE — FIXED)
  // ══════════════════════════════════════════

  function initRun() {
    document.getElementById('btn-run').onclick = () => runCurrentFile();
    document.getElementById('btn-stop').onclick = () => stopCurrentRun();

    window.api.on('run-output', ({ id, type, data, code }) => {
      if (id !== currentRunId) return;

      const output = document.querySelector('#terminal-container .terminal-output');
      if (!output) return;

      if (type === 'stdout') {
        output.innerHTML += esc(data);
        output.scrollTop = output.scrollHeight;
      } else if (type === 'stderr') {
        output.innerHTML += `<span class="terminal-error">${esc(data)}</span>`;
        output.scrollTop = output.scrollHeight;
      } else if (type === 'error') {
        output.innerHTML += `<span class="terminal-error">Error: ${esc(data)}</span>\n`;
        output.scrollTop = output.scrollHeight;
        onRunFinished(1);
      } else if (type === 'exit') {
        onRunFinished(code);
      }
    });
  }

  async function runCurrentFile() {
    const tab = tabs.find(t => t.id === activeTabId);
    if (!tab) { notify('No file to run', 'warning'); return; }

    if (settings['run.saveBeforeRun'] !== false && tab.filePath && tab.isModified) {
      await saveCurrentFile();
    }
    if (!tab.filePath) { notify('Save the file first', 'warning'); return; }

    const result = await window.api.runFile(tab.filePath, true);
    if (!result.success) {
      notify(result.error, 'error');
      if (result.hint) notify(result.hint, 'info');
      return;
    }

    const config = result.config;

    if (!terminalVisible) {
      terminalVisible = true;
      document.getElementById('terminal-area').style.display = 'flex';
    }
    if (settings['run.clearBeforeRun'] !== false) clearRunOutput();
    switchToOutputTab();

    const output = document.querySelector('#terminal-container .terminal-output');
    if (output) {
      const fileName = window.api.pathBasename(tab.filePath);
      output.innerHTML += `<div class="run-header">▶ Running ${esc(config.name)}: ${esc(fileName)}</div>\n`;
    }

    document.getElementById('btn-run').classList.add('hidden');
    document.getElementById('btn-stop').classList.remove('hidden');
    runStartTime = Date.now();

    const statusRun = document.getElementById('status-running');
    if (statusRun) statusRun.classList.remove('hidden');

    try {
      if (config.needsCompile) {
        output.innerHTML += `<span class="terminal-info">Compiling with ${esc(config.compileCommand)}...</span>\n`;
        const compileResult = await window.api.terminalExec(
          `${config.compileCommand} ${config.compileArgs.map(a => `"${a}"`).join(' ')}`,
          config.cwd
        );
        if (compileResult.stderr) {
          output.innerHTML += `<span class="terminal-error">${esc(compileResult.stderr)}</span>\n`;
        }
        if (compileResult.error) {
          output.innerHTML += `<span class="terminal-error">Compilation failed: ${esc(compileResult.error)}</span>\n`;
          onRunFinished(1);
          return;
        }
        if (compileResult.stdout) output.innerHTML += esc(compileResult.stdout);
        output.innerHTML += `<span class="terminal-success">Compiled successfully</span>\n\n`;
      }

      const runId = 'run-' + Date.now();
      currentRunId = runId;
      const runResult = await window.api.runCommand(config.command, config.args, config.cwd, runId);
      if (!runResult.success) {
        output.innerHTML += `<span class="terminal-error">Failed to start: ${esc(runResult.error)}</span>\n`;
        onRunFinished(1);
      }
    } catch (err) {
      output.innerHTML += `<span class="terminal-error">${esc(err.message)}</span>\n`;
      onRunFinished(1);
    }
  }

  async function runSelection() {
    if (!editor) return;
    const selection = editor.getModel().getValueInRange(editor.getSelection());
    if (!selection.trim()) { notify('No text selected', 'warning'); return; }

    const tab = tabs.find(t => t.id === activeTabId);
    const ext = tab ? window.api.pathExtname(tab.name).toLowerCase() : '';

    let command, args;
    if (['.py'].includes(ext)) {
      command = settings['run.pythonPath'] || 'python'; args = ['-c', selection];
    } else if (['.js', '.mjs'].includes(ext)) {
      command = settings['run.nodePath'] || 'node'; args = ['-e', selection];
    } else if (['.rb'].includes(ext)) {
      command = 'ruby'; args = ['-e', selection];
    } else if (['.php'].includes(ext)) {
      command = settings['run.phpPath'] || 'php'; args = ['-r', selection];
    } else if (['.lua'].includes(ext)) {
      command = 'lua'; args = ['-e', selection];
    } else {
      notify('Run selection not supported for this language', 'warning');
      return;
    }

    if (!terminalVisible) {
      terminalVisible = true;
      document.getElementById('terminal-area').style.display = 'flex';
    }
    switchToOutputTab();

    const output = document.querySelector('#terminal-container .terminal-output');
    if (output && settings['run.clearBeforeRun'] !== false) output.innerHTML = '';
    if (output) output.innerHTML += `<div class="run-header">▶ Running selection...</div>\n`;

    const runId = 'run-sel-' + Date.now();
    currentRunId = runId;
    runStartTime = Date.now();
    document.getElementById('btn-run').classList.add('hidden');
    document.getElementById('btn-stop').classList.remove('hidden');

    const cwd = await window.api.getProjectPath() || await window.api.getHomePath();
    await window.api.runCommand(command, args, cwd, runId);
  }

  function onRunFinished(exitCode) {
    currentRunId = null;
    document.getElementById('btn-run').classList.remove('hidden');
    document.getElementById('btn-stop').classList.add('hidden');

    const statusRun = document.getElementById('status-running');
    if (statusRun) statusRun.classList.add('hidden');

    const output = document.querySelector('#terminal-container .terminal-output');
    if (output) {
      const elapsed = runStartTime ? ((Date.now() - runStartTime) / 1000).toFixed(2) : '?';
      const exitClass = exitCode === 0 ? 'run-exit-success' : 'run-exit-error';
      const exitText = exitCode === 0 ? '✓ Finished' : `✕ Exited with code ${exitCode}`;
      output.innerHTML += `\n<div class="run-time"><span class="${exitClass}">${exitText}</span> (${elapsed}s)</div>\n`;
      output.scrollTop = output.scrollHeight;
    }
    runStartTime = null;
  }

  async function stopCurrentRun() {
    if (currentRunId) {
      const result = await window.api.stopRun(currentRunId);
      if (result.success) {
        const output = document.querySelector('#terminal-container .terminal-output');
        if (output) {
          output.innerHTML += `\n<span class="terminal-error">⏹ Process terminated by user</span>\n`;
        }
        onRunFinished(-1);
      }
    }
  }

  function clearRunOutput() {
    const output = document.querySelector('#terminal-container .terminal-output');
    if (output) output.innerHTML = '';
  }

  function switchToOutputTab() {
    // placeholder for future terminal tab switching
  }

  function showRunSettings() {
    showSettingsPage();
    setTimeout(() => {
      document.querySelectorAll('.settings-nav-item').forEach(i => {
        i.classList.remove('active');
        if (i.dataset.section === 'run') i.classList.add('active');
      });
      renderSettingsPage('run');
    }, 100);
  }

  // ═══ HELPERS ═══
  function esc(s) {
    return s
      ? s.replace(/&/g, '&amp;').replace(/</g, '&lt;')
        .replace(/>/g, '&gt;').replace(/"/g, '&quot;')
      : '';
  }

  function fileIcon(n) {
    const e = (n || '').split('.').pop().toLowerCase();
    return {
      js: '📜', jsx: '⚛️', ts: '🔷', tsx: '⚛️', py: '🐍', rs: '🦀',
      go: '🐹', java: '☕', c: '🔧', cpp: '🔧', html: '🌐', css: '🎨',
      scss: '🎨', json: '📋', yaml: '📄', yml: '📄', md: '📝', txt: '📄',
      svg: '🖼️', png: '🖼️', sh: '💻', sql: '🗃️', env: '🔒', php: '🐘',
      dockerfile: '🐳', lock: '🔒'
    }[e] || '📄';
  }

  function extToLang(e) {
    return {
      js: 'javascript', jsx: 'javascript', ts: 'typescript', tsx: 'typescript',
      py: 'python', rs: 'rust', go: 'go', java: 'java', c: 'c', cpp: 'cpp',
      h: 'c', cs: 'csharp', html: 'html', css: 'css', scss: 'scss', less: 'less',
      json: 'json', xml: 'xml', yaml: 'yaml', yml: 'yaml', md: 'markdown',
      sh: 'shell', ps1: 'powershell', bat: 'bat', sql: 'sql', php: 'php',
      lua: 'lua', dockerfile: 'dockerfile', vue: 'html', ini: 'ini', env: 'ini'
    }[(e || '').toLowerCase()] || 'plaintext';
  }

  document.addEventListener('DOMContentLoaded', init);
// ═══════════════════════════════════════════
// AI ASSISTANT — Google Gemini + Markdown
// ═══════════════════════════════════════════
let geminiApiKey = '';

function initAI() {
  const apiKeyInput = document.getElementById('gemini-api-key');
  const sendBtn = document.getElementById('btn-ai-send');
  const input = document.getElementById('ai-input');
  const chatContainer = document.getElementById('ai-chat');
  const clearBtn = document.getElementById('btn-ai-clear');

  const DEFAULT_API_KEY = "AIzaSyDPNO62X5EwEsnOEYyo2Qqeg5q-AEr2SM8";

  geminiApiKey = localStorage.getItem('geminiApiKey') || DEFAULT_API_KEY;

  if (geminiApiKey) {
    apiKeyInput.value = (geminiApiKey === DEFAULT_API_KEY) 
      ? "•••••••••••••••••••••••••••••••• (default)" 
      : geminiApiKey;
  }

  apiKeyInput.addEventListener('change', () => {
    const newKey = apiKeyInput.value.trim();
    if (newKey && newKey.length > 30) {
      geminiApiKey = newKey;
      localStorage.setItem('geminiApiKey', newKey);
      notify('Gemini API Key сохранён', 'success');
    }
  });

  sendBtn.onclick = () => sendAIRequest(input.value.trim());
  
  input.addEventListener('keypress', e => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendAIRequest(input.value.trim());
    }
  });

  clearBtn.onclick = () => {
    chatContainer.innerHTML = '';
    notify('Чат очищен', 'info');
  };

  // Быстрые действия
  document.querySelectorAll('.ai-suggest-btn').forEach(btn => {
    btn.onclick = async () => {
      const action = btn.dataset.action;
      let prompt = '';

      const selected = editor?.getModel()?.getValueInRange(editor.getSelection()) || '';
      const fullCode = editor?.getModel()?.getValue() || '';

      switch (action) {
        case 'explain':
          prompt = selected 
            ? `Объясни этот код подробно, шаг за шагом:\n\n${selected}`
            : `Объясни текущий файл. Дай понятный обзор:\n\n${fullCode.substring(0, 7000)}`;
          break;
        case 'refactor':
          prompt = `Отрефакторь этот код. Сделай его чище, эффективнее и современнее. Верни только исправленный код в Markdown:\n\n${selected || fullCode}`;
          break;
        case 'fix':
          prompt = `Найди и исправь все ошибки и баги в этом коде. Объясни проблемы и дай исправленную версию:\n\n${selected || fullCode}`;
          break;
      }

      if (prompt) {
        input.value = prompt;
        await sendAIRequest(prompt);
      }
    };
  });
}

// ====================== ЗАПРОС К GEMINI ======================
async function sendAIRequest(userPrompt) {
  if (!userPrompt) return;

  if (!geminiApiKey || geminiApiKey.length < 30) {
    notify('Gemini API Key не установлен', 'error');
    return;
  }

  const chatContainer = document.getElementById('ai-chat');
  const input = document.getElementById('ai-input');

  addChatMessage('user', userPrompt);
  input.value = '';

  const loadingId = 'ai-loading-' + Date.now();
  chatContainer.innerHTML += `
    <div id="${loadingId}" class="ai-message ai-assistant">
      <strong>Gemini</strong><br>
      <span style="opacity:0.7">Думаю...</span>
    </div>`;
  chatContainer.scrollTop = chatContainer.scrollHeight;

  try {
    const model = "gemini-2.5-flash";

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiApiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: userPrompt }] }],
          generationConfig: {
            temperature: 0.4,
            maxOutputTokens: 4096,
          }
        })
      }
    );

    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const data = await response.json();
    document.getElementById(loadingId)?.remove();

    if (data.candidates?.[0]?.content?.parts?.[0]?.text) {
      const aiText = data.candidates[0].content.parts[0].text;
      addChatMessage('assistant', aiText);
    } else if (data.error) {
      addChatMessage('assistant', `Ошибка API: ${data.error.message}`, true);
    } else {
      addChatMessage('assistant', 'Пустой ответ от Gemini', true);
    }

  } catch (err) {
    document.getElementById(loadingId)?.remove();
    addChatMessage('assistant', `Ошибка: ${err.message}`, true);
    console.error(err);
  }

  chatContainer.scrollTop = chatContainer.scrollHeight;
}

// ====================== Markdown-поддержка ======================
function addChatMessage(role, text, isError = false) {
  const chatContainer = document.getElementById('ai-chat');
  const isUser = role === 'user';

  const msg = document.createElement('div');
  msg.className = `ai-message ${isUser ? 'ai-user' : 'ai-assistant'}`;

  if (isUser) {
    msg.innerHTML = `
      <strong>Ты</strong><br>
      <div style="white-space:pre-wrap; word-break:break-word; margin-top:4px;">${esc(text)}</div>
    `;
  } else {
    // Для ответов ИИ — рендерим Markdown
    const rendered = simpleMarkdownRender(text);
    msg.innerHTML = `
      <strong>Gemini</strong><br>
      <div class="ai-markdown">${rendered}</div>
    `;
  }

  if (isError) msg.style.color = 'var(--red)';

  chatContainer.appendChild(msg);
  chatContainer.scrollTop = chatContainer.scrollHeight;
}

// Простой Markdown рендерер (без внешних библиотек)
function simpleMarkdownRender(markdown) {
  let html = esc(markdown);

  // Кодовые блоки ```language ... ```
  html = html.replace(/```(\w*)\n([\s\S]*?)```/g, (match, lang, code) => {
    return `<pre><code class="language-${lang || 'plaintext'}">${esc(code.trim())}</code></pre>`;
  });

  // Inline код `code`
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');

  // Жирный **text** и *text*
  html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*([^*]+)\*/g, '<em>$1</em>');

  // Заголовки
  html = html.replace(/^### (.*$)/gm, '<h3>$1</h3>');
  html = html.replace(/^## (.*$)/gm, '<h2>$1</h2>');
  html = html.replace(/^# (.*$)/gm, '<h1>$1</h1>');

  // Списки
  html = html.replace(/^\- (.*$)/gm, '<li>$1</li>');
  html = html.replace(/(<li>.*<\/li>)/gs, '<ul>$1</ul>');

  // Ссылки
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank">$1</a>');

  return html;
}

function esc(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// Запуск
initAI();
})();
