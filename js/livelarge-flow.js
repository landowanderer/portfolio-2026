/* LiveLarge user flow: three key moments from the full flow, shown as straight cuts.

   References
   - Cuts: straight cuts with no transition, between three frames of the same diagram at the same scale,
     so each cut reads as "the next moment" rather than a camera move.
   - Captions change with the shot and go blank for two frames (about 83 ms at 24 fps) on either side of
     the cut, following Netflix's timed-text rule for subtitles at shot changes.
   - Shot length: reading time at 20 characters per second (Netflix's limit for adult subtitles) plus one
     second to find the marked node; never under 3 s.
   - Progress: a segmented bar that fills linearly, the pattern story players use for auto-advancing content.
   - Pauses on hover (WAI-ARIA carousel pattern), off screen and in background tabs. With reduced motion or
     without JS, the three frames are shown as a plain list. */
(() => {
  const root = document.querySelector('[data-flow-tour]');
  if (!root) return;

  const list = root.querySelector('.ll-flow-shots');
  const shots = [...root.querySelectorAll('.ll-flow-shot')];
  const bars = [...root.querySelectorAll('.ll-flow-progress i')];
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  const GAP = 83;
  const durations = shots.map(li => Math.max(3000, 1000 + li.querySelector('p').textContent.trim().length * 50));

  let index = 0, elapsed = 0, last = 0, raf = 0;
  let playing = false, visible = false, hovered = false;

  const show = i => {
    index = i;
    elapsed = 0;
    shots.forEach((li, n) => li.classList.toggle('is-on', n === i));
    bars.forEach((bar, n) => bar.style.setProperty('--p', n < i ? 1 : 0));
  };

  const frame = now => {
    raf = 0;
    if (!playing) return;
    elapsed += Math.min(now - last, 100);
    last = now;
    if (elapsed >= durations[index]) show((index + 1) % shots.length);
    const dur = durations[index];
    bars[index].style.setProperty('--p', Math.min(elapsed / dur, 1));
    shots[index].classList.toggle('is-quiet', elapsed < GAP || elapsed > dur - GAP);
    raf = requestAnimationFrame(frame);
  };

  const sync = () => {
    const go = root.classList.contains('is-live') && visible && !hovered && !document.hidden;
    if (go && !playing) { playing = true; last = performance.now(); raf = requestAnimationFrame(frame); }
    else if (!go && playing) { playing = false; cancelAnimationFrame(raf); raf = 0; }
  };

  const setMode = () => {
    root.classList.toggle('is-live', !reduced.matches);
    show(0);
    sync();
  };

  if ('IntersectionObserver' in window) {
    new IntersectionObserver(entries => entries.forEach(entry => {
      visible = entry.isIntersecting;
      sync();
    }), { threshold: 0.5 }).observe(list);
  } else visible = true;

  root.addEventListener('pointerenter', e => { if (e.pointerType === 'mouse') { hovered = true; sync(); } });
  root.addEventListener('pointerleave', e => { if (e.pointerType === 'mouse') { hovered = false; sync(); } });
  document.addEventListener('visibilitychange', sync);
  reduced.addEventListener?.('change', setMode);
  setMode();
})();
