"use client";

import { Edit3, Copy, Check } from "lucide-react";
import { useState, useRef } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { type Drafts, type SourceItem } from "@/lib/api/generation";

gsap.registerPlugin(useGSAP);

interface DraftSelectionGridProps {
  drafts: Drafts;
  platform: string;
  onSelect: (num: number) => void;
  onCopy: (text: string) => void;
  renderMarkdown: (text: string) => string;
  sources?: SourceItem[];
}

function countWords(text: string): number {
  return text.trim() ? text.trim().split(/\s+/).length : 0;
}

function PlatformBadge({ platform }: { platform: string }) {
  const isX = platform === "x";
  return (
    <span className="inline-flex items-center gap-space-2xs px-space-xs py-space-2xs bg-surface-subtle rounded-full font-label-xs text-label-xs uppercase tracking-wider font-semibold">
      <span className="w-4 h-4 rounded-full bg-surface-container flex items-center justify-center leading-none">
        <span className="text-[10px] font-bold text-primary leading-none">
          {isX ? "𝕏" : "in"}
        </span>
      </span>
      {isX ? "X / Twitter" : "LinkedIn"}
    </span>
  );
}

function DraftCard({
  number,
  content,
  platform,
  onSelect,
  onCopy,
  renderMarkdown,
}: {
  number: 1 | 2 | 3;
  content: string;
  platform: string;
  onSelect: (num: number) => void;
  onCopy: (text: string) => void;
  renderMarkdown: (text: string) => string;
}) {
  const [copied, setCopied] = useState(false);
  const charCount = content.length;
  const wordCount = countWords(content);

  const handleCopy = () => {
    onCopy(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative rounded-xl p-space-lg flex flex-col justify-between min-h-[320px] w-full h-full">
      {/* Header */}
      <div className="flex flex-col gap-space-sm relative z-10">
        <div className="flex items-center justify-between flex-wrap gap-space-xs">
          <span className="font-serif text-title-lg text-text-display">
            Draft {number}
          </span>
          <PlatformBadge platform={platform} />
        </div>

        {/* Divider */}
        <div className="border-t border-border-subtle" />
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden relative z-10">
        <div
          className="font-body-md text-body-md text-text-muted line-clamp-[8] prose-invert max-w-none [&_br]:hidden [&_h2]:hidden [&_h3]:hidden [&_h4]:hidden [&_strong]:font-semibold [&_strong]:text-text-display [&_em]:italic [&_em]:text-text-body/90 [&_li]:text-text-muted"
          dangerouslySetInnerHTML={{ __html: renderMarkdown(content) }}
        />
      </div>

      {/* Footer: stats + actions */}
      <div className="pt-space-md mt-space-md border-t border-border-subtle relative z-10">
        <div className="flex items-center justify-between flex-wrap gap-space-sm">
          <div className="flex items-center gap-space-sm">
            <span className="font-label-xs text-label-xs text-text-muted">
              {charCount} chars
            </span>
            <span className="text-outline-variant text-label-xs">·</span>
            <span className="font-label-xs text-label-xs text-text-muted">
              {wordCount} words
            </span>
          </div>

          <div className="flex items-center gap-space-2xs">
            <button
              onClick={handleCopy}
              className="flex items-center gap-space-2xs px-space-sm py-space-2xs rounded-full bg-surface-subtle hover:bg-surface-container-high text-text-body transition-all font-label-xs text-label-xs font-semibold btn-press"
            >
              {copied ? (
                <>
                  <Check className="w-3 h-3" />
                  <span>Copied</span>
                </>
              ) : (
                <>
                  <Copy className="w-3 h-3" />
                  <span>Copy</span>
                </>
              )}
            </button>

            <button
              onClick={() => onSelect(number)}
              className="flex items-center gap-space-2xs px-space-sm py-space-2xs rounded-full bg-primary text-on-primary hover:bg-primary-container transition-all font-label-xs text-label-xs font-semibold shadow-sm btn-press"
            >
              <Edit3 className="w-3 h-3" />
              <span>Edit</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function DraftSelectionGrid({
  drafts,
  platform,
  onSelect,
  onCopy,
  renderMarkdown,
  sources,
}: DraftSelectionGridProps) {
  const gridRef = useRef<HTMLDivElement>(null);

  const { contextSafe } = useGSAP({ scope: gridRef });

  const handleCardMouseEnter = contextSafe((cardEl: HTMLElement) => {
    const isReduced = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const cards = cardEl.parentElement?.querySelectorAll<HTMLElement>(".draft-card");
    if (!cards) return;

    cards.forEach((c) => {
      if (c === cardEl) {
        gsap.to(c, {
          scale: isReduced ? 1 : 1.025,
          opacity: 1,
          duration: isReduced ? 0 : 0.22,
          ease: "power2.out",
          overwrite: "auto",
        });
      } else {
        gsap.to(c, {
          scale: isReduced ? 1 : 0.985,
          opacity: 0.82,
          duration: isReduced ? 0 : 0.22,
          ease: "power2.out",
          overwrite: "auto",
        });
      }
    });
  });

  const handleGridMouseLeave = contextSafe((e: React.MouseEvent<HTMLDivElement>) => {
    const cards = e.currentTarget.querySelectorAll<HTMLElement>(".draft-card");
    if (!cards) return;

    gsap.to(cards, {
      scale: 1,
      opacity: 1,
      duration: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 0.25,
      ease: "power2.out",
      overwrite: "auto",
    });
  });

  useGSAP(() => {
    const isReduced = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (isReduced) return;

    gsap.from(".draft-card", {
      opacity: 0,
      y: 12,
      duration: isReduced ? 0 : 0.22,
      stagger: 0.05,
      ease: "power2.out",
      clearProps: "all",
    });
  }, { scope: gridRef });

  return (
    <section className="flex flex-col gap-space-lg">
      <div className="flex flex-col gap-space-xs">
        <span className="font-label-xs text-label-xs uppercase tracking-widest text-text-muted font-bold">
          Step 3 of 4
        </span>
        <h2 className="font-serif text-headline-md text-text-display">
          Select Your Draft
        </h2>
        <p className="font-body-md text-body-md text-text-muted">
          Choose the draft that best captures your voice and intent.
        </p>
      </div>

      <div
        ref={gridRef}
        onMouseLeave={handleGridMouseLeave}
        className="grid grid-cols-1 lg:grid-cols-3 gap-space-lg draft-grid"
      >
        {[1, 2, 3].map((num) => (
          <div
            key={num}
            onMouseEnter={(e) => handleCardMouseEnter(e.currentTarget)}
            className="draft-card history-card spotlight-card"
          >
            <DraftCard
              number={num as 1 | 2 | 3}
              content={drafts[`draft_${num}` as keyof Drafts]}
              platform={platform}
              onSelect={onSelect}
              onCopy={onCopy}
              renderMarkdown={renderMarkdown}
            />
          </div>
        ))}
      </div>

      {sources && sources.length > 0 && (
        <div className="mt-space-sm p-space-md rounded-xl bg-surface-subtle border border-border-subtle">
          <h4 className="text-label-xs font-semibold uppercase tracking-wider text-text-muted mb-space-xs">
            Grounding Research Sources ({sources.length})
          </h4>
          <div className="flex flex-wrap gap-space-xs">
            {sources.map((s, idx) => (
              <a
                key={idx}
                href={s.url || "#"}
                target="_blank"
                rel="noopener noreferrer"
                className="text-body-xs text-primary hover:underline bg-surface-base px-space-sm py-space-2xs rounded-lg border border-border-subtle transition-colors"
                title={s.snippet}
              >
                {s.title || `Source ${idx + 1}`} ↗
              </a>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
