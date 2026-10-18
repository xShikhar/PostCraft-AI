"use client";
import { useEffect, useState, useRef } from "react";
import { Search, ArrowUpRight, Menu, Loader2 } from "lucide-react";
import { listGenerations, type HistoryItem } from "@/lib/api/history";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
export function TopHeader({
  title,
  username,
  onOpenGeneration,
  onMenu,
  onProfile,
}: {
  title: string;
  username: string;
  onOpenGeneration: (id: string) => void;
  onMenu: () => void;
  onProfile: () => void;
}) {
  const searchTrigger = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false),
    [query, setQuery] = useState(""),
    [items, setItems] = useState<HistoryItem[]>([]),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    const timer = setTimeout(async () => {
      setBusy(true);
      setError("");
      try {
        const data = await listGenerations({ limit: 8, q: query.trim() });
        if (!cancelled) setItems(data.items);
      } catch {
        if (!cancelled)
          setError("Search is unavailable. Change your search to retry.");
      } finally {
        if (!cancelled) setBusy(false);
      }
    }, 200);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [open, query]);
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);
  return (
    <>
      <header className="h-[76px] flex items-center justify-between border-b border-border-subtle px-5 sm:px-8 lg:px-10 gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={onMenu}
            className="icon-button lg:hidden"
            aria-label="Open navigation"
          >
            <Menu size={20} />
          </button>
          <span className="eyebrow truncate !tracking-[.1em] !text-[9px]">
            Workspace <span className="mx-3 text-border-hover">/</span>
            <span className="text-text-body">{title}</span>
          </span>
        </div>
        <div className="flex items-center gap-3">
          <button
            className="icon-button sm:!w-auto sm:gap-3 sm:px-3 sm:border sm:border-border-subtle sm:bg-surface-card"
            onClick={() => setOpen(true)}
            aria-label="Search history"
            ref={searchTrigger}
          >
            <Search size={16} />
            <span className="hidden sm:inline text-xs font-normal">
              Find a draft
            </span>
            <kbd className="hidden md:inline text-[10px] text-text-muted bg-surface-subtle px-1.5 py-0.5 rounded">
              Ctrl K
            </kbd>
          </button>
          <button
            aria-label="Profile settings"
            onClick={onProfile}
            className="w-9 h-9 rounded-full border border-border-subtle bg-surface-card text-xs font-bold text-primary"
          >
            {username.slice(0, 2).toUpperCase() || "P"}
          </button>
        </div>
      </header>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          className="!rounded-2xl p-6"
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            searchTrigger.current?.focus();
          }}
        >
          <DialogTitle className="font-serif text-2xl font-normal">
            Find your next draft.
          </DialogTitle>
          <DialogDescription>
            Search your saved topics and notes.
          </DialogDescription>
          <label className="sr-only" htmlFor="workspace-search">
            Search drafts
          </label>
          <input
            autoFocus
            id="workspace-search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="field mt-2"
            placeholder="Search your thoughts…"
          />
          <div
            className="max-h-[55vh] overflow-auto custom-scrollbar"
            aria-live="polite"
          >
            {busy ? (
              <p
                role="status"
                className="p-6 flex gap-2 text-sm text-text-muted"
              >
                <Loader2 size={16} className="animate-spin" />
                Searching your archive…
              </p>
            ) : error ? (
              <p role="alert" className="p-5 text-sm text-error">
                {error}
              </p>
            ) : !items.length ? (
              <p className="empty-state !py-8">No matching drafts yet.</p>
            ) : (
              items.map((item) => (
                <button
                  key={item.generation_id}
                  onClick={() => {
                    setOpen(false);
                    onOpenGeneration(item.generation_id);
                  }}
                  className="w-full flex text-left items-center gap-4 py-4 border-b border-border-subtle last:border-0 hover:text-primary"
                >
                  <div className="min-w-0 flex-1">
                    <p className="eyebrow !text-[9px] mb-1">{item.platform}</p>
                    <p className="font-serif text-base text-text-display truncate">
                      {item.topic}
                    </p>
                    <p className="text-xs text-text-muted line-clamp-1 mt-1">
                      {item.preview}
                    </p>
                  </div>
                  <ArrowUpRight size={16} />
                </button>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
