/*!
 * vimeo-lazy — poster-first Vimeo embeds.
 *
 * A Vimeo iframe needs five sequential round trips (iframe doc -> player
 * bundle -> config -> HLS manifest -> first segments) before it paints one
 * frame: 1.5-3s on a fast line, 4-8s on mobile. So nothing Vimeo is requested
 * up front. Instead:
 *
 *   - every slot shows a ~15KB poster frame straight from Vimeo's image CDN
 *   - silent decorative loops (background=1) build their iframe as they near
 *     the viewport, and pause once they scroll well away
 *   - full videos with sound wait for a click, which also means the Vimeo
 *     player SDK is never needed and never loaded
 *
 * Markup:
 *   <div class="vimeo-lazy <original iframe classes>"
 *        data-vimeo-src="https://player.vimeo.com/video/..."
 *        data-vimeo-title="..." data-vimeo-allow="..." data-vimeo-fullscreen>
 *     <img class="vimeo-lazy__poster" src="https://i.vimeocdn.com/video/...">
 *   </div>
 */
(function () {
    'use strict';

    var placeholders = document.querySelectorAll('.vimeo-lazy');
    if (!placeholders.length) return;

    var pending = [];   // { frame, poster } awaiting a paint signal

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

    // Keeps a long page from running every decorative loop at once.
    var idleObserver = supported && new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
            post(entry.target, entry.isIntersecting ? 'play' : 'pause');
        });
    }, { rootMargin: '200px 0px' });

    function buildFrame(el, src) {
        var frame = document.createElement('iframe');
        frame.src = src;
        frame.title = el.getAttribute('data-vimeo-title') || 'Video';
        frame.className = 'vimeo-lazy__frame';
        frame.setAttribute('allow', el.getAttribute('data-vimeo-allow') || 'autoplay; fullscreen; picture-in-picture');
        frame.setAttribute('frameborder', '0');
        if (el.hasAttribute('data-vimeo-fullscreen')) frame.setAttribute('allowfullscreen', '');
        return frame;
    }

    function mount(el, extraParams) {
        var src = el.getAttribute('data-vimeo-src');
        if (!src || el.dataset.vimeoMounted) return;
        el.dataset.vimeoMounted = '1';

        if (extraParams) src += (src.indexOf('?') === -1 ? '?' : '&') + extraParams;

        var poster = el.querySelector('.vimeo-lazy__poster');
        var frame = buildFrame(el, src);

        if (poster) {
            pending.push({ frame: frame, poster: poster });
            // The player draws its own artwork anyway, so never strand the poster.
            frame.addEventListener('load', function () {
                setTimeout(function () { hidePoster(poster); }, 2500);
            });
        }

        el.appendChild(frame);
        if (idleObserver && /[?&]background=1/.test(src)) idleObserver.observe(frame);
        return frame;
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
            mount(el, 'autoplay=1');
            setTimeout(function () { if (button.parentNode) button.remove(); }, 400);
        });

        el.appendChild(button);
        el.classList.add('vimeo-lazy--click');
    }

    Array.prototype.forEach.call(placeholders, function (el) {
        if (el.closest && el.closest('.vimeo-scroll-player')) makeClickToPlay(el);
    });

    // --- decorative loops: build as they approach -------------------------
    var autoSlots = [];
    Array.prototype.forEach.call(placeholders, function (el) {
        if (!el.classList.contains('vimeo-lazy--click')) autoSlots.push(el);
    });

    if (!autoSlots.length) return;

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

    // Let the page's own text and images finish first; a decorative loop is
    // never worth competing with the content it decorates.
    function whenIdle() {
        if (window.requestIdleCallback) requestIdleCallback(startAutoLoops, { timeout: 2000 });
        else setTimeout(startAutoLoops, 300);
    }

    if (document.readyState === 'complete') whenIdle();
    else window.addEventListener('load', whenIdle);
}());
