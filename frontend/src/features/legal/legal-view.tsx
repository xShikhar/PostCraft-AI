"use client";

import { ArrowLeft } from "lucide-react";
import ReactMarkdown from "react-markdown";
import {
  LAST_UPDATED,
  PRIVACY_POLICY_MARKDOWN,
  TERMS_OF_SERVICE_MARKDOWN,
  GDPR_NOTES_MARKDOWN,
} from "./legal-content";

export type LegalKind = "privacy" | "terms";

interface LegalViewProps {
  kind: LegalKind;
  onBack: () => void;
}

export function LegalView({ kind, onBack }: LegalViewProps) {
  // Privacy page is a full document; the Terms page is also full but
  // includes a "GDPR notes" panel at the bottom because the same audience
  // (EU/UK users) tends to need both, and it saves them a click.
  const isPrivacy = kind === "privacy";

  return (
    <div className="min-h-screen bg-canvas-base">
      <div className="max-w-3xl mx-auto px-space-lg py-space-2xl">
        {/* Back nav */}
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-space-2xs px-space-sm py-space-2xs rounded-full text-text-muted hover:text-text-display hover:bg-surface-subtle transition-colors font-label-md text-label-md"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back</span>
        </button>

        {/* Title block */}
        <header className="mt-space-lg flex flex-col gap-space-xs">
          <span className="font-label-xs text-label-xs uppercase tracking-widest text-primary font-bold">
            LEGAL
          </span>
          <h1 className="font-serif text-display-lg text-text-display tracking-tight leading-none">
            {isPrivacy ? "Privacy Policy" : "Terms of Service"}
          </h1>
          <p className="font-body-sm text-body-sm text-text-muted">
            Last updated {LAST_UPDATED}
          </p>
        </header>

        {/* Body — rendered as a single surface-card, prose-styled.
            react-markdown does the parsing; we sanitize / style the
            output via the components prop. This page is not user-input
            so the XSS surface is just the markdown itself, which is
            authored by us. */}
        <article className="mt-space-lg bg-surface-card rounded-xl p-space-lg shadow-card-light border border-border-subtle">
          <LegalMarkdown source={isPrivacy ? PRIVACY_POLICY_MARKDOWN : TERMS_OF_SERVICE_MARKDOWN} />

          {!isPrivacy && (
            <section className="mt-space-2xl pt-space-lg border-t border-border-subtle">
              <h2 className="font-serif text-headline-md text-text-display mb-space-sm">
                GDPR Notes (EU/UK)
              </h2>
              <LegalMarkdown source={GDPR_NOTES_MARKDOWN} />
            </section>
          )}
        </article>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Markdown renderer — keeps the legal-page styling consistent regardless of
// which document is being shown.
// ---------------------------------------------------------------------------

function LegalMarkdown({ source }: { source: string }) {
  return (
    <div className="legal-prose font-body-md text-body-md text-text-body leading-relaxed [&_a]:text-primary [&_a]:underline [&_a]:decoration-primary/40 hover:[&_a]:decoration-primary [&_a]:transition-colors [&_strong]:text-text-display [&_strong]:font-semibold [&_h1]:hidden">
      <ReactMarkdown
        components={{
          h1: () => null, // We render the title ourselves above
          h2: ({ children }) => (
            <h2 className="font-serif text-headline-md text-text-display mt-space-xl mb-space-sm first:mt-0">
              {children}
            </h2>
          ),
          h3: ({ children }) => (
            <h3 className="font-serif text-title-lg text-text-display mt-space-lg mb-space-xs">
              {children}
            </h3>
          ),
          p: ({ children }) => (
            <p className="my-space-sm first:mt-0 last:mb-0">{children}</p>
          ),
          ul: ({ children }) => (
            <ul className="my-space-sm pl-space-lg list-disc space-y-1">{children}</ul>
          ),
          ol: ({ children }) => (
            <ol className="my-space-sm pl-space-lg list-decimal space-y-1">{children}</ol>
          ),
          li: ({ children }) => <li className="leading-relaxed">{children}</li>,
          table: ({ children }) => (
            <div className="my-space-md overflow-x-auto">
              <table className="w-full border-collapse text-body-sm">
                {children}
              </table>
            </div>
          ),
          thead: ({ children }) => (
            <thead className="bg-surface-subtle">{children}</thead>
          ),
          th: ({ children }) => (
            <th className="text-left font-label-md text-label-md text-text-display px-space-sm py-space-xs border-b border-border-subtle">
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className="px-space-sm py-space-xs border-b border-border-subtle align-top text-text-body">
              {children}
            </td>
          ),
        }}
      >
        {source}
      </ReactMarkdown>
    </div>
  );
}
