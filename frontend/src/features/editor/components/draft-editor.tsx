"use client";

import { useRef, useEffect, useState } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { Loader2, Copy, ArrowLeft, Check, Lock, MessageSquare, Send, Sparkles, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { getUnfilledPlaceholders } from "@/lib/utils/markdown";

export type ChatMessage = { role: "user" | "assistant"; content: string };

interface DraftEditorProps {
  activeDraftIndex: number;
  draftContent: string;
  isFinalized: boolean;
  finalizedDraftIndex?: number | null;
  chatHistory: ChatMessage[];
  editInstruction: string;
  setEditInstruction: (v: string) => void;
  isEditing: boolean;
  loading: boolean;
  onEditSubmit: (e: React.FormEvent) => void;
  onFinalize: () => void;
  onBack: () => void;
  onCopy: (text: string) => void;
  renderMarkdown: (text: string) => string;
  allDrafts?: { draft_1?: string; draft_2?: string; draft_3?: string } | null;
  onSelectDraftIndex?: (index: number) => void;
}

const QUICK_CHIPS = [
  "Make it shorter",
  "More casual tone",
  "Add a call to action",
  "Focus on the insight",
  "Make it more punchy",
];

export function DraftEditor({
  activeDraftIndex,
  draftContent,
  isFinalized,
  finalizedDraftIndex,
  chatHistory,
  editInstruction,
  setEditInstruction,
  isEditing,
  loading,
  onEditSubmit,
  onFinalize,
  onBack,
  onCopy,
  renderMarkdown,
  allDrafts,
  onSelectDraftIndex,
}: DraftEditorProps) {
  const [showFinalizeConfirm, setShowFinalizeConfirm] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const chatListRef = useRef<HTMLDivElement>(null);
  const prevCountRef = useRef(chatHistory.length);

  const unfilledPlaceholders = getUnfilledPlaceholders(draftContent);

  const handleCopyClick = () => {
    if (unfilledPlaceholders.length > 0) {
      toast.warning(
        `Draft copied, but contains ${unfilledPlaceholders.length} unfilled placeholder(s): ${unfilledPlaceholders.join(", ")}. Fill them in before publishing!`,
        { duration: 5000 }
      );
    }
    onCopy(draftContent);
  };

  const handleFinalizeClick = () => {
    if (unfilledPlaceholders.length > 0) {
      setShowFinalizeConfirm(true);
      return;
    }
    onFinalize();
  };

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" });
  }, [chatHistory.length, isEditing]);

  // Stagger in new chat bubbles when a response or message is added
  useGSAP(() => {
    if (chatHistory.length > prevCountRef.current) {
      const bubbles = chatListRef.current?.querySelectorAll(".chat-bubble");
      if (bubbles && bubbles.length > 0) {
        const last = bubbles[bubbles.length - 1];
        const isReduced = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        if (!isReduced) {
          gsap.fromTo(
            last,
            { opacity: 0, y: 8, scale: 0.98 },
            {
              opacity: 1,
              y: 0,
              scale: 1,
              duration: 0.2,
              ease: "power2.out",
              clearProps: "transform",
            }
          );
        }
      }
    }
    prevCountRef.current = chatHistory.length;
  }, { dependencies: [chatHistory.length], scope: chatListRef });

  const isCurrentDraftFinalized = isFinalized && (finalizedDraftIndex ? activeDraftIndex === finalizedDraftIndex : true);

  return (
    <div className="w-full max-w-6xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-space-md mb-space-lg">
        <div className="flex items-center gap-space-md flex-wrap">
          <button
            onClick={onBack}
            className="w-9 h-9 rounded-lg bg-surface-subtle hover:bg-surface-container-high flex items-center justify-center text-text-muted hover:text-text-display transition-colors"
            aria-label="Back to drafts"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h2 className="font-serif text-headline-md text-text-display">
              Draft Edition
            </h2>
            <p className="font-body-sm text-body-sm text-text-muted">
              Refine your post with natural language instructions
            </p>
          </div>

          {/* Draft switcher tabs */}
          {allDrafts && (
            <div className="flex items-center gap-1 bg-surface-subtle p-1 rounded-xl border border-border-subtle ml-0 sm:ml-space-md flex-wrap">
              {([1, 2, 3] as const).map((idx) => {
                const text = allDrafts[`draft_${idx}` as keyof typeof allDrafts];
                if (!text) return null;
                const isActive = activeDraftIndex === idx;
                const isThisDraftFinalized = isFinalized && (finalizedDraftIndex ? finalizedDraftIndex === idx : activeDraftIndex === idx);
                const isThisDraftLocked = isFinalized && !isThisDraftFinalized;

                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      setShowFinalizeConfirm(false);
                      onSelectDraftIndex?.(idx);
                    }}
                    className={`
                      px-space-sm py-1 rounded-lg font-label-xs text-label-xs font-semibold transition-all flex items-center gap-1.5
                      ${isActive
                        ? "bg-surface-card text-text-display shadow-sm font-bold border border-border-subtle"
                        : "text-text-muted hover:text-text-display hover:bg-surface-container"
                      }
                    `}
                  >
                    <span className={`w-2 h-2 rounded-full ${isThisDraftFinalized ? "bg-green-500" : isThisDraftLocked ? "bg-text-muted/40" : isActive ? "bg-primary" : "bg-text-muted/40"}`} />
                    <span>Draft {idx}</span>
                    {isThisDraftFinalized && (
                      <span className="text-[10px] font-bold text-green-600 bg-green-500/10 px-1.5 py-0.5 rounded leading-none flex items-center gap-0.5">
                        <Check className="w-2.5 h-2.5" /> Finalized
                      </span>
                    )}
                    {isThisDraftLocked && (
                      <span className="text-[10px] font-medium text-text-muted bg-surface-container px-1.5 py-0.5 rounded leading-none flex items-center gap-0.5">
                        <Lock className="w-2.5 h-2.5" /> Locked
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="flex items-center gap-space-xs">
          {isFinalized ? (
            isCurrentDraftFinalized ? (
              <span className="inline-flex items-center gap-space-2xs px-space-sm py-space-2xs rounded-full bg-green-500/10 text-green-600 font-label-xs text-label-xs font-semibold">
                <Check className="w-3.5 h-3.5" />
                Finalized
              </span>
            ) : (
              <span className="inline-flex items-center gap-space-2xs px-space-sm py-space-2xs rounded-full bg-surface-container text-text-muted font-label-xs text-label-xs font-semibold">
                <Lock className="w-3.5 h-3.5" />
                Locked
              </span>
            )
          ) : (
            <Button
              onClick={handleFinalizeClick}
              disabled={loading || isEditing}
              size="sm"
              className="rounded-full bg-primary hover:bg-primary-container text-on-primary font-label-sm font-semibold"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              <span>Finalize</span>
            </Button>
          )}
          <button
            onClick={handleCopyClick}
            className="w-9 h-9 rounded-lg bg-surface-subtle hover:bg-surface-container-high flex items-center justify-center text-text-muted hover:text-text-display transition-colors"
            aria-label="Copy draft"
          >
            <Copy className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Unfilled Placeholders Finalize Confirmation Card */}
      {showFinalizeConfirm && (
        <div className="mb-space-md p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-text-display animate-in fade-in slide-in-from-top-2">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h4 className="text-sm font-bold text-amber-200">
                Notice: Unfilled Placeholders in Draft {activeDraftIndex}
              </h4>
              <p className="text-xs text-text-muted mt-1 leading-relaxed">
                This draft contains <span className="font-semibold text-amber-300">{unfilledPlaceholders.length} placeholder(s)</span> ({unfilledPlaceholders.join(", ")}).
                These brackets protect against unverified claims. Are you sure you want to finalize without replacing them with real data?
              </p>
              <div className="flex items-center gap-2 mt-3">
                <Button
                  size="sm"
                  onClick={() => {
                    setShowFinalizeConfirm(false);
                    onFinalize();
                  }}
                  className="rounded-full bg-amber-500 hover:bg-amber-600 text-black font-semibold text-xs h-8 px-4"
                >
                  Finalize Anyway
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setShowFinalizeConfirm(false)}
                  className="rounded-full text-xs h-8 px-4 text-text-muted hover:text-text-display"
                >
                  Cancel & Edit First
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-space-lg items-start">

        {/* Draft preview (left, 3/5) */}
        <div className="lg:col-span-3 flex flex-col gap-space-md">
          <div className="bg-surface-card rounded-xl border border-border-subtle p-space-lg flex-1 min-h-[400px] max-h-[75vh] overflow-y-auto custom-scrollbar">
            <div className="flex items-center justify-between mb-space-md">
              <span className="font-label-xs text-label-xs text-text-muted uppercase tracking-wider">
                Draft Preview
              </span>
              <span className="font-body-sm text-body-sm text-text-muted">
                {draftContent.length} chars · {draftContent.split(/\s+/).filter(Boolean).length} words
              </span>
            </div>
            {unfilledPlaceholders.length > 0 && (
              <div className="flex items-start gap-2.5 p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-medium mb-space-md">
                <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <div className="font-semibold text-amber-200">
                    {unfilledPlaceholders.length} Unfilled Placeholder{unfilledPlaceholders.length > 1 ? "s" : ""}
                  </div>
                  <div className="mt-1 font-mono text-amber-300 text-[11px] flex flex-wrap gap-1.5">
                    {unfilledPlaceholders.map((p, i) => (
                      <span key={i} className="px-1.5 py-0.5 rounded bg-amber-500/20 border border-amber-500/40">
                        {p}
                      </span>
                    ))}
                  </div>
                  <div className="mt-1.5 text-text-muted text-[11px] leading-relaxed">
                    Values inside brackets were held back by the anti-hallucination guard. Use the chat stream on the right or edit to supply your verified numbers.
                  </div>
                </div>
              </div>
            )}
            <div
              className="font-body-md text-body-md text-text-display leading-relaxed prose-editor [&_strong]:text-text-display [&_strong]:font-bold"
              dangerouslySetInnerHTML={{ __html: renderMarkdown(draftContent) }}
            />
          </div>
        </div>

        {/* Chat stream (right, 2/5) */}
        <div className="lg:col-span-2 flex flex-col bg-surface-card rounded-xl border border-border-subtle overflow-hidden max-h-[75vh] sticky top-6">
          {/* Chat header */}
          <div className="flex items-center justify-between px-space-md py-space-sm border-b border-border-subtle bg-surface-subtle">
            <div className="flex items-center gap-space-sm">
              <MessageSquare className="w-4 h-4 text-primary" />
              <span className="font-label-sm text-label-sm font-semibold text-text-display">
                Edit Stream
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="font-label-xs text-label-xs font-semibold px-2 py-0.5 rounded-full bg-surface-container text-text-muted">
                Draft {activeDraftIndex}
              </span>
              {isFinalized && (
                isCurrentDraftFinalized ? (
                  <span className="text-[10px] uppercase font-bold text-green-600 bg-green-500/10 px-1.5 py-0.5 rounded-full flex items-center gap-1">
                    <Check className="w-2.5 h-2.5" /> Finalized
                  </span>
                ) : (
                  <span className="text-[10px] uppercase font-medium text-text-muted bg-surface-container px-1.5 py-0.5 rounded-full flex items-center gap-1">
                    <Lock className="w-2.5 h-2.5" /> Locked
                  </span>
                )
              )}
            </div>
          </div>

          {/* Chat messages */}
          <div ref={chatListRef} className="flex-1 overflow-y-auto p-space-md space-y-space-md custom-scrollbar min-h-[200px]">
            {chatHistory.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full text-center py-space-xl">
                <MessageSquare className="w-8 h-8 text-outline mb-space-sm" />
                <p className="font-body-sm text-body-sm text-text-muted">
                  {isFinalized
                    ? (isCurrentDraftFinalized
                        ? `Draft ${activeDraftIndex} was finalized. Chat stream is closed.`
                        : `Draft ${activeDraftIndex} is locked. Draft ${finalizedDraftIndex || 1} was finalized.`)
                    : `Your revisions for Draft ${activeDraftIndex} will appear here`}
                </p>
              </div>
            )}
            {chatHistory.map((msg, i) => (
              <div
                key={i}
                className={`chat-bubble flex flex-col ${msg.role === "user" ? "items-end" : "items-start"}`}
              >
                <span className="font-label-xs text-[10px] text-text-muted mb-1 px-1 flex items-center gap-1">
                  {msg.role === "user" ? (
                    "You"
                  ) : (
                    <>
                      <Sparkles className="w-3 h-3 text-primary" />
                      <span className="font-semibold text-primary">PostCraft AI</span>
                    </>
                  )}
                </span>
                <div
                  className={`max-w-[90%] rounded-xl px-space-sm py-space-xs text-body-sm leading-relaxed ${
                    msg.role === "user"
                      ? "bg-primary text-on-primary rounded-tr-sm"
                      : "bg-surface-subtle text-text-display border border-border-subtle rounded-tl-sm"
                  }`}
                >
                  {msg.content}
                </div>
              </div>
            ))}
            {isEditing && (
              <div className="chat-bubble flex flex-col items-start">
                <span className="font-label-xs text-[10px] text-text-muted mb-1 px-1 flex items-center gap-1">
                  <Sparkles className="w-3 h-3 text-primary animate-pulse" />
                  <span className="font-semibold text-primary">PostCraft AI</span>
                </span>
                <div className="rounded-xl px-space-sm py-space-xs text-body-sm bg-surface-subtle text-text-muted border border-border-subtle flex items-center gap-space-xs">
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" />
                  <span>Revising Draft {activeDraftIndex} &amp; updating preview...</span>
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Quick chips (only when draft is editable and no conversation yet) */}
          {chatHistory.length === 0 && !isFinalized && (
            <div className="px-space-md py-space-xs border-t border-border-subtle/50 bg-surface-card">
              <p className="font-label-xs text-[11px] text-text-muted mb-1.5">
                Quick prompts for Draft {activeDraftIndex}
              </p>
              <div className="flex flex-wrap gap-1.5">
                {QUICK_CHIPS.map((chip) => (
                  <button
                    key={chip}
                    onClick={() => setEditInstruction(chip)}
                    className="px-2.5 py-1 rounded-full bg-surface-subtle hover:bg-surface-container-high text-text-muted hover:text-text-display font-label-xs text-[11px] transition-colors"
                  >
                    {chip}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Input or Finalized State */}
          {isFinalized ? (
            isCurrentDraftFinalized ? (
              <div className="p-space-md border-t border-border-subtle bg-surface-subtle flex items-center gap-space-sm">
                <div className="w-8 h-8 rounded-full bg-green-500/10 flex items-center justify-center flex-shrink-0 text-green-600">
                  <Check className="w-4 h-4" />
                </div>
                <div className="flex flex-col">
                  <span className="font-title-sm text-body-sm font-semibold text-text-display">
                    Draft {activeDraftIndex} Finalized
                  </span>
                  <span className="font-label-xs text-label-xs text-text-muted">
                    This draft was chosen and finalized. Style preferences have been saved.
                  </span>
                </div>
              </div>
            ) : (
              <div className="p-space-md border-t border-border-subtle bg-surface-subtle flex items-center gap-space-sm">
                <div className="w-8 h-8 rounded-full bg-surface-container flex items-center justify-center flex-shrink-0 text-text-muted">
                  <Lock className="w-4 h-4" />
                </div>
                <div className="flex flex-col">
                  <span className="font-title-sm text-body-sm font-semibold text-text-display">
                    Draft {activeDraftIndex} Locked
                  </span>
                  <span className="font-label-xs text-label-xs text-text-muted">
                    Draft {finalizedDraftIndex || 1} was finalized for this post. Other drafts are locked.
                  </span>
                </div>
              </div>
            )
          ) : (
            <form
              onSubmit={onEditSubmit}
              className="p-2 sm:p-2.5 border-t border-border-subtle bg-surface-subtle"
            >
              <div className="flex gap-2 items-end">
                <textarea
                  value={editInstruction}
                  onChange={(e) => setEditInstruction(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      if (!isEditing && editInstruction.trim()) {
                        onEditSubmit(e);
                      }
                    }
                  }}
                  placeholder={`Change Draft ${activeDraftIndex}... (Enter to send)`}
                  rows={1}
                  className="flex-1 bg-surface-card border border-border-subtle rounded-lg px-2.5 py-1.5 text-body-xs sm:text-body-sm text-text-display placeholder:text-outline resize-none focus:outline-none focus:ring-1 focus:ring-primary/50 min-h-[34px] max-h-[72px] leading-tight custom-scrollbar"
                  disabled={isEditing}
                />
                <button
                  type="submit"
                  disabled={isEditing || !editInstruction.trim()}
                  className="w-8 h-8 rounded-lg bg-primary hover:bg-primary-container text-on-primary flex items-center justify-center transition-colors disabled:opacity-40 disabled:pointer-events-none self-end flex-shrink-0 mb-0.5"
                  aria-label="Send edit instruction"
                >
                  {isEditing ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Send className="w-3.5 h-3.5" />
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
