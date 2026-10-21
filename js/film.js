/* FILM page: television + tape deck + VHS tapes.
   Every film is a tape on the shelf. Click one and it is lifted out, shown, slid into the deck and played on the set.
   TUNE changes the picture texture, VOL +/- the sound. */
(() => {
  'use strict';

  const TAPES = window.FILM_TAPES;
  const LOOKS = [{ id: 'clean', name: 'CLEAN' }, { id: 'crt', name: 'CRT' }, { id: 'vhs', name: 'VHS' }, { id: 'ghost', name: 'GHOST' }, { id: 'mono', name: 'MONO' }];
  const VIMEO = 'https://player.vimeo.com';
  const nameOf = t => (t.sub ? `${t.title} — ${t.sub}` : t.title);

  const $ = s => document.querySelector(s);
  const body = document.body;
  const screen = $('#screen'), vid = $('#tvvideo'), noise = $('#noise'), nctx = noise.getContext('2d');
  const deck = $('#deck'), slot = $('#slot'), knob = $('#knob'), shelf = $('#shelf'), set = $('#main');
  const osdState = $('#osd-state'), osdTime = $('#osd-time'), osdLow = $('#osd-low');
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const pad = n => String(n).padStart(2, '0');
  const sleep = ms => new Promise(r => setTimeout(r, reduce ? 1 : ms));
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

  const S = { cur: null, busy: false, queue: null, on: true, vol: 6, look: 1, muteBlocked: false, gesture: false, loading: false };

  /* ---------- Shelf ---------- */
  TAPES.forEach((t, i) => {
    const label = nameOf(t);
    const li = document.createElement('li');
    li.className = 'holder';
    li.innerHTML =
      `<button class="tape is-rest" data-i="${i}" style="--accent:${t.accent}" aria-label="Insert tape ${i + 1}: ${label}">` +
      `<span class="cube">` +
      `<span class="face f-spine"><img src="images/FILM/tape-spine.webp" alt=""><span class="spine-label"><img src="images/FILM/labels/${t.id}-spine.webp" alt=""></span></span>` +
      `<span class="face f-back"></span><span class="face f-left"></span><span class="face f-right"></span><span class="face f-bottom"></span>` +
      `<span class="face f-top"><img src="images/FILM/tape-top.webp" alt=""><span class="top-label"><img src="images/FILM/labels/${t.id}-top.webp" alt=""></span></span>` +
      `</span></button>`;
    li.querySelectorAll("img").forEach(im => { im.draggable = false; });
    shelf.appendChild(li);
    t.holder = li; t.tape = li.querySelector('.tape'); t.cube = li.querySelector('.cube');
  });

  /* ---------- Motion helpers ---------- */
  const tf = (dx, dy, s = 1) => `translate(${dx.toFixed(1)}px, ${dy.toFixed(1)}px) scale(${s.toFixed(4)})`;
  const spin = (y, x) => `rotateY(${y.toFixed(2)}deg) rotateX(${x.toFixed(2)}deg)`;
  const poseT = p => tf(p.x, p.y, p.s), poseC = p => spin(p.ry, p.rx);
  /* One animation through several keyframes, so a move never stops at a waypoint.
     A frame's `e` eases the stretch that ends at that frame. */
  async function animKeys(el, frames, ms) {
    const kf = [{ transform: el._tf || 'none', offset: 0 }].concat(frames.map(f => ({ transform: f.t, offset: f.o })));
    frames.forEach((f, j) => { if (f.e) kf[j].easing = f.e; });
    const a = el.animate(kf, { duration: reduce ? 1 : ms, fill: 'forwards' });
    try { await a.finished; } catch (e) { /* cancelled */ }
    const to = frames[frames.length - 1].t;
    el.style.transform = to; el._tf = to; a.cancel();
  }
  function setPose(t, p) {
    t.pose = p;
    t.tape.style.transform = t.tape._tf = poseT(p);
    t.cube.style.transform = t.cube._tf = poseC(p);
  }

  /* ---------- One smooth path ----------
     The tape follows a single spline through its waypoints. Time is warped so the speed starts and ends at rest and only
     eases (never stops) at the slow point. Position, size and both rotations share one parameter. */
  function spline(knots, vals) {
    const n = knots.length;
    const m = vals.map((_, i) => { const a = Math.max(0, i - 1), b = Math.min(n - 1, i + 1); return (vals[b] - vals[a]) / ((knots[b] - knots[a]) || 1); });
    return u => {
      let i = 0; while (i < n - 2 && u > knots[i + 1]) i++;
      const h = knots[i + 1] - knots[i], t = (u - knots[i]) / h, t2 = t * t, t3 = t2 * t;
      return (2 * t3 - 3 * t2 + 1) * vals[i] + (t3 - 2 * t2 + t) * h * m[i] + (-2 * t3 + 3 * t2) * vals[i + 1] + (t3 - t2) * h * m[i + 1];
    };
  }
  function timeWarp(slowAt, dip) {
    const sm = (a, b, x) => { const q = clamp((x - a) / (b - a), 0, 1); return q * q * (3 - 2 * q); };
    const speed = t => (.05 + sm(0, .22, t)) * (.05 + sm(0, .3, 1 - t)) * (1 - dip * Math.exp(-Math.pow((t - slowAt) / .13, 2)));
    const N = 400, cum = [0];
    for (let k = 1; k <= N; k++) cum[k] = cum[k - 1] + speed((k - .5) / N);
    const total = cum[N];
    return t => { const x = clamp(t, 0, 1) * N, i = Math.min(N - 1, Math.floor(x)); return (cum[i] + (cum[i + 1] - cum[i]) * (x - i)) / total; };
  }
  /* way: [{x, y, s, ry, rx}] starting at the tape's current pose; slowIdx: the waypoint passed slowest (or -1) */
  async function fly(t, way, ms, slowIdx = -1, dip = .55, slowAt = .38) {
    const U = timeWarp(slowAt, slowIdx < 0 ? 0 : dip), n = way.length;
    const uSlow = slowIdx < 0 ? 0 : U(slowAt);
    const knots = way.map((_, i) => slowIdx < 0 ? i / (n - 1) : (i <= slowIdx ? uSlow * i / (slowIdx || 1) : uSlow + (1 - uSlow) * (i - slowIdx) / (n - 1 - slowIdx)));
    const ch = k => spline(knots, way.map(w => w[k]));
    const fx = ch('x'), fy = ch('y'), fs = ch('s'), fry = ch('ry'), frx = ch('rx');
    const N = Math.max(2, Math.round(ms / 28)), kt = [], kc = [];
    for (let k = 1; k <= N; k++) {
      const tt = k / N, u = U(tt);
      kt.push({ o: tt, t: tf(fx(u), fy(u), fs(u)) });
      kc.push({ o: tt, t: spin(fry(u), frx(u)) });
    }
    const last = way[n - 1];
    kt[N - 1].t = poseT(last); kc[N - 1].t = poseC(last);
    await Promise.all([animKeys(t.tape, kt, ms), animKeys(t.cube, kc, ms)]);
    t.pose = last;
  }
  /* Falling onto something: accelerates, lands, a small bounce, settles. */
  async function drop(t, to, ms = 300) {
    const up = { ...to, y: to.y - dims().H * .12 };
    await Promise.all([
      animKeys(t.tape, [{ o: .7, t: poseT(to), e: 'cubic-bezier(.55,0,1,.45)' }, { o: .85, t: poseT(up), e: 'cubic-bezier(0,.55,.45,1)' }, { o: 1, t: poseT(to), e: 'cubic-bezier(.55,0,1,.45)' }], ms),
      animKeys(t.cube, [{ o: .7, t: poseC(to) }, { o: 1, t: poseC(to) }], ms)
    ]);
    t.pose = to;
  }

  /* ---------- The stack ----------
     Tapes lie on top of each other, to the right of the set. Take one out and the ones above it drop into the space.
     A tape coming out of the deck goes back on top. All positions are offsets from one base box at the bottom of the stack. */
  const GAP = .1, JIT = [.012, -.016, .02, -.008, .01, -.012];
  S.stack = [];   // tape indices, bottom to top
  function dims() {
    const r = shelf.getBoundingClientRect(), W = r.width, H = W * .13;
    return { W, H, D: H * 3.857, step: H * (1 + GAP), bx: r.left + W / 2, by: r.bottom - H / 2 };
  }
  const restPose = (i, level) => { const d = dims(); return { x: d.W * JIT[i % JIT.length], y: -level * d.step, s: 1, ry: 0, rx: 0 }; };
  function deckPose() {
    const d = dims(), s = slot.getBoundingClientRect();
    return { x: s.left + s.width / 2 - d.bx, y: s.top + s.height / 2 - d.by, s: clamp(s.width * .9 / d.W, .5, .92), ry: 0, rx: 0 };
  }
  const restAll = () => S.stack.forEach((ti, lvl) => setPose(TAPES[ti], restPose(ti, lvl)));

  /* Slide the tape out of the pile (outward, away from the TV); as soon as it is clear the tapes above it drop. */
  async function pullOut(i) {
    const t = TAPES[i], level = S.stack.indexOf(i), d = dims(), p = t.pose;
    t.tape.classList.remove('is-rest'); t.tape.classList.add('moving');
    S.stack.splice(level, 1);
    const sliding = fly(t, [p, { x: p.x + d.W * .66, y: p.y - d.H * .25, s: 1.06, ry: -8, rx: -10 }], 340);
    await sleep(190);
    const falling = S.stack.slice(level).map((ti, n) => sleep(n * 45).then(() => drop(TAPES[ti], restPose(ti, level + n), 300)));
    if (falling.length) setTimeout(() => click(320, .05, 30), 260);
    await Promise.all([sliding, ...falling]);
  }

  /* The showcase: the tape comes right up to the camera in front of the screen, tilted so you see the picture on its
     label, while the set behind it dims. Then it drops to the door, lines up in front of it and is pushed in. */
  async function insert(i) {
    const t = TAPES[i], d = dims(), dp = deckPose(), sr = screen.getBoundingClientRect();
    const show = { x: sr.left + sr.width / 2 - d.bx, y: sr.top + sr.height * .54 - d.by, s: clamp(sr.width * 1.12 / d.W, 1.4, 1.9), ry: -6, rx: -74 };   // nearly face-on, so the cover reads
    deck.classList.add('open');
    set.classList.add('showcase');
    setTimeout(() => set.classList.remove('showcase'), reduce ? 0 : 1050);
    await fly(t, [
      t.pose,
      show,                                                                    // in front of the screen: the slowest point
      { x: dp.x + d.W * .1, y: dp.y - d.H * .9, s: 1.4, ry: 4, rx: -24 },
      { ...dp, s: 1.28 },                                                      // in front of the door, lined up
      dp                                                                        // pushed in
    ], 1900, 1, .6, .4);
    t.tape.classList.remove('moving'); t.tape.classList.add('in-deck');
    deck.classList.remove('open'); deck.classList.add('live');
    S.cur = i; updateInfo(); click(170, .16, 90);
  }

  /* Pull the tape straight out of the door, carry it left along the deck and drop it on top of the pile. */
  async function ejectToStack() {
    const i = S.cur, t = TAPES[i], d = dims(), dp = deckPose();
    S.cur = null; updateInfo(); player.stop(); click(210, .1, 70);
    showBlue('EJECT ⏏', ''); deckState('EJECT');
    deck.classList.add('open');
    t.tape.classList.add('moving'); t.tape.classList.remove('in-deck');
    const rest = restPose(i, S.stack.length);
    await fly(t, [
      t.pose,
      { ...dp, s: 1.28 },                                                      // straight out, toward you
      { x: dp.x * .45, y: dp.y + d.H * .3, s: 1.3, ry: 6, rx: -14 },          // back along the deck, in front of it
      { ...rest, y: rest.y - d.step * 1.4, s: 1.04 }                          // just above the pile
    ], 950);
    deck.classList.remove('open'); deck.classList.remove('live');
    S.stack.push(i);
    await drop(t, rest, 280);
    click(300, .06, 35);
    t.tape.classList.remove('moving'); t.tape.classList.add('is-rest');
  }

  async function run(i) {
    S.busy = true;
    warm(TAPES[i]);   // start fetching the film while the tapes move
    try {
      if (S.cur !== null) await ejectToStack();   // one tape in the air at a time
      else showBlue('NO TAPE', 'INSERT A TAPE');
      prepare(TAPES[i]);
      await pullOut(i);
      await insert(i);
      startPlayback(i);
    } finally { S.busy = false; }
    const q = S.queue; S.queue = null;
    if (q !== null && q !== S.cur) run(q);
  }
  const request = i => { if (i === S.cur) return; if (S.busy) S.queue = i; else run(i); };
  async function ejectOnly() {
    if (S.cur === null || S.busy) return;
    S.busy = true;
    await ejectToStack();
    showBlue('NO TAPE', 'INSERT A TAPE');
    S.busy = false;
  }

  shelf.addEventListener('click', e => { const b = e.target.closest('.tape'); if (b) request(+b.dataset.i); });
  ['pointerover', 'focusin'].forEach(ev => shelf.addEventListener(ev, e => { const b = e.target.closest('.tape'); if (b) warm(TAPES[+b.dataset.i]); }));
  slot.addEventListener('click', ejectOnly);

  /* ---------- Screen: noise, tracking, blue screen, on-screen display ---------- */
  let noiseFrame = null, loadFrame = null;
  const noiseImage = nctx.createImageData(noise.width, noise.height);
  function paintNoise() {
    const d = noiseImage.data;
    for (let i = 0; i < d.length; i += 4) { const v = Math.random() * 255; d[i] = d[i + 1] = d[i + 2] = v; d[i + 3] = 255; }
    nctx.putImageData(noiseImage, 0, 0);
  }
  function staticBurst(ms = 320, level = 1) {
    cancelAnimationFrame(noiseFrame);
    const start = performance.now();
    (function frame(now) {
      paintNoise();
      const t = Math.min(1, (now - start) / ms);
      noise.style.opacity = String(level * (1 - t * t));
      if (t < 1) noiseFrame = requestAnimationFrame(frame); else noise.style.opacity = '0';
    })(start);
  }
  /* Snow while a film is still arriving (Vimeo can take a few seconds) */
  function setLoading(on) {
    if (S.loading === on) return;
    S.loading = on;
    cancelAnimationFrame(loadFrame);
    if (on) {
      cancelAnimationFrame(noiseFrame);
      let n = 0;
      (function frame() { if (!S.loading) return; if (n++ % 3 === 0) paintNoise(); noise.style.opacity = '.55'; loadFrame = requestAnimationFrame(frame); })();
      showState('LOADING', { sticky: true, blink: true });
    } else { staticBurst(380, .55); osdState.classList.remove('blink'); showState('PLAY ▶'); }
  }
  function tracking() {
    screen.classList.remove('tracking'); void screen.offsetWidth; screen.classList.add('tracking');
    setTimeout(() => screen.classList.remove('tracking'), 1000);
  }
  function showBlue(main, sub) {
    setLoading(false);
    $('#blue-main').textContent = main; $('#blue-sub').textContent = sub;
    screen.dataset.mode = 'blue'; staticBurst(260, .7);
  }

  let tState, tLow;
  function showState(text, { ms = 2400, sticky = false, blink = false } = {}) {
    osdState.textContent = text; osdState.classList.add('on'); osdState.classList.toggle('blink', blink);
    clearTimeout(tState);
    if (!sticky) tState = setTimeout(() => osdState.classList.remove('on', 'blink'), ms);
  }
  function showLow(html, ms = 2400) {
    osdLow.innerHTML = html; osdLow.classList.add('on');
    clearTimeout(tLow); if (ms) tLow = setTimeout(() => osdLow.classList.remove('on'), ms);
  }
  function showVolume() {
    if (S.vol === 0) return showLow('MUTE');
    const bars = Array.from({ length: 10 }, (_, k) => `<i class="${k < S.vol ? '' : 'off'}"></i>`).join('');
    showLow(`VOLUME<span class="bars">${bars}</span>`);
  }
  function showLook() {
    const bars = LOOKS.map((_, k) => `<i class="${k <= S.look ? '' : 'off'}"></i>`).join('');
    showLow(`TUNE<span class="bars five">${bars}</span><small>${LOOKS[S.look].name}</small>`);
  }
  function showTitle(t) { showLow(`${nameOf(t).toUpperCase()}<small>${t.year} · ${t.run}</small>`, 3600); }

  /* ---------- Player: a local file, or a Vimeo embed, behind one interface ---------- */
  const gain = () => Math.pow(S.vol / 10, 1.6);
  const vsend = (t, method, value) => {
    if (!t.frame) return;
    try { t.frame.contentWindow.postMessage(JSON.stringify(value === undefined ? { method } : { method, value }), VIMEO); } catch (e) { /* not ready */ }
  };

  /* One hidden, paused embed per Vimeo tape, created the moment you point at the tape. */
  function frameFor(t) {
    if (t.frame) return t.frame;
    const f = document.createElement('iframe');
    f.className = 'vframe'; f.title = nameOf(t); f.allow = 'autoplay; fullscreen';
    f.src = `${VIMEO}/video/${t.vimeo}?api=1&autoplay=0&loop=1&muted=1&controls=0&title=0&byline=0&portrait=0&dnt=1&autopause=0`;
    screen.insertBefore(f, $('#blue'));
    t.frame = f; t.ready = false; t.started = false; t.vtime = 0; t.vplaying = false;
    f.addEventListener('load', () => setTimeout(() => { if (!t.ready) onReady(t); }, 900));
    return f;
  }
  function onReady(t) {
    if (t.ready) return;
    t.ready = true;
    ['timeupdate', 'playProgress', 'play', 'pause'].forEach(ev => vsend(t, 'addEventListener', ev));
    if (player.t === t) vimeoStart(t);
  }
  function vimeoStart(t) {
    if (!t.ready) return;
    vsend(t, 'setCurrentTime', 0); applyVolume(); vsend(t, 'play'); t.vplaying = true;
  }
  addEventListener('message', e => {
    if (e.origin !== VIMEO) return;
    const t = TAPES.find(x => x.frame && x.frame.contentWindow === e.source);
    if (!t) return;
    let m; try { m = typeof e.data === 'string' ? JSON.parse(e.data) : e.data; } catch (err) { return; }
    if (!m) return;
    if (m.event === 'ready') return onReady(t);
    if ((m.event === 'timeupdate' || m.event === 'playProgress') && m.data) {
      t.vtime = m.data.seconds || 0;
      if (!t.started && player.t === t && t.vtime > 0) { t.started = true; setLoading(false); }
    }
    if (m.event === 'play') t.vplaying = true;
    if (m.event === 'pause') t.vplaying = false;
  });

  /* Start loading the film while the tape is still in the air, so nothing has to start when it lands. */
  function prepare(t) {
    if (t.vimeo) { frameFor(t); return; }
    if (!vid.src.endsWith(t.src)) { vid.src = t.src; vid.load(); }
  }

  function warm(t) {
    if (t.vimeo) { frameFor(t); return; }
    if (!t.warmEl) { const w = document.createElement('video'); w.preload = 'auto'; w.muted = true; w.src = t.src; t.warmEl = w; }
  }

  const player = {
    t: null,
    get isVimeo() { return !!(this.t && this.t.vimeo); },
    load(t) {
      this.t = t;
      screen.dataset.mode = 'tape';
      TAPES.forEach(x => { if (x.frame && x !== t) { vsend(x, 'pause'); x.frame.style.display = 'none'; } });
      if (t.vimeo) {
        vid.pause(); vid.removeAttribute('src'); vid.load(); vid.style.display = 'none';
        const f = frameFor(t); f.style.display = 'block';
        t.started = false; t.vtime = 0;
        setLoading(true);
        if (t.ready) { vimeoStart(t); setTimeout(() => { if (!t.started && S.loading && player.t === t && t.vtime === 0) { /* still waiting for the first frame */ } }, 0); }
      } else {
        vid.style.display = '';
        if (!vid.src.endsWith(t.src)) vid.src = t.src;
        vid.currentTime = 0;
        vid.muted = S.vol === 0 || !S.on; vid.volume = gain();
        setLoading(true);
        const p = vid.play();
        if (p) p.catch(() => { S.muteBlocked = true; vid.muted = true; vid.play().catch(() => {}); showLow('SOUND OFF<small>CLICK THE SCREEN</small>', 0); });
      }
    },
    stop() {
      vid.pause(); vid.removeAttribute('src'); vid.load();
      if (this.t && this.t.vimeo) { vsend(this.t, 'pause'); this.t.frame.style.display = 'none'; }
      setLoading(false); this.t = null;
    },
    get playing() { return !this.t ? false : this.isVimeo ? this.t.vplaying : !vid.paused; },
    play() { if (!this.t) return; if (this.isVimeo) { vsend(this.t, 'play'); this.t.vplaying = true; } else vid.play().catch(() => {}); },
    pause() { if (!this.t) return; if (this.isVimeo) { vsend(this.t, 'pause'); this.t.vplaying = false; } else vid.pause(); },
    toggle() { this.playing ? this.pause() : this.play(); },
    seek(d) { if (!this.t) return; if (this.isVimeo) vsend(this.t, 'setCurrentTime', Math.max(0, this.t.vtime + d)); else vid.currentTime = clamp(vid.currentTime + d, 0, (vid.duration || 1e9) - .05); },
    time() { return !this.t ? null : this.isVimeo ? (this.t.started ? this.t.vtime : null) : vid.currentTime; }
  };
  vid.addEventListener('playing', () => { if (player.t && !player.isVimeo) setLoading(false); });

  function applyVolume() {
    const muted = S.vol === 0 || S.muteBlocked || !S.on;   // sound comes out of the TV
    vid.muted = muted; vid.volume = gain();
    if (player.isVimeo) { vsend(player.t, 'setVolume', gain()); vsend(player.t, 'setMuted', muted); }
  }
  function unlockSound() {
    S.gesture = true;
    if (!S.muteBlocked) return false;
    S.muteBlocked = false; applyVolume(); osdLow.classList.remove('on'); showVolume();
    return true;
  }
  addEventListener('pointerdown', e => { if (!e.target.closest('#screen')) unlockSound(); S.gesture = true; }, true);
  addEventListener('keydown', () => { unlockSound(); }, true);

  function startPlayback(i) {
    const t = TAPES[i];
    deckState('LOAD'); tracking(); staticBurst(700, .95);
    player.load(t);
    setTimeout(() => { if (S.cur === i) deckState(player.playing ? 'PLAY' : 'PAUSE'); }, 900);
    if (!S.muteBlocked) showTitle(t);
  }

  /* ---------- Hardware: VOL +/- keys, TUNE knob, POWER ---------- */
  const KNOB0 = 200; // the pointer bar in the photograph points at 200 degrees (clockwise from straight up) when the knob is not rotated
  const ring = $('#tune-ring');
  (function drawRing() {
    let h = '';
    for (let k = 0; k < LOOKS.length; k++) {
      const a = (-120 + k * 60) * Math.PI / 180, c = Math.cos(a), s = Math.sin(a);
      h += `<line data-k="${k}" x1="${(30.5 * s).toFixed(2)}" y1="${(-30.5 * c).toFixed(2)}" x2="${(35 * s).toFixed(2)}" y2="${(-35 * c).toFixed(2)}"/>`;
    }
    ring.innerHTML = h;
  })();
  function paintLook() {
    knob.style.rotate = `${-120 + S.look * 60 - KNOB0}deg`;
    ring.querySelectorAll('line').forEach(l => l.classList.toggle('lit', +l.dataset.k === S.look));
    screen.dataset.look = LOOKS[S.look].id;
  }
  function setLook(i, announce = true) {
    i = clamp(i, 0, LOOKS.length - 1);
    if (i === S.look && announce) { showLook(); return; }
    S.look = i; paintLook();
    if (announce) { showLook(); staticBurst(220, .45); click(1700, .045, 18); }
  }
  function setVol(v) {
    S.vol = clamp(Math.round(v), 0, 10);
    applyVolume(); showVolume();
  }

  function fitSlices() {
    const tv = $('#tv'), w = tv.clientWidth, h = tv.clientHeight;
    const slice = (el, cx, cy) => {
      el.style.backgroundImage = 'url(images/FILM/tv-black.jpg)';
      el.style.backgroundSize = `${w}px ${h}px`;
      el.style.backgroundPosition = `${-(cx * w - el.offsetWidth / 2)}px ${-(cy * h - el.offsetHeight / 2)}px`;
    };
    slice(knob, .7643, .4762);
    slice($('#vol-up'), .7643, .5676);
    slice($('#vol-down'), .7643, .6181);
    slice($('#tv-power'), .7643, .6181); // the same key as the one above, copied from the photograph
    slice($('.led-off'), .7639, .6629);  // the lamp itself; CSS dims it for the off state
    const dw = deck.clientWidth, dh = deck.clientHeight;
    document.querySelectorAll('.deck-btn').forEach(b => {
      b.style.backgroundImage = 'url(images/FILM/deck.webp)';
      b.style.backgroundSize = `${dw}px ${dh}px`;
      b.style.backgroundPosition = `${-b.offsetLeft}px ${-b.offsetTop}px`;
    });
  }

  let drag = null;
  knob.addEventListener('pointerdown', e => {
    const r = knob.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    drag = { cx, cy, last: Math.atan2(e.clientY - cy, e.clientX - cx), acc: 0, l0: S.look, moved: false, x: e.clientX };
    knob.setPointerCapture(e.pointerId);
  });
  knob.addEventListener('pointermove', e => {
    if (!drag) return;
    const a = Math.atan2(e.clientY - drag.cy, e.clientX - drag.cx);
    let d = a - drag.last; if (d > Math.PI) d -= 2 * Math.PI; if (d < -Math.PI) d += 2 * Math.PI;
    drag.last = a; drag.acc += d * 180 / Math.PI;
    if (Math.abs(drag.acc) > 6) drag.moved = true;
    if (drag.moved) { const i = clamp(Math.round(drag.l0 + drag.acc / 60), 0, LOOKS.length - 1); if (i !== S.look) setLook(i); }
  });
  knob.addEventListener('pointerup', () => {
    if (drag && !drag.moved) { const r = knob.getBoundingClientRect(); setLook(S.look + (drag.x >= r.left + r.width / 2 ? 1 : -1)); }
    drag = null;
  });
  knob.addEventListener('wheel', e => { e.preventDefault(); setLook(S.look + (e.deltaY < 0 ? 1 : -1)); }, { passive: false });

  /* Volume keys repeat while held */
  function holdKey(btn, step) {
    let t1, t2;
    const stop = () => { clearTimeout(t1); clearInterval(t2); };
    btn.addEventListener('pointerdown', () => { setVol(S.vol + step); t1 = setTimeout(() => { t2 = setInterval(() => setVol(S.vol + step), 110); }, 420); });
    ['pointerup', 'pointerleave', 'pointercancel'].forEach(ev => btn.addEventListener(ev, stop));
    btn.addEventListener('click', e => { if (e.detail === 0) setVol(S.vol + step); }); // keyboard
  }
  holdKey($('#vol-up'), 1); holdKey($('#vol-down'), -1);

  /* ---------- Deck, power, screen ---------- */
  function deckState(s) { $('#d-state').textContent = s; }
  const fmt = s => `${Math.floor(s / 60)}:${pad(Math.floor(s % 60))}`;
  setInterval(() => {
    const tm = player.time();
    $('#d-time').textContent = tm === null ? '--:--' : fmt(tm);
    if (S.cur !== null && !S.busy) deckState(player.playing ? 'PLAY' : 'PAUSE');
    if (tm !== null && osdTime.classList.contains('on')) osdTime.textContent = fmt(tm);
  }, 250);

  function playPause() {
    if (S.cur === null) return;
    player.toggle();
    setTimeout(() => {
      if (player.playing) { showState('PLAY ▶'); osdTime.classList.remove('on'); }
      else { showState('PAUSE ❚❚', { sticky: true }); osdTime.classList.add('on'); }
    }, 80);
  }
  function seek(d) {
    if (S.cur === null) return;
    player.seek(d); showState(d < 0 ? '◀◀ REW' : '▶▶ FF', { ms: 900 });
  }
  function power() {
    S.on = !S.on;
    body.classList.toggle('is-off', !S.on);
    screen.classList.remove('on', 'off'); void screen.offsetWidth; screen.classList.add(S.on ? 'on' : 'off');
    // The TV and the deck are separate machines: switching the TV off takes away picture and sound,
    // the tape keeps running in the deck, and the picture comes back wherever the tape has got to.
    applyVolume();
    if (S.on) staticBurst(500, .8);
  }
  screen.addEventListener('click', () => { if (unlockSound()) return; playPause(); });
  screen.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); playPause(); } });
  $('#tv-power').addEventListener('click', power);
  document.querySelectorAll('.deck-btn').forEach(b => b.addEventListener('click', () => ({ play: playPause, rew: () => seek(-5), ff: () => seek(5), eject: ejectOnly })[b.dataset.act]()));

  /* ---------- Bottom left: title and year ---------- */
  function updateInfo() {
    const t = S.cur === null ? null : TAPES[S.cur];
    $('#i-title').textContent = t ? nameOf(t) : '—';
    $('#i-year').textContent = t ? t.year : '—';
  }

  /* ---------- Light from the picture, reflections in the glass ---------- */
  const spill = $('#spill'), sc = document.createElement('canvas');
  sc.width = 8; sc.height = 6;
  const sctx = sc.getContext('2d', { willReadFrequently: true });
  let sp = [40, 60, 90];
  const hex = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
  function sampleSpill() {
    let target;
    if (!S.on) target = [0, 0, 0];
    else if (screen.dataset.mode === 'blue') target = [40, 70, 255];
    else if (player.t && !player.isVimeo && vid.readyState >= 2) {
      try {
        sctx.drawImage(vid, 0, 0, 8, 6);
        const d = sctx.getImageData(0, 0, 8, 6).data; let r = 0, g = 0, b = 0;
        for (let i = 0; i < d.length; i += 4) { r += d[i]; g += d[i + 1]; b += d[i + 2]; }
        const n = d.length / 4; target = [r / n * 1.5, g / n * 1.5, b / n * 1.5];
      } catch (e) { target = sp; }
    } else if (player.t) target = hex(player.t.accent).map(v => v * .8); // Vimeo cannot be read; use the tape colour
    else target = [40, 50, 70];
    sp = sp.map((v, i) => v + (target[i] - v) * .4);
    spill.style.setProperty('--sp', sp.map(v => Math.round(clamp(v, 0, 255))).join(', '));
  }
  setInterval(sampleSpill, 250);

  // the reflection of the room moves a little as the pointer moves
  let rxy = null;
  addEventListener('pointermove', e => {
    const r = screen.getBoundingClientRect();
    const x = clamp((e.clientX - (r.left + r.width / 2)) / (innerWidth / 2), -1, 1), y = clamp((e.clientY - (r.top + r.height / 2)) / (innerHeight / 2), -1, 1);
    if (!rxy) requestAnimationFrame(() => { screen.style.setProperty('--rx', rxy[0].toFixed(3)); screen.style.setProperty('--ry', rxy[1].toFixed(3)); rxy = null; });
    rxy = [x, y];
  }, { passive: true });

  /* ---------- Feel: key travel, a small mechanical click ---------- */
  let actx = null;
  function click(freq = 1500, level = .04, ms = 22) {
    if (!S.gesture) return;
    try {
      actx = actx || new (window.AudioContext || window.webkitAudioContext)();
      const t0 = actx.currentTime, o = actx.createOscillator(), g = actx.createGain();
      o.type = 'square'; o.frequency.setValueAtTime(freq, t0); o.frequency.exponentialRampToValueAtTime(freq * .4, t0 + ms / 1000);
      g.gain.setValueAtTime(level, t0); g.gain.exponentialRampToValueAtTime(.0001, t0 + ms / 1000 + .004);
      o.connect(g); g.connect(actx.destination); o.start(t0); o.stop(t0 + ms / 1000 + .01);
    } catch (e) { /* no audio */ }
    if (navigator.vibrate && navigator.userActivation && navigator.userActivation.hasBeenActive) navigator.vibrate(5);
  }
  const flash = el => { if (!el) return; el.classList.add('down'); setTimeout(() => el.classList.remove('down'), 130); };
  document.querySelectorAll('.tvkey, .deck-btn').forEach(b => b.addEventListener('pointerdown', () => click(b.classList.contains('deck-btn') ? 800 : 1200, .045)));
  knob.addEventListener('pointerdown', () => click(900, .03, 16));

  /* ---------- Keyboard ---------- */
  addEventListener('keydown', e => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const onBody = e.target === document.body, k = e.key.toLowerCase();
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      const n = TAPES.length, step = e.key === 'ArrowRight' ? 1 : -1;
      request(S.cur === null ? 0 : (S.cur + step + n) % n);
    } else if (e.key === 'ArrowUp') { e.preventDefault(); flash($('#vol-up')); click(1200, .045); setVol(S.vol + 1); }
    else if (e.key === 'ArrowDown') { e.preventDefault(); flash($('#vol-down')); click(1200, .045); setVol(S.vol - 1); }
    else if (e.key === ' ' && onBody) { e.preventDefault(); playPause(); }
    else if (k === 'e' && onBody) ejectOnly();
    else if (k === 'm' && onBody) setVol(S.vol === 0 ? 6 : 0);
    else if (k === 'p' && onBody) { flash($('#tv-power')); click(1200, .045); power(); }
    else if (k === 't' && onBody) setLook((S.look + 1) % LOOKS.length);
  });

  /* ---------- Start: the first tape is already in the deck and playing ---------- */
  function boot() {
    fitSlices(); paintLook();
    shelf.style.setProperty('--n', TAPES.length);
    S.stack = TAPES.map((_, i) => i).filter(i => i !== 0).reverse();   // bottom to top: the first films end up on top
    restAll();
    const t0 = TAPES[0];
    t0.tape.classList.remove('is-rest'); t0.tape.classList.add('in-deck'); setPose(t0, deckPose());
    deck.classList.add('live'); shelf.classList.add('ready');
    S.cur = 0; updateInfo();
    startPlayback(0);
  }
  addEventListener('resize', () => {
    fitSlices();
    if (S.busy) return;
    restAll();
    if (S.cur !== null) setPose(TAPES[S.cur], deckPose());
  });
  if (document.readyState === 'complete') boot(); else addEventListener('load', boot);
})();
