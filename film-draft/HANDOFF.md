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

- Every film is a VHS tape on a shelf beside the television. Clicking a tape swings it toward the screen, tilted so you see the label in 3D (the tape is a real 3D box, faces are photographs), turns it flat and slides it behind the deck door (about 1.7 s); the film plays on the set. Clicking another tape ejects the current one first.
- The first tape (Specimen) is already in the deck and playing when the page opens.
- Hardware, with names printed on it: TUNE knob (picture texture), VOL + / VOL − keys, POWER. Deck: REW, PLAY/PAUSE, FF, EJECT. Clicking the screen also plays/pauses. There is no full-screen mode and no social links. Bottom left shows only the tape number, the title, the year and an Email link.
- TUNE steps through five picture textures: CLEAN, CRT, VHS (colour smear, tracking bands), GHOST (second faint picture, grain), MONO. Turn the knob, scroll on it, click its right/left side, or press T.
- VOL + / − hold to repeat. The on-screen display is green like an old set (VOLUME with ten blocks, MUTE, TUNE with five blocks, PLAY ▶, PAUSE ❚❚, LOADING).
- Keyboard: ← → previous/next tape, ↑ ↓ volume, T tune, Space play/pause, E eject, M mute, P power.
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
TV: screen window (the whole glass opening) left 20.9, top 19.4, width 47.4, height 51.8 (percent). Knob centre 76.43 / 47.62; the pointer bar in the photograph points at 200 degrees when the knob is not rotated and the five tick marks sit at -120, -60, 0, 60, 120 degrees, so pointer and ticks stay in sync; VOL keys at 56.76 and 61.81, POWER key (a copy of the key photograph) at 72. The knob and POWER key show slices of the TV photograph.

## Making it feel physical

- The picture sits in the glass: it fills the whole bezel opening (corner radius matches the photograph), edges are recessed with inner shadows, a faint reflection of the room drifts with the pointer, and the picture's average colour spills as light onto the bezel (sampled from local films; Vimeo tapes use the tape colour).
- Every key is a slice of the photograph, so it travels down 1.5 px and springs back when pressed; deck keys too. A small mechanical click plays on keys, knob detents and when a tape lands (after the first click on the page). Keyboard shortcuts flash the matching key.
- The TV stands on the deck: the deck is placed before the TV in the markup (column-reverse) so the TV paints over it, the feet overlap its top edge and a contact shadow sits under them.
- Labels are real paper, printed the way a press prints, and saved as images: `images/FILM/labels/<id>-spine.webp` and `<id>-top.webp`. They are printed by `tools/film-labels.html` (code in `js/film-labels.js`) from the paper photograph `images/FILM/paper.webp` (OpenArt, GPT Image 2.5 Sunburst). The printer: the artwork is a mask whose edge is softened (dot gain) and broken up by the paper's own grain; ink is held back where fibres stand up (tooth); density about 82% in a worn warm black, type set smaller and lighter (600 weight, open tracking); the accent colour is a second pass a few pixels out of register; the cover still is a 45-degree halftone. The labels are multiplied onto the photographed blank label. To change a title or add a tape: edit `js/film-tapes.js`, open `/tools/film-labels.html` through the local server, click "Download all" and put the files in `images/FILM/labels/`.
- Light: none added. A photographed floor spotlight and a CSS back light were both tried and dropped; neither matched the light already in the TV photograph (key from above-left front, rim along the top edge). The background stays black.
- The tapes are a real pile, right of the set. Pick a tape and it slides out of the pile, outward; the tapes above it drop into the space with a small bounce. The tape that was in the deck is first pulled straight out of the door, carried along the deck and dropped on top of the pile, then the chosen one is taken out. Only one tape moves through the air at a time.
- The showcase: the chosen tape comes right up to the camera in front of the TV screen (slightly wider than the screen), tilted so the picture on its label shows, while the TV and deck dim behind it (the slow point). It then drops to the door, lines up in front of it and is pushed in. Positions are offsets from one base box at the bottom of the pile (`dims()`, `restPose()`, `deckPose()` in js/film.js).
- `tv.webp` and `deck-cut.webp` are the TV and deck photographs cut out to transparency (flood fill from the black border, so dark parts inside stay solid). Measured: the TV's feet end 86.2% down its photograph, the deck's top edge is 4.55% down its photograph; with the shadow under the feet that puts the deck at margin-top -0.0107 x TV width, so the feet rest exactly on the deck. `tv-black.jpg` and `deck.webp` are still used for the knob and key slices.
- On-screen text (PLAY, VOLUME, TUNE, NO TAPE) lives inside the picture: it sits under the scan lines, glass, grain and reflections, goes through the same picture filter as the film (so VHS smears it too), and glows.
- Tape flights (shelf to slot, slot to shelf) are one spline each. Time is warped so the tape starts and ends at rest and only eases to about 45% of its cruising speed when it is closest to the screen; it never stops in between.
- The photographed TV and its transparent margins do not take clicks (so the deck underneath can); only the screen, knob and keys do.

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
