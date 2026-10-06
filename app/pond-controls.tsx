"use client";

import { useEffect, useState } from "react";

const FILTERS = [
  { id: "dawn", label: "dawn" },
  { id: "day", label: "day" },
  { id: "dusk", label: "dusk" },
  { id: "dark", label: "dark" },
] as const;

type Filter = (typeof FILTERS)[number]["id"];

export default function PondControls() {
  const [active, setActive] = useState<Filter | "auto">("auto");

  useEffect(() => {
    const search = new URLSearchParams(window.location.search);
    const selected = search.get("time")?.toLowerCase();
    if (FILTERS.some((item) => item.id === selected)) {
      setActive(selected as Filter);
    } else {
      setActive("auto");
    }
  }, []);

  const choose = (filter: Filter) => {
    setActive(filter);
    const url = new URL(window.location.href);
    url.searchParams.set("time", filter);
    url.searchParams.delete("hour");
    window.history.replaceState({}, "", url);

    window.dispatchEvent(new CustomEvent("pond-time-change", { detail: filter }));
  };

  return (
    <aside className="pond-filters" aria-label="Pond atmosphere">
      {FILTERS.map((filter) => (
        <button
          key={filter.id}
          className={active === filter.id ? "pond-filter active" : "pond-filter"}
          type="button"
          onClick={() => choose(filter.id)}
          aria-pressed={active === filter.id}
        >
          <span className="pond-filter-dot" aria-hidden="true" />
          {filter.label}
        </button>
      ))}
    </aside>
  );
}
