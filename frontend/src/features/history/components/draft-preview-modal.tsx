"use client";

import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { X, Copy, Check, Lock, ArrowRight, FileText, Sparkles } from "lucide-react";
import type { HistoryItem } from "@/lib/api/history";
import { toast } from "sonner";
import { renderMarkdown } from "@/lib/utils/markdown";
import { useMounted } from "@/lib/use-mounted";

interface DraftPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  item: HistoryItem | null;
  initialDraftIndex?: number;
  onOpenInEditor: (generationId: string, draftIndex: number) => void;
}

export function DraftPreviewModal({
  isOpen,
  onClose,
  item,
  initialDraftIndex = 1,
  onOpenInEditor,
}: DraftPreviewModalProps) {
  const mounted = useMounted();
  const dialogRef = useRef<HTMLDivElement>(null);
  const [userDraft, setUserDraft] = useState<1 | 2 | 3 | null>(null);
  const [prevItemId, setPrevItemId] = useState<string | null>(null);

  const itemId = item?.generation_id ?? null;
  if (itemId !== prevItemId) {
    setPrevItemId(itemId);
    setUserDraft(null);
  }

  const validInitial: 1 | 2 | 3 =
    initialDraftIndex === 1 || initialDraftIndex === 2 || initialDraftIndex === 3
      ? initialDraftIndex
      : 1;
  const activeDraft: 1 | 2 | 3 = userDraft ?? validInitial;
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    const previousFocus = document.activeElement as HTMLElement | null;
    const focusTimer = setTimeout(() => dialogRef.current?.querySelector<HTMLElement>("button:not([disabled])")?.focus(), 0);
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Tab") {
        const controls = dialogRef.current?.querySelectorAll<HTMLElement>('button:not([disabled]), a[href], input, textarea, select, [tabindex="0"]');
        if (controls?.length) {
          const first = controls[0], last = controls[controls.length - 1];
          if (e.shiftKey && (document.activeElement === first || !dialogRef.current?.contains(document.activeElement))) { e.preventDefault(); last.focus(); }
          else if (!e.shiftKey && (document.activeElement === last || !dialogRef.current?.contains(document.activeElement))) { e.preventDefault(); first.focus(); }
        }
      }
      if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);

    // Lock scroll and prevent layout shift from disappearing scrollbar
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
    const prevOverflow = document.body.style.overflow;
    const prevPaddingRight = document.body.style.paddingRight;

    document.body.style.overflow = "hidden";
    if (scrollbarWidth > 0) {
      document.body.style.paddingRight = `${scrollbarWidth}px`;
    }

    return () => {
      clearTimeout(focusTimer);
      previousFocus?.focus();
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = prevOverflow;
      document.body.style.paddingRight = prevPaddingRight;
    };
  }, [isOpen, onClose]);

  if (!isOpen || !item || !mounted) return null;

  // Resolve content for current draft
  const draftContentMap: Record<1 | 2 | 3, string | null | undefined> = {
    1: item.draft_1 || (item.preview ? `${item.preview}...` : ""),
    2: item.draft_2,
    3: item.draft_3,
  };

  const currentContent = draftContentMap[activeDraft] || "";
  const charCount = currentContent.length;
  const wordCount = currentContent.split(/\s+/).filter(Boolean).length;

  const handleCopy = async () => {
    if (!currentContent) return;
    try { await navigator.clipboard.writeText(currentContent); } catch { toast.error("Clipboard access blocked."); return; }
    setCopied(true);
    toast.success(`Draft ${activeDraft} copied to clipboard!`);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleOpenEditor = () => {
    onClose();
    onOpenInEditor(item.generation_id, activeDraft);
  };

  const modalContent = (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 bg-black/75 backdrop-blur-md animate-in fade-in duration-200"
      onClick={onClose}
      ref={dialogRef}
      role="dialog"
      aria-label="Draft preview"
      aria-modal="true"
    >
      <div
        className="relative w-full max-w-3xl max-h-[85vh] my-auto bg-surface-card rounded-2xl shadow-2xl border border-border-subtle flex flex-col overflow-hidden animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex flex-col gap-space-sm p-space-md sm:p-space-lg border-b border-border-subtle bg-surface-subtle/50">
          <div className="flex items-start justify-between gap-space-md">
            <div className="flex flex-col gap-1 min-w-0">
              <div className="flex items-center gap-space-xs flex-wrap">
                <span className="w-5 h-5 rounded-full bg-surface-container flex items-center justify-center font-title-sm text-xs font-bold text-primary">
                  {item.platform === "x" ? "𝕏" : "in"}
                </span>
                <span className="font-label-xs text-label-xs uppercase tracking-wider text-text-muted">
                  {item.platform === "x" ? "X / Twitter" : "LinkedIn"}
                </span>
                <span className="text-outline-variant text-label-xs">•</span>
                {item.status === "finalized" ? (
                  (activeDraft === (item.active_draft_index || 1)) ? (
                    <span className="px-space-xs py-0.5 rounded-full text-label-xs uppercase tracking-wider bg-green-500/10 text-green-600 font-semibold flex items-center gap-1">
                      <Check className="w-3 h-3" /> Finalized
                    </span>
                  ) : (
                    <span className="px-space-xs py-0.5 rounded-full text-label-xs uppercase tracking-wider bg-surface-container text-text-muted font-semibold flex items-center gap-1">
                      <Lock className="w-3 h-3" /> Locked
                    </span>
                  )
                ) : (
                  <span className="px-space-xs py-0.5 rounded-full text-label-xs uppercase tracking-wider bg-surface-container text-text-body font-semibold">
                    {item.status === "needs_review" ? "Needs review" : "Editing"}
                  </span>
                )}
              </div>
              <h2 className="font-serif text-title-lg sm:text-headline-sm text-text-display font-semibold truncate pt-1">
                {item.topic}
              </h2>
            </div>

            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-surface-container hover:bg-surface-container-high flex items-center justify-center text-text-muted hover:text-text-display transition-colors flex-shrink-0"
              aria-label="Close modal"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Draft Selection Tabs */}
          <div className="flex items-center justify-between gap-space-sm flex-wrap pt-space-xs">
            <div className="flex items-center gap-1.5 bg-surface-container p-1 rounded-xl flex-wrap">
              {([1, 2, 3] as const).map((idx) => {
                const hasDraft = Boolean(draftContentMap[idx]);
                const isActive = activeDraft === idx;
                const isPostFinalized = item.status === "finalized";
                const isThisFinalized = isPostFinalized && idx === (item.active_draft_index || 1);
                const isThisLocked = isPostFinalized && idx !== (item.active_draft_index || 1);

                return (
                  <button
                    key={idx}
                    type="button"
                    disabled={!hasDraft}
                    onClick={() => setUserDraft(idx)}
                    className={`
                      px-space-md py-1.5 rounded-lg font-label-sm text-label-sm font-semibold transition-all flex items-center gap-1.5
                      ${
                        isActive
                          ? "bg-surface-card text-primary shadow-sm font-bold"
                          : hasDraft
                            ? "text-text-muted hover:text-text-display hover:bg-surface-card/60"
                            : "text-text-muted/40 cursor-not-allowed"
                      }
                    `}
                  >
                    {isThisFinalized ? (
                      <Check className="w-3.5 h-3.5 text-green-600" />
                    ) : isThisLocked ? (
                      <Lock className="w-3.5 h-3.5 text-text-muted" />
                    ) : (
                      <FileText className={`w-3.5 h-3.5 ${isActive ? "text-primary" : "text-text-muted"}`} />
                    )}
                    <span>Draft {idx}</span>
                    {isThisFinalized && (
                      <span className="text-[10px] uppercase font-bold text-green-600 bg-green-500/10 px-1 rounded leading-none">
                        Finalized
                      </span>
                    )}
                    {isThisLocked && (
                      <span className="text-[10px] uppercase font-medium text-text-muted bg-surface-card px-1 rounded leading-none">
                        Locked
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Metrics */}
            <div className="text-label-xs text-text-muted font-mono flex items-center gap-2">
              <span>{wordCount} words</span>
              <span>•</span>
              <span>{charCount} characters</span>
            </div>
          </div>
        </div>

        {/* Modal Body - Full Content View */}
        <div className="flex-1 overflow-y-auto p-space-md sm:p-space-xl custom-scrollbar bg-surface-card">
          {currentContent ? (
            <div
              className="prose dark:prose-invert max-w-none font-body-md text-body-md sm:text-body-lg text-text-display leading-relaxed selection:bg-primary/20 [&_strong]:text-text-display [&_strong]:font-bold"
              dangerouslySetInnerHTML={{ __html: renderMarkdown(currentContent) }}
            />
          ) : (
            <div className="py-12 text-center text-text-muted font-body-md">
              Draft {activeDraft} content not available.
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between p-space-md sm:p-space-lg border-t border-border-subtle bg-surface-subtle/50 gap-space-sm">
          <button
            onClick={handleCopy}
            className="flex items-center gap-space-xs px-space-md py-space-xs rounded-full bg-surface-container hover:bg-surface-container-high text-text-display font-label-md text-label-md transition-colors btn-press"
          >
            {copied ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4 text-text-muted" />}
            <span>{copied ? "Copied" : `Copy Draft ${activeDraft}`}</span>
          </button>

          <div className="flex items-center gap-space-xs">
            <button
              onClick={onClose}
              className="px-space-md py-space-xs rounded-full bg-surface-subtle hover:bg-surface-container text-text-muted hover:text-text-display font-label-md text-label-md transition-colors btn-press"
            >
              Close
            </button>
            {item.status === "finalized" ? (
              <button
                onClick={handleOpenEditor}
                className="flex items-center gap-space-xs px-space-lg py-space-xs rounded-full bg-surface-container hover:bg-surface-container-high text-text-display font-label-md text-label-md shadow-sm transition-all btn-press"
              >
                {activeDraft === (item.active_draft_index || 1) ? (
                  <>
                    <Check className="w-4 h-4 text-green-600" />
                    <span>View Finalized Draft</span>
                  </>
                ) : (
                  <>
                    <Lock className="w-4 h-4 text-text-muted" />
                    <span>View Locked Draft {activeDraft}</span>
                  </>
                )}
                <ArrowRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                onClick={handleOpenEditor}
                className="flex items-center gap-space-xs px-space-lg py-space-xs rounded-full bg-primary hover:bg-primary-container text-on-primary font-label-md text-label-md shadow-md transition-all btn-press"
              >
                <Sparkles className="w-4 h-4" />
                <span>Edit Draft {activeDraft}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}
