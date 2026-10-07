"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import PondHero from "../../pond/pond-hero";

type Counts = Record<string, number>;

const STORAGE_KEY = "dreamy-pomodoro-stats";
const CLIENT_KEY = "dreamy-pomodoro-client";

function getClientId() {
  try {
    const saved = localStorage.getItem(CLIENT_KEY);
    if (saved) return saved;
    const id = crypto.randomUUID();
    localStorage.setItem(CLIENT_KEY, id);
    return id;
  } catch {
    return "local";
  }
}

function loadLocal(): Counts {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    return saved && typeof saved === "object" ? saved : {};
  } catch {
    return {};
  }
}

function saveLocal(counts: Counts) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(counts));
  } catch {}
}

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

function buildYear(year: number) {
  const start = new Date(year, 0, 1);
  const end = new Date(year, 11, 31);
  const gridStart = addDays(start, -start.getDay());
  const gridEnd = addDays(end, 6 - end.getDay());

  const weeks: Date[][] = [];
  let cursor = gridStart;

  while (cursor <= gridEnd) {
    const week: Date[] = [];
    for (let day = 0; day < 7; day += 1) {
      week.push(cursor);
      cursor = addDays(cursor, 1);
    }
    weeks.push(week);
  }

  return weeks;
}

function levelFor(count: number) {
  if (count <= 0) return 0;
  if (count === 1) return 1;
  if (count === 2) return 2;
  if (count === 3) return 3;
  return 4;
}

function formatDate(date: Date, count: number) {
  const formatted = new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);

  if (count === 0) return `${formatted} · no focus sessions`;
  return `${formatted} · ${count} focus session${count === 1 ? "" : "s"}`;
}

export default function StatsPage() {
  const year = new Date().getFullYear();
  const [counts, setCounts] = useState<Counts>({});

  const weeks = useMemo(() => buildYear(year), [year]);

  useEffect(() => {
    const local = loadLocal();
    setCounts(local);

    const clientId = getClientId();

    fetch(`/api/pomodoro-stats?clientId=${encodeURIComponent(clientId)}&year=${year}`)
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (!data?.counts) return;
        const merged = { ...local, ...data.counts };
        setCounts(merged);
        saveLocal(merged);
      })
      .catch(() => {});
  }, [year]);

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
              <div className="about-kicker">focus</div>
              <h1 id="stats-title">{year}</h1>
            </div>
            <div className="stats-legend" aria-label="Focus intensity">
              <span>less</span>
              <i className="stats-cell level-0" />
              <i className="stats-cell level-1" />
              <i className="stats-cell level-2" />
              <i className="stats-cell level-3" />
              <i className="stats-cell level-4" />
              <span>more</span>
            </div>
          </div>

          <div className="stats-heatmap-wrap">
            <div className="stats-months" aria-hidden="true">
              {weeks.map((week, index) => {
                const first = week[0];
                const show =
                  first.getDate() <= 7 ||
                  index === 0;

                return (
                  <span
                    key={keyFor(first)}
                    style={{ gridColumn: index + 1 }}
                  >
                    {show ? new Intl.DateTimeFormat("en", { month: "short" }).format(first) : ""}
                  </span>
                );
              })}
            </div>

            <div className="stats-heatmap" role="img" aria-label={`Pomodoro focus activity for ${year}`}>
              {weeks.map((week) =>
                week.map((date) => {
                  const key = keyFor(date);
                  const count = counts[key] || 0;
                  const inYear = date.getFullYear() === year;

                  return (
                    <span
                      key={key}
                      className={`stats-cell level-${levelFor(count)}${inYear ? "" : " outside"}`}
                      title={inYear ? formatDate(date, count) : ""}
                      aria-hidden="true"
                    />
                  );
                })
              )}
            </div>

            <div className="stats-days" aria-hidden="true">
              <span>mon</span>
              <span>wed</span>
              <span>fri</span>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
