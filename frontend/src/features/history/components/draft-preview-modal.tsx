"use client";

import { useState } from "react";
import { ArrowRight, Check, Copy, Lock } from "lucide-react";
import type { HistoryItem } from "@/lib/api/history";
import { toast } from "sonner";
import { renderMarkdown } from "@/lib/utils/markdown";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface DraftPreviewModalProps {
  isOpen: boolean; onClose: () => void; item: HistoryItem | null; initialDraftIndex?: number;
  onOpenInEditor: (generationId: string, draftIndex: number) => void;
}
function PreviewContent({ item, initialDraftIndex, onClose, onOpenInEditor }: { item: HistoryItem; initialDraftIndex: number; onClose: () => void; onOpenInEditor: DraftPreviewModalProps["onOpenInEditor"] }) {
  const [activeDraft, setActiveDraft] = useState(initialDraftIndex >= 1 && initialDraftIndex <= 3 ? initialDraftIndex : 1);
  const [copied, setCopied] = useState(false);
  const drafts = [item.draft_1, item.draft_2, item.draft_3];
  const content = drafts[activeDraft - 1] ?? "";
  const previewOnly = activeDraft === 1 && !content && Boolean(item.preview);
  const finalized = item.status === "finalized";
  const selectedFinal = finalized && activeDraft === (item.active_draft_index || 1);
  const copy = async () => {
    try { await navigator.clipboard.writeText(content); setCopied(true); toast.success("Draft copied."); }
    catch { toast.error("Clipboard access is unavailable. Try selecting and copying the draft text."); }
  };
  return <>
    <DialogHeader className="pr-8"><p className="eyebrow mb-2">{item.platform === "x" ? "X" : item.platform === "linkedin" ? "LinkedIn" : item.platform} / Your archive</p><DialogTitle className="font-serif text-2xl leading-snug sm:text-3xl">{item.topic || "Untitled generation"}</DialogTitle><DialogDescription className="pt-2">{finalized ? selectedFinal ? "Finalized draft · Read only" : "Locked alternative · Read only" : item.status.replaceAll("_", " ")}</DialogDescription></DialogHeader>
    <div className="flex flex-wrap items-center justify-between gap-4 border-y border-border-subtle py-4"><div className="flex flex-wrap gap-2" aria-label="Choose draft">{[1, 2, 3].map(index => <button key={index} className={`min-h-11 rounded-lg border px-3 text-sm ${activeDraft === index ? "border-primary/30 bg-primary/10 text-primary" : "border-border-subtle text-text-muted"}`} disabled={!drafts[index - 1] && !(index === 1 && item.preview)} aria-pressed={activeDraft === index} onClick={() => { setActiveDraft(index); setCopied(false); }}><span className="inline-flex items-center gap-2">{finalized && (index === (item.active_draft_index || 1) ? <Check size={13} /> : <Lock size={13} />)}Draft {index}</span></button>)}</div>{content && <p className="text-xs tabular-nums text-text-muted">{content.split(/\s+/).filter(Boolean).length} words · {content.length.toLocaleString()} characters</p>}</div>
    <div className="min-h-40 overflow-y-auto rounded-xl border border-border-subtle bg-surface-subtle/40 px-4 py-5 sm:px-6">{content ? <div className="prose max-w-none text-base leading-8 text-text-display dark:prose-invert [&_strong]:text-text-display" dangerouslySetInnerHTML={{ __html: renderMarkdown(content) }} /> : previewOnly ? <div><p className="whitespace-pre-wrap text-base leading-8 text-text-display">{item.preview}</p><p className="mt-5 text-sm text-text-muted">This is a shortened preview. Open the draft to read the saved content.</p></div> : <p className="text-sm text-text-muted">No content is available for this draft.</p>}</div>
    <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-border-subtle pt-5"><button className="btn-secondary" disabled={!content} onClick={() => void copy()}>{copied ? <Check size={16} /> : <Copy size={16} />}{copied ? <span data-motion="feedback" role="status">Copied</span> : "Copy draft"}</button><button className="btn-primary" onClick={() => { onClose(); onOpenInEditor(item.generation_id, activeDraft); }}>{finalized ? selectedFinal ? "View finalized draft" : "View locked draft" : "Open in editor"}<ArrowRight size={16} /></button></footer>
  </>;
}
export function DraftPreviewModal({ isOpen, onClose, item, initialDraftIndex = 1, onOpenInEditor }: DraftPreviewModalProps) {
  return <Dialog open={isOpen && Boolean(item)} onOpenChange={open => { if (!open) onClose(); }}><DialogContent className="flex max-h-[88dvh] w-[calc(100%_-_2rem)] max-w-3xl flex-col gap-5 overflow-hidden rounded-2xl p-6 sm:p-8">{item && <PreviewContent key={`${item.generation_id}:${initialDraftIndex}:${isOpen}`} item={item} initialDraftIndex={initialDraftIndex} onClose={onClose} onOpenInEditor={onOpenInEditor} />}</DialogContent></Dialog>;
}
