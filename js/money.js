/* Вкладка «Деньги»: практические советы + конвертер лари⇄рубль.
   Курс тянется из open.er-api.com и кешируется; ручной ввод всегда главнее автомата.
   Зависит от data.js (TIPS), util.js (fmtTs), traffic.js (addTraffic, byteLen). */

(function(){
  const box=document.getElementById('tips');
  TIPS.forEach(([t,d])=>{ const el=document.createElement('details'); el.innerHTML=`<summary>${t}</summary><div class="body">${d}</div>`; box.appendChild(el); });
})();

const rateEl=document.getElementById('rate'), gelEl=document.getElementById('gel'), rubEl=document.getElementById('rub');
const rateDot=document.getElementById('rateDot'), rateStatus=document.getElementById('rateStatus');

// состояние курса
let rateVal   = parseFloat(localStorage.getItem('gel_rate')) || 34;
let rateSrc   = localStorage.getItem('gel_rate_src') || 'default';   // auto | manual | default
let rateTs    = parseInt(localStorage.getItem('gel_rate_ts')||'0',10);
rateEl.value  = rateVal;

function updateRateStatus(){
  const stale = rateSrc==='auto' && rateTs && (Date.now()-rateTs > 24*3600*1000);
  rateDot.className='dot '+(rateSrc==='auto'?(stale?'stale':'auto'):rateSrc==='manual'?'manual':'');
  if(rateSrc==='manual')      rateStatus.textContent = 'задан вручную · '+fmtTs(rateTs);
  else if(rateSrc==='auto')   rateStatus.textContent = (stale?'⚠️ устарел · ':'из сети · ')+'обновлён '+fmtTs(rateTs);
  else                        rateStatus.textContent = 'значение по умолчанию — обнови или впиши свой';
}
function saveRate(){ localStorage.setItem('gel_rate',rateVal); localStorage.setItem('gel_rate_src',rateSrc); localStorage.setItem('gel_rate_ts',rateTs); }

function calc(from){
  const r=parseFloat(rateEl.value)||0;
  if(from==='gel'){ const g=parseFloat(gelEl.value); rubEl.value=(isNaN(g)||!r)?'':(g*r).toFixed(2); }
  else{ const b=parseFloat(rubEl.value); gelEl.value=(isNaN(b)||!r)?'':(b/r).toFixed(2); }
}
gelEl.addEventListener('input',()=>calc('gel'));
rubEl.addEventListener('input',()=>calc('rub'));
rateEl.addEventListener('input',()=>{
  rateVal=parseFloat(rateEl.value)||0; rateSrc='manual'; rateTs=Date.now(); saveRate(); updateRateStatus();
  calc(gelEl.value!==''?'gel':'rub');
});
document.getElementById('swap').addEventListener('click',()=>{ const g=gelEl.value; gelEl.value=rubEl.value; rubEl.value=g; calc('gel'); });

async function fetchRate(){
  const btn=document.getElementById('refreshRate'); const old=btn.textContent;
  btn.textContent='⏳ тянем…'; btn.disabled=true;
  try{
    const url='https://open.er-api.com/v6/latest/GEL';
    const res=await fetch(url,{cache:'no-store'});
    const raw=await res.text();
    addTraffic(byteLen(url), byteLen(raw));
    const data=JSON.parse(raw);
    const rub=data && data.rates && data.rates.RUB;
    if(!rub) throw new Error('нет курса RUB в ответе');
    rateVal=Math.round(rub*100)/100; rateSrc='auto'; rateTs=Date.now();
    rateEl.value=rateVal; saveRate(); updateRateStatus(); calc(gelEl.value!==''?'gel':'rub');
  }catch(e){
    rateStatus.textContent='нет сети — оставил последний курс '+(rateTs?('от '+fmtTs(rateTs)):'');
  }finally{ btn.textContent=old; btn.disabled=false; }
}
document.getElementById('refreshRate').addEventListener('click',fetchRate);
updateRateStatus();
// авто-обновление при загрузке: только если курс ещё не задавали вручную и он несвежий
if(navigator.onLine && rateSrc!=='manual' && (rateSrc==='default' || !rateTs || Date.now()-rateTs>6*3600*1000)){
  fetchRate();
}
