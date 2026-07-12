/* ВРЕМЕННО: печатает реальные размеры вьюпорта и положение навбара на устройстве.
   Нужно, чтобы понять, почему на iOS навбар «висит» над safe-area на коротких страницах.
   Удалить вместе с #diag в index.html и стилями после починки. */
(function(){
  const box=document.getElementById('diag'); if(!box) return;
  // реальное значение env(safe-area-inset-bottom): меряем пробным элементом
  const probe=document.createElement('div');
  probe.style.cssText='position:fixed;bottom:0;left:0;width:0;height:env(safe-area-inset-bottom);visibility:hidden';
  document.body.appendChild(probe);
  function dump(){
    const nav=document.querySelector('nav'), r=nav.getBoundingClientRect();
    const vv=window.visualViewport;
    box.textContent=[
      'innerH '+window.innerHeight+'  screenH '+window.screen.height+'  vvH '+(vv?Math.round(vv.height):'—'),
      'safe-bottom '+probe.offsetHeight+'  navH '+Math.round(r.height),
      'nav.bottom '+Math.round(r.bottom)+'  зазор '+Math.round(window.innerHeight-r.bottom),
      'docH '+document.documentElement.scrollHeight+'  standalone '+(navigator.standalone||matchMedia('(display-mode:standalone)').matches)
    ].join('\n');
  }
  dump();
  window.addEventListener('resize',dump);
  window.addEventListener('scroll',dump);
  document.querySelectorAll('nav button').forEach(b=>b.addEventListener('click',()=>setTimeout(dump,60)));
})();
