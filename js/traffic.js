/* Учёт интернет-трафика приложения (обмен с ИИ, курс, дорожные расстояния).
   addTraffic() вызывают chat.js, translate.js, money.js, route.js после каждого fetch.
   Показывается на вкладке «Ключ». Зависит от util.js (fmtTs, fmtBytes). */

const traffic = JSON.parse(localStorage.getItem('traffic')||'null') || {up:0, down:0, since:Date.now()};
function saveTraffic(){ localStorage.setItem('traffic', JSON.stringify(traffic)); }
function addTraffic(up,down){ traffic.up+=up; traffic.down+=down; saveTraffic(); renderTraffic(); }
function renderTraffic(){
  const el=document.getElementById('trafficBox'); if(!el) return;
  const total=traffic.up+traffic.down;
  el.innerHTML =
    `<div style="font-size:15px"><b>${fmtBytes(total)}</b> всего</div>`+
    `<div class="muted" style="margin-top:2px">↑ отправлено ${fmtBytes(traffic.up)} · ↓ получено ${fmtBytes(traffic.down)}</div>`+
    `<div class="muted" style="margin-top:6px; font-size:12px">Считаем с ${fmtTs(traffic.since)}. Учтён обмен с ИИ (чат и переводчик), запрос курса и дорожных расстояний — приблизительно, по телу запросов/ответов. Карты и фото открываются во внешних приложениях и сюда не входят.</div>`;
}
