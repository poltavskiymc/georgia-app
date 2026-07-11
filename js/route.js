/* Вкладка «Маршрут»: гид по регионам с точками.
   - Кнопка 🧭 у точки строит маршрут в выбранном навигаторе (Google / Яндекс / Maps.me).
   - «📍 Показать расстояния» берёт геопозицию и считает расстояние по дорогам через
     OSRM (OpenStreetMap, без ключа), с откатом на прямую (haversine из util.js).
   Зависит от data.js (ROUTE), util.js (haversine, fmtDist), traffic.js (addTraffic, byteLen).
   ВАЖНО: геолокация в браузере работает только на https/localhost, не на http. */

let navProv = localStorage.getItem('nav_provider') || 'google';
let userPos = null;

// ссылка-маршрут до точки в выбранном навигаторе
function navLink(coord, name){
  const c=encodeURIComponent(coord), n=encodeURIComponent(name||'');
  if(navProv==='yandex') return 'https://yandex.ru/maps/?rtext=~'+c+'&rtt=auto';
  // geo: — Android откроет офлайн-карты (Maps.me / Organic Maps), если выбраны для карт.
  // Схема mapsme:// из браузера ненадёжна (уводит в браузер, если приложение её не перехватило).
  if(navProv==='mapsme')  return 'geo:'+coord+'?q='+coord+'('+n+')';
  return 'https://www.google.com/maps/dir/?api=1&destination='+c+'&travelmode=driving';
}
function photoLink(q){ return 'https://www.google.com/search?tbm=isch&q='+encodeURIComponent(q+' Georgia'); }
function applyNav(){
  document.querySelectorAll('.navpt').forEach(a=>{ a.href=navLink(a.dataset.c, decodeURIComponent(a.dataset.n||'')); });
}

// дорожные расстояния от userPos до всех точек одним запросом (OSRM table), метры или null
async function roadDistances(from, coords){
  const toLL = s => { const [la,lo]=s.split(',').map(Number); return lo+','+la; };   // OSRM хочет lon,lat
  const pts = [from[1]+','+from[0], ...coords.map(toLL)].join(';');
  const url = 'https://router.project-osrm.org/table/v1/driving/'+pts+'?sources=0&annotations=distance';
  const res = await fetch(url);
  const raw = await res.text();
  addTraffic(byteLen(url), byteLen(raw));
  const data = JSON.parse(raw);
  return (data.distances && data.distances[0]) ? data.distances[0].slice(1) : null;   // без расстояния до самого себя
}
async function applyDist(){
  if(!userPos) return;
  const els=[...document.querySelectorAll('.dist[data-c]')];
  // мгновенно показываем прямую (с «~») — заодно фолбэк, если дороги не отдадутся
  els.forEach(el=>{ const [la,lo]=el.dataset.c.split(',').map(Number); el.textContent='~'+fmtDist(haversine(userPos,[la,lo])); });
  const setHint=t=>{ const h=document.getElementById('geoHint'); if(h) h.textContent=t; };
  if(!navigator.onLine){ setHint('Расстояния по прямой (нет сети для дорог).'); return; }
  try{
    const meters=await roadDistances(userPos, els.map(el=>el.dataset.c));
    if(meters){ els.forEach((el,i)=>{ if(meters[i]!=null) el.textContent=fmtDist(meters[i]/1000); }); setHint('🛣️ Расстояние по дорогам (OpenStreetMap) от тебя.'); }
    else setHint('Расстояния по прямой (дороги недоступны).');
  }catch(e){ setHint('Расстояния по прямой (дороги недоступны).'); }
}

(function renderRoute(){
  const box=document.getElementById('routeList'); const card=document.createElement('div'); card.className='card';
  ROUTE.forEach(([t,d,center,pois])=>{
    const d1=document.createElement('details');
    const cityName=t.replace(/^\S+\s/,'').split(' (')[0].split(' / ')[0];
    const rows=(pois||[]).map(([ic,name,coord,note])=>
      `<div class="poi"><div class="pin">${ic}</div>`+
      `<div class="pt"><div class="pn">${name}</div>${note?`<div class="pd">${note}</div>`:''}</div>`+
      `<span class="dist" data-c="${coord}"></span>`+
      `<a class="ph" href="${photoLink(name+' '+cityName)}" target="_blank" rel="noopener" title="Фото">📷</a>`+
      `<a class="go navpt" data-c="${coord}" data-n="${encodeURIComponent(name)}" target="_blank" rel="noopener" title="Маршрут">🧭</a></div>`
    ).join('');
    d1.innerHTML=
      `<summary>${t}</summary>`+
      `<div class="body">${d}`+
      (rows?`<div style="margin-top:6px">${rows}</div>`:'')+
      `<div class="maplinks">`+
        `<a class="navpt" data-c="${center}" data-n="${encodeURIComponent(cityName)}" target="_blank" rel="noopener">📍 На карте</a>`+
        `<a href="https://www.google.com/search?tbm=isch&q=${encodeURIComponent(cityName+' Georgia')}" target="_blank" rel="noopener">📷 Фото</a>`+
      `</div></div>`;
    card.appendChild(d1);
  });
  box.appendChild(card);
  applyNav(); applyDist();
})();

function setNav(p){
  navProv=p; localStorage.setItem('nav_provider',p);
  document.querySelectorAll('#navSeg button').forEach(b=>b.classList.toggle('active',b.dataset.nav===p));
  applyNav();
}
document.querySelectorAll('#navSeg button').forEach(b=>b.addEventListener('click',()=>setNav(b.dataset.nav)));
setNav(navProv);

const geoBtn=document.getElementById('geoBtn'), geoHint=document.getElementById('geoHint');
const GEO_LABEL='📍 Показать расстояния от меня';
function getPos(opts){ return new Promise((res,rej)=>navigator.geolocation.getCurrentPosition(res,rej,opts)); }
geoBtn.addEventListener('click', async ()=>{
  if(!navigator.geolocation){ geoHint.textContent='Геолокация не поддерживается этим браузером.'; return; }
  geoBtn.disabled=true; geoBtn.textContent='⏳ определяю…'; geoHint.textContent='';
  try{
    let pos;
    try{
      // быстрая попытка: можно взять недавнюю позицию из кеша
      pos = await getPos({enableHighAccuracy:false, timeout:8000, maximumAge:600000});
    }catch(e1){
      if(e1.code===1) throw e1;                 // отказано — ретрай бессмысленен
      geoBtn.textContent='⏳ уточняю по GPS…';
      pos = await getPos({enableHighAccuracy:true, timeout:20000, maximumAge:0});
    }
    userPos=[pos.coords.latitude, pos.coords.longitude];
    geoBtn.disabled=false; geoBtn.textContent='📍 Обновить расстояния';
    geoHint.textContent='Считаю расстояния…';
    applyDist();
  }catch(err){
    geoBtn.disabled=false; geoBtn.textContent=GEO_LABEL;
    if(err.code===1)      geoHint.textContent='⚠️ Доступ к геолокации запрещён. Нажми на 🔒 слева от адреса → «Разрешения» → включи «Геоданные» и попробуй снова.';
    else if(err.code===2) geoHint.textContent='⚠️ Местоположение недоступно. Включи геолокацию (GPS) в шторке телефона и проверь, что она разрешена Chrome в настройках Android.';
    else if(err.code===3) geoHint.textContent='⏳ Не успел определить за отведённое время. Попробуй ещё раз — лучше у окна или на улице.';
    else                  geoHint.textContent='Не удалось определить местоположение: '+(err.message||('код '+err.code));
  }
});
