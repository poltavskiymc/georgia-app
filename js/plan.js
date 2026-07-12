/* Вкладка «План» — три чек-листа в одном:
   1) «Сборы и граница» — статичный список из PACK (data.js), отмечаем галочками;
   2) «Хочу посмотреть» — точки, добавленные кнопкой ＋ на «Гид → Места» (route.js);
   3) «Хочу попробовать» — блюда, добавленные кнопкой ＋ на «Гид → Еда» (food.js).

   Загружается ДО route.js и food.js: те при отрисовке спрашивают planHas() и вешают planToggle().
   Обратно (когда пункт убрали прямо из «Плана») гид узнаёт об этом по событию 'planchange'.

   Хранение — localStorage, три ключа: pack_done, plan_see, plan_eat.

   Формат пункта — под синхронизацию между телефонами (trip.js):
     {id, emoji, name, sub, coord, done, rating, add, ts, del}
   id стабильный (координаты точки / имя блюда) — по нему пункты и мерджатся;
   ts — время последней правки, по нему сервер выбирает победителя при конфликте;
   add — время добавления, только для порядка в списке;
   del:true — «надгробие»: пункт убран. Строку с надгробием мы храним, а не удаляем, потому что
   иначе пункт, убранный на этом телефоне, вернулся бы со второго при первом же синке.
   Наружу надгробий не видно: planItem() и списки их отфильтровывают. */

const plan = {
  see:  loadPlanList('plan_see'),
  eat:  loadPlanList('plan_eat'),
  pack: loadPack(),
};
const PACK_TOTAL = PACK.reduce((n,[,items])=>n+items.length, 0);

function loadPlanList(key){
  try{ const a=JSON.parse(localStorage.getItem(key)||'[]'); return Array.isArray(a)?a:[]; }
  catch(_){ return []; }
}
/* Сборы раньше хранились как простой массив id отмеченных пунктов. Для синка этого мало:
   нужно знать время правки и отличать «не трогали» от «сняли галочку» — иначе снятая на одном
   телефоне галочка вернётся со второго. Поэтому теперь [{id,done,ts}]; старое переносим. */
function loadPack(){
  const raw = loadPlanList('pack_done');
  const old = raw.some(x => typeof x==='string');
  const list = raw
    .map(x => typeof x==='string' ? {id:x, done:true, ts:Date.now()} : x)
    .filter(x => x && typeof x.id==='string');
  if(old) setTimeout(savePlan);   // переехали — сразу закрепим на диске, не дожидаясь первой галочки
  return list;
}

function savePlan(){
  localStorage.setItem('plan_see',  JSON.stringify(plan.see));
  localStorage.setItem('plan_eat',  JSON.stringify(plan.eat));
  localStorage.setItem('pack_done', JSON.stringify(plan.pack));
}
function planChanged(){ document.dispatchEvent(new CustomEvent('planchange')); }  // гид перерисует кнопки, trip.js отправит на сервер

// сборы
function packEntry(id){ return plan.pack.find(p=>p.id===id) || null; }
function packDone(id){ const p=packEntry(id); return !!(p && p.done); }
function packCount(){ return plan.pack.filter(p=>p.done).length; }
function packSet(id, done){
  const p=packEntry(id);
  if(p){ p.done=done; p.ts=Date.now(); }
  else plan.pack.push({id, done, ts:Date.now()});
}

// состояние пункта для кнопки ＋ в гиде: null — не в плане, иначе сам пункт
function planEntry(kind, id){ return plan[kind].find(i=>i.id===id) || null; }   // включая надгробия — только для внутренних нужд
function planLive(kind){ return plan[kind].filter(i=>!i.del); }
function planItem(kind, id){ const e=planEntry(kind,id); return (e && !e.del) ? e : null; }
function planHas(kind, id){ return !!planItem(kind, id); }

