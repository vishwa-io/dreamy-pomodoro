import { TIMES, mixParams } from "./engine";

/**
 * Time of day. The pond follows the viewer's local clock, blending between the
 * four looks around sunrise and sunset.
 *
 * The four looks themselves (`TIMES`, in engine.ts) and these keyframe hours
 * are the ones tuned in the standalone pond.
 */

export type TimeName = "Dawn" | "Day" | "Dusk" | "Dark";
type Params = Record<string, number>;

const LOOKS = Object.fromEntries(TIMES.map((t: { name: string; params: Params }) => [t.name, t.params])) as Record<
  TimeName,
  Params
>;

/** hour -> look. Between two different neighbours the looks crossfade. */
const KEYS: ReadonlyArray<readonly [number, TimeName]> = [
  [0, "Dark"],
  [4.5, "Dark"],
  [5.8, "Dawn"],
  [7.4, "Dawn"],
  [8.5, "Day"],
  [16.8, "Day"],
  [18, "Dusk"],
  [19.6, "Dusk"],
  [20.8, "Dark"],
  [24, "Dark"],
];

/** Hours used by `?time=` so each look can be previewed without waiting. */
const PREVIEW_HOUR: Record<string, number> = { dawn: 6.6, day: 12.5, dusk: 18.8, dark: 23 };

/**
 * The hour to render for. Honours `?hour=18.5` and `?time=dusk` for previews,
 * otherwise the viewer's own clock.
 */
export function hourFor(search: string): number {
  const q = new URLSearchParams(search);
  const hour = q.get("hour");
  if (hour !== null && hour.trim() !== "" && Number.isFinite(Number(hour))) {
    return ((Number(hour) % 24) + 24) % 24;
  }
  const named = q.get("time")?.toLowerCase();
  if (named && named in PREVIEW_HOUR) return PREVIEW_HOUR[named];
  const d = new Date();
  return d.getHours() + d.getMinutes() / 60;
}

export function lookAt(hour: number): { params: Params; name: TimeName } {
  for (let i = 0; i < KEYS.length - 1; i++) {
    const [h0, a] = KEYS[i];
    const [h1, b] = KEYS[i + 1];
    if (hour >= h0 && hour <= h1) {
      const u = h1 > h0 ? (hour - h0) / (h1 - h0) : 0;
      const t = u * u * (3 - 2 * u);
      return {
        params: a === b ? { ...LOOKS[a] } : mixParams(LOOKS[a], LOOKS[b], t),
        name: t < 0.5 ? a : b,
      };
    }
  }
  return { params: { ...LOOKS.Day }, name: "Day" };
}
