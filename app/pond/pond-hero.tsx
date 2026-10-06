"use client";

import { useEffect, useRef } from "react";
import { startPond } from "./engine";
import { hourFor, lookAt } from "./time-of-day";

/**
 * The swan pond, as a hero.
 *
 * `startPond` (lifted from the standalone artifact) owns everything inside the
 * frame: the painted pond floor, weeds, overhanging vines and blossom, drifting
 * leaves, three painted swans, the ripple and wake simulation, and the water and
 * brushwork shaders. It pauses while off-screen or in a hidden tab, and steps
 * its own render resolution down if frames start taking too long.
 *
 * This component only gives it a frame to live in and keeps its look in step
 * with the clock: dawn, day, dusk, dark.
 *
 * The canvases are created inside the effect so that React strict mode's double
 * mount gets fresh WebGL contexts rather than a lost one.
 */
export default function PondHero() {
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const water = document.createElement("canvas");
    water.className = "pond-water";
    const swans = document.createElement("canvas");
    swans.className = "pond-swans";
    host.append(water, swans);

    // The visitor's own clock, read in their browser: a viewer in Mumbai at 7pm
    // gets dusk while one in Los Angeles at the same instant gets their morning.
    const hourNow = () => hourFor(window.location.search);
    const first = lookAt(hourNow());
    host.dataset.time = first.name; // which look is showing (also handy for debugging)
    const ctl = startPond(host, water, swans, first.params);

    // The look drifts with the light, so a coarse refresh is invisible: the
    // engine eases toward each new target rather than jumping to it.
    const clock = window.setInterval(() => {
      const now = lookAt(hourNow());
      host.dataset.time = now.name;
      ctl.setParams(now.params);
    }, 30_000);

    return () => {
      window.clearInterval(clock);
      ctl.destroy();
      water.remove();
      swans.remove();
      // The engine feathers the frame's edge with a generated mask; clear it so a
      // remount starts from the stylesheet again.
      for (const prop of ["-webkit-mask-image", "mask-image", "-webkit-mask-size", "mask-size", "-webkit-mask-repeat", "mask-repeat", "-webkit-mask-composite", "mask-composite", "border-radius", "cursor"]) {
        host.style.removeProperty(prop);
      }
    };
  }, []);

  return (
    <div
      className="pond-hero appear"
      ref={hostRef}
      role="img"
      aria-label="A pond with swans gliding across it. Move over the water to ripple it; click to startle the swans, or take corn from the hanging feeder and throw it in."
    />
  );
}
