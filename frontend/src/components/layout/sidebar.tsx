"use client";

import { useState, useEffect } from "react";
import { useTheme } from "next-themes";
import Image from "next/image";
import {
  Plus,
  Home,
  History,
  Mic,
  Sun,
  Moon,
  LogOut,
  Loader2,
  Menu,
  X,
} from "lucide-react";
import { getCurrentUser, type UserResponse } from "@/lib/api/user";

interface SidebarProps {
  currentView: "home" | "editor" | "profile" | "history" | "privacy" | "terms" | "new-generation";
  collapsed: boolean;
  onToggleCollapse: () => void;
  onNavigate: (view: "home" | "editor" | "profile" | "history" | "privacy" | "terms") => void;
  onNewPost: () => void;
  onLogout: () => void;
}

const navItems: { view: "home" | "history" | "profile"; label: string; icon: React.ReactNode }[] = [
  { view: "home", label: "Home", icon: <Home className="w-5 h-5" /> },
  { view: "history", label: "History", icon: <History className="w-5 h-5" /> },
  { view: "profile", label: "Profile & Voice", icon: <Mic className="w-5 h-5" /> },
];

function ThemeLogo({ size = 32 }: { size?: number }) {
  const { theme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // Avoid hydration mismatch — show light by default before mount
  const activeTheme = mounted ? resolvedTheme || theme : "light";

  return (
    <div
      className="relative flex items-center justify-center rounded-lg overflow-hidden bg-surface-container"
      style={{ width: size, height: size }}
    >
      <Image
        src={activeTheme === "dark" ? "/logo-dark.png" : "/logo-light.png"}
        alt="PostCraft AI"
        width={size}
        height={size}
        className="object-contain"
        priority
      />
    </div>
  );
}

export function Sidebar({
  currentView,
  collapsed,
  onToggleCollapse,
  onNavigate,
  onNewPost,
  onLogout,
}: SidebarProps) {
  const { theme, setTheme } = useTheme();
  const [user, setUser] = useState<UserResponse | null>(null);
  const [userLoading, setUserLoading] = useState(true);

  useEffect(() => {
    getCurrentUser()
      .then((u) => {
        setUser(u);
        setUserLoading(false);
      })
      .catch(() => {
        setUserLoading(false);
      });
  }, []);

  const initials = user?.username
    ? user.username.slice(0, 2).toUpperCase()
    : "?";

  return (
    <aside
      className={`
        fixed top-0 left-0 bottom-0 z-50 flex flex-col justify-between p-space-lg
        bg-surface-card border-r border-border-subtle shadow-sidebar
        transition-all duration-300 ease-in-out
        ${collapsed ? "w-0 overflow-hidden p-0" : "w-sidebar-width"}
      `}
    >
      {/* Inner content — always rendered but hidden when collapsed */}
      <div className={`flex flex-col gap-space-lg ${collapsed ? "opacity-0 pointer-events-none" : ""}`}>
        {/* Brand row */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-space-sm">
            <ThemeLogo />
            <span className="wordmark font-serif text-title-lg text-text-display">POSTCRAFT AI</span>
          </div>
          <button
            onClick={onToggleCollapse}
            className="p-space-2xs text-text-muted hover:text-text-display rounded-lg transition-colors flex items-center justify-center"
            aria-label="Collapse sidebar"
          >
            <Menu className="w-5 h-5" />
          </button>
        </div>

        {/* New post CTA */}
        <button
          onClick={onNewPost}
          className="w-full flex items-center justify-center gap-space-xs py-space-sm px-space-lg bg-text-display dark:bg-primary text-surface-card dark:text-on-primary rounded-full font-label-md text-label-md tracking-wide transition-transform hover:scale-[1.01] active:scale-[0.98] shadow-md btn-press"
        >
          <Plus className="w-4 h-4" />
          <span>New post</span>
        </button>

        {/* Navigation */}
        <nav className="flex flex-col gap-space-2xs">
          {navItems.map((item) => {
            const active = currentView === item.view;
            return (
              <button
                key={item.view}
                onClick={() => onNavigate(item.view)}
                className={`
                  flex items-center gap-space-sm px-space-md py-space-sm rounded-xl transition-colors text-left btn-press
                  ${active
                    ? "bg-surface-container-high text-primary font-title-sm shadow-sm"
                    : "text-text-muted hover:bg-surface-subtle hover:text-text-display"
                  }
                `}
              >
                <span className="w-5 h-5 flex-shrink-0">{item.icon}</span>
                <span className="font-body-md text-body-md">{item.label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Bottom section — theme + user (always visible even when collapsed via icon-only mode) */}
      <div className={`flex flex-col gap-space-md ${collapsed ? "opacity-0 pointer-events-none" : "pt-space-md"}`}>
        {/* Theme toggle pill */}
        <div className="p-space-2xs bg-surface-subtle rounded-full flex items-center justify-between">
          <button
            onClick={() => setTheme("light")}
            className={`
              flex-1 flex items-center justify-center gap-space-xs py-space-2xs rounded-full transition-colors text-label-xs
              ${theme === "light"
                ? "bg-surface-card text-text-display shadow-sm font-semibold"
                : "text-text-muted hover:text-text-display"
              }
            `}
          >
            <Sun className="w-3.5 h-3.5" />
            <span>Light</span>
          </button>
          <button
            onClick={() => setTheme("dark")}
            className={`
              flex-1 flex items-center justify-center gap-space-xs py-space-2xs rounded-full transition-colors text-label-xs
              ${theme === "dark"
                ? "bg-surface-card text-text-display shadow-sm font-semibold"
                : "text-text-muted hover:text-text-display"
              }
            `}
          >
            <Moon className="w-3.5 h-3.5" />
            <span>Dark</span>
          </button>
        </div>

        {/* User identity row — clickable to navigate to profile */}
        <div className="flex items-center justify-between pt-space-xs">
          {userLoading ? (
            <div className="flex items-center gap-space-sm">
              <div className="w-9 h-9 rounded-full bg-surface-container-high flex items-center justify-center">
                <Loader2 className="w-5 h-5 text-primary animate-spin" />
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => onNavigate("profile")}
              className="flex items-center gap-space-sm min-w-0 flex-1 text-left p-space-2xs -ml-space-2xs rounded-lg hover:bg-surface-subtle transition-colors group"
              aria-label="Open profile and voice settings"
            >
              <div className="w-9 h-9 rounded-full bg-surface-container-high flex items-center justify-center text-primary font-headline-md text-title-sm font-semibold flex-shrink-0 ring-2 ring-transparent group-hover:ring-primary-container transition-all">
                {initials}
              </div>
              <div className="flex flex-col min-w-0">
                <span className="font-title-sm text-body-sm text-text-display font-semibold truncate leading-tight group-hover:text-primary transition-colors">
                  {user?.username ?? "User"}
                </span>
                <span className="font-body-sm text-body-sm text-text-muted truncate leading-tight">
                  {user?.profile_context || "Creator"}
                </span>
              </div>
            </button>
          )}
          <button
            onClick={onLogout}
            className="p-space-2xs text-text-muted hover:text-secondary rounded-lg transition-colors flex items-center justify-center btn-press"
            title="Sign out"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>

        {/* Legal links — small footer, doesn't compete with primary nav */}
        <div className="flex items-center gap-space-xs pt-space-2xs border-t border-border-subtle">
          <button
            onClick={() => onNavigate("privacy")}
            className="font-body-sm text-body-sm text-text-muted hover:text-text-display transition-colors"
          >
            Privacy
          </button>
          <span className="w-1 h-1 rounded-full bg-outline-variant" />
          <button
            onClick={() => onNavigate("terms")}
            className="font-body-sm text-body-sm text-text-muted hover:text-text-display transition-colors"
          >
            Terms
          </button>
        </div>
      </div>
    </aside>
  );
}
