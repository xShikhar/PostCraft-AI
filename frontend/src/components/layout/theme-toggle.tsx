"use client";
import "./navigation.css";
import { Sun, Moon } from "lucide-react";
import { useTheme } from "next-themes";
import { useMounted } from "@/lib/use-mounted";
export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const mounted = useMounted();
  return (
    <div
      className="workspace-theme inline-flex p-1 bg-surface-subtle border border-border-subtle rounded-full"
      data-theme={mounted ? resolvedTheme : undefined}
      aria-label="Color theme"
    >
      <span className="workspace-theme-thumb" aria-hidden="true" />
      {(["light", "dark"] as const).map((t) => (
        <button
          key={t}
          aria-label={t === "light" ? "Light" : "Dark"} title={t === "light" ? "Light theme" : "Dark theme"}
          aria-pressed={mounted && resolvedTheme === t}
          onClick={() => setTheme(t)}
          className={`workspace-theme-option inline-flex min-h-8 items-center gap-2 rounded-full px-3 text-xs transition-colors ${mounted && resolvedTheme === t ? "text-text-display" : "text-text-muted"}`}
        >
          {t === "light" ? <Sun size={13} /> : <Moon size={13} />}
          <span>{t === "light" ? "Light" : "Dark"}</span>
        </button>
      ))}
    </div>
  );
}
