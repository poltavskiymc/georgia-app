/* Вкладка «План» — четыре чек-листа в одном:
   1) «Сборы и граница» — список из PACK (data.js) плюс группа «Своё», куда можно дописать
      что угодно руками (packAdd);
   2) «Хочу посмотреть» — точки, добавленные кнопкой ＋ на «Гид → Места» (route.js);
   3) «Хочу попробовать» — блюда, добавленные кнопкой ＋ на «Гид → Еда» (food.js);
   4) «Свой чек-лист» — пустой список, целиком заполняется руками уже в дороге.

   Загружается ДО route.js и food.js: те при отрисовке спрашивают planHas() и вешают planToggle().
   Обратно (когда пункт убрали прямо из «Плана») гид узнаёт об этом по событию 'planchange'.

   Хранение — localStorage, четыре ключа: pack_done, plan_see, plan_eat, plan_my.

   Формат пункта — под синхронизацию между телефонами (trip.js):
     {id, emoji, name, sub, coord, done, rating, add, ts, del}
   id стабильный (координаты точки / имя блюда) — по нему пункты и мерджатся;
   ts — время последней правки, по нему сервер выбирает победителя при конфликте;
   add — время добавления, только для порядка в списке;
   del:true — «надгробие»: пункт убран. Строку с надгробием мы храним, а не удаляем, потому что
   иначе пункт, убранный на этом телефоне, вернулся бы со второго при первом же синке.
   Наружу надгробий не видно: planItem() и списки их отфильтровывают.

   У пунктов, добавленных руками, id вида «u_…» (OWN_RE) — генерится случайно, чтобы два телефона
   не выдумали одинаковый. По этому же префиксу свои пункты сборов отличаются от статичных из PACK:
   лежат они в одном списке plan.pack, но рисуются в отдельной группе и их можно удалять. */

const plan = {
  see:  loadPlanList('plan_see'),
  eat:  loadPlanList('plan_eat'),
  my:   loadPlanList('plan_my'),
  pack: loadPack(),
};
const PACK_TOTAL = PACK.reduce((n,[,items])=>n+items.length, 0);
const PACK_IDS   = new Set(PACK.flatMap(([,items])=>items.map(([id])=>id)));
const OWN_RE     = /^u_/;

function ownId(){ return 'u_' + Date.now().toString(36) + Math.random().toString(36).slice(2,7); }

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
  localStorage.setItem('plan_my',   JSON.stringify(plan.my));
  localStorage.setItem('pack_done', JSON.stringify(plan.pack));
}
function planChanged(){ document.dispatchEvent(new CustomEvent('planchange')); }  // гид перерисует кнопки, trip.js отправит на сервер

// сборы
function packEntry(id){ return plan.pack.find(p=>p.id===id) || null; }
function packDone(id){ const p=packEntry(id); return !!(p && p.done && !p.del); }
function packOwn(){                                                    // свои пункты сборов, живые, в порядке добавления
  return plan.pack.filter(p=>OWN_RE.test(p.id) && !p.del && p.name)
                  .sort((a,b)=>(a.add||a.ts)-(b.add||b.ts));
}
/* Считаем только то, что реально показано: пункты из PACK и живые свои. Иначе в счётчик
   попали бы надгробия удалённых своих пунктов и галочки от пунктов, выпиленных из PACK. */
