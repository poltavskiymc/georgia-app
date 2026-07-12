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

/* Озвучка (разговорник, переводчик). lang: 'ka-GE' | 'en-US' | ...
   Грузинского голоса в iOS нет вообще (Apple его не поставляет), и запрос ka-GE
   там просто молчит. Поэтому: голос под язык ищем явно, а если грузинского в системе
   нет — читаем русскую транскрипцию (fallback) русским голосом. Звучит близко. */
const canSpeak = 'speechSynthesis' in window && typeof speechSynthesis.getVoices === 'function';
let voices = [];
function loadVoices(){ try{ voices = speechSynthesis.getVoices()||[]; }catch(_){ voices=[]; } }
if(canSpeak){
  loadVoices();
  speechSynthesis.onvoiceschanged = loadVoices;  // Safari/Chrome отдают список асинхронно
}
// голос по коду языка ('ka-GE' → любой голос с lang ka*)
function voiceFor(lang){
  if(!voices.length) loadVoices();
  const p = lang.slice(0,2).toLowerCase();
  return voices.find(v => (v.lang||'').toLowerCase().replace('_','-').startsWith(p)) || null;
}
function speak(text, lang='ka-GE', fallbackText){
  if(!canSpeak || !text) return;
  let v = voiceFor(lang);
  if(!v && fallbackText && voiceFor('ru')){ text=fallbackText; lang='ru-RU'; v=voiceFor('ru'); }
  const u = new SpeechSynthesisUtterance(text);
  u.lang = v ? v.lang : lang; u.rate=.85;
  if(v) u.voice=v;                                // без явного голоса iOS часто молчит
  speechSynthesis.cancel(); speechSynthesis.speak(u);
}
