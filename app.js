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

const VOID_FILES_DB='void-files-v1';
function openVoidFilesDB(){return new Promise((resolve,reject)=>{const r=indexedDB.open(VOID_FILES_DB,1);r.onupgradeneeded=()=>{if(!r.result.objectStoreNames.contains('files'))r.result.createObjectStore('files',{keyPath:'id'});};r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});}
async function saveVoidFile(name,blob,url){const db=await openVoidFilesDB();return new Promise((resolve,reject)=>{const tx=db.transaction('files','readwrite');const item={id:Date.now().toString(36)+'-'+Math.random().toString(36).slice(2),name:name||'download',blob,url:url||'',size:blob.size,type:blob.type||'application/octet-stream',savedAt:Date.now()};tx.objectStore('files').put(item);tx.oncomplete=()=>{db.close();window.dispatchEvent(new Event('void-files-updated'));resolve(item);};tx.onerror=()=>{db.close();reject(tx.error);};});}
async function listVoidFiles(){const db=await openVoidFilesDB();return new Promise((resolve,reject)=>{const r=db.transaction('files','readonly').objectStore('files').getAll();r.onsuccess=()=>{db.close();resolve((r.result||[]).sort((a,b)=>b.savedAt-a.savedAt));};r.onerror=()=>{db.close();reject(r.error);};});}
async function deleteVoidFile(id){const db=await openVoidFilesDB();return new Promise((resolve,reject)=>{const tx=db.transaction('files','readwrite');tx.objectStore('files').delete(id);tx.oncomplete=()=>{db.close();resolve();};tx.onerror=()=>{db.close();reject(tx.error);};});}
async function downloadVoidFile(item){const url=URL.createObjectURL(item.blob);const a=document.createElement('a');a.href=url;a.download=item.name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);}

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
    const maxLeft = Math.max(0, window.innerWidth - 80);
    const maxTop = Math.max(0, window.innerHeight - 90);
    el.style.left = Math.min(maxLeft, Math.max(0, e.clientX - offsetX)) + 'px';
    el.style.top = Math.min(maxTop, Math.max(0, e.clientY - offsetY)) + 'px';
  }
  bar.addEventListener('pointerdown', e=>{
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

const PROXY_KEY = '1ec6a957';

const PROXY_LIST = [
  (url) => `https://corsproxy.io/?key=${PROXY_KEY}&url=${encodeURIComponent(url)}`,
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

/* ===== Void Browser: proxy-only renderer (no iframe) ===== */
function createBrowser(container){
  let tabs=[{id:1,title:'New Tab',url:null,history:[],histIndex:-1}],activeTab=1,nextId=2,requestId=0,activeController=null;
  container.innerHTML=''
    + '<div class="browser" style="display:flex;flex-direction:column;height:100%">'
    + '<div class="browser-tabs" id="browser-tabs"></div>'
    + '<div class="browser-toolbar">'
    + '<button class="back-btn" type="button" title="Back">←</button><button class="fwd-btn" type="button" title="Forward">→</button>'
    + '<button class="reload-btn" type="button" title="Reload">↻</button>'
    + '<form class="url-form" style="display:flex;flex:1;min-width:0"><input class="url-input" type="text" placeholder="Search or enter URL" autocomplete="off"><button class="go-btn" type="submit">Go</button></form>'
    + '<button class="new-tab-btn" type="button" title="New tab">+</button></div>'
    + '<div class="browser-content" style="flex:1;min-height:0;overflow:auto;background:#fff;color:#222"></div>'
    + '<div class="browser-status"><span class="status-text">Ready</span></div></div>';
  const tabsEl=container.querySelector('#browser-tabs'),view=container.querySelector('.browser-content'),input=container.querySelector('.url-input'),form=container.querySelector('.url-form'),status=container.querySelector('.status-text');
  const getTab=()=>tabs.find(t=>t.id===activeTab);
  function renderTabs(){tabsEl.innerHTML='';tabs.forEach(t=>{const el=document.createElement('div');el.className='browser-tab'+(t.id===activeTab?' active':'');const title=document.createElement('span');title.className='tab-title';title.textContent=t.title;const close=document.createElement('button');close.type='button';close.className='tab-close';close.textContent='×';el.append(title,close);bindActivation(el,e=>{if(!e.target.closest('.tab-close'))switchTab(t.id);});bindActivation(close,e=>{e.stopPropagation();closeTab(t.id);});tabsEl.appendChild(el);});}
  function updateNav(){const t=getTab();container.querySelector('.back-btn').disabled=!t||t.histIndex<=0;container.querySelector('.fwd-btn').disabled=!t||t.histIndex>=t.history.length-1;}
  function showStartPage(){if(activeController)activeController.abort();status.textContent='Start';view.innerHTML='';view.style.cssText='flex:1;min-height:0;overflow:auto;background:#0b0b12;color:#e8e6f0';const wrap=document.createElement('div');wrap.style.cssText='min-height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:24px;font-family:system-ui';wrap.innerHTML='<div style="font-size:64px;font-weight:700;letter-spacing:-2px;color:#a78bfa">Void</div><div style="color:#9b97b0;font-size:14px;margin-bottom:32px">Search the web through the void</div><form class="start-search" style="display:flex;width:min(100%,520px);border:1px solid #333;border-radius:28px;overflow:hidden;background:#12121a"><input class="start-query" placeholder="Search or enter URL" autocomplete="off" style="flex:1;min-width:0;height:52px;padding:0 20px;border:0;background:transparent;color:white;font-size:16px"><button style="border:0;padding:0 22px;background:#8b5cf6;color:white;font-weight:600">Search</button></form><div style="display:flex;gap:18px;flex-wrap:wrap;justify-content:center;margin-top:28px"><a href="https://www.wikipedia.org/">Wikipedia</a><a href="https://github.com/">GitHub</a><a href="https://www.reddit.com/">Reddit</a><a href="https://www.youtube.com/">YouTube</a></div>';wrap.querySelectorAll('a').forEach(a=>{a.style.color='#a78bfa';a.addEventListener('click',e=>{e.preventDefault();navigate(a.href);});});wrap.querySelector('.start-search').addEventListener('submit',e=>{e.preventDefault();navigate(wrap.querySelector('.start-query').value);});view.appendChild(wrap);}
  function switchTab(id){activeTab=id;const t=getTab();if(!t)return;input.value=t.url||'';if(t.url)loadPage(t.url);else showStartPage();renderTabs();updateNav();}
  function closeTab(id){if(tabs.length===1){tabs[0]={id:tabs[0].id,title:'New Tab',url:null,history:[],histIndex:-1};showStartPage();input.value='';renderTabs();updateNav();return;}const idx=tabs.findIndex(t=>t.id===id);tabs.splice(idx,1);if(activeTab===id){activeTab=tabs[Math.max(0,idx-1)].id;switchTab(activeTab);}else renderTabs();}
  function newTab(){const t={id:nextId++,title:'New Tab',url:null,history:[],histIndex:-1};tabs.push(t);activeTab=t.id;showStartPage();input.value='';renderTabs();updateNav();}
  function normalizeUrl(raw){const value=(raw||'').trim();if(!value)return null;if(/^https?:\/\//i.test(value)){try{const u=new URL(value);return u.protocol==='http:'||u.protocol==='https:'?u.href:null;}catch{return null;}}if(/^(localhost|(?:[a-z0-9-]+\.)+[a-z]{2,})(:\d+)?(?:[/?#].*)?$/i.test(value)){try{return new URL('https://'+value).href;}catch{return null;}}return 'https://html.duckduckgo.com/html/?q='+encodeURIComponent(value);}
  function navigate(raw,push=true){const url=normalizeUrl(raw);if(!url){status.textContent='Enter a valid website address';return;}const t=getTab();if(!t)return;t.url=url;t.title=new URL(url).hostname.split('.').slice(-2).join('.');if(push){t.history.splice(t.histIndex+1);t.history.push(url);t.histIndex=t.history.length-1;}input.value=url;renderTabs();updateNav();loadPage(url);}
  function switchHistory(delta){const t=getTab();if(!t)return;const next=t.histIndex+delta;if(next<0||next>=t.history.length)return;t.histIndex=next;navigate(t.history[next],false);}
  async function fetchThroughProxy(target,signal,timeoutMs=14000){const attempts=PROXY_LIST.map((makeProxy,index)=>(async()=>{const local=new AbortController();const abort=()=>local.abort();if(signal)signal.addEventListener('abort',abort,{once:true});const timer=setTimeout(()=>local.abort(),timeoutMs);try{const response=await fetch(makeProxy(target),{mode:'cors',credentials:'omit',signal:local.signal,headers:{'Accept':'text/html,application/xhtml+xml,text/plain,*/*'}});if(!response.ok)throw Error('Proxy HTTP '+response.status);return {response,index};}finally{clearTimeout(timer);if(signal)signal.removeEventListener('abort',abort);}})());return Promise.any(attempts);}
  async function saveDownload(target,name){status.textContent='Downloading…';let lastError;for(const makeProxy of PROXY_LIST){try{const response=await fetch(makeProxy(target),{credentials:'omit'});if(!response.ok)throw Error('HTTP '+response.status);const blob=await response.blob();if(!blob.size)throw Error('Empty download');const pathName=new URL(target).pathname.split('/').pop()||'download';const safe=(name||pathName).replace(/[\\/:*?"<>|]/g,'_').slice(0,160)||'download';await saveVoidFile(safe,blob,target);status.textContent='Saved '+safe+' to Files';return;}catch(error){lastError=error;}}status.textContent='Download failed: '+(lastError&&lastError.message||'proxy error');}
  function renderSearchResults(source){const doc=new DOMParser().parseFromString(source,'text/html');const results=Array.from(doc.querySelectorAll('.result')).filter(r=>r.querySelector('.result__a'));view.innerHTML='';view.style.cssText='flex:1;min-height:0;overflow:auto;background:#0b0b12;color:#e8e6f0';const page=document.createElement('main');page.style.cssText='max-width:900px;margin:0 auto;padding:30px 24px 56px;font:14px/1.55 Inter,system-ui,sans-serif';const top=document.createElement('div');top.style.cssText='display:flex;align-items:center;gap:12px;margin-bottom:24px';const logo=document.createElement('div');logo.textContent='Void';logo.style.cssText='font-size:28px;font-weight:800;color:#a78bfa';const label=document.createElement('div');label.textContent='SEARCH';label.style.cssText='font-size:10px;letter-spacing:.2em;color:#77718d;font-weight:700';top.append(logo,label);page.append(top);const heading=document.createElement('h1');heading.textContent='Search results';heading.style.cssText='font-size:20px;margin:0 0 20px;color:#f4f1ff';page.append(heading);results.forEach(r=>{const a=r.querySelector('.result__a');if(!a)return;const card=document.createElement('article');card.style.cssText='padding:17px 18px;margin:0 0 12px;border:1px solid #292638;border-radius:13px;background:linear-gradient(135deg,#171522,#11111a)';const link=document.createElement('a');link.href=a.href;link.textContent=(a.textContent||'Untitled result').trim();link.style.cssText='display:block;color:#b9a3ff;font-size:17px;font-weight:650;text-decoration:none;margin-bottom:6px';link.onclick=e=>{e.preventDefault();navigate(link.href);};const domain=document.createElement('div');domain.textContent=r.querySelector('.result__url')?.textContent||(()=>{try{return new URL(a.href).hostname}catch{return ''}})();domain.style.cssText='font-size:11px;color:#8e8aa0;margin-bottom:8px';const snippet=document.createElement('p');snippet.textContent=(r.querySelector('.result__snippet')?.textContent||r.querySelector('.result__body')?.textContent||'').trim();snippet.style.cssText='color:#c0bdcc;font-size:13px;line-height:1.65';card.append(link,domain,snippet);page.append(card);});if(!results.length){const p=document.createElement('p');p.textContent='No readable results were returned. Try another search.';page.append(p);}view.append(page);}
  function renderReader(text,host){view.innerHTML='';view.style.cssText='flex:1;min-height:0;overflow:auto;background:#fff;color:#24292f';const main=document.createElement('main');main.style.cssText='max-width:1050px;margin:auto;padding:24px;font:14px/1.65 system-ui;overflow-wrap:anywhere';const heading=document.createElement('h2');heading.textContent=host+' · readable view';const note=document.createElement('p');note.textContent='Proxy text view. Some interactive site features are unavailable.';const pre=document.createElement('pre');pre.style.cssText='white-space:pre-wrap;overflow-wrap:anywhere;font:13px/1.65 ui-monospace,monospace';pre.textContent=text;pre.querySelectorAll('a').forEach(()=>{});main.append(heading,note,pre);const raw=text;const fragment=document.createDocumentFragment();const urlPattern=/https?:\/\/[^\s<>"')]+/g;let last=0,m;while((m=urlPattern.exec(raw))){fragment.append(document.createTextNode(raw.slice(last,m.index)));const a=document.createElement('a');a.href=m[0];a.textContent=m[0];a.style.color='#0969da';a.addEventListener('click',e=>{e.preventDefault();navigate(a.href);});fragment.append(a);last=m.index+m[0].length;}fragment.append(document.createTextNode(raw.slice(last)));pre.textContent='';pre.append(fragment);view.appendChild(main);}
  async function loadPage(url){if(activeController)activeController.abort();const controller=new AbortController();activeController=controller;const thisRequest=++requestId;const host=new URL(url).hostname.toLowerCase();const readerMode=host==='github.com'||host.endsWith('.github.com')||host==='reddit.com'||host.endsWith('.reddit.com');status.textContent='Loading '+host+'…';view.innerHTML='<div style="padding:24px;font:14px system-ui;color:#777">Loading through proxy…</div>';view.style.cssText='flex:1;min-height:0;overflow:auto;background:#fff;color:#222';const target=readerMode?'https://r.jina.ai/'+url:url;try{const winner=await fetchThroughProxy(target,controller.signal,readerMode?14000:10000);if(thisRequest!==requestId||controller.signal.aborted)return;const response=winner.response;const disposition=response.headers.get('content-disposition')||'';const type=response.headers.get('content-type')||'';if(/attachment/i.test(disposition)||(!readerMode&&!/text\/html|application\/xhtml\+xml|text\/plain/i.test(type))){const blob=await response.blob();const name=new URL(url).pathname.split('/').pop()||'download';await saveVoidFile(name,blob,url);status.textContent='Downloaded '+name+' to Files';view.textContent=name+' was saved to the Files app.';return;}const body=await response.text();if(!body||body.length<10)throw Error('Empty response');if(readerMode){renderReader(body,host);status.textContent='Loaded readable view · proxy '+(winner.index+1);return;}if(host==='html.duckduckgo.com'){renderSearchResults(body);status.textContent='Search results · proxy '+(winner.index+1);return;}await renderProxiedDocument(body,url,winner.index,controller.signal);status.textContent='Loaded · proxy '+(winner.index+1);}catch(error){if(controller.signal.aborted||thisRequest!==requestId)return;status.textContent='Could not load: '+(error.message||'all proxies failed');view.innerHTML='';view.style.cssText='flex:1;min-height:0;overflow:auto;background:#0b0b12;color:#eee';const err=document.createElement('div');err.style.cssText='max-width:620px;margin:10vh auto;padding:30px;border:1px solid #343044;border-radius:18px;background:#191526;font:14px/1.6 system-ui;text-align:center';const title=document.createElement('h2');title.textContent='Page could not be loaded';title.style.cssText='font-size:23px;margin-bottom:10px';const msg=document.createElement('p');msg.textContent='The page could not be retrieved by any available proxy. The site may block proxy traffic or the proxy may be temporarily unavailable.';msg.style.cssText='color:#aaa;margin-bottom:20px';const retry=document.createElement('button');retry.textContent='Try again';retry.style.cssText='padding:10px 20px;border:0;border-radius:9px;background:#8b5cf6;color:white;font-weight:600';retry.onclick=()=>loadPage(url);err.append(title,msg,retry);view.append(err);}}
  async function renderProxiedDocument(source,url,proxyIndex,signal){const parsed=new DOMParser().parseFromString(source,'text/html');const cssLinks=Array.from(parsed.querySelectorAll('link[rel~="stylesheet"][href]')).map(n=>{try{return new URL(n.getAttribute('href'),url).href}catch{return null}}).filter(Boolean).slice(0,10);parsed.querySelectorAll('script,iframe,frame,frameset,object,embed,portal,meta[http-equiv="Content-Security-Policy"],meta[http-equiv="refresh"]').forEach(n=>n.remove());parsed.querySelectorAll('*').forEach(el=>Array.from(el.attributes).forEach(a=>{if(a.name.toLowerCase().startsWith('on')||['srcdoc','nonce'].includes(a.name.toLowerCase()))el.removeAttribute(a.name)}));parsed.querySelectorAll('base,link[rel~="stylesheet"],link[rel="preload"],link[rel="modulepreload"]').forEach(n=>n.remove());parsed.querySelectorAll('a[href]').forEach(a=>{try{a.href=new URL(a.getAttribute('href'),url).href}catch{a.removeAttribute('href')}});parsed.querySelectorAll('img[src],source[src]').forEach(el=>{try{el.src=PROXY_LIST[proxyIndex](new URL(el.getAttribute('src'),url).href)}catch{el.removeAttribute('src')}});const css=[];await Promise.all(cssLinks.map(async href=>{try{const r=await fetchThroughProxy(href,signal,9000);let text=await r.response.text();text=text.replace(/url\(\s*(['"]?)(?!data:|blob:|#)([^'")]+)\1\s*\)/gi,(m,q,p)=>{try{return 'url("'+PROXY_LIST[r.index](new URL(p.trim(),href).href)+'")'}catch{return 'none'}}).replace(/@import\s+[^;]+;/gi,'');css.push(text)}catch(e){console.debug('Stylesheet unavailable',href)}}));if(signal?.aborted)return;view.innerHTML='';view.style.cssText='flex:1;min-height:0;overflow:auto;background:#fff;color:#222';const shell=document.createElement('div');shell.style.cssText='min-height:100%;overflow-wrap:anywhere';const root=shell.attachShadow({mode:'open'});const base=document.createElement('style');base.textContent=':host{display:block;min-height:100%;color:#222;background:#fff;font:14px/1.5 Arial,sans-serif}*,*::before,*::after{box-sizing:border-box}img,video,svg{max-width:100%}a{cursor:pointer}';root.append(base);css.forEach(text=>{const st=document.createElement('style');st.textContent=text;root.append(st)});Array.from((parsed.body||parsed.documentElement).childNodes).forEach(n=>root.append(document.importNode(n,true)));view.append(shell);root.querySelectorAll('a[href]').forEach(a=>a.addEventListener('click',e=>{e.preventDefault();const href=a.href;if(a.hasAttribute('download')||/\.(zip|exe|msi|dmg|pkg|apk|pdf|png|jpe?g|gif|webp|svg|txt|csv|json|docx?|xlsx?|pptx?|mp3|mp4|webm|mov|tar|gz|7z|rar)(?:[?#]|$)/i.test(href))saveDownload(href,a.getAttribute('download')||a.textContent.trim());else navigate(href)}));root.querySelectorAll('form').forEach(formEl=>formEl.addEventListener('submit',e=>{e.preventDefault();if((formEl.method||'get').toLowerCase()!=='get'){status.textContent='Only GET forms are supported';return;}const target=new URL(formEl.getAttribute('action')||url,url);new FormData(formEl).forEach((v,k)=>target.searchParams.append(k,String(v)));navigate(target.href)}));}
  form.addEventListener('submit',e=>{e.preventDefault();navigate(input.value);});bindActivation(container.querySelector('.go-btn'),e=>{e.preventDefault();navigate(input.value);});input.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();navigate(input.value);}});bindActivation(container.querySelector('.new-tab-btn'),newTab);bindActivation(container.querySelector('.back-btn'),()=>switchHistory(-1));bindActivation(container.querySelector('.fwd-btn'),()=>switchHistory(1));bindActivation(container.querySelector('.reload-btn'),()=>{const t=getTab();if(t&&t.url)loadPage(t.url);else showStartPage();});renderTabs();showStartPage();updateNav();
}

/* ===== VoidCode ===== */
function createVoidCode(container, winId){
  container.innerHTML='<div class="vscode" style="display:flex;height:100%"><div class="vscode-sidebar"><div class="vscode-activity"></div></div><div class="vscode-main" style="flex:1"><div id="monaco-'+winId+'" style="height:100%"></div></div></div>';
  if(window.require){
    require.config({paths:{vs:'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.45.0/min/vs'}});
    require(['vs/editor/editor.main'],function(){
      const ed=monaco.editor.create(document.getElementById('monaco-'+winId),{value:'// VoidCode\nconsole.log("hello");',language:'javascript',theme:'vs-dark',automaticLayout:true});
      monacoEditors.set(winId,ed);
    });
  }
}

function createTerminal(container){
  container.innerHTML='<div class="terminal" style="height:100%;background:#0b0b12;color:#c4b5fd;font-family:monospace;padding:12px;overflow:auto"><div class="term-out">Void Terminal</div><div class="term-line"><span class="prompt">$</span> <input class="term-in" style="background:transparent;border:none;color:#fff;outline:none;width:80%"/></div></div>';
}

function createFiles(container){
  container.innerHTML='<div class="app-content" style="height:100%;overflow:auto"><div style="display:flex;align-items:center;justify-content:space-between;gap:12px"><div><h2>Files</h2><p style="color:var(--text-dim)">Downloads saved from Void Browser</p></div><button type="button" class="files-refresh">Refresh</button></div><div class="files-list" style="margin-top:16px;display:grid;gap:8px"><p style="color:var(--text-dim)">Loading files…</p></div></div>';
  const list=container.querySelector('.files-list');
  async function refresh(){list.innerHTML='<p style="color:var(--text-dim)">Loading files…</p>';try{const files=await listVoidFiles();if(!files.length){list.innerHTML='<p style="color:var(--text-dim)">No downloads yet. Download a file in Void Browser and it will appear here.</p>';return;}list.innerHTML='';files.forEach(file=>{const row=document.createElement('div');row.style.cssText='display:flex;align-items:center;gap:10px;padding:12px;border:1px solid var(--border);border-radius:9px;background:var(--surface,transparent)';const info=document.createElement('div');info.style.cssText='min-width:0;flex:1';const name=document.createElement('div');name.textContent=file.name;name.style.cssText='font-weight:600;overflow-wrap:anywhere';const meta=document.createElement('div');meta.textContent=(file.size/1048576).toFixed(2)+' MB · '+new Date(file.savedAt).toLocaleString();meta.style.cssText='font-size:11px;color:var(--text-dim);margin-top:4px';info.append(name,meta);const save=document.createElement('button');save.type='button';save.textContent='Save';save.onclick=()=>downloadVoidFile(file);const del=document.createElement('button');del.type='button';del.textContent='Delete';del.onclick=async()=>{await deleteVoidFile(file.id);refresh();};row.append(info,save,del);list.appendChild(row);});}catch(error){list.textContent='Could not read saved files: '+(error.message||String(error));}}
  container.querySelector('.files-refresh').addEventListener('click',refresh);window.addEventListener('void-files-updated',refresh);refresh();
}

function createNotes(container){
  container.innerHTML='<div class="app-content"><h2>Notes</h2><textarea style="width:100%;height:300px;background:#12121a;color:#fff;border:1px solid #2a2a38;border-radius:8px;padding:12px"></textarea></div>';
}

function createStore(container){
  container.innerHTML='<div class="app-content"><h2>TycoreStore</h2><p>Apps for Void OS</p></div>';
}

function createSettings(container){
  container.innerHTML='<div class="app-content"><h2>Settings</h2><p>Everything runs locally.</p></div>';
}

function createAbout(container){
  container.innerHTML='<div class="app-content" style="height:100%;overflow:auto"><h2>About Void</h2><p>A complete desktop environment in your browser.</p><section style="margin-top:18px;padding:14px;border:1px solid var(--border);border-radius:10px;background:var(--surface,transparent)"><h3 style="margin:0 0 10px">What\'s new in this update</h3><ul style="padding-left:20px;margin:0;line-height:1.7"><li><strong>Faster loading:</strong> browser requests race multiple proxy services with time limits.</li><li><strong>Styled search:</strong> DuckDuckGo results use custom Void result cards instead of raw unstyled HTML.</li><li><strong>Page styling:</strong> supported external stylesheets load through the proxy inside an isolated page surface.</li><li><strong>Proxy retries:</strong> all configured proxy routes are tried, with a clearer retry screen if none can reach a site.</li><li><strong>Proxy-only browser:</strong> pages are fetched through the proxy and rendered directly in Void OS; no iframe is used.</li><li><strong>Safer page rendering:</strong> remote scripts and embedded frames are blocked while links and supported GET forms stay routed through the proxy.</li><li><strong>GitHub and Reddit:</strong> readable proxy text mode displays site content when full interactive pages cannot be rendered.</li><li><strong>Automatic downloads:</strong> supported download links and file responses are saved into Files.</li><li><strong>Files:</strong> downloads are stored in browser storage, the list refreshes automatically, and files can be saved to the device or deleted.</li></ul></section><p style="font-size:12px;color:var(--text-dim);margin-top:16px">Void OS · Latest update</p><p style="font-size:12px;color:var(--text-dim)">github.com/Tvmanisback/Void</p></div>';
}

window.VoidOS={openApp,APPS};
})();
