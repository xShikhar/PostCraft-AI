"use client";
import { useRef, useState, useEffect } from "react";
import {
  ArrowLeft,
  ArrowUpRight,
  Check,
  Copy,
  Eye,
  Feather,
  Loader2,
  Send,
  Undo2,
  Redo2,
  PenLine,
  Lock,
} from "lucide-react";
import type { Drafts, ChatMessage } from "@/lib/api/generation";
import {
  ResearchPanel,
  type ResearchEvidence,
} from "@/features/research/components/research-panel";
import { getUnfilledPlaceholders } from "@/lib/utils/markdown";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
export interface DraftEditorProps extends ResearchEvidence {
  topic: string;
  platform: string;
  activeDraftIndex: number;
  draftContent: string;
  onChange: (text: string) => void;
  dirty: boolean;
  isFinalized: boolean;
  finalizedDraftIndex?: number | null;
  chatHistory: ChatMessage[];
  editInstruction: string;
  setEditInstruction: (text: string) => void;
  busy: string | null;
  onEditSubmit: (e: React.FormEvent) => void;
  onSave: () => Promise<boolean>;
  onFinalize: () => void;
  onBack: () => void;
  onCopy: (text: string) => void;
  renderMarkdown: (text: string) => string;
  allDrafts: Drafts;
  onSelectDraftIndex: (index: number) => void;
  error?: string;
  onReload: () => void;
  quality?: {
    result?: string;
    substance_score?: number | null;
    scope?: string;
    draft_index?: number;
  } | null;
  original?: string;
}
export function DraftEditor({
  topic,
  platform,
  activeDraftIndex,
  draftContent,
  onChange,
  dirty,
  isFinalized,
  finalizedDraftIndex,
  chatHistory,
  editInstruction,
  setEditInstruction,
  busy,
  onEditSubmit,
  onSave,
  onFinalize,
  onBack,
  onCopy,
  renderMarkdown,
  onSelectDraftIndex,
  error,
  onReload,
  quality,
  original,
  ...research
}: DraftEditorProps) {
  const [preview, setPreview] = useState(false),
    [confirm, setConfirm] = useState(false),
    [compare, setCompare] = useState(false);
  const [undo, setUndo] = useState<string[]>([]);
  const [redo, setRedo] = useState<string[]>([]);
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => {
    end.current?.scrollIntoView({
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "auto"
        : "smooth",
      block: "nearest",
    });
  }, [chatHistory.length]);
  const locked = isFinalized;
  const placeholders = getUnfilledPlaceholders(draftContent);
  const applicableQuality =
    quality?.scope === "generation" ||
    (quality?.scope === "draft" && quality.draft_index === activeDraftIndex)
      ? quality
      : null;
  return (
    <div className="workspace-enter">
      <div className="flex flex-wrap gap-4 justify-between items-start mb-7">
        <div>
          <button
            onClick={onBack}
            className="text-xs text-text-muted hover:text-primary flex items-center gap-2 mb-5"
          >
            <ArrowLeft size={13} />
            All variations
          </button>
          <p className="eyebrow mb-2">
            The writing room / {platform === "x" ? "X / Twitter" : "LinkedIn"}
          </p>
          <h1 className="font-serif text-[clamp(23px,2.4vw,34px)] tracking-tight text-text-display max-w-2xl">
            {topic}
          </h1>
        </div>
        <div
          className="flex bg-surface-card p-1 rounded-full border border-border-subtle self-end"
          aria-label="Draft variation"
        >
          {([1, 2, 3] as const).map((n) => (
            <button
              key={n}
              disabled={!!busy}
              onClick={() => onSelectDraftIndex(n)}
              aria-pressed={n === activeDraftIndex}
              className={`px-4 py-2 text-xs rounded-full ${n === activeDraftIndex ? "bg-text-display text-surface-card" : "text-text-muted"}`}
            >
              Draft {n}
              {isFinalized && finalizedDraftIndex === n ? " Finalized" : ""}
            </button>
          ))}
        </div>
      </div>
      <div className="grid xl:grid-cols-[minmax(0,1fr)_340px] gap-5 items-start">
        <section className="paper overflow-hidden">
          <div className="flex justify-between items-center px-5 sm:px-7 py-4 border-b border-border-subtle">
            <span className="eyebrow !text-[9px]">
              {locked ? "Finalized generation" : "Your draft, your words"}
            </span>
            <div className="flex gap-1">
              <button
                className="icon-button !w-8 !min-h-8"
                onClick={() => {
                  setPreview(false);
                }}
                aria-label="Write draft"
                aria-pressed={!preview}
              >
                <PenLine size={14} />
              </button>
              <button
                className="icon-button !w-8 !min-h-8"
                onClick={() => setPreview(true)}
                aria-label="Preview draft"
                aria-pressed={preview}
              >
                <Eye size={14} />
              </button>
              <button
                disabled={locked || !!busy || undo.length === 0}
                className="icon-button !w-8 !min-h-8"
                aria-label="Undo last change"
                onClick={() => {
                  const last = undo[undo.length - 1];
                  if (last !== undefined) {
                    setUndo((items) => items.slice(0, -1));
                    setRedo((items) => [...items, draftContent]);
                    onChange(last);
                  }
                }}
              >
                <Undo2 size={14} />
              </button>
              <button
                className="icon-button !w-8 !min-h-8"
                aria-label="Redo last change"
                disabled={locked || !!busy || !redo.length}
                onClick={() => {
                  const next = redo[redo.length - 1];
                  if (next !== undefined) {
                    setRedo((items) => items.slice(0, -1));
                    setUndo((items) => [...items, draftContent]);
                    onChange(next);
                  }
                }}
              >
                <Redo2 size={14} />
              </button>
              <button
                className="icon-button !w-8 !min-h-8"
                onClick={() => onCopy(draftContent)}
                aria-label="Copy draft"
              >
                <Copy size={14} />
              </button>
            </div>
          </div>
          {preview ? (
            <div
              className="prose-draft p-6 sm:p-9 min-h-[420px]"
              dangerouslySetInnerHTML={{ __html: renderMarkdown(draftContent) }}
            />
          ) : (
            <textarea
              aria-label="Draft text"
              value={draftContent}
              readOnly={locked || !!busy}
              maxLength={20000}
              onChange={(e) => {
                setUndo((items) => [...items.slice(-99), draftContent]);
                setRedo([]);
                onChange(e.target.value);
              }}
              onKeyDown={(e) => {
                if ((e.metaKey || e.ctrlKey) && e.key === "s") {
                  e.preventDefault();
                  if (dirty && !busy) void onSave();
                }
              }}
              className="block w-full min-h-[440px] sm:min-h-[500px] p-6 sm:p-9 bg-transparent text-text-body text-[15px] leading-[1.95] outline-none !resize-y rounded-none border-0"
            />
          )}
          {error && (
            <div
              role="alert"
              className="mx-6 mb-5 p-4 bg-error-container/20 border border-error/20 rounded-xl text-xs text-error"
            >
              {error}
              <button onClick={onReload} className="mt-2 block underline">
                Reload saved version
              </button>
            </div>
          )}
          <div className="px-6 py-5 border-t border-border-subtle flex flex-wrap gap-4 justify-between items-center">
            <div className="text-[10px] text-text-muted">
              <p className="flex gap-1.5 items-center mb-1">
                {dirty ? (
                  <span className="w-1.5 h-1.5 rounded-full bg-secondary" />
                ) : (
                  <Check size={11} />
                )}
                <span>{dirty ? "Unsaved changes" : "All changes saved"}</span>
              </p>
              <p>
                {draftContent.length.toLocaleString()} characters ·{" "}
                {draftContent.trim()
                  ? draftContent.trim().split(/\s+/).length
                  : 0}{" "}
                words
              </p>
            </div>
            <div className="flex gap-2">
              {!locked && (
                <button
                  className="btn-secondary !min-h-10 !py-2"
                  disabled={!dirty || !!busy || !draftContent.trim()}
                  onClick={() => void onSave()}
                >
                  {busy === "save" ? (
                    <Loader2 size={13} className="animate-spin" />
                  ) : (
                    <Check size={13} />
                  )}
                  Save changes
                </button>
              )}
              <button
                disabled={locked || !!busy}
                className="btn-primary !min-h-10 !py-2"
                onClick={() =>
                  placeholders.length ? setConfirm(true) : onFinalize()
                }
              >
                {busy === "finalize" ? (
                  <Loader2 size={13} className="animate-spin" />
                ) : locked ? (
                  <Lock size={13} />
                ) : (
                  <ArrowUpRight size={13} />
                )}{" "}
                {locked
                  ? `Draft ${finalizedDraftIndex || activeDraftIndex} Finalized`
                  : "Finalize"}
              </button>
            </div>
          </div>
          {original && original !== draftContent && (
            <div className="px-6 py-4 border-t border-border-subtle">
              <button
                className="text-[11px] text-text-muted underline"
                onClick={() => setCompare((v) => !v)}
              >
                {compare ? "Hide" : "Compare with"} original generation
              </button>
              {compare && (
                <div
                  className="prose-draft !text-xs mt-4 p-5 bg-surface-subtle rounded-lg"
                  dangerouslySetInnerHTML={{ __html: renderMarkdown(original) }}
                />
              )}
            </div>
          )}
        </section>
        <aside className="paper overflow-hidden">
          <div className="p-6 border-b border-border-subtle">
            <p className="eyebrow !text-primary mb-2 flex items-center gap-2">
              <Feather size={13} />
              Your thought partner
            </p>
            <h2 className="font-serif text-xl text-text-display">
              A little refinement.
            </h2>
            <p className="text-xs text-text-muted mt-2 leading-relaxed">
              Keep the idea. Find a sharper way to say it.
            </p>
          </div>
          <div className="max-h-[380px] min-h-[180px] overflow-auto custom-scrollbar p-5 space-y-4">
            {!chatHistory.length ? (
              <div className="py-5">
                <span className="text-primary">
                  <Feather size={20} />
                </span>
                <p className="text-xs text-text-muted mt-4 leading-relaxed">
                  Ask for a stronger opening, a quieter tone, or a more specific
                  ending. Revisions are saved to this draft.
                </p>
              </div>
            ) : (
              chatHistory.map((m, i) => (
                <div
                  key={i}
                  className={`p-3.5 rounded-xl text-xs leading-relaxed ${m.role === "user" ? "ml-5 bg-primary/10 text-text-body" : "mr-3 bg-surface-subtle text-text-body"}`}
                >
                  <span className="eyebrow !text-[8px] block mb-2">
                    {m.role === "user" ? "You" : "PostCraft"}
                  </span>
                  {m.content}
                </div>
              ))
            )}
            {busy === "edit" && (
              <p role="status" className="text-xs text-text-muted flex gap-2">
                <Loader2 size={13} className="animate-spin" />
                Considering your revision…
              </p>
            )}
            <div ref={end} />
          </div>
          <div className="border-t border-border-subtle p-5">
            <form onSubmit={onEditSubmit}>
              <label className="sr-only" htmlFor="edit-instruction">
                Revision instruction
              </label>
              <textarea
                id="edit-instruction"
                value={editInstruction}
                onChange={(e) => setEditInstruction(e.target.value)}
                disabled={locked || !!busy}
                maxLength={2000}
                placeholder={`Change Draft ${activeDraftIndex}... (Enter to send)`}
                rows={2}
                className="field !text-xs"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    if (editInstruction.trim() && !locked && !busy)
                      e.currentTarget.form?.requestSubmit();
                  }
                }}
              />
              <button
                type="submit"
                disabled={locked || !!busy || !editInstruction.trim()}
                className="btn-primary !min-h-9 !text-[11px] !py-2 w-full mt-2"
              >
                Refine draft
                <Send size={12} />
              </button>
            </form>
            {!locked && (
              <div className="flex flex-wrap gap-1.5 mt-4">
                {[
                  "Make it shorter",
                  "More conversational",
                  "Strengthen the opening",
                ].map((text) => (
                  <button
                    key={text}
                    disabled={!!busy}
                    onClick={() => setEditInstruction(text)}
                    className="text-[10px] px-2.5 py-1.5 rounded-full border border-border-subtle text-text-muted hover:text-primary hover:border-primary/40"
                  >
                    {text}
                  </button>
                ))}
              </div>
            )}
            {dirty && (
              <p className="text-[10px] text-text-muted mt-3">
                Save your manual changes before requesting a revision.
              </p>
            )}
            {locked && (
              <p className="text-[10px] text-text-muted mt-3">
                This generation is finalized. Its variations are read-only.
              </p>
            )}
          </div>
        </aside>
      </div>
      <div className="grid lg:grid-cols-[minmax(0,1fr)_280px] gap-5 mt-6">
        <ResearchPanel {...research} />
        <div className="p-6">
          <p className="eyebrow mb-3">Editorial note</p>
          <p className="font-serif text-xl text-text-display">
            Make the last pass yours.
          </p>
          <p className="text-xs text-text-muted mt-3 leading-relaxed">
            {dirty
              ? "Your current edits have not been evaluated. Save and review your changes before finalizing."
              : applicableQuality?.result?.toLowerCase() === "pass"
                ? "The last automated quality review passed. Verify the specifics and read it in your own voice."
                : "No passing quality assessment is available for this text. Finalization runs the actual review."}
          </p>
          <p className="text-[10px] text-text-muted mt-4">
            Finalizing saves your preferred draft and learns from your
            refinements. It does not publish to social media.
          </p>
        </div>
      </div>
      <Dialog open={confirm} onOpenChange={setConfirm}>
        <DialogContent>
          <DialogTitle>Check the placeholders</DialogTitle>
          <DialogDescription>
            This draft still includes {placeholders.join(", ")}. Replace these
            with verified details before sharing.
          </DialogDescription>
          <div className="flex gap-3 mt-4">
            <button className="btn-secondary" onClick={() => setConfirm(false)}>
              Keep editing
            </button>
            <button
              className="btn-primary"
              onClick={() => {
                setConfirm(false);
                onFinalize();
              }}
            >
              Finalize anyway
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
