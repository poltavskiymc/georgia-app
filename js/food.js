/* Вкладка «Еда»: традиционные грузинские блюда — фото, состав, вкус, история, факт/миф.
   Блюдо-аккордеон; фото подгружается из Википедии при первом раскрытии (эмодзи как заглушка),
   URL фото кэшируется. Зависит от data.js (FOOD), util.js (esc, byteLen), traffic.js (addTraffic). */

(function(){
  const box=document.getElementById('foodList');
  FOOD.forEach(([emoji,name,translit,wiki,desc,sostav,vkus,history,fact])=>{
    const d=document.createElement('details'); d.className='dish';
    d.innerHTML=
      `<summary><span class="demoji">${emoji}</span><span class="dname">${esc(name)}</span><span class="dtr">${esc(translit)}</span></summary>`+
      `<div class="dbody">`+
        `<div class="dphoto" data-wiki="${esc(wiki)}">${emoji}</div>`+
        `<p class="ddesc">${esc(desc)}</p>`+
        `<div class="dfield"><b>🧂 Состав:</b> ${esc(sostav)}</div>`+
        `<div class="dfield"><b>👅 Вкус:</b> ${esc(vkus)}</div>`+
        `<div class="dfield"><b>📜 История:</b> ${esc(history)}</div>`+
        `<div class="dfield"><b>💡 Факт:</b> ${esc(fact)}</div>`+
      `</div>`;
    d.addEventListener('toggle',()=>{ if(d.open) loadDishPhoto(d.querySelector('.dphoto')); });
    box.appendChild(d);
  });
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
