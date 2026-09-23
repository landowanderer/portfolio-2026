(() => {
  const rail=document.querySelector('.fb-rail');
  if(!rail)return;
  const sections=[...document.querySelectorAll('.fb-chapter')],links=[...rail.querySelectorAll('a')],select=rail.querySelector('select');
  let queued=false;
  function update(){
    queued=false;const line=innerWidth<1180?175:160;
    let active=sections[0];for(const s of sections){if(s.getBoundingClientRect().top<=line)active=s;}
    if(innerHeight+scrollY>=document.documentElement.scrollHeight-20)active=sections.at(-1);
    links.forEach(a=>{if(a.hash===`#${active.id}`)a.setAttribute('aria-current','location');else a.removeAttribute('aria-current');});select.value=active.id;
  }
  function jump(id){const target=document.getElementById(id);history.replaceState(null,'',`#${id}`);target.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});target.focus({preventScroll:true});}
  links.forEach(a=>a.addEventListener('click',e=>{if(e.ctrlKey||e.metaKey||e.shiftKey||e.altKey)return;e.preventDefault();jump(a.hash.slice(1));}));
  select.addEventListener('change',()=>jump(select.value));
  addEventListener('scroll',()=>{if(!queued){queued=true;requestAnimationFrame(update)}},{passive:true});addEventListener('resize',update);update();
  if(matchMedia('(prefers-reduced-motion: reduce)').matches){document.querySelectorAll('.fb-video').forEach(v=>{v.classList.add('vimeo-scroll-player');const el=v.querySelector('[data-vimeo-src]');const url=new URL(el.dataset.vimeoSrc);url.searchParams.set('background','0');url.searchParams.set('autoplay','0');el.dataset.vimeoSrc=url.href;});}
  // Research boards are shown at reading size only; they no longer open an enlarged viewer.
})();
