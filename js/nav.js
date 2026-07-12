/* Нижняя навигация: переключение вкладок (view). show() используют и другие модули
   (чат, переводчик, настройки — например переход на «Ключ» при отсутствии ключа). */

const views = document.querySelectorAll('.view');
const navBtns = document.querySelectorAll('nav button');
function show(v){
  views.forEach(s=>s.classList.toggle('active', s.id==='v-'+v));
  navBtns.forEach(b=>b.classList.toggle('active', b.dataset.v===v));
  document.getElementById('chatbar').style.display = (v==='chat') ? 'block':'none';
  window.scrollTo(0,0);
}
navBtns.forEach(b=>b.addEventListener('click',()=>show(b.dataset.v)));

/* Реальная высота навбара (кнопки + safe-area) — в CSS как --nav-h.
   К ней прижимается плашка ввода чата: с захардкоженным отступом между ними
   оставалась щель, и в неё просвечивал проскролленный текст. */
const navEl=document.querySelector('nav');
function syncNavHeight(){ document.documentElement.style.setProperty('--nav-h', navEl.offsetHeight+'px'); }
if(window.ResizeObserver) new ResizeObserver(syncNavHeight).observe(navEl);
window.addEventListener('resize',syncNavHeight);
syncNavHeight();
// настройки открываются шестерёнкой в шапке (не вкладкой)
document.getElementById('settingsBtn').addEventListener('click',()=>show('settings'));
