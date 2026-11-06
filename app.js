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

function iconImg(src) {
  return `<img src="${src}" width="26" height="26" alt="" draggable="false">`;
}
function iconImgSmall(src) {
  return `<img src="${src}" width="18" height="18" alt="" draggable="false">`;
}

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
  get(k, d){ try{ return JSON.parse(localStorage.getItem('void_'+k)) ?? d }catch{ return d } },
  set(k, v){ localStorage.setItem('void_'+k, JSON.stringify(v)) }
};

window.addEventListener('DOMContentLoaded', () => {
  setTimeout(() => {
    document.getElementById('boot-screen').classList.add('fade');
    setTimeout(() => {
      document.getElementById('boot-screen').classList.add('hidden');
      document.getElementById('desktop').classList.remove('hidden');
      initDesktop();
      initStartMenu();
      startClock();
      openApp('about');
    }, 450);
  }, 1600);
});

function initDesktop(){
  const c = document.getElementById('desktop-icons');
  c.innerHTML = '';
  APPS.filter(a=>a.desktop).forEach(app=>{
    const el = document.createElement('div');
    el.className = 'desktop-icon';
    el.innerHTML = `<div class="icon-img">${iconImg(app.icon)}</div><span>${app.name}</span>`;
    el.addEventListener('dblclick', ()=>openApp(app.id));
    c.appendChild(el);
  });
}

