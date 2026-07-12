/* Нижняя навигация: переключение вкладок (view). show() используют и другие модули
   (чат, переводчик, настройки — например переход на «Ключ» при отсутствии ключа).
   Вкладки «Язык» и «Гид» — сдвоенные: внутри переключатель .tabs между .subview
   (Перевод/Фразы и Места/Еда). Выбранная под-вкладка запоминается в localStorage. */

const views = document.querySelectorAll('.view');
const navBtns = document.querySelectorAll('nav button');
function show(v){
  views.forEach(s=>s.classList.toggle('active', s.id==='v-'+v));
  navBtns.forEach(b=>b.classList.toggle('active', b.dataset.v===v));
  document.getElementById('chatbar').style.display = (v==='chat') ? 'block':'none';
  window.scrollTo(0,0);
}
navBtns.forEach(b=>b.addEventListener('click',()=>show(b.dataset.v)));

// переключатели внутри сдвоенных вкладок
document.querySelectorAll('.tabs').forEach(tabs=>{
  const group=tabs.dataset.sub;
  const btns=[...tabs.querySelectorAll('button')];
  const showSub=s=>{
    btns.forEach(b=>b.classList.toggle('active', b.dataset.s===s));
    btns.forEach(b=>{
      const el=document.getElementById('s-'+b.dataset.s);
      if(el) el.classList.toggle('active', b.dataset.s===s);
    });
    localStorage.setItem('sub_'+group, s);
    window.scrollTo(0,0);
  };
  btns.forEach(b=>b.addEventListener('click',()=>showSub(b.dataset.s)));
  const saved=localStorage.getItem('sub_'+group);
  showSub(btns.some(b=>b.dataset.s===saved) ? saved : btns[0].dataset.s);
});

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
