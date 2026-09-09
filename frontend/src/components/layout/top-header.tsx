"use client";

import { useState, useRef, useEffect } from "react";
import { Search, Bell, User, Check, X, Settings, LogOut } from "lucide-react";
import { useAuth } from "@/features/auth/hooks/use-auth";

interface TopHeaderProps {
  title: string;
  username?: string;
  initials?: string;
  collapsed?: boolean;
  onNavigate?: (view: "profile") => void;
}

type SearchResult = {
  id: string;
  topic: string;
  preview: string;
  platform: string;
};

export function TopHeader({ title, username, initials, collapsed = false, onNavigate }: TopHeaderProps) {
  const { logout } = useAuth();
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifUnread, setNotifUnread] = useState(true);
  const [profileOpen, setProfileOpen] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const searchContainerRef = useRef<HTMLDivElement>(null);
  const notifContainerRef = useRef<HTMLDivElement>(null);
  const profileContainerRef = useRef<HTMLDivElement>(null);

  // Close popovers on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      const target = e.target as Node;
      if (searchContainerRef.current && !searchContainerRef.current.contains(target)) {
        setSearchOpen(false);
      }
      if (notifContainerRef.current && !notifContainerRef.current.contains(target)) {
        setNotifOpen(false);
      }
      if (profileContainerRef.current && !profileContainerRef.current.contains(target)) {
        setProfileOpen(false);
      }
    }
    if (searchOpen || notifOpen || profileOpen) {
      document.addEventListener("mousedown", handleClick);
      return () => document.removeEventListener("mousedown", handleClick);
    }
  }, [searchOpen, notifOpen, profileOpen]);

  // Focus search input when opened
  useEffect(() => {
    if (searchOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [searchOpen]);

  // Live search against history
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }
    setSearching(true);
    const timer = setTimeout(async () => {
      try {
        const token = typeof window !== "undefined" ? localStorage.getItem("postcraft_token") : null;
        const res = await fetch("/api/generations?limit=50", {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (res.ok) {
          const data = await res.json();
          const q = searchQuery.toLowerCase();
          const filtered = (data.items || []).filter((item: SearchResult) =>
            item.topic.toLowerCase().includes(q) ||
            (item.preview || "").toLowerCase().includes(q)
          );
          setSearchResults(filtered.slice(0, 5));
        }
      } catch {
        // ignore
      } finally {
        setSearching(false);
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [searchQuery]);

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
        {/* Search */}
        <div ref={searchContainerRef} className="relative">
          {!searchOpen ? (
            <button
              type="button"
              onClick={() => setSearchOpen(true)}
              className="w-9 h-9 flex items-center justify-center rounded-full bg-surface-subtle text-text-muted hover:text-text-display hover:bg-surface-container transition-all btn-press"
              aria-label="Search"
            >
              <Search className="w-5 h-5" />
            </button>
          ) : (
            <div className="flex items-center gap-space-xs bg-surface-container rounded-full pl-space-sm pr-space-2xs py-space-2xs animate-fade-slide-in">
              <Search className="w-4 h-4 text-text-muted" />
              <input
                ref={searchInputRef}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search drafts..."
                className="bg-transparent font-body-sm text-body-sm text-text-display placeholder:text-outline focus:outline-none w-48"
                onKeyDown={(e) => {
                  if (e.key === "Escape") {
                    setSearchOpen(false);
                    setSearchQuery("");
                  }
                }}
              />
              <button
                type="button"
                onClick={() => {
                  setSearchOpen(false);
                  setSearchQuery("");
                }}
                className="w-6 h-6 flex items-center justify-center rounded-full text-text-muted hover:text-text-display hover:bg-surface-subtle transition-colors"
                aria-label="Close search"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Search dropdown */}
          {searchOpen && searchQuery && (
            <div className="absolute right-0 top-12 w-80 bg-surface-card rounded-xl shadow-2xl border border-border-subtle p-space-2xs animate-fade-slide-up max-h-96 overflow-y-auto z-50">
              {searching ? (
                <div className="px-space-sm py-space-md text-center text-text-muted font-body-sm text-body-sm">
                  Searching...
                </div>
              ) : searchResults.length === 0 ? (
                <div className="px-space-sm py-space-md text-center text-text-muted font-body-sm text-body-sm">
                  No drafts match &quot;{searchQuery}&quot;
                </div>
              ) : (
                searchResults.map((r) => (
                  <button
                    key={r.id}
                    onClick={() => {
                      // Navigate to history with this item open — but for simplicity close search.
                      // The full open flow happens in page.tsx via the History view.
                      window.location.href = `/history?open=${r.id}`;
                      setSearchOpen(false);
                    }}
                    className="w-full text-left px-space-sm py-space-xs rounded-lg hover:bg-surface-subtle transition-colors"
                  >
                    <div className="flex items-center gap-space-xs mb-1">
                      <span className="px-space-2xs py-0 bg-surface-subtle text-text-body rounded-full font-label-xs text-label-xs uppercase tracking-wider">
                        {r.platform === "x" ? "𝕏" : "in"}
                      </span>
                    </div>
                    <div className="font-title-sm text-body-sm text-text-display line-clamp-1">
                      {r.topic}
                    </div>
                    {r.preview && (
                      <div className="font-body-sm text-body-sm text-text-muted line-clamp-1 mt-0.5">
                        {r.preview}
                      </div>
                    )}
                  </button>
                ))
              )}
            </div>
          )}
        </div>

        {/* Notifications */}
        <div ref={notifContainerRef} className="relative">
          <button
            type="button"
            onClick={() => {
              setNotifOpen((v) => !v);
              setProfileOpen(false);
            }}
            className="w-9 h-9 flex items-center justify-center rounded-full bg-surface-subtle text-text-muted hover:text-text-display hover:bg-surface-container transition-all btn-press relative"
            aria-label="Notifications"
          >
            <Bell className="w-5 h-5" />
            {notifUnread && (
              <span className="absolute top-2 right-2 w-2 h-2 bg-secondary rounded-full animate-pulse" />
            )}
          </button>

          {notifOpen && (
            <div className="absolute right-0 top-12 w-80 bg-surface-card rounded-xl shadow-2xl border border-border-subtle p-space-md animate-fade-slide-up z-50">
              <div className="flex items-center justify-between mb-space-sm">
                <h3 className="font-serif text-title-sm text-text-display">Notifications</h3>
                <button
                  type="button"
                  onClick={() => setNotifUnread(false)}
                  disabled={!notifUnread}
                  className="text-label-xs text-text-muted hover:text-primary transition-colors disabled:opacity-50 disabled:cursor-default disabled:hover:text-text-muted"
                >
                  Mark all read
                </button>
              </div>
              <div className="flex flex-col gap-space-xs">
                <div className="px-space-sm py-space-xs rounded-lg bg-surface-subtle flex items-start gap-space-xs">
                  <div className="w-8 h-8 rounded-full bg-primary-fixed flex items-center justify-center flex-shrink-0">
                    <Check className="w-4 h-4 text-primary" />
                  </div>
                  <div className="flex flex-col">
                    <span className="font-body-sm text-body-sm text-text-display">
                      Welcome to PostCraft AI
                    </span>
                    <span className="font-label-xs text-label-xs text-text-muted">
                      Generate your first post to get started
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="h-4 w-px bg-border-subtle mx-space-2xs" />

        {/* Profile menu */}
        <div ref={profileContainerRef} className="relative">
          <button
            type="button"
            onClick={() => {
              setProfileOpen((v) => !v);
              setNotifOpen(false);
            }}
            className="w-9 h-9 rounded-full bg-surface-container-high text-primary flex items-center justify-center font-headline-md text-body-sm font-semibold hover:scale-105 active:scale-95 transition-transform ring-2 ring-transparent hover:ring-primary-container"
            aria-label="Open profile menu"
          >
            {initials || <User className="w-4 h-4" />}
          </button>

          {profileOpen && (
            <div className="absolute right-0 top-12 w-64 bg-surface-card rounded-xl shadow-2xl border border-border-subtle p-space-xs animate-fade-slide-up z-50">
              <div className="px-space-sm py-space-sm flex items-center gap-space-sm border-b border-border-subtle">
                <div className="w-10 h-10 rounded-full bg-surface-container-high text-primary flex items-center justify-center font-headline-md text-body-sm font-semibold flex-shrink-0">
                  {initials || <User className="w-4 h-4" />}
                </div>
                <div className="flex flex-col min-w-0">
                  <span className="font-title-sm text-body-sm text-text-display truncate">
                    {username || "User"}
                  </span>
                  <span className="font-label-xs text-label-xs text-text-muted truncate">
                    Signed in
                  </span>
                </div>
              </div>
              <div className="py-space-xs">
                <button
                  type="button"
                  onClick={() => {
                    setProfileOpen(false);
                    onNavigate?.("profile");
                  }}
                  className="w-full flex items-center gap-space-sm px-space-sm py-space-xs rounded-lg hover:bg-surface-subtle transition-colors text-left btn-press"
                >
                  <Settings className="w-4 h-4 text-text-muted" />
                  <span className="font-body-sm text-body-sm text-text-display">Profile & Voice</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setProfileOpen(false);
                    logout();
                  }}
                  className="w-full flex items-center gap-space-sm px-space-sm py-space-xs rounded-lg hover:bg-secondary-fixed/20 transition-colors text-left btn-press"
                >
                  <LogOut className="w-4 h-4 text-secondary" />
                  <span className="font-body-sm text-body-sm text-secondary">Sign out</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
