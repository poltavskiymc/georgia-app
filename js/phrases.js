/* Разговорник (вкладка «Фразы») + избранное.
   Избранное хранится в localStorage по грузинскому написанию фразы и выносится
   отдельным разделом наверх. Зависит от data.js (PHRASES) и util.js (speak/canSpeak). */

let favs = new Set(JSON.parse(localStorage.getItem('fav_phrases')||'[]'));
function saveFavs(){ localStorage.setItem('fav_phrases', JSON.stringify([...favs])); }
function matchP([ru,ka,tr],f){ return !f || ru.toLowerCase().includes(f) || tr.toLowerCase().includes(f) || ka.includes(f); }
function makeRow(p){
  const [ru,ka,tr]=p;
  const row=document.createElement('div'); row.className='phrase';
  const fav=document.createElement('button');
  fav.className='fav'+(favs.has(ka)?' on':''); fav.textContent=favs.has(ka)?'★':'☆';
  fav.title='Закрепить в избранном';
  fav.addEventListener('click',()=>{
    if(favs.has(ka)) favs.delete(ka); else favs.add(ka);
    saveFavs(); renderPhrases(document.getElementById('phraseSearch').value);
  });
  row.appendChild(fav);
  const txt=document.createElement('div'); txt.className='txt';
  txt.innerHTML=`<div class="ru">${ru}</div><div class="ka">${ka}</div><div class="tr">${tr}</div>`;
  row.appendChild(txt);
  const btn=document.createElement('button'); btn.className='say'; btn.textContent='🔊';
  btn.title = canSpeak ? 'Озвучить' : 'Озвучка недоступна на этом устройстве';
  // tr — запасной вариант: если грузинского голоса в системе нет (iOS), читаем транскрипцию
  btn.addEventListener('click',()=>speak(ka.split(' / ')[0], 'ka-GE', tr.split(' / ')[0]));
  row.appendChild(btn);
  return row;
}
function renderPhrases(filter=''){
  const box = document.getElementById('phraseList');
  const f = filter.trim().toLowerCase();
  box.innerHTML='';
  if(favs.size){
    const favItems=[];
    PHRASES.forEach(([cat,items])=>items.forEach(p=>{ if(favs.has(p[1]) && matchP(p,f)) favItems.push(p); }));
    if(favItems.length){
      const h=document.createElement('div'); h.className='cat'; h.textContent='⭐ Избранное'; box.appendChild(h);
      const card=document.createElement('div'); card.className='card';
      favItems.forEach(p=>card.appendChild(makeRow(p)));
      box.appendChild(card);
    }
  }
  PHRASES.forEach(([cat, items])=>{
    const matched = items.filter(p=>matchP(p,f));
    if(!matched.length) return;
    const h = document.createElement('div'); h.className='cat'; h.textContent=cat; box.appendChild(h);
    const card = document.createElement('div'); card.className='card';
    matched.forEach(p=>card.appendChild(makeRow(p)));
    box.appendChild(card);
  });
  if(!box.children.length) box.innerHTML='<div class="card muted">Ничего не найдено 🤷</div>';
}
document.getElementById('phraseSearch').addEventListener('input',e=>renderPhrases(e.target.value));
renderPhrases();
