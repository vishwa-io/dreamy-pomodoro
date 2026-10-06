"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";

/**
 * Ambient music for the whole site.
 *
 * Mounted once in the root layout, so it survives client-side navigation: the
 * track keeps playing as you move between pages, and stops only when the
 * visitor mutes it. It sits at 40%.
 *
 * Browsers only allow sound after a user gesture, so nothing starts until the
 * first click, tap or key press (unless the visitor muted it on an earlier visit).
 * The icon therefore shows "off" until then, which is the truth: it is silent.
 *
 * Volume goes through a Web Audio gain node rather than `audio.volume`: iOS
 * Safari ignores `volume` entirely, so 40% could not be held there otherwise, and
 * the gain node also gives smooth fades.
 */

const SRC = "/audio/merry-go-round-of-life.mp3";
const VOLUME = 0.4;
const FADE_TIME_CONSTANT = 0.12; // seconds; fully settled in ~0.5s
const PAUSE_AFTER_MS = 600; // let the fade-out finish before pausing
const STORAGE_KEY = "ambient-muted";

type Ambient = {
  /** Sound is actually coming out of the speakers. */
  audible: boolean;
  /** Mute if it is playing; otherwise start it. */
  toggle: () => void;
};

const AmbientContext = createContext<Ambient>({ audible: false, toggle: () => {} });
export const useAmbient = () => useContext(AmbientContext);

type Webkit = typeof window & { webkitAudioContext?: typeof AudioContext };

export default function AudioProvider({ children }: { children: React.ReactNode }) {
  const [audible, setAudible] = useState(false);
  const controls = useRef<{ start: () => Promise<boolean>; stop: () => void } | null>(null);

  useEffect(() => {
    const el = new Audio();
    el.loop = true;
    el.preload = "none"; // 7MB: only fetch it once someone has actually asked for sound
    el.src = SRC;

    let ctx: AudioContext | null = null;
    let gain: GainNode | null = null;
    let pauseTimer = 0;
    let gone = false;

    let muted = false;
    try {
      muted = localStorage.getItem(STORAGE_KEY) === "1";
    } catch {
      /* storage can be unavailable (private mode, blocked cookies) */
    }
    const remember = (m: boolean) => {
      muted = m;
      try {
        localStorage.setItem(STORAGE_KEY, m ? "1" : "0");
      } catch {
        /* the toggle still works for this visit */
      }
    };

    const wire = () => {
      if (ctx || gain) return;
      const AC = window.AudioContext ?? (window as Webkit).webkitAudioContext;
      if (!AC) return;
      ctx = new AC();
      const source = ctx.createMediaElementSource(el);
      gain = ctx.createGain();
      gain.gain.value = 0;
      source.connect(gain);
      gain.connect(ctx.destination);
    };
    const setLevel = (v: number) => {
      if (gain && ctx) gain.gain.setTargetAtTime(v, ctx.currentTime, FADE_TIME_CONSTANT);
      else el.volume = v;
    };

    const start = async () => {
      window.clearTimeout(pauseTimer);
      try {
        wire();
        await ctx?.resume();
        await el.play();
        if (gone) return false;
        setLevel(VOLUME);
        setAudible(true);
        return true;
      } catch {
        // the browser refused (no gesture yet); stay silent and try on the next one
        setAudible(false);
        return false;
      }
    };
    const stop = () => {
      setLevel(0);
      setAudible(false);
      window.clearTimeout(pauseTimer);
      pauseTimer = window.setTimeout(() => {
        if (!gone) el.pause();
      }, PAUSE_AFTER_MS);
    };
    controls.current = {
      start: async () => {
        remember(false);
        const ok = await start();
        if (ok) disarm();
        return ok;
      },
      stop: () => {
        remember(true);
        stop();
      },
    };

    // First gesture anywhere starts the music, unless it was muted last time or the
    // gesture is on the toggle itself (which does its own thing).
    const events = ["pointerup", "click", "keydown", "touchend"] as const;
    const arm = (e: Event) => {
      if ((e.target as Element | null)?.closest?.("[data-audio-toggle]")) return;
      if (muted) return;
      void start().then((ok) => {
        if (ok) disarm();
      });
    };
    const disarm = () => events.forEach((n) => window.removeEventListener(n, arm, true));
    if (!muted) events.forEach((n) => window.addEventListener(n, arm, { capture: true, passive: true }));

    return () => {
      gone = true;
      disarm();
      window.clearTimeout(pauseTimer);
      controls.current = null;
      el.pause();
      el.removeAttribute("src");
      void ctx?.close();
    };
  }, []);

  const toggle = useCallback(() => {
    const c = controls.current;
    if (!c) return;
    if (audible) c.stop();
    else void c.start();
  }, [audible]);

  const value = useMemo(() => ({ audible, toggle }), [audible, toggle]);
  return <AmbientContext.Provider value={value}>{children}</AmbientContext.Provider>;
}
