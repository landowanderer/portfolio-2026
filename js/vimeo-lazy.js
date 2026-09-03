/*!
 * vimeo-lazy — defer Vimeo embeds until they approach the viewport.
 *
 * Placeholders look like:
 *   <div class="vimeo-lazy <original iframe classes>"
 *        data-vimeo-src="https://player.vimeo.com/video/..."
 *        data-vimeo-title="..." data-vimeo-allow="..." data-vimeo-fullscreen></div>
 *
 * Behaviour:
 *   - the real <iframe> is created only when the placeholder is within 300px of the viewport
 *   - decorative loops (background=1) are paused via postMessage once they scroll well away
 *   - the Vimeo SDK is fetched on demand, only for players inside .vimeo-scroll-player
 */
(function () {
    'use strict';

    var placeholders = document.querySelectorAll('.vimeo-lazy');
    if (!placeholders.length) return;

    var noop = function () {};
    var sdkPromise = null;

    function loadSdk() {
        if (sdkPromise) return sdkPromise;

        sdkPromise = new Promise(function (resolve, reject) {
            if (window.Vimeo && window.Vimeo.Player) return resolve(window.Vimeo);
            var script = document.createElement('script');
            script.src = 'https://player.vimeo.com/api/player.js';
            script.async = true;
            script.onload = function () { resolve(window.Vimeo); };
            script.onerror = reject;
            document.head.appendChild(script);
        });

        return sdkPromise;
    }

    function post(frame, method) {
        try {
            frame.contentWindow.postMessage(JSON.stringify({ method: method }), '*');
        } catch (e) {}
    }

    var supported = typeof IntersectionObserver !== 'undefined';

    // Keeps decorative loops from all playing at once on long pages.
    var idleObserver = supported && new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
            post(entry.target, entry.isIntersecting ? 'play' : 'pause');
        });
    }, { rootMargin: '200px 0px' });

    function attachScrollPlayer(frame) {
        loadSdk().then(function (Vimeo) {
            if (!Vimeo || !Vimeo.Player || !supported) return;

            var player = new Vimeo.Player(frame);
            var observer = new IntersectionObserver(function (entries) {
                entries.forEach(function (entry) {
                    if (entry.isIntersecting) {
                        player.setMuted(false).catch(noop);
                        player.play().catch(noop);
                    } else {
                        player.pause().catch(noop);
                    }
                });
            }, { threshold: 0.25 });

            observer.observe(frame);
        }).catch(noop);
    }

    function mount(el) {
        var src = el.getAttribute('data-vimeo-src');
        if (!src || el.dataset.vimeoMounted) return;
        el.dataset.vimeoMounted = '1';

        var frame = document.createElement('iframe');
        frame.src = src;
        frame.title = el.getAttribute('data-vimeo-title') || 'Video';
        frame.className = (el.getAttribute('class') || '').replace(/\bvimeo-lazy\b/g, '').trim();
        frame.setAttribute('allow', el.getAttribute('data-vimeo-allow') || 'autoplay; fullscreen; picture-in-picture');
        frame.setAttribute('frameborder', '0');
        if (el.hasAttribute('data-vimeo-fullscreen')) frame.setAttribute('allowfullscreen', '');

        var isScrollPlayer = el.closest && el.closest('.vimeo-scroll-player');

        if (el.replaceWith) el.replaceWith(frame);
        else if (el.parentNode) el.parentNode.replaceChild(frame, el);

        if (isScrollPlayer) attachScrollPlayer(frame);
        else if (idleObserver && /[?&]background=1/.test(src)) idleObserver.observe(frame);
    }

    if (!supported) {
        Array.prototype.forEach.call(placeholders, mount);
        return;
    }

    var mountObserver = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
            if (!entry.isIntersecting) return;
            mountObserver.unobserve(entry.target);
            mount(entry.target);
        });
    }, { rootMargin: '300px 0px' });

    Array.prototype.forEach.call(placeholders, function (el) { mountObserver.observe(el); });
}());
