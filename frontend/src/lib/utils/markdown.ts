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

  // Convert remaining newlines to linebreaks
  html = html.replace(/\n/g, "<br/>");

  return DOMPurify.sanitize(html);
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
