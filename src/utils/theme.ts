export function initTheme(): void {
  try {
    const root = document.documentElement;
    const current = root.getAttribute("data-theme");
    if (current) return;
    const prefersDark =
      typeof window !== "undefined" &&
      (window as any).matchMedia &&
      (window as any).matchMedia("(prefers-color-scheme: dark)").matches;
    root.setAttribute("data-theme", prefersDark ? "dark" : "light");
  } catch (e) {
    // noop in non-browser environments
  }
}

