"use client";
import { ArrowUpRight, Copy, ArrowLeft, RefreshCw } from "lucide-react";
import type { Drafts } from "@/lib/api/generation";
import { PageHeading } from "@/components/layout/page-heading";
import {
  ResearchPanel,
  type ResearchEvidence,
} from "@/features/research/components/research-panel";
interface DraftSelectionGridProps extends Partial<ResearchEvidence> {
  drafts: Drafts;
  platform: string;
  onSelect: (n: number) => void;
  onCopy: (text: string) => void;
  renderMarkdown: (text: string) => string;
  onRefine?: () => void;
  onRegenerate?: () => void;
  quality?: {
    result?: string;
    substance_score?: number | null;
    scope?: string;
    draft_index?: number;
  } | null;
}
export function DraftSelectionGrid({
  drafts,
  platform,
  onSelect,
  onCopy,
  renderMarkdown,
  sources = [],
  onRefine,
  onRegenerate,
  quality,
  ...research
}: DraftSelectionGridProps) {
  return (
    <div className="workspace-enter">
      <PageHeading
        eyebrow="One idea. Three possibilities."
        title="Find your starting point."
        description="Read them slowly. Pick the version that feels closest to what you meant — then make it unmistakably yours."
        action={
          <div className="flex gap-2">
            {onRefine && (
              <button className="btn-secondary" onClick={onRefine}>
                <ArrowLeft size={13} />
                Refine inputs
              </button>
            )}
            {onRegenerate && (
              <button
                className="btn-secondary !px-3"
                onClick={onRegenerate}
                aria-label="Regenerate drafts"
              >
                <RefreshCw size={14} />
              </button>
            )}
          </div>
        }
      />
      <div className="grid xl:grid-cols-3 gap-5">
        {([1, 2, 3] as const).map((n) => {
          const text = drafts[`draft_${n}`];
          return (
            <article data-motion="card" key={n} className="paper overflow-hidden flex flex-col">
              <div className="p-6 border-b border-border-subtle flex justify-between items-center">
                <span className="eyebrow !text-primary">Variation 0{n}</span>
                <span className="text-[10px] text-text-muted">
                  {platform === "x" ? "X / Twitter" : "LinkedIn"}
                </span>
              </div>
              <div className="p-6 sm:p-7 flex-1">
                <h2 className="font-serif text-2xl tracking-tight text-text-display mb-5">
                  Draft {n}
                </h2>
                <div
                  className="prose-draft !text-sm max-h-[460px] overflow-auto custom-scrollbar pr-2"
                  dangerouslySetInnerHTML={{ __html: renderMarkdown(text) }}
                />
              </div>
              <div className="px-6 pb-6">
                <div className="flex justify-between text-[10px] text-text-muted border-t border-border-subtle pt-4 mb-5">
                  <span>{text.length.toLocaleString()} characters</span>
                  <span>
                    {text.trim() ? text.trim().split(/\s+/).length : 0} words
                  </span>
                </div>
                <div className="flex gap-2">
                  <button
                    className="icon-button border border-border-subtle"
                    aria-label={`Copy draft ${n}`}
                    onClick={() => onCopy(text)}
                  >
                    <Copy size={15} />
                  </button>
                  <button
                    className="btn-primary flex-1"
                    onClick={() => onSelect(n)}
                  >
                    Edit
                    <ArrowUpRight size={14} />
                  </button>
                </div>
              </div>
            </article>
          );
        })}
      </div>
      <div className="grid lg:grid-cols-[minmax(0,1fr)_280px] gap-5 mt-6">
        <ResearchPanel sources={sources} {...research} />
        <section className="p-6">
          <p className="eyebrow mb-3">A second pair of eyes</p>
          <p className="font-serif text-xl text-text-display">
            Craft needs judgment.
          </p>
          <p className="text-xs text-text-muted mt-3 leading-relaxed">
            {quality?.scope === "draft" &&
            [1, 2, 3].includes(quality.draft_index || 0)
              ? `The last quality review evaluated Draft ${quality.draft_index} only. Review each variation independently.`
              : quality?.scope === "generation" &&
                  quality.result?.toLowerCase() === "pass"
                ? "The generated drafts passed the automated quality review. Check the claims and make sure the voice is yours."
                : quality?.scope === "generation" && quality.result
                  ? "The automated review flagged these drafts. Read carefully and refine before finalizing."
                  : "No current quality evaluation is available. Review the text and sources before finalizing."}
          </p>
          {(quality?.scope === "generation" || quality?.scope === "draft") &&
            typeof quality?.substance_score === "number" && (
              <p className="text-xs text-text-muted mt-4">
                AI substance assessment
                {quality.scope === "draft"
                  ? ` (Draft ${quality.draft_index})`
                  : ""}
                :{" "}
                <strong className="text-text-display">
                  {quality.substance_score}/10
                </strong>
                <span className="block text-[10px] mt-1">
                  An automated assessment, not a performance prediction.
                </span>
              </p>
            )}
        </section>
      </div>
    </div>
  );
}
