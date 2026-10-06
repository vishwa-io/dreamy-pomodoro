"use client";

import { useEffect, useRef } from "react";
import { startPond } from "./engine";
import { hourFor, lookAt } from "./time-of-day";
import { mountKoiLayer } from "./koi-layer";

export default function PondHero() {
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const water = document.createElement("canvas");
    water.className = "pond-water";

    const koi = document.createElement("canvas");
    koi.className = "pond-koi";

    const swans = document.createElement("canvas");
    swans.className = "pond-swans";

    // Water first, then koi, then swans so the fish sit inside the pond
    // without covering the existing swan layer.
    host.append(water, koi, swans);

    const stopKoi = mountKoiLayer(host, koi);

    const hourNow = () => hourFor(window.location.search);
    const first = lookAt(hourNow());
    host.dataset.time = first.name;
    const ctl = startPond(host, water, swans, first.params);

    const applyLook = () => {
      const now = lookAt(hourNow());
      host.dataset.time = now.name;
      ctl.setParams(now.params);
    };

    const clock = window.setInterval(applyLook, 30_000);
    const onPondTimeChange = () => applyLook();

    window.addEventListener("pond-time-change", onPondTimeChange);

    return () => {
      window.clearInterval(clock);
      window.removeEventListener("pond-time-change", onPondTimeChange);
      stopKoi();
      ctl.destroy();
      water.remove();
      koi.remove();
      swans.remove();
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
      aria-label="A dreamy pond with three koi and swans gliding across it. Move over the water to ripple it; click to startle the swans, or take corn from the hanging feeder and throw it in."
    />
  );
}
