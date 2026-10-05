"use client";
import { useEffect, useState } from "react";
import { Moon, Sun } from "./icons";

export default function ThemeToggle({ className = "icon-btn" }: { className?: string }) {
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  useEffect(() => {
    setTheme(document.documentElement.dataset.theme === "light" ? "light" : "dark");
  }, []);
  const flip = () => {
    const next = theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    try { localStorage.setItem("theme", next); } catch {}
    setTheme(next);
  };
  return (
    <button className={className} onClick={flip} aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`} title="Theme">
      {theme === "dark" ? <Sun /> : <Moon />}
    </button>
  );
}
