"use client";

import { useState, useEffect, useRef } from "react";
import { useTheme } from "next-themes";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";

gsap.registerPlugin(useGSAP);
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

  const sidebarRef = useRef<HTMLElement>(null);
  const isFirstRender = useRef(true);

  useGSAP(() => {
    const isReduced = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (isFirstRender.current) {
      isFirstRender.current = false;
      if (collapsed) {
        gsap.set(sidebarRef.current, { xPercent: -100, autoAlpha: 0 });
      } else {
        gsap.set(sidebarRef.current, { xPercent: 0, autoAlpha: 1 });
      }
      return;
    }

    if (collapsed) {
      gsap.to(sidebarRef.current, {
        xPercent: -100,
        autoAlpha: 0,
        duration: isReduced ? 0 : 0.24,
        ease: "power2.inOut",
        overwrite: "auto",
      });
    } else {
      gsap.to(sidebarRef.current, {
        xPercent: 0,
        autoAlpha: 1,
        duration: isReduced ? 0 : 0.24,
        ease: "power2.out",
        overwrite: "auto",
      });
    }
  }, { scope: sidebarRef, dependencies: [collapsed] });

  const pillContainerRef = useRef<HTMLDivElement>(null);
  const pillThumbRef = useRef<HTMLDivElement>(null);
  const sunIconRef = useRef<HTMLSpanElement>(null);
  const moonIconRef = useRef<HTMLSpanElement>(null);
  const isPillFirstRender = useRef(true);

  useGSAP(() => {
    const isReduced = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const isDark = theme === "dark";

    if (isPillFirstRender.current) {
      isPillFirstRender.current = false;
      if (pillThumbRef.current) {
        gsap.set(pillThumbRef.current, { xPercent: isDark ? 100 : 0 });
      }
      return;
    }

    if (pillThumbRef.current) {
      gsap.to(pillThumbRef.current, {
        xPercent: isDark ? 100 : 0,
        duration: isReduced ? 0 : 0.22,
        ease: "power2.out",
        overwrite: "auto",
      });
    }

    if (!isReduced) {
      if (isDark && moonIconRef.current) {
        gsap.fromTo(
          moonIconRef.current,
          { rotation: -25, scale: 0.85 },
          { rotation: 0, scale: 1, duration: 0.25, ease: "back.out(1.7)" }
        );
      } else if (!isDark && sunIconRef.current) {
        gsap.fromTo(
          sunIconRef.current,
          { rotation: 30, scale: 0.85 },
          { rotation: 0, scale: 1, duration: 0.25, ease: "back.out(1.7)" }
        );
      }
    }
  }, { scope: pillContainerRef, dependencies: [theme] });

  return (
    <aside
      ref={sidebarRef}
      className="fixed top-0 left-0 bottom-0 z-50 flex flex-col justify-between p-space-lg bg-surface-card border-r border-border-subtle shadow-sidebar w-sidebar-width"
    >
      {/* Inner content */}
      <div className="flex flex-col gap-space-lg">
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

      {/* Bottom section — theme + user */}
      <div className="flex flex-col gap-space-md pt-space-md">
        {/* Theme toggle pill */}
        <div ref={pillContainerRef} className="relative p-space-2xs bg-surface-subtle rounded-full flex items-center justify-between">
          <div
            ref={pillThumbRef}
            className="absolute top-[3px] bottom-[3px] left-[3px] w-[calc(50%-3px)] bg-surface-card rounded-full shadow-sm pointer-events-none"
          />
          <button
            onClick={() => setTheme("light")}
            className={`
              relative z-10 flex-1 flex items-center justify-center gap-space-xs py-space-2xs rounded-full transition-colors text-label-xs
              ${theme === "light"
                ? "text-text-display font-semibold"
                : "text-text-muted hover:text-text-display"
              }
            `}
          >
            <span ref={sunIconRef} className="inline-flex items-center justify-center">
              <Sun className="w-3.5 h-3.5" />
            </span>
            <span>Light</span>
          </button>
          <button
            onClick={() => setTheme("dark")}
            className={`
              relative z-10 flex-1 flex items-center justify-center gap-space-xs py-space-2xs rounded-full transition-colors text-label-xs
              ${theme === "dark"
                ? "text-text-display font-semibold"
                : "text-text-muted hover:text-text-display"
              }
            `}
          >
            <span ref={moonIconRef} className="inline-flex items-center justify-center">
              <Moon className="w-3.5 h-3.5" />
            </span>
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
