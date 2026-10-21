/* Prints the VHS labels: a photograph of real paper, with the type put on it the way a press does.
   Used by tools/film-labels.html, which saves the results to images/FILM/labels/ (film.html only shows those images).
   The artwork is a mask; its edge is softened (dot gain) and broken up by the paper's own grain; ink is held back where
   fibres stand up (tooth); the density is a little under 100% and the ink is a warm black, not #000; the accent colour is
   a second pass that is slightly out of register; the cover still is a 45-degree halftone. */
(() => {
  'use strict';
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const MONO = '"SFMono-Regular", Menlo, Consolas, monospace', SANS = 'Geist, Arial, sans-serif';
  const loadImg = src => new Promise((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = rej; im.src = src; });
  const mk = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
  const rnd = n => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };

  function paperCrop(ctx, paper, w, h, seed, frac) {
    const sw = paper.width * frac, sh = sw * h / w;
    ctx.drawImage(paper, (paper.width - sw) * rnd(seed + 1), (paper.height - sh) * rnd(seed + 7), sw, sh, 0, 0, w, h);
  }
  function soften(mask, px) {
    const o = mk(mask.width, mask.height), x = o.getContext('2d');
    if ('filter' in x) x.filter = `blur(${px}px)`;
    x.drawImage(mask, 0, 0);
    return o;
  }
  function printInk(paperCtx, w, h, mask, rgb, { dx = 0, dy = 0, density = .92, tooth = .5, rough = .55 } = {}) {
    const P = paperCtx.getImageData(0, 0, w, h), M = mask.getContext('2d').getImageData(0, 0, w, h), p = P.data, m = M.data;
    let sum = 0, cnt = 0;
    for (let i = 0; i < p.length; i += 4 * 61) { sum += p[i] + p[i + 1] + p[i + 2]; cnt++; }
    const mean = sum / (cnt * 765);
    for (let y = 0; y < h; y++) {
      const sy = y - dy; if (sy < 0 || sy >= h) continue;
      for (let x = 0; x < w; x++) {
        const sx = x - dx; if (sx < 0 || sx >= w) continue;
        const a = m[(sy * w + sx) * 4 + 3] / 255; if (a < .02) continue;
        const i = (y * w + x) * 4, d = (p[i] + p[i + 1] + p[i + 2]) / 765 - mean;
        let c = a + (a < .98 ? d * rough * 7 : 0);            // the edge breaks up along the paper's grain
        c = c < 0 ? 0 : c > 1 ? 1 : c; c = c * c * (3 - 2 * c);
        const cov = c * density * (1 - tooth * Math.min(1, Math.max(0, d * 9)));   // held back on raised fibres
        const k = 1 - cov;
        p[i] *= k + cov * rgb[0] / 255; p[i + 1] *= k + cov * rgb[1] / 255; p[i + 2] *= k + cov * rgb[2] / 255;
      }
    }
    paperCtx.putImageData(P, 0, 0);
  }
  /* One plate of a halftone. plate: 'c', 'm', 'y', 'k' (process colour separation) or 'mono' (a single dark ink). */
  function halftone(mask, img, x, y, w, h, cell, angle, plate = 'mono') {
    const g = mk(Math.ceil(w / 2), Math.ceil(h / 2)), gx = g.getContext('2d');
    const ar = w / h, ir = img.width / img.height;
    let sw = img.width, sh = img.height, sx = 0, sy = 0;
    if (ir > ar) { sw = sh * ar; sx = (img.width - sw) / 2; } else { sh = sw / ar; sy = (img.height - sh) / 2; }
    gx.drawImage(img, sx, sy, sw, sh, 0, 0, g.width, g.height);
    const gd = gx.getImageData(0, 0, g.width, g.height).data, ctx = mask.getContext('2d');
    ctx.save(); ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip(); ctx.fillStyle = '#000';
    const a = angle * Math.PI / 180, ca = Math.cos(a), sa = Math.sin(a), diag = Math.hypot(w, h);
    for (let v = -diag; v < diag; v += cell) for (let u = -diag; u < diag; u += cell) {
      const px = x + w / 2 + u * ca - v * sa, py = y + h / 2 + u * sa + v * ca;
      if (px < x - cell || py < y - cell || px > x + w + cell || py > y + h + cell) continue;
      const ix = clamp(Math.floor((px - x) / 2), 0, g.width - 1), iy = clamp(Math.floor((py - y) / 2), 0, g.height - 1), gi = (iy * g.width + ix) * 4;
      const lift = v => Math.min(1, v / 255 * 1.25 + .03);   // stills are dark; open them up a little for print
      const r = lift(gd[gi]), gr = lift(gd[gi + 1]), b = lift(gd[gi + 2]);
      let dark;
      if (plate === 'mono') dark = 1 - (r * .3 + gr * .59 + b * .11);
      else {
        const k = 1 - Math.max(r, gr, b), d = 1 - k || 1;
        dark = plate === 'k' ? k * .85 : (plate === 'c' ? (1 - r - k) / d : plate === 'm' ? (1 - gr - k) / d : (1 - b - k) / d) * .92;
      }
      if (dark < .06) continue;
      ctx.beginPath(); ctx.arc(px, py, cell * .62 * Math.sqrt(dark), 0, 6.2832); ctx.fill();
    }
    ctx.restore();
  }
  const hexRgb = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
  const INK = [38, 33, 28];   // a worn warm black

  function spineLabel(t, i, paper) {
    const w = 2066, h = 274, c = mk(w, h), cx = c.getContext('2d');
    paperCrop(cx, paper, w, h, i * 3 + 1, .78);
    const k = mk(w, h), kx = k.getContext('2d'); kx.fillStyle = '#000';
    const right = (t.sub || t.year).toUpperCase();
    kx.font = `500 52px ${MONO}`; kx.textAlign = 'right';
    kx.fillText(right, w - 58, h * .62);
    const rw = kx.measureText(right).width;
    let size = 88; kx.textAlign = 'left';
    kx.font = `600 ${size}px ${SANS}`; if ('letterSpacing' in kx) kx.letterSpacing = `${size * .06}px`;
    const maxW = w - 74 - 58 - rw - 80, tw = kx.measureText(t.title.toUpperCase()).width;
    if (tw > maxW) { size *= maxW / tw; kx.font = `600 ${size}px ${SANS}`; if ('letterSpacing' in kx) kx.letterSpacing = `${size * .06}px`; }
    kx.fillText(t.title.toUpperCase(), 74, h * .5 + size * .36);
    const ac = mk(w, h), ax = ac.getContext('2d'); ax.fillStyle = '#000'; ax.fillRect(0, 0, 26, h);
    printInk(cx, w, h, soften(k, 1.5), INK, { density: .82, tooth: .7, rough: .75 });
    printInk(cx, w, h, soften(ac, 1.5), hexRgb(t.accent), { dx: 3, dy: 2, density: .72, tooth: .7 });   // second ink, slightly out of register
    return c;
  }
  function topLabel(t, i, paper, still) {
    const w = 1182, h = 628, pad = 54, c = mk(w, h), cx = c.getContext('2d');
    paperCrop(cx, paper, w, h, i * 3 + 2, .5);
    const k = mk(w, h), kx = k.getContext('2d'); kx.fillStyle = '#000';
    // title, wrapped to two lines at most
    const words = t.title.toUpperCase().split(' '), lines = [''];
    kx.font = `600 54px ${SANS}`; if ('letterSpacing' in kx) kx.letterSpacing = '3px';
    words.forEach(wd => { const trial = (lines[lines.length - 1] + ' ' + wd).trim(); if (kx.measureText(trial).width > w - pad * 2 && lines[lines.length - 1]) lines.push(wd); else lines[lines.length - 1] = trial; });
    lines.forEach((ln, n) => kx.fillText(ln, pad, 404 + n * 62));
    kx.font = `500 32px ${MONO}`; if ('letterSpacing' in kx) kx.letterSpacing = '2px';
    kx.fillText(`${t.sub ? t.sub + ' · ' : ''}${t.year} · ${t.run}`, pad, h - 44);
    const ac = mk(w, h), ax = ac.getContext('2d'); ax.fillStyle = '#000';
    ax.fillRect(0, 0, w, 18); ax.fillRect(pad, h - 100, 140, 7);
    // the cover still in four process inks, each plate screened at its own angle and laid down slightly out of register
    if (still) {
      const plates = [['y', 0, [238, 208, 86], -1, 2, .58], ['m', 75, [206, 70, 124], 2, 1, .62], ['c', 15, [40, 140, 190], 0, 0, .72], ['k', 45, INK, 1, -1, .85]];
      for (const [p, ang, ink, dx, dy, dens] of plates) {
        const pm = mk(w, h); halftone(pm, still, pad, 62, w - pad * 2, 262, 7, ang, p);
        printInk(cx, w, h, soften(pm, 1.2), ink, { dx, dy, density: dens, tooth: .6, rough: .6 });
      }
    }
    printInk(cx, w, h, soften(k, 1.5), INK, { density: .82, tooth: .7, rough: .75 });
    printInk(cx, w, h, soften(ac, 1.5), hexRgb(t.accent), { dx: 3, dy: -2, density: .72, tooth: .7 });
    return c;
  }

  window.FilmLabels = { spineLabel, topLabel };
})();
