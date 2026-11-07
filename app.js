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
  if(/^https?:\/\//i.test(q) || /^(localhost|(?:[a-z0-9-]+\.)+[a-z]{2,})(:\d+)?(?:[/?#].*)?$/i.test(q)){
    parent.postMessage({type:'void-navigate',url:/^https?:\/\//i.test(q)?q:'https://'+q},'*');
  }else{
    parent.postMessage({type:'void-search',query:q},'*');
  }
};
document.querySelectorAll('[data-url]').forEach(function(a){
  a.onclick=function(e){ e.preventDefault(); parent.postMessage({type:'void-navigate',url:a.dataset.url},'*'); };
});
</script></body></html>`;
}

/* ===== Browser with Tabs ===== */
function createBrowser(container){
  let tabs=[{id:1,title:'New Tab',url:null,history:[],histIndex:-1}],activeTab=1,nextId=2,requestId=0,activeController=null;
  container.innerHTML=`
  <div class="browser" style="display:flex;flex-direction:column;height:100%">
    <div class="browser-tabs" id="browser-tabs"></div>
    <div class="browser-toolbar">
      <button class="back-btn" type="button" title="Back">←</button><button class="fwd-btn" type="button" title="Forward">→</button><button class="reload-btn" type="button" title="Reload">↻</button>
      <form class="url-form" style="flex:1;display:flex;gap:6px"><input class="url-input" type="text" placeholder="Search or enter URL" spellcheck="false" autocomplete="off"/><button type="button" class="go-btn">Go</button></form>
      <button class="new-tab-btn" type="button" title="New Tab">+</button>
    </div>
    <div style="flex:1;position:relative;min-height:0"><iframe class="browser-frame" title="Web page" sandbox="allow-scripts allow-forms allow-popups allow-modals" referrerpolicy="no-referrer" style="width:100%;height:100%;border:0;background:#fff"></iframe></div>
    <div class="browser-status"><span class="status-text">Ready</span></div>
  </div>`;
  const tabsEl=container.querySelector('#browser-tabs'),iframe=container.querySelector('.browser-frame'),input=container.querySelector('.url-input'),form=container.querySelector('.url-form'),status=container.querySelector('.status-text');
  const getTab=()=>tabs.find(t=>t.id===activeTab);
  function renderTabs(){
    tabsEl.innerHTML='';
    tabs.forEach(t=>{
      const el=document.createElement('div');el.className='browser-tab'+(t.id===activeTab?' active':'');
      const title=document.createElement('span');title.className='tab-title';title.textContent=t.title;
      const close=document.createElement('button');close.type='button';close.className='tab-close';close.textContent='×';
      el.append(title,close);
      bindActivation(el,e=>{if(!e.target.closest('.tab-close'))switchTab(t.id);});
      bindActivation(close,e=>{e.stopPropagation();closeTab(t.id);});
      tabsEl.appendChild(el);
    });
  }
  function updateNav(){const t=getTab();container.querySelector('.back-btn').disabled=!t||t.histIndex<=0;container.querySelector('.fwd-btn').disabled=!t||t.histIndex>=t.history.length-1;}
  function showStartPage(){if(activeController)activeController.abort();status.textContent='Start';iframe.removeAttribute('src');iframe.srcdoc=getStartPageHTML();}
  function switchTab(id){activeTab=id;const t=getTab();if(!t)return;input.value=t.url||'';if(t.url)loadPage(t.url);else showStartPage();renderTabs();updateNav();}
  function closeTab(id){
    if(tabs.length===1){tabs[0]={id:tabs[0].id,title:'New Tab',url:null,history:[],histIndex:-1};showStartPage();input.value='';renderTabs();updateNav();return;}
    const idx=tabs.findIndex(t=>t.id===id);tabs.splice(idx,1);
    if(activeTab===id){activeTab=tabs[Math.max(0,idx-1)].id;switchTab(activeTab);}else renderTabs();
  }
  function newTab(){const t={id:nextId++,title:'New Tab',url:null,history:[],histIndex:-1};tabs.push(t);activeTab=t.id;showStartPage();input.value='';renderTabs();updateNav();}
  function normalizeUrl(raw){
    const value=(raw||'').trim();
    if(!value)return null;
    if(/^https?:\/\//i.test(value)){
      try{const parsed=new URL(value);return parsed.protocol==='http:'||parsed.protocol==='https:'?parsed.href:null;}catch{return null;}
    }
    if(/^(localhost|(?:[a-z0-9-]+\.)+[a-z]{2,})(:\d+)?(?:[/?#].*)?$/i.test(value)){
      try{return new URL('https://'+value).href;}catch{return null;}
    }
    return 'https://duckduckgo.com/?q='+encodeURIComponent(value);
  }
  function navigate(raw,push=true){
    const url=normalizeUrl(raw);if(!url){status.textContent='Enter a valid website address';return;}
    const t=getTab();if(!t)return;t.url=url;
    t.title=new URL(url).hostname.split('.').slice(-2).join('.');
    if(push){t.history.splice(t.histIndex+1);t.history.push(url);t.histIndex=t.history.length-1;}
    input.value=url;renderTabs();updateNav();loadPage(url);
  }
  function switchHistory(delta){const t=getTab();if(!t)return;const next=t.histIndex+delta;if(next<0||next>=t.history.length)return;t.histIndex=next;navigate(t.history[next],false);}
  async function loadPage(url){
    if(activeController)activeController.abort();
    const controller=new AbortController();activeController=controller;const thisRequest=++requestId;
    status.textContent='Connecting to CORS proxy…';iframe.removeAttribute('src');iframe.srcdoc='<html><body style="font:14px system-ui;padding:24px">Loading page…</body></html>';
    let lastError=null;
    for(let index=0;index<PROXY_LIST.length;index++){
      if(controller.signal.aborted)return;
      status.textContent=index===0?'Fetching page through CORS proxy…':'Retrying with proxy '+(index+1)+'…';
      try{
        const response=await fetch(PROXY_LIST[index](url),{method:'GET',mode:'cors',credentials:'omit',redirect:'follow',signal:controller.signal,headers:{'Accept':'text/html,application/xhtml+xml,*/*'}});
        if(!response.ok)throw new Error('Proxy returned HTTP '+response.status);
        const html=await response.text();if(!html||html.length<20)throw new Error('Proxy returned an empty page');
        if(thisRequest!==requestId||controller.signal.aborted)return;
        const doc=new DOMParser().parseFromString(html,'text/html');
        doc.querySelectorAll('meta[http-equiv="Content-Security-Policy"],meta[http-equiv="X-Frame-Options"]').forEach(node=>node.remove());
        let base=doc.querySelector('base');if(!base){base=doc.createElement('base');doc.head.prepend(base);}base.href=url;
        const bridge=doc.createElement('script');
        bridge.textContent=`(()=>{
          const send=url=>parent.postMessage({type:'void-navigate',url:String(url)},'*');
          document.addEventListener('click',event=>{
            const link=event.target.closest&&event.target.closest('a[href]');if(!link)return;
            const href=link.href;if(!href||href.startsWith('javascript:')||href.startsWith('mailto:')||href.startsWith('tel:'))return;
            event.preventDefault();send(href);
          },true);
          document.addEventListener('submit',event=>{
            const form=event.target;if(!(form instanceof HTMLFormElement))return;
            if((form.method||'get').toLowerCase()==='get'){
              event.preventDefault();const target=new URL(form.action||document.baseURI);
              new FormData(form).forEach((value,key)=>target.searchParams.append(key,String(value)));send(target.href);
            }
          },true);
        })();`;
        doc.body.appendChild(bridge);
        iframe.srcdoc='<!DOCTYPE html>\\n'+doc.documentElement.outerHTML;
        status.textContent='Loaded via CORS proxy '+(index+1);return;
      }catch(error){if(error.name==='AbortError')return;lastError=error;}
    }
    if(thisRequest!==requestId)return;
    status.textContent='Could not load: '+(lastError&&lastError.message?lastError.message:'all proxies failed');
    iframe.srcdoc='<html><body style="font:14px system-ui;padding:24px;color:#333"><h2>Page could not be loaded</h2><p>The CORS proxies could not retrieve this website. Try another address or reload.</p></body></html>';
  }
  form.addEventListener('submit',e=>{e.preventDefault();navigate(input.value);});
  bindActivation(container.querySelector('.go-btn'),e=>{e.preventDefault();navigate(input.value);});
  input.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();navigate(input.value);}});
  bindActivation(container.querySelector('.new-tab-btn'),newTab);
  bindActivation(container.querySelector('.back-btn'),()=>switchHistory(-1));
  bindActivation(container.querySelector('.fwd-btn'),()=>switchHistory(1));
  bindActivation(container.querySelector('.reload-btn'),()=>{const t=getTab();if(t&&t.url)loadPage(t.url);else showStartPage();});
  window.addEventListener('message',e=>{
    if(e.source!==iframe.contentWindow||!e.data)return;
    if(e.data.type==='void-navigate')navigate(e.data.url);
    else if(e.data.type==='void-search')navigate(String(e.data.query||''));
  });
  renderTabs();showStartPage();updateNav();
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
  container.innerHTML='<div class="app-content"><h2>Files</h2><p>Local file manager (localStorage)</p></div>';
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
  container.innerHTML=`
    <div class="app-content" style="height:100%;overflow:auto">
      <h2>About Void</h2>
      <p>A complete desktop environment in your browser.</p>
      <section style="margin-top:18px;padding:14px;border:1px solid var(--border);border-radius:10px;background:var(--surface,transparent)">
        <h3 style="margin:0 0 10px">What's new in this update</h3>
        <ul style="padding-left:20px;margin:0;line-height:1.7">
          <li><strong>DuckDuckGo search:</strong> search the web directly from the browser's address bar or start page.</li>
          <li><strong>Browser controls:</strong> the Go button and Enter key now submit searches, while website addresses open directly.</li>
          <li><strong>Website loading:</strong> browser page requests continue to use CORS proxy support.</li>
          <li><strong>Accounts:</strong> sign in or create an account to use Void; Guest access is unavailable.</li>
          <li><strong>Terminal:</strong> runtime support is available, including Python.</li>
        </ul>
      </section>
      <p style="font-size:12px;color:var(--text-dim);margin-top:16px">Void OS · Latest update</p>
      <p style="font-size:12px;color:var(--text-dim)">github.com/Tvmanisback/Void</p>
    </div>`;
}

window.VoidOS={openApp,APPS};
})();
