// @ts-nocheck
/**
 * Lifted from the standalone Swan Pond artifact, with these changes only:
 * the tuner/sliders/recorder/music helper are gone, the pieces the page needs
 * are exported, and the resolution guard in `frame` is fixed (see the note there).
 * It is plain JavaScript and is not type-checked here (hence the pragma above)
 * -- the typed surface the app uses is `pond-hero.tsx` and `time-of-day.ts`.
 */

import { makeLook, paintSwan } from "./swan-paint";

/**
 * Swan pond engine.
 *
 * Layers, bottom to top:
 *  - pond floor: sand, pebbles and river stones, painted once to a texture
 *  - weeds: redrawn every frame so each strand sways in the current
 *  - surface: swans and drifting leaves (2D canvas), plus a wake height map
 *  - water shader: depth, absorption, refraction, caustics, ripples, swan
 *    shadows on the floor and the swans' glow — all composited in one pass
 *  - paint shader: impressionist brush dabs, bloom and canvas over the frame
 *
 * Everything is sized in "pond units": the pond is designed at 680px wide and
 * `scale` = actual width / 680, so it behaves identically at any size.
 */

const MAX_RIPPLES = 20;
const DESIGN_WIDTH = 680;
const SWAN_COUNT = 3;
const LEAF_COUNT = 5;
/** One look per time of day; the pond blends between them by the clock. */
export const TIMES = [
    {
        name: "Dawn",
        params: { waterHue: 171, waterSat: 0.68, waterDepth: 1, waterLight: 0.61, lightHue: 15, lightSat: 0.89, sun: 1, skyHue: 327, skySat: 0.59, moon: 0, fog: 0.51, swanHue: 340, swanTint: 0.16, glow: 0.5, paint: 0.44, brush: 0.16, bloom: 0.55, inkHue: 52, inkSat: 1, inkLight: 0.79 },
    },
    {
        name: "Day",
        params: { waterHue: 153, waterSat: 0.51, waterDepth: 1, waterLight: 0.84, lightHue: 27, lightSat: 1, sun: 1, skyHue: 200, skySat: 0.76, moon: 0, fog: 0, swanHue: 30, swanTint: 0.16, glow: 0.41, paint: 0.64, brush: 0.11, bloom: 0.51, inkHue: 52, inkSat: 1, inkLight: 0.79 },
    },
    {
        name: "Dusk",
        params: { waterHue: 195, waterSat: 0.93, waterDepth: 1, waterLight: 0.43, lightHue: 315, lightSat: 0.71, sun: 0.18, skyHue: 285, skySat: 0.73, moon: 0.34, fog: 0, swanHue: 327, swanTint: 0.31, glow: 0.55, paint: 0.65, brush: 0.17, bloom: 0.62, inkHue: 203, inkSat: 0.74, inkLight: 0.88 },
    },
    {
        name: "Dark",
        params: { waterHue: 243, waterSat: 0.81, waterDepth: 1, waterLight: 0.18, lightHue: 212, lightSat: 0.76, sun: 0.4, skyHue: 231, skySat: 0.69, moon: 0.78, fog: 0, swanHue: 215, swanTint: 0.25, glow: 0.64, paint: 0.6, brush: 0.15, bloom: 0.85, inkHue: 203, inkSat: 0.74, inkLight: 0.88 },
    },
];
const DEFAULT_PARAMS = { ...TIMES[1].params };
const PARAM_SPECS = [
    { key: "waterHue", label: "Hue", group: "Water", min: 0, max: 360, step: 1, kind: "hue" },
    { key: "waterSat", label: "Colour", group: "Water", min: 0, max: 1, step: 0.01, kind: "amount" },
    { key: "waterDepth", label: "Depth", group: "Water", min: 0, max: 1, step: 0.01, kind: "amount" },
    { key: "waterLight", label: "Daylight", group: "Water", min: 0, max: 1, step: 0.01, kind: "amount" },
    { key: "lightHue", label: "Sun hue", group: "Light", min: 0, max: 360, step: 1, kind: "hue" },
    { key: "lightSat", label: "Sun colour", group: "Light", min: 0, max: 1, step: 0.01, kind: "amount" },
    { key: "sun", label: "Sunbeams", group: "Light", min: 0, max: 1, step: 0.01, kind: "amount" },
    { key: "skyHue", label: "Sky hue", group: "Light", min: 0, max: 360, step: 1, kind: "hue" },
    { key: "skySat", label: "Sky colour", group: "Light", min: 0, max: 1, step: 0.01, kind: "amount" },
    { key: "moon", label: "Moon", group: "Light", min: 0, max: 1, step: 0.01, kind: "amount" },
    { key: "fog", label: "Fog", group: "Light", min: 0, max: 1, step: 0.01, kind: "amount" },
    { key: "swanHue", label: "Tint hue", group: "Swans", min: 0, max: 360, step: 1, kind: "hue" },
    { key: "swanTint", label: "Tint", group: "Swans", min: 0, max: 0.5, step: 0.01, kind: "amount" },
    { key: "glow", label: "Glow", group: "Swans", min: 0, max: 1, step: 0.01, kind: "amount" },
    { key: "paint", label: "Brushwork", group: "Painting", min: 0, max: 1, step: 0.01, kind: "amount" },
    { key: "brush", label: "Brush size", group: "Painting", min: 0, max: 1, step: 0.01, kind: "amount" },
    { key: "bloom", label: "Bloom", group: "Painting", min: 0, max: 1, step: 0.01, kind: "amount" },
];
const HUE_KEYS = new Set(["waterHue", "lightHue", "skyHue", "swanHue", "inkHue"]);
/** Settings that belong to the scene rather than to a time of day. */
const GLOBAL_KEYS = new Set([]);
/** Blend two looks; hues travel the short way round the wheel. */
export function mixParams(a, b, t) {
    const out = { ...a };
    for (const k of Object.keys(a)) {
        if (HUE_KEYS.has(k)) {
            const d = ((((b[k] - a[k]) % 360) + 540) % 360) - 180;
            out[k] = (((a[k] + d * t) % 360) + 360) % 360;
        }
        else {
            out[k] = a[k] + (b[k] - a[k]) * t;
        }
    }
    return out;
}
function mulberry32(seed) {
    return () => {
        seed |= 0;
        seed = (seed + 0x6d2b79f5) | 0;
        let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}
const rand = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const wrapAngle = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const smooth = (x) => x * x * (3 - 2 * x);
function hsl(h, s, l) {
    h = (((h % 360) + 360) % 360) / 360;
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    const f = (t) => {
        t = (t + 1) % 1;
        if (t < 1 / 6)
            return p + (q - p) * 6 * t;
        if (t < 1 / 2)
            return q;
        if (t < 2 / 3)
            return p + (q - p) * (2 / 3 - t) * 6;
        return p;
    };
    return [f(h + 1 / 3), f(h), f(h - 1 / 3)];
}
/** Closest distance between segments p1–p2 and q1–q2, with the closest points. */
function segDist(p1x, p1y, p2x, p2y, q1x, q1y, q2x, q2y) {
    const d1x = p2x - p1x, d1y = p2y - p1y;
    const d2x = q2x - q1x, d2y = q2y - q1y;
    const rx = p1x - q1x, ry = p1y - q1y;
    const a = d1x * d1x + d1y * d1y;
    const e = d2x * d2x + d2y * d2y;
    const f = d2x * rx + d2y * ry;
    const c = d1x * rx + d1y * ry;
    const b = d1x * d2x + d1y * d2y;
    const den = a * e - b * b;
    let s = den > 1e-9 ? clamp((b * f - c * e) / den, 0, 1) : 0;
    let t = (b * s + f) / e;
    if (t < 0) {
        t = 0;
        s = clamp(-c / a, 0, 1);
    }
    else if (t > 1) {
        t = 1;
        s = clamp((b - c) / a, 0, 1);
    }
    const ax = p1x + d1x * s, ay = p1y + d1y * s;
    const bx = q1x + d2x * t, by = q1y + d2y * t;
    return { d: Math.hypot(ax - bx, ay - by), ax, ay, bx, by };
}
/* --------------------------------------------------------------------------
   Shaders
   -------------------------------------------------------------------------- */
const VERT = `
attribute vec2 aPos;
varying vec2 vUv;
void main() {
  vUv = aPos * 0.5 + 0.5;
  gl_Position = vec4(aPos, 0.0, 1.0);
}
`;
const COMMON = `
precision highp float;
varying vec2 vUv;
uniform vec2 uRes;
uniform float uTime;
uniform float uScale;
const float TAU = 6.28318530718;

float hash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
             mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}

float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  for (int i = 0; i < 4; i++) {
    v += a * noise(p);
    p = p * 2.03 + vec2(1.7, 9.2);
    a *= 0.5;
  }
  return v;
}
`;
const WATER_FRAG = `${COMMON}
uniform sampler2D uBed;
uniform sampler2D uWeeds;
uniform sampler2D uSwans;
uniform sampler2D uSurf;
uniform vec4 uRipples[${MAX_RIPPLES}];
uniform vec3 uDeep;
uniform vec3 uShallow;
uniform vec3 uCaustic;
uniform vec3 uSky;
uniform vec3 uTint;
uniform float uMurk;
uniform float uLight;
uniform float uGlow;
uniform float uTintAmt;
uniform sampler2D uCanopy;
uniform vec3 uSun;
uniform float uSunAmt;
uniform float uMoon;
uniform float uGrade;
uniform float uFog;
uniform vec3 uFogCol;
uniform vec3 uReflSky;
uniform vec3 uReflSky2;
uniform vec3 uReflTree;
uniform float uRefl;

// Surface slope from analytic ripples (unit-amplitude wave → slope ~1).
vec2 slope(vec2 p) {
  float lambda = 17.0 * uScale;
  float k = TAU / lambda;
  float c = 92.0 * uScale;
  float w = 24.0 * uScale;
  float fall = 85.0 * uScale;
  vec2 g = vec2(0.0);
  for (int i = 0; i < ${MAX_RIPPLES}; i++) {
    vec4 r = uRipples[i];
    float age = uTime - r.z;
    if (r.w <= 0.0 || age < 0.0 || age > 5.5) continue;
    vec2 dv = p - r.xy;
    float d = length(dv) + 0.0001;
    float x = d - c * age;
    if (abs(x) > 3.0 * w) continue;
    float env = exp(-x * x / (w * w)) * exp(-age * 0.9) * r.w / (1.0 + d / fall);
    env *= smoothstep(0.0, 6.0 * uScale, d);
    float dh = env * (k * cos(x * k) - sin(x * k) * 2.0 * x / (w * w));
    g += dh * dv / d;
  }
  vec2 q = p / uScale;
  g.x += 0.05 * cos(q.x * 0.021 + uTime * 0.7) * sin(q.y * 0.017 - uTime * 0.5) * 0.021 * uScale;
  g.y += 0.05 * sin(q.x * 0.021 + uTime * 0.7) * cos(q.y * 0.017 - uTime * 0.5) * 0.017 * uScale;
  g.x += 0.03 * cos(q.x * 0.043 - q.y * 0.02 + uTime * 1.1) * 0.043 * uScale;
  return g / k;
}

float caustic(vec2 uv, float t) {
  vec2 p = uv * TAU - 250.0;
  vec2 i = p;
  float c = 1.0;
  float inten = 0.005;
  for (int n = 0; n < 4; n++) {
    float tt = t * (1.0 - (3.5 / float(n + 1)));
    i = p + vec2(cos(tt - i.x) + sin(tt + i.y), sin(tt - i.y) + cos(tt + i.x));
    c += 1.0 / length(vec2(p.x / (sin(i.x + tt) / inten), p.y / (cos(i.y + tt) / inten)));
  }
  c /= 4.0;
  c = 1.17 - pow(c, 1.4);
  return pow(abs(c), 8.0);
}

// Dappled shade from overhanging leaves, swaying.
float shade(vec2 p, float t) {
  vec2 q = p / (150.0 * uScale);
  vec2 sway = vec2(sin(t * 0.23) * 0.18 + sin(t * 0.61) * 0.05, cos(t * 0.19) * 0.12);
  float n = fbm(q + sway + vec2(3.1, 0.0));
  n += 0.18 * fbm(q * 3.1 - sway * 2.0);
  float canopy = smoothstep(1.1, 0.1, distance(p / uRes, vec2(0.95, -0.05)));
  return smoothstep(0.52, 0.72, n + canopy * 0.22) * (0.35 + canopy * 0.65);
}

// 0 at the shallow rim, ~1 in the deep middle.
float depthAt(vec2 p) {
  vec2 uv = p / uRes;
  float ar = uRes.x / uRes.y;
  float edge = min(min(uv.x, 1.0 - uv.x) * ar, min(uv.y, 1.0 - uv.y));
  float bowl = smoothstep(0.0, 0.45, edge);
  float n = fbm(p / (190.0 * uScale) + 4.0);
  return clamp(bowl * (0.5 + 0.7 * n), 0.0, 1.0);
}

// Slow wandering current, used to wobble the floor as seen through it.
vec2 current(vec2 p, float t) {
  vec2 q = p / (160.0 * uScale);
  return vec2(fbm(q + vec2(t * 0.06, 0.0)) - 0.5, fbm(q + vec2(5.2, t * 0.05)) - 0.5);
}

vec3 bedAt(vec2 p, float blur) {
  vec2 uv = clamp(p / uRes, 0.001, 0.999);
  vec2 px = vec2(blur) / uRes;
  vec3 c = texture2D(uBed, uv).rgb * 0.4;
  c += texture2D(uBed, uv + vec2(px.x, 0.0)).rgb * 0.15;
  c += texture2D(uBed, uv - vec2(px.x, 0.0)).rgb * 0.15;
  c += texture2D(uBed, uv + vec2(0.0, px.y)).rgb * 0.15;
  c += texture2D(uBed, uv - vec2(0.0, px.y)).rgb * 0.15;
  return c;
}

float canopyA(vec2 p) {
  return texture2D(uCanopy, clamp(p / uRes, 0.0, 1.0)).a;
}

// The canopy's silhouette, thrown down-right across the water by the sun.
float canopyShadow(vec2 p, float depth) {
  vec2 q = p - vec2(0.55, 0.83) * (34.0 + 26.0 * depth) * uScale;
  float r = (5.0 + 6.0 * depth) * uScale;
  float a = canopyA(q) * 0.2;
  for (int i = 0; i < 8; i++) {
    float an = float(i) * 0.785398 + 0.2;
    a += canopyA(q + vec2(cos(an), sin(an)) * r) * 0.1;
  }
  return a;
}

// Shafts of sun slanting down through gaps in the leaves.
float sunbeams(vec2 p, float t) {
  vec2 dir = normalize(vec2(0.55, 0.83));
  vec2 perp = vec2(-dir.y, dir.x);
  float across = dot(p, perp) / (26.0 * uScale);
  float along = dot(p, dir) / uRes.y;
  float streak = smoothstep(0.55, 0.95, noise(vec2(across, t * 0.04)));
  streak *= 0.6 + 0.4 * noise(vec2(across * 2.7 + 3.0, t * 0.07));
  // trace back toward the sun: lit only where that path met leaves with a gap
  float near = canopyA(p - dir * 70.0 * uScale);
  float wide = 0.0;
  for (int i = 0; i < 4; i++) {
    float an = float(i) * 1.5708;
    wide += canopyA(p - dir * 70.0 * uScale + vec2(cos(an), sin(an)) * 30.0 * uScale) * 0.25;
  }
  float gap = smoothstep(0.05, 0.35, wide) * (1.0 - near * 0.8);
  return streak * gap * exp(-along * 1.4);
}

vec4 swanTex(vec2 p) {
  return texture2D(uSwans, clamp(p / uRes, 0.0, 1.0));
}

// The sun is top-left, so a swan's shadow falls down-right onto the floor —
// further away and softer where the water is deeper.
float swanShadow(vec2 p, float depth) {
  vec2 off = vec2(0.55, 0.83) * (8.0 + 36.0 * depth) * uScale;
  float r = (2.0 + 9.0 * depth) * uScale;
  vec2 q = p - off;
  float a = swanTex(q).a * 0.2;
  for (int i = 0; i < 8; i++) {
    float an = float(i) * 0.785398;
    a += swanTex(q + vec2(cos(an), sin(an)) * r).a * 0.1;
  }
  return a;
}

vec4 swanSoft(vec2 p) {
  float r = 0.8 * uScale;
  vec4 s = swanTex(p) * 0.4;
  for (int i = 0; i < 8; i++) {
    float an = float(i) * 0.785398 + 0.3;
    s += swanTex(p + vec2(cos(an), sin(an)) * r) * 0.075;
  }
  return s;
}

float swanHalo(vec2 p) {
  float h = 0.0;
  for (int i = 0; i < 6; i++) {
    float an = float(i) * 1.0472;
    vec4 a = swanTex(p + vec2(cos(an), sin(an)) * 7.0 * uScale);
    vec4 b = swanTex(p + vec2(cos(an + 0.5), sin(an + 0.5)) * 17.0 * uScale);
    h += dot(a.rgb, vec3(0.3333)) * 0.6 + dot(b.rgb, vec3(0.3333)) * 0.4;
  }
  return h / 6.0;
}

float motes(vec2 p, float t) {
  float m = 0.0;
  for (int L = 0; L < 2; L++) {
    float fl = float(L);
    float sc = (22.0 + fl * 15.0) * uScale;
    vec2 q = p / sc + vec2(t * (0.05 + fl * 0.03), t * 0.02);
    vec2 id = floor(q);
    vec2 f = fract(q);
    float h = hash(id + fl * 7.0);
    if (h > 0.8) {
      vec2 c = vec2(hash(id + 1.3), hash(id + 2.7)) * 0.6 + 0.2;
      c += 0.15 * vec2(sin(t * 0.7 + h * 20.0), cos(t * 0.6 + h * 13.0));
      m += smoothstep(0.09, 0.0, length(f - c)) * (0.5 + 0.5 * h);
    }
  }
  return m;
}

void main() {
  vec2 p = vec2(vUv.x, 1.0 - vUv.y) * uRes;
  vec2 uv = p / uRes;
  float depth = depthAt(p);

  vec2 g = slope(p);
  // wakes are drawn into a height map; their slope bends the light too
  vec2 ex = vec2(2.0 * uScale, 0.0) / uRes;
  vec2 ey = vec2(0.0, 2.0 * uScale) / uRes;
  vec2 gs = vec2(texture2D(uSurf, uv + ex).r - texture2D(uSurf, uv - ex).r,
                 texture2D(uSurf, uv + ey).r - texture2D(uSurf, uv - ey).r);
  g += gs * 2.2;

  vec2 cur = current(p, uTime);
  vec2 off = g * (5.0 + 9.0 * depth) * uScale + cur * (3.0 + 7.0 * depth) * uScale;

  vec3 bed = bedAt(p + off, (0.6 + depth * 2.4) * uScale);
  vec4 wd = texture2D(uWeeds, clamp((p + off * 0.7) / uRes, 0.001, 0.999));
  bed = bed * (1.0 - wd.a) + wd.rgb;

  float sh = swanShadow(p + off * 0.4, depth);
  float dap = shade(p + off * 0.5, uTime) * 0.55;
  float csh = canopyShadow(p + off * 0.4, depth);
  dap = clamp(dap + csh * 0.38, 0.0, 1.0);
  float beams = sunbeams(p, uTime);

  vec2 cp = (p + off * 2.0) / (300.0 * uScale);
  float ca = caustic(cp, uTime * 0.3 + 23.0);
  ca = ca * 0.75 + 0.35 * caustic(cp * 1.7 + 3.7, uTime * 0.25 + 11.0);
  ca = min(ca, 1.6);

  vec3 floorCol = bed * uLight * (1.0 - dap * 0.45) * (1.0 - sh * 0.62);
  floorCol += uCaustic * ca * 0.32 * uLight * (1.0 - depth * 0.6) * (1.0 - dap * 0.85) * (1.0 - sh * 0.9);

  // light is absorbed on its way down and back: deep water shows its own colour
  float absorb = clamp(0.03 + pow(depth, 1.3) * uMurk * 1.1, 0.0, 0.96);
  vec3 col = mix(floorCol * uShallow * 1.25, uDeep, absorb);
  col += uShallow * motes(p + off * 0.5, uTime) * 0.05 * (0.4 + uLight);

  // the surface mirrors sky and overhanging trees, broken up by the ripples
  vec2 rq = (p + g * 14.0 * uScale) / (230.0 * uScale);
  float rn = fbm(rq + vec2(0.0, uTime * 0.01));
  float trees = smoothstep(0.45, 0.75, rn + (1.0 - vUv.y) * 0.0 + dap * 0.4);
  // two sky colours drift through each other: pink and gold at dusk, peach and rose at dawn
  float skyMix = smoothstep(0.3, 0.7, fbm(rq * 0.6 + vec2(uTime * 0.008, 3.0)));
  vec3 refl = mix(mix(uReflSky, uReflSky2, skyMix), uReflTree, trees);
  col = mix(col, refl, uRefl * (0.55 + 0.45 * smoothstep(0.2, 1.0, vUv.y)));

  float lit = dot(-g, normalize(vec2(-0.55, -0.83)));
  col += uSky * max(lit, 0.0) * 0.2 * (1.0 - dap * 0.6);
  col -= vec3(0.04) * max(-lit, 0.0);
  col += uSky * smoothstep(0.6, 1.0, lit) * (1.0 - dap) * 0.3;
  col += uSky * 0.07 * smoothstep(0.35, 1.0, vUv.y);

  // sun shafts warm the water and kindle the caustics where they land
  col += uSun * beams * 0.42 * uSunAmt * (0.35 + uLight * 0.8);

  // moonlight: a broken path of light across the water, and starry glints
  if (uMoon > 0.001) {
    vec2 mp = vec2(0.68, 0.3) * uRes + g * 26.0 * uScale;
    vec2 md = (p - mp) / uScale;
    float disc = exp(-dot(md, md) / (2.0 * 26.0 * 26.0));
    float glade = exp(-md.x * md.x / (2.0 * 40.0 * 40.0)) * exp(-max(md.y, 0.0) / 220.0) * step(-60.0, md.y);
    float shards = smoothstep(0.55, 0.95, noise(vec2(p.x / (9.0 * uScale), p.y / (2.5 * uScale) + uTime * 0.6)));
    vec3 moonCol = mix(vec3(0.8, 0.88, 1.0), uSun, 0.35);
    col += moonCol * uMoon * (disc * 0.9 + glade * shards * 0.75 + glade * 0.08);
    vec2 sc = p / (6.0 * uScale);
    float star = step(0.985, hash(floor(sc))) * smoothstep(0.35, 0.0, length(fract(sc) - 0.5));
    star *= 0.5 + 0.5 * sin(uTime * 2.0 + hash(floor(sc) + 3.0) * 40.0);
    col += vec3(0.85, 0.9, 1.0) * star * uMoon * 0.5 * (1.0 - dap * 0.7);
  }
  col *= 1.0 - csh * 0.06;

  // swans and leaves: softened, tinted, glowing onto the water around them
  vec4 sw = swanSoft(p);
  float halo = swanHalo(p);
  vec3 srgb = sw.rgb;
  float grey = dot(srgb, vec3(0.3333));
  float satv = (max(srgb.r, max(srgb.g, srgb.b)) - min(srgb.r, min(srgb.g, srgb.b))) / max(sw.a, 0.001);
  srgb = mix(srgb, grey * uTint * 1.1, uTintAmt * (1.0 - smoothstep(0.12, 0.4, satv)));
  vec3 glowCol = mix(vec3(1.0, 0.98, 0.94), uTint, 0.35 + uTintAmt);
  col += glowCol * halo * uGlow * 0.6 * (1.0 - sw.a);
  col = col * (1.0 - sw.a) + srgb * (1.0 + uGlow * 0.12);

  // overhanging vines, nearest the eye: backlit where the sun comes through
  vec4 cv = texture2D(uCanopy, clamp(p / uRes, 0.0, 1.0));
  // leaves take the hour's light: sun-coloured by day, moon-dark silhouettes at night
  float dayK = clamp((uLight - 0.2) * 1.4, 0.0, 1.0);
  vec3 lightOn = mix(vec3(0.16, 0.2, 0.32), mix(vec3(1.0), uSun * 1.25, 0.7), dayK);
  vec3 crgb = cv.rgb * lightOn * (0.5 + 0.45 * dayK);
  crgb += cv.a * vec3(0.05, 0.07, 0.12) * uMoon;
  crgb += cv.a * vec3(0.16, 0.2, 0.04) * beams * uLight;
  col = col * (1.0 - cv.a) + crgb;

  // morning mist: soft banks drifting with the air, thicker toward the far bank,
  // brighter where the sun shafts catch it
  if (uFog > 0.001) {
    vec2 fq = p / (210.0 * uScale);
    float f1 = fbm(fq + vec2(uTime * 0.018, uTime * 0.006));
    float f2 = fbm(fq * 2.1 - vec2(uTime * 0.027, -uTime * 0.01) + 7.3);
    float mist = smoothstep(0.42, 0.78, f1 * 0.7 + f2 * 0.45);
    mist = mix(mist, 1.0, 0.1) * (0.5 + 0.5 * smoothstep(0.0, 1.0, vUv.y));
    float fogA = clamp(mist * uFog * 0.85, 0.0, 0.85);
    vec3 fc = uFogCol + uSun * beams * 0.25;
    col = mix(col, fc, fogA);
  }

  // the whole scene is bathed in the hour's light
  col *= mix(vec3(1.0), uSun * 1.22, 0.3 * uGrade);

  vec2 v = vUv - 0.5;
  col *= 1.0 - dot(v, v) * 0.5;
  gl_FragColor = vec4(col, 1.0);
}
`;
// Impressionist pass: the frame is re-laid as overlapping brush dabs, each
// carrying one colour picked up from beneath it, nudged warm or cool.
const POST_FRAG = `${COMMON}
uniform sampler2D uScene;
uniform sampler2D uSwans;
uniform float uPaint;
uniform float uBrush;
uniform float uBloom;

vec3 scene(vec2 p) {
  // the framebuffer stores rows bottom-up
  vec2 uv = vec2(p.x, uRes.y - p.y) / uRes;
  return texture2D(uScene, clamp(uv, 0.001, 0.999)).rgb;
}

vec4 dabs(vec2 p, float size, float seed) {
  vec2 id = floor(p / size);
  float best = -1.0;
  vec3 col = vec3(0.0);
  float cover = 0.0;
  for (int j = -1; j <= 1; j++) {
    for (int i = -1; i <= 1; i++) {
      vec2 c = id + vec2(float(i), float(j));
      vec2 h = vec2(hash(c + seed), hash(c + seed + 17.31));
      vec2 centre = (c + 0.5 + (h - 0.5) * 0.9) * size;
      // strokes run mostly level, swirling gently, the way Monet laid water
      float ang = (hash(c + seed + 3.1) - 0.5) * 0.55
        + sin(centre.y * 0.013 / uScale + centre.x * 0.004 / uScale) * 0.35;
      vec2 d = p - centre;
      vec2 r = vec2(cos(ang) * d.x + sin(ang) * d.y, -sin(ang) * d.x + cos(ang) * d.y);
      float len = size * (1.1 + 0.9 * h.x);
      float wid = size * (0.32 + 0.2 * h.y);
      float m = 1.0 - length(r / vec2(len, wid));
      // bristle streaks along the stroke
      m += (hash(vec2(floor(r.y / size * 7.0), c.x + c.y * 31.0 + seed)) - 0.5) * 0.22;
      if (m > 0.0) {
        float pri = hash(c + seed + 9.7) + m * 0.5;
        if (pri > best) {
          best = pri;
          vec3 s = scene(centre + vec2(cos(ang), sin(ang)) * r.x * 0.35);
          // broken colour: some dabs lean violet-blue, some yellow-green
          float k = hash(c + seed + 5.5);
          vec3 cool = vec3(-0.03, 0.0, 0.07);
          vec3 warm = vec3(0.05, 0.05, -0.04);
          s += k < 0.33 ? cool : (k > 0.72 ? warm : vec3(0.0));
          s *= 0.92 + 0.16 * hash(c + seed + 2.2);
          col = s;
          cover = smoothstep(0.0, 0.3, m);
        }
      }
    }
  }
  return vec4(col, cover);
}

void main() {
  vec2 p = vec2(vUv.x, 1.0 - vUv.y) * uRes;
  vec3 base = scene(p);

  float big = (4.0 + uBrush * 9.0) * uScale;
  float small = big * 0.42;
  vec4 d1 = dabs(p, big, 0.0);
  vec4 d2 = dabs(p + big * 0.5, big * 0.8, 31.0);
  vec4 d3 = dabs(p, small, 57.0);

  vec3 painted = base;
  painted = mix(painted, d2.rgb, d2.a);
  painted = mix(painted, d1.rgb, d1.a);

  // keep the swans legible: finer strokes wherever there is detail
  float sa = texture2D(uSwans, clamp(p / uRes, 0.0, 1.0)).a;
  float e = 1.5 * uScale;
  float edge = length(scene(p + vec2(e, 0.0)) - scene(p - vec2(e, 0.0)))
             + length(scene(p + vec2(0.0, e)) - scene(p - vec2(0.0, e)));
  float detail = clamp(edge * 1.6, 0.0, 1.0);
  vec3 fine = mix(base, d3.rgb, d3.a * 0.85);
  painted = mix(painted, fine, detail);
  // swans keep their form: only a light veil of fine strokes over them
  float swanMask = smoothstep(0.05, 0.6, sa);
  painted = mix(painted, mix(base, d3.rgb, d3.a * 0.35), swanMask);

  vec3 col = mix(base, painted, uPaint);

  // bloom and haze
  vec3 bl = vec3(0.0);
  vec3 hz = vec3(0.0);
  for (int i = 0; i < 8; i++) {
    float an = float(i) * 0.785398;
    vec2 o = vec2(cos(an), sin(an));
    vec3 a = scene(p + o * 6.0 * uScale);
    vec3 b = scene(p + o * 14.0 * uScale);
    bl += max(a - 0.78, 0.0) + max(b - 0.78, 0.0) * 0.6;
    hz += a * 0.5 + b * 0.5;
  }
  bl /= 8.0;
  hz /= 8.0;
  col = mix(col, hz, 0.1 * uBloom);
  col += bl * uBloom * 1.3;

  // Monet's palette: violet-blue in the shadows, a warm breath in the lights
  float l = dot(col, vec3(0.299, 0.587, 0.114));
  col += vec3(0.05, 0.025, 0.09) * (1.0 - l) * uPaint;
  col *= mix(vec3(1.0), vec3(1.045, 1.0, 0.94), smoothstep(0.45, 1.0, l) * uPaint);

  // canvas weave and grain
  vec2 q = p / uScale;
  float weave = sin(q.x * 2.3) * sin(q.y * 2.3);
  float grain = hash(floor(p * 1.5)) - 0.5;
  col *= 1.0 + uPaint * (weave * 0.025 + grain * 0.035);

  gl_FragColor = vec4(col, 1.0);
}
`;
function compile(gl, type, src) {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
        const log = gl.getShaderInfoLog(s);
        gl.deleteShader(s);
        throw new Error(`Shader compile failed: ${log}`);
    }
    return s;
}
function program(gl, frag) {
    const prog = gl.createProgram();
    gl.attachShader(prog, compile(gl, gl.VERTEX_SHADER, VERT));
    gl.attachShader(prog, compile(gl, gl.FRAGMENT_SHADER, frag));
    gl.bindAttribLocation(prog, 0, "aPos");
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS))
        throw new Error(gl.getProgramInfoLog(prog) ?? "link failed");
    return prog;
}
function makeTexture(gl) {
    const t = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(4));
    return t;
}
/* --------------------------------------------------------------------------
   Pond floor — painted once per size
   -------------------------------------------------------------------------- */
