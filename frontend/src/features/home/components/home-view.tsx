"use client";

import { useState, useEffect, useRef } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { listGenerations, type HistoryItem } from "@/lib/api/history";
import { DraftPreviewModal } from "@/features/history/components/draft-preview-modal";
import { stripMarkdown } from "@/lib/utils/markdown";

gsap.registerPlugin(useGSAP);
import {
  Plus,
  Edit3,
  FileText,
  RotateCcw,
  AudioLines,
  ArrowRight,
  Maximize2,
  History as HistoryIcon,
  Check,
  Lock,
} from "lucide-react";
import { toast } from "sonner";

interface HomeViewProps {
  username: string;
  onNewPost: () => void;
  onOpenHistory: (id: string, draftIndex?: number) => void;
  onGoHistory: () => void;
}

const INSPIRATION_PROMPTS = [
  "What did you ship this week?",
  "Which contrarian truth do you stand by?",
  "The hardest lesson from your Q1 roadmap?",
  "A client interaction that changed your framework?",
  "What obsolete belief did you discard today?",
];

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

function relativeTime(iso?: string | null): string {
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

export function HomeView({ username, onNewPost, onOpenHistory, onGoHistory }: HomeViewProps) {
  const [promptIdx, setPromptIdx] = useState(0);
  const [quickThought, setQuickThought] = useState("");
  const [recent, setRecent] = useState<HistoryItem[]>([]);
  const [loadingRecent, setLoadingRecent] = useState(true);

  // Enlarged draft modal state
  const [enlargedItem, setEnlargedItem] = useState<HistoryItem | null>(null);
  const [enlargedDraftIndex, setEnlargedDraftIndex] = useState<number>(1);

  // Cadence data (real, from history)
  const [allGenerations, setAllGenerations] = useState<HistoryItem[]>([]);
  const [loadingCadence, setLoadingCadence] = useState(true);

  const recentGridRef = useRef<HTMLDivElement>(null);
  const { contextSafe } = useGSAP({ scope: recentGridRef });

  const handleRecentCardMouseEnter = contextSafe((cardEl: HTMLElement) => {
    const isReduced = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const cards = cardEl.parentElement?.querySelectorAll<HTMLElement>(".recent-card");
    if (!cards) return;

    cards.forEach((c) => {
      if (c === cardEl) {
        gsap.to(c, {
          scale: isReduced ? 1 : 1.02,
          opacity: 1,
          duration: 0.22,
          ease: "power2.out",
          overwrite: "auto",
        });
      } else {
        gsap.to(c, {
          scale: isReduced ? 1 : 0.98,
          opacity: 0.6,
          duration: 0.22,
          ease: "power2.out",
          overwrite: "auto",
        });
      }
    });
  });

  const handleRecentGridMouseLeave = contextSafe((e: React.MouseEvent<HTMLDivElement>) => {
    const cards = e.currentTarget.querySelectorAll<HTMLElement>(".recent-card");
    if (!cards) return;

    gsap.to(cards, {
      scale: 1,
      opacity: 1,
      duration: 0.25,
      ease: "power2.out",
      overwrite: "auto",
    });
  });

  useGSAP(() => {
    if (loadingRecent || recent.length === 0) return;
    const isReduced = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (isReduced) return;

    gsap.from(".recent-card", {
      opacity: 0,
      y: 12,
      duration: 0.22,
      stagger: 0.05,
      ease: "power2.out",
      clearProps: "all",
    });
  }, { scope: recentGridRef, dependencies: [recent, loadingRecent] });

  useEffect(() => {
    let cancelled = false;
    listGenerations({ limit: 3 })
      .then((res) => {
        if (!cancelled) setRecent(res.items);
      })
      .catch((e) => toast.error(e.message || "Failed to load recent drafts"))
      .finally(() => {
        if (!cancelled) setLoadingRecent(false);
      });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    // Fetch a large enough window for the cadence chart. Backend limit is unbounded
    // for the authenticated user, so 200 covers most cases.
    listGenerations({ limit: 200 })
      .then((res) => {
        if (!cancelled) setAllGenerations(res.items);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoadingCadence(false);
      });
    return () => { cancelled = true; };
  }, []);

  // Build last-7-days buckets (Mon..Sun starting today-6)
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const days: { label: string; count: number; date: Date }[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    days.push({
      label: d.toLocaleDateString(undefined, { weekday: "short" }),
      count: 0,
      date: d,
    });
  }
  for (const gen of allGenerations) {
    if (!gen.created_at) continue;
    const d = new Date(gen.created_at);
    d.setHours(0, 0, 0, 0);
    const idx = days.findIndex((day) => day.date.getTime() === d.getTime());
    if (idx >= 0) days[idx].count += 1;
  }
  const maxCount = Math.max(1, ...days.map((d) => d.count));

  // Workspace Health: real counts
  const totalCount = allGenerations.length;
  const finalizedCount = allGenerations.filter((g) => g.status === "finalized").length;
  const inProgressCount = allGenerations.filter(
    (g) => g.status === "editing" || g.status === "needs_review"
  ).length;

  const handleSubmitThought = (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickThought.trim()) {
      toast.warning("Type a thought first");
      return;
    }
    // Hand the thought off to the new-generation view via parent.
    onNewPost();
    // Store in sessionStorage so New-Generation can read it on mount.
    sessionStorage.setItem("postcraft:pending_thought", quickThought.trim());
    toast.success("Loaded into the composer — paste where useful.");
  };

  return (
    <div className="flex flex-col w-full gap-space-2xl">
      {/* Top Section: Greeting + Inspiration prompt + new-post CTA */}
      <section className="flex flex-col md:flex-row md:items-end justify-between gap-space-lg relative">
        {/* Ambient orbs */}
        <div className="absolute -top-20 -left-20 w-64 h-64 bg-primary/10 rounded-full blur-3xl ambient-orb" />
        <div className="absolute -top-10 right-1/3 w-48 h-48 bg-secondary/10 rounded-full blur-3xl ambient-orb" style={{ animationDelay: "-7s" }} />

        <div className="flex flex-col gap-space-xs max-w-2xl relative z-10">
          <div className="flex items-center gap-space-xs flex-wrap">
            <span className="relative w-2 h-2 rounded-full bg-primary ring-pulse" />
            <span className="font-label-xs text-label-xs uppercase tracking-widest text-primary font-bold">
              STUDIO WORKSPACE
            </span>
            <span className="text-outline-variant text-label-xs">•</span>
            <span className="font-label-xs text-label-xs uppercase tracking-wider text-text-muted">
              SESSION ACTIVE
            </span>
          </div>
          <h1 className="font-serif text-display-hero text-text-display tracking-tight leading-none">
            {greeting()}, <span className="text-primary">{username}</span>
          </h1>
          <div className="flex items-center gap-space-sm pt-space-xs flex-wrap">
            <span className="font-body-md text-body-md text-text-muted">Inspiration prompt:</span>
            <div className="inline-flex items-center gap-space-xs px-space-sm py-space-2xs bg-surface-container rounded-full transition-all duration-300">
              <Plus className="w-3.5 h-3.5 text-primary" />
              <span
                key={promptIdx}
                className="font-title-sm text-body-sm text-text-display italic inline-block animate-crossfade"
              >
                {INSPIRATION_PROMPTS[promptIdx]}
              </span>
              <button
                onClick={() => setPromptIdx((i) => (i + 1) % INSPIRATION_PROMPTS.length)}
                className="w-5 h-5 flex items-center justify-center rounded-full hover:bg-surface-variant text-text-muted hover:text-primary transition-colors ml-space-2xs btn-press"
                title="Cycle suggestion"
                type="button"
              >
                <RotateCcw className="w-3 h-3" />
              </button>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-space-sm self-start md:self-end">
          <button
            onClick={onNewPost}
            className="flex items-center gap-space-xs py-space-sm px-space-lg bg-text-display dark:bg-primary text-surface-card dark:text-on-primary rounded-full font-label-md text-label-md tracking-wide shadow-lg hover:scale-[1.01] active:scale-[0.98] transition-all btn-press"
          >
            <Plus className="w-4 h-4" />
            <span>New post</span>
          </button>
        </div>
      </section>

      {/* Quick capture bar */}
      <section className="relative">
        <form
          onSubmit={handleSubmitThought}
          className="w-full bg-surface-card rounded-xl p-space-md shadow-card-light flex flex-col md:flex-row items-center gap-space-md"
        >
          <div className="flex items-center gap-space-sm text-primary flex-shrink-0">
            <div className="w-10 h-10 rounded-lg bg-surface-container flex items-center justify-center">
              <Edit3 className="w-5 h-5 text-primary" />
            </div>
          </div>
          <div className="flex-1 w-full min-w-0">
            <input
              value={quickThought}
              onChange={(e) => setQuickThought(e.target.value)}
              className="w-full bg-transparent font-body-lg text-body-lg text-text-display placeholder:text-text-muted focus:outline-none"
              placeholder="Capture an unvarnished observation, milestone, or contrarian angle..."
              type="text"
            />
          </div>
          <div className="flex items-center justify-between md:justify-end w-full md:w-auto gap-space-sm flex-shrink-0 pt-space-2xs md:pt-0">
            <div className="flex items-center gap-space-2xs px-space-sm py-space-2xs bg-surface-subtle rounded-full text-text-muted">
              <AudioLines className="w-3.5 h-3.5 text-secondary" />
              <span className="font-label-xs text-label-xs uppercase font-bold text-text-body">
                Voice: Direct
              </span>
            </div>
            <button
              type="submit"
              className="flex items-center gap-space-2xs px-space-md py-space-xs bg-primary text-on-primary rounded-full font-label-md text-label-md hover:bg-primary-container transition-colors shadow-sm btn-press"
            >
              <span>Synthesize</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </form>
      </section>

      {/* Recent drafts mosaic */}
      <section className="flex flex-col gap-space-md">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-space-sm">
            <h2 className="font-serif text-headline-md text-text-display">Recent drafts</h2>
            {recent.length > 0 && (
              <span className="px-space-xs py-space-2xs bg-surface-container text-primary font-label-xs text-label-xs rounded-full uppercase tracking-wider font-semibold">
                {recent.length} active
              </span>
            )}
          </div>
          <button
            onClick={onGoHistory}
            className="group flex items-center gap-space-2xs font-label-md text-label-md text-primary hover:text-primary-container transition-colors"
          >
            <span>View archive</span>
            <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
          </button>
        </div>

        {loadingRecent ? (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-space-lg">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-surface-card rounded-xl p-space-lg shadow-card-light h-[300px] animate-pulse" />
            ))}
          </div>
        ) : recent.length === 0 ? (
          <div className="bg-surface-card rounded-xl p-space-xl shadow-card-light flex flex-col items-center justify-center text-center gap-space-sm min-h-[300px]">
            <FileText className="w-10 h-10 text-text-muted" />
            <div>
              <p className="font-title-sm text-title-sm text-text-display font-semibold">
                No drafts yet
              </p>
              <p className="text-body-sm text-text-muted mt-1">
                Generate your first post and it will appear here.
              </p>
            </div>
            <button
              onClick={onNewPost}
              className="mt-space-xs flex items-center gap-space-xs py-space-xs px-space-lg bg-text-display dark:bg-primary text-surface-card dark:text-on-primary rounded-full font-label-md text-label-md"
            >
              <Plus className="w-4 h-4" />
              <span>New post</span>
            </button>
          </div>
        ) : (
          <div
            ref={recentGridRef}
            onMouseLeave={handleRecentGridMouseLeave}
            className="grid grid-cols-1 lg:grid-cols-3 gap-space-lg"
          >
            {recent.map((item) => (
              <button
                key={item.generation_id}
                onClick={() => {
                  setEnlargedItem(item);
                  setEnlargedDraftIndex(1);
                }}
                onMouseEnter={(e) => handleRecentCardMouseEnter(e.currentTarget)}
                onMouseMove={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  e.currentTarget.style.setProperty("--mouse-x", `${e.clientX - rect.left}px`);
                  e.currentTarget.style.setProperty("--mouse-y", `${e.clientY - rect.top}px`);
                }}
                className="history-card recent-card spotlight-card group relative bg-surface-card rounded-xl p-space-lg shadow-card-light transition-colors flex flex-col justify-between min-h-[300px] text-left cursor-pointer"
                title="Click to enlarge and read all drafts"
              >
                <div className="flex flex-col gap-space-sm relative z-10">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-space-2xs">
                      <span className="w-6 h-6 rounded-full bg-surface-container flex items-center justify-center">
                        <span className="font-title-sm text-body-sm font-bold text-primary leading-none">
                          {item.platform === "x" ? "𝕏" : "in"}
                        </span>
                      </span>
                      <span className="font-label-xs text-label-xs uppercase tracking-wider text-text-muted">
                        {item.platform === "x" ? "X / Twitter" : "LinkedIn"}
                      </span>
                    </div>
                    <span className="px-space-xs py-space-2xs bg-surface-subtle text-text-body rounded-full font-label-xs text-label-xs tracking-wider">
                      {item.status === "finalized" ? "Finalized" : item.status === "needs_review" ? "Needs review" : "Editing"}
                    </span>
                  </div>
                  <div className="flex flex-col gap-space-2xs pt-space-xs">
                    <h3 className="font-serif text-title-lg text-text-display line-clamp-2">
                      {item.topic}
                    </h3>
                    {item.preview && (
                      <p className="font-body-md text-body-md text-text-muted line-clamp-3">
                        {stripMarkdown(item.preview)}...
                      </p>
                    )}
                  </div>

                  {/* Multi-draft indicators */}
                  <div className="flex items-center gap-1.5 pt-space-xs flex-wrap">
                    {([1, 2, 3] as const).map((dIdx) => {
                      const hasDraft = Boolean(item[`draft_${dIdx}` as keyof HistoryItem]);
                      if (!hasDraft && dIdx > 1) return null;
                      const isPostFinalized = item.status === "finalized";
                      const isThisDraftFinalized = isPostFinalized && (item.active_draft_index || 1) === dIdx;
                      const isThisDraftLocked = isPostFinalized && !isThisDraftFinalized;

                      return (
                        <span
                          key={dIdx}
                          onClick={(e) => {
                            e.stopPropagation();
                            setEnlargedItem(item);
                            setEnlargedDraftIndex(dIdx);
                          }}
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md font-label-xs text-label-xs font-semibold transition-colors ${
                            isThisDraftFinalized
                              ? "bg-green-500/15 text-green-600 dark:text-green-400 border border-green-500/30 hover:bg-green-500/25"
                              : isThisDraftLocked
                              ? "bg-surface-container text-text-muted hover:bg-surface-subtle"
                              : "bg-surface-container hover:bg-primary/10 hover:text-primary text-text-muted"
                          }`}
                          title={
                            isThisDraftFinalized
                              ? `Draft ${dIdx} (Finalized)`
                              : isThisDraftLocked
                              ? `Draft ${dIdx} (Locked)`
                              : `View Draft ${dIdx}`
                          }
                        >
                          {isThisDraftFinalized ? (
                            <Check className="w-2.5 h-2.5" />
                          ) : isThisDraftLocked ? (
                            <Lock className="w-2.5 h-2.5 text-text-muted/60" />
                          ) : null}
                          <span>Draft {dIdx}</span>
                          {isThisDraftFinalized && (
                            <span className="text-[10px] uppercase font-bold tracking-wide opacity-90">
                              Finalized
                            </span>
                          )}
                          {isThisDraftLocked && (
                            <span className="text-[10px] uppercase font-medium tracking-wide opacity-75">
                              Locked
                            </span>
                          )}
                        </span>
                      );
                    })}
                  </div>
                </div>

                <div className="pt-space-md flex items-center justify-between mt-space-md relative z-10 border-t border-border-subtle/50">
                  <div className="flex items-center gap-space-xs">
                    <span className="font-label-xs text-label-xs text-text-muted">
                      Edited {relativeTime(item.created_at)}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="font-label-xs text-label-xs text-text-muted opacity-0 group-hover:opacity-100 transition-opacity">
                      Enlarge
                    </span>
                    <div className="w-8 h-8 rounded-full bg-surface-subtle group-hover:bg-primary/10 flex items-center justify-center shadow-sm history-arrow transition-colors">
                      <Maximize2 className="w-3.5 h-3.5 text-text-muted group-hover:text-primary transition-colors" />
                    </div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </section>

      {/* Bottom: Cadence + Workspace Health — REAL data, no fabricated charts */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-space-lg items-stretch">
        {/* Left: Cadence — last 7 days, real counts */}
        <div className="lg:col-span-8 bg-surface-card rounded-xl p-space-lg shadow-card-light flex flex-col justify-between gap-space-lg">
          <div className="flex items-center justify-between flex-wrap gap-space-sm">
            <div className="flex flex-col">
              <span className="font-label-xs text-label-xs uppercase tracking-wider text-text-muted font-semibold">
                Cadence
              </span>
              <h3 className="font-serif text-title-lg text-text-display">Last 7 days</h3>
            </div>
            <div className="flex items-center gap-space-md text-text-muted font-label-xs text-label-xs">
              <span>Generations per day</span>
            </div>
          </div>
          <div className="w-full pt-space-sm">
            {loadingCadence ? (
              <div className="h-36 flex items-end gap-space-xs">
                {[0, 1, 2, 3, 4, 5, 6].map((i) => (
                  <div key={i} className="flex-1 bg-surface-subtle rounded h-full animate-pulse" />
                ))}
              </div>
            ) : totalCount === 0 ? (
              <div className="h-36 flex items-center justify-center text-text-muted text-body-sm">
                No activity yet — your daily cadence will appear here.
              </div>
            ) : (
              <div className="w-full flex items-end gap-space-xs h-36">
                {days.map((d, i) => {
                  const heightPct = (d.count / maxCount) * 100;
                  return (
                    <div key={i} className="flex-1 flex flex-col items-center gap-space-xs">
                      <div className="w-full flex items-end h-32">
                        <div
                          className="w-full bg-primary rounded cadence-bar"
                          style={{
                            height: `${Math.max(4, heightPct)}%`,
                            animationDelay: `${i * 60}ms`,
                          }}
                          data-tooltip={`${d.count} generation${d.count === 1 ? "" : "s"} on ${d.label}`}
                        />
                      </div>
                      <span className="font-label-xs text-label-xs text-text-muted">{d.label}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
          <div className="flex items-center justify-between pt-space-xs text-text-muted font-body-sm text-body-sm">
            <span>
              {totalCount > 0
                ? `${totalCount} generation${totalCount === 1 ? "" : "s"} total`
                : "Generate your first post to start tracking cadence"}
            </span>
          </div>
        </div>

        {/* Right: Workspace Health — real counts */}
        <div className="lg:col-span-4 bg-surface-card rounded-xl p-space-lg shadow-card-light flex flex-col justify-between gap-space-lg">
          <div className="flex flex-col gap-space-xs">
            <span className="font-label-xs text-label-xs uppercase tracking-wider text-text-muted font-semibold">
              Workspace Health
            </span>
            <h3 className="font-serif text-title-lg text-text-display">Status</h3>
          </div>
          <div className="flex flex-col gap-space-md">
            <div className="flex items-center justify-between p-space-sm bg-surface-subtle rounded-lg">
              <div className="flex items-center gap-space-sm">
                <div className="w-8 h-8 rounded-lg bg-surface-container flex items-center justify-center text-primary">
                  <FileText className="w-4 h-4" />
                </div>
                <div className="flex flex-col">
                  <span className="font-title-sm text-body-sm font-semibold text-text-display">
                    {totalCount} posts created
                  </span>
                  <span className="font-label-xs text-label-xs text-text-muted">All time</span>
                </div>
              </div>
            </div>
            <div className="flex items-center justify-between p-space-sm bg-surface-subtle rounded-lg">
              <div className="flex items-center gap-space-sm">
                <div className="w-8 h-8 rounded-lg bg-secondary-fixed flex items-center justify-center text-secondary">
                  <Edit3 className="w-4 h-4" />
                </div>
                <div className="flex flex-col">
                  <span className="font-title-sm text-body-sm font-semibold text-text-display">
                    {inProgressCount} in progress
                  </span>
                  <span className="font-label-xs text-label-xs text-text-muted">Editing or in review</span>
                </div>
              </div>
            </div>
            <div className="flex items-center justify-between p-space-sm bg-surface-subtle rounded-lg">
              <div className="flex items-center gap-space-sm">
                <div className="w-8 h-8 rounded-lg bg-primary-fixed flex items-center justify-center text-primary">
                  <HistoryIcon className="w-4 h-4" />
                </div>
                <div className="flex flex-col">
                  <span className="font-title-sm text-body-sm font-semibold text-text-display">
                    {finalizedCount} finalized
                  </span>
                  <span className="font-label-xs text-label-xs text-text-muted">Saved preferences</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Enlarged Draft Modal */}
      <DraftPreviewModal
        isOpen={Boolean(enlargedItem)}
        onClose={() => setEnlargedItem(null)}
        item={enlargedItem}
        initialDraftIndex={enlargedDraftIndex}
        onOpenInEditor={(genId, dIdx) => onOpenHistory(genId, dIdx)}
      />
    </div>
  );
}
