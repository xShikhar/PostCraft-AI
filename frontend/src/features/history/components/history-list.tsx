"use client";

import { useState, useEffect, useRef, Fragment } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { listGenerations, type HistoryItem } from "@/lib/api/history";
import { DraftPreviewModal } from "@/features/history/components/draft-preview-modal";
import { stripMarkdown } from "@/lib/utils/markdown";

gsap.registerPlugin(useGSAP);
import { ArrowLeft, Calendar, ChevronDown, FileText, ArrowRight, Maximize2, Sparkles, Check, Lock } from "lucide-react";

interface HistoryListProps {
  onBack: () => void;
  onOpen: (genId: string, draftIndex?: number) => void;
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
  const [query, setQuery] = useState("");
  const [platform, setPlatform] = useState("");
  const [error, setError] = useState("");
  const requestVersion = useRef(0);

  // Enlarged preview modal state
  const [enlargedItem, setEnlargedItem] = useState<HistoryItem | null>(null);
  const [enlargedDraftIndex, setEnlargedDraftIndex] = useState<number>(1);
  const [cardActiveDraft, setCardActiveDraft] = useState<Record<string, 1 | 2 | 3>>({});

  useEffect(() => {
    let cancelled = false;
    ++requestVersion.current;
    const timer = setTimeout(() => {
    setLoading(true); setError("");
    listGenerations({ limit: PAGE_SIZE, offset: 0, q: query, platform })
      .then((res) => {
        if (!cancelled) {
          setItems(res.items);
          setTotal(res.total);
          setOffset(PAGE_SIZE);
        }
      })
      .catch(() => { if (!cancelled) setError("History unavailable. Please try again."); })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    }, 250);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [query, platform]);

  const listRef = useRef<HTMLDivElement>(null);

  useGSAP(() => {
    if (loading || items.length === 0) return;
    const isReduced = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (isReduced) return;

    gsap.from(".history-list-item", {
      opacity: 0,
      y: 12,
      duration: 0.22,
      stagger: 0.04,
      ease: "power2.out",
      clearProps: "all",
    });
  }, { scope: listRef, dependencies: [items, loading] });

  const handleLoadMore = async () => {
    setLoadingMore(true);
    try {
      const version = requestVersion.current;
      const res = await listGenerations({ limit: PAGE_SIZE, offset, q: query, platform });
      if (version !== requestVersion.current) return;
      setItems((prev) => [...prev, ...res.items]);
      setOffset((prev) => prev + PAGE_SIZE);
    } catch {
      setError("Could not load more history. Please retry.");
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
          className="w-10 h-10 rounded-xl bg-surface-card shadow-card-light hover:bg-surface-container flex items-center justify-center text-text-display hover:text-primary transition-all btn-press"
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

      <div className="flex flex-wrap gap-3">
        <input aria-label="Search history" placeholder="Search topics and notes" value={query} onChange={e => setQuery(e.target.value)} className="flex-1 min-w-40 p-3 rounded-xl bg-surface-card border border-border-subtle" />
        <select aria-label="Filter platform" value={platform} onChange={e => setPlatform(e.target.value)} className="p-3 rounded-xl bg-surface-card border border-border-subtle"><option value="">All platforms</option><option value="linkedin">LinkedIn</option><option value="x">X</option></select>
      </div>
      {error && <p role="alert" className="text-secondary">{error}</p>}
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
        <div ref={listRef} className="flex flex-col gap-space-md">
          {items.map((item, index) => {
            const activeDraftIdx = cardActiveDraft[item.generation_id] || 1;
            const activeDraftContent =
              (activeDraftIdx === 1
                ? item.draft_1
                : activeDraftIdx === 2
                ? item.draft_2
                : item.draft_3) || item.preview || "";

            const day = item.created_at ? new Date(item.created_at).toLocaleDateString(undefined, { dateStyle: "full" }) : "Undated";
            const previousDay = index > 0 && items[index-1].created_at ? new Date(items[index-1].created_at!).toLocaleDateString(undefined, { dateStyle: "full" }) : "";
            return (
              <Fragment key={item.generation_id}>
              {day !== previousDay && <h2 className="font-serif text-title-lg mt-4">{day}</h2>}
              <div
                onClick={() => {
                  setEnlargedItem(item);
                  setEnlargedDraftIndex(activeDraftIdx);
                }}
                className="history-card history-list-item group w-full text-left bg-surface-card rounded-xl p-space-lg shadow-card-light transition-all cursor-pointer hover:border-primary/30"
              >
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-space-md">
                  {/* Left: badges + topic + draft tabs + preview */}
                  <div className="flex flex-col gap-space-xs flex-1 min-w-0">
                    {/* Badges row */}
                    <div className="flex items-center gap-space-xs flex-wrap">
                      <span className="px-space-xs py-space-2xs bg-surface-subtle text-text-body rounded-full font-label-xs text-label-xs uppercase tracking-wider">
                        {platformLabel(item.platform)}
                      </span>
                      {item.status === "finalized" ? (
                        activeDraftIdx === (item.active_draft_index || 1) ? (
                          <span className="inline-flex items-center gap-1 px-space-xs py-space-2xs rounded-full font-label-xs text-label-xs uppercase tracking-wider bg-green-500/10 text-green-600 dark:text-green-400 font-semibold">
                            <Check className="w-3 h-3" />
                            Finalized
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-space-xs py-space-2xs rounded-full font-label-xs text-label-xs uppercase tracking-wider bg-surface-subtle text-text-muted font-medium">
                            <Lock className="w-3 h-3" />
                            Locked
                          </span>
                        )
                      ) : (
                        <span
                          className={`px-space-xs py-space-2xs rounded-full font-label-xs text-label-xs uppercase tracking-wider ${statusColor(
                            item.status
                          )}`}
                        >
                          {statusLabel(item.status)}
                        </span>
                      )}
                    </div>

                    {/* Topic */}
                    <h2 className="font-serif text-title-md text-text-display line-clamp-2 mt-space-2xs">
                      {item.topic}
                    </h2>

                    {/* Multi-draft switcher buttons */}
                    <div className="flex items-center gap-1.5 pt-space-2xs flex-wrap">
                      {([1, 2, 3] as const).map((dIdx) => {
                        const hasDraft = Boolean(item[`draft_${dIdx}` as keyof HistoryItem]);
                        if (!hasDraft && dIdx > 1) return null;
                        const isSelected = activeDraftIdx === dIdx;
                        const isPostFinalized = item.status === "finalized";
                        const isThisDraftFinalized = isPostFinalized && (item.active_draft_index || 1) === dIdx;
                        const isThisDraftLocked = isPostFinalized && !isThisDraftFinalized;

                        return (
                          <button
                            key={dIdx}
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setCardActiveDraft((prev) => ({
                                ...prev,
                                [item.generation_id]: dIdx,
                              }));
                            }}
                            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md font-label-xs text-label-xs font-semibold transition-all ${
                              isSelected
                                ? isThisDraftFinalized
                                  ? "bg-green-600 text-white shadow-xs font-bold"
                                  : "bg-primary text-on-primary shadow-xs font-bold"
                                : isThisDraftFinalized
                                ? "bg-green-500/15 text-green-600 dark:text-green-400 border border-green-500/30 hover:bg-green-500/25"
                                : "bg-surface-subtle text-text-muted hover:text-text-display hover:bg-surface-container"
                            }`}
                            title={
                              isThisDraftFinalized
                                ? `Draft ${dIdx} (Finalized)`
                                : isThisDraftLocked
                                ? `Draft ${dIdx} (Locked)`
                                : `Inspect Draft ${dIdx}`
                            }
                          >
                            {isThisDraftFinalized ? (
                              <Check className="w-2.5 h-2.5" />
                            ) : isThisDraftLocked ? (
                              <Lock className="w-2.5 h-2.5 text-text-muted/70" />
                            ) : null}
                            <span>Draft {dIdx}</span>
                            {isThisDraftFinalized && (
                              <span className="text-[10px] uppercase tracking-wide opacity-90">
                                Finalized
                              </span>
                            )}
                            {isThisDraftLocked && (
                              <span className="text-[10px] uppercase tracking-wide opacity-75">
                                Locked
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>

                    {/* Preview snippet */}
                    {activeDraftContent && (
                      <p className="font-body-sm text-body-sm text-text-muted line-clamp-2 mt-1">
                        {stripMarkdown(activeDraftContent)}
                      </p>
                    )}
                  </div>

                  {/* Right: date & action buttons */}
                  <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-start gap-space-sm flex-shrink-0 pt-space-xs sm:pt-0">
                    <div className="flex flex-col items-start sm:items-end gap-0.5">
                      <div className="flex items-center gap-space-2xs text-text-muted">
                        <Calendar className="w-3.5 h-3.5" />
                        <span className="font-label-xs text-label-xs">
                          {formatDate(item.created_at)}
                        </span>
                      </div>
                      <span className="font-label-xs text-label-xs text-text-muted">
                        {relativeTime(item.created_at)}
                      </span>
                    </div>

                    {/* Action buttons */}
                    <div className="flex items-center gap-2 mt-sm:space-xs">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setEnlargedItem(item);
                          setEnlargedDraftIndex(activeDraftIdx);
                        }}
                        className="w-8 h-8 rounded-full bg-surface-subtle hover:bg-surface-container flex items-center justify-center text-text-muted hover:text-text-display transition-colors"
                        title="Enlarge and read draft in full"
                      >
                        <Maximize2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onOpen(item.generation_id, activeDraftIdx);
                        }}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary hover:bg-primary-container text-on-primary font-label-xs text-label-xs font-semibold shadow-xs transition-all btn-press"
                        title={`Edit Draft ${activeDraftIdx} in Studio`}
                      >
                        <Sparkles className="w-3 h-3" />
                        <span>Edit</span>
                        <ArrowRight className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
              </Fragment>
            );
          })}

          {/* Load more */}
          {hasMore && (
            <div className="flex justify-center pt-space-sm">
              <button
                onClick={handleLoadMore}
                disabled={loadingMore}
                className="flex items-center gap-space-xs px-space-lg py-space-sm bg-surface-card hover:bg-surface-container text-text-display hover:text-primary rounded-full font-label-md text-label-md shadow-card-light hover:shadow-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed btn-press"
              >
                {loadingMore ? (
                  <span>Loading...</span>
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

      {/* Enlarged Draft Modal */}
      <DraftPreviewModal
        isOpen={Boolean(enlargedItem)}
        onClose={() => setEnlargedItem(null)}
        item={enlargedItem}
        initialDraftIndex={enlargedDraftIndex}
        onOpenInEditor={(genId, dIdx) => onOpen(genId, dIdx)}
      />
    </div>
  );
}
