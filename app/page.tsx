import { Fragment } from "react";
import Link from "next/link";
import CopyButton from "./copy-button";
import Tooltip from "./tooltip";
import PondHero from "./pond/pond-hero";
import HeroBar from "./hero-bar";

/**
 * Homepage.
 *
 * Structure and spacing follow the layout system in globals.css. All copy,
 * project names and dates below are placeholders — swap them for your own.
 */
export default function Home() {
  return (
    <main className="site">
      <section className="intro-section">
        <div className="content">
          <div className="hero">
            <HeroBar />
            <PondHero />
          </div>

          <div className="avatar-wrap appear">
            <span className="avatar-swap">
              {/* 40x40. Drop a square image into /public and swap this span for
                  next/image when you have one. */}
              <span className="avatar avatar-still" role="img" aria-label="Avatar placeholder" />
            </span>
          </div>

          <div className="stack">
            <div className="body-copy">
              <div className="greetings appear">
                <span>Vishwa,</span>
                <Tooltip label="Hindi">
                  <span lang="hi">
                    विश्वा<span className="greetings-comma">,</span>
                  </span>
                </Tooltip>
                <Tooltip label="Sindhi">
                  <span lang="sd" dir="rtl">
                    وشوا
                  </span>
                </Tooltip>
              </div>

              <div className="information">
                <p className="appear">
                  PLACEHOLDER — one-line introduction goes here, name and what you do.
                </p>
                <p className="appear">
                  PLACEHOLDER — a second line for background or current focus. Keep it to a
                  sentence or two; the column is intentionally narrow.
                </p>
                <p className="appear">
                  PLACEHOLDER — recent work, with inline links like{" "}
                  <a href="#">
                    <span className="link-label">Project One</span>
                  </a>{" "}
                  and{" "}
                  <a href="#">
                    <span className="link-label">Project Two</span>
                  </a>
                  .
                </p>
                <p className="appear">
                  Explore my{" "}
                  <a href="#">
                    <span className="link-label">Selected work</span>
                  </a>
                </p>
              </div>
            </div>

            <div className="link-groups">
              <div className="link-divider" />
              <LinkSection
                title="Projects"
                rows={[
                  { name: "Placeholder project", meta: "Month 2026", href: "#", external: true },
                  { name: "Another project", meta: "Month 2026", href: "#", external: true },
                  { name: "Unreleased thing", meta: "soon" },
                ]}
              />

              <div className="link-divider" />
              <LinkSection
                title="Playground"
                rows={[
                  { name: "Experiment one", meta: "Month 2026", href: "#", external: true },
                  { name: "Experiment two", meta: "Month 2026", href: "#", external: true },
                ]}
              />

              <div className="link-divider" />
              <LinkSection
                title="Notes"
                rows={[
                  { name: "A written note", meta: "5 min read", href: "/notes/a-written-note" },
                  { name: "Another note", meta: "8 min read", href: "/notes/another-note" },
                ]}
              />

              <div className="link-divider" />
            </div>

            <section className="connect-section appear" aria-labelledby="Connect-title">
              <h2 id="Connect-title">Connect</h2>
              <div className="connect-copy">
                <p>
                  Reach me at <a href="mailto:your@email.com">your@email.com</a>
                  <CopyButton value="your@email.com" />
                </p>
              </div>
            </section>
          </div>
        </div>
      </section>

      <footer className="footer">
        <div className="footer-banner">
          <p className="footer-note">PLACEHOLDER — footer line.</p>
        </div>
      </footer>
    </main>
  );
}

type Row = { name: string; meta: string; href?: string; external?: boolean };

/** A titled group of name/date rows, e.g. Projects or Notes. */
function LinkSection({ title, rows }: { title: string; rows: Row[] }) {
  const id = `${title}-title`;
  return (
    <section className="link-section appear" aria-labelledby={id}>
      <h2 id={id}>{title}</h2>
      <div className="link-row">
        {rows.map((row) => (
          <Fragment key={row.name}>
            <div className="names">
              {row.href && row.external ? (
                <a href={row.href} target="_blank" rel="noopener noreferrer">
                  <span className="link-label">{row.name}</span>
                </a>
              ) : row.href ? (
                // Client-side navigation: a full page load would cut the music off.
                <Link href={row.href}>
                  <span className="link-label">{row.name}</span>
                </Link>
              ) : (
                <span className="link-disabled">
                  <span className="link-label">{row.name}</span>
                </span>
              )}
            </div>
            <div className="dates">
              <span>{row.meta}</span>
            </div>
          </Fragment>
        ))}
      </div>
    </section>
  );
}
