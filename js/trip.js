/* Совместная поездка: «План» (сборы, места, блюда, оценки) синхронизируется между телефонами
   по короткому коду. Один создаёт поездку и делится кодом, второй его вставляет — дальше
   галочки ходят туда-сюда сами. Всё остальное (ключ DeepSeek, чаты, трафик) остаётся личным.

   Сервер — свой, код в server/main.ts (Deno Deploy + KV). Он же и мерджит: мы шлём
   ему одним POST всё своё состояние и получаем объединённое (union по id пункта, конфликт —
   по ts последней правки). Поэтому синк = ровно один запрос, и он же и отправка, и приём.

   Оффлайн: правки копятся в localStorage как обычно, при появлении сети уедут сами.

   Грузится ПОСЛЕ plan.js (нужны plan/savePlan/renderPlan/planApplyRemote) и ПОСЛЕ nav.js (show).
   Зависит ещё от util.js (byteLen, fmtTs) и traffic.js (addTraffic). */

const TRIP_API  = 'https://georgia-trip-5xq93cphsve6.poltavskiymc.deno.net';   // сервер (server/main.ts); пусто = синк выключен
const TRIP_ABC  = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';     // без 0/O/1/I — их путают, когда код диктуют голосом
const TRIP_RE   = /^[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/;
const TRIP_POLL = 45000;                                  // как часто спрашивать «на сервере что-то поменялось?»
const TRIP_IDLE = 15000;                                  // вернулись в приложение — синкаем, но не чаще этого

const trip = {
  id:  localStorage.getItem('trip_id')  || '',
  rev: +(localStorage.getItem('trip_rev') || 0),          // версия на сервере — по ней ловим чужие правки дёшево
  ts:  +(localStorage.getItem('trip_ts')  || 0),          // когда последний раз успешно синкнулись
};
let tripApplying = false;    // применяем ответ сервера — свои же planchange игнорируем, иначе будет петля
let tripBusy     = false;
let tripTimer    = 0;
let tripChanged  = 0;        // время последней локальной правки — чтобы не потерять то, что нажали во время запроса

function tripSave(){
  localStorage.setItem('trip_id',  trip.id);
  localStorage.setItem('trip_rev', trip.rev);
  localStorage.setItem('trip_ts',  trip.ts);
}

// «k7m4 qp2x», «K7M4-QP2X», ссылка с #trip=… → «K7M4-QP2X». Не сходится — вернём ''.
function tripNorm(s){
  const m = /trip=([^&\s]+)/i.exec(s||'');
  const raw = (m ? m[1] : (s||'')).toUpperCase();
  const c = [...raw].filter(ch => TRIP_ABC.includes(ch)).join('');
  return c.length===8 ? c.slice(0,4)+'-'+c.slice(4) : '';
}
function tripNewId(){
  const pick = () => TRIP_ABC[Math.floor(Math.random()*TRIP_ABC.length)];
  const c = Array.from({length:8}, pick).join('');
  return c.slice(0,4)+'-'+c.slice(4);
}

async function tripFetch(path, opts={}){
  const url = TRIP_API + path;
  const res = await fetch(url, opts);
  const raw = await res.text();
  addTraffic(byteLen(url)+byteLen(opts.body), byteLen(raw));
  let data={}; try{ data=JSON.parse(raw||'{}'); }catch(_){}
  if(!res.ok) throw Object.assign(new Error(data.error||('HTTP '+res.status)), {code:data.error||'http', status:res.status});
  return data;
}

/* Синк: отправляем всё своё состояние, получаем объединённое и им же и живём.
   Один запрос вместо «скачать → смержить → отправить» — и никакой гонки между телефонами. */
async function tripSync(){
  if(!TRIP_API || !trip.id || tripBusy) return;
  if(!navigator.onLine){ tripRender('offline'); return; }
  tripBusy=true; tripRender('busy');
  const started=Date.now();
  try{
    const data = await tripFetch('/t/'+trip.id, {
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ see:plan.see, eat:plan.eat, pack:plan.pack }),
    });
    tripApplying=true;
    try{ planApplyRemote(data); } finally{ tripApplying=false; }
    trip.rev=data.rev; trip.ts=Date.now(); tripSave();
    tripRender('ok');
    if(tripChanged>started) tripSoon();          // пока ходили на сервер, юзер успел что-то нажать — донесём
  }catch(e){
    tripRender(e.code==='no_trip' ? 'gone' : 'err');
  }finally{
    tripBusy=false;
  }
}

