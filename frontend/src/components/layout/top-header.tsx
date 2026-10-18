"use client";

import { useEffect, useState } from "react";

import { Search, User, LogOut, X } from "lucide-react";

import { listGenerations, type HistoryItem } from "@/lib/api/history";

import { useAuth } from "@/features/auth/hooks/use-auth";



interface TopHeaderProps {

  title: string; username?: string; initials?: string; collapsed?: boolean;

  onNavigate?: (view: "profile") => void;

  onOpenGeneration: (id: string) => void;

}

export function TopHeader({ title, username, collapsed = false, onNavigate, onOpenGeneration }: TopHeaderProps) {

  const { logout } = useAuth();

  const [open, setOpen] = useState(false);

  const [query, setQuery] = useState("");

  const [items, setItems] = useState<HistoryItem[]>([]);

  const [error, setError] = useState("");

  const [busy, setBusy] = useState(false);

  useEffect(() => {

    if (!open) return;

    let cancelled = false;

    const timer = setTimeout(async () => {

      setBusy(true); setError("");

      try {

        const response = await listGenerations({ limit: 5, q: query.trim() });

        if (!cancelled) setItems(response.items);

      } catch { if (!cancelled) setError("Search unavailable. Please try again."); }

      finally { if (!cancelled) setBusy(false); }

    }, 250);

    return () => { cancelled = true; clearTimeout(timer); };

  }, [open, query]);

  return <header className={`fixed top-0 right-0 left-16 ${collapsed ? "" : "md:left-sidebar-width"} h-16 bg-surface-card/95 z-40 px-4 md:px-8 flex items-center justify-between border-b border-border-subtle gap-3`}>

    <span className="text-label-xs uppercase tracking-wide text-text-muted truncate">{title}</span>

    <div className="flex items-center gap-3">

      <button aria-label="Search history" onClick={() => setOpen(!open)} className="p-2 rounded-full hover:bg-surface-container"><Search className="w-5 h-5" /></button>

      <button aria-label="Profile settings" onClick={() => onNavigate?.("profile")} className="flex items-center gap-2"><User className="w-5 h-5" /><span className="hidden sm:inline">{username}</span></button>

      <button aria-label="Sign out" onClick={logout}><LogOut className="w-5 h-5" /></button>

    </div>

    {open && <section className="absolute top-16 right-2 w-[min(22rem,calc(100vw-5rem))] rounded-xl border border-border-subtle bg-surface-card shadow-xl p-4" aria-label="History search">

      <div className="flex gap-2"><input autoFocus aria-label="Search drafts" value={query} onChange={e => setQuery(e.target.value)} onKeyDown={e => e.key === "Escape" && setOpen(false)} className="w-full p-2 rounded bg-surface-container" placeholder="Search history…" /><button aria-label="Close search" onClick={() => setOpen(false)}><X className="w-4 h-4" /></button></div>

      {busy ? <p className="p-3" role="status">Searching…</p> : error ? <p className="p-3" role="alert">{error}</p> : items.length === 0 ? <p className="p-3">No matching drafts.</p> : items.map(item => <button key={item.generation_id} onClick={() => { onOpenGeneration(item.generation_id); setOpen(false); }} className="block text-left w-full p-3 rounded hover:bg-surface-container"><span className="text-label-xs uppercase">{item.platform}</span><p className="font-semibold line-clamp-1">{item.topic}</p><p className="text-body-sm text-text-muted line-clamp-2">{item.preview}</p></button>)}

    </section>}

  </header>;

}
