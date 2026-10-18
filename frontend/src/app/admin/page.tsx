"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, ShieldCheck, ShieldAlert, RefreshCw, Search, Eye, Copy, Check, Lock } from "lucide-react";
import { toast } from "sonner";
import { getAdminStats, getAdminAuditLogs, getAdminUsers, getUserGenerations, type AuditEntry, type AdminStats, type AdminUserItem, type AdminGenerationItem } from "@/lib/api/admin";
import { ApiError, fetchApi } from "@/lib/api/client";
import { Brand } from "@/components/layout/brand";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { MotionScene } from "@/components/motion/motion-scene";
import { PageHeading } from "@/components/layout/page-heading";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";

type Costs = { total_prompt_tokens: number; total_completion_tokens: number; total_cost_usd: number; breakdown: Record<string, number> };
const messageOf = (error: unknown, fallback: string) => error instanceof Error ? error.message : fallback;
const money = (value: number) => `$${value.toFixed(4)}`;
function formatDate(iso: string | null) {
  return iso ? new Date(iso).toLocaleString(undefined, { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—";
}

export default function AdminPage() {
  const [authorized, setAuthorized] = useState<boolean | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [refresh, setRefresh] = useState(0);
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [costs, setCosts] = useState<Costs | null>(null);
  const [costError, setCostError] = useState("");
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState("");
  const [users, setUsers] = useState<AdminUserItem[]>([]);
  const [offset, setOffset] = useState(0);
  const [total, setTotal] = useState(0);
  const [audits, setAudits] = useState<AuditEntry[]>([]);
  const [auditTotal, setAuditTotal] = useState(0);
  const [auditError, setAuditError] = useState("");
  const [auditLoading, setAuditLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState<AdminUserItem | null>(null);
  const [generations, setGenerations] = useState<AdminGenerationItem[]>([]);
  const [generationTotal, setGenerationTotal] = useState(0);
  const [generationOffset, setGenerationOffset] = useState(0);
  const [inspectionLoading, setInspectionLoading] = useState(false);
  const [inspectionError, setInspectionError] = useState("");
  const [inspectionRetry, setInspectionRetry] = useState(0);
  const [tabs, setTabs] = useState<Record<string, number>>({});
  const [copied, setCopied] = useState<string | null>(null);
  const opener = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => { setSearch(query); setOffset(0); }, 350);
    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true); setError("");
      try {
        const [summary, accounts] = await Promise.all([getAdminStats(), getAdminUsers({ q: search, offset, limit: 50 })]);
        if (cancelled) return;
        setStats(summary); setUsers(accounts.items); setTotal(accounts.total); setAuthorized(true);
      } catch (err) {
        if (cancelled) return;
        if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
          setAuthorized(false); setStats(null); setUsers([]); setCosts(null); setSelectedUser(null);
          setError(err.status === 401 ? "Sign in with an administrator account to continue." : "Your account does not have administrator access.");
        } else setError(messageOf(err, "Could not load the console."));
      } finally { if (!cancelled) setLoading(false); }
    }
    void load();
    return () => { cancelled = true; };
  }, [search, offset, refresh]);

  useEffect(() => {
    if (!authorized) return;
    let cancelled = false;
    fetchApi<Costs>("/api/admin/cost-summary").then(data => { if (!cancelled) { setCosts(data); setCostError(""); } }).catch(err => { if (!cancelled) setCostError(messageOf(err, "Cost summary unavailable.")); });
    getAdminAuditLogs().then(data => { if (!cancelled) { setAudits(data.items); setAuditTotal(data.total); setAuditError(""); } }).catch(err => { if (!cancelled) setAuditError(messageOf(err, "Audit log unavailable.")); }).finally(() => { if (!cancelled) setAuditLoading(false); });
    return () => { cancelled = true; };
  }, [authorized, refresh]);

  useEffect(() => {
    if (!selectedUser) return;
    let cancelled = false;
    getUserGenerations(selectedUser.id, 20, generationOffset).then(data => {
      if (!cancelled) { setGenerations(data.items); setGenerationTotal(data.total); }
    }).catch(err => { if (!cancelled) setInspectionError(messageOf(err, "Could not load this user’s posts.")); }).finally(() => { if (!cancelled) setInspectionLoading(false); });
    return () => { cancelled = true; };
  }, [selectedUser, generationOffset, inspectionRetry]);

  function prepareInspection() {
    setInspectionLoading(true); setInspectionError(""); setGenerations([]); setTabs({});
  }

  async function moreAudits() {
    if (auditLoading) return;
    setAuditLoading(true); setAuditError("");
    try {
      const data = await getAdminAuditLogs(audits.length);
      setAudits(previous => [...previous, ...data.items.filter(item => !previous.some(existing => existing.id === item.id))]); setAuditTotal(data.total);
    } catch (err) { setAuditError(messageOf(err, "Could not load more audit records.")); }
    finally { setAuditLoading(false); }
  }
  async function copy(text: string, id: string) {
    try { await navigator.clipboard.writeText(text); setCopied(id); toast.success("Draft copied to clipboard"); }
    catch { toast.error("Could not copy. Select the draft text and copy it manually."); }
  }

  const header = <header className="border-b border-border-subtle bg-surface-card"><div className="max-w-7xl mx-auto px-5 sm:px-8 py-5 flex flex-wrap items-center justify-between gap-4"><Link href="/" aria-label="PostCraft home"><Brand /></Link><div className="flex items-center gap-3"><span className="hidden sm:inline-flex items-center gap-2 text-xs text-text-muted"><ShieldCheck size={15} />Administration</span><ThemeToggle /><Link href="/" className="icon-button hidden sm:inline-flex" aria-label="Back to app"><ArrowLeft size={18} /></Link></div></div></header>;
  if (authorized === false) return <MotionScene scene="admin"><div className="min-h-screen bg-canvas-base text-text-display">{header}<main className="max-w-xl mx-auto px-6 py-24"><div data-motion="panel" className="paper p-8 sm:p-10"><ShieldAlert className="text-primary mb-6" size={32} /><PageHeading eyebrow="ADMINISTRATION" title="Restricted console" description={error} /><p className="text-sm text-text-muted leading-relaxed mb-7">Administrative data is available only to accounts with the operator role. Access is checked by the server.</p><Link href="/" className="btn-primary"><ArrowLeft size={16} />Return to PostCraft</Link></div></main></div></MotionScene>;
  if (authorized === null) return <MotionScene scene="admin"><div className="min-h-screen bg-canvas-base text-text-display">{header}<main className="max-w-xl mx-auto px-6 py-24"><div data-motion="panel" className="paper p-10"><p className="eyebrow mb-5">ADMINISTRATION</p><h1 className="font-serif text-3xl mb-4">{loading ? "Opening the console…" : "The console is unavailable."}</h1>{loading ? <p role="status" className="text-text-muted text-sm">Verifying administrator access with the server.</p> : <><p role="alert" className="text-sm text-text-muted mb-6">{error}</p><button className="btn-primary" onClick={() => setRefresh(value => value + 1)}>Try again</button></>}</div></main></div></MotionScene>;

  return <MotionScene scene="admin"><div className="min-h-screen bg-canvas-base text-text-display">{header}
    <main className="max-w-7xl mx-auto px-5 sm:px-8 py-10 sm:py-14 space-y-8">
      <PageHeading eyebrow="ADMINISTRATION / OVERVIEW" title="The operator’s desk." description="A clear view of accounts, writing activity, and recorded access." action={<button className="btn-secondary" disabled={loading} onClick={() => setRefresh(value => value + 1)}><RefreshCw size={16} />{loading ? "Refreshing…" : "Refresh console"}</button>} />
      {error && <div className="paper p-5 border-error" role="alert"><p className="text-sm text-error">{error}</p><p className="text-xs text-text-muted mt-2">The last loaded data is still shown. Refresh to try again.</p></div>}

      <section aria-label="Platform overview" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div data-motion="panel" className="paper p-6"><p className="eyebrow">REGISTERED ACCOUNTS</p><p className="font-serif text-4xl mt-5 mb-4">{stats?.users.total.toLocaleString() ?? "—"}</p><div className="border-t border-border-subtle pt-4 grid grid-cols-3 gap-3 text-xs text-text-muted">{([['24h', stats?.users.signups_last_24h], ['7d', stats?.users.signups_last_7d], ['30d', stats?.users.signups_last_30d]] as const).map(([label, value]) => <p key={label}><strong className="block text-text-display font-medium mb-1">{value ?? "—"}</strong>{label} signups</p>)}</div></div>
        <div data-motion="panel" className="paper p-6"><p className="eyebrow">GENERATIONS</p><p className="font-serif text-4xl mt-5 mb-4">{stats?.generations.total.toLocaleString() ?? "—"}</p><div className="border-t border-border-subtle pt-4 grid grid-cols-3 gap-3 text-xs text-text-muted">{([['24h', stats?.generations.generations_last_24h], ['7d', stats?.generations.generations_last_7d], ['30d', stats?.generations.generations_last_30d]] as const).map(([label, value]) => <p key={label}><strong className="block text-text-display font-medium mb-1">{value ?? "—"}</strong>in {label}</p>)}</div></div>
        <div data-motion="panel" className="paper p-6"><p className="eyebrow mb-6">BY PLATFORM</p>{(['linkedin', 'x'] as const).map(platform => <div key={platform} className="mb-5 last:mb-0"><div className="flex justify-between text-sm mb-3"><span>{platform === 'x' ? 'X' : 'LinkedIn'}</span><strong className="font-medium">{stats?.generations.platform_breakdown[platform] ?? 0}</strong></div><div className="h-1 rounded bg-surface-container overflow-hidden" aria-hidden="true"><div data-motion="bar" className="h-full origin-left bg-primary" style={{ width: `${Math.min(100, stats?.generations.total ? (stats.generations.platform_breakdown[platform] ?? 0) / stats.generations.total * 100 : 0)}%` }} /></div></div>)}</div>
        <div data-motion="panel" className="paper p-6"><p className="eyebrow">ESTIMATED MODEL COST</p><p className="font-serif text-4xl mt-5 mb-4">{costs ? money(costs.total_cost_usd) : "—"}</p><p className="text-xs text-text-muted leading-relaxed">Recorded estimates across model operations. This is not an invoice.</p>{costError && <p role="alert" className="text-xs text-error mt-3">{costError}</p>}</div>
      </section>

      <section data-motion="panel" aria-labelledby="admin-users-heading" className="paper overflow-hidden">
        <div className="p-6 sm:p-7 border-b border-border-subtle flex flex-wrap items-end justify-between gap-5"><div><p className="eyebrow mb-2">THE DIRECTORY</p><h2 id="admin-users-heading" className="font-serif text-2xl">Platform users</h2><p className="text-xs text-text-muted mt-2">{total.toLocaleString()} {search ? 'matching' : 'registered'} accounts</p></div><div className="relative w-full sm:w-72"><label htmlFor="admin-user-search" className="sr-only">Search users</label><Search className="absolute left-3 top-3.5 text-text-muted" size={16} /><input id="admin-user-search" className="field w-full pl-10 pr-14" placeholder="Search by username…" value={query} onChange={event => setQuery(event.target.value)} />{query && <button className="absolute right-3 top-3 text-xs text-primary min-h-6" onClick={() => setQuery('')}>Clear</button>}</div></div>
        <p className="sm:hidden px-6 pt-4 text-[11px] text-text-muted">Scroll the table to view activity and inspect posts →</p><div className="overflow-x-auto" tabIndex={0} role="region" aria-label="User directory table" aria-busy={loading}>
          <table className="w-full text-left text-sm min-w-[760px]"><caption className="sr-only">Registered users and their generation activity</caption><thead className="bg-surface-subtle text-text-muted text-[10px] uppercase tracking-wider"><tr>{['User', 'Role', 'Joined', 'Generations', 'Last activity', 'Inspection'].map(label => <th key={label} scope="col" className="px-6 py-4 font-medium">{label}</th>)}</tr></thead><tbody className="divide-y divide-border-subtle">{users.map(user => <tr key={user.id} className="transition-colors hover:bg-surface-subtle focus-within:bg-surface-subtle"><th scope="row" className="px-6 py-5 text-left font-normal"><span className="font-semibold">@{user.username}</span><span className="block text-[10px] text-text-muted font-mono mt-1 break-all max-w-48">{user.id}</span></th><td className="px-6 py-5"><span className="text-xs rounded-full border border-border-subtle px-2.5 py-1">{user.is_admin ? 'Administrator' : 'Member'}</span></td><td className="px-6 py-5 text-xs text-text-muted whitespace-nowrap">{formatDate(user.created_at)}</td><td className="px-6 py-5 tabular-nums">{user.generation_count}</td><td className="px-6 py-5 text-xs text-text-muted whitespace-nowrap">{formatDate(user.last_active_at)}</td><td className="px-6 py-5"><button className="btn-secondary whitespace-nowrap text-xs" aria-label={`View posts for @${user.username}`} onClick={event => { opener.current = event.currentTarget; prepareInspection(); setGenerationOffset(0); setSelectedUser(user); setCopied(null); }}><Eye size={14} />View posts</button></td></tr>)}{!users.length && <tr><td colSpan={6} className="px-6 py-12 text-center text-text-muted">{loading ? 'Loading users…' : search ? `No users match “${search}”.` : 'No registered users.'}</td></tr>}</tbody></table>
        </div>
        <div className="flex flex-wrap justify-between items-center gap-4 p-5 border-t border-border-subtle text-xs text-text-muted"><span role="status">{loading ? 'Loading…' : `${total ? offset + 1 : 0}–${offset + users.length} of ${total}`}</span><div className="flex gap-2"><button className="btn-secondary text-xs" disabled={offset === 0 || loading} onClick={() => setOffset(value => Math.max(0, value - 50))}>Previous users</button><button className="btn-secondary text-xs" disabled={offset + 50 >= total || loading} onClick={() => setOffset(value => value + 50)}>Next users<ArrowRight size={13} /></button></div></div>
      </section>

      <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr] items-start">
        <section data-motion="panel" className="paper p-6 sm:p-7 min-w-0" aria-labelledby="admin-audit-heading"><p className="eyebrow mb-2">RECORDED ACCESS</p><h2 id="admin-audit-heading" className="font-serif text-2xl">Administrative audit log</h2><p className="text-xs text-text-muted mt-3 mb-6 leading-relaxed">Server-recorded access and inspection events. {auditTotal.toLocaleString()} records available.</p>{auditError && <p role="alert" className="text-sm text-error mb-4">{auditError}</p>}<div className="divide-y divide-border-subtle">{audits.map(entry => <article key={entry.id} data-motion="panel" className="py-4 first:pt-0"><div className="flex flex-wrap justify-between gap-2"><h3 className="text-sm font-medium break-all">{entry.action}</h3><time className="text-xs text-text-muted" dateTime={entry.created_at}>{formatDate(entry.created_at)}</time></div><p className="text-xs text-text-muted mt-2 break-all">Actor: {entry.admin_user_id || 'CLI / deleted account'}{entry.target_user_id && <> · Target: {entry.target_user_id}</>}</p></article>)}</div>{!audits.length && !auditError && <p role="status" className="text-sm text-text-muted py-5">{auditLoading ? 'Loading audit records…' : 'No audit records available.'}</p>}{audits.length < auditTotal && <button className="btn-secondary mt-4" disabled={auditLoading} onClick={() => void moreAudits()}>{auditLoading ? 'Loading…' : 'Load more audit records'}</button>}{auditError && !audits.length && <button className="btn-secondary" onClick={() => setRefresh(value => value + 1)}>Retry audit log</button>}</section>
        <section data-motion="panel" className="paper p-6 sm:p-7" aria-labelledby="admin-cost-heading"><p className="eyebrow mb-2">MODEL OPERATIONS</p><h2 id="admin-cost-heading" className="font-serif text-2xl">Usage & estimates</h2>{costs ? <><dl className="grid grid-cols-2 gap-4 my-6"><div><dt className="text-xs text-text-muted mb-2">Prompt tokens</dt><dd className="text-xl tabular-nums">{costs.total_prompt_tokens.toLocaleString()}</dd></div><div><dt className="text-xs text-text-muted mb-2">Completion tokens</dt><dd className="text-xl tabular-nums">{costs.total_completion_tokens.toLocaleString()}</dd></div></dl><dl className="divide-y divide-border-subtle">{Object.entries(costs.breakdown).map(([operation, amount]) => <div key={operation} className="flex justify-between gap-4 py-3 text-sm"><dt className="break-all text-text-muted">{operation}</dt><dd className="tabular-nums">{money(amount)}</dd></div>)}</dl>{!Object.keys(costs.breakdown).length && <p className="text-sm text-text-muted">No model operations recorded.</p>}</> : <p className="text-sm text-text-muted mt-5">{costError || 'Loading recorded usage…'}</p>}<div className="border-t border-border-subtle mt-6 pt-5 flex gap-3 text-xs text-text-muted leading-relaxed"><Lock size={15} className="shrink-0 mt-0.5" /><p>User post inspections are recorded by the server. Private profile and background fields are not included in this console.</p></div></section>
      </div>
    </main>

    <Dialog open={!!selectedUser} onOpenChange={open => { if (!open) { setSelectedUser(null); setGenerations([]); } }}>
      <DialogContent className="max-w-3xl w-[calc(100%-24px)] max-h-[88svh] flex flex-col gap-0 p-0 overflow-hidden bg-surface-card text-text-display border-border-subtle" onCloseAutoFocus={event => { event.preventDefault(); opener.current?.focus(); }}>
        <div className="p-6 sm:p-8 border-b border-border-subtle pr-12"><p className="eyebrow mb-3">USER INSPECTION</p><DialogTitle className="font-serif text-2xl font-normal break-all">@{selectedUser?.username}’s posts</DialogTitle><DialogDescription className="mt-3 text-xs text-text-muted break-all">User ID: {selectedUser?.id}. Read-only access to generated posts and original writing inputs.</DialogDescription></div>
        <div className="overflow-y-auto min-h-0 p-5 sm:p-8 space-y-5 overscroll-contain">
          {inspectionLoading ? <p role="status" className="text-sm text-text-muted py-12 text-center">Loading user post history…</p> : inspectionError ? <div role="alert" className="py-8"><p className="text-sm text-error mb-5">{inspectionError}</p><button className="btn-secondary" onClick={() => { prepareInspection(); setInspectionRetry(value => value + 1); }}>Retry inspection</button></div> : <>
            <p className="text-xs text-text-muted flex gap-2 items-start"><ShieldCheck size={15} className="shrink-0" />This inspection was recorded in the administrative audit log.</p>
            {!generations.length && <p className="text-sm text-text-muted py-12 text-center">This user has not created any generations yet.</p>}
            {generations.map(gen => {
              const active = tabs[gen.generation_id] ?? (gen.active_draft_index || 1);
              const text = active === 1 ? gen.draft_1 : active === 2 ? gen.draft_2 : gen.draft_3;
              return <article key={gen.generation_id} className="border border-border-subtle rounded-xl p-5 sm:p-6 min-w-0"><div className="flex flex-wrap justify-between gap-3 text-xs text-text-muted"><span>{gen.platform === 'x' ? 'X' : gen.platform === 'linkedin' ? 'LinkedIn' : gen.platform} · {formatDate(gen.created_at)}</span><span className="capitalize">{gen.status}</span></div><h3 className="font-serif text-xl mt-4 break-words">{gen.topic}</h3>{gen.raw_thoughts && <details className="mt-4 border-y border-border-subtle py-3"><summary className="text-xs cursor-pointer text-text-muted">Original raw thoughts</summary><p className="mt-3 text-sm whitespace-pre-wrap break-words leading-relaxed">{gen.raw_thoughts}</p></details>}<div className="flex flex-wrap justify-between gap-2 items-center mt-5 mb-4"><div className="flex flex-wrap gap-1" aria-label={`Drafts for ${gen.topic}`}>{[1, 2, 3].map(index => <button key={index} aria-label={`Draft ${index}`} aria-pressed={active === index} onClick={() => { setTabs(previous => ({ ...previous, [gen.generation_id]: index })); setCopied(null); }} className={`rounded-md px-3 py-2.5 text-xs ${active === index ? 'bg-primary text-on-primary' : 'bg-surface-subtle text-text-muted'}`}>Draft {index}{gen.active_draft_index === index && <span aria-label="active draft"> ·</span>}</button>)}</div>{text && <button className="icon-button" aria-label="Copy draft" onClick={() => void copy(text, gen.generation_id)}>{copied === gen.generation_id ? <span data-motion="feedback"><Check size={16} /><span className="sr-only" role="status">Draft copied</span></span> : <Copy size={16} />}</button>}</div><div className="bg-surface-subtle border border-border-subtle rounded-lg p-5 text-sm leading-7 whitespace-pre-wrap break-words">{text || <span className="text-text-muted italic">Draft not generated.</span>}</div><p className="mt-4 text-[10px] text-text-muted break-all">Generation: {gen.generation_id}{gen.updated_at && <> · Updated {formatDate(gen.updated_at)}</>}</p></article>;
            })}
            {generationTotal > 20 && <div className="flex flex-wrap justify-between items-center gap-3 text-xs text-text-muted"><span>{generationOffset + 1}–{generationOffset + generations.length} of {generationTotal}</span><div className="flex gap-2"><button className="btn-secondary text-xs" disabled={!generationOffset} onClick={() => { prepareInspection(); setGenerationOffset(value => Math.max(0, value - 20)); }}>Previous posts</button><button className="btn-secondary text-xs" disabled={generationOffset + 20 >= generationTotal} onClick={() => { prepareInspection(); setGenerationOffset(value => value + 20); }}>Next posts</button></div></div>}
          </>}
        </div>
      </DialogContent>
    </Dialog>
  </div></MotionScene>;
}