// дешёвая проверка (пара сотен байт вместо всего плана): не поменялось ли что-то у второго
async function tripPoll(){
  if(!TRIP_API || !trip.id || tripBusy || document.hidden || !navigator.onLine) return;
  try{
    const d = await tripFetch('/t/'+trip.id+'/rev');
    if(d.rev !== trip.rev) tripSync();
  }catch(_){ /* сеть моргнула — не шумим, попробуем на следующем тике */ }
}

function tripSoon(){ clearTimeout(tripTimer); tripTimer=setTimeout(tripSync, 1200); }   // правки идут пачками — не дёргаем сервер на каждую галочку

async function tripCreate(){
  for(let i=0;i<5;i++){                                   // 32^8 кодов, но вдруг — попробуем ещё раз
    const id=tripNewId();
    try{
      await tripFetch('/t/'+id, {method:'PUT'});
      trip.id=id; trip.rev=0; trip.ts=0; tripSave();
      await tripSync();                                   // зальём то, что уже отмечено на этом телефоне
      return id;
    }catch(e){ if(e.code!=='exists') throw e; }
  }
  throw new Error('busy');
}

/* Присоединиться: наш локальный план не пропадает, а вливается в общий (union по id).
   Если кода на сервере нет — это опечатка, а не «пустая поездка»: сервер ответит 404. */
async function tripJoin(id){
  const prev=trip.id;
  trip.id=id; trip.rev=0; trip.ts=0;
  try{
    await tripFetch('/t/'+id+'/rev');                     // проверяем, что такая поездка есть
  }catch(e){
    trip.id=prev;                                         // не нашлась — откатываемся, чтобы не синкать в никуда
    throw e;
  }
  tripSave();
  await tripSync();
}

function tripLeave(){
  trip.id=''; trip.rev=0; trip.ts=0; tripSave();
  clearTimeout(tripTimer);
  tripRender();
}

/* ---------- интерфейс: карточка «Совместная поездка» в ⚙️ ---------- */

const tripEls = {
  card:   document.getElementById('tripCard'),
  none:   document.getElementById('tripNone'),
  on:     document.getElementById('tripOn'),
  idText: document.getElementById('tripIdText'),
  input:  document.getElementById('tripInput'),
  dot:    document.getElementById('tripDot'),
  status: document.getElementById('tripStatus'),
  hint:   document.getElementById('tripHint'),
  where:  document.getElementById('planWhere'),
};

function tripAgo(ts){
  if(!ts) return 'ещё не синхронизировались';
  const s=Math.round((Date.now()-ts)/1000);
  if(s<60)   return 'обновлено только что';
  if(s<3600) return 'обновлено '+Math.round(s/60)+' мин назад';
  return 'обновлено '+fmtTs(ts);
}

const TRIP_STATE = {
  busy:    ['',        'синхронизирую…'],
  ok:      ['auto',    ''],                                                       // текст подставим из tripAgo
  offline: ['stale',   'нет сети — правки уедут, когда появится интернет'],
  err:     ['manual',  'сервер не ответил, попробуем позже'],
  gone:    ['manual',  'такой поездки на сервере нет — проверь код'],
};

