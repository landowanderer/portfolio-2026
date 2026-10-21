# FILM page — draft handoff (2026-10-20)

Draft of the new FILM page for landowanderer.com. Not linked from the site and not merged into `main`.

## Preview

The page plays local video, so open it through a local server, not by double-clicking:

```
cd portfolio-2026
npx http-server -p 8080        # or: python -m http.server 8080
```

Then open http://localhost:8080/film-draft/ (black version) or http://localhost:8080/film-draft/white.html (earlier white version, static).

## What is decided

- FILM is a page on landowanderer.com (same domain, same tab), between WORK and EXPERIMENTS.
- A 1980s charcoal TV with a simplified remote. The page is black.
- Three controls, same names on the set and on the remote: TUNE (knob / up-down), POWER, WATCH.
  - Knob: click = next channel; drag = tune continuously, static between channels.
  - WATCH opens the film alone on black, with sound, no TV effects. Esc returns.
  - Keyboard: left/right tune, Enter watch.
- The 1-4 number keys were removed from the remote.
- Only finished, best work goes on a channel. Channels now: 01 Specimen, 02 Fitcheck (in edit), 03 Contact.
- Information row in four columns (channel, title, year, runtime), Workbyworks-style; no giant numeral.

## Open

- Fitcheck (Higgsfield) file: download from Drive (FITCHECK / 01_Deliverables) and confirm it can be shown publicly.
- Confirm `specimen.mp4` (= Downloads/视频2_成片_v15.mp4) is the Specimen film.
- Social accounts: which platforms and handles.
- Remote layout: the gap between POWER and the up-down rocker could be rebalanced (regenerate, about 250 OpenArt credits).

## Assets

`tv-black.jpg`, `remote-black.jpg`: GPT Image 2.5 Sunburst on OpenArt, quality high, 4K tier, image-to-image from the white studio shots. Full-size originals stay in the OpenArt project history.

Screen window on the TV image (percent of the image): left 22.9, top 22.8, width 45.3, height 47.3. Knob centre 76.43 / 47.62, buttons at 56.76 and 61.81, LED at 66.

Prompt structure that worked (style header first, then subject, then rules):

```
STYLE: Low-key studio product photograph, photorealistic — not a 3D render, not CGI.
Medium-format camera, 100mm lens, f/8. Pure black seamless backdrop (#000).
Lighting: long soft strip light above and slightly behind, thin highlight along the
top edge; faint cool rim light on the right; very soft low front fill.
SUBJECT: …
RULES: no logos, no brand names, no text, nothing else in frame.
```

The reusable preset library for shots and prompts lives in `../ai-film-presets` (separate folder).
