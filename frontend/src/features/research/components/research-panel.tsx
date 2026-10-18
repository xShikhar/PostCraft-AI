"use client";
import { ArrowUpRight, BookOpen, Info } from "lucide-react";
import type { SourceItem } from "@/lib/api/generation";
export type ResearchEvidence = {
  sources: SourceItem[];
  research_source?: string | null;
  research_confidence?: string | null;
  research_retrieved_at?: string | null;
};
export function ResearchPanel({
  sources,
  research_source,
  research_confidence,
  research_retrieved_at,
}: ResearchEvidence) {
  const safe = sources.flatMap((s) => {
    try {
      const url = new URL(s.url);
      return ["http:", "https:"].includes(url.protocol)
        ? [{ ...s, domain: url.hostname }]
        : [];
    } catch {
      return [];
    }
  });
  const retrieved = research_retrieved_at
    ? new Date(research_retrieved_at)
    : null;
  return (
    <section className="paper p-5 sm:p-6">
      <div className="flex justify-between items-start gap-3">
        <div>
          <p className="eyebrow mb-2 flex items-center gap-2">
            <BookOpen size={12} />
            Behind the words
          </p>
          <h2 className="font-serif text-xl text-text-display">
            Research & context
          </h2>
        </div>
        {research_confidence && (
          <span className="status-pill text-text-muted">
            {research_confidence} confidence
          </span>
        )}
      </div>
      <p className="text-xs text-text-muted mt-3 leading-relaxed">
        {research_source === "synthetic_structure"
          ? "No external research was retrieved. AI-generated structure is guidance, not sourced evidence."
          : safe.length
            ? "These sources informed the generation. Check the original material before relying on a claim."
            : "No external source evidence is available for this generation."}
      </p>
      {research_source && (
        <div className="flex flex-wrap gap-3 text-[10px] text-text-muted mt-4">
          <span>
            Mode:{" "}
            {(
              {
                cache: "Cached research",
                curated_search: "Curated search",
                general_search: "Web search",
                synthetic_structure: "AI structure only",
              } as Record<string, string>
            )[research_source] || research_source}
          </span>
          {retrieved && !Number.isNaN(retrieved.getTime()) && (
            <span>Retrieved {retrieved.toLocaleString()}</span>
          )}
        </div>
      )}
      {safe.length > 0 ? (
        <div className="mt-4 divide-y divide-border-subtle">
          {safe.map((s, i) => (
            <a
              key={`${s.url}-${i}`}
              href={s.url}
              target="_blank"
              rel="noopener noreferrer"
              className="group flex items-start gap-3 py-4"
            >
              <span className="text-[10px] text-text-muted pt-1">
                {String(i + 1).padStart(2, "0")}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold text-text-display group-hover:text-primary break-words">
                  {s.title || s.domain}
                </p>
                <p className="text-[10px] text-text-muted mt-1">{s.domain}</p>
                {s.snippet && (
                  <p className="text-xs text-text-muted mt-2 leading-relaxed line-clamp-3">
                    {s.snippet}
                  </p>
                )}
              </div>
              <ArrowUpRight size={14} className="shrink-0 text-text-muted" />
            </a>
          ))}
        </div>
      ) : (
        <div className="mt-5 p-4 rounded-lg bg-surface-subtle text-xs text-text-muted flex gap-3">
          <Info size={15} className="shrink-0 mt-0.5" />
          Your original experience is still the primary source. Add verifiable
          specifics when editing.
        </div>
      )}
    </section>
  );
}
