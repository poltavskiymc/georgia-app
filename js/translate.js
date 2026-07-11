/* Вкладка «Перевод»: русская фраза → английский + грузинский (с транскрипцией),
   каждый вариант можно озвучить. Перевод делает DeepSeek (тот же ключ, что и чат).
   Зависит от util.js (esc, speak, canSpeak), nav.js (show), traffic.js (addTraffic, byteLen). */

const trInput=document.getElementById('trInput'), trBtn=document.getElementById('trBtn'),
      trResult=document.getElementById('trResult'), trHint=document.getElementById('trHint');
function trRow(lng, val, cls, translit){
  const row=document.createElement('div'); row.className='trrow';
  const txt=document.createElement('div'); txt.className='txt';
  txt.innerHTML=`<div class="lng">${lng}</div><div class="val ${cls||''}">${esc(val)}</div>`+(translit?`<div class="tr">${esc(translit)}</div>`:'');
  row.appendChild(txt);
  if(canSpeak && cls!=='src'){
    const b=document.createElement('button'); b.className='say'; b.textContent='🔊';
    b.addEventListener('click',()=>speak(val, cls==='ka'?'ka-GE':'en-US'));
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
  const prompt=`Переведи фразу с русского. Верни СТРОГО JSON без пояснений и без markdown, ровно в формате {"en":"...","ka":"...","translit":"..."}: en — перевод на английский, ka — перевод на грузинский грузинскими буквами, translit — русская транскрипция грузинского произношения. Фраза: "${text}"`;
  try{
    const body=JSON.stringify({ model: localStorage.getItem('ds_model')||'deepseek-chat', messages:[{role:'user',content:prompt}], temperature:0.2 });
    const res=await fetch('https://api.deepseek.com/chat/completions',{ method:'POST', headers:{'Content-Type':'application/json','Authorization':'Bearer '+key}, body });
    const raw=await res.text();
    addTraffic(byteLen(body), byteLen(raw));
    if(!res.ok) throw new Error('HTTP '+res.status+' — '+raw.slice(0,120));
    let content=(JSON.parse(raw).choices?.[0]?.message?.content||'').replace(/```json|```/g,'').trim();
    const obj=JSON.parse(content);
    trResult.appendChild(trRow('Русский', text, 'src', ''));
    trResult.appendChild(trRow('English', obj.en||'—', 'en', ''));
    trResult.appendChild(trRow('ქართული (грузинский)', obj.ka||'—', 'ka', obj.translit||''));
  }catch(err){
    trHint.textContent='⚠️ Не получилось перевести: '+err.message+'. Проверь ключ, баланс на DeepSeek и интернет.';
  }finally{ trBtn.textContent=old; trBtn.disabled=false; }
}
trBtn.addEventListener('click',translate);
trInput.addEventListener('keydown',e=>{ if(e.key==='Enter'&&!e.shiftKey){ e.preventDefault(); translate(); } });
document.getElementById('trClear').addEventListener('click',()=>{ trInput.value=''; trResult.innerHTML=''; trHint.textContent=''; });
