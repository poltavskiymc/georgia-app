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
