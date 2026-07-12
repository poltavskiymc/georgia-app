/* Вкладка «План» — три чек-листа в одном:
   1) «Сборы и граница» — статичный список из PACK (data.js), отмечаем галочками;
   2) «Хочу посмотреть» — точки, добавленные кнопкой ＋ на «Гид → Места» (route.js);
   3) «Хочу попробовать» — блюда, добавленные кнопкой ＋ на «Гид → Еда» (food.js).

   Загружается ДО route.js и food.js: те при отрисовке спрашивают planHas() и вешают planToggle().
   Обратно (когда пункт убрали прямо из «Плана») гид узнаёт об этом по событию 'planchange'.

   Хранение — localStorage, три ключа: pack_done (id из PACK), plan_see, plan_eat.
   Пункт плана: {id, emoji, name, sub, done, ts}. id стабильный (координаты точки / имя блюда) —
   по нему же потом можно будет мерджить план между двумя телефонами (см. BACKLOG.md). */

const plan = {
  see:  JSON.parse(localStorage.getItem('plan_see')  || '[]'),
  eat:  JSON.parse(localStorage.getItem('plan_eat')  || '[]'),
  pack: new Set(JSON.parse(localStorage.getItem('pack_done') || '[]')),
};
const PACK_TOTAL = PACK.reduce((n,[,items])=>n+items.length, 0);

function savePlan(){
  localStorage.setItem('plan_see',  JSON.stringify(plan.see));
  localStorage.setItem('plan_eat',  JSON.stringify(plan.eat));
  localStorage.setItem('pack_done', JSON.stringify([...plan.pack]));
}

// состояние пункта для кнопки ＋ в гиде: null — не в плане, иначе сам пункт
function planItem(kind, id){ return plan[kind].find(i=>i.id===id) || null; }
function planHas(kind, id){ return !!planItem(kind, id); }

// добавить/убрать из плана (кнопка ＋ в гиде и ✕ в самом плане)
function planToggle(kind, item){
  const i = plan[kind].findIndex(x=>x.id===item.id);
  if(i>=0) plan[kind].splice(i,1);
  else     plan[kind].push({...item, done:false, rating:0, ts:Date.now()});
  savePlan(); renderPlan();
  document.dispatchEvent(new CustomEvent('planchange'));   // гид перерисует свои кнопки
}

/* Оценка блюда в хинкалях (0–5). Оценил — значит попробовал: пункт сам появляется
   в плане и отмечается сделанным. Повторный тап по той же оценке снимает её. */
function planRating(id){ const it=planItem('eat',id); return it ? (it.rating||0) : 0; }
function planRate(item, rating){
  let it=planItem('eat', item.id);
  if(!it){ plan.eat.push({...item, done:false, rating:0, ts:Date.now()}); it=planItem('eat', item.id); }
  it.rating = (it.rating===rating) ? 0 : rating;   // тап по текущей оценке — снять
  if(it.rating>0) it.done=true;                    // оценил — значит попробовал
  it.ts=Date.now();
  savePlan(); renderPlan();
  document.dispatchEvent(new CustomEvent('planchange'));
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
        if(plan.pack.has(id)) plan.pack.delete(id); else plan.pack.add(id);
        savePlan(); row.classList.toggle('on', plan.pack.has(id)); renderPlan();
      });
      row.classList.toggle('on', plan.pack.has(id));
      body.appendChild(row);
    });
    g.appendChild(body);
    packList.appendChild(g);
    packGroups.push({el:g, counter:s.querySelector('.cnt'), items});
  });

  document.getElementById('packReset').addEventListener('click',()=>{
    if(!plan.pack.size) return;
    if(!confirm('Снять все галочки в сборах?')) return;
    plan.pack.clear(); savePlan();
    packList.querySelectorAll('.chk').forEach(r=>r.classList.remove('on'));
    renderPlan();
  });

  // --- «Хочу посмотреть» / «Хочу попробовать»: динамические списки из гида ---
  function renderList(kind, boxId, cntId, empty){
    const box=document.getElementById(boxId), cnt=document.getElementById(cntId);
    const items=plan[kind];
    const done=items.filter(i=>i.done).length;
    cnt.textContent = items.length ? done+'/'+items.length : '';
    cnt.classList.toggle('all', items.length>0 && done===items.length);
    box.innerHTML='';
    if(!items.length){ box.innerHTML=`<p class="muted empty">${empty}</p>`; return; }

    // невыполненные сверху, внутри — в порядке добавления
    [...items].sort((a,b)=> (a.done-b.done) || (a.ts-b.ts) ).forEach(it=>{
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
        it.ts=Date.now(); savePlan(); renderPlan();
        document.dispatchEvent(new CustomEvent('planchange'));
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
    const packDone=plan.pack.size;
    const total = PACK_TOTAL + plan.see.length + plan.eat.length;
    const done  = packDone + plan.see.filter(i=>i.done).length + plan.eat.filter(i=>i.done).length;
    document.getElementById('planProg').innerHTML =
      `<div class="bar"><i style="width:${total?Math.round(done/total*100):0}%"></i></div>`+
      `<span class="pn">${done} из ${total}</span>`;

    packCnt.textContent = packDone+'/'+PACK_TOTAL;
    packCnt.classList.toggle('all', packDone===PACK_TOTAL);
    packGroups.forEach(g=>{
      const k=g.items.filter(([id])=>plan.pack.has(id)).length;
      g.counter.textContent=k+'/'+g.items.length;
      g.el.classList.toggle('all', k===g.items.length);
    });

    renderList('see','seeList','seeCnt','Пусто. Открой «Гид → Места», найди интересное и жми ＋.');
    renderList('eat','eatList','eatCnt','Пусто. Открой «Гид → Еда» и добавь, что хочешь попробовать.');

    // чемпион по хинкалям — маленькая радость внизу списка еды
    const top=plan.eat.filter(i=>i.rating>0).sort((a,b)=>b.rating-a.rating)[0];
    const eatTop=document.getElementById('eatTop');
    eatTop.hidden=!top;
    if(top) eatTop.textContent=`🏆 Пока лидер: ${top.name} — ${'🥟'.repeat(top.rating)} (${top.rating} из 5)`;
    // ссылки 🧭 в «Хочу посмотреть» — в выбранном навигаторе (route.js грузится после нас)
    if(typeof applyNav==='function') applyNav();
  };

  renderPlan();
})();