function tripRender(state){
  if(!tripEls.card) return;
  if(!TRIP_API){                                          // воркер ещё не задеплоен — не дразним кнопками
    tripEls.none.hidden=true; tripEls.on.hidden=true;
    tripEls.hint.textContent='Синхронизация не настроена: не задан адрес сервера (TRIP_API в js/trip.js).';
    return;
  }
  const on=!!trip.id;
  tripEls.none.hidden=on;
  tripEls.on.hidden=!on;
  tripEls.where.textContent = on
    ? `Синхронизируется со второй трубкой по коду ${trip.id} (⚙️ → «Совместная поездка»).`
    : 'Галочки хранятся на этом телефоне. Хочешь общий план на двоих — ⚙️ → «Совместная поездка».';
  if(!on) return;

  tripEls.idText.textContent=trip.id;
  const [dot, text] = TRIP_STATE[state] || TRIP_STATE.ok;
  tripEls.dot.className='dot '+dot;
  tripEls.status.textContent = text || tripAgo(trip.ts);
}

function tripHint(t){ if(tripEls.hint) tripEls.hint.textContent=t||''; }

async function tripShare(){
  const link = location.origin + location.pathname + '#trip=' + trip.id;
  const text = `Наш план поездки в Грузию 🇬🇪\nКод поездки: ${trip.id}`;
  if(navigator.share){
    try{ await navigator.share({title:'Поездка в Грузию', text, url:link}); }
    catch(_){ /* передумал — это не ошибка */ }
    return;
  }
  try{ await navigator.clipboard.writeText(text+'\n'+link); tripHint('Ссылка скопирована — вставь её в мессенджер.'); }
  catch(_){ prompt('Скопируй и отправь второму:', link); }
}

(function(){
  if(!tripEls.card) return;

  document.getElementById('tripCreate').addEventListener('click', async e=>{
    const b=e.currentTarget; b.disabled=true; tripHint('');
    try{
      await tripCreate();
      tripHint('Поездка создана. Жми «Поделиться» и отправь код второму.');
    }catch(_){ tripHint('⚠️ Не вышло создать поездку — проверь интернет и попробуй ещё раз.'); }
    b.disabled=false; tripRender();
  });

  document.getElementById('tripJoin').addEventListener('click', ()=>{
    const id=tripNorm(tripEls.input.value);
    if(!id){ tripHint('⚠️ Код из 8 знаков, вида K7M4-QP2X. Можно вставить и ссылку целиком.'); return; }
    askJoin(id);
  });

  document.getElementById('tripShare').addEventListener('click', tripShare);

  document.getElementById('tripSyncNow').addEventListener('click', ()=>{ tripHint(''); tripSync(); });

  document.getElementById('tripLeave').addEventListener('click', ()=>{
    if(!confirm('Выйти из поездки? План останется на этом телефоне, но перестанет синхронизироваться.')) return;
    tripLeave(); tripHint('Вышли из поездки. План остался здесь.');
  });

  // ссылка вида …/#trip=K7M4-QP2X — открыли из мессенджера
  const fromLink=tripNorm(location.hash);
  if(fromLink){
    history.replaceState(null, '', location.pathname);   // код в адресной строке больше не нужен
    if(fromLink!==trip.id) setTimeout(()=>askJoin(fromLink), 400);
  }

  document.addEventListener('planchange', ()=>{
    if(tripApplying) return;                             // это мы сами только что применили ответ сервера
    tripChanged=Date.now();
    tripSoon();
  });
  document.addEventListener('visibilitychange', ()=>{
    if(!document.hidden && Date.now()-trip.ts > TRIP_IDLE) tripSync();
  });
  window.addEventListener('online', tripSync);
  setInterval(tripPoll, TRIP_POLL);

  tripRender();
  if(trip.id) tripSync();
})();

async function askJoin(id){
  if(typeof show==='function') show('settings');
  const mine = planLive('see').length + planLive('eat').length + packCount();
  const warn = mine ? `\n\nТвои ${mine} отмеченных пункта не пропадут — они добавятся в общий план.` : '';
  if(!confirm(`Присоединиться к поездке ${id}?${warn}`)) return;
  tripHint('');
  try{
    await tripJoin(id);
    tripEls.input.value='';
    tripHint('Готово — план теперь общий.');
  }catch(e){
    tripHint(e.code==='no_trip'
      ? `⚠️ Поездки ${id} не существует. Проверь код — его видно у второго в ⚙️.`
      : '⚠️ Не вышло присоединиться — проверь интернет и попробуй ещё раз.');
  }
  tripRender();
}
