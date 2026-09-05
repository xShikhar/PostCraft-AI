"use client";

import { Search, Bell, User } from "lucide-react";

interface TopHeaderProps {
  title: string;
  username?: string;
  initials?: string;
  collapsed?: boolean;
}

export function TopHeader({ title, username, initials, collapsed = false }: TopHeaderProps) {
  return (
    <header
      className={`
        fixed top-0 right-0 h-16 bg-surface-card/80 backdrop-blur-xl z-40 px-space-2xl
        flex items-center justify-between border-b border-border-subtle
        transition-all duration-300 ease-in-out
        ${collapsed ? "left-16" : "left-sidebar-width"}
      `}
    >
      <div className="flex items-center gap-space-sm">
        <span className="font-label-md text-label-md uppercase tracking-wider text-text-muted">
          {title}
        </span>
      </div>

      <div className="flex items-center gap-space-md">
        {/* Search (display-only for Phase 3) */}
        <button
          type="button"
          className="w-9 h-9 flex items-center justify-center rounded-full bg-surface-subtle text-text-muted hover:text-text-display transition-colors"
          aria-label="Search"
        >
          <Search className="w-5 h-5" />
        </button>

        {/* Notifications (display-only) */}
        <button
          type="button"
          className="w-9 h-9 flex items-center justify-center rounded-full bg-surface-subtle text-text-muted hover:text-text-display transition-colors relative"
          aria-label="Notifications"
        >
          <Bell className="w-5 h-5" />
          <span className="absolute top-2 right-2 w-2 h-2 bg-secondary rounded-full" />
        </button>

        <div className="h-4 w-px bg-border-subtle mx-space-2xs" />

        {/* User avatar */}
        <div className="w-8 h-8 rounded-full bg-surface-container-high text-primary flex items-center justify-center font-headline-md text-body-sm font-semibold">
          {initials || <User className="w-4 h-4" />}
        </div>
      </div>
    </header>
  );
}
