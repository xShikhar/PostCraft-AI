"use client";
import { useEffect, useState } from "react";
import {
  ArrowUpRight,
  ArrowRight,
  Plus,
  Feather,
  Check,
  RefreshCw,
} from "lucide-react";
import {
  listGenerations,
  getGenerationMetrics,
  type HistoryItem,
  type GenerationMetrics,
} from "@/lib/api/history";
import { getCurrentUser, type UserResponse } from "@/lib/api/user";
import { getResume } from "@/lib/api/resume";
import { stripMarkdown } from "@/lib/utils/markdown";
import { CraftStory } from "@/components/motion/craft-story";
import { WritingPrompts } from "@/components/motion/writing-prompts";
import { prepareDraftTransition } from "@/components/motion/draft-transition";
import { KineticText } from "@/components/motion/kinetic-text";

export function HomeView({
  username,
  onNewPost,
  onOpenHistory,
  onGoHistory,
  onGoProfile,
}: {
  username: string;
  onNewPost: (thought?: string) => void;
  onOpenHistory: (id: string, index?: number) => void;
  onGoHistory: () => void;
  onGoProfile?: () => void;
}) {
  const [focused, setFocused] = useState(false);
  const [thought, setThought] = useState(""),
    [recent, setRecent] = useState<HistoryItem[]>([]),
    [metrics, setMetrics] = useState<GenerationMetrics | null>(null),
    [profile, setProfile] = useState<UserResponse | null>(null),
    [resume, setResume] = useState<boolean | null>(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [refresh, setRefresh] = useState(0),
    [metricsError, setMetricsError] = useState(false);
  useEffect(() => {
    let active = true;
    listGenerations({ limit: 3 })
      .then((data) => {
        if (active) setRecent(data.items);
      })
      .catch(() => {
        if (active) setError("Your recent work could not be loaded.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    getGenerationMetrics()
      .then((data) => {
        if (active) {
          setMetrics(data);
          setMetricsError(false);
        }
      })
      .catch(() => {
        if (active) setMetricsError(true);
      });
    getCurrentUser()
      .then((data) => {
        if (active) setProfile(data);
      })
      .catch(() => {});
    getResume()
      .then((data) => {
        if (active) setResume(!!data);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [refresh]);
  const hour = new Date().getHours();
  const greet =
    hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  const days = Array.from({ length: 7 }, (_, i) => {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() - 6 + i);
    return {
      date,
      label: date.toLocaleDateString(undefined, { weekday: "short" }),
      count: 0,
    };
  });
  for (const iso of metrics?.recent_dates || []) {
    const date = new Date(iso);
    date.setHours(0, 0, 0, 0);
    const day = days.find((d) => d.date.getTime() === date.getTime());
    if (day) day.count++;
  }
  const max = Math.max(1, ...days.map((d) => d.count));
  const steps = [
    { label: "Introduce yourself", done: !!profile?.about_me },
    { label: "Set your writing voice", done: !!profile?.writing_style },
    {
      label: "Add your background",
      done: !!profile?.profile_context || resume === true,
    },
  ];
  const complete = steps.filter((s) => s.done).length;
  return (
    <div className="space-y-10 workspace-enter">
      <section data-motion="heading" className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <p className="eyebrow mb-4 flex items-center gap-2">
            <span className="w-1.5 h-1.5 bg-primary rounded-full" />
            Your writing studio
          </p>
          <h1 className="page-title !text-[clamp(32px,4vw,52px)]">
            <KineticText text={`${greet},`} /><br />
            <span className="italic text-primary">{username || "writer"}.</span>
          </h1>
          <p className="text-text-muted mt-4 text-sm">
            Good writing starts with a thought worth sharing.
          </p>
        </div>
        <button
          onClick={() => onNewPost()}
          className="btn-primary self-start md:self-auto"
        >
          <Plus size={15} />
          New post
        </button>
      </section>
      <section data-motion="panel" className="paper !border-primary/15 relative overflow-hidden p-5 sm:p-7">
        <div className="flex justify-between items-center mb-4">
          <span className="eyebrow !text-primary">The scratchpad</span>
          <Feather size={17} className="text-primary/50" />
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (thought.trim()) onNewPost(thought.trim());
          }}
        >
          <label
            htmlFor="quick-thought"
            className="font-serif text-xl sm:text-2xl text-text-display"
          >
            What’s on your mind?
          </label>
          <WritingPrompts active={!focused && !thought} />
          <textarea
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            id="quick-thought"
            value={thought}
            onChange={(e) => setThought(e.target.value)}
            maxLength={5000}
            rows={2}
            className="w-full mt-4 text-sm bg-transparent resize-none outline-none placeholder:text-text-muted/70 min-h-20"
            placeholder="Capture an unvarnished observation, milestone, or contrarian angle..."
          />
          <div className="flex justify-between gap-3 items-center pt-4 border-t border-border-subtle">
            <span className="text-[11px] text-text-muted">
              An imperfect idea is a perfect start.
            </span>
            <button
              type="submit"
              disabled={!thought.trim()}
              className="btn-primary !min-h-10 !py-2.5 !px-4"
            >
              Synthesize
              <ArrowRight size={14} />
            </button>
          </div>
        </form>
      </section>
      <section>
        <div className="flex justify-between items-end mb-5 gap-3">
          <div>
            <p className="eyebrow mb-2">Pick up the thread</p>
            <h2 className="font-serif text-2xl tracking-tight text-text-display">
              Recent drafts
            </h2>
          </div>
          <button
            onClick={onGoHistory}
            className="flex items-center gap-2 text-xs text-text-muted hover:text-primary"
          >
            View archive
            <ArrowUpRight size={14} />
          </button>
        </div>
        {loading ? (
          <div
            className="grid sm:grid-cols-3 gap-4"
            aria-label="Loading recent drafts"
          >
            {[1, 2, 3].map((n) => (
              <div key={n} className="paper h-56 p-6">
                <div className="shimmer h-3 w-16 rounded" />
                <div className="shimmer h-6 w-3/4 rounded mt-7" />
                <div className="shimmer h-16 rounded mt-3" />
              </div>
            ))}
          </div>
        ) : error ? (
          <div
            role="alert"
            className="paper p-8 text-sm text-text-muted flex justify-between gap-4"
          >
            {error}
            <button
              className="text-primary flex items-center gap-2"
              onClick={() => {
                setLoading(true);
                setError("");
                setRefresh((v) => v + 1);
              }}
            >
              <RefreshCw size={14} />
              Retry
            </button>
          </div>
        ) : !recent.length ? (
          <div className="paper empty-state">
            <Feather size={25} className="mx-auto mb-4 text-primary" />
            <h3 className="font-serif text-xl text-text-display">
              Your first page is waiting.
            </h3>
            <p className="mt-2 text-sm mb-5">
              Turn one real observation into three ways to tell it.
            </p>
            <button onClick={() => onNewPost()} className="btn-secondary">
              Write your first post
              <ArrowRight size={14} />
            </button>
          </div>
        ) : (
          <div className="grid md:grid-cols-3 gap-4">
            {recent.map((item, i) => (
              <button
                key={item.generation_id}
                onClick={(event) => {
                  prepareDraftTransition(item.generation_id, event.currentTarget);
                  onOpenHistory(
                    item.generation_id,
                    item.active_draft_index || 1,
                  );
                }}
                data-motion="card" className="paper group text-left p-6 min-h-60 flex flex-col hover:border-border-hover hover:-translate-y-1 transition-[transform,border-color] duration-200"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="eyebrow !text-[9px] !tracking-[.08em]">
                    {item.platform === "x" ? "X / Twitter" : "LinkedIn"}
                  </span>
                  <span className="text-[10px] text-text-muted">0{i + 1}</span>
                </div>
                <h3 className="font-serif text-lg leading-relaxed tracking-tight mt-5 mb-3 text-text-display line-clamp-2">
                  {item.topic}
                </h3>
                <p className="text-xs leading-relaxed text-text-muted line-clamp-3 flex-1">
                  {stripMarkdown(
                    item.preview || "No draft text available yet.",
                  )}
                </p>
                <div className="mt-6 pt-4 border-t border-border-subtle flex justify-between items-center">
                  <span className="status-pill !text-[9px]">
                    {item.status === "finalized"
                      ? "Finalized"
                      : item.status === "needs_review"
                        ? "Needs review"
                        : item.status === "failed"
                          ? "Failed"
                          : item.status === "generating"
                            ? "Generating"
                            : "In progress"}
                  </span>
                  <ArrowUpRight
                    size={17}
                    className="text-text-muted group-hover:text-primary"
                  />
                </div>
              </button>
            ))}
          </div>
        )}
      </section>
      <div className="grid xl:grid-cols-5 gap-5">
        <section data-motion="panel" className="paper p-6 sm:p-7 xl:col-span-3">
          <div className="flex justify-between items-start gap-4">
            <div>
              <p className="eyebrow mb-2">Make room for the practice</p>
              <h2 className="font-serif text-xl text-text-display">
                Your writing rhythm
              </h2>
            </div>
            <span className="text-[10px] text-text-muted">Last 7 days</span>
          </div>
          {metricsError ? (
            <p role="alert" className="text-sm text-text-muted mt-8">
              Activity is unavailable.{" "}
              <button
                onClick={() => {
                  setLoading(true);
                  setError("");
                  setRefresh((v) => v + 1);
                }}
                className="underline"
              >
                Retry
              </button>
            </p>
          ) : !metrics ? (
            <div className="shimmer h-32 mt-6 rounded" />
          ) : (
            <>
              <div
                className="flex items-end justify-between gap-3 h-32 mt-7"
                role="img"
                aria-label={days
                  .map((d) => `${d.label}: ${d.count} generations`)
                  .join(", ")}
              >
                {days.map((d) => (
                  <div
                    key={d.label}
                    className="flex-1 flex flex-col items-center gap-3 h-full justify-end"
                  >
                    <span className="text-[10px] text-text-muted">
                      {d.count}
                    </span>
                    <div
                      data-motion="bar"
                      className={`w-full max-w-8 rounded-t-md ${d.count ? "bg-primary/75" : "bg-surface-container"}`}
                      style={{
                        height: d.count
                          ? `${Math.max(8, (d.count / max) * 65)}px`
                          : "4px",
                      }}
                    />
                    <span className="text-[10px] text-text-muted">
                      {d.label}
                    </span>
                  </div>
                ))}
              </div>
              <div className="border-t border-border-subtle mt-5 pt-4 flex gap-7 text-xs">
                <p>
                  <strong className="text-text-display text-base mr-1.5">
                    {metrics.total}
                  </strong>
                  generations
                </p>
                <p>
                  <strong className="text-text-display text-base mr-1.5">
                    {metrics.finalized}
                  </strong>
                  finalized
                </p>
                <p>
                  <strong className="text-text-display text-base mr-1.5">
                    {metrics.in_progress}
                  </strong>
                  in progress
                </p>
              </div>
            </>
          )}
        </section>
        <section data-motion="panel" className="paper p-6 sm:p-7 xl:col-span-2">
          <p className="eyebrow mb-2">Make it sound like you</p>
          <h2 className="font-serif text-xl text-text-display">
            Your voice, in focus.
          </h2>
          <p className="text-xs text-text-muted mt-3 leading-relaxed">
            A little context helps your writing feel more personal. Set up once,
            refine whenever you like.
          </p>
          <div className="space-y-3 mt-6">
            {steps.map((step) => (
              <div key={step.label} className="flex gap-3 items-center text-xs">
                <span
                  className={`w-5 h-5 rounded-full flex items-center justify-center border ${step.done ? "bg-primary/10 border-primary/20 text-primary" : "border-border-hover text-text-muted"}`}
                >
                  {step.done ? (
                    <Check size={11} />
                  ) : (
                    <span className="w-1 h-1 rounded-full bg-current" />
                  )}
                </span>
                <span
                  className={step.done ? "text-text-body" : "text-text-muted"}
                >
                  {step.label}
                </span>
              </div>
            ))}
          </div>
          {onGoProfile && (
            <button
              onClick={onGoProfile}
              className="mt-6 flex items-center gap-2 text-xs font-bold text-primary"
            >
              {profile
                ? complete === 3
                  ? "Refine your profile"
                  : "Set up your voice"
                : "Open profile"}
              <ArrowUpRight size={14} />
            </button>
          )}
        </section>
      </div>
      <CraftStory onNewPost={onNewPost} />
      <footer className="flex justify-between gap-4 border-t border-border-subtle pt-5 text-[10px] text-text-muted">
        <span>Thoughtfully written. Unmistakably yours.</span>
        <span>PostCraft AI</span>
      </footer>
    </div>
  );
}
