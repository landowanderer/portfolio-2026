(() => {
  const rail=document.querySelector('.fb-rail');
  if(!rail)return;
  const sections=[...document.querySelectorAll('.fb-chapter')],links=[...rail.querySelectorAll('a')],select=rail.querySelector('select');
  let queued=false,current=null,jumping=null,jumpTimer=0;
  function update(){
    queued=false;if(jumping)return;
    // Same rule as LiveLarge: current at 40% of the window, with a small band against flicker at a boundary.
    const line=Math.max(innerHeight*.4,innerWidth<1180?175:160),band=innerHeight*.03;
    let active=sections[0];for(const s of sections){if(s.getBoundingClientRect().top<=line+(s===current?band:-band))active=s;}
    if(innerHeight+scrollY>=document.documentElement.scrollHeight-20)active=sections.at(-1);
    links.forEach(a=>{if(a.hash===`#${active.id}`)a.setAttribute('aria-current','location');else a.removeAttribute('aria-current');});select.value=active.id;current=active;
  }
  function endJump(){if(!jumping)return;jumping=null;clearTimeout(jumpTimer);update();}
  addEventListener('scrollend',endJump);['wheel','touchstart','keydown'].forEach(t=>addEventListener(t,endJump,{passive:true}));
  function jump(id){const target=document.getElementById(id);history.replaceState(null,'',`#${id}`);jumping=id;clearTimeout(jumpTimer);jumpTimer=setTimeout(endJump,1200);links.forEach(a=>{if(a.hash===`#${id}`)a.setAttribute('aria-current','location');else a.removeAttribute('aria-current');});select.value=id;current=target;target.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});target.focus({preventScroll:true});}
  links.forEach(a=>a.addEventListener('click',e=>{if(e.ctrlKey||e.metaKey||e.shiftKey||e.altKey)return;e.preventDefault();jump(a.hash.slice(1));}));
  select.addEventListener('change',()=>jump(select.value));
  addEventListener('scroll',()=>{if(!queued){queued=true;requestAnimationFrame(update)}},{passive:true});addEventListener('resize',update);update();
  if(matchMedia('(prefers-reduced-motion: reduce)').matches){document.querySelectorAll('.fb-video').forEach(v=>{v.classList.add('vimeo-scroll-player');const el=v.querySelector('[data-vimeo-src]');const url=new URL(el.dataset.vimeoSrc);url.searchParams.set('background','0');url.searchParams.set('autoplay','0');el.dataset.vimeoSrc=url.href;});}
  // Research boards are shown at reading size only; they no longer open an enlarged viewer.
})();
