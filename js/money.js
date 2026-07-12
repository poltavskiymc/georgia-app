/* Вкладка «Деньги»: практические советы + конвертер GEL ⇄ RUB ⇄ USD ⇄ EUR.
   Все курсы приезжают ОДНИМ запросом (open.er-api.com, база GEL) и кешируются;
   курс, вбитый вручную, всегда главнее сетевого — но сетевой продолжаем помнить,
   чтобы кнопкой ⟲ можно было к нему вернуться.
   Считаем через базу: сумма → лари → все остальные валюты.
   Зависит от data.js (TIPS), util.js (fmtTs), traffic.js (addTraffic, byteLen). */

(function(){
  const box=document.getElementById('tips');
  TIPS.forEach(([t,d])=>{ const el=document.createElement('details'); el.innerHTML=`<summary>${t}</summary><div class="body">${d}</div>`; box.appendChild(el); });
})();

// d — курс по умолчанию (сколько единиц валюты за 1 лари) на случай, если сети не было ни разу;
// значения на 2026-07-12, живой курс всё равно перетрёт их при первом же выходе в сеть
const CUR = [
  { c:'GEL', s:'₾', d:1     },   // база
  { c:'RUB', s:'₽', d:29    },
  { c:'USD', s:'$', d:0.38  },
  { c:'EUR', s:'€', d:0.33  }
];
const FX = CUR.filter(x=>x.c!=='GEL');   // всё, кроме базы: у них есть курс

// { ts: когда тянули из сети, net:{RUB:…}, manual:{RUB:…} } — курсы «сколько за 1 ₾»
let money = loadRates();
let srcCur = 'GEL';                      // поле, в которое ввели последним — от него считаем

function loadRates(){
  try{
    const s=JSON.parse(localStorage.getItem('money_rates'));
    if(s && s.net) return { ts:s.ts||0, net:s.net||{}, manual:s.manual||{} };
  }catch(e){}
  // миграция со старых плоских ключей (был только курс лари→рубль)
  const st={ ts:0, net:{}, manual:{} };
  const old=parseFloat(localStorage.getItem('gel_rate'));
  const src=localStorage.getItem('gel_rate_src');
  if(old>0 && src==='manual')    st.manual.RUB=old;
  else if(old>0 && src==='auto'){ st.net.RUB=old; st.ts=parseInt(localStorage.getItem('gel_rate_ts')||'0',10); }
  return st;
}
function saveRates(){ localStorage.setItem('money_rates', JSON.stringify(money)); }

function rateOf(c){                      // действующий курс: ручной → сетевой → по умолчанию
  if(money.manual[c]>0) return money.manual[c];
  if(money.net[c]>0)    return money.net[c];
  return CUR.find(x=>x.c===c).d;
}
function srcOf(c){ return money.manual[c]>0 ? 'manual' : money.net[c]>0 ? 'auto' : 'default'; }
function isStale(){ return money.ts && Date.now()-money.ts > 24*3600*1000; }
function round(n,p){ const k=Math.pow(10,p); return Math.round(n*k)/k; }

// разметка: поля сумм и поля курсов
const convBox=document.getElementById('convBox'), rateRows=document.getElementById('rateRows');
convBox.innerHTML = CUR.map(x=>
  `<div class="conv"><input type="number" inputmode="decimal" id="c-${x.c}" placeholder="0"><span class="cur">${x.s} ${x.c}</span></div>`
).join('');
rateRows.innerHTML = FX.map(x=>
  `<div class="raterow">
     <span class="rl">1 ₾ =</span>
     <input type="number" inputmode="decimal" id="r-${x.c}" placeholder="${x.d}">
     <span class="cur">${x.s}</span>
     <button class="btn ghost sm" id="x-${x.c}" title="вернуть сетевой курс" hidden>⟲</button>
   </div>
   <div class="rmeta" id="m-${x.c}"><span class="dot"></span><span></span></div>`
).join('');

const amt = c => document.getElementById('c-'+c);
const rateDot=document.getElementById('rateDot'), rateStatus=document.getElementById('rateStatus');

