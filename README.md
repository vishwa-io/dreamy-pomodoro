# Portfolio homepage scaffold

A Next.js (App Router) rebuild of the single-column portfolio homepage layout.

```bash
npm install
npm run dev     # http://localhost:3000
```

## Files

| File | What's in it |
|---|---|
| `app/page.tsx` | Homepage — section order and element hierarchy |
| `app/globals.css` | Design tokens, spacing, type scale, responsive rules |
| `app/layout.tsx` | Root shell, `next/font` setup, pre-paint theme script |
| `app/site-behaviour.tsx` | Staggered entrance (client) |
| `app/dock.tsx` | Floating dock — social slots (client) |
| `app/theme-toggle.tsx` | Top-right light/dark toggle (client) |
| `app/audio-provider.tsx` | Ambient music, mounted once in the root layout so it survives page changes (client) |
| `app/hero-bar.tsx` | The strip above the pond: Bangalore time on the left, music toggle on the right (client) |
| `app/pond/pond-hero.tsx` | The hero's React frame: mounts the engine, follows the clock (client) |
| `app/pond/engine.ts` | The pond engine, lifted from the standalone artifact: painted floor, weeds, vines, ripples, wakes, the water + brushwork shaders, swan behaviour, the four time-of-day looks |
| `app/pond/swan-paint.ts` | The painted swans |
| `app/pond/time-of-day.ts` | Keyframe hours and the blend between looks |
| `app/about/` | About page with the Spline scene |
| `app/copy-button.tsx` | Copy-to-clipboard button (client) |
| `app/notes/[slug]/page.tsx` | Note detail route — stub, wire up to your own content |

## What was carried over exactly

These came from the reference stylesheet and are reproduced verbatim:

**Type** — one size for the entire page: `14px / 22px`, weight 400. Headings
(`h2`) are the same size as body copy, differentiated only by colour. This is
the most distinctive thing about the design; don't "fix" it.

**Column** — `540px` wide, `max-width: calc(100% - 60px)`, centred.

**Spacing**

| Token | Desktop | ≤720px |
|---|---|---|
| `.intro-section` padding | `120px 0 111px` | `64px 0 80px` |
| `.content` gap | `36px` | `26px` |
| `.stack` gap | `18px` | — |
| `.body-copy` gap | `14px` | `12px` |
| `.information` gap | `12px` | `10px` |
| `.link-groups` gap | `4px` | — |
| `.link-row` gap | `6px 16px` | — |

**Link rows** — `grid-template-columns: minmax(0, 1fr) auto` with
`align-items: baseline`, `min-height: 46px`. Name flexes, date hugs the right
edge, both sit on a shared baseline.

**Dividers** — `height: 0` with the rule drawn by a `::before`, so they never
contribute to layout height.

**Colours** — full light/dark token sets, including the `#fb5ab2` accent.

**Breakpoint** — a single one at `720px`.

## What's placeholder — replace this

- **All copy.** Every paragraph, project name, date and note title is a
  placeholder. The reference site's actual writing is its author's own content.
- **Avatar** — a CSS circle at the correct `40×40`. Drop in a square image.
- **Images** — none included. The reference site's photography, artwork and
  third-party brand logos aren't redistributable.
- **Social icons** — generic shapes in the dock; swap for real ones.

## Known gaps

**Fonts.** The reference self-hosts a variable Inter under the family name
`"Site Inter"`. Inter is open source (SIL OFL), so this uses `next/font/google`,
which self-hosts it at build time (no runtime CDN request) and exposes it as
`--font-inter`. `globals.css` feeds that into the `--font-sf` token, so the
stack resolves the same way.

**Entrance animation.** Driven by the reference site's compiled JavaScript, not
its CSS — so it's written from scratch. The behaviour matches; exact
timing/easing will differ. Tune the constants at the top of
`app/site-behaviour.tsx`:

```js
const STAGGER_MS = 60;     // gap between successive elements
const BASE_DELAY_MS = 40;  // delay before the first
```

## The pond hero

The engine (`engine.ts`, `swan-paint.ts`) is lifted from the standalone Swan Pond
artifact. The colours, shaders and swan behaviour are untouched — only the
tuner panel was removed and the frame made responsive. Those two files are plain
JavaScript carrying a `// @ts-nocheck` pragma; the typed surface the app uses is
`pond-hero.tsx` and `time-of-day.ts`.

It pauses while off-screen or in a hidden tab, and steps its own render
resolution down if frames start taking too long. One change from the standalone
engine: that guard could only ever step *down* (it needed >80fps to climb back, which
a 60Hz screen can't reach, and it counted startup stalls), so it now ignores the
first ~2s and climbs back after three clean windows at >=54fps. The order of what
it sheds, the steps, the floors and the threshold for shedding are unchanged.

Click to make a splash and startle the swans; right-click (long-press on touch) to
toss them corn. They talk back in handwriting (Gaegu); the ink colour follows the
hour like everything else. The speech size is set in CSS (`--say-size` on
`.pond-hero`) because the pond here is narrower than the 680px it was drawn at.

## Music

One track (`public/audio/`), 40% volume, looping. The player lives in the root layout,
so it keeps playing as you move between pages **as long as those moves are client-side**
(`next/link`). A plain `<a href>` to an internal page reloads the document and restarts
the music, so use `Link` for anything internal.

Browsers only allow sound after a gesture, so nothing is fetched or played until the
first click, tap or key press; the icon shows "off" until then. Muting stops it and is
remembered (`localStorage`, key `ambient-muted`), including across reloads. Volume goes
through a Web Audio gain node because iOS Safari ignores `audio.volume`.

The mute toggle only exists on the homepage (it is part of the strip above the pond).
The music carries on to other pages with no control there.

## Bangalore time

`bangalore, ka | 02:24pm`, always in `Asia/Kolkata` whatever the visitor's own timezone.
It is empty on the server and filled in after mount, because the server's clock isn't
the point and would mismatch on hydration.

**Time of day.** The look follows the *visitor's* local clock, read in their own
browser, so someone in Mumbai at 7pm sees dusk while someone in Los Angeles at the
same instant sees their morning. Windows (local time): dark until ~4:30, dawn
~5:48–7:24, day ~8:30–16:48, dusk ~18:00–19:36, dark from ~20:48, crossfading
between. The four looks are `TIMES` in `engine.ts`; the hours are `KEYS` in
`time-of-day.ts`. To preview one without waiting:

```
/?time=dawn   /?time=day   /?time=dusk   /?time=dark   /?hour=18.5
```
