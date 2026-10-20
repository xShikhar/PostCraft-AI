"use client";
import {
  ArrowUpRight,
  ArrowRight,
  Feather,
  Globe,
  Layers,
  ShieldCheck,
  Loader2,
  Check,
} from "lucide-react";
import { PageHeading } from "@/components/layout/page-heading";
import { GenerationIntermission } from "./generation-intermission";
interface GenerationFormProps {
  topic: string;
  setTopic: (v: string) => void;
  platform: string;
  setPlatform: (v: string) => void;
  rawThoughts: string;
  setRawThoughts: (v: string) => void;
  profileContext: string;
  setProfileContext: (v: string) => void;
  useContext: boolean;
  setUseContext: (v: boolean) => void;
  loading: boolean;
  elapsed: number;
  draftsReady: boolean;
  onViewDrafts: () => void;
  onSubmit: (e: React.FormEvent) => void;
  onGoProfile?: () => void;
}
export function GenerationForm({
  topic,
  setTopic,
  platform,
  setPlatform,
  rawThoughts,
  setRawThoughts,
  profileContext,
  setProfileContext,
  useContext,
  setUseContext,
  loading,
  elapsed,
  draftsReady,
  onViewDrafts,
  onSubmit,
  onGoProfile,
}: GenerationFormProps) {
  if (loading || draftsReady) return <GenerationIntermission elapsed={elapsed} ready={draftsReady} onViewDrafts={onViewDrafts} />;
  return (
    <div className="workspace-enter">
      <PageHeading
        eyebrow="From thought to first draft"
        title="Give your idea a voice."
        description="Bring the insight. We’ll help you find the words. Start with what you know, what you noticed, or what you can’t stop thinking about."
      />
      <div className="grid xl:grid-cols-[minmax(0,1fr)_280px] gap-6 items-start">
        <form data-motion="panel" onSubmit={onSubmit} className="paper overflow-hidden">
          <div className="p-6 sm:p-8 space-y-7">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span className="eyebrow">01 / The brief</span>
              <div
                className="flex bg-surface-subtle rounded-full p-1 border border-border-subtle"
                aria-label="Target platform"
              >
                {[
                  ["linkedin", "LinkedIn"],
                  ["x", "X / Twitter"],
                ].map(([value, label]) => (
                  <button
                    disabled={loading}
                    key={value}
                    type="button"
                    aria-pressed={platform === value}
                    onClick={() => setPlatform(value)}
                    className={`px-4 py-2 rounded-full text-xs font-bold transition-colors ${platform === value ? "bg-text-display text-surface-card" : "text-text-muted"}`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label
                htmlFor="topic"
                className="text-sm font-bold text-text-display"
              >
                What’s the central idea?
              </label>
              <p className="text-xs text-text-muted mt-1 mb-3">
                One specific topic. One clear point of view.
              </p>
              <input
                id="topic"
                className="field !bg-transparent !text-base"
                placeholder="e.g. The hidden cost of a decision without an owner"
                required
                maxLength={255}
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                disabled={loading}
              />
            </div>
            <div>
              <div className="flex justify-between gap-3 items-center mb-3">
                <label
                  htmlFor="rawThoughts"
                  className="text-sm font-bold text-text-display"
                >
                  Your raw thoughts
                </label>
                <span className="text-[10px] text-text-muted">
                  {rawThoughts.length.toLocaleString()} / 5,000
                </span>
              </div>
              <textarea
                id="rawThoughts"
                className="field !bg-transparent !leading-[1.9] !min-h-[250px]"
                placeholder="The story behind the idea. A surprising lesson. The detail only you would know.

Bullet points, messy notes, and unfinished thoughts are welcome."
                required
                maxLength={5000}
                value={rawThoughts}
                onChange={(e) => setRawThoughts(e.target.value)}
                disabled={loading}
              />
              <p className="text-[11px] text-text-muted mt-2">
                Specific details make stronger writing. We won’t invent your
                experience.
              </p>
            </div>
            <details className="border-t border-border-subtle pt-5">
              <summary className="text-xs font-bold cursor-pointer text-text-muted">
                Additional background{" "}
                <span className="font-normal">(optional)</span>
              </summary>
              <label
                htmlFor="profileContext"
                className="text-xs block text-text-muted mt-4 mb-2"
              >
                Context for this generation — overrides your saved profile
                background
              </label>
              <textarea
                id="profileContext"
                className="field"
                rows={3}
                maxLength={3000}
                value={profileContext}
                onChange={(e) => setProfileContext(e.target.value)}
                disabled={loading}
                placeholder="A particular audience, role, or perspective for this post…"
              />
            </details>
            <label className="flex items-center gap-4 rounded-xl bg-surface-subtle p-4 cursor-pointer">
              <span className="w-9 h-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                <Feather size={17} />
              </span>
              <span className="flex-1">
                <span className="block text-xs font-bold text-text-display">
                  Write with my background
                </span>
                <span className="block text-[11px] text-text-muted mt-1">
                  Include your saved profile, resume and writing style.
                </span>
              </span>
              <input
                aria-label="Include saved profile"
                type="checkbox"
                checked={useContext}
                onChange={(e) => setUseContext(e.target.checked)}
                disabled={loading}
                className="h-5 w-5 accent-primary shrink-0"
              />
            </label>
          </div>
          <div className="border-t border-border-subtle px-6 py-5 sm:px-8 flex flex-col sm:flex-row justify-between gap-4 items-start sm:items-center">
            <span className="text-[11px] text-text-muted flex items-center gap-2">
              <Layers size={13} />
              Three variations. Your final say.
            </span>
            <button
              type="submit"
              disabled={loading || !topic.trim() || !rawThoughts.trim()}
              className="btn-primary w-full sm:w-auto"
            >
              {loading ? (
                <>
                  <Loader2 size={15} className="animate-spin" />
                  Writing your drafts…
                </>
              ) : (
                <>
                  Generate Drafts
                  <ArrowRight size={15} />
                </>
              )}
            </button>
          </div>
        </form>
        <aside className="space-y-5">
          <section data-motion="panel" className="paper p-6">
            <p className="eyebrow mb-5">A little craft. A lot of you.</p>
            <div className="space-y-6">
              {[
                {
                  icon: Globe,
                  title: "Grounded in context",
                  body: "Research helps inform the writing. Retrieved sources are shown with your drafts.",
                },
                {
                  icon: Feather,
                  title: "Shaped by your voice",
                  body: "Your saved background and learned style guide the way your ideas are expressed.",
                },
                {
                  icon: Layers,
                  title: "Three ways to tell it",
                  body: "Compare the actual drafts. Choose a direction and make it your own.",
                },
                {
                  icon: ShieldCheck,
                  title: "A thoughtful review",
                  body: "Quality checks flag weak claims and generic writing. Your judgment comes first.",
                },
              ].map(({ icon: Icon, title, body }, i) => (
                <div key={title} className="flex items-start gap-3">
                  <span className="w-7 h-7 rounded-full border border-border-subtle text-primary flex items-center justify-center shrink-0">
                    <Icon size={13} />
                  </span>
                  <div>
                    <p className="text-xs font-bold text-text-display">
                      {title}
                    </p>
                    <p className="mt-1.5 text-[11px] leading-relaxed text-text-muted">
                      {body}
                    </p>
                    {i === 0 && (
                      <span className="sr-only">
                        These describe the workflow, not live stage updates.
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>
          <section className="p-5">
            <span className="text-primary">
              <Check size={17} />
            </span>
            <p className="font-serif text-lg text-text-display mt-3">
              The best input is honest.
            </p>
            <p className="text-xs text-text-muted mt-2 leading-relaxed">
              A small, true observation is more useful than a perfect-sounding
              premise.
            </p>
            {onGoProfile && (
              <button
                type="button"
                onClick={onGoProfile}
                className="text-xs text-primary font-bold mt-5 flex items-center gap-2"
              >
                Edit your voice profile
                <ArrowUpRight size={13} />
              </button>
            )}
          </section>
        </aside>
      </div>
    </div>
  );
}
