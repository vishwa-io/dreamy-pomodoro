"use client";

import { useEffect, useMemo, useRef, useState } from "react";

const FOCUS_SECONDS = 25 * 60;
const BREAK_SECONDS = 5 * 60;
const STATS_KEY = "dreamy-pomodoro-stats";

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
    const raw = localStorage.getItem(STATS_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    const saved: Counts =
      parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};

    const previous = Number(saved[day]);
    saved[day] = Number.isFinite(previous) && previous >= 0 ? Math.floor(previous) + 1 : 1;

    localStorage.setItem(STATS_KEY, JSON.stringify(saved));
    window.dispatchEvent(new Event("dreamy-stats-updated"));
  } catch {}
}

export default function Pomodoro() {
  const [mode, setMode] = useState<Mode>("focus");
  const [seconds, setSeconds] = useState(FOCUS_SECONDS);
  const [running, setRunning] = useState(false);

  const secondsRef = useRef(seconds);
  const modeRef = useRef(mode);

  useEffect(() => {
    secondsRef.current = seconds;
  }, [seconds]);

  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);

  useEffect(() => {
    if (!running) return;

    const timer = window.setInterval(() => {
      const currentSeconds = secondsRef.current;

      if (currentSeconds > 1) {
        const nextSeconds = currentSeconds - 1;
        secondsRef.current = nextSeconds;
        setSeconds(nextSeconds);
        return;
      }

      const currentMode = modeRef.current;

      if (currentMode === "focus") {
        recordFocusCompletion();
      }

      const nextMode: Mode = currentMode === "focus" ? "break" : "focus";
      const nextSeconds = currentMode === "focus" ? BREAK_SECONDS : FOCUS_SECONDS;

      modeRef.current = nextMode;
      secondsRef.current = nextSeconds;

      setRunning(false);
      setMode(nextMode);
      setSeconds(nextSeconds);
    }, 1000);

    return () => window.clearInterval(timer);
  }, [running]);

  useEffect(() => {
    document.title = `${formatTime(seconds)} · ${mode}`;
    return () => {
      document.title = "Dreamy Pomodoro";
    };
  }, [seconds, mode]);

  const time = useMemo(() => formatTime(seconds), [seconds]);

  const reset = () => {
    setRunning(false);
    const nextSeconds = mode === "focus" ? FOCUS_SECONDS : BREAK_SECONDS;
    secondsRef.current = nextSeconds;
    setSeconds(nextSeconds);
  };

  const switchMode = (next: Mode) => {
    setRunning(false);
    modeRef.current = next;
    secondsRef.current = next === "focus" ? FOCUS_SECONDS : BREAK_SECONDS;
    setMode(next);
    setSeconds(secondsRef.current);
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
