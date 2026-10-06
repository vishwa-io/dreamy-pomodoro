"use client";

import { useState } from "react";

/** Copies a value to the clipboard and briefly confirms. */
export default function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    } catch {
      /* clipboard can be blocked (insecure context, denied permission) */
    }
  }

  return (
    <button
      className="copy-button"
      type="button"
      onClick={copy}
      aria-label={`Copy ${value}`}
    >
      {copied ? "copied" : "copy"}
    </button>
  );
}
