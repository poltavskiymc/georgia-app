/* Вкладка «Чат»: ИИ-помощник через DeepSeek. История хранится в localStorage.
   Зависит от data.js (SYSTEM), util.js (esc), nav.js (show), traffic.js (addTraffic, byteLen).
   refreshKeyHint/renderChat/history используются также в settings.js. */

let history = JSON.parse(localStorage.getItem('ds_hist')||'[]');
const logEl=document.getElementById('chatLog'), emptyEl=document.getElementById('chatEmpty');
const inputEl=document.getElementById('chatInput'), sendBtn=document.getElementById('sendBtn');

function refreshKeyHint(){
  const has=!!localStorage.getItem('ds_key');
  document.getElementById('keyHint').innerHTML = has
    ? '✅ Ключ подключён — можно спрашивать.'
    : '⚠️ Ключ не задан. Открой вкладку <b>⚙️ Ключ</b> и вставь ключ DeepSeek.';
}
function renderChat(){
  logEl.innerHTML='';
  history.forEach(m=>{ const d=document.createElement('div'); d.className='msg '+(m.role==='user'?'u':'a'); d.innerHTML=`<div class="bub">${esc(m.content)}</div>`; logEl.appendChild(d); });
  emptyEl.style.display = history.length ? 'none':'block';
  logEl.style.minHeight = history.length ? '40vh' : '0';
  if(!history.length){ refreshKeyHint(); window.scrollTo(0,0); }
  else window.scrollTo(0,document.body.scrollHeight);
}
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
inputEl.addEventListener('keydown',e=>{ if(e.key==='Enter'&&!e.shiftKey){ e.preventDefault(); send(); } });
sendBtn.addEventListener('click',send);

async function send(){
  const text=inputEl.value.trim(); if(!text) return;
  const key=localStorage.getItem('ds_key');
  if(!key){ show('settings'); alert('Сначала вставь ключ DeepSeek во вкладке ⚙️ Ключ'); return; }
  inputEl.value=''; inputEl.style.height='auto'; syncBarHeight();
  history.push({role:'user',content:text}); renderChat();
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
    localStorage.setItem('ds_hist',JSON.stringify(history.slice(-40)));
    renderChat();
  }catch(err){
    typing.remove();
    history.push({role:'assistant',content:'⚠️ Ошибка: '+err.message+'\n\nПроверь ключ, баланс на DeepSeek и интернет.'});
    renderChat();
  }finally{ sendBtn.disabled=false; }
}

refreshKeyHint(); renderChat(); show('chat');
