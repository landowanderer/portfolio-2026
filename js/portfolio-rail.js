/* Contents rail: one grey marker on the track, one text line tall, at the current chapter.
   The pages mark the current link with aria-current; this only follows it. CSS does the glide. */
(() => {
  document.querySelectorAll('.ll-rail ol, .fb-rail ol').forEach(ol => {
    const place = () => {
      const a = ol.querySelector('a[aria-current]');
      if (!a || !a.offsetParent) { ol.style.setProperty('--rail-on', '0'); return; }
      const cs = getComputedStyle(a);
      const top = a.getBoundingClientRect().top - ol.getBoundingClientRect().top + parseFloat(cs.paddingTop);
      ol.style.setProperty('--rail-y', `${top}px`);
      ol.style.setProperty('--rail-h', `${a.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom)}px`);
      ol.style.setProperty('--rail-on', '1');
      // The first placement lands without a glide; later ones glide.
      if (!ol.classList.contains('rail-ready')) requestAnimationFrame(() => requestAnimationFrame(() => ol.classList.add('rail-ready')));
    };
    new MutationObserver(place).observe(ol, { subtree: true, childList: true, attributes: true, attributeFilter: ['aria-current'] });
    window.addEventListener('resize', place, { passive: true });
    if (document.fonts) document.fonts.ready.then(place);
    place();
  });
})();
