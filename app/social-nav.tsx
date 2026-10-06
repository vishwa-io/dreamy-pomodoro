"use client";

import { useEffect, useState } from "react";

const FORMAT = new Intl.DateTimeFormat("en-US", {
  timeZone: "Asia/Kolkata",
  hour: "2-digit",
  minute: "2-digit",
  hour12: true,
});

const clock = () =>
  FORMAT.format(new Date()).replace(/\s?(AM|PM)/i, (_, ap: string) => ap.toLowerCase());

export default function SocialNav() {
  const [now, setNow] = useState("");

  useEffect(() => {
    setNow(clock());
    const id = window.setInterval(() => setNow(clock()), 1000);
    return () => window.clearInterval(id);
  }, []);

  return (
    <nav className="social-nav" aria-label="Social links">
      <div className="social-identity">
        <a
          className="social-brand"
          href="https://github.com/vishwa-io"
          target="_blank"
          rel="noreferrer"
          aria-label="Vishwa on GitHub"
          title="Vishwa on GitHub"
        >
          Vishwa
        </a>
        <span className="social-time" aria-label="Current time">
          {now || "00:00am"}
        </span>
      </div>

      <div className="social-links">
        <a className="social-link" href="https://github.com/vishwa-io" target="_blank" rel="noreferrer" aria-label="GitHub" title="GitHub">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M12 .8a11.2 11.2 0 0 0-3.54 21.83c.56.1.77-.24.77-.54v-2.08c-3.13.68-3.79-1.33-3.79-1.33-.51-1.3-1.25-1.65-1.25-1.65-1.02-.7.08-.69.08-.69 1.13.08 1.72 1.16 1.72 1.16 1 1.72 2.62 1.22 3.26.93.1-.73.39-1.22.71-1.5-2.5-.28-5.13-1.25-5.13-5.57 0-1.23.44-2.24 1.16-3.03-.12-.28-.5-1.43.11-2.98 0 0 .95-.3 3.1 1.16a10.77 10.77 0 0 1 5.64 0c2.15-1.46 3.1-1.16 3.1-1.16.61 1.55.23 2.7.11 2.98.72.79 1.16 1.8 1.16 3.03 0 4.33-2.64 5.28-5.15 5.56.4.35.76 1.05.76 2.13v3.15c0 .31.2.65.78.54A11.2 11.2 0 0 0 12 .8Z"/>
          </svg>
        </a>

        <a className="social-link" href="https://www.linkedin.com/" target="_blank" rel="noreferrer" aria-label="LinkedIn" title="LinkedIn">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M5.1 3.4A2.1 2.1 0 1 1 5.1 7.6 2.1 2.1 0 0 1 5.1 3.4ZM3.3 9h3.6v11.2H3.3V9Zm5.8 0h3.4v1.53h.05c.47-.89 1.62-1.83 3.35-1.83 3.58 0 4.24 2.36 4.24 5.43v6.07h-3.55v-5.38c0-1.28-.02-2.92-1.78-2.92-1.78 0-2.05 1.39-2.05 2.83v5.47H9.1V9Z"/>
          </svg>
        </a>

        <a className="social-link" href="https://x.com/" target="_blank" rel="noreferrer" aria-label="X" title="X">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M18.9 2H22l-6.77 7.74L23.2 22h-6.26l-4.9-6.41L6.44 22H3.33l7.24-8.28L2.9 2h6.42l4.43 5.86L18.9 2Zm-1.1 17.9h1.73L8.7 4.02H6.84L17.8 19.9Z"/>
          </svg>
        </a>

        <a className="social-link" href="https://vishwa-io.github.io/portfolio/" target="_blank" rel="noreferrer" aria-label="Portfolio" title="Portfolio">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M10 14 8.5 15.5a3.2 3.2 0 0 1-4.5-4.5L7 8a3.2 3.2 0 0 1 4.5 0"/>
            <path d="m14 10 1.5-1.5A3.2 3.2 0 0 1 20 13l-3 3a3.2 3.2 0 0 1-4.5 0"/>
            <path d="m8.5 12.5 7-7"/>
          </svg>
        </a>
      </div>
    </nav>
  );
}
