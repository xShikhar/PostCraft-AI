import DOMPurify from "isomorphic-dompurify";

/**
 * Parses markdown into safe, beautifully styled HTML.
 * Correctly transforms headings, bold (**), italics (*), numbered lists (1.),
 * bullet lists (- / *), and linebreaks so that raw markdown syntax like ** never appears.
 */
export function renderMarkdown(text: string): string {
  if (!text) return "";

  // Sanitize entities first so raw HTML tags cannot be executed
  let html = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  // Headings
  html = html
    .replace(/^### (.+)$/gm, '<h4 class="text-base font-semibold mt-4 mb-2 text-text-display">$1</h4>')
    .replace(/^## (.+)$/gm, '<h3 class="text-lg font-semibold mt-5 mb-2 text-text-display">$1</h3>')
    .replace(/^# (.+)$/gm, '<h2 class="text-xl font-bold mt-6 mb-3 text-text-display">$1</h2>');

  // Bold text: **bold** (allow across or within lines)
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong class="font-bold text-text-display">$1</strong>');

  // Italics text: *italic* or _italic_
  html = html.replace(/(?<![*])\*(?![*])(.+?)(?<![*])\*(?![*])/g, '<em class="italic text-text-body/90">$1</em>');

  // Numbered list items: e.g. "1. **Title:** description"
  html = html.replace(/^(\d+)\.\s+(.+)$/gm, '<div class="flex gap-2 my-2 items-start"><span class="font-bold text-primary flex-shrink-0 select-none">$1.</span><div class="flex-1">$2</div></div>');

  // Bullet list items: e.g. "- item" or "* item"
  html = html.replace(/^[*\-]\s+(.+)$/gm, '<li class="ml-5 list-disc my-1 text-text-body/90">$1</li>');

  // Unfilled placeholders: e.g. [MRR threshold] or [X% client churn]
  // Excludes markdown links [text](...) via (?!\s*\() and numeric citation brackets [1], [2] via (?!\d+\])
  // Perfectly matches adjacent bracket pairs like [MRR threshold][X% churn]
  // Uses theme tokens for high-contrast visibility in both light and dark modes
  const PLACEHOLDER_REGEX = /\[(?!\d+\])([^\]\(\n\r]+)\](?!\s*\()/g;
  html = html.replace(
    PLACEHOLDER_REGEX,
    '<mark class="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-mono font-semibold bg-amber-500/15 text-amber-900 border border-amber-500/40 dark:bg-amber-500/25 dark:text-amber-200 dark:border-amber-500/50 not-italic select-all" title="Unfilled placeholder: fill before publishing">[$1]</mark>'
  );

  // Convert remaining newlines to linebreaks
  html = html.replace(/\n/g, "<br/>");

  // DOMPurify runs AFTER all transformations to ensure absolute XSS safety
  return DOMPurify.sanitize(html, { ADD_TAGS: ["mark"], ADD_ATTR: ["class", "title"] });
}

/**
 * Extracts all unique unfilled bracketed placeholders from text (e.g. ['[MRR threshold]']).
 * Strictly excludes markdown links [text](...) and pure citation numbers like [1], [2],
 * while correctly matching adjacent brackets like [Metric A][Metric B].
 */
export function getUnfilledPlaceholders(text: string): string[] {
  if (!text) return [];
  const matches = text.match(/\[(?!\d+\])([^\]\(\n\r]+)\](?!\s*\()/g);
  if (!matches) return [];
  return Array.from(new Set(matches.map((m) => m.trim())));
}

/**
 * Strips markdown formatting for clean plain-text previews (e.g. cards, history snippets).
 * Prevents raw asterisks or list markers from appearing in snippet previews.
 */
export function stripMarkdown(text: string): string {
  if (!text) return "";
  return text
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/(?<![*])\*(?![*])(.+?)(?<![*])\*(?![*])/g, "$1")
    .replace(/^#+\s+/gm, "")
    .replace(/^\d+\.\s+/gm, "")
    .replace(/^[*\-]\s+/gm, "")
    .replace(/\n+/g, " ")
    .trim();
}