// добавить/убрать из плана (кнопка ＋ в гиде и ✕ в самом плане)
function planToggle(kind, item){
  const e = planEntry(kind, item.id);
  if(e && !e.del){ e.del=true; e.ts=Date.now(); }                                     // убрали → надгробие
  else if(e)     { Object.assign(e, item, revived()); }                               // добавили снова → оживили
  else            plan[kind].push({...item, ...revived()});
  savePlan(); renderPlan(); planChanged();
}
function revived(){ const now=Date.now(); return {done:false, rating:0, del:false, add:now, ts:now}; }

/* Оценка блюда в хинкалях (0–5). Оценил — значит попробовал: пункт сам появляется
   в плане и отмечается сделанным. Повторный тап по той же оценке снимает её. */
function planRating(id){ const it=planItem('eat',id); return it ? (it.rating||0) : 0; }
function planRate(item, rating){
  let it=planItem('eat', item.id);
  if(!it){                                        // оценили блюдо, которого в плане нет (или которое убирали) — вернём
    const e=planEntry('eat', item.id);
    if(e) Object.assign(e, item, revived());
    else  plan.eat.push({...item, ...revived()});
    it=planItem('eat', item.id);
  }
  it.rating = (it.rating===rating) ? 0 : rating;  // тап по текущей оценке — снять
  if(it.rating>0) it.done=true;                   // оценил — значит попробовал
  it.ts=Date.now();
  savePlan(); renderPlan(); planChanged();
}

/* Пришло объединённое состояние с сервера (trip.js) — просто заменяем им своё:
   мерджем занимался сервер, наши правки в ответе уже учтены. */
function planApplyRemote(data){
  if(Array.isArray(data.see))  plan.see  = data.see;
  if(Array.isArray(data.eat))  plan.eat  = data.eat;
  if(Array.isArray(data.pack)) plan.pack = data.pack;
  savePlan(); renderPlan(); planChanged();
}

// разметка виджета оценки: 5 хинкалей, залитые до текущей оценки
function rateHtml(rating){
  let h='<span class="rate">';
  for(let i=1;i<=5;i++) h+=`<button type="button" class="hk${i<=rating?' on':''}" data-r="${i}" title="${i} из 5">🥟</button>`;
  return h+'</span>';
}

