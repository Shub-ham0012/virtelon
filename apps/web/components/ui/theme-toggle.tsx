"use client";

import { useEffect, useState } from "react";

function currentTheme(): "light" | "dark" {
  const stamped = document.documentElement.getAttribute("data-theme");
  if (stamped === "light" || stamped === "dark") return stamped;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function ThemeToggle({ className = "" }: { className?: string }) {
  const [theme, setTheme] = useState<"light" | "dark" | null>(null);

  useEffect(() => {
    setTheme(currentTheme());
  }, []);

  function toggle() {
    const next = currentTheme() === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    localStorage.setItem("virtelon-theme", next);
    setTheme(next);
  }

  return (
    <button
      type="button"
      onClick={toggle}
      className={`rounded-md border border-(--rail-border) bg-white/5 px-3 py-2 text-xs text-(--rail-sub) transition hover:bg-white/10 hover:text-(--rail-ink) ${className}`}
    >
      {theme === "dark" ? "Switch to light" : "Switch to dark"}
    </button>
  );
}