function blob(ctx, rx, ry, seed) {
    const n = seed.length;
    const pts = seed.map((j, i) => {
        const a = (i / n) * Math.PI * 2;
        return [Math.cos(a) * rx * j, Math.sin(a) * ry * j];
    });
    ctx.beginPath();
    for (let i = 0; i <= n; i++) {
        const a = pts[i % n];
        const b = pts[(i + 1) % n];
        const mx = (a[0] + b[0]) / 2;
        const my = (a[1] + b[1]) / 2;
        if (i === 0)
            ctx.moveTo(mx, my);
        else
            ctx.quadraticCurveTo(a[0], a[1], mx, my);
    }
    ctx.closePath();
}
const STONE_CLUSTERS = [
    [0.88, 0.86, 11, 0.12],
    [0.08, 0.88, 9, 0.1],
    [0.93, 0.16, 7, 0.09],
    [0.1, 0.12, 5, 0.08],
    [0.52, 0.93, 6, 0.09],
    [0.38, 0.42, 3, 0.05],
    [0.68, 0.58, 2, 0.03],
];
const WEED_SITES = [
    // x, y, lean (rad), count
    [0.02, 0.98, -0.75, 26],
    [0.97, 0.04, 2.3, 18],
    [0.99, 0.68, 3.1, 12],
    [0.3, 0.99, -1.4, 9],
    [0.06, 0.4, 0.1, 7],
    [0.86, 0.9, -2.2, 8],
];
function paintBed(W, H, scale) {
    const c = document.createElement("canvas");
    c.width = Math.max(1, Math.round(W));
    c.height = Math.max(1, Math.round(H));
    const ctx = c.getContext("2d");
    const r = mulberry32(7);
    const canBlur = "filter" in ctx;
    // sandy silt, neutral so the water decides the colour
    const base = ctx.createLinearGradient(0, 0, W * 0.3, H);
    base.addColorStop(0, "#9b927c");
    base.addColorStop(0.5, "#a69c84");
    base.addColorStop(1, "#b0a68c");
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, W, H);
    for (let i = 0; i < 220; i++) {
        const x = r() * W;
        const y = r() * H;
        const rad = (14 + r() * 70) * scale;
        const kind = r();
        const g = ctx.createRadialGradient(x, y, 0, x, y, rad);
        const col = kind < 0.4 ? "rgba(70,74,52,0.14)" : kind < 0.75 ? "rgba(190,180,150,0.12)" : "rgba(60,52,40,0.12)";
        g.addColorStop(0, col);
        g.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = g;
        ctx.fillRect(x - rad, y - rad, rad * 2, rad * 2);
    }
    // ripple marks in the sand, very faint
    ctx.strokeStyle = "rgba(255,248,225,0.05)";
    ctx.lineWidth = 2 * scale;
    for (let i = 0; i < 40; i++) {
        const y = r() * H;
        const x = r() * W;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.quadraticCurveTo(x + 40 * scale, y - 6 * scale, x + 90 * scale, y + 2 * scale);
        ctx.stroke();
    }
    for (let i = 0; i < 4200; i++) {
        ctx.fillStyle = r() > 0.5 ? "rgba(235,228,205,0.1)" : "rgba(40,36,28,0.1)";
        const s = (0.7 + r() * 1.2) * scale;
        ctx.fillRect(r() * W, r() * H, s, s);
    }
    // pebbles: many small, crowding the margins
    for (let i = 0; i < 420; i++) {
        let x = r() * W;
        let y = r() * H;
        if (r() < 0.6) {
            const edge = Math.floor(r() * 4);
            if (edge === 0)
                y = r() * H * 0.18;
            else if (edge === 1)
                y = H - r() * H * 0.18;
            else if (edge === 2)
                x = r() * W * 0.14;
            else
                x = W - r() * W * 0.14;
        }
        const rad = (1.2 + r() * 2.8) * scale;
        const tone = 80 + r() * 90;
        ctx.fillStyle = "rgba(30,26,20,0.35)";
        ctx.beginPath();
        ctx.ellipse(x + rad * 0.3, y + rad * 0.4, rad, rad * 0.8, 0, 0, Math.PI * 2);
        ctx.fill();
        const g = ctx.createRadialGradient(x - rad * 0.35, y - rad * 0.4, 0, x, y, rad);
        g.addColorStop(0, `rgb(${tone + 28},${tone + 25},${tone + 18})`);
        g.addColorStop(1, `rgb(${tone - 30},${tone - 32},${tone - 36})`);
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.ellipse(x, y, rad, rad * (0.65 + r() * 0.3), r() * Math.PI, 0, Math.PI * 2);
        ctx.fill();
    }
    // river stones
    const palette = ["#6a645a", "#5e5a52", "#77705f", "#55524b", "#7f7666", "#4a4741", "#6b6152"];
    const stones = [];
    for (const [cx, cy, n, spread] of STONE_CLUSTERS) {
        for (let i = 0; i < n; i++) {
            const rx = (8 + r() * 24) * scale * (r() > 0.82 ? 1.7 : 1);
            stones.push({
                x: (cx + (r() - 0.5) * spread * 2) * W,
                y: (cy + (r() - 0.5) * spread * 2 * (W / H) * 0.6) * H,
                rx,
                ry: rx * (0.55 + r() * 0.35),
                a: r() * Math.PI,
                col: palette[Math.floor(r() * palette.length)],
                seed: Array.from({ length: 10 }, () => 0.86 + r() * 0.24),
            });
        }
    }
    stones.sort((a, b) => a.y - b.y);
    for (const s of stones) {
        ctx.save();
        ctx.translate(s.x, s.y);
        ctx.rotate(s.a);
        // contact shadow, soft
        ctx.save();
        if (canBlur)
            ctx.filter = `blur(${Math.max(1, s.rx * 0.18)}px)`;
        ctx.translate(s.rx * 0.14, s.ry * 0.3);
        ctx.fillStyle = "rgba(18,16,10,0.62)";
        blob(ctx, s.rx * 1.12, s.ry * 1.16, s.seed);
        ctx.fill();
        ctx.restore();
        ctx.fillStyle = s.col;
        blob(ctx, s.rx, s.ry, s.seed);
        ctx.fill();
        ctx.save();
        ctx.clip();
        // rounded form: light from the top-left, core shadow bottom-right
        const lit = ctx.createRadialGradient(-s.rx * 0.4, -s.ry * 0.45, 0, -s.rx * 0.2, -s.ry * 0.2, s.rx * 1.25);
        lit.addColorStop(0, "rgba(255,248,228,0.3)");
        lit.addColorStop(0.5, "rgba(255,248,228,0.04)");
        lit.addColorStop(1, "rgba(0,0,0,0.5)");
        ctx.fillStyle = lit;
        ctx.fillRect(-s.rx * 1.3, -s.ry * 1.3, s.rx * 2.6, s.ry * 2.6);
        // grain, flecks and the odd quartz vein
        for (let i = 0; i < 90; i++) {
            ctx.fillStyle = r() > 0.5 ? "rgba(20,20,16,0.18)" : "rgba(240,235,220,0.16)";
            const sz = (0.6 + r() * 1.3) * scale;
            ctx.fillRect((r() - 0.5) * s.rx * 2, (r() - 0.5) * s.ry * 2, sz, sz);
        }
        if (r() < 0.4) {
            ctx.strokeStyle = "rgba(235,230,215,0.35)";
            ctx.lineWidth = (0.8 + r()) * scale;
            ctx.beginPath();
            ctx.moveTo(-s.rx, (r() - 0.5) * s.ry);
            ctx.quadraticCurveTo(0, (r() - 0.5) * s.ry * 1.5, s.rx, (r() - 0.5) * s.ry);
            ctx.stroke();
        }
        // a skin of algae on the sunny crown
        const moss = ctx.createRadialGradient(-s.rx * 0.1, -s.ry * 0.25, 0, -s.rx * 0.1, -s.ry * 0.25, s.rx * 0.8);
        moss.addColorStop(0, `rgba(${90 + r() * 30},${110 + r() * 30},60,0.32)`);
        moss.addColorStop(1, "rgba(90,110,60,0)");
        ctx.fillStyle = moss;
        ctx.fillRect(-s.rx, -s.ry, s.rx * 2, s.ry * 2);
        ctx.restore();
        ctx.restore();
    }
    // sunken leaves and twigs
    for (let i = 0; i < 12; i++) {
        ctx.save();
        ctx.translate(r() * W, r() * H);
        ctx.rotate(r() * Math.PI * 2);
        if (r() < 0.5) {
            ctx.fillStyle = `rgba(${90 + r() * 40},${70 + r() * 20},${40},0.5)`;
            ctx.beginPath();
            ctx.ellipse(0, 0, 6 * scale, 2.6 * scale, 0, 0, Math.PI * 2);
            ctx.fill();
        }
        else {
            ctx.strokeStyle = "rgba(60,48,34,0.5)";
            ctx.lineWidth = 1.4 * scale;
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.quadraticCurveTo(10 * scale, 2 * scale, 22 * scale * (0.6 + r()), -1 * scale);
            ctx.stroke();
        }
        ctx.restore();
    }
    return c;
}
/* --------------------------------------------------------------------------
   Engine
   -------------------------------------------------------------------------- */
