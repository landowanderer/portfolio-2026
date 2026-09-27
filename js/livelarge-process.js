/* LiveLarge: drag-to-pan for the user flow, so it can be read in place without a new window. */
(() => {
  document.querySelectorAll('[data-flow-pan]').forEach((pan) => {
    const img = pan.querySelector('img');
    const start = (pan.dataset.start || '0,0').split(',').map(Number);
    const place = () => {
      const k = img.clientWidth / img.naturalWidth || 1;
      pan.scrollLeft = start[0] * k - pan.clientWidth * 0.2;
      pan.scrollTop = start[1] * k - pan.clientHeight * 0.2;
    };
    if (img.complete) place(); else img.addEventListener('load', place, { once: true });

    let down = null;
    pan.addEventListener('pointerdown', (e) => {
      if (e.pointerType !== 'mouse' || e.button !== 0) return;
      down = { x: e.clientX, y: e.clientY, l: pan.scrollLeft, t: pan.scrollTop };
      pan.setPointerCapture(e.pointerId);
      pan.classList.add('is-dragging');
    });
    pan.addEventListener('pointermove', (e) => {
      if (!down) return;
      pan.scrollLeft = down.l - (e.clientX - down.x);
      pan.scrollTop = down.t - (e.clientY - down.y);
    });
    const end = () => { down = null; pan.classList.remove('is-dragging'); };
    pan.addEventListener('pointerup', end);
    pan.addEventListener('pointercancel', end);
    const seen = () => pan.parentElement.classList.add('is-explored');
    ['pointerdown', 'wheel', 'touchstart', 'keydown'].forEach((t) => pan.addEventListener(t, seen, { once: true, passive: true }));
  });
})();
