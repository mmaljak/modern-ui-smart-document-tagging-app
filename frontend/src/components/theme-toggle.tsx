import { useEffect, useState } from "react";
import { Sun, Moon } from "lucide-react";
import { Button } from "@/components/ui/button";

type Theme = "light" | "dark";

/**
 * Light/dark toggle. The actual class is applied pre-paint by the inline script
 * in __root.tsx (reads localStorage, falls back to OS preference) to avoid a
 * flash of the wrong theme. This component only reflects and flips that state.
 */
export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("light");
  const [mounted, setMounted] = useState(false);

  // Read the real theme only after mount — the server has no theme knowledge,
  // so deferring avoids a hydration mismatch on the icon.
  useEffect(() => {
    setMounted(true);
    setTheme(document.documentElement.classList.contains("dark") ? "dark" : "light");
  }, []);

  const toggle = () => {
    const next: Theme = theme === "dark" ? "light" : "dark";
    document.documentElement.classList.toggle("dark", next === "dark");
    try {
      localStorage.setItem("theme", next);
    } catch {
      // ignore (e.g. storage disabled) — the class still applies for this session
    }
    setTheme(next);
  };

  // Reserve the same footprint before mount to avoid layout shift.
  if (!mounted) {
    return <Button variant="ghost" size="icon" aria-hidden disabled className="opacity-0" />;
  }

  const isDark = theme === "dark";
  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={toggle}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      title={isDark ? "Switch to light mode" : "Switch to dark mode"}
    >
      {isDark ? <Sun /> : <Moon />}
    </Button>
  );
}
