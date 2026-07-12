/* Вкладка «Чат»: ИИ-помощник через DeepSeek. Несколько независимых чатов, история в localStorage.
   Зависит от data.js (SYSTEM), util.js (esc, fmtTs), nav.js (show), traffic.js (addTraffic, byteLen).
   refreshKeyHint/renderChat/clearCurrentChat используются также в settings.js.

   Хранение: ds_chats = [{id, ts, msgs:[{role,content}]}], ds_chat_cur = id активного.
   В DeepSeek уходит контекст ТОЛЬКО активного чата — так его и чистят: новым чатом. */

const CH_KEY='ds_chats', CUR_KEY='ds_chat_cur', MAX_MSGS=40;
const logEl=document.getElementById('chatLog'), emptyEl=document.getElementById('chatEmpty');
const inputEl=document.getElementById('chatInput'), sendBtn=document.getElementById('sendBtn');
const titleEl=document.getElementById('curTitle');

function uid(){ return Date.now().toString(36)+Math.random().toString(36).slice(2,7); }
function loadChats(){
  const saved=JSON.parse(localStorage.getItem(CH_KEY)||'null');
  if(saved && saved.length) return saved;
  const old=JSON.parse(localStorage.getItem('ds_hist')||'[]');   // миграция со старого одиночного чата
  return [{id:uid(), ts:Date.now(), msgs:old}];
}
let chats=loadChats();
let curId=localStorage.getItem(CUR_KEY);
if(!chats.some(c=>c.id===curId)) curId=chats[0].id;

function cur(){ return chats.find(c=>c.id===curId); }
let history=cur().msgs;                                          // активный чат; settings.js смотрит сюда же
function saveChats(){
  chats.forEach(c=>{ if(c.msgs.length>MAX_MSGS) c.msgs=c.msgs.slice(-MAX_MSGS); });
  localStorage.setItem(CH_KEY, JSON.stringify(chats));
  localStorage.setItem(CUR_KEY, curId);
}
// имя чата = первая реплика пользователя
function chatTitle(c){
  const first=c.msgs.find(m=>m.role==='user');
  if(!first) return 'Новый чат';
  return first.content.length>44 ? first.content.slice(0,44)+'…' : first.content;
}

function refreshKeyHint(){
  const has=!!localStorage.getItem('ds_key');
  document.getElementById('keyHint').innerHTML = has
    ? '✅ Ключ подключён — можно спрашивать.'
    : '⚠️ Ключ не задан. Открой ⚙️ в шапке и вставь ключ DeepSeek.';
}
function renderChat(){
  logEl.innerHTML='';
  history.forEach(m=>{ const d=document.createElement('div'); d.className='msg '+(m.role==='user'?'u':'a'); d.innerHTML=`<div class="bub">${esc(m.content)}</div>`; logEl.appendChild(d); });
  emptyEl.style.display = history.length ? 'none':'block';
  logEl.style.minHeight = history.length ? '40vh' : '0';
  titleEl.textContent = chatTitle(cur());
  if(!history.length){ refreshKeyHint(); window.scrollTo(0,0); }
  else window.scrollTo(0,document.body.scrollHeight);
}

/* ---- управление чатами ---- */
function switchChat(id){ curId=id; history=cur().msgs; saveChats(); renderChat(); }
function newChat(){
  const empty=chats.find(c=>!c.msgs.length);                     // пустой чат уже есть — незачем плодить
  if(empty){ switchChat(empty.id); return; }
  const c={id:uid(), ts:Date.now(), msgs:[]};
  chats.unshift(c); switchChat(c.id);
}
function deleteChat(id){
  chats=chats.filter(c=>c.id!==id);
  if(!chats.length) chats=[{id:uid(), ts:Date.now(), msgs:[]}];
  if(!chats.some(c=>c.id===curId)) curId=chats[0].id;
  history=cur().msgs; saveChats(); renderChat(); renderChatList();
}
function clearCurrentChat(){ history.length=0; cur().ts=Date.now(); saveChats(); renderChat(); }

