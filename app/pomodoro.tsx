"use client";

import { useEffect, useMemo, useState } from "react";

const FOCUS_SECONDS = 25 * 60;
const BREAK_SECONDS = 5 * 60;
const STATS_KEY = "dreamy-pomodoro-stats";
const CLIENT_KEY = "dreamy-pomodoro-client";

type Mode = "focus" | "break";
type Counts = Record<string, number>;

function todayKey() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function recordFocusCompletion() {
  const day = todayKey();

  try {
    const saved = JSON.parse(localStorage.getItem(STATS_KEY) || "{}") as Counts;
    saved[day] = (saved[day] || 0) + 1;
    localStorage.setItem(STATS_KEY, JSON.stringify(saved));

    let clientId = localStorage.getItem(CLIENT_KEY);
    if (!clientId) {
      clientId = crypto.randomUUID();
      localStorage.setItem(CLIENT_KEY, clientId);
    }

    void fetch("/api/pomodoro-stats", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clientId, day }),
    }).catch(() => {});
  } catch {}
}

export default function Pomodoro() {
  const [mode, setMode] = useState<Mode>("focus");
  const [seconds, setSeconds] = useState(FOCUS_SECONDS);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    if (!running) return;

    const timer = window.setInterval(() => {
      setSeconds((current) => {
        if (current > 1) return current - 1;

        if (mode === "focus") {
          recordFocusCompletion();
        }

        setRunning(false);
        setMode((currentMode) => (currentMode === "focus" ? "break" : "focus"));
        return mode === "focus" ? BREAK_SECONDS : FOCUS_SECONDS;
      });
    }, 1000);

    return () => window.clearInterval(timer);
  }, [running, mode]);

  useEffect(() => {
    document.title = `${formatTime(seconds)} · ${mode}`;
    return () => {
      document.title = "Dreamy Pomodoro";
    };
  }, [seconds, mode]);

  const time = useMemo(() => formatTime(seconds), [seconds]);

  const reset = () => {
    setRunning(false);
    setSeconds(mode === "focus" ? FOCUS_SECONDS : BREAK_SECONDS);
  };

  const switchMode = (next: Mode) => {
    setRunning(false);
    setMode(next);
    setSeconds(next === "focus" ? FOCUS_SECONDS : BREAK_SECONDS);
  };

  return (
    <section className="pomodoro" aria-label="Pomodoro timer">
      <div className="pomodoro-mode" role="tablist" aria-label="Timer mode">
        <button
          className={mode === "focus" ? "active" : ""}
          onClick={() => switchMode("focus")}
          role="tab"
          aria-selected={mode === "focus"}
        >
          focus
        </button>
        <button
          className={mode === "break" ? "active" : ""}
          onClick={() => switchMode("break")}
          role="tab"
          aria-selected={mode === "break"}
        >
          break
        </button>
      </div>

      <div className="pomodoro-time" aria-live="polite">
        {time}
      </div>

      <div className="pomodoro-actions">
        <button className="pomodoro-main" onClick={() => setRunning((value) => !value)}>
          {running ? "pause" : "start"}
        </button>
        <button className="pomodoro-reset" onClick={reset} aria-label="Reset timer">
          reset
        </button>
      </div>
    </section>
  );
}

function formatTime(total: number) {
  const minutes = Math.floor(total / 60).toString().padStart(2, "0");
  const seconds = (total % 60).toString().padStart(2, "0");
  return `${minutes}:${seconds}`;
}
