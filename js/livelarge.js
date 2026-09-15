/* Optional media mapping. Add local repo paths; no new dependency or CMS needed.
   Keep src empty until an approved asset exists. Image/video errors retain the slot.
   Example: hero: { src: 'images/LIVELARGE/homepage.webp', alt: '...', type: 'image' }
   For videos: { src: '...', type: 'video', poster: '...', alt: '...' }
*/
const LIVELARGE_MEDIA = {
  hero: { src: '', alt: 'LiveLarge homepage and AI entry', type: 'image' },
  entry: { src: '', alt: 'Page-aware entry', type: 'image' },
  recommendation: { src: '', alt: 'Recommendation experience', type: 'image' },
  'comparison-preview': { src: '', alt: 'Comparison preview', type: 'image' },
  'website-context': { src: '', alt: 'Existing website and user journey', type: 'image' },
  conversation: { src: '', alt: 'Progressive clarification', type: 'image' },
  'page-aware': { src: '', alt: 'Page-aware assistant', type: 'image' },
  comparison: { src: '', alt: 'Expanded comparison', type: 'image' },
  'follow-up': { src: '', alt: 'Follow-up request with context consent', type: 'image' },
  components: { src: '', alt: 'Chatbot components', type: 'image' },
  responsive: { src: '', alt: 'Responsive states', type: 'image' },
  before: { src: '', alt: 'Earlier design version', type: 'image' },
  after: { src: '', alt: 'Revised design version', type: 'image' },
  final: { src: '', alt: 'End-to-end walkthrough', type: 'video' }
};

(() => {
  'use strict';
  const sections = [...document.querySelectorAll('.ll-story > section[data-chapter]')];
  const nav = document.getElementById('chapter-links');
  const select = document.getElementById('chapter-select');
  if (!nav || !select || !sections.length) return;
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const byId = new Map(sections.map(section => [section.id, section]));
  const fragment = document.createDocumentFragment();
  select.replaceChildren();
  // The order in the HTML is the source of truth, not a second chapter list.
  sections.forEach(section => {
    const link = document.createElement('a');
    link.href = `#${section.id}`;
    link.textContent = section.dataset.chapter;
    fragment.append(link);
    const option = document.createElement('option');
    option.value = section.id;
    option.textContent = section.dataset.chapter;
    select.append(option);
  });
  nav.replaceChildren(fragment);
  const links = [...nav.querySelectorAll('a')];
  document.querySelector('.ll-mobile-contents').hidden = false;
  document.body.classList.add('is-enhanced');
  let current = '';
  let frameRequested = false;
  const stickyOffset = () => {
    const styles = getComputedStyle(document.body);
    return parseFloat(styles.getPropertyValue('--ll-header-height')) +
      parseFloat(styles.getPropertyValue('--ll-index-height')) + 34;
  };
  function setActive(id) {
    if (current === id || !byId.has(id)) return;
    current = id;
    select.value = id;
    links.forEach(link => {
      const active = link.getAttribute('href') === `#${id}`;
      if (active) link.setAttribute('aria-current', 'location');
      else link.removeAttribute('aria-current');
    });
    // Move only the horizontally overflowing index, never the whole page.
    const active = links.find(link => link.getAttribute('aria-current'));
    if (active && nav.offsetWidth) {
      const a = active.getBoundingClientRect();
      const n = nav.getBoundingClientRect();
      if (a.left < n.left || a.right > n.right) {
        nav.scrollLeft += a.left - n.left - (n.width - a.width) / 2;
      }
    }
  }
  function syncPosition() {
    frameRequested = false;
    let visible = sections[0];
    const offset = stickyOffset();
    for (const section of sections) {
      if (section.querySelector('.ll-section-heading').getBoundingClientRect().top <= offset) visible = section;
      else break;
    }
    setActive(visible.id);
  }
  function queueSync() {
    if (frameRequested) return;
    frameRequested = true;
    requestAnimationFrame(syncPosition);
  }
  function navigate(id, push = true) {
    const target = byId.get(id);
    if (!target) return;
    if (push && location.hash !== `#${id}`) history.pushState(null, '', `#${id}`);
    target.focus({ preventScroll: true });
    const distance = Math.abs(target.getBoundingClientRect().top - parseFloat(getComputedStyle(target).scrollMarginTop));
    const instant = reducedMotion.matches || distance > window.innerHeight * 1.5;
    target.scrollIntoView({ block: 'start', behavior: instant ? 'instant' : 'smooth' });
    setActive(id);
  }
  nav.addEventListener('click', event => {
    const link = event.target.closest('a');
    if (!link || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
    const id = link.hash.slice(1);
    if (!byId.has(id)) return;
    event.preventDefault();
    navigate(id);
  });
  select.addEventListener('change', () => navigate(select.value));
  window.addEventListener('scroll', queueSync, { passive: true });
  window.addEventListener('resize', queueSync, { passive: true });
  window.addEventListener('popstate', () => {
    if (byId.has(location.hash.slice(1))) navigate(location.hash.slice(1), false);
    else { document.getElementById('top').scrollIntoView({ behavior: 'instant' }); queueSync(); }
  });
  window.addEventListener('hashchange', queueSync);
  if (byId.has(location.hash.slice(1))) requestAnimationFrame(() => navigate(location.hash.slice(1), false));
  else syncPosition();

  Object.entries(LIVELARGE_MEDIA).forEach(([key, asset]) => {
    if (!asset.src || /^(javascript|data):/i.test(asset.src)) return;
    const slot = document.querySelector(`[data-media="${key}"]`);
    if (!slot) return;
    const video = asset.type === 'video';
    const media = document.createElement(video ? 'video' : 'img');
    if (video) {
      media.controls = true;
      media.playsInline = true;
      media.preload = 'none';
      media.setAttribute('aria-label', asset.alt || slot.dataset.label);
      if (asset.poster) media.poster = asset.poster;
    } else {
      media.alt = asset.alt || slot.dataset.label;
      media.loading = key === 'hero' ? 'eager' : 'lazy';
      media.decoding = 'async';
      if (key === 'hero') media.fetchPriority = 'high';
    }
    // Keep a recoverable placeholder; no fake play buttons or unavailable iframes.
    const previous = [...slot.childNodes].map(node => node.cloneNode(true));
    media.addEventListener('error', () => {
      slot.replaceChildren(...previous);
      slot.classList.remove('has-media');
      slot.setAttribute('role', 'img');
      slot.setAttribute('aria-label', `${slot.dataset.label}: media unavailable`);
      queueSync();
    }, { once: true });
    media.src = asset.src;
    slot.replaceChildren(media);
    slot.classList.add('has-media');
    slot.removeAttribute('role');
    slot.removeAttribute('aria-label');
  });
})();
