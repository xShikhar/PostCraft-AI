"use client";
import { Sun, Moon } from "lucide-react";
import { useTheme } from "next-themes";
import { useMounted } from "@/lib/use-mounted";
export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const mounted = useMounted();
  return (
    <div
      className="inline-flex p-1 bg-surface-subtle border border-border-subtle rounded-full"
      aria-label="Color theme"
    >
      {(["light", "dark"] as const).map((t) => (
        <button
          key={t}
          aria-pressed={mounted && resolvedTheme === t}
          onClick={() => setTheme(t)}
          className={`inline-flex min-h-8 items-center gap-2 rounded-full px-3 text-xs transition-colors ${mounted && resolvedTheme === t ? "bg-surface-card text-text-display shadow-sm" : "text-text-muted"}`}
        >
          {t === "light" ? <Sun size={13} /> : <Moon size={13} />}
          <span>{t === "light" ? "Light" : "Dark"}</span>
        </button>
      ))}
    </div>
  );
}
