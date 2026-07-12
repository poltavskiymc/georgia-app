/* Вкладка «Ключ»: ключ и модель DeepSeek, сброс счётчика трафика, номер версии.
   Загружается ПОСЛЕДНИМ: использует refreshKeyHint/renderChat/history из chat.js,
   renderTraffic/traffic из traffic.js, show из nav.js. */

const APP_VERSION = '2026-07-12 · сборка 23';

const apiKeyEl=document.getElementById('apiKey'), modelEl=document.getElementById('model');
apiKeyEl.value = localStorage.getItem('ds_key')||'';
modelEl.value = localStorage.getItem('ds_model')||'deepseek-chat';
document.getElementById('saveKey').addEventListener('click',()=>{
  localStorage.setItem('ds_key', apiKeyEl.value.trim());
  localStorage.setItem('ds_model', modelEl.value.trim()||'deepseek-chat');
  refreshKeyHint(); alert('Сохранено ✅'); show('chat');
});
// чистит только активный чат; остальные живут в списке 🗂 на вкладке «Чат»
document.getElementById('clearChat').addEventListener('click',()=>{ clearCurrentChat(); alert('Текущий чат очищен'); show('chat'); });

document.getElementById('resetTraffic').addEventListener('click',()=>{ traffic.up=0; traffic.down=0; traffic.since=Date.now(); saveTraffic(); renderTraffic(); });
renderTraffic();

/* Принудительное обновление: сносим оффлайн-кэш и просим SW проверить новый sw.js.
   Ключ, история чата и избранное лежат в localStorage и это переживают. */
const updBtn=document.getElementById('updateApp'), updHint=document.getElementById('updHint');
updBtn.addEventListener('click', async ()=>{
  if(!navigator.onLine){ updHint.textContent='⚠️ Нет интернета — обновиться не выйдет, но оффлайн всё работает как прежде.'; return; }
  updBtn.disabled=true; updBtn.textContent='⏳ обновляю…'; updHint.textContent='';
  try{
    if('serviceWorker' in navigator){
      const reg=await navigator.serviceWorker.getRegistration();
      if(reg) await reg.update();                        // подтянуть новый sw.js, если он вышел
    }
    if(window.caches){
      const keys=await caches.keys();
      await Promise.all(keys.map(k=>caches.delete(k)));  // без кэша файлы возьмутся из сети
    }
  }catch(_){ /* не вышло — всё равно перезагружаемся, хуже не будет */ }
  location.reload();
});

document.getElementById('verLine').textContent='версия '+APP_VERSION;
