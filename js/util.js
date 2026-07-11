/* Общие утилиты, используются несколькими модулями.
   Подключается ПЕРВЫМ после data.js, до остальных скриптов. */

// экранирование html (чат, переводчик)
function esc(s){ return s.replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c])); }

// размер строки в байтах (учёт трафика)
function byteLen(s){ return new Blob([s||'']).size; }
function fmtBytes(b){ if(b<1024) return b+' Б'; if(b<1048576) return (b/1024).toFixed(1)+' КБ'; return (b/1048576).toFixed(2)+' МБ'; }

// форматирование времени (курс, трафик)
function fmtTs(ts){
  if(!ts) return '';
  const d=new Date(ts), p=n=>String(n).padStart(2,'0');
  return `${p(d.getDate())}.${p(d.getMonth()+1)} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

// расстояние по прямой между [lat,lng] в км (фолбэк для маршрута)
function haversine(a,b){
  const R=6371, toR=x=>x*Math.PI/180;
  const dLat=toR(b[0]-a[0]), dLon=toR(b[1]-a[1]);
  const s=Math.sin(dLat/2)**2 + Math.cos(toR(a[0]))*Math.cos(toR(b[0]))*Math.sin(dLon/2)**2;
  return 2*R*Math.asin(Math.sqrt(s));
}
function fmtDist(km){ if(km<1) return Math.round(km*1000)+' м'; if(km<10) return km.toFixed(1)+' км'; return Math.round(km)+' км'; }

// озвучка (разговорник, переводчик). lang: 'ka-GE' | 'en-US' | ...
const canSpeak = 'speechSynthesis' in window;
function speak(text, lang='ka-GE'){
  if(!canSpeak) return;
  const u = new SpeechSynthesisUtterance(text);
  u.lang=lang; u.rate=.85;
  speechSynthesis.cancel(); speechSynthesis.speak(u);
}
