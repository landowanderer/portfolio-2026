/* LiveLarge case study — revision pass.
   1. Journey figure: plays once when it scrolls into view (needs fade on the Before row, the band draws on the After row).
   2. Recorded prototype clips: load near view, keep the chat window's width in step with the recording frame by frame.
   3. 03 · Clarify and recommend: the pinned stage plays each step's segment and holds; "what the assistant knows"
      follows the recording's own timeline.
   4. Highlights: loop while visible; captions light in time with the recording.
   5. "Watch the full flow" opens the 26 s recording in the page's lightbox.
   6. 5.1 effects: the dividing line sweeps between the base greeting and the AI-light greeting by itself. */
(() => {
  'use strict';
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const hasIO = 'IntersectionObserver' in window;

  /* ---------- 1. journey ---------- */
  const journey = document.querySelector('.ll-journey-change');
  if (journey) {
    if (reduce || !hasIO) journey.classList.add('is-playing');
    else {
      const io = new IntersectionObserver(es => {
        if (es.some(e => e.isIntersecting)) { journey.classList.add('is-playing'); io.disconnect(); }
      }, { threshold: .45 });
      io.observe(journey);
    }
  }

  /* ---------- 2. recorded clips ---------- */
  const prepare = video => {
    if (video.dataset.ready) return;
    video.dataset.ready = '1';
    video.querySelectorAll('source[data-src]').forEach(s => { s.src = s.dataset.src; });
    video.preload = 'auto';
    video.load();
  };
  const whenReady = video => new Promise(res => {
    prepare(video);
    if (video.readyState >= 2) res(); else video.addEventListener('loadeddata', res, { once: true });
  });
  // run fn on every presented frame while the video plays (and once after seeks)
  const onFrames = (video, fn) => {
    if ('requestVideoFrameCallback' in HTMLVideoElement.prototype) {
      const step = (now, meta) => { fn(meta.mediaTime); video.requestVideoFrameCallback(step); };
      video.requestVideoFrameCallback(step);
    } else {
      const step = () => { if (!video.paused) fn(video.currentTime); requestAnimationFrame(step); };
      requestAnimationFrame(step);
    }
    video.addEventListener('seeked', () => fn(video.currentTime));
  };

  const clips = new Map();
  function clip(el) {
    if (clips.has(el)) return clips.get(el);
    const video = el.querySelector('video');
    const track = JSON.parse(el.dataset.track || '[[0,598]]');
    // chat width (CSS px) at time t: linear between the 16 ms samples of a width change, stepped otherwise
    const widthAt = t => {
      let i = 0;
      while (i + 1 < track.length && track[i + 1][0] <= t) i++;
      const [t0, w0] = track[i], next = track[i + 1];
      if (next && next[0] - t0 < .12) return w0 + (next[1] - w0) * ((t - t0) / (next[0] - t0));
      return w0;
    };
    const maxIn = (a, b) => Math.max(...track.filter(([t]) => t >= a && t <= b).map(p => p[1]), widthAt(a));
    const c = {
      el, video, widthAt, maxIn, listeners: [],
      setWidth(t) { el.style.setProperty('--w', widthAt(t).toFixed(2)); },
      fit(s) { el.style.setProperty('--s', s.toFixed(4)); },
      onTime(fn) { c.listeners.push(fn); },
    };
    onFrames(video, t => { c.setWidth(t); c.listeners.forEach(fn => fn(t)); });
    c.setWidth(0);
    clips.set(el, c);
    return c;
  }

  // play [a,b] once and hold on b; resolves when held. A newer request cancels an older one.
  function playSegment(c, a, b) {
    const v = c.video;
    const token = (c.token = (c.token || 0) + 1);
    return whenReady(v).then(() => {
      if (token !== c.token) return;
      v.pause();
      if (reduce || b - a < .05) { v.currentTime = Math.max(0, b - .04); return; }
      v.currentTime = a;
      const stop = t => { if (token === c.token && t >= b - .04) { v.pause(); v.currentTime = b - .04; } };
      c.listeners = c.listeners.filter(fn => !fn.segmentStop);
      stop.segmentStop = true;
      c.onTime(stop);
      v.play().catch(() => {});
    });
  }

  /* ---------- 3. 03 · Clarify and recommend ---------- */
  const clarify = document.querySelector('[data-clarify]');
  if (clarify) {
    const stageEl = clarify.querySelector('.ll-clarify-stage');
    const stage = clip(stageEl.querySelector('.ll-chatclip'));
    const steps = [...clarify.querySelectorAll('.ll-clarify-step')];
    const segs = steps.map(li => li.dataset.seg.split(',').map(Number));
    const knows = stageEl.querySelector('.ll-knows');
    const row = k => knows.querySelector(`[data-k="${k}"]`);
    const count = knows.querySelector('[data-k="count"]');
    const delta = knows.querySelector('.ll-shortlist-note');
    const models = [...knows.querySelectorAll('.ll-shortlist li')];
    let active = -1;

    // the logic layer follows the recording's own timeline (clip seconds, from the capture log)
    const T = { goal: 2.27, askPriority: 3.47, priority: 5.87, askBeds: 7.07, beds: 9.44, shortlist: 11.24 };
    const setRow = (k, state, text) => {
      const r = row(k), dd = r.querySelector('dd');
      if (r.dataset.state === state && dd.textContent === text) return;
      const changed = r.dataset.state && r.dataset.state !== state;
      r.dataset.state = state; dd.textContent = text;
      if (changed) { r.classList.remove('is-new'); void r.offsetWidth; r.classList.add('is-new'); }
    };
    const render = t => {
      setRow('goal', t >= T.goal ? 'set' : 'empty', t >= T.goal ? 'Rental income' : 'Not specified');
      setRow('priority', t >= T.priority ? 'set' : t >= T.askPriority ? 'asking' : 'empty', t >= T.priority ? 'Lower upfront cost' : t >= T.askPriority ? 'Asking' : 'Not specified');
      setRow('beds', t >= T.beds ? 'set' : t >= T.askBeds ? 'asking' : 'empty', t >= T.beds ? 'Two bedrooms' : t >= T.askBeds ? 'Asking' : 'Not specified');
      const narrowed = t >= T.shortlist;
      models.forEach(li => { li.classList.toggle('is-out', narrowed && li.dataset.beds !== '2'); li.classList.toggle('is-hot', narrowed && li.dataset.beds === '2'); });
      count.textContent = narrowed ? '2 models' : '4 models';
      delta.hidden = !narrowed;
      row('open').hidden = active !== steps.length - 1;
    };
    stage.onTime(render);
    render(0);

    const fitStage = () => {
      const header = document.querySelector('.pf-header, .ll-header, header');
      const top = (header && getComputedStyle(header).position !== 'static' ? header.getBoundingClientRect().height : 0) + 20;
      clarify.style.setProperty('--ll-sticky-top', top + 'px');
      const inner = stageEl.clientWidth - 40;
      const room = innerHeight - top - 24 - 40 - knows.offsetHeight - 16;
      stage.fit(Math.max(.5, Math.min(.9, inner / 598, room / 742)));
    };

    const activate = i => {
      if (i === active) return;
      active = i;
      steps.forEach((li, k) => li.classList.toggle('is-active', k === i));
      clarify.classList.toggle('is-limit', i === steps.length - 1);
      render(stage.video.currentTime);
      if (getComputedStyle(stageEl).display !== 'none') playSegment(stage, ...segs[i]);
    };

    // phones: each step carries its own clip (the same file, its own segment)
    const inline = steps.map(li => clip(li.querySelector('.ll-chatclip.is-inline')));
    const fitInline = () => inline.forEach((c, i) => {
      const w = c.el.clientWidth - 32;
      if (w > 0) c.fit(Math.min(1, w / c.maxIn(...segs[i]), innerHeight * .7 / 742));
    });

    if (hasIO) {
      const pick = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) activate(steps.indexOf(e.target)); }), { rootMargin: '-45% 0px -45% 0px' });
      steps.forEach(li => pick.observe(li));
      const near = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { prepare(stage.video); near.disconnect(); } }), { rootMargin: '600px 0px' });
      near.observe(clarify);
      const seen = new IntersectionObserver(es => es.forEach(e => {
        const i = steps.indexOf(e.target.closest('.ll-clarify-step'));
        if (e.isIntersecting && getComputedStyle(e.target).display !== 'none') playSegment(inline[i], ...segs[i]);
      }), { threshold: .6 });
      inline.forEach(c => seen.observe(c.el));
    } else activate(0);
    steps.forEach((li, i) => li.addEventListener('click', () => {
      if (getComputedStyle(stageEl).display === 'none') return;
      activate(i);
      li.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'center' });
    }));
    const fitAll = () => { fitStage(); fitInline(); };
    fitAll();
    addEventListener('resize', fitAll);
    document.fonts?.ready.then(fitAll);
  }

  /* ---------- 4. Highlights ---------- */
  document.querySelectorAll('[data-hl]').forEach(fig => {
    const video = fig.querySelector('video');
    const cues = fig.dataset.cues.split(',').map(Number);
    const lis = [...fig.querySelectorAll('.ll-hl-steps li')];
    const chatEl = fig.querySelector('.ll-chatclip');
    const c = chatEl ? clip(chatEl) : null;
    const light = t => { let k = 0; cues.forEach((q, i) => { if (t >= q) k = i; }); lis.forEach((li, i) => li.classList.toggle('is-on', i === k)); };
    if (c) {
      const fit = () => { const box = chatEl.parentElement; const w = box.clientWidth - 2 * parseFloat(getComputedStyle(box).paddingLeft || 0); c.fit(Math.max(.45, Math.min(.84, w / 598, 620 / 742))); };
      fit(); addEventListener('resize', fit);
      c.onTime(light);
      // the poster is the finished state: show it at its own width until playback starts
      c.el.style.setProperty('--w', c.widthAt(1e9).toFixed(2));
    } else onFrames(video, light);
    if (reduce) { lis.forEach(li => li.classList.add('is-on')); return; }
    if (!hasIO) return;
    new IntersectionObserver(es => es.forEach(e => {
      if (e.isIntersecting) whenReady(video).then(() => { if (c) c.setWidth(video.currentTime); video.play().catch(() => {}); });
      else video.pause();
    }), { threshold: .4 }).observe(fig);
  });

  /* ---------- 5. full flow in the page's lightbox ---------- */
  const fullBtn = document.querySelector('[data-full-flow]');
  const lightbox = document.querySelector('.ll-lightbox');
  if (fullBtn && lightbox && typeof lightbox.showModal === 'function') {
    fullBtn.addEventListener('click', () => {
      const lv = lightbox.querySelector('video');
      const source = document.createElement('source');
      source.src = fullBtn.dataset.fullFlow; source.type = 'video/mp4';
      lv.replaceChildren(source);
      lv.poster = fullBtn.dataset.poster;
      lightbox.style.setProperty('--ar', fullBtn.dataset.ratio);
      lv.setAttribute('aria-label', 'Recording: the full rental flow, 26 seconds');
      lv.preload = 'auto';
      lv.load();
      lightbox.showModal();
      lv.addEventListener('loadedmetadata', () => { lv.currentTime = 0; if (!reduce) lv.play().catch(() => {}); }, { once: true });
    });
  } else if (fullBtn) fullBtn.parentElement.hidden = true;

  /* ---------- 6. 5.1 effects wipe: the line travels across the panel only (data-lo / data-hi, % of the frame) ---------- */
  const frame = document.querySelector('[data-wipe]');
  if (!frame || reduce) return;
  const wipe = frame;
  const LO = parseFloat(frame.dataset.lo) || 0, HI = parseFloat(frame.dataset.hi) || 100;
  const HOLD = 1.6, MOVE = 2.6, CYCLE = 2 * (HOLD + MOVE);
  const ease = x => x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
  let visible = false, t = 0, last = null;
  new IntersectionObserver(es => { visible = es[0].isIntersecting; last = null; }, { threshold: .2 }).observe(frame);
  function tick(now) {
    if (visible) {
      if (last !== null) t = (t + Math.min(now - last, 100) / 1000) % CYCLE;
      last = now;
      let p; /* 0 = all base, 1 = all AI light */
      if (t < HOLD) p = 0;
      else if (t < HOLD + MOVE) p = ease((t - HOLD) / MOVE);
      else if (t < 2 * HOLD + MOVE) p = 1;
      else p = 1 - ease((t - 2 * HOLD - MOVE) / MOVE);
      frame.style.setProperty('--cut', (HI - (HI - LO) * p) + '%');
      wipe.dataset.moving = p > 0 && p < 1 ? '1' : '0';
    }
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
})();