// пересчёт «во все стороны»: поле from — источник, остальные три перерисовываются
function convert(from){
  srcCur=from;
  const v=parseFloat(amt(from).value);
  const gel = isNaN(v) ? NaN : v/rateOf(from);
  CUR.forEach(x=>{
    if(x.c===from) return;
    amt(x.c).value = isNaN(gel) ? '' : String(round(gel*rateOf(x.c), 2));
  });
}
CUR.forEach(x=> amt(x.c).addEventListener('input',()=>convert(x.c)) );

FX.forEach(x=>{
  document.getElementById('r-'+x.c).addEventListener('input',e=>{
    const v=parseFloat(e.target.value);
    if(v>0) money.manual[x.c]=v; else delete money.manual[x.c];   // пустое поле = снова сетевой
    saveRates(); renderRates(); convert(srcCur);
  });
  document.getElementById('x-'+x.c).addEventListener('click',()=>{
    delete money.manual[x.c]; saveRates(); renderRates(); convert(srcCur);
  });
});

function renderRates(){
  const stale=isStale();
  FX.forEach(x=>{
    const inp=document.getElementById('r-'+x.c);
    if(document.activeElement!==inp) inp.value=rateOf(x.c);       // не дёргаем поле под пальцем
    const src=srcOf(x.c), meta=document.getElementById('m-'+x.c);
    meta.firstElementChild.className = 'dot '+(src==='manual' ? 'manual' : src==='auto' ? (stale?'stale':'auto') : '');
    meta.lastElementChild.textContent =
      src==='manual' ? 'задан вручную' :
      src==='auto'   ? (stale?'⚠️ устарел · ':'из сети · ')+fmtTs(money.ts) :
                       'значение по умолчанию';
    document.getElementById('x-'+x.c).hidden = src!=='manual';
  });
  const manual=FX.filter(x=>srcOf(x.c)==='manual').map(x=>x.c);
  const tail = manual.length ? ' · вручную: '+manual.join(', ') : '';
  rateDot.className='dot '+(money.ts ? (stale?'stale':'auto') : manual.length ? 'manual' : '');
  rateStatus.textContent =
    money.ts        ? (stale?'⚠️ курсы устарели · ':'курсы из сети · ')+'обновлены '+fmtTs(money.ts)+tail :
    manual.length   ? 'курсы заданы вручную'+(manual.length<FX.length?' (не все)':'') :
                      'курсы по умолчанию — обнови или впиши свои';
}

async function fetchRates(){
  const btn=document.getElementById('refreshRate'); const old=btn.textContent;
  btn.textContent='⏳ тянем…'; btn.disabled=true;
  try{
    const url='https://open.er-api.com/v6/latest/GEL';
    const res=await fetch(url,{cache:'no-store'});
    const raw=await res.text();
    addTraffic(byteLen(url), byteLen(raw));
    const data=JSON.parse(raw);
    const got=FX.filter(x=> data && data.rates && data.rates[x.c]>0 );
    if(!got.length) throw new Error('нет курсов в ответе');
    got.forEach(x=> money.net[x.c]=round(data.rates[x.c], 4) );   // ручные курсы не трогаем
    money.ts=Date.now(); saveRates(); renderRates(); convert(srcCur);
  }catch(e){
    rateStatus.textContent='нет сети — оставил последние курсы '+(money.ts?('от '+fmtTs(money.ts)):'');
  }finally{ btn.textContent=old; btn.disabled=false; }
}
document.getElementById('refreshRate').addEventListener('click',fetchRates);

// инфо-плашка живёт под значком «?» у заголовка
const helpBtn=document.getElementById('moneyHelp'), helpBody=document.getElementById('moneyHelpBody');
helpBtn.addEventListener('click',()=>{
  const open=helpBody.hidden;
  helpBody.hidden=!open;
  helpBtn.setAttribute('aria-expanded', String(open));
});

renderRates();
// авто-обновление при загрузке: если курсов из сети ещё нет или они несвежие (ручные при этом уцелеют)
if(navigator.onLine && (!money.ts || Date.now()-money.ts > 6*3600*1000)) fetchRates();
