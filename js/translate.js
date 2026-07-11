/* Вкладка «Перевод»: фраза (текстом или голосом) → русский + английский + грузинский,
   каждый вариант можно озвучить. Язык ввода определяется автоматически, так что можно
   говорить/писать и по-русски, и по-грузински. Перевод делает DeepSeek (ключ как в чате).
   Голосовой ввод — Web Speech API (нужен Chrome + https + доступ к микрофону).
   Зависит от util.js (esc, speak, canSpeak), nav.js (show), traffic.js (addTraffic, byteLen). */

const trInput=document.getElementById('trInput'), trBtn=document.getElementById('trBtn'),
      trResult=document.getElementById('trResult'), trHint=document.getElementById('trHint');

const SPEAK_LANG = { ru:'ru-RU', en:'en-US', ka:'ka-GE' };
function trRow(lng, val, cls, translit){
  const row=document.createElement('div'); row.className='trrow';
  const txt=document.createElement('div'); txt.className='txt';
  txt.innerHTML=`<div class="lng">${lng}</div><div class="val ${cls||''}">${esc(val)}</div>`+(translit?`<div class="tr">${esc(translit)}</div>`:'');
  row.appendChild(txt);
  if(canSpeak){
    const b=document.createElement('button'); b.className='say'; b.textContent='🔊';
    b.addEventListener('click',()=>speak(val, SPEAK_LANG[cls]||'en-US'));
    row.appendChild(b);
  }
  return row;
}
async function translate(){
  const text=trInput.value.trim(); if(!text) return;
  const key=localStorage.getItem('ds_key');
  if(!key){ show('settings'); alert('Сначала вставь ключ DeepSeek во вкладке ⚙️ Ключ'); return; }
  const old=trBtn.textContent; trBtn.disabled=true; trBtn.textContent='⏳ перевожу…';
  trHint.textContent=''; trResult.innerHTML='';
  const prompt=`Определи язык фразы и переведи её на русский, английский и грузинский. Верни СТРОГО JSON без пояснений и без markdown, ровно в формате {"ru":"...","en":"...","ka":"...","translit":"..."}: ru/en/ka — переводы на эти три языка, translit — русская транскрипция грузинского произношения. Фраза: "${text}"`;
  try{
    const body=JSON.stringify({ model: localStorage.getItem('ds_model')||'deepseek-chat', messages:[{role:'user',content:prompt}], temperature:0.2 });
    const res=await fetch('https://api.deepseek.com/chat/completions',{ method:'POST', headers:{'Content-Type':'application/json','Authorization':'Bearer '+key}, body });
    const raw=await res.text();
    addTraffic(byteLen(body), byteLen(raw));
    if(!res.ok) throw new Error('HTTP '+res.status+' — '+raw.slice(0,120));
    let content=(JSON.parse(raw).choices?.[0]?.message?.content||'').replace(/```json|```/g,'').trim();
    const obj=JSON.parse(content);
    trResult.appendChild(trRow('Русский', obj.ru||text, 'ru', ''));
    trResult.appendChild(trRow('English', obj.en||'—', 'en', ''));
    trResult.appendChild(trRow('ქართული (грузинский)', obj.ka||'—', 'ka', obj.translit||''));
  }catch(err){
    trHint.textContent='⚠️ Не получилось перевести: '+err.message+'. Проверь ключ, баланс на DeepSeek и интернет.';
  }finally{ trBtn.textContent=old; trBtn.disabled=false; }
}
trBtn.addEventListener('click',translate);
trInput.addEventListener('keydown',e=>{ if(e.key==='Enter'&&!e.shiftKey){ e.preventDefault(); translate(); } });
document.getElementById('trClear').addEventListener('click',()=>{ trInput.value=''; trResult.innerHTML=''; trHint.textContent=''; });

/* ---- голосовой ввод ---- */
const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
let rec = null;
function listen(lang, btn){
  if(!SR){ trHint.textContent='Голосовой ввод не поддерживается этим браузером (нужен Chrome).'; return; }
  if(rec){ rec.stop(); return; }                         // повторный тап — остановить
  rec = new SR(); rec.lang=lang; rec.interimResults=false; rec.maxAlternatives=1;
  const old=btn.textContent; btn.textContent='🔴 слушаю…'; btn.classList.add('rec');
  trHint.textContent = lang==='ka-GE' ? 'Говори по-грузински…' : 'Говори по-русски…';
  rec.onresult=e=>{ trInput.value=e.results[0][0].transcript; };
  rec.onerror=e=>{
    trHint.textContent = e.error==='not-allowed'
      ? '⚠️ Нет доступа к микрофону — разреши его для сайта.'
      : (e.error==='no-speech' ? 'Не расслышал — попробуй ещё раз.' : 'Ошибка распознавания: '+e.error);
  };
  rec.onend=()=>{ btn.textContent=old; btn.classList.remove('rec'); rec=null; if(trInput.value.trim()) translate(); };
  try{ rec.start(); }catch(_){ rec=null; btn.textContent=old; btn.classList.remove('rec'); }
}
document.getElementById('micRu').addEventListener('click',function(){ listen('ru-RU', this); });
document.getElementById('micKa').addEventListener('click',function(){ listen('ka-GE', this); });
