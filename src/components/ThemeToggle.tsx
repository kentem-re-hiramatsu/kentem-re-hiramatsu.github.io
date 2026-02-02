import React from "react";

export default function ThemeToggle() {
  const toggle = () => {
    const root = document.documentElement;
    const current = root.getAttribute("data-theme");
    root.setAttribute("data-theme", current === "dark" ? "light" : "dark");
  };
  return (
    <button onClick={toggle} aria-label="テーマ切替">
      テーマ
    </button>
  );
}

