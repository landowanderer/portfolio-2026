/* LiveLarge user flow: the whole diagram first, then the view moves in to three key moments and back out, in a loop.

   Motion
   - Path: van Wijk & Nuij, "Smooth and efficient zooming and panning" (rho = sqrt 2, as d3.interpolateZoom).
     Between distant stops the view widens a little on the way, so the reader keeps their place.
   - Easing: slow in, slow out, cubic-bezier(.65, 0, .35, 1), for every camera move.
   - One loop, 15.6 s: whole flow 2.0 s, in to 1 (2.0 s), hold 2.2 s, to 2 (1.6 s), hold 2.2 s, to 3 (1.6 s),
     hold 2.2 s, out to the whole flow (1.8 s). The whole view has no dimming and no caption.
   - At each stop everything it isn't about fades back (a pixel-exact layer per stop) over 400 ms after arrival and the caption rises 8 px into
     place (M3 emphasized decelerate). Both leave in the first 250 / 200 ms of the next move (emphasized accelerate).
   - Pauses off screen and in background tabs. With reduced motion or without JS, the three moments are shown as a list. */
(() => {
  const root = document.querySelector('[data-flow-tour]');
  if (!root) return;

  const stage = root.querySelector('.ll-flow-stage');
  const world = root.querySelector('.ll-flow-world');
  const img = world.querySelector('img');
  const dims = [...world.querySelectorAll('.ll-flow-stopdim')];
  const caption = root.querySelector('.ll-flow-caption');
  const num = caption.querySelector('.ll-flow-num');
  const text = caption.querySelector('.ll-flow-text');
  const shots = [...root.querySelectorAll('.ll-flow-shot')];
  const notes = shots.map(li => li.querySelector('p span:last-child').textContent.trim());
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');

  const IMG_W = 3931, IMG_H = 4469, CROP_W = 1590, CROP_H = 1060;
  const STOPS = [[920, 1215], [340, 2530], [1994, 3409]];   // where the three list frames sit in the diagram
  const FX = shots.map(li => { const v = parseFloat(li.style.getPropertyValue('--fx')); return Number.isNaN(v) ? 50 : v; });
  const WHOLE = -1, HOLD_WHOLE = 2000, HOLD_STOP = 2200;
  const MOVES = [[WHOLE, 0, 2000], [0, 1, 1600], [1, 2, 1600], [2, WHOLE, 1800]];
  const DIM_IN = 400, DIM_OUT = 250, CAPTION_OUT = 200, RISE = 8, LIFT = 4;

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
  const easeCamera = bezier(0.65, 0, 0.35, 1);
  const decelerate = bezier(0.05, 0.7, 0.1, 1);
  const accelerate = bezier(0.3, 0, 0.8, 0.15);

  /* ---------- van Wijk & Nuij zoom (after d3-interpolate) ---------- */
  const RHO = Math.SQRT2, RHO2 = 2, RHO4 = 4;
  const cosh = x => ((x = Math.exp(x)) + 1 / x) / 2;
  const sinh = x => ((x = Math.exp(x)) - 1 / x) / 2;
  const tanh = x => ((x = Math.exp(2 * x)) - 1) / (x + 1);
  const zoom = ([ux0, uy0, w0], [ux1, uy1, w1]) => {
    const dx = ux1 - ux0, dy = uy1 - uy0, d2 = dx * dx + dy * dy;
    if (d2 < 1e-12) {
      const S = Math.log(w1 / w0) / RHO;
      return t => [ux0, uy0, w0 * Math.exp(RHO * t * S)];
    }
    const d1 = Math.sqrt(d2);
    const b0 = (w1 * w1 - w0 * w0 + RHO4 * d2) / (2 * w0 * RHO2 * d1);
    const b1 = (w1 * w1 - w0 * w0 - RHO4 * d2) / (2 * w1 * RHO2 * d1);
    const r0 = Math.log(Math.sqrt(b0 * b0 + 1) - b0);
    const r1 = Math.log(Math.sqrt(b1 * b1 + 1) - b1);
    const S = (r1 - r0) / RHO, coshr0 = cosh(r0);
    return t => {
      const s = t * S;
      const u = w0 / (RHO2 * d1) * (coshr0 * tanh(RHO * s + r0) - sinh(r0));
      return [ux0 + u * dx, uy0 + u * dy, w0 * coshr0 / cosh(RHO * s + r0)];
    };
  };

  /* ---------- views: [centre x, centre y, visible width] in diagram pixels ---------- */
  let W = 1, H = 1;
  const view = i => {
    if (i === WHOLE) return [IMG_W / 2, IMG_H / 2, Math.max(IMG_W * 1.04, IMG_H * 1.04 * W / H)];
    const [ox, oy] = STOPS[i];
    if (W / H < 1.2) {                          // phones: the square each list frame uses (--fx)
      return [ox + (CROP_W - CROP_H) * FX[i] / 100 + CROP_H / 2, oy + CROP_H / 2, CROP_H * W / H];
    }
    return [ox + CROP_W / 2, oy + CROP_H / 2, Math.max(CROP_W, CROP_H * W / H)];
  };
  const place = ([cx, cy, w]) => {
    const k = W / w;
    world.style.transform = `translate(${W / 2 - cx * k}px, ${H / 2 - cy * k}px) scale(${k})`;
  };

  /* ---------- timeline ---------- */
  let segs = [], total = 0;
  const build = () => {
    W = stage.clientWidth || 1;
    H = stage.clientHeight || 1;
    segs = [{ t0: 0, t1: HOLD_WHOLE, at: WHOLE }];
    let t = HOLD_WHOLE;
    MOVES.forEach(([from, to, dur], i) => {
      segs.push({ t0: t, t1: t + dur, from, to, path: zoom(view(from), view(to)) });
      t += dur;
      if (to !== WHOLE) {                         // the last move ends on the whole flow, where the loop starts
        segs.push({ t0: t, t1: t + HOLD_STOP, at: to });
        t += HOLD_STOP;
      }
    });
    total = t;
  };
  const segAt = t => segs.find(s => t < s.t1) || segs[segs.length - 1];

  /* ---------- drawing ---------- */
  let shownNote = -1;
  const render = () => {
    const seg = segAt(time);
    const local = time - seg.t0;
    place(seg.path ? seg.path(easeCamera(local / (seg.t1 - seg.t0))) : view(seg.at));

    let stop = -1, dim = 0, show = 0, shift = 0;
    if (!seg.path && seg.at !== WHOLE) {        // arrived at a stop: fade everything else back, bring the caption in
      stop = seg.at;
      const e = decelerate(local / DIM_IN);
      dim = e;
      show = e;
      shift = RISE * (1 - e);
    } else if (seg.path && seg.from !== WHOLE) { // leaving a stop: both go first
      stop = seg.from;
      dim = 1 - accelerate(local / DIM_OUT);
      const e = accelerate(local / CAPTION_OUT);
      show = 1 - e;
      shift = -LIFT * e;
    }
    dims.forEach((g, i) => { g.style.opacity = i === stop ? dim.toFixed(3) : '0'; });
    if (stop >= 0 && stop !== shownNote) {
      shownNote = stop;
      num.textContent = String(stop + 1);
      text.textContent = notes[stop] || '';
    }
    caption.style.opacity = show.toFixed(3);
    caption.style.transform = shift ? `translateY(${shift.toFixed(2)}px)` : '';
  };

  /* ---------- playback ---------- */
  let time = 0, last = 0, raf = 0, playing = false, visible = false, ready = false;
  const frame = now => {
    raf = 0;
    if (!playing) return;
    time = (time + Math.min(now - last, 100)) % total;
    last = now;
    render();
    raf = requestAnimationFrame(frame);
  };
  const sync = () => {
    const go = root.classList.contains('is-live') && ready && visible && !document.hidden;
    if (go && !playing) { playing = true; last = performance.now(); raf = requestAnimationFrame(frame); }
    else if (!go && playing) { playing = false; cancelAnimationFrame(raf); raf = 0; }
  };

  const setMode = () => {
    root.classList.toggle('is-live', !reduced.matches);
    if (!reduced.matches) { build(); render(); }   // first frame: the whole flow
    sync();
  };
  setMode();
  // The diagram loads lazily; start once it's loaded and decoded, so the first move never waits on a decode.
  (img.complete ? Promise.resolve() : new Promise(r => img.addEventListener('load', r, { once: true })))
    .then(() => img.decode().catch(() => {}))
    .then(() => { ready = true; sync(); });

  if ('IntersectionObserver' in window) {
    // Fetch the diagram before the reader arrives; lazy loading alone started it seconds after the frame was on screen.
    const early = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) { img.loading = 'eager'; early.disconnect(); }
    }, { rootMargin: '150% 0px' });
    early.observe(root);
    new IntersectionObserver(entries => entries.forEach(entry => {
      visible = entry.isIntersecting;
      sync();
    }), { threshold: 0.5 }).observe(stage);
  } else visible = true;

  document.addEventListener('visibilitychange', sync);
  reduced.addEventListener?.('change', setMode);
  let resizeTimer = 0;
  window.addEventListener('resize', () => {
    if (reduced.matches) return;
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => { build(); render(); }, 120);
  }, { passive: true });
})();

/* 2.2 focus shot: the CSS loop runs only while the shot is on screen and the tab is visible. */
(() => {
  const shots = [...document.querySelectorAll('[data-focus-shot]')];
  if (!shots.length || !('IntersectionObserver' in window)) return;
  const seen = new Map();
  const sync = () => shots.forEach(el => el.classList.toggle('is-running', !!seen.get(el) && !document.hidden));
  const io = new IntersectionObserver(entries => {
    entries.forEach(e => seen.set(e.target, e.isIntersecting));
    sync();
  }, { threshold: 0.5 });
  shots.forEach(el => io.observe(el));
  document.addEventListener('visibilitychange', sync);
})();