function packCount(){
  return plan.pack.filter(p=>p.done && !p.del && (PACK_IDS.has(p.id) || OWN_RE.test(p.id))).length;
}
function packTotal(){ return PACK_TOTAL + packOwn().length; }
function packSet(id, done){
  const p=packEntry(id);
  if(p){ p.done=done; p.ts=Date.now(); }
  else plan.pack.push({id, done, ts:Date.now()});
}
function packAdd(name){
  const now=Date.now();
  plan.pack.push({id:ownId(), name, done:false, add:now, ts:now});
  savePlan(); renderPlan(); planChanged();
}
function packDel(id){
  const p=packEntry(id);
  if(!p) return;
  p.del=true; p.ts=Date.now();                                         // надгробие, а не splice — см. шапку файла
  savePlan(); renderPlan(); planChanged();
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

// пункт, придуманный руками («Свой чек-лист»): id случайный, так что дубля с другого телефона не будет
function planAdd(kind, name){
  const now=Date.now();
  plan[kind].push({id:ownId(), name, done:false, rating:0, add:now, ts:now});
  savePlan(); renderPlan(); planChanged();
}

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

/* Пришло объединённое состояние с сервера (trip.js). Заменять им своё «в лоб» НЕЛЬЗЯ:
   пока запрос летел (а это сотни миллисекунд), человек мог успеть нажать галочку — сервер
   про неё ещё не знает, и его ответ бы её затёр, тап пропал бы молча. Поэтому мержим ответ
   со своим текущим состоянием по тому же правилу, что и сервер: побеждает более свежий ts.
   Правка, сделанная во время запроса, свежее — она и выживает, а trip.js её потом допошлёт. */
function planApplyRemote(data){
  for(const kind of ['see','eat','my','pack']){
    if(Array.isArray(data[kind])) plan[kind] = mergeById(plan[kind], data[kind]);
  }
  savePlan(); renderPlan(); planChanged();
}
function mergeById(mine, theirs){
  const byId = new Map();
  for(const it of [...mine, ...theirs]){
    if(!it || typeof it.id!=='string') continue;
    const prev = byId.get(it.id);
    if(!prev || (it.ts||0) > (prev.ts||0)) byId.set(it.id, it);
  }
  return [...byId.values()];
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

  /* --- «Своё» в сборах: группы такой в PACK нет, её наполняет сам человек ---
     Пункты лежат в том же plan.pack (значит, синкаются даром), отличаются id вида «u_…». */
  const ownGrp=document.createElement('details'); ownGrp.className='grp';
  ownGrp.innerHTML=`<summary><span class="gname">✍️ Своё</span><span class="cnt"></span></summary>`+
                   `<div class="body"><div class="ownbox"></div>${addFormHtml('Что ещё взять?')}</div>`;
  packList.appendChild(ownGrp);
  const ownBox=ownGrp.querySelector('.ownbox');
  const ownCnt=ownGrp.querySelector('.cnt');
  bindAddForm(ownGrp.querySelector('.addrow'), packAdd);

  function addFormHtml(ph){
    return `<form class="addrow"><input type="text" maxlength="80" autocomplete="off" placeholder="${esc(ph)}">`+
           `<button class="btn sm" type="submit" title="Добавить">＋</button></form>`;
  }
  function bindAddForm(form, add){
    form.addEventListener('submit', e=>{
      e.preventDefault();
      const inp=form.querySelector('input');
      const name=inp.value.trim();
      if(!name) return;
      inp.value='';
      add(name);
      inp.focus();                                   // добавляют обычно пачкой — не заставляем целиться в поле снова
    });
  }

  function renderPackOwn(){
    const items=packOwn();
    const done=items.filter(p=>p.done).length;
    ownCnt.textContent=done+'/'+items.length;
    ownGrp.classList.toggle('all', items.length>0 && done===items.length);
    ownBox.innerHTML='';
    if(!items.length){
      ownBox.innerHTML='<p class="muted empty">Чего-то не хватает в списках выше — впиши сюда.</p>';
      return;
    }
    items.forEach(p=>{
      const row=document.createElement('div'); row.className='chk'+(p.done?' on':'');
      row.innerHTML=`<span class="box">✓</span><span class="ct"><span class="cn">${esc(p.name)}</span></span>`+
                    `<button type="button" class="del" title="Удалить пункт">✕</button>`;
      row.addEventListener('click',e=>{
        if(e.target.closest('.del')) return;
        packSet(p.id, !p.done);
        savePlan(); renderPlan(); planChanged();
      });
      row.querySelector('.del').addEventListener('click',e=>{
        e.stopPropagation();
        packDel(p.id);
      });
      ownBox.appendChild(row);
    });
  }

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
        `<span class="ct"><span class="cn">${it.emoji?esc(it.emoji)+' ':''}${esc(it.name)}</span>`+
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

  // --- «Свой чек-лист»: пустой список, который человек ведёт сам ---
  bindAddForm(document.getElementById('myAdd'), name=>planAdd('my', name));

  // общий прогресс сверху вкладки + счётчики групп сборов
  window.renderPlan = function(){
    const packOk=packCount(), packAll=packTotal();
    const see=planLive('see'), eat=planLive('eat'), my=planLive('my');
    const lists = [see, eat, my];
    const total = packAll + lists.reduce((n,l)=>n+l.length, 0);
    const done  = packOk   + lists.reduce((n,l)=>n+l.filter(i=>i.done).length, 0);
    document.getElementById('planProg').innerHTML =
      `<div class="bar"><i style="width:${total?Math.round(done/total*100):0}%"></i></div>`+
      `<span class="pn">${done} из ${total}</span>`;

    packCnt.textContent = packOk+'/'+packAll;
    packCnt.classList.toggle('all', packOk===packAll);
    packRows.forEach(({id,row})=>row.classList.toggle('on', packDone(id)));
    packGroups.forEach(g=>{
      const k=g.items.filter(([id])=>packDone(id)).length;
      g.counter.textContent=k+'/'+g.items.length;
      g.el.classList.toggle('all', k===g.items.length);
    });
    renderPackOwn();

    renderList('see','seeList','seeCnt','Пусто. Открой «Гид → Места», найди интересное и жми ＋.');
    renderList('eat','eatList','eatCnt','Пусто. Открой «Гид → Еда» и добавь, что хочешь попробовать.');
    renderList('my','myList','myCnt','Пусто. Впиши в поле выше что угодно — купить симку, забрать зарядку, позвонить домой.');

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
