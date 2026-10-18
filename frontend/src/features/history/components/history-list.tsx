"use client";

import { Fragment, useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, ChevronLeft, ChevronRight, Eye, FileText, Loader2, Search, Trash2 } from "lucide-react";
import { listGenerations, deleteGeneration, type HistoryItem, type HistoryListParams } from "@/lib/api/history";
import { DraftPreviewModal } from "./draft-preview-modal";
import { stripMarkdown } from "@/lib/utils/markdown";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";

interface HistoryListProps { onBack: () => void; onOpen: (genId: string, draftIndex?: number) => void }
const PAGE_SIZE = 12;
const statusLabel = (status: string) => status.replaceAll("_", " ");
function monthLabel(date: string | null) { if (!date || Number.isNaN(Date.parse(date))) return "Date unavailable"; return new Date(date).toLocaleDateString(undefined, { month: "long", year: "numeric" }); }
function dateLabel(date: string | null) { if (!date || Number.isNaN(Date.parse(date))) return "Date unavailable"; return new Date(date).toLocaleDateString(undefined, { month: "short", day: "numeric" }); }

export function HistoryList({ onBack, onOpen }: HistoryListProps) {
  const [items, setItems] = useState<HistoryItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [platform, setPlatform] = useState("");
  const [status, setStatus] = useState<NonNullable<HistoryListParams["status"]> | "">("");
  const [sort, setSort] = useState<"newest" | "oldest">("newest");
  const [page, setPage] = useState(0);
  const [revision, setRevision] = useState(0);
  const [preview, setPreview] = useState<HistoryItem | null>(null);
  const [previewDraft, setPreviewDraft] = useState(1);
  const [selectedDraft, setSelectedDraft] = useState<Record<string, number>>({});
  const [deletingItem, setDeletingItem] = useState<HistoryItem | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const currentRequest = useRef(0);

  useEffect(() => {
    const request = ++currentRequest.current;
    const timer = setTimeout(() => {
      setLoading(true); setError("");
      listGenerations({ limit: PAGE_SIZE, offset: page * PAGE_SIZE, q: query, platform, status: status || undefined, sort })
        .then(result => {
          if (request !== currentRequest.current) return;
          if (page > 0 && result.items.length === 0 && result.total > 0) { setPage(Math.max(0, Math.ceil(result.total / PAGE_SIZE) - 1)); return; }
          setItems(result.items); setTotal(result.total);
        })
        .catch(reason => { if (request === currentRequest.current) setError(reason instanceof Error ? reason.message : "History is unavailable. Please try again."); })
        .finally(() => { if (request === currentRequest.current) setLoading(false); });
    }, 220);
    return () => { clearTimeout(timer); currentRequest.current = request + 1; };
  }, [query, platform, status, sort, page, revision]);

  const remove = async () => {
    if (!deletingItem) return;
    setDeleting(true); setDeleteError("");
    try { await deleteGeneration(deletingItem.generation_id); setDeletingItem(null); toast.success("Generation deleted."); setRevision(value => value + 1); }
    catch (reason) { setDeleteError(reason instanceof Error ? reason.message : "Couldn’t delete this generation. Please try again."); }
    finally { setDeleting(false); }
  };
  const reset = () => { setQuery(""); setPlatform(""); setStatus(""); setSort("newest"); setPage(0); };
  const filtered = Boolean(query || platform || status);
  const pages = Math.ceil(total / PAGE_SIZE);

  return <div className="mx-auto w-full max-w-6xl space-y-8 pb-12">
    <header className="space-y-5"><button className="btn-secondary" onClick={onBack}><ArrowLeft size={16} /> Back to workspace</button><div data-motion="heading" className="flex flex-wrap items-end justify-between gap-5"><div><p className="eyebrow mb-3">Your writing collection</p><h1 className="page-title">Every idea has a place.</h1><p className="mt-4 text-base leading-7 text-text-muted">Return to a thought. Find your next draft.</p></div>{!loading && !error && <p className="text-sm text-text-muted" role="status">{total.toLocaleString()} {total === 1 ? "generation" : "generations"}{filtered ? " found" : " saved"}</p>}</div></header>
    <section data-motion="panel" aria-label="History filters" className="paper grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_160px_170px_160px]">
      <div><label htmlFor="history-query" className="mb-2 block text-xs font-semibold text-text-muted">Search your archive</label><div className="relative"><Search className="pointer-events-none absolute left-3 top-3.5 text-text-muted" size={16} /><input id="history-query" className="field w-full pl-10" placeholder="Topics and notes…" value={query} onChange={event => { setQuery(event.target.value); setPage(0); }} /></div></div>
      <div><label htmlFor="history-platform" className="mb-2 block text-xs font-semibold text-text-muted">Platform</label><select id="history-platform" className="field w-full" value={platform} onChange={event => { setPlatform(event.target.value); setPage(0); }}><option value="">All platforms</option><option value="linkedin">LinkedIn</option><option value="x">X</option></select></div>
      <div><label htmlFor="history-status" className="mb-2 block text-xs font-semibold text-text-muted">Status</label><select id="history-status" className="field w-full" value={status} onChange={event => { setStatus(event.target.value as NonNullable<HistoryListParams["status"]> | ""); setPage(0); }}><option value="">All statuses</option>{["editing", "needs_review", "finalized", "generating", "failed"].map(value => <option value={value} key={value}>{statusLabel(value)}</option>)}</select></div>
      <div><label htmlFor="history-sort" className="mb-2 block text-xs font-semibold text-text-muted">Sort by</label><select id="history-sort" className="field w-full" value={sort} onChange={event => { setSort(event.target.value as "newest" | "oldest"); setPage(0); }}><option value="newest">Newest first</option><option value="oldest">Oldest first</option></select></div>
    </section>
    {loading ? <div data-motion="panel" role="status" className="paper flex min-h-56 items-center justify-center gap-3 p-8 text-text-muted"><Loader2 className="animate-spin" size={20} /> Loading your archive…</div> : error ? <div data-motion="panel" role="alert" className="paper space-y-4 p-8"><h2 className="font-serif text-2xl">Your archive couldn’t load.</h2><p className="text-sm leading-6 text-text-muted">{error}</p><button className="btn-secondary" onClick={() => setRevision(value => value + 1)}>Try again</button></div> : items.length === 0 ? <div key={filtered ? "filtered-empty" : "archive-empty"} data-motion="panel" className="empty-state paper py-16"><div aria-hidden="true" className="mx-auto mb-6 h-px w-12 bg-primary/40" /><FileText className="mx-auto mb-5 text-primary" size={28} /><h2 className="font-serif text-2xl text-text-display">{filtered ? "No matching ideas yet." : "A fresh page awaits."}</h2><p className="mx-auto mt-3 max-w-sm text-sm leading-6 text-text-muted">{filtered ? "Try another phrase or adjust your filters to find what you’re looking for." : "Your generated drafts will appear here, ready whenever you want to return."}</p><button className="btn-secondary mt-6" onClick={filtered ? reset : onBack}>{filtered ? "Clear filters" : "Back to workspace"}</button></div> : <div>
      {items.map((item, index) => {
        const draft = selectedDraft[item.generation_id] ?? item.active_draft_index ?? 1;
        const content = ([item.draft_1, item.draft_2, item.draft_3][draft - 1] || (draft === 1 ? item.preview : "")) ?? "";
        const hasContent = Boolean(content);
        const finalized = item.status === "finalized";
        return <Fragment key={item.generation_id}>
          {(index === 0 || monthLabel(items[index - 1].created_at) !== monthLabel(item.created_at)) && <h2 data-motion="heading" className="eyebrow mb-4 mt-8 flex items-center gap-4 first:mt-0 after:h-px after:flex-1 after:bg-border-subtle">{monthLabel(item.created_at)}</h2>}
          <article data-motion="panel" className="paper mb-4 overflow-hidden border-l-2 border-l-primary/25 p-6 sm:p-8"><div className="flex flex-wrap items-start justify-between gap-4"><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-3 text-xs"><span className="font-semibold text-primary">{item.platform === "x" ? "X" : item.platform === "linkedin" ? "LinkedIn" : item.platform}</span><span className={`rounded-full px-2.5 py-1 capitalize ${finalized ? "bg-primary/10 text-primary" : "bg-surface-subtle text-text-muted"}`}>{statusLabel(item.status)}</span></div><h3 className="mt-4 break-words font-serif text-xl leading-snug text-text-display sm:text-2xl">{item.topic || "Untitled generation"}</h3></div><time dateTime={item.created_at ?? undefined} className="pt-1 text-xs text-text-muted">{dateLabel(item.created_at)}</time></div>
            <div className="mt-5 flex flex-wrap gap-2" aria-label={`Drafts for ${item.topic}`}>{([1, 2, 3] as const).map(number => {
              const available = Boolean([item.draft_1 || item.preview, item.draft_2, item.draft_3][number - 1]);
              return <button key={number} className={`min-h-10 rounded-lg border px-3 text-xs transition-colors ${draft === number ? "border-primary/30 bg-primary/10 text-primary" : "border-border-subtle text-text-muted"}`} aria-pressed={draft === number} disabled={!available} onClick={() => setSelectedDraft(previous => ({ ...previous, [item.generation_id]: number }))}>Draft {number}{finalized ? number === item.active_draft_index ? " · Finalized" : " · Locked" : ""}</button>;
            })}</div>
            <p className="mt-5 max-w-3xl whitespace-pre-line text-sm leading-7 text-text-muted line-clamp-3">{hasContent ? stripMarkdown(content) : item.status === "failed" ? "This generation didn’t produce a saved draft." : item.status === "generating" ? "This generation is still being prepared." : "No saved content for this draft."}</p>
            <footer className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-border-subtle pt-5"><button className="icon-button text-text-muted" aria-label={`Delete ${item.topic || "untitled generation"}`} disabled={item.status === "generating"} onClick={() => { setDeletingItem(item); setDeleteError(""); }}><Trash2 size={17} /></button><div className="flex flex-wrap gap-3"><button className="btn-secondary" disabled={!hasContent} onClick={() => { setPreviewDraft(draft); setPreview(item); }}><Eye size={16} /> Preview</button><button className="btn-primary" disabled={!hasContent} onClick={() => onOpen(item.generation_id, draft)}>{finalized ? "View draft" : "Continue writing"}<ArrowRight size={16} /></button></div></footer>
          </article>
        </Fragment>;
      })}
      <nav data-motion="panel" aria-label="Archive pagination" className="mt-8 flex flex-wrap items-center justify-between gap-4"><p className="text-sm tabular-nums text-text-muted">{page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, total)} of {total.toLocaleString()}</p><div className="flex items-center gap-4"><button className="btn-secondary" aria-label="Previous page" disabled={page === 0} onClick={() => setPage(value => value - 1)}><ChevronLeft size={16} /> Previous</button><span className="text-xs text-text-muted">{page + 1} / {pages}</span><button className="btn-secondary" aria-label="Next page" disabled={page + 1 >= pages} onClick={() => setPage(value => value + 1)}>Next <ChevronRight size={16} /></button></div></nav>
    </div>}
    <DraftPreviewModal isOpen={Boolean(preview)} onClose={() => setPreview(null)} item={preview} initialDraftIndex={previewDraft} onOpenInEditor={onOpen} />
    <Dialog open={Boolean(deletingItem)} onOpenChange={open => { if (!open && !deleting) setDeletingItem(null); }}><DialogContent><DialogHeader><DialogTitle>Delete this generation?</DialogTitle><DialogDescription>“{deletingItem?.topic || "Untitled generation"}”, its drafts and conversation will be permanently removed. Your learned voice preferences are kept.</DialogDescription></DialogHeader>{deleteError && <p role="alert" className="text-sm text-red-700 dark:text-red-300">{deleteError}</p>}<DialogFooter><button className="btn-secondary" disabled={deleting} onClick={() => setDeletingItem(null)}>Keep generation</button><button className="btn-primary" disabled={deleting} onClick={() => void remove()}>{deleting ? "Deleting…" : "Delete generation"}</button></DialogFooter></DialogContent></Dialog>
  </div>;
}