function initStartMenu(){
  const list = document.getElementById('start-apps');
  list.innerHTML = '';
  APPS.forEach(app=>{
    const btn = document.createElement('button');
    btn.className = 'start-app';
    btn.innerHTML = `<div class="app-icon">${iconImgSmall(app.icon)}</div><span>${app.name}</span>`;
    btn.onclick = ()=>{ openApp(app.id); closeStartMenu(); };
    list.appendChild(btn);
  });
  document.getElementById('start-btn').onclick = toggleStartMenu;
  document.getElementById('power-btn').onclick = ()=>location.reload();
  document.addEventListener('click', e=>{
    const menu = document.getElementById('start-menu');
    const btn = document.getElementById('start-btn');
    if(!menu.classList.contains('hidden') && !menu.contains(e.target) && !btn.contains(e.target)) closeStartMenu();
  });
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
  const w=app.width||700, h=app.height||500;
  el.style.width=w+'px'; el.style.height=h+'px';
  el.style.left = Math.max(40,(innerWidth-w)/2+(openWindows.size*24)%120)+'px';
  el.style.top = Math.max(30,(innerHeight-h-60)/2+(openWindows.size*20)%80)+'px';
  el.innerHTML = `
    <div class="titlebar">
      <div class="title">${iconImgSmall(app.icon)}<span>${app.name}</span></div>
      <div class="controls">
        <button class="ctrl min">─</button>
        <button class="ctrl max">□</button>
        <button class="ctrl close">✕</button>
      </div>
    </div>
    <div class="window-body"></div>
    <div class="resize-handle n"></div><div class="resize-handle s"></div>
    <div class="resize-handle e"></div><div class="resize-handle w"></div>
    <div class="resize-handle ne"></div><div class="resize-handle nw"></div>
    <div class="resize-handle se"></div><div class="resize-handle sw"></div>`;
  app.create(el.querySelector('.window-body'), id);
  el.querySelector('.close').onclick = ()=>closeWindow(id);
  el.querySelector('.min').onclick = ()=>{ el.classList.add('minimized'); if(activeId===id) activeId=null; updateTaskbar(); };
  el.querySelector('.max').onclick = ()=>el.classList.toggle('maximized');
  el.addEventListener('mousedown', ()=>focusWindow(id));
  makeDraggable(el); makeResizable(el);
  document.getElementById('windows-container').appendChild(el);
  openWindows.set(id,{el,appId,title:app.name});
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
  const bar=el.querySelector('.titlebar');
  let ox,oy,drag=false;
  bar.addEventListener('mousedown',e=>{
    if(e.target.closest('.ctrl')||el.classList.contains('maximized')) return;
    drag=true; ox=e.clientX-el.offsetLeft; oy=e.clientY-el.offsetTop; e.preventDefault();
  });
  window.addEventListener('mousemove',e=>{ if(!drag) return; el.style.left=Math.max(0,e.clientX-ox)+'px'; el.style.top=Math.max(0,e.clientY-oy)+'px'; });
  window.addEventListener('mouseup',()=>drag=false);
}
function makeResizable(el){
  el.querySelectorAll('.resize-handle').forEach(handle=>{
    handle.addEventListener('mousedown',e=>{
      if(el.classList.contains('maximized')) return;
      e.preventDefault(); e.stopPropagation();
      const dir=handle.className.split(' ')[1];
      const sx=e.clientX,sy=e.clientY,sw=el.offsetWidth,sh=el.offsetHeight,sl=el.offsetLeft,st=el.offsetTop;
      function move(ev){
        let w=sw,h=sh,l=sl,t=st;
        const dx=ev.clientX-sx,dy=ev.clientY-sy;
        if(dir.includes('e')) w=Math.max(320,sw+dx);
        if(dir.includes('s')) h=Math.max(220,sh+dy);
        if(dir.includes('w')){ w=Math.max(320,sw-dx); l=sl+(sw-w); }
        if(dir.includes('n')){ h=Math.max(220,sh-dy); t=st+(sh-h); }
        el.style.width=w+'px'; el.style.height=h+'px'; el.style.left=l+'px'; el.style.top=t+'px';
      }
      function up(){ window.removeEventListener('mousemove',move); window.removeEventListener('mouseup',up); }
      window.addEventListener('mousemove',move); window.addEventListener('mouseup',up);
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

function createBrowser(container){
  container.innerHTML=`<div style="display:flex;flex-direction:column;height:100%">
    <div class="browser-toolbar">
      <button class="back-btn">←</button><button class="fwd-btn">→</button><button class="reload-btn">↻</button>
      <form class="url-form"><input class="url-input" placeholder="Enter URL..." spellcheck="false"/><button type="submit" class="go-btn">Go</button></form>
    </div>
    <div style="flex:1;min-height:0"><iframe class="browser-frame" sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals" referrerpolicy="no-referrer"></iframe></div>
    <div class="browser-status"><span class="status-text">Ready</span></div></div>`;
  const iframe=container.querySelector('.browser-frame'), input=container.querySelector('.url-input');
  const form=container.querySelector('.url-form'), status=container.querySelector('.status-text');
  const history=[]; let histIndex=-1;
  function nav(raw,push=true){
    let url=raw.trim(); if(!url) return;
    if(!/^https?:\/\//i.test(url)) url='https://'+url;
    status.textContent='Loading…'; iframe.src=buildProxyUrl(url);
    if(push){ history.splice(histIndex+1); history.push(url); histIndex=history.length-1; }
    input.value=url; updateNav();
  }
  function updateNav(){
    container.querySelector('.back-btn').disabled=histIndex<=0;
    container.querySelector('.fwd-btn').disabled=histIndex>=history.length-1;
  }
  form.onsubmit=e=>{e.preventDefault();nav(input.value)};
  container.querySelector('.back-btn').onclick=()=>{if(histIndex>0){histIndex--;nav(history[histIndex],false)}};
  container.querySelector('.fwd-btn').onclick=()=>{if(histIndex<history.length-1){histIndex++;nav(history[histIndex],false)}};
  container.querySelector('.reload-btn').onclick=()=>{if(histIndex>=0)nav(history[histIndex],false)};
  iframe.onload=()=>status.textContent='Loaded';
  input.value='https://example.com'; nav('https://example.com');
}

function createVoidCode(container, winId){
  container.innerHTML=`<div class="vscode">
    <div class="vscode-activity">
      <button class="active" title="Explorer">📄</button>
      <button title="Search">🔍</button>
      <button title="Source">⎇</button>
    </div>
    <div class="vscode-sidebar">
      <div class="vscode-sidebar-header">Explorer</div>
      <div class="vscode-sidebar-content">
        <div class="vscode-file active">main.js</div>
        <div class="vscode-file">index.html</div>
        <div class="vscode-file">style.css</div>
      </div>
    </div>
    <div class="vscode-main">
      <div class="vscode-tabs"><div class="vscode-tab">main.js</div></div>
      <div class="vscode-editor" id="monaco-${winId}"></div>
      <div class="vscode-statusbar"><span>JavaScript</span><span>UTF-8</span><span>Ln 1, Col 1</span></div>
    </div>
  </div>`;
  const mount=container.querySelector(`#monaco-${winId}`);
  function init(){
    require.config({paths:{vs:'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.45.0/min/vs'}});
    require(['vs/editor/editor.main'],()=>{
      const editor=monaco.editor.create(mount,{
        value:`// VoidCode — VS Code style editor\n\nfunction hello(name) {\n  return \`Hello, ${name}! Welcome to the void.\`;\n}\n\nconsole.log(hello('developer'));\n`,
        language:'javascript', theme:'vs-dark', automaticLayout:true,
        fontSize:14, fontFamily:"'JetBrains Mono', monospace",
        minimap:{enabled:true}, scrollBeyondLastLine:false, padding:{top:8}
      });
      monacoEditors.set(winId,editor);
    });
  }
  if(window.require) init(); else setTimeout(init,400);
}

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
  let files=LS.get('files',[{
    name:'Welcome.txt', type:'file', content:'Welcome to Void OS Files!\nThis is a simple local file system.'
  },{name:'Projects',type:'folder'}]);
  container.innerHTML=`<div class="fm">
    <div class="fm-sidebar">
      <button class="active">📁 Home</button>
      <button>📄 Documents</button>
      <button>🖼 Pictures</button>
    </div>
    <div class="fm-main">
      <div class="fm-toolbar">
        <button id="fm-new-file">+ File</button>
        <button id="fm-new-folder">+ Folder</button>
      </div>
      <div class="fm-list" id="fm-list"></div>
    </div></div>`;
  const list=container.querySelector('#fm-list');
  function render(){
    list.innerHTML='';
    files.forEach((f)=>{
      const el=document.createElement('div');
      el.className='fm-item';
      el.innerHTML=`<div class="icon">${f.type==='folder'?'📁':'📄'}</div><span>${f.name}</span>`;
      el.ondblclick=()=>{ if(f.type==='file') alert(f.content||'(empty)'); };
      list.appendChild(el);
    });
    LS.set('files',files);
  }
  container.querySelector('#fm-new-file').onclick=()=>{
    const name=prompt('File name:'); if(!name) return;
    files.push({name,type:'file',content:''}); render();
  };
  container.querySelector('#fm-new-folder').onclick=()=>{
    const name=prompt('Folder name:'); if(!name) return;
    files.push({name,type:'folder'}); render();
  };
  render();
}

function createNotes(container){
  let notes=LS.get('notes',[{id:1,title:'Welcome',body:'This is your first note in Void OS.\n\nNotes are saved locally in your browser.'}]);
  let current=notes[0]?.id||null;
  container.innerHTML=`<div class="notes">
    <div class="notes-sidebar">
      <div class="notes-sidebar-header"><span>Notes</span><button id="note-new">+</button></div>
      <div class="notes-list" id="notes-list"></div>
    </div>
    <div class="notes-editor">
      <input class="notes-title" id="note-title" placeholder="Title"/>
      <textarea class="notes-body" id="note-body" placeholder="Start writing..."></textarea>
    </div></div>`;
  const list=container.querySelector('#notes-list');
  const titleEl=container.querySelector('#note-title');
  const bodyEl=container.querySelector('#note-body');
  function save(){
    const n=notes.find(x=>x.id===current);
    if(n){ n.title=titleEl.value; n.body=bodyEl.value; LS.set('notes',notes); renderList(); }
  }
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
  container.querySelector('#note-new').onclick=()=>{
    const id=Date.now();
    notes.unshift({id,title:'New Note',body:''});
    current=id; titleEl.value='New Note'; bodyEl.value='';
    LS.set('notes',notes); renderList();
  };
  titleEl.oninput=save; bodyEl.oninput=save;
  if(current){ const n=notes.find(x=>x.id===current); titleEl.value=n.title; bodyEl.value=n.body; }
  renderList();
}

function createStore(container){
  const catalog=[
    {id:'browser',name:'Void Browser',desc:'Real proxy-powered browser',icon:ICONS.browser},
    {id:'voidcode',name:'VoidCode',desc:'VS Code style editor with Monaco',icon:ICONS.voidcode},
    {id:'terminal',name:'Terminal',desc:'Command line for Void OS',icon:ICONS.terminal},
    {id:'files',name:'Files',desc:'Simple local file manager',icon:ICONS.files},
    {id:'notes',name:'Notes',desc:'Quick notes with local save',icon:ICONS.notes},
    {id:'settings',name:'Settings',desc:'System preferences',icon:ICONS.settings}
  ];
  container.innerHTML=`<div class="store">
    <h2>TycoreStore</h2>
    <p class="store-sub">Apps for Void OS — all run locally in your browser</p>
    <div class="store-grid" id="store-grid"></div></div>`;
  const grid=container.querySelector('#store-grid');
  catalog.forEach(app=>{
    const card=document.createElement('div');
    card.className='store-card';
    card.innerHTML=`<div class="icon">${iconImg(app.icon)}</div>
      <div class="name">${app.name}</div>
      <div class="desc">${app.desc}</div>
      <button data-id="${app.id}">Open</button>`;
    card.querySelector('button').onclick=()=>openApp(app.id);
    grid.appendChild(card);
  });
}

function createSettings(container){
  container.innerHTML=`<div class="app-content"><h2>Settings</h2>
    <div class="card"><label><input type="checkbox" checked/> Window animations</label></div>
    <div class="card"><p style="margin:0">Everything runs locally. No server storage yet.</p></div></div>`;
}
function createAbout(container){
  container.innerHTML=`<div class="app-content"><h2>Void OS</h2>
    <p>A complete desktop environment in your browser.</p>
    <div class="card"><strong>Apps</strong>
      <ul style="margin:8px 0 0 18px;color:var(--text-dim);font-size:13px;line-height:1.7">
        <li>Void Browser — proxy browser</li>
        <li>VoidCode — VS Code style editor</li>
        <li>Terminal, Files, Notes</li>
        <li>TycoreStore</li>
      </ul></div>
    <p style="font-size:12px;color:var(--text-dim);margin-top:16px">github.com/Tvmanisback/Void</p></div>`;
}

window.VoidOS={openApp,APPS};
})();