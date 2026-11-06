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

const PROXY_KEY='1ec6a957';
function buildProxyUrl(t){ return `https://corsproxy.io/?key=${PROXY_KEY}&url=${encodeURIComponent(t)}`; }

/* ===== Void Start Page (no URL) ===== */
function getStartPageHTML(){
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
<a href="#" data-url="https://youtube.com">YouTube</a>
</div>
<script>
document.getElementById('s').onsubmit=function(e){
  e.preventDefault();
  var q=document.getElementById('q').value.trim();
  if(!q) return;
  var url = /^https?:\/\//i.test(q) ? q : (q.includes('.') && !q.includes(' ') ? 'https://'+q : 'https://duckduckgo.com/?q='+encodeURIComponent(q));
  parent.postMessage({type:'void-navigate',url:url},'*');
};
document.querySelectorAll('[data-url]').forEach(function(a){
  a.onclick=function(e){ e.preventDefault(); parent.postMessage({type:'void-navigate',url:a.dataset.url},'*'); };
});
</script></body></html>`;
}

/* ===== Browser with Tabs ===== */
function createBrowser(container){
  let tabs = [{ id:1, title:'New Tab', url:null, history:[], histIndex:-1 }];
  let activeTab = 1;
  let nextId = 2;

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
    </div>
    <div class="browser-status"><span class="status-text">Ready</span></div>
  </div>`;

  const tabsEl = container.querySelector('#browser-tabs');
  const iframe = container.querySelector('.browser-frame');
  const input = container.querySelector('.url-input');
  const form = container.querySelector('.url-form');
  const status = container.querySelector('.status-text');

  function getTab(){ return tabs.find(t=>t.id===activeTab); }

  function renderTabs(){
    tabsEl.innerHTML = '';
    tabs.forEach(t=>{
      const el = document.createElement('div');
      el.className = 'browser-tab'+(t.id===activeTab?' active':'');
      el.innerHTML = `<span class="tab-title">${t.title}</span><button class="tab-close" data-id="${t.id}">×</button>`;
      el.onclick = (e)=>{
        if(e.target.classList.contains('tab-close')) return;
        switchTab(t.id);
      };
      el.querySelector('.tab-close').onclick = (e)=>{ e.stopPropagation(); closeTab(t.id); };
      tabsEl.appendChild(el);
    });
  }

  function switchTab(id){
    activeTab = id;
    const t = getTab();
    input.value = t.url || '';
    if(t.url){
      status.textContent = 'Loading…';
      iframe.src = buildProxyUrl(t.url);
    } else {
      showStartPage();
    }
    renderTabs();
    updateNav();
  }

  function closeTab(id){
    if(tabs.length===1){
      // reset to start
      tabs[0] = { id:tabs[0].id, title:'New Tab', url:null, history:[], histIndex:-1 };
      activeTab = tabs[0].id;
      showStartPage();
      input.value = '';
      renderTabs();
      return;
    }
    const idx = tabs.findIndex(t=>t.id===id);
    tabs.splice(idx,1);
    if(activeTab===id){
      activeTab = tabs[Math.max(0,idx-1)].id;
      switchTab(activeTab);
    } else renderTabs();
  }

  function newTab(){
    const t = { id:nextId++, title:'New Tab', url:null, history:[], histIndex:-1 };
    tabs.push(t);
    activeTab = t.id;
    showStartPage();
    input.value = '';
    renderTabs();
    updateNav();
  }

  function showStartPage(){
    status.textContent = 'Start';
    iframe.srcdoc = getStartPageHTML();
  }

  function navigate(raw, push=true){
    let url = (raw||'').trim();
    if(!url){ showStartPage(); return; }

    // treat as search if no protocol and looks like search
    if(!/^https?:\/\//i.test(url)){
      if(url.includes('.') && !url.includes(' ')) url = 'https://' + url;
      else url = 'https://duckduckgo.com/?q=' + encodeURIComponent(url);
    }

    const t = getTab();
    status.textContent = 'Loading…';
    iframe.src = buildProxyUrl(url);
    t.url = url;
    t.title = url.replace(/^https?:\/\//,'').split('/')[0] || 'Tab';
    if(push){
      t.history.splice(t.histIndex+1);
      t.history.push(url);
      t.histIndex = t.history.length-1;
    }
    input.value = url;
    renderTabs();
    updateNav();
  }

  function updateNav(){
    const t = getTab();
    container.querySelector('.back-btn').disabled = !t || t.histIndex <= 0;
    container.querySelector('.fwd-btn').disabled = !t || t.histIndex >= t.history.length-1;
  }

  form.onsubmit = e=>{ e.preventDefault(); navigate(input.value); };
  container.querySelector('.back-btn').onclick = ()=>{
    const t=getTab(); if(t.histIndex>0){ t.histIndex--; navigate(t.history[t.histIndex], false); }
  };
  container.querySelector('.fwd-btn').onclick = ()=>{
    const t=getTab(); if(t.histIndex<t.history.length-1){ t.histIndex++; navigate(t.history[t.histIndex], false); }
  };
  container.querySelector('.reload-btn').onclick = ()=>{
    const t=getTab();
    if(t.url) navigate(t.url, false);
    else showStartPage();
  };
  container.querySelector('.new-tab-btn').onclick = newTab;
  iframe.onload = ()=>{ status.textContent = getTab()?.url ? 'Loaded' : 'Start'; };

  // Only accept navigation requests from this browser window's own start page.
  // Without the source check, every open Void Browser window reacts to the same message.
  const handleBrowserMessage = (e)=>{
    if(e.source !== iframe.contentWindow) return;
    if(e.data && e.data.type==='void-navigate'){
      navigate(e.data.url);
    }
  };
  window.addEventListener('message', handleBrowserMessage);

  renderTabs();
  showStartPage();
}

/* ===== VoidCode ===== */
function createVoidCode(container, winId){
  const files = {
    'main.js': { lang:'javascript', content:`// VoidCode — fully working editor\n\nfunction hello(name) {\n  return \`Hello, ${name}! Welcome to the void.\`;\n}\n\nconsole.log(hello('visitor'));\n` },
    'index.html': { lang:'html', content:`<!DOCTYPE html>\n<html>\n<head>\n  <title>Void</title>\n</head>\n<body>\n  <h1>Hello from VoidCode</h1>\n</body>\n</html>` },
    'style.css': { lang:'css', content:`body {\n  background: #0b0b12;\n  color: #e8e6f0;\n  font-family: system-ui, sans-serif;\n}` }
  };
  let current = 'main.js';

  container.innerHTML = `<div class="vscode">
    <div class="vscode-activity">
      <button class="active" title="Explorer">📄</button>
    </div>
    <div class="vscode-sidebar">
      <div class="vscode-sidebar-header">Explorer</div>
      <div class="vscode-sidebar-content" id="vc-files"></div>
    </div>
    <div class="vscode-main">
      <div class="vscode-tabs" id="vc-tabs"></div>
      <div class="vscode-editor" id="monaco-${winId}"></div>
      <div class="vscode-statusbar">
        <span id="vc-lang">JavaScript</span>
        <span>UTF-8</span>
        <span id="vc-pos">Ln 1, Col 1</span>
        <span style="margin-left:auto"></span>
        <button id="vc-run" style="background:transparent;border:none;color:#fff;cursor:pointer;font-size:12px;padding:0 8px">▶ Run</button>
      </div>
    </div>
  </div>`;

  const filesEl = container.querySelector('#vc-files');
  const tabsEl = container.querySelector('#vc-tabs');
  const langEl = container.querySelector('#vc-lang');
  const posEl = container.querySelector('#vc-pos');
  let editor = null;

  function renderFiles(){
    filesEl.innerHTML = '';
    Object.keys(files).forEach(name=>{
      const el = document.createElement('div');
      el.className = 'vscode-file'+(name===current?' active':'');
      el.textContent = name;
      el.onclick = ()=>openFile(name);
      filesEl.appendChild(el);
    });
  }
  function renderTabs(){
    tabsEl.innerHTML = `<div class="vscode-tab">${current}</div>`;
  }
  function openFile(name){
    if(editor && current){
      files[current].content = editor.getValue();
    }
    current = name;
    const f = files[name];
    if(editor){
      editor.setValue(f.content);
      monaco.editor.setModelLanguage(editor.getModel(), f.lang);
    }
    langEl.textContent = f.lang;
    renderFiles(); renderTabs();
  }

  function init(){
    require.config({paths:{vs:'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.45.0/min/vs'}});
    require(['vs/editor/editor.main'],()=>{
      editor = monaco.editor.create(container.querySelector(`#monaco-${winId}`),{
        value: files[current].content,
        language: files[current].lang,
        theme: 'vs-dark',
        automaticLayout: true,
        fontSize: 14,
        fontFamily: "'JetBrains Mono', monospace",
        minimap: { enabled: !isMobile() },
        scrollBeyondLastLine: false,
        padding: { top: 8 },
        wordWrap: isMobile() ? 'on' : 'off'
      });
      monacoEditors.set(winId, editor);
      editor.onDidChangeCursorPosition(e=>{
        posEl.textContent = `Ln ${e.position.lineNumber}, Col ${e.position.column}`;
      });
      container.querySelector('#vc-run').onclick = ()=>{
        if(files[current].lang !== 'javascript'){ alert('Run only works for JavaScript'); return; }
        try{
          const result = eval(editor.getValue());
          console.log('VoidCode:', result);
          alert('Ran successfully. Check console for output.');
        }catch(err){ alert('Error: '+err.message); }
      };
    });
  }
  renderFiles(); renderTabs();
  if(window.require) init(); else setTimeout(init, 400);
}

/* ===== Terminal ===== */
function createTerminal(container){
  container.innerHTML=`<div class="terminal">
    <div class="terminal-output" id="term-out"></div>
    <div class="terminal-input-line">
      <span class="terminal-prompt">void@os:~$</span>
      <input class="terminal-input" spellcheck="false" autocomplete="off"/>
    </div></div>`;
  const out=container.querySelector('#term-out');
  const input=container.querySelector('.terminal-input');
  function print(t,cls=''){ const d=document.createElement('div'); d.className='terminal-line '+(cls||''); d.textContent=t; out.appendChild(d); out.scrollTop=out.scrollHeight; }
  print('Void Terminal v1.0');
  print('Type "help" for commands.\n');
  const cmds={
    help:()=>print('Commands: help, clear, echo, date, whoami, neofetch, apps'),
    clear:()=>{out.innerHTML=''},
    echo:(a)=>print(a.join(' ')),
    date:()=>print(new Date().toString()),
    whoami:()=>print('void'),
    neofetch:()=>print('Void OS  |  Browser Desktop Environment  |  Pure Frontend'),
    apps:()=>print(APPS.map(a=>a.name).join(', '))
  };
  input.addEventListener('keydown',e=>{
    if(e.key!=='Enter') return;
    const line=input.value.trim(); input.value='';
    print('void@os:~$ '+line,'terminal-cmd');
    if(!line) return;
    const [cmd,...args]=line.split(/\s+/);
    if(cmds[cmd]) cmds[cmd](args);
    else print(`command not found: ${cmd}`,'terminal-err');
  });
  setTimeout(()=>input.focus(),100);
}

function createFiles(container){
  let files=LS.get('files',[{name:'Welcome.txt',type:'file',content:'Welcome to Void OS Files!'},{name:'Projects',type:'folder'}]);
  container.innerHTML=`<div class="fm"><div class="fm-sidebar"><button class="active">📁 Home</button></div>
    <div class="fm-main"><div class="fm-toolbar"><button id="fm-new-file" type="button">+ File</button><button id="fm-new-folder" type="button">+ Folder</button></div>
    <form id="fm-entry-dialog" hidden><input id="fm-entry-name" placeholder="Name" required maxlength="120"/><button type="submit">Create</button><button type="button" id="fm-entry-cancel">Cancel</button></form>
    <div class="fm-list" id="fm-list"></div></div></div>`;
  const list=container.querySelector('#fm-list');
  function render(){
    list.innerHTML='';
    files.forEach(f=>{
      const el=document.createElement('div'); el.className='fm-item';
      el.innerHTML=`<div class="icon">${f.type==='folder'?'📁':'📄'}</div><span>${f.name}</span>`;
      el.ondblclick=()=>{ if(f.type==='file') alert(f.content||'(empty)'); };
      list.appendChild(el);
    });
    LS.set('files',files);
  }
  function showEntryDialog(type){
    const form=container.querySelector('#fm-entry-dialog');
    form.dataset.type=type;
    form.hidden=false;
    const field=container.querySelector('#fm-entry-name');
    field.value='';
    field.placeholder=type==='folder'?'Folder name':'File name';
    field.focus();
  }
  bindActivation(container.querySelector('#fm-new-file'),()=>showEntryDialog('file'));
  bindActivation(container.querySelector('#fm-new-folder'),()=>showEntryDialog('folder'));
  bindActivation(container.querySelector('#fm-entry-cancel'),()=>{container.querySelector('#fm-entry-dialog').hidden=true;});
  container.querySelector('#fm-entry-dialog').addEventListener('submit',event=>{
    event.preventDefault();
    const form=event.currentTarget;
    const name=container.querySelector('#fm-entry-name').value.trim();
    if(!name) return;
    const type=form.dataset.type;
    files.push(type==='folder'?{name,type}:{name,type,content:''});
    form.hidden=true;
    render();
  });
  render();
}

function createNotes(container){
  let notes=LS.get('notes',[{id:1,title:'Welcome',body:'This is your first note in Void OS.\n\nNotes are saved locally.'}]);
  let current=notes[0]?.id||null;
  container.innerHTML=`<div class="notes"><div class="notes-sidebar"><div class="notes-sidebar-header"><span>Notes</span><button id="note-new">+</button></div><div class="notes-list" id="notes-list"></div></div>
    <div class="notes-editor"><input class="notes-title" id="note-title" placeholder="Title"/><textarea class="notes-body" id="note-body" placeholder="Start writing..."></textarea></div></div>`;
  const list=container.querySelector('#notes-list');
  const titleEl=container.querySelector('#note-title');
  const bodyEl=container.querySelector('#note-body');
  function save(){ const n=notes.find(x=>x.id===current); if(n){ n.title=titleEl.value; n.body=bodyEl.value; LS.set('notes',notes); renderList(); } }
  function renderList(){
    list.innerHTML='';
    notes.forEach(n=>{
      const el=document.createElement('div');
      el.className='notes-item'+(n.id===current?' active':'');
      el.innerHTML=`<div class="title">${n.title||'Untitled'}</div><div class="preview">${(n.body||'').slice(0,40)}</div>`;
      el.onclick=()=>{ current=n.id; titleEl.value=n.title; bodyEl.value=n.body; renderList(); };
      list.appendChild(el);
    });
  }
  bindActivation(container.querySelector('#note-new'),()=>{ const id=Date.now(); notes.unshift({id,title:'New Note',body:''}); current=id; titleEl.value='New Note'; bodyEl.value=''; LS.set('notes',notes); renderList(); });
  titleEl.oninput=save; bodyEl.oninput=save;
  if(current){ const n=notes.find(x=>x.id===current); titleEl.value=n.title; bodyEl.value=n.body; }
  renderList();
}

function createStore(container){
  const catalog=[
    {id:'browser',name:'Void Browser',desc:'Tabbed proxy browser',icon:ICONS.browser},
    {id:'voidcode',name:'VoidCode',desc:'VS Code style editor',icon:ICONS.voidcode},
    {id:'terminal',name:'Terminal',desc:'Command line',icon:ICONS.terminal},
    {id:'files',name:'Files',desc:'Local file manager',icon:ICONS.files},
    {id:'notes',name:'Notes',desc:'Quick notes',icon:ICONS.notes},
    {id:'settings',name:'Settings',desc:'Preferences',icon:ICONS.settings}
  ];
  container.innerHTML=`<div class="store"><h2>TycoreStore</h2><p class="store-sub">Apps for Void OS</p><div class="store-grid" id="store-grid"></div></div>`;
  const grid=container.querySelector('#store-grid');
  catalog.forEach(app=>{
    const card=document.createElement('div'); card.className='store-card';
    card.innerHTML=`<div class="icon">${iconImg(app.icon)}</div><div class="name">${app.name}</div><div class="desc">${app.desc}</div><button>Open</button>`;
    bindActivation(card.querySelector('button'),()=>openApp(app.id));
    grid.appendChild(card);
  });
}

function createSettings(container){
  container.innerHTML=`<div class="app-content"><h2>Settings</h2><div class="card"><label><input type="checkbox" checked/> Window animations</label></div><div class="card"><p style="margin:0">Everything runs locally.</p></div></div>`;
}
function createAbout(container){
  container.innerHTML=`<div class="app-content"><h2>Void OS</h2><p>A complete desktop environment in your browser.</p>
    <div class="card"><strong>Apps</strong><ul style="margin:8px 0 0 18px;color:var(--text-dim);font-size:13px;line-height:1.7">
      <li>Void Browser — tabbed proxy browser</li><li>VoidCode — VS Code style editor</li><li>Terminal, Files, Notes, TycoreStore</li></ul></div>
    <p style="font-size:12px;color:var(--text-dim);margin-top:16px">github.com/Tvmanisback/Void</p></div>`;
}

window.VoidOS={openApp,APPS};
})();