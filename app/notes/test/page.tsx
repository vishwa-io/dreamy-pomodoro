"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import PondHero from "../../pond/pond-hero";

type Counts = Record<string, number>;
type Week = Date[];
type HoveredDay = {
  key: string;
  date: Date;
  count: number;
  x: number;
  y: number;
};

const STORAGE_KEY = "dreamy-pomodoro-stats";
const YEAR = 2026;
const START_DATE = new Date(YEAR, 0, 1);
const END_DATE = new Date(YEAR, 11, 31);

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

function monthLabelForWeek(week: Week) {
  const first = week.find(
    (date) =>
      date >= START_DATE &&
      date <= END_DATE &&
      date.getDate() === 1
  );

  return first
    ? new Intl.DateTimeFormat("en", { month: "short" }).format(first)
    : "";
}

function loadCounts(): Counts {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");

    if (!saved || typeof saved !== "object" || Array.isArray(saved)) {
      return {};
    }

    return Object.entries(saved).reduce<Counts>((result, [day, value]) => {
      const count = Number(value);

      if (
        /^\d{4}-\d{2}-\d{2}$/.test(day) &&
        Number.isFinite(count) &&
        count > 0
      ) {
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
  const [hovered, setHovered] = useState<HoveredDay | null>(null);
  const weeks = useMemo(() => buildCalendar(), []);

  const total = useMemo(
    () =>
      Object.entries(counts).reduce((sum, [day, count]) => {
        return day.startsWith(`${YEAR}-`) ? sum + count : sum;
      }, 0),
    [counts]
  );

  useEffect(() => {
    const refresh = () => setCounts(loadCounts());

    refresh();
    window.addEventListener("dreamy-stats-updated", refresh);

    const onStorage = (event: StorageEvent) => {
      if (event.key === STORAGE_KEY) refresh();
    };

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
          <div className="stats-header">
            <h1 id="stats-title">
              {total} focus session{total === 1 ? "" : "s"} in {YEAR}
            </h1>

            <div className="stats-legend" aria-label="Focus sessions: less to more">
              <span>Less</span>
              <i className="stats-cell level-0" />
              <i className="stats-cell level-1" />
              <i className="stats-cell level-2" />
              <i className="stats-cell level-3" />
              <i className="stats-cell level-4" />
              <span>More</span>
            </div>
          </div>

          <div className="stats-scroll" aria-label="Focus session history">
            <div className="stats-scroll-inner">
              <div className="stats-day-column" aria-hidden="true">
                <span />
                <span>Mon</span>
                <span />
                <span>Wed</span>
                <span />
                <span>Fri</span>
                <span />
              </div>

              <div className="stats-calendar-area">
                <div className="stats-month-row" aria-hidden="true">
                  {weeks.map((week, index) => (
                    <span className="stats-month-slot" key={index}>
                      {monthLabelForWeek(week)}
                    </span>
                  ))}
                </div>

                <div
                  className="stats-calendar"
                  role="img"
                  aria-label={`Focus sessions for ${YEAR}, shown as a GitHub-style contribution calendar`}
                >
                  {weeks.map((week, weekIndex) => (
                    <div className="stats-week" key={weekIndex}>
                      {week.map((date) => {
                        const outside =
                          date < START_DATE || date > END_DATE;
                        const count = outside ? 0 : counts[keyFor(date)] || 0;

                        const cellKey = keyFor(date);

                        return (
                          <span
                            className={`stats-cell level-${levelFor(count)}${outside ? " outside" : ""}`}
                            key={cellKey}
                            title={outside ? "" : tooltipFor(date, count)}
                            aria-hidden="true"
                            tabIndex={outside ? -1 : 0}
                            onMouseEnter={(event) => {
                              if (outside) return;
                              const rect = event.currentTarget.getBoundingClientRect();
                              setHovered({
                                key: cellKey,
                                date,
                                count,
                                x: rect.left + rect.width / 2,
                                y: rect.top,
                              });
                            }}
                            onMouseLeave={() => {
                              if (window.matchMedia("(hover: hover) and (pointer: fine)").matches) {
                                setHovered(null);
                              }
                            }}
                            onFocus={(event) => {
                              if (outside) return;
                              const rect = event.currentTarget.getBoundingClientRect();
                              setHovered({
                                key: cellKey,
                                date,
                                count,
                                x: rect.left + rect.width / 2,
                                y: rect.top,
                              });
                            }}
                            onBlur={() => {
                              if (window.matchMedia("(hover: hover) and (pointer: fine)").matches) {
                                setHovered(null);
                              }
                            }}
                            onClick={(event) => {
                              if (outside) return;
                              const rect = event.currentTarget.getBoundingClientRect();
                              setHovered({
                                key: cellKey,
                                date,
                                count,
                                x: Math.min(Math.max(rect.left + rect.width / 2, 12), window.innerWidth - 12),
                                y: rect.top,
                              });
                            }}
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
        {hovered && (
          <div
            className="stats-tooltip"
            role="status"
            style={{
              left: hovered.x,
              top: hovered.y - 10,
            }}
          >
            <span>
              {new Intl.DateTimeFormat("en", {
                month: "short",
                day: "numeric",
                year: "numeric",
              }).format(hovered.date)}
            </span>
            <strong>
              {hovered.count} focus session{hovered.count === 1 ? "" : "s"}
            </strong>
          </div>
        )}
      </div>
    </main>
  );
}
