/* Void OS - Core */
(() => {
  'use strict';

  // ---------- State ----------
  let zCounter = 20;
  const openWindows = new Map();
  let activeId = null;
  const monacoEditors = new Map();

  // ---------- Apps Registry ----------
  const APPS = [
    {
      id: 'browser',
      name: 'Void Browser',
      icon: '🌐',
      desktop: true,
      width: 960,
      height: 640,
      create: createBrowser
    },
    {
      id: 'voidcode',
      name: 'VoidCode',
      icon: ' enthralled',
      desktop: true,
      width: 900,
      height: 620,
      create: createVoidCode
    },
    {
      id: 'settings',
      name: 'Settings',
      icon: '⚙️',
      desktop: true,
      width: 480,
      height: 420,
      create: createSettings
    },
    {
      id: 'about',
      name: 'About Void',
      icon: '🌀',
      desktop: false,
      width: 440,
      height: 380,
      create: createAbout
    }
  ];

  // Force correct icons
  APPS[1].icon = ' enthralled';

  // ---------- Boot ----------
  window.addEventListener('DOMContentLoaded', () => {
    APPS[1].icon = ' enthralled';

    setTimeout(() => {
      document.getElementById('boot-screen').classList.add('fade');
      setTimeout(() => {
        document.getElementById('boot-screen').classList.add('hidden');
        document.getElementById('desktop').classList.remove('hidden');
        initDesktop();
        initTaskbar();
        initStartMenu();
        startClock();
        openApp('about');
      }, 450);
    }, 1700);
  });

  function initDesktop() {
    const container = document.getElementById('desktop-icons');
    APPS.filter(a => a.desktop).forEach(app => {
      const el = document.createElement('div');
      el.className = 'desktop-icon';
      el.innerHTML = `<div class="icon-img">${app.icon}</div><span>${app.name}</span>`;
      el.addEventListener('dblclick', () => openApp(app.id));
      container.appendChild(el);
    });
  }

  function initStartMenu() {
    const list = document.getElementById('start-apps');
    APPS.forEach(app => {
      const btn = document.createElement('button');
      btn.className = 'start-app';
      btn.innerHTML = `<div class="app-icon">${app.icon}</div><span>${app.name}</span>`;
      btn.addEventListener('click', () => {
        openApp(app.id);
        closeStartMenu();
      });
      list.appendChild(btn);
    });

    document.getElementById('start-btn').addEventListener('click', toggleStartMenu);
    document.getElementById('power-btn').addEventListener('click', () => location.reload());

    document.addEventListener('click', (e) => {
      const menu = document.getElementById('start-menu');
      const btn = document.getElementById('start-btn');
      if (!menu.classList.contains('hidden') && !menu.contains(e.target) && !btn.contains(e.target)) {
        closeStartMenu();
      }
    });
  }

  function toggleStartMenu() {
    const menu = document.getElementById('start-menu');
    const btn = document.getElementById('start-btn');
    menu.classList.toggle('hidden');
    btn.classList.toggle('active');
  }
  function closeStartMenu() {
    document.getElementById('start-menu').classList.add('hidden');
    document.getElementById('start-btn').classList.remove('active');
  }

  function initTaskbar() {}

  function updateTaskbar() {
    const bar = document.getElementById('taskbar-apps');
    bar.innerHTML = '';
    openWindows.forEach((win, id) => {
      const btn = document.createElement('button');
      btn.className = 'taskbar-item' + (id === activeId ? ' active' : '');
      btn.innerHTML = `<span class="dot"></span>${win.title}`;
      btn.addEventListener('click', () => {
        if (win.el.classList.contains('minimized') || id !== activeId) {
          focusWindow(id);
          win.el.classList.remove('minimized');
        } else {
          win.el.classList.add('minimized');
          activeId = null;
          updateTaskbar();
        }
      });
      bar.appendChild(btn);
    });
  }

  function openApp(appId) {
    for (const [id, win] of openWindows) {
      if (win.appId === appId) {
        focusWindow(id);
        win.el.classList.remove('minimized');
        return;
      }
    }

    const app = APPS.find(a => a.id === appId);
    if (!app) return;

    const id = 'win-' + Date.now() + Math.random().toString(36).slice(2, 6);
    const el = document.createElement('div');
    el.className = 'window';
    el.dataset.id = id;

    const w = app.width || 700;
    const h = app.height || 500;
    el.style.width = w + 'px';
    el.style.height = h + 'px';
    el.style.left = Math.max(40, (window.innerWidth - w) / 2 + (openWindows.size * 24) % 120) + 'px';
    el.style.top = Math.max(30, (window.innerHeight - h - 60) / 2 + (openWindows.size * 20) % 80) + 'px';

    el.innerHTML = `
      <div class="titlebar">
        <div class="title">${app.icon} ${app.name}</div>
        <div class="controls">
          <button class="ctrl min" title="Minimize">─</button>
          <button class="ctrl max" title="Maximize">□</button>
          <button class="ctrl close" title="Close">✕</button>
        </div>
      </div>
      <div class="window-body"></div>
      <div class="resize-handle n"></div>
      <div class="resize-handle s"></div>
      <div class="resize-handle e"></div>
      <div class="resize-handle w"></div>
      <div class="resize-handle ne"></div>
      <div class="resize-handle nw"></div>
      <div class="resize-handle se"></div>
      <div class="resize-handle sw"></div>
    `;

    const body = el.querySelector('.window-body');
    app.create(body, id);

    el.querySelector('.close').addEventListener('click', () => closeWindow(id));
    el.querySelector('.min').addEventListener('click', () => {
      el.classList.add('minimized');
      if (activeId === id) activeId = null;
      updateTaskbar();
    });
    el.querySelector('.max').addEventListener('click', () => el.classList.toggle('maximized'));

    el.addEventListener('mousedown', () => focusWindow(id));
    makeDraggable(el);
    makeResizable(el);

    document.getElementById('windows-container').appendChild(el);
    openWindows.set(id, { el, appId, title: app.name });
    focusWindow(id);
    updateTaskbar();
  }

  function focusWindow(id) {
    const win = openWindows.get(id);
    if (!win) return;
    zCounter += 1;
    win.el.style.zIndex = zCounter;
    document.querySelectorAll('.window').forEach(w => w.classList.remove('active'));
    win.el.classList.add('active');
    activeId = id;
    updateTaskbar();
  }

  function closeWindow(id) {
    const win = openWindows.get(id);
    if (!win) return;
    if (monacoEditors.has(id)) {
      monacoEditors.get(id).dispose();
      monacoEditors.delete(id);
    }
    win.el.remove();
    openWindows.delete(id);
    if (activeId === id) activeId = null;
    updateTaskbar();
  }

  function makeDraggable(el) {
    const bar = el.querySelector('.titlebar');
    let ox, oy, dragging = false;

    bar.addEventListener('mousedown', (e) => {
      if (e.target.closest('.ctrl') || el.classList.contains('maximized')) return;
      dragging = true;
      ox = e.clientX - el.offsetLeft;
      oy = e.clientY - el.offsetTop;
      e.preventDefault();
    });

    window.addEventListener('mousemove', (e) => {
      if (!dragging) return;
      el.style.left = Math.max(0, e.clientX - ox) + 'px';
      el.style.top = Math.max(0, e.clientY - oy) + 'px';
    });

    window.addEventListener('mouseup', () => { dragging = false; });
  }

  function makeResizable(el) {
    el.querySelectorAll('.resize-handle').forEach(handle => {
      handle.addEventListener('mousedown', (e) => {
        if (el.classList.contains('maximized')) return;
        e.preventDefault();
        e.stopPropagation();
        const dir = handle.className.split(' ')[1];
        const startX = e.clientX, startY = e.clientY;
        const startW = el.offsetWidth, startH = el.offsetHeight;
        const startL = el.offsetLeft, startT = el.offsetTop;

        function onMove(ev) {
          let w = startW, h = startH, l = startL, t = startT;
          const dx = ev.clientX - startX, dy = ev.clientY - startY;
          if (dir.includes('e')) w = Math.max(320, startW + dx);
          if (dir.includes('s')) h = Math.max(220, startH + dy);
          if (dir.includes('w')) { w = Math.max(320, startW - dx); l = startL + (startW - w); }
          if (dir.includes('n')) { h = Math.max(220, startH - dy); t = startT + (startH - h); }
          el.style.width = w + 'px';
          el.style.height = h + 'px';
          el.style.left = l + 'px';
          el.style.top = t + 'px';
        }
        function onUp() {
          window.removeEventListener('mousemove', onMove);
          window.removeEventListener('mouseup', onUp);
        }
        window.addEventListener('mousemove', onMove);
        window.addEventListener('mouseup', onUp);
      });
    });
  }

  function startClock() {
    const el = document.getElementById('clock');
    function tick() {
      el.textContent = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    tick();
    setInterval(tick, 15000);
  }

  // ==================== APPS ====================

  const PROXIES = [
    { name: 'corsproxy.io', build: (url) => `https://corsproxy.io/?url=${encodeURIComponent(url)}` },
    { name: 'allorigins', build: (url) => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}` },
    { name: 'CORX', build: (url) => `https://corx.envx.cn/fetch?url=${encodeURIComponent(url)}` },
    { name: 'Direct (no proxy)', build: (url) => url }
  ];

  function createBrowser(container) {
    container.innerHTML = `
      <div style="display:flex;flex-direction:column;height:100%">
        <div class="browser-toolbar">
          <button class="back-btn" title="Back">←</button>
          <button class="fwd-btn" title="Forward">→</button>
          <button class="reload-btn" title="Reload">↻</button>
          <form class="url-form">
            <input class="url-input" type="text" placeholder="Enter URL (https://...)" spellcheck="false" />
            <button type="submit" class="go-btn">Go</button>
          </form>
          <select class="proxy-select" title="Proxy backend">
            ${PROXIES.map((p, i) => `<option value="${i}">${p.name}</option>`).join('')}
          </select>
        </div>
        <div style="flex:1;position:relative;min-height:0">
          <iframe class="browser-frame" sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals" referrerpolicy="no-referrer"></iframe>
        </div>
        <div class="browser-status"><span class="status-text">Ready</span></div>
      </div>
    `;

    const iframe = container.querySelector('.browser-frame');
    const input = container.querySelector('.url-input');
    const form = container.querySelector('.url-form');
    const status = container.querySelector('.status-text');
    const proxySelect = container.querySelector('.proxy-select');
    const history = [];
    let histIndex = -1;

    function navigate(raw, push = true) {
      let url = raw.trim();
      if (!url) return;
      if (!/^https?:\/\//i.test(url)) url = 'https://' + url;

      const proxy = PROXIES[parseInt(proxySelect.value, 10)];
      status.textContent = `Loading via ${proxy.name}…`;
      iframe.src = proxy.build(url);

      if (push) {
        history.splice(histIndex + 1);
        history.push(url);
        histIndex = history.length - 1;
      }
      input.value = url;
      updateNavButtons();
    }

    function updateNavButtons() {
      container.querySelector('.back-btn').disabled = histIndex <= 0;
      container.querySelector('.fwd-btn').disabled = histIndex >= history.length - 1;
    }

    form.addEventListener('submit', e => { e.preventDefault(); navigate(input.value); });
    container.querySelector('.back-btn').addEventListener('click', () => {
      if (histIndex > 0) { histIndex--; navigate(history[histIndex], false); }
    });
    container.querySelector('.fwd-btn').addEventListener('click', () => {
      if (histIndex < history.length - 1) { histIndex++; navigate(history[histIndex], false); }
    });
    container.querySelector('.reload-btn').addEventListener('click', () => {
      if (histIndex >= 0) navigate(history[histIndex], false);
    });
    iframe.addEventListener('load', () => { status.textContent = 'Loaded'; });

    input.value = 'https://example.com';
    navigate('https://example.com');
  }

  function createVoidCode(container, winId) {
    container.innerHTML = `
      <div style="display:flex;flex-direction:column;height:100%">
        <div class="code-toolbar">
          <select class="lang-select">
            <option value="javascript">JavaScript</option>
            <option value="typescript">TypeScript</option>
            <option value="html">HTML</option>
            <option value="css">CSS</option>
            <option value="json">JSON</option>
            <option value="python">Python</option>
            <option value="markdown">Markdown</option>
            <option value="plaintext">Plain Text</option>
          </select>
          <button class="run-btn">Run JS</button>
          <button class="fmt-btn">Format</button>
          <span style="flex:1"></span>
          <span style="font-size:12px;color:var(--text-dim)">VoidCode</span>
        </div>
        <div id="monaco-${winId}" style="flex:1;min-height:0"></div>
      </div>
    `;

    const mount = container.querySelector(`#monaco-${winId}`);
    const langSelect = container.querySelector('.lang-select');

    function initEditor() {
      require.config({ paths: { vs: 'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.45.0/min/vs' } });
      require(['vs/editor/editor.main'], () => {
        const editor = monaco.editor.create(mount, {
          value: `// Welcome to VoidCode\n// A lightweight VSCode-style editor inside Void OS\n\nfunction hello(name) {\n  return \`Hello, ${name}! Welcome to the void.\`;\n}\n\nconsole.log(hello('developer'));\n`,
          language: 'javascript',
          theme: 'vs-dark',
          automaticLayout: true,
          fontSize: 14,
          fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
          minimap: { enabled: true },
          scrollBeyondLastLine: false,
          roundedSelection: true,
          padding: { top: 12 }
        });
        monacoEditors.set(winId, editor);

        langSelect.addEventListener('change', () => {
          monaco.editor.setModelLanguage(editor.getModel(), langSelect.value);
        });

        container.querySelector('.fmt-btn').addEventListener('click', () => {
          editor.getAction('editor.action.formatDocument')?.run();
        });

        container.querySelector('.run-btn').addEventListener('click', () => {
          if (langSelect.value !== 'javascript' && langSelect.value !== 'typescript') {
            alert('Run is currently only available for JavaScript');
            return;
          }
          try {
            const result = eval(editor.getValue());
            console.log('VoidCode output:', result);
            alert('Executed. Check the browser console for output.');
          } catch (err) {
            alert('Error: ' + err.message);
          }
        });
      });
    }

    if (window.require) initEditor();
    else setTimeout(initEditor, 400);
  }

  function createSettings(container) {
    container.innerHTML = `
      <div class="app-content">
        <h2>Settings</h2>
        <div class="card">
          <label><input type="checkbox" id="setting-anim" checked /> Window animations</label>
        </div>
        <div class="card">
          <p style="margin:0 0 8px">Default browser proxy</p>
          <select id="default-proxy" style="width:100%;height:34px;border-radius:8px;border:1px solid var(--border);background:var(--bg);color:var(--text);padding:0 10px">
            <option>corsproxy.io</option>
            <option>allorigins</option>
            <option>CORX</option>
          </select>
        </div>
        <div class="card">
          <p style="margin:0">Void OS stores nothing on a server. Everything runs locally in your browser session.</p>
        </div>
      </div>
    `;
  }

  function createAbout(container) {
    container.innerHTML = `
      <div class="app-content">
        <h2>Void OS</h2>
        <p>A complete desktop environment that lives entirely in your browser.</p>
        <div class="card">
          <strong>Included apps</strong>
          <ul style="margin:8px 0 0 18px;color:var(--text-dim);font-size:13px;line-height:1.7">
            <li><strong>Void Browser</strong> – Real proxy browser (multiple backends)</li>
            <li><strong>VoidCode</strong> – Monaco-powered code editor</li>
            <li>Settings & system utilities</li>
          </ul>
        </div>
        <div class="card">
          <p style="margin:0;font-size:13px">Built as a pure frontend experience. No backend required.</p>
        </div>
        <p style="font-size:12px;color:var(--text-dim);margin-top:16px">github.com/Tvmanisback/Void</p>
      </div>
    `;
  }

  window.VoidOS = { openApp, APPS };
})();
