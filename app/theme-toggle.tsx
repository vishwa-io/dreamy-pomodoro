"use client";

/**
 * Theme toggle, anchored top-right.
 *
 * Both icons are always in the DOM stacked in one grid cell; `[data-theme]`
 * decides which is visible. That's how the reference does it — crossfading two
 * static glyphs means no icon swap on hydration and nothing to re-render.
 */
export default function ThemeToggle() {
  function toggleTheme() {
    const root = document.documentElement;
    const next = root.getAttribute("data-theme") === "dark" ? "light" : "dark";

    // Suppress transitions for the duration of the swap so every themed
    // property doesn't animate at once.
    root.classList.add("is-theme-switching");
    root.setAttribute("data-theme", next);
    window.setTimeout(() => root.classList.remove("is-theme-switching"), 0);

    try {
      localStorage.setItem("theme", next);
    } catch {
      /* storage can be unavailable (private mode, blocked cookies) */
    }
  }

  return (
    <div className="theme-toggle-anchor">
      <button
        className="theme-toggle"
        type="button"
        onClick={toggleTheme}
        aria-label="Toggle colour theme"
      >
        {/* light: sun */}
        <span className="theme-toggle-icon theme-toggle-invert-1" aria-hidden="true">
          <svg
            width="15"
            height="15"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
          >
            <circle cx="12" cy="12" r="4.2" />
            <path d="M12 2.4v2.2M12 19.4v2.2M2.4 12h2.2M19.4 12h2.2M5.2 5.2l1.6 1.6M17.2 17.2l1.6 1.6M5.2 18.8l1.6-1.6M17.2 6.8l1.6-1.6" />
          </svg>
        </span>

        {/* dark: moon */}
        <span className="theme-toggle-icon theme-toggle-invert-2" aria-hidden="true">
          <svg
            width="15"
            height="15"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M20.5 14.3A8.6 8.6 0 1 1 9.7 3.5a6.9 6.9 0 0 0 10.8 10.8Z" />
          </svg>
        </span>
      </button>
    </div>
  );
}
