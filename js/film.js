/* FILM page: television + tape deck + VHS tapes.
   Every film is a tape on the shelf. Click one and it is lifted out, shown, slid into the deck and played on the set.
   TUNE changes the picture texture, VOL +/- the sound, FULL shows the film alone on black. */
(() => {
  'use strict';

  const TAPES = [
    { title: 'Specimen', sub: '', year: '2026', run: '00:25', src: 'videos/film/specimen.mp4', ratio: 4 / 3, still: 'images/FILM/label-specimen.jpg', accent: '#6f9c83' },
    { title: 'Fitcheck', sub: '', year: '2026', run: '00:30', src: 'videos/film/fitcheck.mp4', ratio: 16 / 9, still: 'images/FILM/label-fitcheck.jpg', accent: '#d9779f' },
    { title: 'Artificial Atmosphere', sub: 'LA RAIN', year: '2025', run: '02:53', vimeo: '1149379087', ratio: 16 / 9, still: 'images/FILM/label-la-rain.jpg', accent: '#5f86b8' },
    { title: 'Artificial Atmosphere', sub: 'FOG', year: '2026', run: '01:30', vimeo: '1182815311', ratio: 16 / 9, still: 'images/FILM/label-fog.jpg', accent: '#8d9d7a' }
  ];
  const LOOKS = [{ id: 'clean', name: 'CLEAN' }, { id: 'crt', name: 'CRT' }, { id: 'vhs', name: 'VHS' }, { id: 'ghost', name: 'GHOST' }, { id: 'mono', name: 'MONO' }];
  const VIMEO = 'https://player.vimeo.com';
  const nameOf = t => (t.sub ? `${t.title} — ${t.sub}` : t.title);

  const $ = s => document.querySelector(s);
  const body = document.body;
  const screen = $('#screen'), vid = $('#tvvideo'), noise = $('#noise'), nctx = noise.getContext('2d');
  const deck = $('#deck'), slot = $('#slot'), knob = $('#knob'), shelf = $('#shelf');
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
      `<span class="face f-spine"><img src="images/FILM/tape-spine.webp" alt=""><span class="spine-label"><b>${t.title}</b><span>${t.sub || t.year}</span></span></span>` +
      `<span class="face f-back"></span><span class="face f-left"></span><span class="face f-right"></span><span class="face f-bottom"></span>` +
      `<span class="face f-top"><img src="images/FILM/tape-top.webp" alt=""><span class="top-label"><img src="${t.still}" alt=""><b>${t.title}</b><small>${t.sub ? t.sub + " · " : ""}${t.year} · ${t.run}</small></span></span>` +
      `</span></button>`;
    shelf.appendChild(li);
    t.holder = li; t.tape = li.querySelector('.tape'); t.cube = li.querySelector('.cube');
  });

  /* ---------- Motion helpers ---------- */
  const REST_T = 'translate(0px, 0px) scale(1)', REST_C = 'rotateY(0deg) rotateX(0deg)';
  const EASE = 'cubic-bezier(.45,.05,.2,1)';
  async function anim(el, to, ms, ease = EASE) {
    const from = el._tf || (el.classList.contains('cube') ? REST_C : REST_T);
    if (from === to) return;
    const a = el.animate([{ transform: from }, { transform: to }], { duration: reduce ? 1 : ms, easing: ease, fill: 'forwards' });
    try { await a.finished; } catch (e) { /* cancelled */ }
    el.style.transform = to; el._tf = to; a.cancel();
  }
  const settle = t => { t.tape.style.transform = ''; t.tape._tf = REST_T; t.cube.style.transform = ''; t.cube._tf = REST_C; };

  function geom(i) {
    const h = TAPES[i].holder.getBoundingClientRect(), s = slot.getBoundingClientRect(), d = deck.getBoundingClientRect();
    return { hx: h.left + h.width / 2, hy: h.top + h.height / 2, sx: s.left + s.width / 2, sy: s.top + s.height / 2, W: h.width, H: h.height, D: h.height * 3.857, deckTop: d.top, slotW: s.width,
      inScale: clamp(s.width * 0.9 / h.width, .5, .92) };
  }
  const tf = (dx, dy, s = 1) => `translate(${dx.toFixed(1)}px, ${dy.toFixed(1)}px) scale(${s})`;
  const spin = (y, x) => `rotateY(${y}deg) rotateX(${x}deg)`;

  /* Lift the tape out of the shelf, turn its label to face you, turn it flat and slide it behind the deck door. */
  async function insert(i) {
    const t = TAPES[i], g = geom(i);
    t.tape.classList.remove('is-rest'); t.tape.classList.add('moving');
    deck.classList.add('open');
    const heroY = g.deckTop - (g.D * 1.4) / 2 - 24 - g.hy;
    await Promise.all([anim(t.tape, tf(g.sx - g.hx, heroY, 1.4), 780), anim(t.cube, spin(-16, -90), 780)]);
    await anim(t.cube, spin(14, -90), 820, 'cubic-bezier(.4,0,.3,1)');
    await Promise.all([anim(t.tape, tf(g.sx - g.hx, g.sy - g.hy - g.H * 2.2, 1), 600), anim(t.cube, REST_C, 600)]);
    await anim(t.tape, tf(g.sx - g.hx, g.sy - g.hy, g.inScale), 400, 'cubic-bezier(.5,0,.8,.4)');
    t.tape.classList.remove('moving'); t.tape.classList.add('in-deck');
    t.holder.classList.add('empty');
    deck.classList.remove('open'); deck.classList.add('live');
    S.cur = i; updateInfo();
  }

  /* Pop the tape out of the slot. Resolves once it is clear of the deck; the flight home continues in `homing`. */
  async function ejectCurrent() {
    const i = S.cur, t = TAPES[i], g = geom(i);
    S.cur = null; updateInfo(); player.stop();
    showBlue('EJECT ⏏', ''); deckState('EJECT');
    deck.classList.add('open');
    await sleep(260);
    await anim(t.tape, tf(g.sx - g.hx, g.sy - g.hy - g.H * 2.2), 400, 'cubic-bezier(.2,.7,.3,1)');
    t.tape.classList.add('moving'); t.tape.classList.remove('in-deck');
    const homing = (async () => {
      await Promise.all([anim(t.tape, REST_T, 780), anim(t.cube, REST_C, 780)]);
      settle(t); t.tape.classList.remove('moving'); t.tape.classList.add('is-rest'); t.holder.classList.remove('empty');
    })();
    return { homing };
  }

  function placeInstant(i) {
    const t = TAPES[i], g = geom(i);
    t.tape.classList.remove('is-rest'); t.tape.classList.add('in-deck');
    t.tape.style.transform = tf(g.sx - g.hx, g.sy - g.hy, g.inScale); t.tape._tf = t.tape.style.transform;
    t.holder.classList.add('empty'); deck.classList.add('live');
  }

  async function run(i) {
    S.busy = true;
    warm(TAPES[i]); // start fetching the film while the tape is still on its way
    try {
      let homing = Promise.resolve();
      if (S.cur !== null) { homing = (await ejectCurrent()).homing; }
      else showBlue('NO TAPE', 'INSERT A TAPE');
      await insert(i);
      startPlayback(i);
      await homing;
    } finally { S.busy = false; }
    const q = S.queue; S.queue = null;
    if (q !== null && q !== S.cur) run(q);
  }
  const request = i => { if (i === S.cur) return; if (S.busy) S.queue = i; else run(i); };
  async function ejectOnly() {
    if (S.cur === null || S.busy) return;
    S.busy = true;
    const { homing } = await ejectCurrent();
    deck.classList.remove('open'); deck.classList.remove('live');
    setTimeout(() => showBlue('NO TAPE', 'INSERT A TAPE'), 500);
    await homing; S.busy = false;
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
        vid.src = t.src; vid.currentTime = 0;
        vid.muted = S.vol === 0; vid.volume = gain();
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
    const muted = S.vol === 0 || S.muteBlocked;
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
    if (!S.on) player.pause();
  }

  /* ---------- Hardware: VOL +/- keys, TUNE knob, POWER ---------- */
  const KNOB0 = 54; // where the pointer line sits in the photograph, in degrees from straight up
  const ring = $('#tune-ring');
  (function drawRing() {
    let h = '';
    for (let k = 0; k < LOOKS.length; k++) {
      const a = (-120 + k * 60) * Math.PI / 180, c = Math.cos(a), s = Math.sin(a);
      h += `<line data-k="${k}" x1="${(33 * s).toFixed(2)}" y1="${(-33 * c).toFixed(2)}" x2="${(41 * s).toFixed(2)}" y2="${(-41 * c).toFixed(2)}"/>`;
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
    if (announce) { showLook(); staticBurst(220, .45); }
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
    slice($('#tv-power'), .7643, .6181); // the same key as the one above, copied from the photograph
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
    if (S.cur !== null && !S.busy) deckState(!S.on ? 'STOP' : player.playing ? 'PLAY' : 'PAUSE');
    if (tm !== null && osdTime.classList.contains('on')) osdTime.textContent = fmt(tm);
  }, 250);

  function playPause() {
    if (S.cur === null || !S.on) return;
    player.toggle();
    setTimeout(() => {
      if (player.playing) { showState('PLAY ▶'); osdTime.classList.remove('on'); }
      else { showState('PAUSE ❚❚', { sticky: true }); osdTime.classList.add('on'); }
    }, 80);
  }
  function seek(d) {
    if (S.cur === null || !S.on) return;
    player.seek(d); showState(d < 0 ? '◀◀ REW' : '▶▶ FF', { ms: 900 });
  }
  function power() {
    S.on = !S.on;
    body.classList.toggle('is-off', !S.on);
    screen.classList.remove('on', 'off'); void screen.offsetWidth; screen.classList.add(S.on ? 'on' : 'off');
    if (S.on) { staticBurst(500, .8); if (S.cur !== null) player.play(); } else player.pause();
  }
  screen.addEventListener('click', () => { if (unlockSound()) return; playPause(); });
  screen.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); playPause(); } });
  $('#tv-power').addEventListener('click', power);
  $('#full').addEventListener('click', () => openTheater());
  document.querySelectorAll('.deck-btn').forEach(b => b.addEventListener('click', () => ({ play: playPause, rew: () => seek(-5), ff: () => seek(5), eject: ejectOnly })[b.dataset.act]()));

  /* ---------- Info row ---------- */
  function updateInfo() {
    const t = S.cur === null ? null : TAPES[S.cur];
    $('#i-no').textContent = t ? `${pad(S.cur + 1)} / ${pad(TAPES.length)}` : `— / ${pad(TAPES.length)}`;
    $('#i-title').textContent = t ? nameOf(t) : '—';
    $('#i-year').textContent = t ? t.year : '—';
    $('#i-run').textContent = t ? `${t.run} · AI film` : '—';
  }

  /* ---------- Full screen: the film alone on black ---------- */
  const film = $('#film'), frame = $('#filmframe'), theater = document.querySelector('.theater');
  function openTheater() {
    if (!S.on) return power();
    if (S.cur === null) { showBlue('NO TAPE', 'INSERT A TAPE'); return; }
    const t = TAPES[S.cur], at = player.time() || 0;
    $('#t-no').textContent = `TAPE ${pad(S.cur + 1)}`; $('#t-title').textContent = nameOf(t); $('#t-name').textContent = nameOf(t);
    $('#t-year').textContent = t.year; $('#t-run').textContent = `${t.run} · AI film`;
    theater.style.setProperty('--ratio', t.ratio);
    player.pause();
    body.classList.add('watching'); body.classList.toggle('vimeo', !!t.vimeo);
    if (t.vimeo) { frame.src = `${VIMEO}/video/${t.vimeo}?title=0&byline=0&portrait=0&autoplay=1&autopause=0#t=${Math.floor(at)}s`; return; }
    film.src = t.src; film.currentTime = at; film.volume = gain(); film.muted = false;
    film.play().catch(() => { film.muted = true; film.play(); });
  }
  function closeTheater() {
    const at = film.currentTime;
    film.pause(); film.removeAttribute('src'); frame.removeAttribute('src');
    body.classList.remove('watching', 'vimeo');
    if (S.cur !== null && !player.isVimeo) vid.currentTime = at;
    player.play();
  }
  film.addEventListener('timeupdate', () => { $('#progress').style.width = `${(film.currentTime / (film.duration || 1)) * 100}%`; });
  film.addEventListener('click', () => (film.paused ? film.play() : film.pause()));
  $('#back').addEventListener('click', closeTheater);

  /* ---------- Keyboard ---------- */
  addEventListener('keydown', e => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (body.classList.contains('watching')) { if (e.key === 'Escape') closeTheater(); return; }
    const onBody = e.target === document.body, k = e.key.toLowerCase();
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      const n = TAPES.length, step = e.key === 'ArrowRight' ? 1 : -1;
      request(S.cur === null ? 0 : (S.cur + step + n) % n);
    } else if (e.key === 'ArrowUp') { e.preventDefault(); setVol(S.vol + 1); }
    else if (e.key === 'ArrowDown') { e.preventDefault(); setVol(S.vol - 1); }
    else if (e.key === ' ' && onBody) { e.preventDefault(); playPause(); }
    else if ((e.key === 'Enter' || k === 'f') && onBody) openTheater();
    else if (k === 'e' && onBody) ejectOnly();
    else if (k === 'm' && onBody) setVol(S.vol === 0 ? 6 : 0);
    else if (k === 'p' && onBody) power();
    else if (k === 't' && onBody) setLook((S.look + 1) % LOOKS.length);
  });

  /* ---------- Start: the first tape is already in the deck and playing ---------- */
  function boot() {
    fitSlices(); paintLook(); updateInfo();
    placeInstant(0); S.cur = 0; updateInfo();
    startPlayback(0);
  }
  addEventListener('resize', () => {
    fitSlices();
    if (S.cur !== null && !S.busy) { const g = geom(S.cur), t = TAPES[S.cur]; t.tape.style.transform = tf(g.sx - g.hx, g.sy - g.hy, g.inScale); t.tape._tf = t.tape.style.transform; }
  });
  if (document.readyState === 'complete') boot(); else addEventListener('load', boot);
})();
