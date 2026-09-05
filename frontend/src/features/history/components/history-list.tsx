"use client";

import { useState, useEffect } from "react";
import { listGenerations, type HistoryItem } from "@/lib/api/history";
import { ArrowLeft, Calendar, ChevronDown, FileText } from "lucide-react";

interface HistoryListProps {
  onBack: () => void;
  onOpen: (genId: string) => void;
}

const PAGE_SIZE = 20;

function relativeTime(iso: string | null): string {
  if (!iso) return "";
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "Just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d === 1) return "Yesterday";
  if (d < 7) return `${d}d ago`;
  return new Date(iso).toLocaleDateString();
}

function formatDate(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function platformLabel(platform: string): string {
  return platform === "x" ? "X / Twitter" : "LinkedIn";
}

function statusLabel(status: string): string {
  switch (status) {
    case "finalized":
      return "Finalized";
    case "needs_review":
      return "Needs review";
    case "editing":
      return "Editing";
    default:
      return status;
  }
}

function statusColor(status: string): string {
  switch (status) {
    case "finalized":
      return "bg-primary/10 text-primary";
    case "needs_review":
      return "bg-secondary-fixed/20 text-secondary";
    case "editing":
      return "bg-surface-subtle text-text-body";
    default:
      return "bg-surface-subtle text-text-muted";
  }
}

function SkeletonItem() {
  return (
    <div className="bg-surface-card rounded-xl p-space-lg shadow-card-light animate-pulse">
      <div className="flex items-start justify-between gap-space-md">
        <div className="flex flex-col gap-space-xs flex-1 min-w-0">
          <div className="flex items-center gap-space-sm">
            <div className="w-16 h-4 bg-surface-subtle rounded" />
            <div className="w-20 h-4 bg-surface-subtle rounded" />
          </div>
          <div className="w-3/4 h-5 bg-surface-subtle rounded mt-space-xs" />
          <div className="w-full h-3 bg-surface-subtle rounded mt-space-sm" />
          <div className="w-2/3 h-3 bg-surface-subtle rounded" />
        </div>
        <div className="w-20 h-3 bg-surface-subtle rounded flex-shrink-0" />
      </div>
    </div>
  );
}

export function HistoryList({ onBack, onOpen }: HistoryListProps) {
  const [items, setItems] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    listGenerations({ limit: PAGE_SIZE, offset: 0 })
      .then((res) => {
        if (!cancelled) {
          setItems(res.items);
          setTotal(res.total);
          setOffset(PAGE_SIZE);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  const handleLoadMore = async () => {
    setLoadingMore(true);
    try {
      const res = await listGenerations({ limit: PAGE_SIZE, offset });
      setItems((prev) => [...prev, ...res.items]);
      setOffset((prev) => prev + PAGE_SIZE);
    } catch (_e) {
      // silently ignore
    } finally {
      setLoadingMore(false);
    }
  };

  const hasMore = items.length < total;

  return (
    <div className="flex flex-col w-full gap-space-xl">
      {/* Page header */}
      <div className="flex items-center gap-space-md">
        <button
          onClick={onBack}
          className="w-10 h-10 rounded-xl bg-surface-card shadow-card-light hover:bg-surface-container flex items-center justify-center text-text-display hover:text-primary transition-all"
          aria-label="Go back"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div className="flex flex-col">
          <h1 className="font-serif text-headline-md text-text-display">Archive &amp; Logs</h1>
          {!loading && (
            <span className="font-label-xs text-label-xs text-text-muted">
              {total} generation{total === 1 ? "" : "s"} total
            </span>
          )}
        </div>
      </div>

      {/* List */}
      {loading ? (
        <div className="flex flex-col gap-space-md">
          {[1, 2, 3, 4, 5].map((i) => (
            <SkeletonItem key={i} />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="bg-surface-card rounded-xl p-space-xl shadow-card-light flex flex-col items-center justify-center text-center gap-space-sm min-h-[300px]">
          <FileText className="w-10 h-10 text-text-muted" />
          <div>
            <p className="font-title-sm text-title-sm text-text-display font-semibold">
              No history yet
            </p>
            <p className="text-body-sm text-text-muted mt-1">
              Generated posts will appear here once you create some.
            </p>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-space-md">
          {items.map((item) => (
            <button
              key={item.generation_id}
              onClick={() => onOpen(item.generation_id)}
              className="group w-full text-left bg-surface-card rounded-xl p-space-lg shadow-card-light hover:shadow-2xl transition-all duration-300 hover:bg-surface-container"
            >
              <div className="flex items-start justify-between gap-space-md">
                {/* Left: topic + preview */}
                <div className="flex flex-col gap-space-xs flex-1 min-w-0">
                  {/* Badges row */}
                  <div className="flex items-center gap-space-xs flex-wrap">
                    <span className="px-space-xs py-space-2xs bg-surface-subtle group-hover:bg-inverse-surface text-text-body group-hover:text-surface-bright rounded-full font-label-xs text-label-xs uppercase tracking-wider transition-colors">
                      {platformLabel(item.platform)}
                    </span>
                    <span
                      className={`px-space-xs py-space-2xs rounded-full font-label-xs text-label-xs uppercase tracking-wider transition-colors ${statusColor(
                        item.status
                      )}`}
                    >
                      {statusLabel(item.status)}
                    </span>
                  </div>

                  {/* Topic */}
                  <h2 className="font-serif text-title-md text-text-display group-hover:text-surface-bright transition-colors line-clamp-2 mt-space-2xs">
                    {item.topic}
                  </h2>

                  {/* Preview */}
                  {item.preview && (
                    <p className="font-body-sm text-body-sm text-text-muted group-hover:text-surface-variant transition-colors line-clamp-2">
                      {item.preview}
                    </p>
                  )}
                </div>

                {/* Right: date */}
                <div className="flex flex-col items-end gap-space-2xs flex-shrink-0">
                  <div className="flex items-center gap-space-2xs text-text-muted group-hover:text-surface-variant transition-colors">
                    <Calendar className="w-3.5 h-3.5" />
                    <span className="font-label-xs text-label-xs">
                      {formatDate(item.created_at)}
                    </span>
                  </div>
                  <span className="font-label-xs text-label-xs text-text-muted group-hover:text-surface-variant transition-colors">
                    {relativeTime(item.created_at)}
                  </span>
                </div>
              </div>
            </button>
          ))}

          {/* Load more */}
          {hasMore && (
            <div className="flex justify-center pt-space-sm">
              <button
                onClick={handleLoadMore}
                disabled={loadingMore}
                className="flex items-center gap-space-xs px-space-lg py-space-sm bg-surface-card hover:bg-surface-container text-text-display hover:text-primary rounded-full font-label-md text-label-md shadow-card-light hover:shadow-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loadingMore ? (
                  <>
                    <span>Loading...</span>
                  </>
                ) : (
                  <>
                    <span>Load more</span>
                    <ChevronDown className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
