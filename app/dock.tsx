"use client";

/**
 * Floating dock: social slots.
 * The theme toggle lives in its own top-right anchor (theme-toggle.tsx).
 */
export default function Dock() {
  return (
    <div className="floating-dock" role="toolbar" aria-label="Site controls">
      {/* Replace with your own icons/links */}
      <a className="floating-dock-icon dock-social" href="#" aria-label="Social link one">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <circle cx="12" cy="12" r="9" />
        </svg>
      </a>
      <a className="floating-dock-icon dock-social" href="#" aria-label="Social link two">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <rect x="4" y="4" width="16" height="16" rx="4" />
        </svg>
      </a>
    </div>
  );
}
