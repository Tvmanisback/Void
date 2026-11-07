/* Void OS */
(() => {
'use strict';

const ICONS = {
  browser: 'icons/browser.svg',
  voidcode: 'icons/voidcode.svg',
  terminal: 'icons/terminal.svg',
  files: 'icons/files.svg',
  notes: 'icons/notes.svg',
  store: 'icons/store.svg',
  settings: 'icons/settings.svg',
  about: 'icons/about.svg'
};

function iconImg(src){ return `<img src="${src}" width="26" height="26" alt="" draggable="false">`; }
function iconImgSmall(src){ return `<img src="${src}" width="18" height="18" alt="" draggable="false">`; }

let zCounter = 20;
const openWindows = new Map();
let activeId = null;
const monacoEditors = new Map();

const APPS = [
  { id:'browser', name:'Void Browser', icon:ICONS.browser, desktop:true, width:960, height:640, create:createBrowser },
  { id:'voidcode', name:'VoidCode', icon:ICONS.voidcode, desktop:true, width:980, height:640, create:createVoidCode },
  { id:'terminal', name:'Terminal', icon:ICONS.terminal, desktop:true, width:700, height:440, create:createTerminal },
  { id:'files', name:'Files', icon:ICONS.files, desktop:true, width:720, height:480, create:createFiles },
  { id:'notes', name:'Notes', icon:ICONS.notes, desktop:true, width:700, height:500, create:createNotes },
  { id:'store', name:'TycoreStore', icon:ICONS.store, desktop:true, width:780, height:520, create:createStore },
  { id:'settings', name:'Settings', icon:ICONS.settings, desktop:false, width:480, height:400, create:createSettings },
  { id:'about', name:'About Void', icon:ICONS.about, desktop:false, width:440, height:380, create:createAbout }
];

const LS = {
  get(k,d){ try{ return JSON.parse(localStorage.getItem('void_'+k)) ?? d }catch{ return d } },
  set(k,v){ localStorage.setItem('void_'+k, JSON.stringify(v)) }
};

const isMobile = () => window.innerWidth < 768 || /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
function bindActivation(element, handler){
  if(!element) return;
  let lastTouch=0;
  element.addEventListener('pointerup', event=>{
    if(event.pointerType!=='touch' && event.pointerType!=='pen') return;
    if(event.button!==0) return;
    event.preventDefault();
    lastTouch=Date.now();
    handler(event);
  });
  element.addEventListener('click', event=>{
    if(Date.now()-lastTouch<800){ event.preventDefault(); return; }
    handler(event);
  });
}

function initAuth(){
  window.VoidAuth.init(user=>{
    const authScreen=document.getElementById('auth-screen');
    const desktop=document.getElementById('desktop');
    authScreen.classList.add('hidden');
    desktop.classList.remove('hidden');
    const name=user.user_metadata?.display_name||user.email?.split('@')[0]||'Void User';
    document.querySelector('.start-name').textContent=name;
    document.querySelector('.start-sub').textContent=user.email||'Signed in';
    document.querySelector('.avatar').textContent=name.charAt(0).toUpperCase();
    initDesktop();initStartMenu();startClock();
    if(!isMobile()) openApp('about');
  });
}

function signOutVoid(){
  window.VoidAuth.signOut();
  document.getElementById('desktop').classList.add('hidden');
  document.getElementById('auth-screen').classList.remove('hidden');
  document.getElementById('auth-form').reset();
  document.getElementById('auth-message').textContent='';
}

function bootVoidOS(){
  const bootScreen=document.getElementById('boot-screen');
  if(!bootScreen||bootVoidOS.started)return;
  bootVoidOS.started=true;
  setTimeout(()=>{
    bootScreen.classList.add('fade');
    setTimeout(()=>{
      bootScreen.classList.add('hidden');
      try{initAuth();}
      catch(error){
        console.error('Void OS startup failed:',error);
        const message=document.createElement('div');
        message.style.cssText='position:fixed;inset:12px;z-index:2000;padding:18px;background:#241018;color:#fff;border:1px solid #ef4444;border-radius:12px;font:14px/1.5 system-ui;overflow:auto';
        message.textContent='Void OS could not initialize authentication: '+(error.message||String(error));
        document.body.appendChild(message);
      }
    },450);
  },1400);
}

if(document.readyState === 'loading'){
  document.addEventListener('DOMContentLoaded', bootVoidOS, {once:true});
} else {
  bootVoidOS();
}

function initDesktop(){
  const c = document.getElementById('desktop-icons');
  c.innerHTML = '';
  APPS.filter(a=>a.desktop).forEach(app=>{
    const el = document.createElement('div');
    el.className = 'desktop-icon';
    el.innerHTML = `<div class="icon-img">${iconImg(app.icon)}</div><span>${app.name}</span>`;
    // Open apps with one click on desktop and mobile.
    el.addEventListener('click', ()=>openApp(app.id));
    c.appendChild(el);
  });
}

function initStartMenu(){
  const list = document.getElementById('start-apps');
  const startButton = document.getElementById('start-btn');
  const powerButton = document.getElementById('power-btn');
  if(!list || !startButton || !powerButton) throw new Error('Start menu elements are missing');

  list.innerHTML = '';
  APPS.forEach(app=>{
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'start-app';
    btn.dataset.appId = app.id;
    btn.innerHTML = `<div class="app-icon">${iconImgSmall(app.icon)}</div><span>${app.name}</span>`;
    list.appendChild(btn);
  });

  // Use one delegated handler so app buttons keep working after the menu is rebuilt.
  list.onclick = e=>{
    const btn = e.target.closest('button[data-app-id]');
    if(!btn || !list.contains(btn)) return;
    e.preventDefault();
    const appId = btn.dataset.appId;
    closeStartMenu();
    openApp(appId);
  };
  startButton.onclick = e=>{ e.preventDefault(); toggleStartMenu(); };
  powerButton.onclick = ()=>signOutVoid();

  if(!initStartMenu.outsideClickBound){
    document.addEventListener('click', e=>{
      const menu = document.getElementById('start-menu');
      const start = document.getElementById('start-btn');
      if(menu && start && !menu.classList.contains('hidden') && !menu.contains(e.target) && !start.contains(e.target)) closeStartMenu();
    });
    initStartMenu.outsideClickBound = true;
  }
}
function toggleStartMenu(){
  document.getElementById('start-menu').classList.toggle('hidden');
  document.getElementById('start-btn').classList.toggle('active');
}
function closeStartMenu(){
  document.getElementById('start-menu').classList.add('hidden');
  document.getElementById('start-btn').classList.remove('active');
}

function updateTaskbar(){
  const bar = document.getElementById('taskbar-apps');
  bar.innerHTML = '';
  openWindows.forEach((win,id)=>{
    const btn = document.createElement('button');
    btn.className = 'taskbar-item'+(id===activeId?' active':'');
    btn.innerHTML = `<span class="dot"></span>${win.title}`;
    btn.onclick = ()=>{
      if(win.el.classList.contains('minimized')||id!==activeId){ focusWindow(id); win.el.classList.remove('minimized'); }
      else { win.el.classList.add('minimized'); activeId=null; updateTaskbar(); }
    };
    bar.appendChild(btn);
  });
}

function openApp(appId){
  for(const [id,win] of openWindows){
    if(win.appId===appId){ focusWindow(id); win.el.classList.remove('minimized'); return; }
  }
  const app = APPS.find(a=>a.id===appId);
  if(!app) return;
  const id = 'win-'+Date.now()+Math.random().toString(36).slice(2,5);
  const el = document.createElement('div');
  el.className = 'window';
  el.dataset.id = id;

  let w = app.width || 700;
  let h = app.height || 500;
  if(isMobile()){
    w = Math.min(window.innerWidth - 12, w);
    h = Math.min(window.innerHeight - 70, h);
    el.style.left = '6px';
    el.style.top = '6px';
  } else {
    el.style.left = Math.max(40,(innerWidth-w)/2+(openWindows.size*24)%120)+'px';
    el.style.top = Math.max(30,(innerHeight-h-60)/2+(openWindows.size*20)%80)+'px';
  }
  el.style.width = w+'px';
  el.style.height = h+'px';

  el.innerHTML = `
    <div class="titlebar">
      <div class="title">${iconImgSmall(app.icon)}<span>${app.name}</span></div>
      <div class="controls">
        <button type="button" class="ctrl min" aria-label="Minimize">─</button>
        <button type="button" class="ctrl max" aria-label="Maximize">□</button>
        <button type="button" class="ctrl close" aria-label="Close window">✕</button>
      </div>
    </div>
    <div class="window-body"></div>
    <div class="resize-handle n"></div><div class="resize-handle s"></div>
    <div class="resize-handle e"></div><div class="resize-handle w"></div>
    <div class="resize-handle ne"></div><div class="resize-handle nw"></div>
    <div class="resize-handle se"></div><div class="resize-handle sw"></div>`;
  // Attach the window before initializing its app. Some app UIs (notably
  // Monaco) need to be in the document before they can bind correctly.
  document.getElementById('windows-container').appendChild(el);
  openWindows.set(id,{el,appId,title:app.name});
  try {
    app.create(el.querySelector('.window-body'), id);
  } catch(error) {
    console.error('Void app failed to open:', appId, error);
    const body = el.querySelector('.window-body');
    body.innerHTML = '';
    const message = document.createElement('div');
    message.style.cssText = 'padding:20px;color:#fff;font:14px/1.5 system-ui;white-space:pre-wrap';
    message.textContent = app.name + ' could not open: ' + (error && error.message ? error.message : String(error));
    body.appendChild(message);
  }
  // Delegate window-control clicks from the window itself. This keeps the
  // controls responsive even after app content is rebuilt.
  el.addEventListener('click', event=>{
    const control=event.target.closest('.ctrl');
    if(!control || !el.contains(control)) return;
    event.preventDefault();
    event.stopPropagation();
    if(control.classList.contains('close')) closeWindow(id);
    else if(control.classList.contains('min')){
      el.classList.add('minimized');
      if(activeId===id) activeId=null;
      updateTaskbar();
    } else if(control.classList.contains('max')){
      el.classList.toggle('maximized');
    }
  });
  el.querySelectorAll('.ctrl').forEach(control=>{
    control.addEventListener('pointerdown', event=>event.stopPropagation());
  });
  // Explicitly focus editable controls on touch devices. Some mobile browsers
  // do not focus nested controls reliably after a window receives pointer events.
  el.addEventListener('pointerdown', event=>{
    const field=event.target.closest('input, textarea, select, [contenteditable="true"]');
    if(!field || !el.contains(field)) return;
    try{ field.focus({preventScroll:true}); }catch{ field.focus(); }
  }, true);
  el.addEventListener('pointerdown', event=>{
    if(!event.target.closest('.ctrl')) focusWindow(id);
  });
  makeDraggable(el); makeResizable(el);
  focusWindow(id); updateTaskbar();
}

function focusWindow(id){
  const win=openWindows.get(id); if(!win) return;
  zCounter++; win.el.style.zIndex=zCounter;
  document.querySelectorAll('.window').forEach(w=>w.classList.remove('active'));
  win.el.classList.add('active'); activeId=id; updateTaskbar();
}
function closeWindow(id){
  const win=openWindows.get(id); if(!win) return;
  if(monacoEditors.has(id)){ monacoEditors.get(id).dispose(); monacoEditors.delete(id); }
  win.el.remove(); openWindows.delete(id);
  if(activeId===id) activeId=null; updateTaskbar();
}

function makeDraggable(el){
  const bar = el.querySelector('.titlebar');
  if(!bar) return;

  let dragPointer = null;
  let offsetX = 0;
  let offsetY = 0;

  function stopDrag(){
    if(dragPointer === null) return;
    dragPointer = null;
    window.removeEventListener('pointermove', moveDrag);
    window.removeEventListener('pointerup', stopDrag);
    window.removeEventListener('pointercancel', stopDrag);
  }

  function moveDrag(e){
    if(dragPointer === null || e.pointerId !== dragPointer) return;
    // Keep the title bar reachable so a window cannot be dragged completely away.
    const maxLeft = Math.max(0, window.innerWidth - 80);
    const maxTop = Math.max(0, window.innerHeight - 90);
    el.style.left = Math.min(maxLeft, Math.max(0, e.clientX - offsetX)) + 'px';
    el.style.top = Math.min(maxTop, Math.max(0, e.clientY - offsetY)) + 'px';
  }

  bar.addEventListener('pointerdown', e=>{
    // Only drag from the title bar itself, never from its buttons or controls.
    if(e.button !== 0 || e.target.closest('button, input, a, .ctrl') || el.classList.contains('maximized')) return;
    dragPointer = e.pointerId;
    offsetX = e.clientX - el.offsetLeft;
    offsetY = e.clientY - el.offsetTop;
    window.addEventListener('pointermove', moveDrag);
    window.addEventListener('pointerup', stopDrag);
    window.addEventListener('pointercancel', stopDrag);
  });
}
function makeResizable(el){
  el.querySelectorAll('.resize-handle').forEach(handle=>{
    handle.addEventListener('pointerdown',event=>{
      if(el.classList.contains('maximized') || event.button!==0) return;
      event.preventDefault(); event.stopPropagation();
      const dir=handle.className.split(' ')[1];
      const sx=event.clientX,sy=event.clientY,sw=el.offsetWidth,sh=el.offsetHeight,sl=el.offsetLeft,st=el.offsetTop;
      const pointerId=event.pointerId;
      try{handle.setPointerCapture(pointerId);}catch{}
      function move(ev){
        if(ev.pointerId!==pointerId) return;
        let w=sw,h=sh,l=sl,t=st;
        const dx=ev.clientX-sx,dy=ev.clientY-sy;
        if(dir.includes('e')) w=Math.max(280,sw+dx);
        if(dir.includes('s')) h=Math.max(200,sh+dy);
        if(dir.includes('w')){ w=Math.max(280,sw-dx); l=sl+(sw-w); }
        if(dir.includes('n')){ h=Math.max(200,sh-dy); t=st+(sh-h); }
        el.style.width=w+'px'; el.style.height=h+'px'; el.style.left=l+'px'; el.style.top=t+'px';
      }
      function stop(ev){
        if(ev.pointerId!==pointerId) return;
        handle.removeEventListener('pointermove',move);
        handle.removeEventListener('pointerup',stop);
        handle.removeEventListener('pointercancel',stop);
      }
      handle.addEventListener('pointermove',move);
      handle.addEventListener('pointerup',stop);
      handle.addEventListener('pointercancel',stop);
    });
  });
}

function startClock(){
  const el=document.getElementById('clock');
  function tick(){
    const n=new Date();
    const dd=String(n.getDate()).padStart(2,'0');
    const mm=String(n.getMonth()+1).padStart(2,'0');
    const yyyy=n.getFullYear();
    const hh=String(n.getHours()).padStart(2,'0');
    const mi=String(n.getMinutes()).padStart(2,'0');
    el.innerHTML = `${dd}/${mm}/${yyyy}<br>${hh}:${mi}`;
  }
  tick(); setInterval(tick,10000);
}

/* ===== Proxy helpers ===== */
const PROXY_LIST = [
  (url) => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
  (url) => `https://corsproxy.io/?${encodeURIComponent(url)}`,
  (url) => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}`,
];

let currentProxyIndex = 0;

function buildProxyUrl(target) {
  return PROXY_LIST[currentProxyIndex](target);
}

function nextProxy() {
  currentProxyIndex = (currentProxyIndex + 1) % PROXY_LIST.length;
}

/* ===== Void Start Page (no URL) ===== */
function getStartPageHTML() {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;
background:#0b0b12;color:#e8e6f0;font-family:system-ui,-apple-system,sans-serif;padding:24px}
.logo{font-size:64px;font-weight:700;letter-spacing:-2px;margin-bottom:8px;
background:linear-gradient(135deg,#a78bfa,#6d28d9);-webkit-background-clip:text;-webkit-text-fill-color:transparent}
.tag{color:#9b97b0;font-size:14px;margin-bottom:32px}
form{width:100%;max-width:520px;display:flex;gap:0;border-radius:28px;overflow:hidden;
border:1px solid #2a2a38;background:#12121a;box-shadow:0 8px 32px rgba(0,0,0,.4)}
input{flex:1;height:52px;border:none;background:transparent;color:#e8e6f0;padding:0 22px;font-size:16px;outline:none}
button{height:52px;padding:0 22px;border:none;background:#8b5cf6;color:#fff;font-weight:600;cursor:pointer;font-size:15px}
button:hover{filter:brightness(1.1)}
.links{margin-top:28px;display:flex;gap:18px;flex-wrap:wrap;justify-content:center}
.links a{color:#9b97b0;text-decoration:none;font-size:13px}
.links a:hover{color:#a78bfa}
</style></head><body>
<div class="logo">Void</div>
<div class="tag">Search the web through the void</div>
<form id="s"><input id="q" placeholder="Search or enter URL" autofocus autocomplete="off"/><button type="submit">Search</button></form>
<div class="links">
<a href="#" data-url="https://wikipedia.org">Wikipedia</a>
<a href="#" data-url="https://github.com">GitHub</a>
<a href="#" data-url="https://reddit.com">Reddit</a>
<a href="#" data-url="https://duckduckgo.com">DuckDuckGo</a>
</div>
<script>
document.getElementById('s').onsubmit=function(e){
  e.preventDefault();
  var q=document.getElementById('q').value.trim();
  if(!q) return;
  var url = /^https?:\\/\\//i.test(q) ? q : (q.includes('.') && !q.includes(' ') ? 'https://'+q : 'https://duckduckgo.com/?q='+encodeURIComponent(q));
  parent.postMessage({type:'void-navigate',url:url},'*');
};
document.querySelectorAll('[data-url]').forEach(function(a){
  a.onclick=function(e){ e.preventDefault(); parent.postMessage({type:'void-navigate',url:a.dataset.url},'*'); };
});
</script></body></html>`;
}

/* ===== Browser with Tabs ===== */
function createBrowser(container) {
  let tabs = [{ id: 1, title: 'New Tab', url: null, history: [], histIndex: -1 }];
  let activeTab = 1;
  let nextId = 2;
  let loadWatchdog = null;
  let loadAttempts = 0;

  container.innerHTML = `
  <div class="browser" style="display:flex;flex-direction:column;height:100%">
    <div class="browser-tabs" id="browser-tabs"></div>
    <div class="browser-toolbar">
      <button class="back-btn" title="Back">←</button>
      <button class="fwd-btn" title="Forward">→</button>
      <button class="reload-btn" title="Reload">↻</button>
      <form class="url-form" style="flex:1;display:flex;gap:6px">
        <input class="url-input" type="text" placeholder="Search or enter URL" spellcheck="false"/>
        <button type="submit" class="go-btn">Go</button>
      </form>
      <button class="new-tab-btn" title="New Tab">+</button>
    </div>
    <div style="flex:1;position:relative;min-height:0">
      <iframe class="browser-frame" sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals" referrerpolicy="no-referrer"></iframe>
      <div class="browser-error" style="display:none;position:absolute;inset:0;background:#0b0b12;color:#e8e6f0;flex-direction:column;align-items:center;justify-content:center;gap:16px;padding:24px;text-align:center;z-index:5">
        <div style="font-size:42px;opacity:.6">⚠</div>
        <div style="font-size:16px;font-weight:600">Page failed to load</div>
        <div class="error-detail" style="font-size:13px;color:#9b97b0;max-width:360px"></div tri>
        <button class="retry-btn" style="margin-top:8px;padding:10px 22px;border:none;border-radius:8px;background:#8b5cf6;color:#fff;font-weight:600;cursor:pointer">Retry</button>
      </div>
    </div>
    <div class="browser-status"><span class="status-text">Ready</span></div>
  </div>`;

  const tabsEl = container.querySelector('#browser-tabs');
  const iframe = container.querySelector('.browser-frame');
  const input = container.querySelector('.url-input');
  const form = container.querySelector('.url-form');
  const status = container.querySelector('.status-text');
  const errorOverlay = container.querySelector('.browser-error');
  const errorDetail = container.querySelector('.error-detail');

  function getTab() { return tabs.find(t => t.id === activeTab); }

  function hideError() {
    errorOverlay.style.display = 'none';
  }

  function showError(msg) {
    errorDetail.textContent = msg || 'The proxy could not reach this site.';
    errorOverlay.style.display = 'flex';
    status.textContent = 'Failed';
  }

  function renderTabs() {
    tabsEl.innerHTML = '';
    tabs.forEach(t => {
      const el = document.createElement('div');
      el.className = 'browser-tab' + (t.id === activeTab ? ' active' : '');
      el.innerHTML = `<span class="tab-title">${t.title}</span><button class="tab-close" data-id="${t.id}">×</button>`;
      bindActivation(el, (e) => {
        if (e.target.closest('.tab-close')) return;
        switchTab(t.id);
      });
      bindActivation(el.querySelector('.tab-close'), (e) => {
        e.stopPropagation();
        closeTab(t.id);
      });
      tabsEl.appendChild(el);
    });
  }

  function switchTab(id) {
    activeTab = id;
    const t = getTab();
    input.value = t.url || '';
    hideError();
    if (t.url) {
      status.textContent = 'Loading…';
      loadPage(t.url);
    } else {
      showStartPage();
    }
    renderTabs();
    updateNav();
  }

  function closeTab(id) {
    if (tabs.length === 1) {
      tabs[0] = { id: tabs[0].id, title: 'New Tab', url: null, history: [], histIndex: -1 };
      showStartPage();
      input.value = '';
      renderTabs();
      return;
    }
    const idx = tabs.findIndex(t => t.id === id);
    tabs.splice(idx, 1);
    if (activeTab === id) {
      activeTab = tabs[Math.max(0, idx - 1)].id;
      switchTab(activeTab);
    } else renderTabs();
  }

  function newTab() {
    const t = { id: nextId++, title: 'New Tab', url: null, history: [], histIndex: -1 };
    tabs.push(t);
    activeTab = t.id;
    showStartPage();
    input.value = '';
    renderTabs();
    updateNav();
  }

  function showStartPage() {
    status.textContent = 'Start';
    hideError();
    iframe.removeAttribute('src');
    iframe.srcdoc = getStartPageHTML();
  }

  function loadPage(url) {
    hideError();
    status.textContent = 'Loading…';
    if (loadWatchdog) clearTimeout(loadWatchdog);

    loadAttempts = 0;
    tryLoad(url);
  }

  function tryLoad(url) {
    loadAttempts++;
    const proxyUrl = buildProxyUrl(url);

    iframe.onload = () => {
      if (loadWatchdog) clearTimeout(loadWatchdog);
      // Heuristic: blank / very short pages often mean the proxy failed
      try {
        const doc = iframe.contentDocument;
        if (doc && doc.body && doc.body.innerText.trim().length < 30 && loadAttempts < PROXY_LIST.length) {
          // likely a bad response → try next proxy
          nextProxy();
          tryLoad(url);
          return;
        }
      } catch (_) { /* cross-origin is expected with some proxies */ }

      status.textContent = 'Loaded';
      hideError();
    };

    iframe.onerror = () => {
      if (loadAttempts < PROXY_LIST.length) {
        nextProxy();
        tryLoad(url);
      } else {
        showError('All proxies failed. The site may block embedding or the proxies are down.');
      }
    };

    iframe.src = proxyUrl;

    loadWatchdog = setTimeout(() => {
      if (status.textContent === 'Loading…') {
        if (loadAttempts < PROXY_LIST.length) {
          nextProxy();
          tryLoad(url);
        } else {
          showError('Timed out. Proxies are slow or blocked for this site.');
        }
      }
    }, 12000);
  }

  function navigate(raw, push = true) {
    let url = (raw || '').trim();
    if (!url) { showStartPage(); return; }

    if (!/^https?:\/\//i.test(url)) {
      if (url.includes('.') && !url.includes(' ')) url = 'https://' + url;
      else url = 'https://duckduckgo.com/?q=' + encodeURIComponent(url);
    }

    const t = getTab();
    t.url = url;
    t.title = url.replace(/^https?:\/\//, '').split('/')[0] || 'Tab';

    if (push) {
      t.history.splice(t.histIndex + 1);
      t.history.push(url);
      t.histIndex = t.history.length - 1;
    }

    input.value = url;
    renderTabs();
    updateNav();
    loadPage(url);
  }

  function updateNav() {
    const t = getTab();
    container.querySelector('.back-btn').disabled = !t || t.histIndex <= 0;
    container.querySelector('.fwd-btn').disabled = !t || t.histIndex >= t.history.length - 1;
  }

  form.onsubmit = e => { e.preventDefault(); navigate(input.value); };

  bindActivation(container.querySelector('.new-tab-btn'), newTab);
  bindActivation(container.querySelector('.back-btn'), () => {
    const t = getTab();
    if (t && t.histIndex > 0) {
      t.histIndex--;
      navigate(t.history[t.histIndex], false);
    }
  });
  bindActivation(container.querySelector('.fwd-btn'), () => {
    const t = getTab();
    if (t && t.histIndex < t.history.length - 1) {
      t.histIndex++;
      navigate(t.history[t.histIndex], false);
    }
  });
  bindActivation(container.querySelector('.reload-btn'), () => {
    const t = getTab();
    if (t && t.url) navigate(t.url, false);
    else showStartPage();
  });
  bindActivation(container.querySelector('.retry-btn'), () => {
    const t = getTab();
    if (t && t.url) {
      nextProxy(); // force different proxy on manual retry
      loadPage(t.url);
    }
  });

  const handleBrowserMessage = (e) => {
    if (e.source !== iframe.contentWindow) return;
    if (e.data && e.data.type === 'void-navigate') {
      navigate(e.data.url);
    }
  };
  window.addEventListener('message', handleBrowserMessage);

  renderTabs();
  showStartPage();
}

/* ===== VoidCode ===== */
function createVoidCode(container, winId){