(function(){
  const packList=document.getElementById('packList');
  const packCnt=document.getElementById('packCnt');
  const packGroups=[];
  const packRows=[];

  // --- «Сборы и граница»: статичные группы из PACK ---
  PACK.forEach(([cat, items])=>{
    const g=document.createElement('details'); g.className='grp';
    const s=document.createElement('summary');
    s.innerHTML=`<span class="gname">${esc(cat)}</span><span class="cnt"></span>`;
    g.appendChild(s);
    const body=document.createElement('div'); body.className='body';
    items.forEach(([id,text,hint])=>{
      const row=document.createElement('div'); row.className='chk';
      row.innerHTML=`<span class="box">✓</span><span class="ct"><span class="cn">${esc(text)}</span>`+
                    (hint?`<span class="ch">${esc(hint)}</span>`:'')+`</span>`;
      row.addEventListener('click',()=>{
        packSet(id, !packDone(id));
        savePlan(); renderPlan(); planChanged();   // галочки сборов тоже уезжают на второй телефон
      });
      body.appendChild(row);
      packRows.push({id, row});                    // классы проставит renderPlan — он же единственный, кто рисует состояние
    });
    g.appendChild(body);
    packList.appendChild(g);
    packGroups.push({el:g, counter:s.querySelector('.cnt'), items});
  });

  document.getElementById('packReset').addEventListener('click',()=>{
    if(!packCount()) return;
    if(!confirm('Снять все галочки в сборах?')) return;
    plan.pack.forEach(p=>{ if(p.done){ p.done=false; p.ts=Date.now(); } });   // снятие тоже надо донести до второго телефона
    savePlan(); renderPlan(); planChanged();
  });

  // --- «Хочу посмотреть» / «Хочу попробовать»: динамические списки из гида ---
  function renderList(kind, boxId, cntId, empty){
    const box=document.getElementById(boxId), cnt=document.getElementById(cntId);
    const items=planLive(kind);
    const done=items.filter(i=>i.done).length;
    cnt.textContent = items.length ? done+'/'+items.length : '';
    cnt.classList.toggle('all', items.length>0 && done===items.length);
    box.innerHTML='';
    if(!items.length){ box.innerHTML=`<p class="muted empty">${empty}</p>`; return; }

    // невыполненные сверху, внутри — в порядке добавления
    items.sort((a,b)=> (a.done-b.done) || ((a.add||a.ts)-(b.add||b.ts)) ).forEach(it=>{
      const row=document.createElement('div'); row.className='chk'+(it.done?' on':'');
      row.innerHTML=`<span class="box">✓</span>`+
        `<span class="ct"><span class="cn">${esc(it.emoji||'')} ${esc(it.name)}</span>`+
        (it.sub?`<span class="ch">${esc(it.sub)}</span>`:'')+
        // оценка в хинкалях — только у еды и только когда попробовал
        (kind==='eat' && it.done ? rateHtml(it.rating||0) : '')+`</span>`+
        // href проставит applyNav() из route.js — по классу navpt, в выбранном навигаторе
        (it.coord?`<a class="go navpt" data-c="${esc(it.coord)}" data-n="${encodeURIComponent(it.name)}" target="_blank" rel="noopener" title="Маршрут">🧭</a>`:'')+
        `<button type="button" class="del" title="Убрать из плана">✕</button>`;
      row.addEventListener('click',e=>{
        if(e.target.closest('.del') || e.target.closest('.navpt') || e.target.closest('.rate')) return;
        it.done=!it.done;
        if(!it.done) it.rating=0;                         // «не пробовал» — оценка ни к чему
        it.ts=Date.now(); savePlan(); renderPlan(); planChanged();
      });
      row.querySelectorAll('.hk').forEach(b=>b.addEventListener('click',e=>{
        e.stopPropagation();
        planRate(it, +b.dataset.r);
      }));
      row.querySelector('.del').addEventListener('click',e=>{
        e.stopPropagation();
        planToggle(kind, it);                             // пункт уже в плане → это удаление
      });
      box.appendChild(row);
    });
  }

  // общий прогресс сверху вкладки + счётчики групп сборов
  window.renderPlan = function(){
    const packOk=packCount();
    const see=planLive('see'), eat=planLive('eat');
    const total = PACK_TOTAL + see.length + eat.length;
    const done  = packOk + see.filter(i=>i.done).length + eat.filter(i=>i.done).length;
    document.getElementById('planProg').innerHTML =
      `<div class="bar"><i style="width:${total?Math.round(done/total*100):0}%"></i></div>`+
      `<span class="pn">${done} из ${total}</span>`;

    packCnt.textContent = packOk+'/'+PACK_TOTAL;
    packCnt.classList.toggle('all', packOk===PACK_TOTAL);
    packRows.forEach(({id,row})=>row.classList.toggle('on', packDone(id)));
    packGroups.forEach(g=>{
      const k=g.items.filter(([id])=>packDone(id)).length;
      g.counter.textContent=k+'/'+g.items.length;
      g.el.classList.toggle('all', k===g.items.length);
    });

    renderList('see','seeList','seeCnt','Пусто. Открой «Гид → Места», найди интересное и жми ＋.');
    renderList('eat','eatList','eatCnt','Пусто. Открой «Гид → Еда» и добавь, что хочешь попробовать.');

    // чемпион по хинкалям — маленькая радость внизу списка еды
    const top=eat.filter(i=>i.rating>0).sort((a,b)=>b.rating-a.rating)[0];
    const eatTop=document.getElementById('eatTop');
    eatTop.hidden=!top;
    if(top) eatTop.textContent=`🏆 Пока лидер: ${top.name} — ${'🥟'.repeat(top.rating)} (${top.rating} из 5)`;
    // ссылки 🧭 в «Хочу посмотреть» — в выбранном навигаторе (route.js грузится после нас)
    if(typeof applyNav==='function') applyNav();
  };

  renderPlan();
})();
