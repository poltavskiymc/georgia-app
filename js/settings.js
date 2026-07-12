/* Вкладка «Ключ»: ключ и модель DeepSeek, сброс счётчика трафика, номер версии.
   Загружается ПОСЛЕДНИМ: использует refreshKeyHint/renderChat/history из chat.js,
   renderTraffic/traffic из traffic.js, show из nav.js. */

const APP_VERSION = '2026-07-12 · сборка 10';

const apiKeyEl=document.getElementById('apiKey'), modelEl=document.getElementById('model');
apiKeyEl.value = localStorage.getItem('ds_key')||'';
modelEl.value = localStorage.getItem('ds_model')||'deepseek-chat';
document.getElementById('saveKey').addEventListener('click',()=>{
  localStorage.setItem('ds_key', apiKeyEl.value.trim());
  localStorage.setItem('ds_model', modelEl.value.trim()||'deepseek-chat');
  refreshKeyHint(); alert('Сохранено ✅'); show('chat');
});
document.getElementById('clearChat').addEventListener('click',()=>{ history.length=0; localStorage.removeItem('ds_hist'); renderChat(); alert('Чат очищен'); });

document.getElementById('resetTraffic').addEventListener('click',()=>{ traffic.up=0; traffic.down=0; traffic.since=Date.now(); saveTraffic(); renderTraffic(); });
renderTraffic();

document.getElementById('verLine').textContent='версия '+APP_VERSION;