const chatsModal=document.getElementById('chatsModal'), chatsBody=document.getElementById('chatsBody');
function renderChatList(){
  chatsBody.innerHTML='';
  chats.forEach(c=>{
    const row=document.createElement('div'); row.className='chatrow'+(c.id===curId?' cur':'');
    const t=document.createElement('div'); t.className='ct';
    const n=c.msgs.length;
    t.innerHTML=`<div class="cn">${esc(chatTitle(c))}</div>`+
                `<div class="cm">${n? n+' '+plural(n,'сообщение','сообщения','сообщений') : 'пусто'} · ${fmtTs(c.ts)}${c.id===curId?' · сейчас открыт':''}</div>`;
    t.addEventListener('click',()=>{ switchChat(c.id); closeChats(); });
    row.appendChild(t);
    const del=document.createElement('button'); del.className='cdel'; del.textContent='🗑'; del.title='Удалить чат';
    del.addEventListener('click',()=>{ if(confirm('Удалить этот чат? Переписку не вернуть.')) deleteChat(c.id); });
    row.appendChild(del);
    chatsBody.appendChild(row);
  });
}
function plural(n,one,few,many){
  const a=Math.abs(n)%100, b=a%10;
  if(a>10&&a<20) return many;
  if(b>1&&b<5) return few;
  return b===1 ? one : many;
}
function openChats(){ renderChatList(); chatsModal.hidden=false; }
function closeChats(){ chatsModal.hidden=true; }
document.getElementById('chatsBtn').addEventListener('click',openChats);
document.getElementById('chatsClose').addEventListener('click',closeChats);
chatsModal.addEventListener('click',e=>{ if(e.target===chatsModal) closeChats(); });
document.getElementById('newChat').addEventListener('click',()=>{ newChat(); inputEl.focus(); });

/* ---- ввод и отправка ---- */
const CHIPS=["Что попробовать из еды?","Составь план на 5 дней","Переведи: сколько стоит проехать до Казбеги?","Какое вино взять с собой?","Романтичное место на вечер"];
(function(){ const c=document.getElementById('chips'); CHIPS.forEach(t=>{ const b=document.createElement('button'); b.className='chip'; b.textContent=t; b.onclick=()=>{inputEl.value=t; send();}; c.appendChild(b); }); })();

/* Плашка ввода — fixed, поэтому сама она чат не «раздвигает»: отдаём её высоту в CSS
   (--chatbar-h → padding-bottom у #v-chat), иначе нижние сообщения уезжают под неё. */
const barEl=document.getElementById('chatbar');
function syncBarHeight(){ document.documentElement.style.setProperty('--chatbar-h', barEl.offsetHeight+'px'); }
if(window.ResizeObserver) new ResizeObserver(syncBarHeight).observe(barEl);
window.addEventListener('resize',syncBarHeight);
syncBarHeight();

function growInput(){ inputEl.style.height='auto'; inputEl.style.height=Math.min(inputEl.scrollHeight,160)+'px'; syncBarHeight(); }
inputEl.addEventListener('input',growInput);
// Enter — перенос строки (для отправки есть кнопка ➤). На десктопе Ctrl/⌘+Enter отправляет.
inputEl.addEventListener('keydown',e=>{ if(e.key==='Enter'&&(e.metaKey||e.ctrlKey)){ e.preventDefault(); send(); } });
sendBtn.addEventListener('click',send);

async function send(){
  const text=inputEl.value.trim(); if(!text) return;
  const key=localStorage.getItem('ds_key');
  if(!key){ show('settings'); alert('Сначала вставь ключ DeepSeek — ⚙️ в шапке'); return; }
  inputEl.value=''; inputEl.style.height='auto'; syncBarHeight();
  history.push({role:'user',content:text}); cur().ts=Date.now(); saveChats(); renderChat();
  sendBtn.disabled=true;
  const typing=document.createElement('div'); typing.className='msg a'; typing.innerHTML='<div class="bub">…</div>'; logEl.appendChild(typing); window.scrollTo(0,document.body.scrollHeight);
  try{
    const body=JSON.stringify({ model: localStorage.getItem('ds_model')||'deepseek-chat', messages:[{role:'system',content:SYSTEM}, ...history.slice(-12)], temperature:0.7 });
    const res=await fetch('https://api.deepseek.com/chat/completions',{
      method:'POST',
      headers:{'Content-Type':'application/json','Authorization':'Bearer '+key},
      body
    });
    typing.remove();
    const raw=await res.text();
    addTraffic(byteLen(body), byteLen(raw));
    if(!res.ok){ throw new Error('HTTP '+res.status+' — '+raw.slice(0,180)); }
    const data=JSON.parse(raw);
    const reply=data.choices?.[0]?.message?.content || '(пустой ответ)';
    history.push({role:'assistant',content:reply});
    saveChats(); renderChat();
  }catch(err){
    typing.remove();
    history.push({role:'assistant',content:'⚠️ Ошибка: '+err.message+'\n\nПроверь ключ, баланс на DeepSeek и интернет.'});
    saveChats(); renderChat();
  }finally{ sendBtn.disabled=false; }
}

saveChats(); refreshKeyHint(); renderChat(); show('chat');
