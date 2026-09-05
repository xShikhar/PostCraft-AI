"use client";

import { Edit3, Copy, Check } from "lucide-react";
import { useState } from "react";
import { type Drafts } from "@/lib/api/generation";

interface DraftSelectionGridProps {
  drafts: Drafts;
  platform: string;
  onSelect: (num: number) => void;
  onCopy: (text: string) => void;
  renderMarkdown: (text: string) => string;
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
    <div className="group relative bg-surface-card rounded-xl p-space-lg shadow-card-light hover:shadow-2xl transition-all duration-300 hover:bg-gradient-to-br hover:from-surface-card-hover-start hover:to-surface-card-hover-end hover:text-surface-card flex flex-col justify-between min-h-[320px]">
      {/* Header */}
      <div className="flex flex-col gap-space-sm">
        <div className="flex items-center justify-between flex-wrap gap-space-xs">
          <span className="font-serif text-title-lg text-text-display group-hover:text-surface-bright transition-colors">
            Draft {number}
          </span>
          <PlatformBadge platform={platform} />
        </div>

        {/* Divider */}
        <div className="border-t border-border-subtle group-hover:border-surface-variant transition-colors" />
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        <div
          className="font-body-md text-body-md text-text-muted group-hover:text-surface-variant transition-colors line-clamp-[8] prose-invert max-w-none [&_br]:hidden [&_h2]:hidden [&_h3]:hidden [&_h4]:hidden [&_strong]:font-semibold [&_strong]:text-text-display group-hover:[&_strong]:text-surface-bright [&_em]:italic [&_em]:text-text-body/90 group-hover:[&_em]:text-surface-variant [&_li]:text-text-muted group-hover:[&_li]:text-surface-variant"
          dangerouslySetInnerHTML={{ __html: renderMarkdown(content) }}
        />
      </div>

      {/* Footer: stats + actions */}
      <div className="pt-space-md mt-space-md border-t border-border-subtle group-hover:border-surface-variant transition-colors">
        <div className="flex items-center justify-between flex-wrap gap-space-sm">
          <div className="flex items-center gap-space-sm">
            <span className="font-label-xs text-label-xs text-text-muted group-hover:text-surface-variant transition-colors">
              {charCount} chars
            </span>
            <span className="text-outline-variant text-label-xs">·</span>
            <span className="font-label-xs text-label-xs text-text-muted group-hover:text-surface-variant transition-colors">
              {wordCount} words
            </span>
          </div>

          <div className="flex items-center gap-space-2xs">
            <button
              onClick={handleCopy}
              className="flex items-center gap-space-2xs px-space-sm py-space-2xs rounded-full bg-surface-subtle group-hover:bg-inverse-surface text-text-body group-hover:text-surface-bright transition-all font-label-xs text-label-xs font-semibold"
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
              className="flex items-center gap-space-2xs px-space-sm py-space-2xs rounded-full bg-primary text-on-primary group-hover:bg-surface-bright group-hover:text-text-display transition-all font-label-xs text-label-xs font-semibold shadow-sm"
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
}: DraftSelectionGridProps) {
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-space-lg">
        <DraftCard
          number={1}
          content={drafts.draft_1}
          platform={platform}
          onSelect={onSelect}
          onCopy={onCopy}
          renderMarkdown={renderMarkdown}
        />
        <DraftCard
          number={2}
          content={drafts.draft_2}
          platform={platform}
          onSelect={onSelect}
          onCopy={onCopy}
          renderMarkdown={renderMarkdown}
        />
        <DraftCard
          number={3}
          content={drafts.draft_3}
          platform={platform}
          onSelect={onSelect}
          onCopy={onCopy}
          renderMarkdown={renderMarkdown}
        />
      </div>
    </section>
  );
}
