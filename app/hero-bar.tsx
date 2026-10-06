"use client";

import { useEffect, useState } from "react";
import { useAmbient } from "./audio-provider";

export default function HeroBar() {
  return (
    <div className="hero-bar">
      <TimeWidget />
      <div className="hero-controls">
        <AmbientToggle />
        <ThemeToggle />
        <Todo />
      </div>
    </div>
  );
}

const FORMAT = new Intl.DateTimeFormat("en-US", {
  timeZone: "Asia/Kolkata",
  hour: "2-digit",
  minute: "2-digit",
  hour12: true,
});

const clock = () =>
  FORMAT.format(new Date()).replace(/\s?(AM|PM)/i, (_, ap: string) => ap.toLowerCase());

function TimeWidget() {
  const [now, setNow] = useState("");

  useEffect(() => {
    setNow(clock());
    const id = window.setInterval(() => setNow(clock()), 1000);
    return () => window.clearInterval(id);
  }, []);

  return (
    <span className="time-widget">
      <a
        className="name-link"
        href="https://github.com/vishwa-io"
        target="_blank"
        rel="noreferrer"
        aria-label="Vishwa on GitHub"
        title="Vishwa on GitHub"
      >
        Vishwa
      </a>
      <span aria-hidden="true"> | </span>
      <span className="time-widget-clock">{now || "00:00am"}</span>
    </span>
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

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem("dreamy-tasks") || "[]");
      if (Array.isArray(saved)) {
        setTasks(saved.map((item) => String(item.text ?? "")));
        setChecked(saved.map((item) => Boolean(item.done)));
      }
    } catch {}
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(
        "dreamy-tasks",
        JSON.stringify(tasks.map((text, i) => ({ text, done: checked[i] ?? false })))
      );
    } catch {}
  }, [tasks, checked]);

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
