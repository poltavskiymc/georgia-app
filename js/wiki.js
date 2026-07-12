/* Энциклопедия по регионам: открывает статью из русской Википедии в модальном окне.
   Реальные тексты (не выдумки), с фото и ссылкой на полную статью. Прочитанное кэшируется
   в localStorage → доступно и офлайн. Кнопки .wikibtn рендерит route.js.
   Зависит от util.js (esc, byteLen), traffic.js (addTraffic). */

const wikiModal=document.getElementById('wikiModal'),
      wikiTitle=document.getElementById('wikiTitle'),
      wikiBody=document.getElementById('wikiBody');

function openModal(){ wikiModal.hidden=false; document.body.style.overflow='hidden'; }
function closeModal(){ wikiModal.hidden=true; document.body.style.overflow=''; }
document.getElementById('wikiClose').addEventListener('click',closeModal);
wikiModal.addEventListener('click',e=>{ if(e.target===wikiModal) closeModal(); });
document.addEventListener('keydown',e=>{ if(e.key==='Escape' && !wikiModal.hidden) closeModal(); });

function wikiPageUrl(title){ return 'https://ru.wikipedia.org/wiki/'+encodeURIComponent(title.replace(/ /g,'_')); }

function renderWiki(obj){
  const paras = (obj.extract||'').split('\n').filter(s=>s.trim())
    .map(p=>`<p>${esc(p)}</p>`).join('');
  wikiBody.innerHTML =
    (obj.img?`<img class="wiki-img" src="${obj.img}" alt="" loading="lazy">`:'')+
    (paras||'<p class="muted">Текст статьи недоступен.</p>')+
    `<a class="wiki-more" href="${wikiPageUrl(obj.title)}" target="_blank" rel="noopener">Читать полностью в Википедии →</a>`;
  wikiBody.scrollTop=0;
}

async function openWiki(title, name){
  wikiTitle.textContent = '📖 '+(name||title);
  wikiBody.innerHTML='<p class="muted">Загружаю статью…</p>';
  openModal();
  const cacheKey='wiki:'+title;
  const cached=localStorage.getItem(cacheKey);
  if(cached){ try{ renderWiki(JSON.parse(cached)); return; }catch(_){} }
  if(!navigator.onLine){
    wikiBody.innerHTML='<p class="muted">Нет сети — статья ещё не сохранена. Открой её при интернете, и дальше она будет доступна офлайн.</p>'+
      `<a class="wiki-more" href="${wikiPageUrl(title)}" target="_blank" rel="noopener">Открыть в Википедии →</a>`;
    return;
  }
  try{
    const url='https://ru.wikipedia.org/w/api.php?format=json&formatversion=2&origin=*&action=query&prop=extracts|pageimages'+
              '&exintro=1&explaintext=1&redirects=1&pithumbsize=500&titles='+encodeURIComponent(title);
    const res=await fetch(url);
    const raw=await res.text();
    addTraffic(byteLen(url), byteLen(raw));
    const page=((JSON.parse(raw).query||{}).pages||[])[0];
    if(!page || page.missing || !page.extract) throw new Error('статья не найдена');
    const obj={ title:page.title, extract:page.extract, img:page.thumbnail?page.thumbnail.source:'' };
    localStorage.setItem(cacheKey, JSON.stringify(obj));
    renderWiki(obj);
  }catch(err){
    wikiBody.innerHTML='<p class="muted">Не удалось загрузить статью ('+esc(err.message)+').</p>'+
      `<a class="wiki-more" href="${wikiPageUrl(title)}" target="_blank" rel="noopener">Открыть в Википедии →</a>`;
  }
}

document.querySelectorAll('.wikibtn').forEach(b=>{
  b.addEventListener('click',()=>openWiki(b.dataset.wiki, b.dataset.title));
});