export function startPond(host, waterCanvas, swanCanvas, initial = {}) {
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const motion = reduceMotion ? 0.55 : 1;
    let target = { ...DEFAULT_PARAMS, ...initial };
    let params = { ...target };
    let W = host.clientWidth || DESIGN_WIDTH;
    let H = host.clientHeight || DESIGN_WIDTH * 0.62;
    let scale = W / DESIGN_WIDTH;
    let L = 78 * scale;
    /* ---------- offscreen layers ---------- */
    const paint = document.createElement("canvas"); // swans + leaves
    const pctx = paint.getContext("2d");
    const weeds = document.createElement("canvas");
    const wctx = weeds.getContext("2d");
    const surf = document.createElement("canvas"); // wake height map
    const canopy = document.createElement("canvas"); // overhanging vines
    const cctx = canopy.getContext("2d");
    const sctx = surf.getContext("2d");
    /* ---------- WebGL ---------- */
    const gl = waterCanvas.getContext("webgl", { antialias: false, alpha: false, premultipliedAlpha: false });
    let waterProg = null;
    let postProg = null;
    const wu = {};
    const pu = {};
    let tBed = null;
    let tWeeds = null;
    let tSwans = null;
    let tSurf = null;
    let tScene = null;
    let tCanopy = null;
    let fbo = null;
    if (gl) {
        try {
            waterProg = program(gl, WATER_FRAG);
            postProg = program(gl, POST_FRAG);
            const buf = gl.createBuffer();
            gl.bindBuffer(gl.ARRAY_BUFFER, buf);
            gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
            gl.enableVertexAttribArray(0);
            gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
            for (const n of ["uRes", "uTime", "uScale", "uRipples", "uReflSky", "uReflSky2", "uReflTree", "uRefl", "uDeep", "uShallow", "uCaustic", "uSky", "uTint", "uMurk", "uLight", "uGlow", "uTintAmt", "uBed", "uWeeds", "uSwans", "uSurf", "uCanopy", "uSun", "uSunAmt", "uMoon", "uGrade", "uFog", "uFogCol"]) {
                wu[n] = gl.getUniformLocation(waterProg, n);
            }
            for (const n of ["uRes", "uTime", "uScale", "uScene", "uSwans", "uPaint", "uBrush", "uBloom"]) {
                pu[n] = gl.getUniformLocation(postProg, n);
            }
            tBed = makeTexture(gl);
            tWeeds = makeTexture(gl);
            tSwans = makeTexture(gl);
            tSurf = makeTexture(gl);
            tScene = makeTexture(gl);
            tCanopy = makeTexture(gl);
            fbo = gl.createFramebuffer();
        }
        catch (err) {
            console.warn("[swan-pond] shaders unavailable, using flat water", err);
            waterProg = null;
        }
    }
    const hasGL = !!(gl && waterProg && postProg);
    host.dataset.water = hasGL ? "shader" : "flat";
    swanCanvas.style.visibility = hasGL ? "hidden" : "visible";
    const ctx = swanCanvas.getContext("2d");
    let dpr = 1; // swan canvas (fallback only)
    let wd = Math.min(window.devicePixelRatio || 1, 1.5); // render resolution
    let maxWd = wd;
    /* ---------- weeds ---------- */
    let strands = [];
    const buildWeeds = () => {
        const r = mulberry32(19);
        strands = [];
        for (const [sx, sy, lean, n] of WEED_SITES) {
            for (let i = 0; i < n; i++) {
                const g = 40 + r() * 40;
                const ribbon = r() < 0.35;
                strands.push({
                    bx: (sx + (r() - 0.5) * 0.06) * W,
                    by: (sy + (r() - 0.5) * 0.06) * H,
                    ang: lean + (r() - 0.5) * 1.2,
                    len: (ribbon ? 70 + r() * 80 : 30 + r() * 60) * scale,
                    w: (ribbon ? 2.4 + r() * 1.6 : 1.4 + r() * 1.8) * scale,
                    curl: (r() - 0.5) * 0.012 / scale,
                    phase: r() * 10,
                    freq: 0.6 + r() * 0.6,
                    col: `rgba(${Math.round(g * 0.55)},${Math.round(g + 30)},${Math.round(g * 0.45)},${0.75 + r() * 0.2})`,
                    rib: `rgba(${Math.round(g + 60)},${Math.round(g + 90)},${Math.round(g + 30)},0.35)`,
                });
            }
        }
    };
    const currentAngle = () => 0.25 + Math.sin(clock * 0.03) * 0.3;
    const drawWeeds = () => {
        const k = weeds.width / W;
        wctx.setTransform(k, 0, 0, k, 0, 0);
        wctx.clearRect(0, 0, W, H);
        const ca = currentAngle();
        const segs = 8;
        for (const s of strands) {
            // passing ripples rock the weed
            let stir = 0;
            for (const rp of ripples) {
                const age = clock - rp.t;
                if (age < 0 || age > 3)
                    continue;
                const front = Math.abs(Math.hypot(s.bx - rp.x, s.by - rp.y) - 92 * scale * age);
                if (front < 70 * scale)
                    stir += rp.a * (1 - front / (70 * scale)) * (1 - age / 3);
            }
            let x = s.bx;
            let y = s.by;
            let a = s.ang;
            const seg = s.len / segs;
            const left = [];
            const right = [];
            const mid = [];
            for (let i = 0; i <= segs; i++) {
                const u = i / segs;
                const wv = s.w * Math.pow(1 - u, 0.6) + 0.3 * scale;
                const nx = -Math.sin(a) * wv;
                const ny = Math.cos(a) * wv;
                left.push([x + nx, y + ny]);
                right.push([x - nx, y - ny]);
                mid.push([x, y]);
                const sway = Math.sin(clock * s.freq + s.phase - u * 2.2) * (0.06 + stir * 0.12) +
                    Math.sin(clock * 0.37 * s.freq + s.phase * 1.7) * 0.04;
                a += s.curl * seg + sway * u + wrapAngle(ca - a) * 0.035 * u;
                x += Math.cos(a) * seg;
                y += Math.sin(a) * seg;
            }
            wctx.fillStyle = s.col;
            wctx.beginPath();
            wctx.moveTo(left[0][0], left[0][1]);
            for (const p of left)
                wctx.lineTo(p[0], p[1]);
            for (let i = right.length - 1; i >= 0; i--)
                wctx.lineTo(right[i][0], right[i][1]);
            wctx.closePath();
            wctx.fill();
            wctx.strokeStyle = s.rib;
            wctx.lineWidth = 0.7 * scale;
            wctx.beginPath();
            mid.forEach((p, i) => (i ? wctx.lineTo(p[0], p[1]) : wctx.moveTo(p[0], p[1])));
            wctx.stroke();
        }
    };
    let branches = [];
    // where blossoms are this frame, so petals can fall from them
    let bloomSpots = [];
    const leafColour = (r) => {
        const h = 88 + r() * 40;
        const sat = 30 + r() * 25;
        const l = 20 + r() * 22;
        return { col: `hsl(${h} ${sat}% ${l}%)`, hi: `hsl(${h - 6} ${sat + 8}% ${l + 12}%)` };
    };
    // Leafy limbs reaching in from beyond the frame: they fork, and every twig
    // ends in a full clump of leaves, with blossom tucked among them.
    const buildVines = () => {
        const r = mulberry32(31);
        const leaf = (t, off, size) => ({
            t,
            off,
            side: r() < 0.5 ? -1 : 1,
            r: size * scale,
            rot: (r() - 0.5) * 1.1,
            flutter: r() * 10,
            ...leafColour(r),
        });
        const grow = (bx, by, ang, len, depth, at) => {
            const n = Math.max(5, Math.round(len / (3.4 * scale)));
            const leaves = [];
            for (let i = 0; i < n; i++) {
                const t = 0.12 + (i / n) * 0.88;
                leaves.push(leaf(t, (r() - 0.5) * 7 * scale, (4.8 + r() * 3) * (1.1 - t * 0.3)));
            }
            // the clump at the tip
            const clump = 10 + Math.floor(r() * 8);
            for (let i = 0; i < clump; i++) {
                leaves.push(leaf(0.82 + r() * 0.2, (r() - 0.5) * 26 * scale, 4.4 + r() * 3.2));
            }
            const blooms = [];
            const nb = Math.round(n * 0.18 + clump * 0.35);
            for (let i = 0; i < nb; i++) {
                blooms.push({
                    t: 0.35 + r() * 0.7,
                    off: (r() - 0.5) * 22 * scale,
                    r: (2.3 + r() * 1.6) * scale,
                    rot: r() * Math.PI,
                    hue: 342 + r() * 14,
                    light: 86 + r() * 8,
                });
            }
            const br = {
                bx,
                by,
                ang,
                len,
                curve: (r() - 0.5) * 1.3 / len,
                width: (1.2 + depth * 1.2) * scale,
                phase: r() * 10,
                at,
                leaves,
                blooms,
                kids: [],
            };
            if (depth > 0) {
                const k = 2 + Math.floor(r() * 2);
                for (let i = 0; i < k; i++) {
                    const side = i % 2 ? 1 : -1;
                    br.kids.push(grow(0, 0, side * (0.4 + r() * 0.55), len * (0.38 + r() * 0.22), depth - 1, 0.25 + r() * 0.55));
                }
            }
            return br;
        };
        branches = [
            // kept to the margins: corners and the odd spray along the sides
            grow(-0.06 * W, -0.08 * H, 0.72, 0.28 * W, 2, 0),
            grow(-0.07 * W, 0.22 * H, 0.12, 0.14 * W, 2, 0),
            grow(1.06 * W, -0.05 * H, Math.PI - 0.6, 0.23 * W, 2, 0),
            grow(1.07 * W, 0.55 * H, Math.PI + 0.1, 0.1 * W, 1, 0),
            grow(1.06 * W, 0.98 * H, Math.PI + 0.62, 0.19 * W, 2, 0),
            grow(-0.07 * W, 0.8 * H, -0.22, 0.14 * W, 2, 0),
        ];
    };
    const drawVineLeaf = (x, y, l, rot) => {
        const k = canopy.width / W;
        const c = Math.cos(rot);
        const sn = Math.sin(rot);
        cctx.setTransform(c * k, sn * k, -sn * k, c * k, x * k, y * k);
        const r = l.r;
        const st = r * 0.55; // petiole
        cctx.strokeStyle = "rgba(48,60,30,0.85)";
        cctx.lineWidth = 0.7 * scale;
        cctx.beginPath();
        cctx.moveTo(0, 0);
        cctx.lineTo(st, 0);
        cctx.stroke();
        // ivy-ish leaf: notched base, broad shoulders, pointed tip
        const half = (side) => {
            cctx.beginPath();
            cctx.moveTo(st, 0);
            cctx.bezierCurveTo(st - r * 0.2, side * r * 0.75, st + r * 0.9, side * r * 1.0, st + r * 1.4, side * r * 0.45);
            cctx.quadraticCurveTo(st + r * 1.75, side * r * 0.18, st + r * 2.05, 0);
            cctx.lineTo(st + r * 0.15, 0);
            cctx.closePath();
        };
        cctx.fillStyle = l.hi;
        half(-1);
        cctx.fill();
        cctx.fillStyle = l.col;
        half(1);
        cctx.fill();
        cctx.strokeStyle = "rgba(18,34,16,0.4)";
        cctx.lineWidth = 0.5 * scale;
        cctx.beginPath();
        cctx.moveTo(st, 0);
        cctx.lineTo(st + r * 1.8, 0);
        cctx.stroke();
    };
    const drawBloom = (x, y, b, rot) => {
        const k = canopy.width / W;
        const c = Math.cos(rot);
        const sn = Math.sin(rot);
        cctx.setTransform(c * k, sn * k, -sn * k, c * k, x * k, y * k);
        // five soft petals, a darker heart, a speck of pollen
        cctx.fillStyle = `hsl(${b.hue} 85% ${b.light}%)`;
        for (let i = 0; i < 5; i++) {
            const a = (i / 5) * Math.PI * 2;
            cctx.beginPath();
            cctx.ellipse(Math.cos(a) * b.r * 0.62, Math.sin(a) * b.r * 0.62, b.r * 0.62, b.r * 0.46, a, 0, Math.PI * 2);
            cctx.fill();
        }
        cctx.fillStyle = `hsl(${b.hue - 4} 62% ${b.light - 22}%)`;
        cctx.beginPath();
        cctx.arc(0, 0, b.r * 0.34, 0, Math.PI * 2);
        cctx.fill();
        cctx.fillStyle = "hsl(48 80% 70%)";
        cctx.beginPath();
        cctx.arc(0, 0, b.r * 0.14, 0, Math.PI * 2);
        cctx.fill();
    };
    const drawVines = () => {
        const k = canopy.width / W;
        cctx.setTransform(1, 0, 0, 1, 0, 0);
        cctx.clearRect(0, 0, canopy.width, canopy.height);
        const breeze = Math.sin(clock * 0.31) * 0.6 + Math.sin(clock * 0.83 + 1) * 0.4;
        bloomSpots = [];
        const draw = (br, x0, y0, baseAng) => {
            // the whole limb rocks a little from its base; tips move most
            const segs = 9;
            const pts = [];
            let x = x0;
            let y = y0;
            let a = baseAng + Math.sin(clock * 0.45 + br.phase) * 0.025 + breeze * 0.012;
            for (let i = 0; i <= segs; i++) {
                pts.push([x, y, a]);
                const u = i / segs;
                a += br.curve * (br.len / segs) + Math.sin(clock * 0.7 + br.phase - u * 1.4) * 0.008 * u;
                a += wrapAngle(Math.PI / 2 - a) * 0.025 * u;
                x += Math.cos(a) * (br.len / segs);
                y += Math.sin(a) * (br.len / segs);
            }
            const at = (t, off) => {
                const f = Math.min(1, t) * segs;
                const i = Math.min(segs - 1, Math.floor(f));
                const u = f - i;
                const p0 = pts[i];
                const p1 = pts[i + 1];
                const ang = p0[2] + (p1[2] - p0[2]) * u;
                // past the tip, keep going a little so clumps sit beyond the twig end
                const over = Math.max(0, t - 1) * br.len;
                return {
                    x: p0[0] + (p1[0] - p0[0]) * u + Math.cos(ang) * over - Math.sin(ang) * off,
                    y: p0[1] + (p1[1] - p0[1]) * u + Math.sin(ang) * over + Math.cos(ang) * off,
                    a: ang,
                };
            };
            cctx.setTransform(k, 0, 0, k, 0, 0);
            cctx.strokeStyle = "rgba(58,52,34,0.9)";
            cctx.lineCap = "round";
            for (let i = 0; i < segs; i++) {
                cctx.lineWidth = br.width * (1 - (i / segs) * 0.7);
                cctx.beginPath();
                cctx.moveTo(pts[i][0], pts[i][1]);
                cctx.lineTo(pts[i + 1][0], pts[i + 1][1]);
                cctx.stroke();
            }
            for (const kid of br.kids) {
                const q = at(kid.at, 0);
                draw(kid, q.x, q.y, q.a + kid.ang);
            }
            for (const l of br.leaves) {
                const q = at(l.t, l.off);
                const flutter = Math.sin(clock * 1.7 + l.flutter) * 0.12 + breeze * 0.05;
                let la = q.a + l.side * (0.85 + l.rot * 0.6) + flutter;
                la += wrapAngle(Math.PI / 2 - la) * 0.25;
                drawVineLeaf(q.x, q.y, l, la);
            }
            for (const b of br.blooms) {
                const q = at(b.t, b.off);
                drawBloom(q.x, q.y, b, b.rot + Math.sin(clock * 1.2 + b.rot * 7) * 0.1);
                if (q.x > -10 && q.x < W + 10 && q.y > -10 && q.y < H + 10)
                    bloomSpots.push([q.x, q.y, b.hue]);
            }
        };
        for (const br of branches)
            draw(br, br.bx, br.by, br.ang);
        cctx.setTransform(1, 0, 0, 1, 0, 0);
    };
    /* ---------- corn ---------- */
    const updateKernels = (dt) => {
        const ca = currentAngle();
        for (let i = kernels.length - 1; i >= 0; i--) {
            const k = kernels[i];
            if (k.delay > 0) {
                k.delay -= dt;
                continue;
            }
            k.age += dt;
            if (!k.landed) {
                k.z -= dt * 2.4;
                k.x += k.vx * dt;
                k.y += k.vy * dt;
                k.a += dt * 6;
                if (k.z <= 0) {
                    k.z = 0;
                    k.landed = true;
                    k.age = 0;
                    addRipple(k.x, k.y, 0.09);
                }
            }
            else {
                // bobbing a moment on the surface, drifting with the current
                k.vx += (Math.cos(ca) * 3 * scale - k.vx) * (1 - Math.exp(-dt * 1.5));
                k.vy += (Math.sin(ca) * 3 * scale - k.vy) * (1 - Math.exp(-dt * 1.5));
                k.x += k.vx * dt;
                k.y += k.vy * dt;
            }
            if ((k.eatenAt >= 0 && clock >= k.eatenAt) || k.age > 26)
                kernels.splice(i, 1);
        }
    };
    const drawKernel = (c, k) => {
        if (k.delay > 0)
            return;
        const sc = k.landed ? 1 : 1 + k.z * 1.2;
        // uneaten corn slowly sinks out of sight
        const alpha = k.landed ? clamp((26 - k.age) / 8, 0, 1) : 1;
        const s = 2.6 * scale * sc;
        c.save();
        c.globalAlpha = alpha;
        c.translate(k.x, k.y);
        c.rotate(k.a);
        const g = c.createRadialGradient(-s * 0.3, -s * 0.3, 0, 0, 0, s * 1.3);
        g.addColorStop(0, "#fff1b0");
        g.addColorStop(0.45, "#f3c440");
        g.addColorStop(1, "#c98a1c");
        c.fillStyle = g;
        c.beginPath();
        c.moveTo(-s * 1.05, -s * 0.15);
        c.quadraticCurveTo(-s * 0.9, -s * 0.95, s * 0.2, -s * 0.85);
        c.quadraticCurveTo(s * 1.1, -s * 0.5, s * 1.0, 0);
        c.quadraticCurveTo(s * 1.1, s * 0.5, s * 0.2, s * 0.85);
        c.quadraticCurveTo(-s * 0.9, s * 0.95, -s * 1.05, s * 0.15);
        c.closePath();
        c.fill();
        c.fillStyle = "rgba(255,250,225,0.7)";
        c.beginPath();
        c.ellipse(-s * 0.55, 0, s * 0.3, s * 0.2, 0, 0, Math.PI * 2);
        c.fill();
        c.restore();
    };
    const petals = [];
    let nextPetal = 1.5;
    const updatePetals = (dt) => {
        nextPetal -= dt;
        if (nextPetal <= 0 && bloomSpots.length && petals.length < 34) {
            const [x, y, hue] = bloomSpots[Math.floor(Math.random() * bloomSpots.length)];
            petals.push({ x, y, z: 1, vx: rand(-4, 8) * scale, vy: rand(-2, 6) * scale, a: rand(0, Math.PI * 2), va: rand(-2, 2), size: rand(2.6, 3.8) * scale, hue, age: 0, landed: false });
            nextPetal = rand(0.9, 2.8);
        }
        const ca = currentAngle();
        for (let i = petals.length - 1; i >= 0; i--) {
            const f = petals[i];
            f.age += dt;
            if (!f.landed) {
                // tumbling on the air, drifting with the breeze
                f.z -= dt * 0.22;
                f.x += (f.vx + Math.sin(f.age * 2.1 + f.hue) * 9 * scale) * dt;
                f.y += (f.vy + Math.cos(f.age * 1.7 + f.hue) * 5 * scale) * dt;
                f.a += f.va * dt * 2.2;
                if (f.z <= 0) {
                    f.z = 0;
                    f.landed = true;
                    f.age = 0;
                    addRipple(f.x, f.y, 0.07);
                }
            }
            else {
                // afloat: carried by the current, nudged aside by swans
                let tx = Math.cos(ca) * 6 * scale;
                let ty = Math.sin(ca) * 6 * scale;
                for (const s of swans) {
                    if (s.state === "away")
                        continue;
                    const dx = f.x - s.x;
                    const dy = f.y - s.y;
                    const d = Math.hypot(dx, dy);
                    const R = L * s.size;
                    if (d < R && d > 0) {
                        const k = (1 - d / R) * (s.v + 20 * scale) * 1.6;
                        tx += (dx / d) * k;
                        ty += (dy / d) * k;
                    }
                }
                f.vx += (tx - f.vx) * (1 - Math.exp(-dt * 1.2));
                f.vy += (ty - f.vy) * (1 - Math.exp(-dt * 1.2));
                f.x += f.vx * dt;
                f.y += f.vy * dt;
                f.va *= Math.exp(-dt * 0.8);
                f.a += f.va * dt;
                if (f.age > 40 || f.x < -30 || f.x > W + 30 || f.y < -30 || f.y > H + 30)
                    petals.splice(i, 1);
            }
        }
    };
    const drawPetal = (c, f) => {
        // falling petals are nearer the eye, so drawn larger; floating ones fade in time
        const sc = f.landed ? 1 : 1 + f.z * 0.9;
        const alpha = f.landed ? Math.min(1, (40 - f.age) / 6) : 0.95;
        const s = f.size * sc;
        c.save();
        c.globalAlpha = alpha;
        c.translate(f.x, f.y);
        c.rotate(f.a);
        // tumbling: the petal foreshortens as it turns
        if (!f.landed)
            c.scale(1, 0.45 + 0.55 * Math.abs(Math.sin(f.age * 3 + f.hue)));
        const g = c.createLinearGradient(-s, 0, s, 0);
        g.addColorStop(0, `hsl(${f.hue} 62% 72%)`);
        g.addColorStop(1, `hsl(${f.hue} 75% 88%)`);
        c.fillStyle = g;
        c.beginPath();
        c.moveTo(-s, 0);
        c.bezierCurveTo(-s * 0.4, -s * 0.85, s * 0.7, -s * 0.8, s, -s * 0.15);
        c.lineTo(s * 0.8, 0);
        c.lineTo(s, s * 0.15);
        c.bezierCurveTo(s * 0.7, s * 0.8, -s * 0.4, s * 0.85, -s, 0);
        c.closePath();
        c.fill();
        c.restore();
    };
    /* ---------- sizing ---------- */
    let sceneW = 1;
    let sceneK = 0.7; // water pass resolution, relative to the output
    let sceneH = 1;
    // while recording in high quality: the output width, and the settings to go back to
    let hqWidth = 0;
    let beforeHq = { wd: 1, sceneK: 0.7 };
    const sizeLayers = () => {
        // the swans stay sharp even when the water is rendered small
        if (hqWidth)
            wd = hqWidth / W;
        const pr = hasGL ? (hqWidth ? wd : Math.min(window.devicePixelRatio || 1, 1.5)) : dpr;
        paint.width = Math.round(W * pr);
        paint.height = Math.round(H * pr);
        // weeds are seen through moving water, so they can be a little soft
        const wk = hqWidth ? 1.5 : 0.75;
        weeds.width = Math.round(W * wk);
        weeds.height = Math.round(H * wk);
        const ck = hqWidth ? wd : Math.min(wd, 1);
        canopy.width = Math.round(W * ck);
        canopy.height = Math.round(H * ck);
        surf.width = Math.round(W * 0.5);
        surf.height = Math.round(H * 0.5);
        if (hasGL && gl) {
            waterCanvas.width = Math.round(W * wd);
            waterCanvas.height = Math.round(H * wd);
            // the heavy water pass runs at ~70% resolution; the paint pass upsamples it
            sceneW = Math.max(1, Math.round(waterCanvas.width * sceneK));
            sceneH = Math.max(1, Math.round(waterCanvas.height * sceneK));
            gl.bindTexture(gl.TEXTURE_2D, tScene);
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, sceneW, sceneH, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
            gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
            gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tScene, 0);
            gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        }
    };
    // A softly torn edge, like the deckled border of watercolour paper. Built
    // per pixel so it looks the same in every browser.
    let edgeMask = null;
    const featherEdge = () => {
        const mw = Math.max(1, Math.round(W / 2));
        const mh = Math.max(1, Math.round(H / 2));
        const m = document.createElement("canvas");
        m.width = mw;
        m.height = mh;
        const mc = m.getContext("2d");
        const img = mc.createImageData(mw, mh);
        const r = mulberry32(5);
        const perm = Array.from({ length: 512 }, () => r());
        const n1 = (x) => {
            const i = Math.floor(x);
            const f = x - i;
            const u = f * f * (3 - 2 * f);
            return perm[i & 511] * (1 - u) + perm[(i + 1) & 511] * u;
        };
        // ragged profile along the edge: big bites, then fibres
        const rag = (t) => n1(t * 0.03) * 0.7 + n1(t * 0.1 + 40) * 0.24 + n1(t * 0.4 + 90) * 0.06;
        const k = 2; // mask is half resolution
        const inset = 9 * scale;
        const rad = 34 * scale;
        const depth = 6 * scale; // how far the tear wanders
        const soft = 7 * scale; // the fuzz of torn fibres
        for (let py = 0; py < mh; py++) {
            for (let px = 0; px < mw; px++) {
                const x = px * k;
                const y = py * k;
                // signed distance inside a rounded rectangle
                const qx = Math.abs(x - W / 2) - (W / 2 - inset - rad);
                const qy = Math.abs(y - H / 2) - (H / 2 - inset - rad);
                const outside = Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - rad;
                const d = -outside;
                // position along the perimeter picks the tear profile
                const t = Math.atan2(y - H / 2, x - W / 2) * (W + H) * 0.32 / scale;
                const edge = depth * rag(t + 1000);
                // a soft fibrous fringe, then a gentle feather into the paper
                let a = (d - edge) / soft;
                a = a < 0 ? 0 : a > 1 ? 1 : a;
                a = a * a * (3 - 2 * a);
                let f = (d - edge) / (22 * scale);
                f = f < 0 ? 0 : f > 1 ? 1 : f;
                a *= 0.55 + 0.45 * f;
                const o = (py * mw + px) * 4;
                img.data[o] = 0;
                img.data[o + 1] = 0;
                img.data[o + 2] = 0;
                img.data[o + 3] = Math.round(a * 255);
            }
        }
        mc.putImageData(img, 0, 0);
        edgeMask = m;
        const url = `url(${m.toDataURL("image/png")})`;
        host.style.setProperty("-webkit-mask-image", url);
        host.style.setProperty("mask-image", url);
        host.style.setProperty("-webkit-mask-size", "100% 100%");
        host.style.setProperty("mask-size", "100% 100%");
        host.style.setProperty("-webkit-mask-repeat", "no-repeat");
        host.style.setProperty("mask-repeat", "no-repeat");
        host.style.setProperty("-webkit-mask-composite", "source-over");
        host.style.setProperty("mask-composite", "add");
        host.style.borderRadius = "0";
    };
    const resize = () => {
        const nw = host.clientWidth;
        const nh = host.clientHeight;
        if (!nw || !nh)
            return;
        const sx = nw / W;
        const sy = nh / H;
        for (const s of swans) {
            s.x *= sx;
            s.y *= sy;
            s.tx *= sx;
            s.ty *= sy;
            s.trail.length = 0;
        }
        for (const r of ripples) {
            r.x *= sx;
            r.y *= sy;
        }
        for (const f of leaves) {
            f.x *= sx;
            f.y *= sy;
        }
        W = nw;
        H = nh;
        scale = W / DESIGN_WIDTH;
        L = 78 * scale;
        dpr = Math.min(window.devicePixelRatio || 1, 2);
        swanCanvas.width = Math.round(W * dpr);
        swanCanvas.height = Math.round(H * dpr);
        sizeLayers();
        buildWeeds();
        buildVines();
        featherEdge();
        if (hasGL && gl) {
            gl.bindTexture(gl.TEXTURE_2D, tBed);
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, paintBed(W, H, scale));
        }
    };
    /* ---------- ripples ---------- */
    const ripples = [];
    const rippleData = new Float32Array(MAX_RIPPLES * 4);
    let clock = 0;
    const addRipple = (x, y, a, delay = 0) => {
        if (ripples.length >= MAX_RIPPLES) {
            let oldest = 0;
            for (let i = 1; i < ripples.length; i++)
                if (ripples[i].t < ripples[oldest].t)
                    oldest = i;
            ripples.splice(oldest, 1);
        }
        ripples.push({ x, y, t: clock + delay, a });
    };
    /* ---------- swans ---------- */
    const swans = [];
    const glideSpeed = (s) => 0.69 * L * s.pace * motion;
    const inner = (m) => ({ x0: m, y0: m, x1: W - m, y1: H - m });
    const pickWaypoint = (s) => {
        const b = inner(1.7 * L);
        let best = { x: W / 2, y: H / 2 };
        let bestScore = -Infinity;
        for (let i = 0; i < 6; i++) {
            const x = rand(b.x0, b.x1);
            const y = rand(b.y0, b.y1);
            // far from here, and not where another swan is heading or sitting
            let score = Math.hypot(x - s.x, y - s.y);
            for (const o of swans) {
                if (o === s || o.state === "away")
                    continue;
                score += Math.min(Math.hypot(x - o.tx, y - o.ty), Math.hypot(x - o.x, y - o.y)) * 0.8;
            }
            if (score > bestScore) {
                best = { x, y };
                bestScore = score;
            }
        }
        s.tx = best.x;
        s.ty = best.y;
        s.targetTimer = rand(9, 16);
    };
    const makeSwan = (i) => {
        const s = {
            x: W * (0.22 + 0.28 * i),
            y: H * [0.35, 0.65, 0.4][i % 3],
            h: rand(-Math.PI, Math.PI),
            w: 0,
            v: 0,
            size: [1.08, 0.93, 1][i % 3] * rand(0.97, 1.03),
            pace: [0.9, 1.08, 0.97][i % 3] * rand(0.95, 1.05),
            state: "glide",
            tx: 0,
            ty: 0,
            targetTimer: 0,
            loopTime: 0,
            loopDir: 1,
            fleeAt: -1,
            fleeX: 0,
            fleeY: 0,
            awayUntil: 0,
            flapT: -1,
            flapDur: 2,
            flapBeats: 3,
            nextFlap: rand(6, 18),
            tailPhase: rand(0, 10),
            tailAmp: 0.05,
            paddle: rand(0, 10),
            headYaw: 0,
            headYawTarget: 0,
            nextLook: rand(1, 4),
            trail: [],
            lastTrail: 0,
            nextRipple: rand(0, 2),
            look: makeLook(i),
            turnMul: [0.85, 1.15, 1][i % 3],
            loopiness: [0.05, 0.02, 0.035][i % 3],
            restless: [0.7, 1, 1.4][i % 3],
            bend: 0,
            bendV: 0,
            swayPhase: rand(0, 10),
            act: "none",
            actT: 0,
            actDur: 0,
            actSide: 1,
            nextAct: rand(4, 12),
            noticeAt: -1,
            appetite: 0,
            ate: 0,
            food: null,
            sayAt: -1,
            sayText: "",
            sayMood: "calm",
            sayLife: 1,
            feedUntil: 0,
        };
        s.v = glideSpeed(s);
        return s;
    };
    for (let i = 0; i < SWAN_COUNT; i++)
        swans.push(makeSwan(i));
    for (const s of swans)
        pickWaypoint(s);
    const nearestOther = (s) => {
        let d = Infinity;
        for (const o of swans)
            if (o !== s && o.state !== "away")
                d = Math.min(d, Math.hypot(o.x - s.x, o.y - s.y));
        return d;
    };
    const startFlap = (s, quick) => {
        if (s.flapT >= 0)
            return;
        // a swan needs elbow room to open its wings
        if (nearestOther(s) < 3.4 * L * s.size)
            return;
        s.flapT = 0;
        s.flapDur = quick ? rand(1.1, 1.4) : rand(1.8, 2.6);
        s.flapBeats = quick ? 3 : Math.random() < 0.35 ? 1 : rand(2, 4);
    };
    const flapSpread = (s) => {
        if (s.flapT < 0)
            return 0;
        const u = clamp(s.flapT / s.flapDur, 0, 1);
        const env = smooth(Math.sin(Math.PI * u));
        const beat = 0.5 + 0.5 * Math.cos(u * s.flapBeats * Math.PI * 2);
        return env * (0.55 + 0.45 * beat);
    };
    const actionEnvelope = (s) => {
        if (s.act === "none")
            return 0;
        const u = clamp(s.actT / s.actDur, 0, 1);
        return smooth(clamp(u / 0.25, 0, 1)) * smooth(clamp((1 - u) / 0.25, 0, 1));
    };
    const headWorld = (s) => {
        const sz = L * s.size;
        const reach = 0.2 + s.look.neckLen * 1.1;
        return { hx: s.x + Math.cos(s.h) * reach * sz, hy: s.y + Math.sin(s.h) * reach * sz };
    };
    const spawnReturn = (s) => {
        const b = inner(2.2 * L);
        const out = 0.75 * L * s.size;
        const perim = 2 * (W + H);
        const along = (t, len) => len * (0.15 + 0.7 * t);
        // try a few entry points; take the one furthest from everyone else
        let best = { x: 0, y: 0 };
        let bestD = -1;
        for (let k = 0; k < 6; k++) {
            const pos = Math.random() * perim;
            let x;
            let y;
            if (pos < W) {
                x = along(pos / W, W);
                y = -out;
            }
            else if (pos < W + H) {
                x = W + out;
                y = along((pos - W) / H, H);
            }
            else if (pos < 2 * W + H) {
                x = along((pos - W - H) / W, W);
                y = H + out;
            }
            else {
                x = -out;
                y = along((pos - 2 * W - H) / H, H);
            }
            let d = Infinity;
            for (const o of swans)
                if (o !== s && o.state !== "away")
                    d = Math.min(d, Math.hypot(x - o.x, y - o.y));
            if (d > bestD) {
                bestD = d;
                best = { x, y };
            }
        }
        s.x = best.x;
        s.y = best.y;
        s.tx = rand(b.x0 + W * 0.1, b.x1 - W * 0.1);
        s.ty = rand(b.y0, b.y1);
        s.h = Math.atan2(s.ty - s.y, s.tx - s.x) + rand(-0.45, 0.45);
        s.w = 0;
        s.v = glideSpeed(s) * 2;
        s.state = "return";
        s.trail.length = 0;
        s.flapT = -1;
        s.headYawTarget = 0;
        s.act = "none";
    };
    /* ---------- leaves ---------- */
    const leaves = [];
    const spawnLeaf = (f, anywhere) => {
        const leaf = f ?? {};
        const ca = currentAngle();
        if (anywhere) {
            leaf.x = rand(0.1, 0.9) * W;
            leaf.y = rand(0.1, 0.9) * H;
        }
        else {
            // enter from upstream
            leaf.x = -12 * scale + Math.random() * W * 0.3 * Math.max(0, -Math.cos(ca));
            leaf.y = rand(0.05, 0.95) * H;
        }
        leaf.a = rand(0, Math.PI * 2);
        leaf.va = rand(-0.2, 0.2);
        leaf.vx = 0;
        leaf.vy = 0;
        leaf.size = rand(5, 8.5) * scale;
        leaf.hue = rand(18, 48);
        leaf.curl = rand(-0.3, 0.3);
        return leaf;
    };
    for (let i = 0; i < LEAF_COUNT; i++)
        leaves.push(spawnLeaf(null, true));
    const updateLeaves = (dt) => {
        const ca = currentAngle();
        for (const f of leaves) {
            const drift = 7 * scale * motion;
            const wob = Math.sin(clock * 0.3 + f.hue) * 0.4;
            let tx = Math.cos(ca + wob) * drift;
            let ty = Math.sin(ca + wob) * drift;
            for (const s of swans) {
                if (s.state === "away")
                    continue;
                const dx = f.x - s.x;
                const dy = f.y - s.y;
                const d = Math.hypot(dx, dy);
                const R = 1.0 * L * s.size;
                if (d < R && d > 0) {
                    const k = (1 - d / R) * (s.v + 20 * scale) * 1.6;
                    tx += (dx / d) * k;
                    ty += (dy / d) * k;
                    f.va += (Math.random() - 0.5) * dt * 3;
                }
            }
            f.vx += (tx - f.vx) * (1 - Math.exp(-dt * 1.2));
            f.vy += (ty - f.vy) * (1 - Math.exp(-dt * 1.2));
            f.x += f.vx * dt;
            f.y += f.vy * dt;
            f.va *= Math.exp(-dt * 0.6);
            f.a += f.va * dt;
            const m = 20 * scale;
            if (f.x < -m - 30 * scale || f.x > W + m || f.y < -m || f.y > H + m)
                spawnLeaf(f, false);
        }
    };
    const drawLeaf = (c, f) => {
        c.save();
        c.translate(f.x, f.y);
        c.rotate(f.a);
        const s = f.size;
        const g = c.createLinearGradient(-s, -s * 0.4, s, s * 0.4);
        g.addColorStop(0, `hsla(${f.hue + 8},70%,52%,0.95)`);
        g.addColorStop(1, `hsla(${f.hue - 6},60%,34%,0.95)`);
        c.fillStyle = g;
        c.beginPath();
        c.moveTo(-s, 0);
        c.quadraticCurveTo(-s * 0.2, -s * (0.55 + f.curl * 0.3), s, 0);
        c.quadraticCurveTo(-s * 0.2, s * (0.55 - f.curl * 0.3), -s, 0);
        c.closePath();
        c.fill();
        c.strokeStyle = `hsla(${f.hue + 15},60%,72%,0.6)`;
        c.lineWidth = 0.6 * scale;
        c.beginPath();
        c.moveTo(-s * 1.15, 0);
        c.lineTo(s * 0.9, 0);
        c.stroke();
        c.restore();
    };
    /* ---------- pointer ---------- */
    let pointer = null;
    let lastHover = { x: -1e9, y: -1e9, t: -1 };
    const local = (e) => {
        const r = host.getBoundingClientRect();
        return { x: ((e.clientX - r.left) / r.width) * W, y: ((e.clientY - r.top) / r.height) * H };
    };
    const onMove = (e) => {
        const p = local(e);
        pointer = p;
        const d = Math.hypot(p.x - lastHover.x, p.y - lastHover.y);
        if (d > 26 * scale && clock - lastHover.t > 0.08) {
            addRipple(p.x, p.y, clamp(0.12 + d / (160 * scale), 0.14, 0.34));
            lastHover = { x: p.x, y: p.y, t: clock };
        }
    };
    const onLeave = () => {
        pointer = null;
    };
    const kernels = [];
    // a small handful: 4–8 kernels, scattered as they leave the hand
    const throwCorn = (px, py) => {
        const n = 4 + Math.floor(Math.random() * 5);
        for (let i = 0; i < n; i++) {
            const a = Math.random() * Math.PI * 2;
            const r = Math.sqrt(Math.random()) * 26 * scale;
            kernels.push({
                x: px + Math.cos(a) * r * 0.3,
                y: py + Math.sin(a) * r * 0.3,
                z: 1,
                delay: Math.random() * 0.22,
                vx: Math.cos(a) * r * 1.6,
                vy: Math.sin(a) * r * 1.6,
                a: Math.random() * Math.PI * 2,
                age: 0,
                landed: false,
                eatenAt: -1,
            });
        }
        // each swan decides how hungry it is; most take one or two, a greedy one more
        for (const s of swans) {
            if (s.state === "away" || s.state === "flee" || s.fleeAt >= 0)
                continue;
            const d = Math.hypot(s.x - px, s.y - py);
            if (s.state !== "feed") {
                s.appetite = [1, 1, 2, 2, 2, 3][Math.floor(Math.random() * 6)];
                s.ate = 0;
                s.noticeAt = clock + 0.35 + d / (W * 0.9) + rand(0, 0.5);
            }
            else {
                s.appetite += Math.random() < 0.5 ? 1 : 0;
            }
        }
        // the nearest one calls dibs, and another has an opinion about that
        // ...but not every time: at least three handfuls go by before it happens again
        feedsSinceDibs++;
        if (feedsSinceDibs > 3) {
            const near = swans
                .filter((s) => s.state !== "away" && s.state !== "flee" && s.fleeAt < 0 && s.x > 0 && s.x < W && s.y > 0 && s.y < H)
                .sort((a, b) => Math.hypot(a.x - px, a.y - py) - Math.hypot(b.x - px, b.y - py));
            if (near.length) {
                feedsSinceDibs = 0;
                const first = near[0];
                const at = Math.max(clock + 0.15, first.noticeAt) + 0.05;
                sayLater(first, "dibs!", "calm", 1.1, at);
                if (near.length > 1)
                    sayLater(near[1], "glutton!", "calm", 1.2, at + rand(1.0, 1.3));
            }
        }
    };
    const touchy = window.matchMedia("(hover: none)").matches;
    const onCtx = (e) => e.preventDefault(); // right-click feeds instead of opening a menu
    let holdTimer = 0;
    let holdFed = false;
    const onUp = () => clearTimeout(holdTimer);
    const splash = (p) => {
        startle(p);
    };
    const feed = (p) => {
        throwCorn(p.x, p.y);
    };
    const onDown = (e) => {
        const p = local(e);
        if (e.pointerType === "mouse" || e.pointerType === "pen") {
            if (e.button === 2)
                feed(p);
            else if (e.button === 0)
                splash(p);
            return;
        }
        // touch: a quick tap splashes, a press-and-hold tosses corn
        holdFed = false;
        clearTimeout(holdTimer);
        holdTimer = window.setTimeout(() => {
            holdFed = true;
            feed(p);
        }, 450);
        const release = () => {
            host.removeEventListener("pointerup", release);
            host.removeEventListener("pointercancel", cancel);
            clearTimeout(holdTimer);
            if (!holdFed)
                splash(p);
        };
        const cancel = () => {
            host.removeEventListener("pointerup", release);
            host.removeEventListener("pointercancel", cancel);
            clearTimeout(holdTimer);
        };
        host.addEventListener("pointerup", release);
        host.addEventListener("pointercancel", cancel);
    };
    /* ---------- talking ---------- */
    // little handwritten remarks above their heads
    const CROSS = ["bruh!", "excuse me?", "rude!", "watch it!", "hey!", "ugh!"];
    const HUNGRY = ["corn pls <3", "right click!", "bro gib corn"];
    const FULL = ["yummm", "yummm!", "yummm"];
    const MORE = ["more!", "more!!", "yummm… more!"];
    const talk = document.createElement("div");
    talk.className = "pond-talk";
    talk.setAttribute("aria-hidden", "true");
    host.appendChild(talk);
    const bubbles = [];
    let nextChirp = 0;
    let feedsSinceDibs = 3;
    let inkKey = "";
    const pick = (list) => list[Math.floor(Math.random() * list.length)];
    const say = (s, text, mood, life) => {
        if (bubbles.some((b) => b.swan === s))
            return;
        const el = document.createElement("span");
        el.className = `pond-say is-${mood}`;
        const inner = document.createElement("span");
        inner.style.animationDuration = `${life}s`;
        inner.style.setProperty("--tilt", `${rand(-7, 5).toFixed(1)}deg`);
        const words = document.createElement("b");
        // every letter on its own, so a cross one can tremble
        for (const ch of text) {
            const l = document.createElement("i");
            l.textContent = ch === " " ? "\u00a0" : ch;
            l.style.animationDelay = `${(-Math.random() * 0.4).toFixed(2)}s`;
            words.appendChild(l);
        }
        inner.appendChild(words);
        // a quick pen flick down toward the speaker
        inner.insertAdjacentHTML("beforeend", '<svg viewBox="0 0 12 12" width="12" height="12"><path d="M8.5 1.5c-.6 3-2 5.6-4.6 8.4" /></svg>');
        el.appendChild(inner);
        talk.appendChild(el);
        bubbles.push({ el, swan: s, until: clock + life });
    };
    const sayLater = (s, text, mood, life, at) => {
        s.sayAt = at;
        s.sayText = text;
        s.sayMood = mood;
        s.sayLife = life;
    };
    const updateTalk = () => {
        // ink follows the hour, like the rest of the look
        const ink = `${params.inkHue.toFixed(0)},${params.inkSat.toFixed(3)},${params.inkLight.toFixed(3)}`;
        if (ink !== inkKey) {
            inkKey = ink;
            const [r, g, b] = hsl(params.inkHue, params.inkSat, params.inkLight);
            talk.style.color = `rgb(${Math.round(r * 255)}, ${Math.round(g * 255)}, ${Math.round(b * 255)})`;
        }
        for (let i = bubbles.length - 1; i >= 0; i--) {
            const b = bubbles[i];
            const s = b.swan;
            if (clock > b.until || s.state === "away") {
                b.el.remove();
                bubbles.splice(i, 1);
                continue;
            }
            const sz = L * s.size;
            // where the head really is, following the bend of the neck (as swan-paint draws it)
            const bend = clamp(s.bend, -2.5, 2.5);
            const reach = s.look.neckLen * (1 - Math.min(0.25, Math.abs(bend) * 0.08));
            const lx = 0.2 + Math.cos(bend * 0.85) * reach;
            const ly = Math.sin(bend * 0.85) * reach;
            const c = Math.cos(s.h);
            const sn = Math.sin(s.h);
            const hx = s.x + (lx * c - ly * sn) * sz;
            const hy = s.y + (lx * sn + ly * c) * sz;
            // facing down the pond its body sits above the head, so step to the side of it
            const side = (c < 0 ? -1 : 1) * Math.max(0, sn) * 0.55 * sz;
            b.el.style.transform = `translate(${(hx + side).toFixed(1)}px, ${(hy - 9 * scale).toFixed(1)}px)`;
        }
        // hovering over the pond, an idle swan asks for food now and then
        if (pointer && !touchy && clock > nextChirp && !kernels.length) {
            nextChirp = clock + rand(2.6, 5);
            const idle = swans.filter((s) => s.state === "glide" && s.act === "none" && s.x > 0 && s.x < W && s.y > 0 && s.y < H);
            if (idle.length) {
                const pt = pointer;
                idle.sort((a, b) => Math.hypot(a.x - pt.x, a.y - pt.y) - Math.hypot(b.x - pt.x, b.y - pt.y));
                const s = Math.random() < 0.7 ? idle[0] : idle[Math.floor(Math.random() * idle.length)];
                say(s, pick(HUNGRY), "calm", 1.6);
                // and looks over at you while it asks
                s.headYawTarget = clamp(wrapAngle(Math.atan2(pt.y - s.y, pt.x - s.x) - s.h), -0.7, 0.7);
                s.nextLook = 2;
            }
        }
    };
    const startle = (p) => {
        addRipple(p.x, p.y, 1.0);
        addRipple(p.x, p.y, 0.45, 0.22);
        for (const f of leaves) {
            const dx = f.x - p.x;
            const dy = f.y - p.y;
            const d = Math.hypot(dx, dy) || 1;
            const k = (60 * scale) / (1 + d / (50 * scale));
            f.vx += (dx / d) * k;
            f.vy += (dy / d) * k;
            f.va += (Math.random() - 0.5) * 2;
        }
        let stays = 0;
        for (const s of swans) {
            if (s.state === "away" || s.state === "flee" || s.fleeAt >= 0)
                continue;
            const d = Math.hypot(s.x - p.x, s.y - p.y);
            // a swan far from the splash is often only startled: it flaps and hurries
            // off across the pond rather than leaving, so the pond is rarely empty
            if (d > W * 0.42 && stays === 0 && Math.random() < 0.6) {
                stays++;
                startFlap(s, true);
                const b = inner(1.8 * L);
                const ax = (s.x - p.x) / (d || 1);
                const ay = (s.y - p.y) / (d || 1);
                s.tx = clamp(s.x + ax * W * 0.35, b.x0, b.x1);
                s.ty = clamp(s.y + ay * W * 0.35, b.y0, b.y1);
                s.targetTimer = rand(5, 8);
                s.v = Math.max(s.v, glideSpeed(s) * 1.9);
                s.act = "none";
                s.state = "glide";
                continue;
            }
            s.fleeAt = clock + 0.1 + d / (W * 1.4) + rand(0, 0.25);
            s.fleeX = p.x;
            s.fleeY = p.y;
        }
        // one or two of them have something to say about it (sometimes nobody does)
        const startled = swans.filter((s) => s.state !== "away");
        const n = Math.random() < 0.12 ? 0 : Math.random() < 0.65 ? 1 : 2;
        for (const s of startled.sort(() => Math.random() - 0.5).slice(0, n)) {
            sayLater(s, pick(CROSS), "cross", 0.6, (s.fleeAt >= 0 ? s.fleeAt : clock) + rand(0.05, 0.3));
        }
    };
    host.addEventListener("pointermove", onMove);
    host.addEventListener("pointerleave", onLeave);
    host.addEventListener("pointerdown", onDown);
    host.addEventListener("contextmenu", onCtx);
    host.addEventListener("pointerup", onUp);
    /* ---------- simulation ---------- */
    const update = (s, dt) => {
        if (s.state === "away") {
            if (clock >= s.awayUntil)
                spawnReturn(s);
            else
                return;
        }
        const sz = L * s.size;
        const dirX = Math.cos(s.h);
        const dirY = Math.sin(s.h);
        if (s.sayAt >= 0 && clock >= s.sayAt) {
            s.sayAt = -1;
            say(s, s.sayText, s.sayMood, s.sayLife);
        }
        if (s.fleeAt >= 0 && clock >= s.fleeAt) {
            s.fleeAt = -1;
            s.state = "flee";
            s.loopTime = 0;
            let ax = s.x - s.fleeX;
            let ay = s.y - s.fleeY;
            const d = Math.hypot(ax, ay);
            if (d < 1) {
                ax = dirX;
                ay = dirY;
            }
            else {
                ax /= d;
                ay /= d;
            }
            const bx = ax * 0.8 + dirX * 0.35;
            const by = ay * 0.8 + dirY * 0.35;
            const bl = Math.hypot(bx, by) || 1;
            s.tx = s.x + (bx / bl) * (W + H);
            s.ty = s.y + (by / bl) * (W + H);
            s.headYawTarget = 0;
            s.act = "none";
            s.food = null;
            s.noticeAt = -1;
            if (Math.random() < 0.6)
                startFlap(s, true);
        }
        let vTarget = glideSpeed(s);
        let maxTurn = 0.36 * s.turnMul;
        let angAcc = 0.45;
        let accel = 0.8;
        let loopOverride = null;
        // corn on the water: notice it, then swim for the nearest kernel nobody's taken
        const edible = (k) => k.eatenAt < 0 && k.delay <= 0;
        if (s.noticeAt >= 0 && clock >= s.noticeAt && (s.state === "glide" || s.state === "return")) {
            s.noticeAt = -1;
            if (kernels.some(edible)) {
                s.state = "feed";
                s.loopTime = 0;
                s.act = "none";
                s.feedUntil = clock + rand(9, 13);
            }
        }
        if (s.state === "feed") {
            if (s.food && !edible(s.food))
                s.food = null;
            if (s.ate < s.appetite) {
                // keep looking: if fresh corn lands nearer, change course for it
                const cost = (k) => {
                    let d = Math.hypot(k.x - s.x, k.y - s.y);
                    // happy to compete, but prefers corn no one else is heading for
                    if (swans.some((o) => o !== s && o.food === k))
                        d *= 1.8;
                    return d;
                };
                let best = null;
                let bestD = Infinity;
                for (const k of kernels) {
                    if (!edible(k))
                        continue;
                    const d = cost(k);
                    if (d < bestD) {
                        bestD = d;
                        best = k;
                    }
                }
                // a little reluctance to switch, so it doesn't dither between two
                if (!s.food || (best && best !== s.food && bestD < cost(s.food) * 0.75))
                    s.food = best;
            }
            if (!s.food || s.ate >= s.appetite || clock > s.feedUntil) {
                if (s.ate > 0 && s.sayAt < 0 && Math.random() < 0.7) {
                    const full = s.ate >= s.appetite;
                    sayLater(s, pick(full ? FULL : MORE), "calm", 1.3, clock + rand(0.4, 0.8));
                }
                s.state = "glide";
                s.food = null;
                pickWaypoint(s);
            }
            else {
                s.tx = s.food.x;
                s.ty = s.food.y;
            }
        }
        const dx = s.tx - s.x;
        const dy = s.ty - s.y;
        const dl = Math.hypot(dx, dy) || 1;
        let wantX = dx / dl;
        let wantY = dy / dl;
        if (s.state === "glide") {
            s.targetTimer -= dt;
            if (dl < 1.8 * sz || s.targetTimer <= 0)
                pickWaypoint(s);
            const m = 1.4 * L;
            const lx = s.x + dirX * 2.6 * L;
            const ly = s.y + dirY * 2.6 * L;
            let edge = false;
            if (lx < m || lx > W - m || ly < m || ly > H - m) {
                edge = true;
                const cx = W / 2 - s.x;
                const cy = H / 2 - s.y;
                const cl = Math.hypot(cx, cy) || 1;
                wantX += (cx / cl) * 1.6;
                wantY += (cy / cl) * 1.6;
            }
            if (s.loopTime > 0) {
                if (edge)
                    s.loopTime = 0;
                else {
                    s.loopTime -= dt;
                    loopOverride = s.loopDir * maxTurn * 0.85;
                }
            }
            else if (!edge && s.act === "none" && Math.random() < dt * s.loopiness) {
                const rad = s.v / (maxTurn * 0.85);
                const dir = Math.random() < 0.5 ? -1 : 1;
                const cx = s.x - dirY * dir * rad;
                const cy = s.y + dirX * dir * rad;
                const room = rad + 1.5 * L;
                if (cx > room && cx < W - room && cy > room && cy < H - room) {
                    s.loopDir = dir;
                    s.loopTime = ((Math.PI * 2) / (maxTurn * 0.85)) * rand(0.75, 1.15);
                }
            }
            s.nextFlap -= dt;
            if (s.nextFlap <= 0 && s.act === "none") {
                startFlap(s, false);
                s.nextFlap = rand(10, 24);
            }
            s.nextAct -= dt * s.restless;
            if (s.nextAct <= 0 && s.act === "none" && s.flapT < 0) {
                s.act = Math.random() < 0.55 ? "dip" : "preen";
                s.actT = 0;
                s.actDur = s.act === "dip" ? rand(2.2, 3.6) : rand(2.6, 4.2);
                s.actSide = Math.random() < 0.5 ? -1 : 1;
                s.nextAct = rand(7, 16);
            }
        }
        else if (s.state === "feed" && s.food) {
            // eager at first, then gentle as it arrives
            const hx = s.x + dirX * (0.2 + s.look.neckLen) * sz;
            const hy = s.y + dirY * (0.2 + s.look.neckLen) * sz;
            const hd = Math.hypot(s.food.x - hx, s.food.y - hy);
            // if the corn is off to one side, ease right down and turn to it
            // rather than circling it forever
            const off = wrapAngle(Math.atan2(s.food.y - s.y, s.food.x - s.x) - s.h);
            const align = Math.max(0, Math.cos(off));
            vTarget = glideSpeed(s) * 1.55 * clamp(dl / (2.2 * sz), 0.12, 1) * (0.12 + 0.88 * align * align);
            maxTurn = 1.15;
            angAcc = 1.7;
            accel = 1.4;
            // and the neck reaches toward it
            if (dl < 2.5 * sz)
                s.headYawTarget = clamp(off, -0.9, 0.9);
            // close enough: dip and peck it up
            if (hd < 0.42 * sz && s.food.landed && s.act === "none") {
                s.act = "dip";
                s.actT = 0;
                s.actDur = rand(0.8, 1.1);
                s.food.eatenAt = clock + s.actDur * 0.45;
                s.ate++;
                s.food = null;
            }
        }
        else if (s.state === "flee") {
            vTarget = glideSpeed(s) * 2.3;
            maxTurn = 0.95;
            angAcc = 1.7;
            accel = 1.6;
            const out = 0.8 * sz;
            if (s.x < -out || s.x > W + out || s.y < -out || s.y > H + out) {
                s.state = "away";
                // the last one out comes back first, so the pond is never empty for long
                const othersHere = swans.some((o) => o !== s && o.state !== "away");
                s.awayUntil = clock + (othersHere ? rand(1.6, 4.4) : rand(0.3, 0.8));
                s.trail.length = 0;
                return;
            }
        }
        else if (s.state === "return") {
            vTarget = glideSpeed(s) * 1.15;
            maxTurn = 0.5;
            angAcc = 0.7;
            accel = 0.5;
            const m = 1.3 * L;
            if (s.x > m && s.x < W - m && s.y > m && s.y < H - m) {
                s.state = "glide";
                s.targetTimer = rand(6, 12);
                s.nextFlap = rand(4, 14);
            }
        }
        // anticipate: look a few seconds ahead and steer off any course that
        // would bring two swans together, the one behind easing off
        const svx = dirX * s.v;
        const svy = dirY * s.v;
        let urgent = 0;
        for (const o of swans) {
            if (o === s || o.state === "away")
                continue;
            const rx = o.x - s.x;
            const ry = o.y - s.y;
            const od = Math.hypot(rx, ry);
            const vx = Math.cos(o.h) * o.v - svx;
            const vy = Math.sin(o.h) * o.v - svy;
            const vv = vx * vx + vy * vy;
            const tc = clamp(vv > 1e-6 ? -(rx * vx + ry * vy) / vv : 0, 0, 4);
            const cx = rx + vx * tc;
            const cy = ry + vy * tc;
            const cd = Math.hypot(cx, cy);
            const span = (s.size + o.size) / 2;
            const jostle = s.state === "feed" && o.state === "feed";
            const safe = (jostle ? 0.75 : 2.0) * L * span;
            if (cd < safe) {
                const u = (1 - cd / safe) * (1 - tc / 4.5);
                let ax = -cx;
                let ay = -cy;
                if (cd < 1e-3) {
                    ax = -svy;
                    ay = svx;
                }
                const al = Math.hypot(ax, ay) || 1;
                wantX += (ax / al) * u * 3.4;
                wantY += (ay / al) * u * 3.4;
                if (rx * svx + ry * svy > 0)
                    vTarget *= 1 - u * 0.5;
                urgent = Math.max(urgent, u);
                loopOverride = null;
                s.loopTime = 0;
            }
            // and plain personal space at close range
            const R = (jostle ? 0.95 : 2.6) * L * span;
            if (od > 0 && od < R) {
                const f = ((R - od) / R) * (jostle ? 1.0 : 2.2);
                wantX -= (rx / od) * f;
                wantY -= (ry / od) * f;
            }
        }
        maxTurn *= 1 + urgent * 0.5;
        angAcc *= 1 + urgent * 0.6;
        if (pointer && s.state !== "flee" && s.state !== "feed") {
            const px = s.x - pointer.x;
            const py = s.y - pointer.y;
            const pd = Math.hypot(px, py);
            const R = 1.9 * L;
            if (pd > 0 && pd < R) {
                const f = ((R - pd) / R) * 1.4;
                wantX += (px / pd) * f;
                wantY += (py / pd) * f;
                vTarget *= 1 + f * 0.25;
                loopOverride = null;
                s.loopTime = 0;
            }
        }
        const actEnv = actionEnvelope(s);
        if (s.act !== "none")
            vTarget *= 1 - actEnv * (s.act === "dip" ? 0.6 : 0.45);
        const spread = flapSpread(s);
        vTarget *= 1 + spread * 0.35;
        const desired = Math.atan2(wantY, wantX);
        const diff = wrapAngle(desired - s.h);
        const targetW = loopOverride ?? clamp(diff * 0.9, -maxTurn, maxTurn);
        s.w += clamp(targetW - s.w, -angAcc * dt, angAcc * dt);
        s.h = wrapAngle(s.h + s.w * dt);
        s.v += (vTarget - s.v) * (1 - Math.exp(-dt * accel));
        s.x += Math.cos(s.h) * s.v * dt;
        s.y += Math.sin(s.h) * s.v * dt;
        /* ---- animation state ---- */
        const speedRatio = s.v / L;
        const fleeing = s.state === "flee";
        const ampTarget = 0.04 + speedRatio * 0.03 + (fleeing ? 0.34 : 0) + spread * 0.12;
        s.tailAmp += (ampTarget - s.tailAmp) * (1 - Math.exp(-dt * 4));
        s.tailPhase += dt * (2.5 + speedRatio * 5 + (fleeing ? 8 : 0));
        s.paddle += dt * (1.8 + speedRatio * 4.5);
        if (s.flapT >= 0) {
            const prev = s.flapT;
            s.flapT += dt;
            const beatLen = s.flapDur / s.flapBeats;
            if (Math.floor(s.flapT / beatLen) > Math.floor(prev / beatLen) && s.flapT < s.flapDur) {
                const reach = (0.4 + spread * 0.9) * sz;
                addRipple(s.x - dirY * reach, s.y + dirX * reach, 0.16);
                addRipple(s.x + dirY * reach, s.y - dirX * reach, 0.16);
            }
            if (s.flapT >= s.flapDur)
                s.flapT = -1;
        }
        s.nextLook -= dt;
        if (s.nextLook <= 0 && !fleeing) {
            s.headYawTarget = Math.random() < 0.3 ? 0 : rand(-0.55, 0.55);
            s.nextLook = rand(2.5, 7);
        }
        if (fleeing)
            s.headYawTarget = 0;
        s.headYaw += (s.headYawTarget - s.headYaw) * (1 - Math.exp(-dt * 1.6));
        if (s.act !== "none") {
            const before = actionEnvelope(s);
            s.actT += dt;
            const after = actionEnvelope(s);
            if (s.act === "dip" && ((before < 0.5 && after >= 0.5) || (before > 0.5 && after <= 0.5))) {
                const { hx, hy } = headWorld(s);
                addRipple(hx, hy, 0.24);
            }
            if (s.actT >= s.actDur)
                s.act = "none";
        }
        // the neck is sprung: it leans into turns, overshoots a touch and settles
        const env = actionEnvelope(s);
        let bendTarget = s.w * 1.1 + s.headYaw * 0.6 + Math.sin(clock * 0.37 + s.swayPhase) * 0.1;
        if (s.act === "preen")
            bendTarget = bendTarget * (1 - env) + s.actSide * 2.3 * env;
        if (s.act === "dip")
            bendTarget *= 1 - env * 0.8;
        const k = 9;
        s.bendV += (k * (bendTarget - s.bend) - 2 * Math.sqrt(k) * 0.75 * s.bendV) * dt;
        s.bend += s.bendV * dt;
        if (clock - s.lastTrail > 0.09) {
            s.trail.push({ x: s.x, y: s.y, h: s.h, v: s.v, t: clock });
            s.lastTrail = clock;
        }
        while (s.trail.length && clock - s.trail[0].t > 2.6)
            s.trail.shift();
        s.nextRipple -= dt;
        if (s.nextRipple <= 0) {
            addRipple(s.x + dirX * 0.4 * sz, s.y + dirY * 0.4 * sz, fleeing ? 0.2 : 0.1);
            s.nextRipple = fleeing ? rand(0.3, 0.45) : rand(1.3, 2.3);
        }
    };
    // Last line of defence: swans are capsules (tail to head); if two would
    // touch, ease them apart along the line between their closest points.
    const resolveOverlaps = (dt) => {
        const live = swans.filter((s) => s.state !== "away");
        for (let i = 0; i < live.length; i++) {
            for (let j = i + 1; j < live.length; j++) {
                const a = live[i];
                const b = live[j];
                const la = L * a.size;
                const lb = L * b.size;
                const ac = Math.cos(a.h);
                const as = Math.sin(a.h);
                const bc = Math.cos(b.h);
                const bs = Math.sin(b.h);
                const r = segDist(a.x - ac * 0.55 * la, a.y - as * 0.55 * la, a.x + ac * 0.62 * la, a.y + as * 0.62 * la, b.x - bc * 0.55 * lb, b.y - bs * 0.55 * lb, b.x + bc * 0.62 * lb, b.y + bs * 0.62 * lb);
                // bodies only — open wings may brush past each other, but never shove
                const minD = 0.26 * (la + lb);
                if (r.d < minD) {
                    let nx = r.ax - r.bx;
                    let ny = r.ay - r.by;
                    let nl = Math.hypot(nx, ny);
                    if (nl < 1e-4) {
                        nx = a.x - b.x;
                        ny = a.y - b.y;
                        nl = Math.hypot(nx, ny) || 1;
                    }
                    // ease apart over a fraction of a second rather than in one frame
                    const push = (minD - r.d) * 0.5 * Math.min(1, dt * 2.5);
                    a.x += (nx / nl) * push;
                    a.y += (ny / nl) * push;
                    b.x -= (nx / nl) * push;
                    b.y -= (ny / nl) * push;
                }
            }
        }
    };
    /* ---------- drawing ---------- */
    const LIGHT = { x: -0.55, y: -0.83 };
    const drawSwan = (target, s) => {
        const sz = L * s.size;
        const speedRatio = s.v / L;
        const sway = Math.sin(s.paddle) * 0.018 * Math.min(speedRatio, 2);
        const rot = s.h + sway;
        const env = actionEnvelope(s);
        const fleeing = s.state === "flee";
        target.save();
        target.translate(s.x, s.y);
        target.rotate(rot);
        target.scale(sz, sz);
        paintSwan(target, s.look, {
            spread: flapSpread(s),
            jig: Math.sin(s.tailPhase) * s.tailAmp + Math.sin(s.tailPhase * 2.3 + 1) * s.tailAmp * 0.3,
            tailAmp: s.tailAmp,
            paddle: s.paddle,
            speedRatio,
            bend: clamp(s.bend, -2.5, 2.5),
            headTurn: s.headYaw * 0.4 + (s.act === "preen" ? Math.sin(s.actT * 9) * 0.16 * env : 0),
            stretch: (fleeing ? 1.12 : 1) + (s.act === "dip" ? env * 0.2 : 0) + Math.sin(s.paddle * 2) * 0.015,
            sink: s.act === "dip" ? clamp((env - 0.35) / 0.45, 0, 1) : 0,
            lx: LIGHT.x * Math.cos(-rot) - LIGHT.y * Math.sin(-rot),
            ly: LIGHT.x * Math.sin(-rot) + LIGHT.y * Math.cos(-rot),
            px: 1 / sz,
        });
        target.restore();
    };
    // wakes go into a height map that the shader reads as surface slope
    const drawWakes = () => {
        const k = surf.width / W;
        sctx.setTransform(k, 0, 0, k, 0, 0);
        sctx.globalCompositeOperation = "source-over";
        sctx.fillStyle = "#000";
        sctx.fillRect(0, 0, W, H);
        sctx.globalCompositeOperation = "lighter";
        sctx.lineCap = "round";
        const life = 2.6;
        for (const s of swans) {
            if (s.state === "away")
                continue;
            const tr = s.trail;
            const sz = L * s.size;
            for (const arm of [1, -1]) {
                let px = 0;
                let py = 0;
                for (let i = tr.length - 1; i >= 0; i--) {
                    const p = tr[i];
                    const age = clock - p.t;
                    const lat = 0.2 * sz + 0.36 * p.v * age;
                    const x = p.x - Math.sin(p.h) * lat * arm + Math.cos(p.h) * 0.25 * sz;
                    const y = p.y + Math.cos(p.h) * lat * arm + Math.sin(p.h) * 0.25 * sz;
                    if (i < tr.length - 1) {
                        const fade = 1 - age / life;
                        const strength = clamp(p.v / (0.5 * L), 0.35, 1.6);
                        sctx.strokeStyle = `rgba(255,255,255,${0.32 * fade * strength})`;
                        sctx.lineWidth = (3 + age * 2.5) * scale;
                        sctx.beginPath();
                        sctx.moveTo(px, py);
                        sctx.lineTo(x, y);
                        sctx.stroke();
                    }
                    px = x;
                    py = y;
                }
            }
            // bow wave
            const bx = s.x + Math.cos(s.h) * 0.42 * sz;
            const by = s.y + Math.sin(s.h) * 0.42 * sz;
            const g = sctx.createRadialGradient(bx, by, 0, bx, by, 0.35 * sz);
            g.addColorStop(0, `rgba(255,255,255,${clamp(s.v / L, 0, 1.5) * 0.25})`);
            g.addColorStop(1, "rgba(255,255,255,0)");
            sctx.fillStyle = g;
            sctx.fillRect(bx - sz, by - sz, sz * 2, sz * 2);
        }
        sctx.globalCompositeOperation = "source-over";
    };
    /* ---------- uniforms from params ---------- */
    const uploadParams = () => {
        if (!hasGL || !gl || !waterProg || !postProg)
            return;
        const p = params;
        const deep = hsl(p.waterHue, p.waterSat, 0.05 + 0.17 * p.waterLight);
        const shallow = hsl(p.waterHue - 10, p.waterSat * 0.75, 0.6 + 0.25 * p.waterLight);
        // caustics and glints take on the colour of the light
        const sunC = hsl(p.lightHue, p.lightSat, 0.8);
        const caustic = hsl(p.waterHue - 25, 0.45, 0.86).map((c, i) => c * 0.5 + sunC[i] * 0.5);
        const sky = hsl(p.skyHue, p.skySat * 0.5, 0.86).map((c, i) => (c * 0.6 + sunC[i] * 0.4) * (0.3 + 0.7 * Math.max(p.waterLight, p.moon * 0.4)));
        const tint = hsl(p.swanHue, 0.6, 0.75);
        gl.useProgram(waterProg);
        gl.uniform3fv(wu.uDeep, deep);
        gl.uniform3fv(wu.uShallow, shallow);
        gl.uniform3fv(wu.uCaustic, caustic);
        gl.uniform3fv(wu.uSky, sky);
        gl.uniform3fv(wu.uTint, tint);
        gl.uniform1f(wu.uMurk, 0.25 + 0.85 * p.waterDepth);
        gl.uniform1f(wu.uLight, 0.22 + 1.0 * p.waterLight);
        gl.uniform1f(wu.uGlow, p.glow);
        gl.uniform1f(wu.uTintAmt, p.swanTint);
        gl.uniform3fv(wu.uReflSky, hsl(p.skyHue, p.skySat, 0.5 + 0.25 * p.waterLight).map((c) => c * (0.3 + 0.7 * Math.max(p.waterLight, p.skySat * 0.6))));
        gl.uniform3fv(wu.uReflSky2, hsl(p.skyHue - 42, p.skySat * 0.9, 0.58 + 0.2 * p.waterLight).map((c) => c * (0.3 + 0.7 * Math.max(p.waterLight, p.skySat * 0.6))));
        gl.uniform3fv(wu.uSun, hsl(p.lightHue, p.lightSat, 0.78));
        gl.uniform1f(wu.uSunAmt, p.sun);
        gl.uniform1f(wu.uMoon, p.moon);
        gl.uniform3fv(wu.uReflTree, hsl(p.waterHue - 20, Math.min(1, p.waterSat * 1.1), 0.12 + 0.14 * p.waterLight));
        gl.uniform1f(wu.uRefl, 0.12 + 0.15 * p.paint + 0.38 * p.skySat * (1 - p.moon * 0.6));
        gl.uniform1f(wu.uGrade, p.lightSat * (1 - p.moon * 0.7));
        gl.uniform1f(wu.uFog, p.fog);
        // mist glows with the sky and the low sun
        const fogSky = hsl(p.skyHue, p.skySat * 0.45, 0.86);
        const fogSun = hsl(p.lightHue, p.lightSat * 0.5, 0.9);
        gl.uniform3fv(wu.uFogCol, fogSky.map((c, i) => (c * 0.55 + fogSun[i] * 0.45) * (0.35 + 0.65 * Math.max(p.waterLight, 0.2))));
        gl.useProgram(postProg);
        gl.uniform1f(pu.uPaint, p.paint);
        gl.uniform1f(pu.uBrush, p.brush);
        gl.uniform1f(pu.uBloom, p.bloom);
    };
    const upload = (unit, tex, src, premul) => {
        if (!gl)
            return;
        gl.activeTexture(gl.TEXTURE0 + unit);
        gl.bindTexture(gl.TEXTURE_2D, tex);
        gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, premul);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src);
    };
    /* ---------- loop ---------- */
    let raf = 0;
    let last = performance.now();
    let visible = true;
    let pageVisible = !document.hidden;
    let perfAcc = 0;
    let perfN = 0;
    let perfWarm = 120; // frames to ignore at startup
    let goodRun = 0; // consecutive windows fast enough to try climbing back
    let sinceUp = Infinity; // windows since the last climb
    let climbLocked = false; // a climb failed: stop trying for this session
    let canopyTick = 0;
    const frameListeners = new Set();
    const frame = (now) => {
        raf = 0;
        const real = (now - last) / 1000;
        const dt = Math.min(0.05, real);
        last = now;
        clock += dt;
        // if the machine is struggling, render at a lower resolution.
        //
        // Changed from the standalone version, whose normal-mode guard could only ever go
        // down: it climbed back only above 80fps, which a 60Hz display cannot reach, and its
        // first window counted startup (shader compile, floor painting, hydration), so one
        // slow second on load left the pond soft for good. Now the first ~2s are not
        // counted, and it climbs back after three clean windows at >=54fps. If a climb is
        // followed straight away by a drop, that level is more than this machine can hold,
        // so it stops climbing for the session instead of pulsing. The order of what is
        // shed, the steps, the floors and the threshold for shedding are unchanged, and
        // the recording-mode branch is untouched.
        if (perfWarm > 0) {
            perfWarm--;
        }
        else {
            perfAcc += real;
            perfN++;
        }
        // while recording in high quality the output stays at video size; only the
        // water's detail gives a little if the machine can't keep up
        if (perfN >= 30 && hqWidth) {
            const avg = perfAcc / perfN;
            if (hasGL && avg > 0.04 && sceneK > 0.5) {
                sceneK = Math.max(0.5, sceneK - 0.125);
                sizeLayers();
            }
            else if (hasGL && avg < 0.022 && sceneK < 1) {
                sceneK = Math.min(1, sceneK + 0.125);
                sizeLayers();
            }
            perfAcc = 0;
            perfN = 0;
        }
        else if (perfN >= 45) {
            const avg = perfAcc / perfN;
            sinceUp++;
            const dropped = () => {
                if (sinceUp <= 3)
                    climbLocked = true;
                goodRun = 0;
                sizeLayers();
            };
            const climbed = () => {
                goodRun = 0;
                sinceUp = 0;
                sizeLayers();
            };
            // shed load from the water first (the brushwork hides it), and only
            // then soften the whole picture
            if (hasGL && avg > 0.024 && sceneK > 0.42) {
                sceneK = Math.max(0.42, sceneK - 0.1);
                dropped();
            }
            else if (hasGL && avg > 0.024 && wd > 0.85) {
                wd = Math.max(0.85, wd - 0.15);
                dropped();
            }
            else if (hasGL && avg < 0.0185 && !climbLocked && (wd < maxWd || sceneK < 0.7)) {
                if (++goodRun >= 3) {
                    if (wd < maxWd)
                        wd = Math.min(maxWd, wd + 0.1);
                    else
                        sceneK = Math.min(0.7, sceneK + 0.1);
                    climbed();
                }
            }
            else {
                goodRun = 0;
            }
            perfAcc = 0;
            perfN = 0;
        }
        // looks change like light does: gradually
        params = mixParams(params, target, 1 - Math.exp(-dt * 1.4));
        uploadParams();
        // safety net: if every swan is off-frame, call the next one back now
        // (a swan already swimming off past the edge counts as gone)
        const m = 20 * scale;
        const inView = (s) => s.state !== "away" && s.x > m && s.x < W - m && s.y > m && s.y < H - m;
        const away = swans.filter((s) => s.state === "away");
        if (away.length && !swans.some(inView) && !swans.some((s) => s.state === "return")) {
            const next = away.reduce((a, b) => (a.awayUntil < b.awayUntil ? a : b));
            next.awayUntil = Math.min(next.awayUntil, clock + 0.25);
        }
        for (const s of swans)
            update(s, dt * motion);
        resolveOverlaps(dt * motion);
        updateLeaves(dt);
        updatePetals(dt);
        updateKernels(dt);
        for (let i = ripples.length - 1; i >= 0; i--)
            if (clock - ripples[i].t > 5.5)
                ripples.splice(i, 1);
        // surface layer: leaves under swans, swans back-to-front
        const k = paint.width / W;
        pctx.setTransform(k, 0, 0, k, 0, 0);
        pctx.clearRect(0, 0, W, H);
        for (const f of leaves)
            drawLeaf(pctx, f);
        for (const f of petals)
            if (f.landed)
                drawPetal(pctx, f);
        for (const k of kernels)
            if (k.landed)
                drawKernel(pctx, k);
        const live = swans.filter((s) => s.state !== "away").sort((a, b) => a.y - b.y);
        for (const s of live)
            drawSwan(pctx, s);
        for (const f of petals)
            if (!f.landed)
                drawPetal(pctx, f);
        for (const k of kernels)
            if (!k.landed)
                drawKernel(pctx, k);
        if (hasGL && gl && waterProg && postProg) {
            drawWeeds();
            drawWakes();
            gl.activeTexture(gl.TEXTURE0);
            gl.bindTexture(gl.TEXTURE_2D, tBed);
            upload(1, tWeeds, weeds, true);
            upload(2, tSwans, paint, true);
            upload(3, tSurf, surf, false);
            // the canopy only sways slowly, so it can be redrawn every other frame
            if ((canopyTick++ & 1) === 0) {
                drawVines();
                upload(5, tCanopy, canopy, true);
            }
            rippleData.fill(0);
            ripples.forEach((r, i) => {
                rippleData[i * 4] = r.x;
                rippleData[i * 4 + 1] = r.y;
                rippleData[i * 4 + 2] = r.t;
                rippleData[i * 4 + 3] = r.a;
            });
            // pass 1: water + swans into the scene texture
            gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
            gl.viewport(0, 0, sceneW, sceneH);
            gl.useProgram(waterProg);
            gl.uniform1i(wu.uBed, 0);
            gl.uniform1i(wu.uWeeds, 1);
            gl.uniform1i(wu.uSwans, 2);
            gl.uniform1i(wu.uSurf, 3);
            gl.uniform1i(wu.uCanopy, 5);
            gl.uniform2f(wu.uRes, W, H);
            gl.uniform1f(wu.uTime, clock);
            gl.uniform1f(wu.uScale, scale);
            gl.uniform4fv(wu.uRipples, rippleData);
            gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
            // pass 2: paint it
            gl.bindFramebuffer(gl.FRAMEBUFFER, null);
            gl.viewport(0, 0, waterCanvas.width, waterCanvas.height);
            gl.useProgram(postProg);
            gl.activeTexture(gl.TEXTURE4);
            gl.bindTexture(gl.TEXTURE_2D, tScene);
            gl.uniform1i(pu.uScene, 4);
            gl.uniform1i(pu.uSwans, 2);
            gl.uniform2f(pu.uRes, W, H);
            gl.uniform1f(pu.uTime, clock);
            gl.uniform1f(pu.uScale, scale);
            gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
        }
        else {
            ctx.setTransform(1, 0, 0, 1, 0, 0);
            ctx.clearRect(0, 0, swanCanvas.width, swanCanvas.height);
            ctx.drawImage(paint, 0, 0, swanCanvas.width, swanCanvas.height);
        }
        updateTalk();
        for (const cb of frameListeners)
            cb();
        scheduleFromFrame();
    };
    const schedule = () => {
        if (!raf && visible && pageVisible) {
            last = performance.now();
            raf = requestAnimationFrame(frame);
        }
    };
    const scheduleFromFrame = () => {
        if (!raf && visible && pageVisible)
            raf = requestAnimationFrame(frame);
    };
    const io = new IntersectionObserver(([entry]) => {
        visible = entry.isIntersecting;
        schedule();
    });
    io.observe(host);
    const onVis = () => {
        pageVisible = !document.hidden;
        schedule();
    };
    document.addEventListener("visibilitychange", onVis);
    const ro = new ResizeObserver(() => resize());
    ro.observe(host);
    resize();
    uploadParams();
    schedule();
    return {
        setParams(p, instant = false) {
            target = { ...target, ...p };
            if (instant) {
                params = { ...target };
                uploadParams();
            }
        },
        getParams() {
            return { ...target };
        },
        size() {
            return { width: W, height: H };
        },
        onFrame(cb) {
            frameListeners.add(cb);
            return () => frameListeners.delete(cb);
        },
        setHighQuality(width) {
            if (!hasGL)
                return;
            if (width && !hqWidth)
                beforeHq = { wd, sceneK };
            if (width) {
                hqWidth = width;
                sceneK = 0.875;
            }
            else if (hqWidth) {
                hqWidth = 0;
                wd = beforeHq.wd;
                sceneK = beforeHq.sceneK;
            }
            else
                return;
            sizeLayers();
        },
        chatter() {
            const here = swans.filter((s) => s.state !== "away" && s.x > 0 && s.x < W && s.y > 0 && s.y < H);
            const all = [...CROSS, ...HUNGRY, ...FULL, ...MORE, "dibs!", "glutton!"];
            for (const s of here.sort(() => Math.random() - 0.5).slice(0, 2)) {
                const text = pick(all);
                say(s, text, CROSS.includes(text) ? "cross" : "calm", 2.2);
            }
        },
        snapshot(c, w, h) {
            // the page behind shows through the torn edge
            c.save();
            c.globalCompositeOperation = "source-over";
            c.clearRect(0, 0, w, h);
            c.imageSmoothingQuality = "high";
            c.drawImage(hasGL ? waterCanvas : swanCanvas, 0, 0, w, h);
            if (edgeMask) {
                c.globalCompositeOperation = "destination-in";
                c.drawImage(edgeMask, 0, 0, w, h);
            }
            c.globalCompositeOperation = "destination-over";
            c.fillStyle = getComputedStyle(document.body).backgroundColor || "#fafafa";
            c.fillRect(0, 0, w, h);
            c.restore();
            // the remarks are DOM text over the canvas, so paint them in by hand,
            // letter by letter where the page has laid them out (shake and all)
            const box = host.getBoundingClientRect();
            const kx = w / (box.width || 1);
            const ky = h / (box.height || 1);
            for (const b of bubbles) {
                const inner = b.el.firstElementChild;
                if (!inner)
                    continue;
                const alpha = Number(getComputedStyle(inner).opacity);
                if (!(alpha > 0.01))
                    continue;
                const cs = getComputedStyle(b.el.querySelector("b") ?? b.el);
                c.save();
                c.globalAlpha = alpha;
                c.fillStyle = cs.color;
                c.strokeStyle = cs.color;
                c.font = `${cs.fontStyle} ${cs.fontWeight} ${parseFloat(cs.fontSize) * kx}px ${cs.fontFamily}`;
                c.textAlign = "center";
                c.textBaseline = "middle";
                for (const l of b.el.querySelectorAll("i")) {
                    const r = l.getBoundingClientRect();
                    c.fillText(l.textContent ?? "", (r.left + r.width / 2 - box.left) * kx, (r.top + r.height / 2 - box.top) * ky);
                }
                const svg = b.el.querySelector("svg");
                if (svg) {
                    const r = svg.getBoundingClientRect();
                    const u = (r.width / 12) * kx;
                    c.lineWidth = 1.3 * u;
                    c.lineCap = "round";
                    c.translate((r.left - box.left) * kx, (r.top - box.top) * ky);
                    c.beginPath();
                    c.moveTo(8.5 * u, 1.5 * u);
                    c.bezierCurveTo(7.9 * u, 4.5 * u, 6.5 * u, 7.1 * u, 3.9 * u, 9.9 * u);
                    c.stroke();
                }
                c.restore();
            }
        },
        destroy() {
            if (raf)
                cancelAnimationFrame(raf);
            io.disconnect();
            ro.disconnect();
            document.removeEventListener("visibilitychange", onVis);
            host.removeEventListener("pointermove", onMove);
            host.removeEventListener("pointerleave", onLeave);
            host.removeEventListener("pointerdown", onDown);
            host.removeEventListener("contextmenu", onCtx);
            host.removeEventListener("pointerup", onUp);
            clearTimeout(holdTimer);
            talk.remove();
            gl?.getExtension("WEBGL_lose_context")?.loseContext();
        },
    };
}
