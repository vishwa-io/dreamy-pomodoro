# Dreamy Pomodoro

A dreamy full-screen Pomodoro timer set inside a living painterly swan pond.

The pond is the visual focus. The app keeps the original swan-pond atmosphere while adding a simple, distraction-free timer and a few useful controls.

## What it does

- **Pomodoro timer** — 25-minute focus and 5-minute break modes with start/pause and reset.
- **Living swan pond** — animated swans, ripples, wakes, falling leaves, reeds, vines, blossoms, lighting, water shaders, and time-of-day atmosphere.
- **Four pond looks** — dawn, day, dusk, and dark. They can be selected from the right side.
- **Ambient music** — looping background music with mute/unmute.
- **Theme toggle** — switches the surrounding UI between dark and warm off-white light mode.
- **Todo list** — a small task list stored in localStorage.
- **Personal navbar** — Vishwa + live time on the left; GitHub, LinkedIn, and X on the right.
- **Responsive mobile view** — the pond fills the portrait screen, with slightly larger swans and blossoms for smaller devices.

There are intentionally **no stats, streaks, session counters, productivity dashboards, or other extra features**.

## Pages

This is intended to be a **single-page Pomodoro app**.

The main experience lives at:

`/`

The repository originally came from a portfolio-page scaffold, so it still contains two old route files:

- `app/about/page.tsx`
- `app/notes/[slug]/page.tsx`

Those routes are leftover scaffold code and are **not part of the current Pomodoro experience or navigation**.

Likewise, a few old scaffold components remain in the repository for now, but the current homepage does not use them, including `app/dock.tsx`, `app/theme-toggle.tsx`, `app/site-behaviour.tsx`, and `app/copy-button.tsx`.

## Main structure

| File | Purpose |
|---|---|
| `app/page.tsx` | Main Dreamy Pomodoro homepage |
| `app/pomodoro.tsx` | Pomodoro timer logic and controls |
| `app/hero-bar.tsx` | Bottom control pill: music, theme, and todo |
| `app/social-nav.tsx` | Personal navbar, GitHub/LinkedIn/X links, and live time |
| `app/pond-controls.tsx` | Dawn/day/dusk/dark pond controls |
| `app/pond/pond-hero.tsx` | Mounts the pond canvas and time-of-day look |
| `app/pond/engine.ts` | Main pond engine: water, swans, reeds, vines, blossoms, ripples, wakes, shaders, lighting |
| `app/pond/swan-paint.ts` | Painterly swan rendering |
| `app/pond/time-of-day.ts` | Time-of-day keyframes and blending |
| `app/audio-provider.tsx` | Ambient music state and playback |
| `app/dreamy.css` | Dreamy Pomodoro layout and UI styling |
| `app/globals.css` | Global styles and base design tokens |
| `app/layout.tsx` | Next.js root layout, fonts, theme initialization |

## Pond

The pond is a canvas/WebGL scene rather than a static background image.

It includes:

- three animated swans
- water movement and reflections
- pointer ripples
- swan wakes
- falling leaves and petals
- reeds and overhanging vines
- pink flowering clusters around the edges
- four blended time-of-day looks
- painterly post-processing and bloom

The swan behavior, interactions, and pond rendering live in `app/pond/engine.ts` and `app/pond/swan-paint.ts`.

## Music

Ambient music is provided from `public/audio/`.

Playback starts after a user gesture because browsers block autoplay with sound. The mute state is remembered in localStorage.

## Theme

Dark mode keeps the original deep pond surround.

Light mode uses a warm **off-white** surround instead of pure white, while the pond itself stays unchanged. UI text and controls switch to dark ink for readability.

## Development

Install dependencies:

```bash
npm install
```

Run locally:

```bash
npm run dev
```

Then open:

`http://localhost:3000`

## Time-of-day preview

You can preview a specific pond atmosphere with query parameters:

```text
/?time=dawn
/?time=day
/?time=dusk
/?time=dark
```

The normal experience follows the visitor's local browser time.

## Credits

The pond visuals are based on the original Swan Pond artwork/engine from the `vixipop/repertoire` reference that this project was adapted from.

The Dreamy Pomodoro UI, timer, controls, responsive layout, and personal links in this repository are the customized version for Vishwa.
