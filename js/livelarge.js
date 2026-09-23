/* LiveLarge case study behavior. Content lives in livelarge.html; the page reads fully without JS.
   - Contents rail (list at >=1180px, sticky select below)
   - Scroll reveal (once; opacity/transform only)
   - Long recordings: muted viewport playback, pause offscreen, open larger in a shared <dialog>
   - Short loops (hero, state study, lab): muted, play only while in view, never with reduced motion
   - Audit rail: native touch scroll, mouse/pen drag, arrow keys */
(() => {
  'use strict';
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const behavior = () => (reducedMotion.matches ? 'instant' : 'smooth');

  /* ---------- Contents rail ---------- */
  const sections = [...document.querySelectorAll('[data-chapter]')];
  const list = document.getElementById('chapter-links');
  const select = document.getElementById('chapter-select');
  if (list && select && sections.length) {
    // Section order in the HTML is the source of truth for both controls.
    list.replaceChildren(...sections.map(section => {
      const li = document.createElement('li');
      const a = document.createElement('a');
      a.href = `#${section.id}`;
      a.textContent = section.dataset.chapter;
      li.append(a);
      return li;
    }));
    select.replaceChildren(...sections.map(section => new Option(section.dataset.chapter, section.id)));
    const links = [...list.querySelectorAll('a')];
    const byId = new Map(sections.map(section => [section.id, section]));
    let current = null, queued = false;
    const setActive = id => {
      if (current === id) return;
      current = id;
      links.forEach(link => link.hash === `#${id}` ? link.setAttribute('aria-current', 'location') : link.removeAttribute('aria-current'));
      if (id) select.value = id; else select.selectedIndex = 0;
    };
    const sync = () => {
      queued = false;
      const line = window.innerHeight * 0.35;
      let active = '';
      for (const section of sections) { if (section.getBoundingClientRect().top <= line) active = section.id; else break; }
      setActive(active);
    };
    const queue = () => { if (!queued) { queued = true; requestAnimationFrame(sync); } };
    const go = (id, push = true) => {
      const target = byId.get(id);
      if (!target) return;
      if (push && location.hash !== `#${id}`) history.pushState(null, '', `#${id}`);
      target.focus({ preventScroll: true });
      const far = Math.abs(target.getBoundingClientRect().top) > window.innerHeight * 2;
      target.scrollIntoView({ block: 'start', behavior: far ? 'instant' : behavior() });
      setActive(id);
    };
    list.addEventListener('click', event => {
      const link = event.target.closest('a');
      if (!link || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
      event.preventDefault();
      go(link.hash.slice(1));
    });
    select.addEventListener('change', () => go(select.value));
    window.addEventListener('scroll', queue, { passive: true });
    window.addEventListener('resize', queue, { passive: true });
    window.addEventListener('popstate', () => {
      const id = location.hash.slice(1);
      if (byId.has(id)) go(id, false);
      else { document.getElementById('top').scrollIntoView({ behavior: 'instant' }); queue(); }
    });
    if (byId.has(location.hash.slice(1))) requestAnimationFrame(() => go(location.hash.slice(1), false));
    else sync();
  }

  /* ---------- Scroll reveal ---------- */
  const reveals = [...document.querySelectorAll('.ll-reveal')];
  if (!('IntersectionObserver' in window) || reducedMotion.matches) {
    reveals.forEach(el => el.classList.add('is-in'));
  } else {
    const io = new IntersectionObserver(entries => entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add('is-in');
      io.unobserve(entry.target);
    }), { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
    reveals.forEach(el => io.observe(el));
  }

  /* ---------- Shared lightbox ---------- */
  const lightbox = document.querySelector('.ll-lightbox');
  const lightboxVideo = lightbox?.querySelector('video');
  const canDialog = lightbox && lightboxVideo && typeof lightbox.showModal === 'function';
  const openLarge = (video, at = 0, label = 'Recording') => {
    lightboxVideo.replaceChildren(...[...video.querySelectorAll('source')].map(s => s.cloneNode()));
    lightboxVideo.poster = video.poster;
    lightbox.style.setProperty('--ar', String(video.width / video.height));
    lightboxVideo.setAttribute('aria-label', label);
    lightboxVideo.preload = 'auto';
    lightboxVideo.load();
    lightbox.showModal();
    lightboxVideo.addEventListener('loadedmetadata', () => { lightboxVideo.currentTime = at; lightboxVideo.play().catch(() => {}); }, { once: true });
  };
  if (canDialog) {
    lightbox.querySelector('.ll-lightbox-close')?.addEventListener('click', () => lightbox.close());
    lightbox.addEventListener('click', event => { if (event.target === lightbox) lightbox.close(); });
    lightbox.addEventListener('close', () => lightboxVideo.pause());
  }

  /* Passive recordings: load near the reading area, play only while visible. */
  const media = [...document.querySelectorAll('[data-motion] video, .ll-loop-video')];
  const mediaVisible = new Map();
  const prepare = video => {
    if (video.dataset.prepared) return;
    video.dataset.prepared = 'true';
    video.querySelectorAll('source[data-src]').forEach(source => { source.src = source.dataset.src; });
    video.preload = 'metadata';
    video.load();
  };
  const syncMedia = video => {
    const allowed = mediaVisible.get(video) && !reducedMotion.matches && !document.hidden && !lightbox?.open;
    video.dataset.inView = String(!!mediaVisible.get(video));
    video.autoplay = !!allowed;
    if (allowed) { prepare(video); if (video.ended) video.currentTime = 0; video.play().catch(error => { video.dataset.playbackError = error.name; }); }
    else video.pause();
  };
  media.forEach(video => {
    video.controls = false;
    video.muted = true;
    video.playsInline = true;
    video.addEventListener('canplay', () => syncMedia(video));
    video.addEventListener('pause', () => { video.dataset.lastPause = document.visibilityState + '/' + video.dataset.inView; });
    const wrap = video.closest('[data-loop]');
    video.addEventListener('playing', () => wrap?.classList.add('is-playing'));
    const root = video.closest('[data-motion]');
    const controls = root?.querySelector('.ll-video-controls');
    const expand = root?.querySelector('.ll-expand');
    if (controls) controls.hidden = false;
    if (expand && canDialog) expand.addEventListener('click', () => {
      prepare(video);
      const at = video.currentTime;
      media.forEach(item => item.pause());
      openLarge(video, at, root.querySelector('figcaption')?.textContent.trim() || 'Recording');
    });
    else if (expand) expand.hidden = true;
  });
  if ('IntersectionObserver' in window) {
    const warm = new IntersectionObserver(entries => entries.forEach(entry => {
      if (entry.isIntersecting && !reducedMotion.matches) { prepare(entry.target); warm.unobserve(entry.target); }
    }), {rootMargin:'240px 0px',threshold:0});
    const playing = new IntersectionObserver(entries => entries.forEach(entry => {
      const video = entry.target.matches('video') ? entry.target : entry.target.querySelector('video');
      mediaVisible.set(video, entry.isIntersecting && entry.intersectionRatio >= .35);
      syncMedia(video);
    }), {threshold:[0,.15,.35,.6]});
    media.forEach(video => {warm.observe(video);playing.observe(video.closest('.ll-scroll-evidence') || video);});
  }
  document.addEventListener('visibilitychange', () => media.forEach(syncMedia));
  reducedMotion.addEventListener?.('change', () => media.forEach(syncMedia));
  lightbox?.addEventListener('close', () => media.forEach(syncMedia));

  const focuses = [...document.querySelectorAll('.ll-focus-motion')];
  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver(entries => entries.forEach(entry => {
      entry.target.classList.toggle('is-running', entry.isIntersecting && entry.intersectionRatio >= .45 && !reducedMotion.matches);
    }),{threshold:[0,.45]});
    focuses.forEach(el => observer.observe(el));
  }

  /* Portfolio motion: passive playback; offscreen and reduced-motion support. */
  const artStudies = [...document.querySelectorAll('[data-art-motion]')];
  const artVisible = new WeakMap();
  const syncArt = root => root.classList.toggle('is-running', !!artVisible.get(root) && !reducedMotion.matches);
  artStudies.forEach(root => root.classList.add('ll-art-animate'));
  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver(entries => entries.forEach(entry => {
      artVisible.set(entry.target, entry.isIntersecting); syncArt(entry.target);
    }), {threshold:0.25});
    artStudies.forEach(root => observer.observe(root));
  }
  reducedMotion.addEventListener('change', () => artStudies.forEach(syncArt));

  // Critically damped horizontal unfold. The first view never moves or scales.
  // Observe the actual cards, not the padded stage; only start after a reading dwell.
  const spreads = [...document.querySelectorAll('[data-card-spread]')];
  const spreadState = new WeakMap();
  const quietSpread = () => reducedMotion.matches || window.innerWidth <= 1000;
  const springPosition = t => (1 - (1 + 9*t)*Math.exp(-9*t)) / (1 - 10*Math.exp(-9));
  const prepareSpread = root => {
    const previous = spreadState.get(root);
    if (previous) {
      clearTimeout(previous.timer);
      previous.animations.forEach(a => a.cancel());
    }
    const grid = root.querySelector('.ll-card-spread');
    const state = {grid, animations:[], started:previous?.started || false, done:previous?.started || false, visible:false, timer:null};
    spreadState.set(root,state);
    if (quietSpread() || state.done || !('IntersectionObserver' in window)) return;
    const views = [...grid.children];
    const first = views[0].getBoundingClientRect();
    state.animations = views.slice(1).map((view,index) => {
      const dx = first.left - view.getBoundingClientRect().left;
      const frames = Array.from({length:61},(_,i) => {
        const t=i/60, p=springPosition(t);
        return {offset:t,transform:`translateX(${dx*(1-p)}px)`,opacity:Math.min(1,t*7)};
      });
      const animation = view.animate(frames,{duration:760,delay:index*150,fill:'both',easing:'linear'});
      animation.pause();
      return animation;
    });
  };
  const visibleForReading = grid => {
    const box=grid.getBoundingClientRect();
    const top=90, bottom=window.innerHeight*.9;
    const visible=Math.max(0,Math.min(box.bottom,bottom)-Math.max(box.top,top));
    return visible >= Math.min(box.height*.65,(bottom-top)*.75);
  };
  const syncSpread = root => {
    const state=spreadState.get(root);
    if (!state || quietSpread() || state.done || !state.animations.length) return;
    state.visible=visibleForReading(state.grid);
    if (!state.visible) {
      clearTimeout(state.timer); state.timer=null;
      state.animations.forEach(a=>{if(a.playState==='running') a.pause();});
      return;
    }
    if (state.started) {state.animations.forEach(a=>{if(a.playState==='paused') a.play();});return;}
    if (state.timer) return;
    state.timer=setTimeout(()=>{
      state.timer=null;
      if (!visibleForReading(state.grid) || quietSpread()) return;
      state.started=true;
      root.dataset.spreadState='playing';
      state.animations.forEach(a=>a.play());
      Promise.all(state.animations.map(a=>a.finished)).then(()=>{
        state.done=true;root.dataset.spreadState='complete';
      }).catch(()=>{});
    },240);
  };
  spreads.forEach(root=>{
    Promise.all([...root.querySelectorAll('img')].map(img=>img.decode().catch(()=>{}))).then(()=>{
      prepareSpread(root);syncSpread(root);
    });
  });
  let spreadQueued=false;
  window.addEventListener('scroll',()=>{
    if(spreadQueued)return;
    spreadQueued=true;
    requestAnimationFrame(()=>{spreadQueued=false;spreads.forEach(syncSpread);});
  },{passive:true});
  const resetSpreads=()=>spreads.forEach(root=>{prepareSpread(root);syncSpread(root);});
  window.addEventListener('resize',resetSpreads,{passive:true});
  reducedMotion.addEventListener('change',resetSpreads);


  /* ---------- Audit rail: touch scroll, mouse/pen drag, keyboard ---------- */
  document.querySelectorAll('[data-rail]').forEach(root => {
    const track = root.querySelector('.ll-rail-track');
    if (!track) return;
    const step = () => (track.querySelector('.ll-card')?.getBoundingClientRect().width || track.clientWidth) + (parseFloat(getComputedStyle(track).gap) || 0);
    let drag = null;
    track.addEventListener('dragstart', event => event.preventDefault());
    track.addEventListener('pointerdown', event => {
      if (event.pointerType === 'touch' || event.button !== 0) return;
      drag = { id: event.pointerId, x: event.clientX, left: track.scrollLeft, moved: false };
      track.classList.add('is-dragging');
      track.setPointerCapture(event.pointerId);
    });
    track.addEventListener('pointermove', event => {
      if (!drag || drag.id !== event.pointerId) return;
      const delta = event.clientX - drag.x;
      if (Math.abs(delta) > 4) drag.moved = true;
      if (drag.moved) { event.preventDefault(); track.scrollLeft = drag.left - delta; }
    });
    const finish = event => {
      if (!drag || drag.id !== event.pointerId) return;
      drag = null;
      if (track.hasPointerCapture(event.pointerId)) track.releasePointerCapture(event.pointerId);
      track.classList.remove('is-dragging');
    };
    ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(type => track.addEventListener(type, finish));
    track.addEventListener('keydown', event => {
      if (!['ArrowRight', 'ArrowLeft', 'Home', 'End'].includes(event.key)) return;
      event.preventDefault();
      const left = event.key === 'Home' ? 0 : event.key === 'End' ? track.scrollWidth : track.scrollLeft + (event.key === 'ArrowRight' ? 1 : -1) * step();
      track.scrollTo({ left, behavior: behavior() });
    });
  });
})();
