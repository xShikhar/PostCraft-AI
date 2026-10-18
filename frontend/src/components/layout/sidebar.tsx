"use client";
import {
  ArrowUpRight,
  Home,
  History,
  Feather,
  Plus,
  LogOut,
  Shield,
} from "lucide-react";
import { Brand } from "./brand";
import { ThemeToggle } from "./theme-toggle";
export type WorkspaceView =
  | "home"
  | "compose"
  | "selection"
  | "editor"
  | "profile"
  | "history"
  | "privacy"
  | "terms";
export function Sidebar({
  currentView,
  onNavigate,
  onNewPost,
  onLogout,
  username,
  isAdmin = false,
}: {
  currentView: WorkspaceView;
  onNavigate: (view: WorkspaceView) => void;
  onNewPost: () => void;
  onLogout: () => void;
  username: string;
  isAdmin?: boolean;
}) {
  const items = [
    { view: "home", label: "Home", icon: Home },
    { view: "history", label: "History", icon: History },
    { view: "profile", label: "Profile & Voice", icon: Feather },
  ] as const;
  return (
    <div className="flex flex-col h-full px-5 py-7">
      <button
        onClick={() => onNavigate("home")}
        aria-label="PostCraft home"
        className="text-left mb-9"
      >
        <Brand />
      </button>
      <button
        onClick={onNewPost}
        className="btn-primary w-full justify-between mb-9"
      >
        <span>New post</span>
        <Plus size={16} />
      </button>
      <p className="eyebrow px-3 mb-3 text-[9px]">Your workspace</p>
      <nav aria-label="Main navigation" className="space-y-1.5">
        {items.map(({ view, label, icon: Icon }) => (
          <button
            key={view}
            onClick={() => onNavigate(view)}
            aria-current={currentView === view ? "page" : undefined}
            className={`w-full flex items-center gap-3 px-3.5 py-3 rounded-xl text-[13px] transition-colors ${currentView === view ? "bg-primary/10 text-primary font-bold" : "text-text-muted hover:bg-surface-container hover:text-text-display"}`}
          >
            <Icon size={17} strokeWidth={1.65} />
            {label}
            {currentView === view && (
              <span className="ml-auto w-1 h-1 rounded-full bg-primary" />
            )}
          </button>
        ))}
      </nav>
      <div className="mt-auto pt-10">
        <div className="border-t border-border-subtle pt-5 mb-6">
          <p className="font-serif text-[17px] text-text-display leading-relaxed">
            A place for your
            <br />
            <em className="text-text-muted">next good thought.</em>
          </p>
          <p className="mt-2 text-[11px] text-text-muted">
            Write with intention.
          </p>
        </div>
        <ThemeToggle />
        <div className="flex items-center gap-3 mt-6 pt-5 border-t border-border-subtle">
          <button
            className="w-9 h-9 rounded-full bg-primary/10 text-primary text-xs font-bold"
            onClick={() => onNavigate("profile")}
            aria-label="Profile settings"
          >
            {username.slice(0, 2).toUpperCase() || "P"}
          </button>
          <button
            onClick={() => onNavigate("profile")}
            className="min-w-0 flex-1 text-left"
          >
            <p className="text-xs font-bold text-text-display truncate">
              {username || "Your workspace"}
            </p>
            <p className="text-[10px] text-text-muted">Personal workspace</p>
          </button>
          <button
            className="icon-button !w-8 !min-h-8"
            onClick={onLogout}
            aria-label="Sign out"
          >
            <LogOut size={15} />
          </button>
        </div>
        {isAdmin && (
          <a
            className="mt-4 flex items-center gap-2 text-xs text-text-muted hover:text-primary"
            href="/admin"
          >
            <Shield size={13} />
            Administration
            <ArrowUpRight size={12} />
          </a>
        )}
        <div className="flex gap-4 mt-5 text-[10px] text-text-muted">
          <button onClick={() => onNavigate("privacy")}>Privacy</button>
          <button onClick={() => onNavigate("terms")}>Terms</button>
        </div>
      </div>
    </div>
  );
}
