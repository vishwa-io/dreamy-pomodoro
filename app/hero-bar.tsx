"use client";

import { useEffect, useState } from "react";
import { useAmbient } from "./audio-provider";

/**
 * The strip directly above the pond: the time in Bangalore on the left, the music
 * toggle on the right.
 */
export default function HeroBar() {
  return (
    <div className="hero-bar appear">
      <TimeWidget />
      <AmbientToggle />
    </div>
  );
}

const FORMAT = new Intl.DateTimeFormat("en-US", {
  timeZone: "Asia/Kolkata",
  hour: "2-digit",
  minute: "2-digit",
  hour12: true,
});

/** "02:24 PM" -> "02:24pm" */
const clock = () => FORMAT.format(new Date()).replace(/\s?(AM|PM)/i, (_, ap: string) => ap.toLowerCase());

function TimeWidget() {
  // Empty until mounted: the server has no idea what time it is where it matters, and
  // rendering one here would mismatch on hydration. The placeholder holds the width.
  const [now, setNow] = useState("");

  useEffect(() => {
    setNow(clock());
    const id = window.setInterval(() => setNow((prev) => {
      const next = clock();
      return next === prev ? prev : next;
    }), 1000);
    return () => window.clearInterval(id);
  }, []);

  return (
    <span className="time-widget">
      bangalore, ka | <span className="time-widget-clock">{now || "00:00am"}</span>
    </span>
  );
}

function AmbientToggle() {
  const { audible, toggle } = useAmbient();
  return (
    <button
      className="ambient-toggle"
      data-audio-toggle
      data-on={audible ? "true" : "false"}
      type="button"
      onClick={toggle}
      aria-label={audible ? "Mute music" : "Play music"}
      aria-pressed={audible}
      title={audible ? "Mute" : "Play music"}
    >
      {/* sound on */}
      <span className="ambient-icon ambient-icon-on" aria-hidden="true">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M11 5 6 9H2v6h4l5 4V5Z" />
          <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
          <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
        </svg>
      </span>
      {/* sound off */}
      <span className="ambient-icon ambient-icon-off" aria-hidden="true">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M11 5 6 9H2v6h4l5 4V5Z" />
          <path d="m22 9-6 6" />
          <path d="m16 9 6 6" />
        </svg>
      </span>
    </button>
  );
}
