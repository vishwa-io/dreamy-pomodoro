"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useAmbient } from "./audio-provider";

export default function HeroBar() {
  const [timerRunning, setTimerRunning] = useState(false);

  useEffect(() => {
    const root = document.documentElement;

    const sync = () => {
      setTimerRunning(root.hasAttribute("data-timer-running"));
    };

    sync();

    const observer = new MutationObserver(sync);
    observer.observe(root, {
      attributes: true,
      attributeFilter: ["data-timer-running"],
    });

    return () => observer.disconnect();
  }, []);

  return (
    <div className="hero-bar" aria-label="Pond controls">
      <div className="hero-controls">
        <AmbientToggle />
        <NotificationToggle />
        <ThemeToggle />
        <Todo />
        {!timerRunning && (
          <>
            <Link className="about-pill-link" href="/notes/test">stats</Link>
            <Link className="about-pill-link" href="/about">about</Link>
          </>
        )}
      </div>
    </div>
  );
}

function AmbientToggle() {
  const { audible, toggle } = useAmbient();

  return (
    <button
      className="control-icon"
      type="button"
      onClick={toggle}
      aria-label={audible ? "Mute music" : "Play music"}
      title={audible ? "Mute music" : "Play music"}
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M11 5 6 9H2v6h4l5 4V5Z" />
        {audible ? <><path d="M15.5 8.5a5 5 0 0 1 0 7" /><path d="M19 5a10 10 0 0 1 0 14" /></> : <><path d="m22 9-6 6" /><path d="m16 9 6 6" /></>}
      </svg>
    </button>
  );
}

function NotificationToggle() {
  const [enabled, setEnabled] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">("default");

  useEffect(() => {
    if (typeof Notification === "undefined") {
      setPermission("unsupported");
      return;
    }

    setPermission(Notification.permission);

    try {
      setEnabled(
        Notification.permission === "granted" &&
        localStorage.getItem("dreamy-notifications-enabled") === "true"
      );
    } catch {}
  }, []);

  const toggle = async () => {
    if (typeof Notification === "undefined") return;

    let nextPermission = Notification.permission;

    if (nextPermission === "default") {
      try {
        nextPermission = await Notification.requestPermission();
        setPermission(nextPermission);
      } catch {
        return;
      }
    }

    if (nextPermission !== "granted") {
      setEnabled(false);
      try { localStorage.setItem("dreamy-notifications-enabled", "false"); } catch {}
      return;
    }

    setEnabled((current) => {
      const next = !current;
      try { localStorage.setItem("dreamy-notifications-enabled", String(next)); } catch {}
      return next;
    });
  };

  const label =
    permission === "unsupported"
      ? "Notifications are not supported"
      : permission === "denied"
        ? "Notifications are blocked in browser settings"
        : enabled
          ? "Disable timer notifications"
          : "Enable timer notifications";

  return (
    <button
      className={`control-icon notification-toggle${enabled ? " enabled" : ""}`}
      type="button"
      onClick={toggle}
      aria-label={label}
      title={label}
      aria-pressed={enabled}
      disabled={permission === "unsupported"}
    >
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill={enabled ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" />
        <path d="M10 21h4" />
      </svg>
    </button>
  );
}

function ThemeToggle() {
  const [dark, setDark] = useState(true);

  useEffect(() => {
    setDark(document.documentElement.getAttribute("data-theme") === "dark");
  }, []);

  const toggle = () => {
    const root = document.documentElement;
    const next = root.getAttribute("data-theme") === "dark" ? "light" : "dark";
    root.setAttribute("data-theme", next);
    setDark(next === "dark");
    try { localStorage.setItem("theme", next); } catch {}
  };

  return (
    <button className="control-icon" type="button" onClick={toggle} aria-label="Toggle theme" title="Toggle theme">
      {dark ? (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M20.5 14.3A8.6 8.6 0 1 1 9.7 3.5a6.9 6.9 0 0 0 10.8 10.8Z" />
        </svg>
      ) : (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M19.1 4.9l-1.4 1.4M6.3 17.7l-1.4 1.4" />
        </svg>
      )}
    </button>
  );
}

function Todo() {
  const [open, setOpen] = useState(false);
  const [task, setTask] = useState("");
  const [tasks, setTasks] = useState<string[]>([]);
  const [checked, setChecked] = useState<boolean[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem("dreamy-tasks") || "[]");

      if (Array.isArray(saved)) {
        const nextTasks: string[] = [];
        const nextChecked: boolean[] = [];

        saved.forEach((item) => {
          if (typeof item === "string") {
            nextTasks.push(item);
            nextChecked.push(false);
            return;
          }

          if (item && typeof item === "object") {
            nextTasks.push(String(item.text ?? ""));
            nextChecked.push(Boolean(item.done));
          }
        });

        setTasks(nextTasks);
        setChecked(nextChecked);
      }
    } catch {
      // Ignore malformed or unavailable storage and keep an empty list.
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    if (!loaded) return;

    try {
      localStorage.setItem(
        "dreamy-tasks",
        JSON.stringify(tasks.map((text, i) => ({ text, done: checked[i] ?? false })))
      );
    } catch {
      // Storage can be full or unavailable; keep the current in-memory state.
    }
  }, [loaded, tasks, checked]);

  const addTask = () => {
    const value = task.trim();
    if (!value) return;
    setTasks((items) => [...items, value]);
    setChecked((items) => [...items, false]);
    setTask("");
  };

  const removeTask = (index: number) => {
    setTasks((items) => items.filter((_, i) => i !== index));
    setChecked((items) => items.filter((_, i) => i !== index));
  };

  return (
    <div className="todo-wrap">
      <button
        className="todo-button"
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-label="Open todo list"
        aria-expanded={open}
        title="Todo list"
      >
        todo
      </button>

      {open && (
        <div className="todo-panel">
          <div className="todo-title">todo</div>
          <div className="todo-list">
            {tasks.length === 0 && <div className="todo-empty">nothing here yet</div>}
            {tasks.map((item, index) => (
              <div className="todo-row" key={`${item}-${index}`}>
                <button
                  className={`todo-check ${checked[index] ? "done" : ""}`}
                  type="button"
                  onClick={() => setChecked((items) => items.map((done, i) => i === index ? !done : done))}
                  aria-label={checked[index] ? "Mark task incomplete" : "Mark task complete"}
                />
                <span className={checked[index] ? "todo-text done" : "todo-text"}>{item}</span>
                <button className="todo-delete" type="button" onClick={() => removeTask(index)} aria-label={`Delete ${item}`}>×</button>
              </div>
            ))}
          </div>
          <form className="todo-add" onSubmit={(event) => { event.preventDefault(); addTask(); }}>
            <input
              value={task}
              onChange={(event) => setTask(event.target.value)}
              placeholder="add a task"
              aria-label="New task"
            />
            <button type="submit" aria-label="Add task">+</button>
          </form>
        </div>
      )}
    </div>
  );
}
