---
name: scroll-animations
description: Design, implement, or repair motion for this portfolio, including scroll reveals, hover menus, microinteractions, and transition performance. Use whenever UI motion is added or changed; do not use for static visual-only edits.
metadata:
  mcpmarket-version: 1.0.0
---

# Portfolio motion

Keep motion responsive, quiet, and consistent with the portfolio's direct black-and-white visual language. Motion should clarify state or navigation without competing with the work.

## Implementation rules

- Prefer compositor-friendly `transform` and `opacity` for animated UI surfaces.
- Do not animate `width`, `height`, `top`, `left`, `max-height`, or large-surface `clip-path`, `filter`, and `box-shadow` unless profiling shows the result stays smooth.
- Never use `transition: all`. Name only the properties that need to animate.
- Match duration to visual mass. Small control feedback usually needs 120–200ms; a large menu or floating panel may need 280–360ms to reveal its movement without feeling abrupt. Let exit be shorter than entry.
- Choose easing by its visible progress, not by a fashionable curve name. Avoid curves that complete most of the change in the first quarter of the duration; they read as a pop even when the total duration looks correct.
- A large panel may use one restrained secondary cue, such as a short content fade following the panel movement. Do not add per-item choreography unless the hierarchy benefits from it.
- Keep the trigger and revealed surface in one stable hover region. Closed overlays must not intercept pointer input; open overlays must remain interactive during rapid pointer movement.
- Use `requestAnimationFrame` only for pointer-following or continuous animation. Do not start intervals or repeated layout reads for ordinary hover states.
- Preserve keyboard focus behavior and provide a `prefers-reduced-motion` path.

## Workflow

1. Reproduce the interaction and inspect the current transition properties before editing.
2. Identify whether layout, paint, media loading, or event churn causes the stutter.
3. Make the smallest change that removes the expensive work while preserving the visual idea.
4. Sample the animation near 25%, 50%, and completion. Confirm that the first sample still shows meaningful distance or opacity change instead of appearing nearly finished.
5. Verify rapid enter/exit, keyboard focus, touch behavior, reduced motion, and at least one desktop and one mobile viewport.

## Reference baseline

- Linear's marketing navigation is the timing reference: its menu content uses a 180ms `cubic-bezier(0.455, 0.03, 0.515, 0.955)` animation and its menu viewport uses 220ms size transitions. Source: https://linear.app/
- Vercel's Menu guidance is the behavior reference: menus remain keyboard navigable and action menus open on click rather than relying on hover alone. Source: https://vercel.com/geist/menu

The WORKS dropdown adapts those references to the portfolio's existing desktop-hover navigation: the panel enters over 220ms, its content follows over 180ms with one 20ms delay, and exit takes 160ms. Preserve focus and click paths. Do not reintroduce the former `clip-path` reveal or a front-loaded easing curve.
