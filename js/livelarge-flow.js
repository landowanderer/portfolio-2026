/* LiveLarge user flow: an autoplay camera tour over the full flow diagram.

   Motion references
   - Camera path: van Wijk & Nuij, "Smooth and efficient zooming and panning" (rho = sqrt 2, the same
     interpolation as d3.interpolateZoom). Long jumps lift the camera and settle back down, so the
     viewer keeps their place in the diagram.
   - Camera easing: Material 3 "standard" cubic-bezier(.2, 0, 0, 1): a short push, a long settle.
     The slow pan across the last row uses a symmetric sine ease so it reads as one steady move.
   - Captions: enter with M3 "emphasized decelerate" over 400 ms, leave with "emphasized accelerate"
     over 200 ms (leaving is faster than arriving). Dwell time follows a reading speed of 20 characters
     per second, the limit Netflix sets for adult subtitles.
   - Duration grows with the size of the move (proportional to the van Wijk path length) and stays
     between 1.3 s and 2.4 s. It never plays under prefers-reduced-motion, and it pauses off screen. */
(() => {
  const root = document.querySelector('[data-flow-tour]');
  if (!root) return;

  const stage = root.querySelector('.ll-flow-stage');
  const world = root.querySelector('.ll-flow-world');
  const img = world.querySelector('img');
  const notes = [...root.querySelectorAll('.ll-flow-notes li')].map(li => li.textContent.trim());
  const caption = root.querySelector('.ll-flow-caption');
  const num = caption.querySelector('.ll-flow-num');
  const text = caption.querySelector('.ll-flow-text');
  const dashes = [...root.querySelectorAll('.ll-flow-progress i')];
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');

  const IMG_W = 3931, IMG_H = 4469;
  const RHO = Math.SQRT2, RHO2 = RHO * RHO, RHO4 = RHO2 * RHO2;
  const READ_MS_PER_CHAR = 50;          // 20 characters per second
  const CAPTION_AT = 0.55;              // captions arrive once the camera is mostly there

  /* Views are [centre x, centre y, visible width], all in image pixels. */
  const VIEWS = {
    b1: [1788, 1765, 1700],   // context check: partial and insufficient context
    b2: [1118, 3029, 1700],   // evidence check: known, unknown, who can verify
    b3a: [950, 3800, 1800],   // follow-up: the row starts
    b3b: [2700, 3800, 1800]   // follow-up: the existing contact form
  };
  const STEPS = [
    { v: 'all', cap: 0 },
    { v: 'b1', cap: 1 },
    { v: 'b2', cap: 2 },
    { v: 'b3a', cap: 3 },
    { v: 'b3b', cap: 3, dolly: true },
    { v: 'all', cap: -1 }
  ];

  /* ---------- easing ---------- */
  const bezier = (x1, y1, x2, y2) => {
    const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx;
    const cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;
    const sx = t => ((ax * t + bx) * t + cx) * t;
    const sy = t => ((ay * t + by) * t + cy) * t;
    const dx = t => (3 * ax * t + 2 * bx) * t + cx;
    return x => {
      if (x <= 0) return 0;
      if (x >= 1) return 1;
      let t = x;
      for (let i = 0; i < 8; i++) {
        const e = sx(t) - x;
        if (Math.abs(e) < 1e-5) return sy(t);
        const d = dx(t);
        if (Math.abs(d) < 1e-6) break;
        t -= e / d;
      }
      let lo = 0, hi = 1;
      t = x;
      for (let i = 0; i < 24; i++) {
        const e = sx(t);
        if (Math.abs(e - x) < 1e-5) break;
        if (x > e) lo = t; else hi = t;
        t = (lo + hi) / 2;
      }
      return sy(t);
    };
  };
  const easeCamera = bezier(0.2, 0, 0, 1);
  const easeDolly = bezier(0.37, 0, 0.63, 1);

  /* ---------- van Wijk & Nuij zoom (after d3-interpolate) ---------- */
  const cosh = x => ((x = Math.exp(x)) + 1 / x) / 2;
  const sinh = x => ((x = Math.exp(x)) - 1 / x) / 2;
  const tanh = x => ((x = Math.exp(2 * x)) - 1) / (x + 1);
  const zoom = (p0, p1) => {
    const [ux0, uy0, w0] = p0, [ux1, uy1, w1] = p1;
    const dx = ux1 - ux0, dy = uy1 - uy0, d2 = dx * dx + dy * dy;
    if (d2 < 1e-12) {
      const S = Math.log(w1 / w0) / RHO;
      return { S, at: t => [ux0, uy0, w0 * Math.exp(RHO * t * S)] };
    }
    const d1 = Math.sqrt(d2);
    const b0 = (w1 * w1 - w0 * w0 + RHO4 * d2) / (2 * w0 * RHO2 * d1);
    const b1 = (w1 * w1 - w0 * w0 - RHO4 * d2) / (2 * w1 * RHO2 * d1);
    const r0 = Math.log(Math.sqrt(b0 * b0 + 1) - b0);
    const r1 = Math.log(Math.sqrt(b1 * b1 + 1) - b1);
    const S = (r1 - r0) / RHO, coshr0 = cosh(r0);
    return {
      S,
      at: t => {
        const s = t * S;
        const u = w0 / (RHO2 * d1) * (coshr0 * tanh(RHO * s + r0) - sinh(r0));
        return [ux0 + u * dx, uy0 + u * dy, w0 * coshr0 / cosh(RHO * s + r0)];
      }
    };
  };

  /* ---------- layout ---------- */
  let W = 1, H = 1;
  const view = key => {
    if (key === 'all') return [IMG_W / 2, IMG_H / 2, Math.max(IMG_W * 1.04, IMG_H * 1.04 * W / H)];
    const v = VIEWS[key];
    const narrow = W / H < 1.2 ? 0.55 : 1;   // phones: a tighter lens, the captions carry the meaning
    return [v[0], v[1], v[2] * narrow];
  };
  const place = ([cx, cy, w]) => {
    const k = W / w;
    world.style.transform = `translate(${W / 2 - cx * k}px, ${H / 2 - cy * k}px) scale(${k})`;
  };

  /* ---------- timeline ---------- */
  let segs = [], events = [], total = 0;
  const build = () => {
    W = stage.clientWidth || 1;
    H = stage.clientHeight || 1;
    const fresh = !segs.length;
    let t = 0;
    const nextSegs = [], nextEvents = [{ t: 0, op: 'in', cap: 0 }];
    nextSegs.push({ t0: 0, t1: 2400, from: 'all', to: 'all' });
    t = 2400;
    for (let i = 1; i < STEPS.length; i++) {
      const prev = STEPS[i - 1], cur = STEPS[i];
      const path = zoom(view(prev.v), view(cur.v));
      let dur, hold;
      if (fresh) {
        dur = cur.dolly ? 3400 : Math.min(2400, Math.max(1300, path.S * 1000 * 1.9));
        if (cur.dolly) hold = 1400;
        else if (cur.cap < 0) hold = 1600;
        else if (cur.v === 'b3a') hold = 1200;
        else {
          const reading = (notes[cur.cap] || '').length * READ_MS_PER_CHAR;
          hold = Math.max(1400, CAPTION_AT * dur + 150 + reading + 500 - dur);
        }
      } else {
        const old = segs[nextSegs.length];
        dur = old.t1 - old.t0;
        hold = segs[nextSegs.length + 1].t1 - segs[nextSegs.length + 1].t0;
      }
      if (cur.cap !== prev.cap) {
        nextEvents.push({ t, op: 'out' });
        if (cur.cap >= 0) nextEvents.push({ t: t + CAPTION_AT * dur, op: 'in', cap: cur.cap });
      }
      nextSegs.push({ t0: t, t1: t + dur, from: prev.v, to: cur.v, path, ease: cur.dolly ? easeDolly : easeCamera });
      nextSegs.push({ t0: t + dur, t1: t + dur + hold, from: cur.v, to: cur.v });
      t += dur + hold;
    }
    segs = nextSegs;
    events = nextEvents;
    total = t;
    root.dataset.tourSeconds = (total / 1000).toFixed(1);
  };

  /* ---------- caption ---------- */
  let shownEvent = -1;
  const showCaption = cap => {
    caption.classList.add('is-pre');
    text.textContent = notes[cap] || '';
    num.textContent = cap > 0 ? String(cap) : '';
    caption.dataset.n = String(cap);
    dashes.forEach((d, i) => d.classList.toggle('is-on', i === cap - 1));
    void caption.offsetWidth;                 // start the entrance from the resting offset
    caption.classList.remove('is-pre', 'is-out');
  };
  const applyEvent = e => {
    if (e.op === 'out') {
      caption.classList.add('is-out');
      dashes.forEach(d => d.classList.remove('is-on'));
    } else showCaption(e.cap);
  };

  /* ---------- playback ---------- */
  let time = 0, last = 0, raf = 0, playing = false, visible = false, ready = false;
  const render = () => {
    let seg = segs[segs.length - 1];
    for (const s of segs) if (time < s.t1) { seg = s; break; }
    place(seg.path ? seg.path.at(seg.ease((time - seg.t0) / (seg.t1 - seg.t0))) : view(seg.to));
    let idx = 0;
    for (let i = 0; i < events.length; i++) if (events[i].t <= time) idx = i;
    if (idx !== shownEvent) { shownEvent = idx; applyEvent(events[idx]); }
  };
  const frame = now => {
    raf = 0;
    if (!playing) return;
    time = (time + Math.min(now - last, 100)) % total;
    last = now;
    render();
    raf = requestAnimationFrame(frame);
  };
  const sync = () => {
    const go = visible && ready && !document.hidden && !reduced.matches && !root.classList.contains('is-static');
    if (go && !playing) { playing = true; last = performance.now(); raf = requestAnimationFrame(frame); }
    else if (!go && playing) { playing = false; cancelAnimationFrame(raf); raf = 0; }
  };

  const setMode = () => {
    root.classList.toggle('is-static', reduced.matches);
    if (reduced.matches) { world.style.transform = ''; sync(); return; }
    build();
    render();
    sync();
  };

  setMode();                                   // first frame: the whole flow, with its caption
  (img.decode ? img.decode().catch(() => {}) : Promise.resolve()).then(() => { ready = true; sync(); });

  if ('IntersectionObserver' in window) {
    new IntersectionObserver(entries => entries.forEach(entry => {
      visible = entry.isIntersecting;
      sync();
    }), { threshold: 0.5 }).observe(stage);
  } else visible = true;

  document.addEventListener('visibilitychange', sync);
  reduced.addEventListener?.('change', setMode);
  let resizeTimer = 0;
  window.addEventListener('resize', () => {
    if (!ready || reduced.matches) return;
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => { build(); render(); }, 120);
  }, { passive: true });
})();
