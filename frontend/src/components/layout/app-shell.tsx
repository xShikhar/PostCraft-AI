"use client";

import { ReactNode, useState } from "react";
import { Sidebar } from "./sidebar";
import { TopHeader } from "./top-header";
import { useAuth } from "@/features/auth/hooks/use-auth";
import { Home, History, Mic, Plus, Menu } from "lucide-react";

type View = "home" | "editor" | "profile" | "history" | "privacy" | "terms";

interface AppShellProps {
  children: ReactNode;
  currentView: View;
  onNavigate: (view: "home" | "editor" | "profile" | "history" | "privacy" | "terms") => void;
  onNewPost: () => void;
  headerTitle: string;
  username?: string;
  initials?: string;
}

export function AppShell({
  children,
  currentView,
  onNavigate,
  onNewPost,
  headerTitle,
  username,
  initials,
}: AppShellProps) {
  const { logout } = useAuth();
  const [collapsed, setCollapsed] = useState(false);

  const railIcons: { view: "home" | "history" | "profile"; icon: React.ReactNode; label: string }[] = [
    { view: "home", icon: <Home className="w-5 h-5" />, label: "Home" },
    { view: "history", icon: <History className="w-5 h-5" />, label: "History" },
    { view: "profile", icon: <Mic className="w-5 h-5" />, label: "Profile & Voice" },
  ];

  return (
    <div className="min-h-screen bg-canvas-base relative">
      {/* Expanded sidebar */}
      <Sidebar
        currentView={currentView}
        collapsed={collapsed}
        onToggleCollapse={() => setCollapsed(true)}
        onNavigate={onNavigate}
        onNewPost={onNewPost}
        onLogout={logout}
      />

      {/* Collapsed rail (shown when sidebar is collapsed) */}
      {collapsed && (
        <aside className="fixed top-0 left-0 bottom-0 w-16 bg-surface-card border-r border-border-subtle z-50 flex flex-col items-center justify-between py-space-lg shadow-sidebar">
          <div className="flex flex-col items-center gap-space-md">
            {/* Logo */}
            <div className="w-8 h-8 rounded-lg bg-surface-container flex items-center justify-center">
              <svg className="w-5 h-5 text-primary" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                <path d="M10 2L12.5 7.5L18 8.5L14 12.5L15 18L10 15.5L5 18L6 12.5L2 8.5L7.5 7.5L10 2Z" fill="currentColor" opacity="0.9"/>
              </svg>
            </div>

            {/* Expand button */}
            <button
              onClick={() => setCollapsed(false)}
              className="p-space-2xs text-text-muted hover:text-text-display rounded-lg transition-colors flex items-center justify-center"
              aria-label="Expand sidebar"
            >
              <Menu className="w-5 h-5" />
            </button>

            {/* New post */}
            <button
              onClick={onNewPost}
              className="w-9 h-9 rounded-full bg-text-display dark:bg-primary text-surface-card dark:text-on-primary flex items-center justify-center transition-transform hover:scale-[1.05] active:scale-[0.95] shadow-md"
              aria-label="New post"
            >
              <Plus className="w-4 h-4" />
            </button>

            {/* Nav icons */}
            <nav className="flex flex-col items-center gap-space-2xs mt-space-xs">
              {railIcons.map((item) => {
                const active = currentView === item.view;
                return (
                  <button
                    key={item.view}
                    onClick={() => onNavigate(item.view)}
                    className={`
                      w-9 h-9 rounded-lg flex items-center justify-center transition-colors
                      ${active
                        ? "bg-surface-container-high text-primary"
                        : "text-text-muted hover:bg-surface-subtle hover:text-text-display"
                      }
                    `}
                    aria-label={item.label}
                    title={item.label}
                  >
                    {item.icon}
                  </button>
                );
              })}
            </nav>
          </div>

          {/* Sign out at the bottom */}
          <button
            onClick={logout}
            className="p-space-2xs text-text-muted hover:text-secondary rounded-lg transition-colors flex items-center justify-center"
            aria-label="Sign out"
            title="Sign out"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
          </button>
        </aside>
      )}

      {/* Main content area — adjusts left padding based on collapsed state */}
      <div
        className={`
          flex flex-col min-h-screen transition-all duration-300 ease-in-out
          ${collapsed ? "pl-16" : "pl-sidebar-width"}
        `}
      >
        <TopHeader
          title={headerTitle}
          username={username}
          initials={initials}
          collapsed={collapsed}
        />

        <main className="flex-1 w-full pt-16 bg-canvas-base">
          <div className="max-w-7xl mx-auto px-layout-margin-desktop py-space-xl relative z-10">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
