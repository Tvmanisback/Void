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
  const config=window.VOID_RUNTIME_CONFIG||{};
  const api=(config.apiUrl||'').replace(/\/$/,'');
  let tabs=[{id:1,title:'New Tab',url:null,history:[],histIndex:-1}],activeTab=1,nextId=2,polling=false,lastObjectUrl=null,touchY=0;
  container.innerHTML='<div class="browser" style="display:flex;flex-direction:column;height:100%;min-height:0">'
    +'<div class="browser-tabs" id="browser-tabs"></div>'
    +'<div class="browser-toolbar"><button class="back-btn" type="button" title="Back">←</button><button class="fwd-btn" type="button" title="Forward">→</button><button class="reload-btn" type="button" title="Reload">↻</button>'
    +'<form class="url-form"><input class="url-input" type="text" placeholder="Search or enter URL" autocomplete="off" spellcheck="false"><button class="go-btn" type="submit">Go</button></form><button class="new-tab-btn" type="button" title="New tab">+</button></div>'
    +'<div class="browser-engine-wrap" style="position:relative;flex:1;min-height:0;background:#111;overflow:auto"><div class="browser-engine-empty" style="height:100%;display:flex;align-items:center;justify-content:center;color:#aaa;text-align:center;padding:24px">Enter a website or search to start the hosted Chromium browser.</div><img class="browser-engine-screen" alt="Live website rendered by hosted Chromium" draggable="false" style="display:none;width:100%;height:auto;min-height:100%;object-fit:contain;object-position:top left;user-select:none;-webkit-user-select:none"><textarea class="browser-engine-keyboard" aria-label="Type into website" autocomplete="off" autocapitalize="off" spellcheck="false" style="position:absolute;left:0;bottom:0;width:2px;height:2px;opacity:.01;border:0;padding:0;resize:none"></textarea></div>'
    +'<div class="browser-status"><span class="status-text">Hosted browser ready</span></div></div>';
  const tabsEl=container.querySelector('#browser-tabs'),view=container.querySelector('.browser-engine-wrap'),screen=container.querySelector('.browser-engine-screen'),keyboard=container.querySelector('.browser-engine-keyboard'),input=container.querySelector('.url-input'),form=container.querySelector('.url-form'),status=container.querySelector('.status-text'),empty=container.querySelector('.browser-engine-empty');
  const getTab=()=>tabs.find(t=>t.id===activeTab);
  async function request(path,body,method='POST',binary=false){
    if(!api)throw Error('Hosted browser API is not configured in runtime-config.js');
    const token=await window.VoidAuth?.getAccessToken?.();if(!token)throw Error('Sign in again to use the hosted browser.');
    const response=await fetch(api+path,{method,headers:{Authorization:'Bearer '+token,...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined,cache:'no-store'});
    if(!response.ok){let message='Browser service error ('+response.status+')';try{message=(await response.json()).error||message}catch{}throw Error(message);}
    return binary?response.blob():response.json();
  }
  function renderTabs(){tabsEl.innerHTML='';tabs.forEach(t=>{const el=document.createElement('div');el.className='browser-tab'+(t.id===activeTab?' active':'');const title=document.createElement('span');title.className='tab-title';title.textContent=t.title;const close=document.createElement('button');close.type='button';close.className='tab-close';close.textContent='×';el.append(title,close);bindActivation(el,e=>{if(!e.target.closest('.tab-close'))switchTab(t.id);});bindActivation(close,e=>{e.stopPropagation();closeTab(t.id);});tabsEl.append(el);});}
  function updateNav(){const t=getTab();container.querySelector('.back-btn').disabled=!t||t.histIndex<=0;container.querySelector('.fwd-btn').disabled=!t||t.histIndex>=t.history.length-1;}
  function normalize(raw){const value=(raw||'').trim();if(!value)return null;if(/^https?:\/\//i.test(value)){try{return new URL(value).href}catch{return null}}if(/^(localhost|(?:[a-z0-9-]+\.)+[a-z]{2,})(:\d+)?(?:[/?#].*)?$/i.test(value)){try{return new URL('https://'+value).href}catch{return null}}return 'https://html.duckduckgo.com/html/?q='+encodeURIComponent(value);}
  function showStart(){empty.style.display='flex';empty.innerHTML='<div style="max-width:560px"><div style="font-size:38px;font-weight:800;letter-spacing:-2px;color:#a78bfa">Void Browser</div><p style="margin:10px 0 20px;color:#999">Powered by a real hosted Chromium engine</p><div style="display:flex;gap:8px;flex-wrap:wrap;justify-content:center"><button data-url="https://www.google.com">Google</button><button data-url="https://www.youtube.com">YouTube</button><button data-url="https://github.com">GitHub</button><button data-url="https://www.reddit.com">Reddit</button></div></div>';empty.querySelectorAll('button').forEach(b=>{b.style.cssText='padding:10px 14px;border:1px solid #39334b;border-radius:9px;background:#191522;color:#e8e6f0';b.onclick=()=>navigate(b.dataset.url)});screen.style.display='none';}
  async function capture(){if(!getTab()?.url)return;try{const blob=await request('/api/browser/screenshot?tabId='+encodeURIComponent(activeTab),null,'GET',true);if(lastObjectUrl)URL.revokeObjectURL(lastObjectUrl);lastObjectUrl=URL.createObjectURL(blob);screen.src=lastObjectUrl;screen.style.display='block';empty.style.display='none';}catch(e){if(!/No active browser session/.test(e.message))status.textContent=e.message;}}
  async function navigate(raw,push=true){const url=normalize(raw);if(!url){status.textContent='Enter a valid URL or search';return;}const t=getTab();if(!t)return;if(push){t.history.splice(t.histIndex+1);t.history.push(url);t.histIndex=t.history.length-1;}t.url=url;t.title='Loading…';input.value=url;renderTabs();updateNav();status.textContent='Opening in hosted Chromium…';empty.style.display='flex';empty.textContent='Launching Chromium and loading '+new URL(url).hostname+'…';screen.style.display='none';try{const result=await request('/api/browser/'+(t.history.length>1&&!push?'navigate':'open'),{url,tabId:String(t.id)});t.url=result.url||url;t.title=result.title||new URL(url).hostname;input.value=t.url;renderTabs();updateNav();status.textContent='Live Chromium · '+t.title;await capture();}catch(e){status.textContent='Browser error';empty.textContent=e.message;empty.style.display='flex';screen.style.display='none';}}
  async function send(data){try{await request('/api/browser/input',{...data,tabId:String(activeTab)});setTimeout(capture,180);}catch(e){status.textContent=e.message;}}
  function switchTab(id){const t=tabs.find(x=>x.id===id);if(!t)return;activeTab=id;renderTabs();updateNav();input.value=t.url||'';if(t.url)navigate(t.url,false);else showStart();}
  function closeTab(id){const i=tabs.findIndex(x=>x.id===id);if(i<0)return;tabs.splice(i,1);if(!tabs.length)tabs.push({id:nextId++,title:'New Tab',url:null,history:[],histIndex:-1});if(activeTab===id)activeTab=tabs[Math.max(0,i-1)].id;renderTabs();switchTab(activeTab);}
  function newTab(){const id=nextId++;tabs.push({id,title:'New Tab',url:null,history:[],histIndex:-1});activeTab=id;renderTabs();updateNav();input.value='';showStart();}
  form.addEventListener('submit',e=>{e.preventDefault();navigate(input.value);});
  container.querySelector('.back-btn').addEventListener('click',()=>{const t=getTab();if(t?.histIndex>0){t.histIndex--;navigate(t.history[t.histIndex],false);}});
  container.querySelector('.fwd-btn').addEventListener('click',()=>{const t=getTab();if(t&&t.histIndex<t.history.length-1){t.histIndex++;navigate(t.history[t.histIndex],false);}});
  container.querySelector('.reload-btn').addEventListener('click',()=>{const t=getTab();if(t?.url)send({type:'reload'});});
  container.querySelector('.new-tab-btn').addEventListener('click',newTab);
  screen.addEventListener('pointerdown',e=>{screen.setPointerCapture?.(e.pointerId);const r=screen.getBoundingClientRect();const x=(e.clientX-r.left)*1365/r.width;const y=(e.clientY-r.top)*850/(r.width*850/1365);send({type:'click',x,y,button:e.button===2?'right':'left'});keyboard.focus({preventScroll:true});});
  screen.addEventListener('contextmenu',e=>e.preventDefault());
  view.addEventListener('wheel',e=>{e.preventDefault();send({type:'scroll',deltaX:e.deltaX,deltaY:e.deltaY});},{passive:false});
  view.addEventListener('touchstart',e=>{touchY=e.touches[0]?.clientY||0;},{passive:true});
  view.addEventListener('touchmove',e=>{const y=e.touches[0]?.clientY||touchY;const delta=touchY-y;touchY=y;if(Math.abs(delta)>2){send({type:'scroll',deltaY:delta*2});}},{passive:true});
  keyboard.addEventListener('input',()=>{const value=keyboard.value;if(value){send({type:'text',text:value});keyboard.value='';}});
  keyboard.addEventListener('keydown',e=>{if(['Enter','Backspace','Tab','Escape','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Delete'].includes(e.key)){e.preventDefault();send({type:'key',key:e.key===' ' ? 'Space' : e.key});}});
  renderTabs();updateNav();showStart();
  if(!polling){polling=true;setInterval(()=>{if(!document.hidden&&getTab()?.url)capture();},1100);}
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
  container.innerHTML='<div class="app-content" style="height:100%;overflow:auto"><h2>About Void</h2><p>A complete desktop environment in your browser.</p><section style="margin-top:18px;padding:14px;border:1px solid var(--border);border-radius:10px;background:var(--surface,transparent)"><h3 style="margin:0 0 10px">What\'s new in this update</h3><ul style="padding-left:20px;margin:0;line-height:1.7"><li><strong>Faster loading:</strong> browser requests race multiple proxy services with time limits.</li><li><strong>Styled search:</strong> DuckDuckGo results use custom Void result cards instead of raw unstyled HTML.</li><li><strong>Page styling:</strong> supported external stylesheets load through the proxy inside an isolated page surface.</li><li><strong>Proxy retries:</strong> all configured proxy routes are tried, with a clearer retry screen if none can reach a site.</li><li><strong>Hosted Chromium browser:</strong> real Chromium runs on the Void runtime service and streams page screenshots into the browser window.</li><li><strong>Interactive websites:</strong> page clicks, scrolling, keyboard input, navigation, and multiple browser tabs are sent to the remote browser engine.</li><li><strong>Safer page rendering:</strong> remote scripts and embedded frames are blocked while links and supported GET forms stay routed through the proxy.</li><li><strong>GitHub and Reddit:</strong> readable proxy text mode displays site content when full interactive pages cannot be rendered.</li><li><strong>Automatic downloads:</strong> supported download links and file responses are saved into Files.</li><li><strong>Files:</strong> downloads are stored in browser storage, the list refreshes automatically, and files can be saved to the device or deleted.</li></ul></section><p style="font-size:12px;color:var(--text-dim);margin-top:16px">Void OS · Latest update</p><p style="font-size:12px;color:var(--text-dim)">github.com/Tvmanisback/Void</p></div>';
}

window.VoidOS={openApp,APPS};
})();
