import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "About · Dreamy Pomodoro",
};

export default function About() {
  return (
    <main className="about-page">
      <div className="about-shell">
        <Link href="/" className="about-back">
          ← back to the pond
        </Link>

        <section className="about-card" aria-labelledby="about-title">
          <div className="about-kicker">dreamy pomodoro</div>
          <h1 id="about-title">A quiet little timer for slow, focused days.</h1>

          <p className="about-lede">
            I made Dreamy Pomodoro as a softer alternative to productivity apps
            that can feel a little too busy. The idea is simple: sit by the
            pond, put on some music, and focus on one thing at a time.
          </p>

          <div className="about-grid">
            <div>
              <span className="about-label">inside</span>
              <p>25 min focus · 5 min break · todo · ambient music</p>
            </div>
            <div>
              <span className="about-label">the pond</span>
              <p>Interactive water, swans, ripples, wakes, and four little moods.</p>
            </div>
            <div>
              <span className="about-label">built with</span>
              <p>Next.js · TypeScript · Canvas · CSS</p>
            </div>
            <div>
              <span className="about-label">made by</span>
              <p>
                Vishwa — a frontend and UI/UX learner who likes making small,
                cozy things for the web.
              </p>
            </div>
          </div>

          <div className="about-note">
            <span>—</span>
            <p>
              No streaks. No productivity scores. Just a timer, a pond, and
              enough space to concentrate.
            </p>
          </div>

          <div className="about-links">
            <a href="https://github.com/vishwa-io" target="_blank" rel="noreferrer">
              GitHub
            </a>
            <a
              href="https://www.linkedin.com/in/vishwa-patel-0598a238/"
              target="_blank"
              rel="noreferrer"
            >
              LinkedIn
            </a>
            <a href="https://x.com/vi_shwaaa" target="_blank" rel="noreferrer">
              X
            </a>
          </div>
        </section>
      </div>
    </main>
  );
}
