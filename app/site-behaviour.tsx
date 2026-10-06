"use client";

import { useEffect } from "react";

/**
 * Behaviour layer.
 *
 * Just the staggered entrance now — each `.appear` element gets an increasing
 * `--appear-delay` so the page resolves top to bottom instead of all at once.
 */

const STAGGER_MS = 60; // gap between successive .appear elements
const BASE_DELAY_MS = 40; // delay before the first one

export default function SiteBehaviour() {
  useEffect(() => {
    document.querySelectorAll<HTMLElement>(".appear").forEach((el, i) => {
      el.style.setProperty("--appear-delay", `${BASE_DELAY_MS + i * STAGGER_MS}ms`);
    });
  }, []);

  return null;
}
