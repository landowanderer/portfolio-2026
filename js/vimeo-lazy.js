/*!
 * media-lazy — poster-first video, self-hosted where it pays off.
 *
 * A Vimeo iframe needs five sequential round trips (iframe doc -> player
 * bundle -> config -> HLS manifest -> first segments) before it paints one
 * frame. Those are latency, not bandwidth, so a 5G phone waits about as long
 * as a 4G one. Nothing is requested from Vimeo up front. Instead:
 *
 *   - every slot shows a poster frame immediately
 *   - self-hosted clips (data-video) are one same-origin GET: first frame in
 *     roughly 200-400ms instead of 2-4s
 *   - silent decorative loops build as they near the viewport and pause once
 *     they scroll away
 *   - full videos with sound wait for a click, so the Vimeo SDK never loads
 *   - Save-Data, 2G and prefers-reduced-motion get the poster and nothing else
 */
(function () {
    'use strict';

    var slots = document.querySelectorAll('.vimeo-lazy');
    if (!slots.length) return;

    var conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection || {};
    var saveData = conn.saveData === true;
    var slowLink = /2g/.test(conn.effectiveType || '');
    var reducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var skipDecorative = saveData || slowLink || reducedMotion;
    var smallScreen = window.matchMedia && window.matchMedia('(max-width: 767px)').matches;

    var pending = [];   // iframe slots waiting for a paint signal

    function post(frame, method, value) {
        try {
            frame.contentWindow.postMessage(
                JSON.stringify(value === undefined ? { method: method }
                                                   : { method: method, value: value }), '*');
        } catch (e) {}
    }

    function hidePoster(poster) {
        if (!poster || poster.dataset.gone) return;
        poster.dataset.gone = '1';
        poster.style.opacity = '0';
        setTimeout(function () { if (poster.parentNode) poster.remove(); }, 500);
    }

    window.addEventListener('message', function (e) {
        if (e.origin !== 'https://player.vimeo.com') return;
        var data;
        try { data = typeof e.data === 'string' ? JSON.parse(e.data) : e.data; } catch (err) { return; }
        if (!data) return;
        for (var i = pending.length - 1; i >= 0; i--) {
            var entry = pending[i];
            if (entry.frame.contentWindow !== e.source) continue;
            if (data.event === 'ready') {
                post(entry.frame, 'addEventListener', 'playing');
                post(entry.frame, 'addEventListener', 'timeupdate');
            } else if (data.event === 'playing' || data.event === 'timeupdate' || data.event === 'play') {
                hidePoster(entry.poster);
                pending.splice(i, 1);
            }
        }
    });

    var supported = typeof IntersectionObserver !== 'undefined';

    // Decorative loops shouldn't all run at once on a long page.
    var idleObserver = supported && new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
            var el = entry.target;
            if (el.tagName === 'VIDEO') {
                if (entry.isIntersecting) { var p = el.play(); if (p && p.catch) p.catch(function () {}); }
                else el.pause();
            } else {
                post(el, entry.isIntersecting ? 'play' : 'pause');
            }
        });
    }, { rootMargin: '200px 0px' });

    // --- self-hosted ------------------------------------------------------
    function source(src, type) {
        var el = document.createElement('source');
        el.src = src;
        el.type = type;
        return el;
    }

    function mountVideo(el, withSound) {
        var suffix = (smallScreen && el.getAttribute('data-video-sm')) ? '-sm' : '';
        var mp4 = el.getAttribute('data-video' + suffix);
        var webm = el.getAttribute('data-video' + suffix + '-webm');
        var poster = el.querySelector('.vimeo-lazy__poster');
        var video = document.createElement('video');

        video.className = 'vimeo-lazy__frame';
        video.setAttribute('playsinline', '');
        video.preload = 'auto';
        if (withSound) {
            video.controls = true;
            video.autoplay = true;
        } else {
            video.muted = true;
            video.loop = true;
            video.setAttribute('muted', '');
            video.setAttribute('aria-hidden', 'true');
        }
        video.addEventListener('playing', function () { hidePoster(poster); }, { once: true });
        video.addEventListener('loadeddata', function () {
            if (withSound) hidePoster(poster);
        }, { once: true });

        // WebM first where it is actually smaller; MP4 is the universal fallback.
        if (webm) video.appendChild(source(webm, 'video/webm'));
        video.appendChild(source(mp4, 'video/mp4'));
        el.appendChild(video);

        if (!withSound) {
            var p = video.play();
            if (p && p.catch) p.catch(function () {});
            if (idleObserver) idleObserver.observe(video);
        }
        return video;
    }

    // --- Vimeo ------------------------------------------------------------
    function mountFrame(el, extraParams) {
        var src = el.getAttribute('data-vimeo-src');
        if (extraParams) src += (src.indexOf('?') === -1 ? '?' : '&') + extraParams;

        var poster = el.querySelector('.vimeo-lazy__poster');
        var frame = document.createElement('iframe');
        frame.src = src;
        frame.title = el.getAttribute('data-vimeo-title') || 'Video';
        frame.className = 'vimeo-lazy__frame';
        frame.setAttribute('allow', el.getAttribute('data-vimeo-allow') || 'autoplay; fullscreen; picture-in-picture');
        frame.setAttribute('frameborder', '0');
        if (el.hasAttribute('data-vimeo-fullscreen')) frame.setAttribute('allowfullscreen', '');

        if (poster) {
            pending.push({ frame: frame, poster: poster });
            frame.addEventListener('load', function () {
                setTimeout(function () { hidePoster(poster); }, 2500);
            });
        }
        el.appendChild(frame);
        if (idleObserver && /[?&]background=1/.test(src)) idleObserver.observe(frame);
        return frame;
    }

    function mount(el, withSound) {
        if (el.dataset.mounted) return;
        el.dataset.mounted = '1';
        return el.hasAttribute('data-video') ? mountVideo(el, withSound)
                                             : mountFrame(el, withSound ? 'autoplay=1' : '');
    }

    // --- full videos with sound: wait for a click -------------------------
    function makeClickToPlay(el) {
        var button = document.createElement('button');
        button.type = 'button';
        button.className = 'vimeo-lazy__play';
        button.setAttribute('aria-label', 'Play ' + (el.getAttribute('data-vimeo-title') || 'video'));
        button.innerHTML = '<span class="vimeo-lazy__play-icon" aria-hidden="true"></span>';
        button.addEventListener('click', function () {
            button.disabled = true;
            button.classList.add('is-gone');
            mount(el, true);
            setTimeout(function () { if (button.parentNode) button.remove(); }, 400);
        });
        el.appendChild(button);
        el.classList.add('vimeo-lazy--click');
    }

    var autoSlots = [];
    Array.prototype.forEach.call(slots, function (el) {
        if (el.closest && el.closest('.vimeo-scroll-player')) makeClickToPlay(el);
        else autoSlots.push(el);
    });

    // Save-Data, 2G, or reduced motion: the poster is the whole experience.
    if (skipDecorative || !autoSlots.length) return;

    if (!supported) {
        autoSlots.forEach(function (el) { mount(el); });
        return;
    }

    function startAutoLoops() {
        var mountObserver = new IntersectionObserver(function (entries) {
            entries.forEach(function (entry) {
                if (!entry.isIntersecting) return;
                mountObserver.unobserve(entry.target);
                mount(entry.target);
            });
        }, { rootMargin: '600px 0px' });
        autoSlots.forEach(function (el) { mountObserver.observe(el); });
    }

    // Let the page's own text and images finish first.
    function whenIdle() {
        if (window.requestIdleCallback) requestIdleCallback(startAutoLoops, { timeout: 2000 });
        else setTimeout(startAutoLoops, 300);
    }

    if (document.readyState === 'complete') whenIdle();
    else window.addEventListener('load', whenIdle);
}());
