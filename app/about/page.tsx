import type { Metadata } from "next";
import Link from "next/link";
import SplineEmbed from "./spline-embed";

export const metadata: Metadata = {
  title: "About",
};

/**
 * About page.
 *
 * Same 540px column and spacing system as the homepage; the 3D sits as a
 * height-capped block above the copy rather than a full-bleed hero, so it
 * doesn't overwhelm the 14px type.
 */
export default function About() {
  return (
    <main className="site">
      <section className="intro-section">
        <div className="content">
          <div className="stack">
            <SplineEmbed />

            <div className="body-copy">
              <div className="information">
                <p className="appear">
                  PLACEHOLDER — opening line about who you are and what you make.
                </p>
                <p className="appear">
                  PLACEHOLDER — a paragraph of background. Same measure as the
                  homepage; keep it to a few sentences.
                </p>
                <p className="appear">
                  PLACEHOLDER — what you&apos;re working on now, or what you&apos;re
                  looking for.
                </p>
                <p className="appear">
                  <Link href="/">
                    <span className="link-label">Back home</span>
                  </Link>
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
