# FILM page — handoff (2026-10-20)

The FILM page is `film.html` at the site root, linked from every page's header and end bar (WORK · FILM · EXPERIMENTS). Not merged into `main`.

Files: `film.html`, `css/film.css`, `js/film.js`, `images/FILM/` (photographs and label stills), `videos/film/` (local films).
`film-draft/white.html` is the earlier static white version, kept for reference only.

## Preview

The page plays local video, so open it through a local server:

```
cd portfolio-2026
npx http-server -p 8080
```

Then open http://localhost:8080/film.html

## How it works

- Every film is a VHS tape on a shelf beside the television. Clicking a tape lifts it out, turns its label to face you (the tape is a real 3D box, faces are photographs), turns it flat and slides it behind the deck door; the film plays on the set. Clicking another tape ejects the current one first.
- The first tape (Specimen) is already in the deck and playing when the page opens.
- Hardware, with names printed on it: TUNE knob (picture texture), VOL + / VOL − keys, POWER. Deck: REW, PLAY/PAUSE, FF, EJECT. Clicking the screen also plays/pauses. "Full screen" (bottom right) shows the film alone on black; Esc returns.
- TUNE steps through five picture textures: CLEAN, CRT, VHS (colour smear, tracking bands), GHOST (second faint picture, grain), MONO. Turn the knob, scroll on it, click its right/left side, or press T.
- VOL + / − hold to repeat. The on-screen display is green like an old set (VOLUME with ten blocks, MUTE, TUNE with five blocks, PLAY ▶, PAUSE ❚❚, LOADING).
- Keyboard: ← → previous/next tape, ↑ ↓ volume, T tune, Space play/pause, E eject, M mute, F or Enter full screen, P power.
- Browsers do not allow sound before the first click. If that happens the screen says SOUND OFF · CLICK THE SCREEN. After any click, tapes play with sound.

## Photographs (OpenArt, GPT Image 2.5 Sunburst, 4K high quality)

`tv-black.jpg` (TV), `deck.webp` (tape deck), `tape-top.webp`, `tape-spine.webp` (blank tape faces). Same prompt structure for all, style header first:

```
STYLE: Low-key studio product photograph, photorealistic — not a 3D render, not CGI.
Medium-format camera, 100mm lens, f/8. Pure black seamless backdrop (#000).
Lighting: long soft strip light above and slightly behind, thin highlight along the
top edge; faint cool rim light on the right; very soft low front fill.
SUBJECT: …
RULES: no logos, no brand names, no text, …
```

Titles, years and stills are printed live onto the blank paper labels (multiply blend), so adding a work needs no new photograph. Label positions were measured from the photographs: spine label at 13.1% / 13% / 73.8% / 75.5% (left, top, width, height), top label at 28.8% / 30.8% / 42.2% / 44.7%. If a photograph is regenerated, re-measure these in `css/film.css`. The tape box proportions (`--H`, `--D`) come from the photographs too.
Deck hot spots (percent of `deck.webp`): door 9.3 / 18.6 / 63 / 45.8, display 74.4 / 18.6 / 21.9 / 31.2, four keys at left 74.5, 80.1, 85.7, 91.2 and top 58.6.
TV: screen window left 22.9, top 22.8, width 45.3, height 47.3 (percent). Knob centre 76.43 / 47.62, VOL keys at 56.76 and 61.81, POWER key (a copy of the key photograph) at 72. The knob and POWER key show slices of the TV photograph.

## Tapes (edit `TAPES` at the top of `js/film.js`)

| # | Title | Source |
|---|---|---|
| 1 | Specimen | `videos/film/specimen.mp4` |
| 2 | Fitcheck | `videos/film/fitcheck.mp4` (web re-encode of Higgsfield_Task_Xingsheng.mp4, 1080p, 9 MB) |
| 3 | Artificial Atmosphere — LA RAIN (02:53, 2025) | Vimeo 1149379087 |
| 4 | Artificial Atmosphere — FOG (01:30, 2026) | Vimeo 1182815311 |

To add a work: add an entry (title, sub, year, run, src or vimeo, still, accent) and a label still in `images/FILM/`. The shelf, the info row and the keyboard pick it up. The stack is sized for about six tapes; past that, add a second stack or a grid below the set.

## Vimeo (long films)

- Each Vimeo tape gets one hidden, paused embed the moment you point at or click the tape, so it is usually ready by the time the tape is in the deck. `player.vimeo.com` is preconnected in the head. Snow plays on the screen while the first frame loads.
- Sound, volume (VOL keys), play/pause, rewind/forward and the deck's time counter all go through Vimeo's embed messages (`api=1`). Checked in the browser: unmuting, volume changes and the progress counter work.
- Vimeo's "domain-level privacy" must allow landowanderer.com (it already does for the project page).
- The full-screen view uses Vimeo's own player with controls.

## GitHub limits for local video

- A file over 100 MB is rejected on push (warning at 50 MB). Keep each film well under that.
- Keep the whole repo under about 1 GB (the pack is already about 260 MB) and the published site under 1 GB. Every committed re-export stays in history, so commit a final encode, not drafts.
- GitHub Pages does not serve Git LFS files; use plain files.
- Encode: H.264, `-movflags +faststart`, about 1080p at 2.5–4 Mbps.
- For the two Artificial Atmosphere films, Vimeo is the better home: it streams adaptively, so the site stays light.

## Open

- Fitcheck: confirm it can be shown publicly.
- Social accounts: which platforms and handles (links are `#` for now).
- The reusable preset library for shots and prompts lives in `../ai-film-presets` (separate folder; not on GitHub yet).
