/* «Гид» → Еда: традиционные грузинские блюда — фото, состав, вкус, история, факт/миф.
   Блюдо-аккордеон; фото подгружается из Википедии при первом раскрытии (эмодзи как заглушка),
   URL фото кэшируется. Кнопка ＋ в заголовке кладёт блюдо в «План» → «Хочу попробовать» (plan.js);
   отмечают «попробовал» уже там. Зависит от data.js (FOOD), util.js (esc, byteLen),
   traffic.js (addTraffic), plan.js (planItem, planToggle). */

// id пункта плана — название блюда (уникально в FOOD)
function syncFoodBtns(){
  document.querySelectorAll('#foodList .dish').forEach(d=>{
    const name=d.dataset.n;
    const it=planItem('eat', name);
    const b=d.querySelector('.addp');
    b.classList.toggle('on', !!it);
    b.classList.toggle('done', !!(it&&it.done));
    b.textContent = it ? '✓' : '＋';
    b.title = it ? 'В плане — убрать' : 'Хочу попробовать';

    // оценка в хинкалях: подсвечиваем залитые и пишем словами, что вышло
    const r=planRating(name);
    d.querySelectorAll('.hk').forEach(h=>h.classList.toggle('on', +h.dataset.r<=r));
    d.querySelector('.rnote').textContent =
      r                 ? RATE_WORDS[r] :
      (it && it.done)   ? 'попробовал, но без оценки' : 'ещё не пробовал';
  });
}
const RATE_WORDS={1:'так себе',2:'нормально',3:'хорошо',4:'очень вкусно',5:'бесподобно!'};
document.addEventListener('planchange', syncFoodBtns);   // блюдо убрали/оценили прямо в «Плане»

(function(){
  const box=document.getElementById('foodList');
  FOOD.forEach(([emoji,name,translit,wiki,desc,sostav,vkus,history,fact])=>{
    const d=document.createElement('details'); d.className='dish'; d.dataset.n=name;
    d.innerHTML=
      `<summary>`+
        `<span class="demoji">${emoji}</span><span class="dname">${esc(name)}</span>`+
        `<span class="dtr">${esc(translit)}</span>`+
        `<button type="button" class="addp" data-n="${esc(name)}">＋</button>`+
      `</summary>`+
      `<div class="dbody">`+
        `<div class="dphoto" data-wiki="${esc(wiki)}">${emoji}</div>`+
        `<p class="ddesc">${esc(desc)}</p>`+
        `<div class="dfield"><b>🧂 Состав:</b> ${esc(sostav)}</div>`+
        `<div class="dfield"><b>👅 Вкус:</b> ${esc(vkus)}</div>`+
        `<div class="dfield"><b>📜 История:</b> ${esc(history)}</div>`+
        `<div class="dfield"><b>💡 Факт:</b> ${esc(fact)}</div>`+
        `<div class="rateline"><b>Твоя оценка:</b>${rateHtml(0)}<span class="rnote"></span></div>`+
      `</div>`;

    const item={ id:name, emoji, name, sub:translit };
    // preventDefault на всплывшем клике — иначе нажатие на ＋ ещё и раскрывало бы <details>
    d.querySelector('.addp').addEventListener('click',e=>{
      e.preventDefault(); e.stopPropagation();
      planToggle('eat', item);
      syncFoodBtns();
    });
    // оценка в хинкалях: блюдо само добавится в план и отметится как попробованное
    d.querySelectorAll('.hk').forEach(b=>b.addEventListener('click',e=>{
      e.preventDefault(); e.stopPropagation();
      planRate(item, +b.dataset.r);
      syncFoodBtns();
    }));
    d.addEventListener('toggle',()=>{ if(d.open) loadDishPhoto(d.querySelector('.dphoto')); });
    box.appendChild(d);
  });
  syncFoodBtns();
})();

async function loadDishPhoto(el){
  if(!el || el.dataset.loaded) return;
  el.dataset.loaded='1';
  const wiki=el.dataset.wiki;
  if(!wiki) return;                                  // нет статьи — остаётся эмодзи
  const ck='dishimg:'+wiki;
  let src=localStorage.getItem(ck);
  if(!src){
    if(!navigator.onLine) return;
    try{
      const url='https://ru.wikipedia.org/w/api.php?format=json&formatversion=2&origin=*&action=query&prop=pageimages&piprop=thumbnail&pithumbsize=600&redirects=1&titles='+encodeURIComponent(wiki);
      const res=await fetch(url);
      const raw=await res.text();
      addTraffic(byteLen(url), byteLen(raw));
      const p=((JSON.parse(raw).query||{}).pages||[])[0];
      src=(p&&p.thumbnail)?p.thumbnail.source:'';
      if(src) localStorage.setItem(ck, src);
    }catch(_){ return; }
  }
  if(src){
    const img=new Image(); img.className='dimg'; img.alt='';
    img.onload=()=>{ el.classList.add('has-img'); el.innerHTML=''; el.appendChild(img); };
    img.src=src;
  }
}
