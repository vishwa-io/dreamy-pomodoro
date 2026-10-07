"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import PondHero from "../../pond/pond-hero";

type Counts = Record<string, number>;
type Week = Date[];

const STORAGE_KEY = "dreamy-pomodoro-stats";
const START_DATE = new Date(2026, 9, 1);
const END_DATE = new Date(2027, 8, 30);

function addDays(date: Date, amount: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + amount);
  return next;
}

function keyFor(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function buildCalendar() {
  const gridStart = addDays(START_DATE, -START_DATE.getDay());
  const gridEnd = addDays(END_DATE, 6 - END_DATE.getDay());
  const weeks: Week[] = [];
  let cursor = gridStart;

  while (cursor <= gridEnd) {
    const week: Week = [];
    for (let day = 0; day < 7; day += 1) {
      week.push(new Date(cursor));
      cursor = addDays(cursor, 1);
    }
    weeks.push(week);
  }

  return weeks;
}

function buildMonthMarkers(weeks: Week[]) {
  return weeks.flatMap((week, index) => {
    const first = week.find(
      (date) =>
        date >= START_DATE &&
        date <= END_DATE &&
        date.getDate() === 1
    );

    return first
      ? [{
          index,
          label: new Intl.DateTimeFormat("en", { month: "short" }).format(first),
        }]
      : [];
  });
}

function loadCounts(): Counts {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    if (!saved || typeof saved !== "object" || Array.isArray(saved)) return {};

    return Object.entries(saved).reduce<Counts>((result, [day, value]) => {
      const count = Number(value);
      if (/^\d{4}-\d{2}-\d{2}$/.test(day) && Number.isFinite(count) && count > 0) {
        result[day] = Math.floor(count);
      }
      return result;
    }, {});
  } catch {
    return {};
  }
}

function levelFor(count: number) {
  if (count <= 0) return 0;
  if (count === 1) return 1;
  if (count === 2) return 2;
  if (count === 3) return 3;
  return 4;
}

function tooltipFor(date: Date, count: number) {
  const formatted = new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);

  return count === 0
    ? `${formatted} · 0 focus sessions`
    : `${formatted} · ${count} focus session${count === 1 ? "" : "s"}`;
}

export default function StatsPage() {
  const [counts, setCounts] = useState<Counts>({});
  const weeks = useMemo(() => buildCalendar(), []);
  const months = useMemo(() => buildMonthMarkers(weeks), [weeks]);

  useEffect(() => {
    setCounts(loadCounts());

    const refresh = () => setCounts(loadCounts());
    const onStorage = (event: StorageEvent) => {
      if (event.key === STORAGE_KEY) refresh();
    };

    window.addEventListener("dreamy-stats-updated", refresh);
    window.addEventListener("storage", onStorage);

    document.title = "Focus · Dreamy Pomodoro";

    return () => {
      window.removeEventListener("dreamy-stats-updated", refresh);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  return (
    <main className="about-page stats-page">
      <PondHero />

      <div className="stats-shell">
        <Link href="/" className="about-back">
          <span>←</span> back to the pond
        </Link>

        <section className="stats-panel" aria-labelledby="stats-title">
          <div className="stats-topline">
            <div>
              <div className="about-kicker">focus activity</div>
              <h1 id="stats-title">Oct 2026 — Sep 2027</h1>
            </div>

            <div className="stats-legend" aria-label="Focus sessions: less to more">
              <span>less</span>
              <i className="stats-cell level-0" />
              <i className="stats-cell level-1" />
              <i className="stats-cell level-2" />
              <i className="stats-cell level-3" />
              <i className="stats-cell level-4" />
              <span>more</span>
            </div>
          </div>

          <div className="stats-calendar-scroll">
            <div className="stats-calendar-stage">
              <div className="stats-months" aria-hidden="true">
                {months.map(({ index, label }) => (
                  <span
                    className="stats-month"
                    key={`${label}-${index}`}
                    style={{ gridColumn: index + 1 }}
                  >
                    {label}
                  </span>
                ))}
              </div>

              <div className="stats-grid-shell">
                <div className="stats-day-labels" aria-hidden="true">
                  <span>Mon</span>
                  <span>Wed</span>
                  <span>Fri</span>
                </div>

                <div
                  className="stats-calendar"
                  role="img"
                  aria-label="Pomodoro focus sessions by day, shown as a GitHub-style contribution calendar"
                >
                  {weeks.map((week, weekIndex) => (
                    <div className="stats-week" key={weekIndex} aria-hidden="true">
                      {week.map((date) => {
                        const key = keyFor(date);
                        const outside =
                          date < START_DATE || date > END_DATE;
                        const count = outside ? 0 : counts[key] || 0;

                        return (
                          <span
                            className={`stats-cell level-${levelFor(count)}${outside ? " outside" : ""}`}
                            key={key}
                            title={outside ? "" : tooltipFor(date, count)}
                            aria-hidden="true"
                          />
                        );
                      })}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
