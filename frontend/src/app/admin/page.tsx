"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Shield,
  ShieldAlert,
  ShieldCheck,
  Users,
  Sparkles,
  Search,
  Eye,
  RefreshCw,
  ArrowLeft,
  Calendar,
  X,
  Lock,
  Share2,
  Copy,
  Check,
} from "lucide-react";
import { toast } from "sonner";
import {
  getAdminStats,
  getAdminUsers,
  getUserGenerations,
  type AdminStats,
  type AdminUserItem,
  type AdminGenerationItem,
} from "@/lib/api/admin";
import { ApiError } from "@/lib/api/client";

function relativeTime(iso: string | null): string {
  if (!iso) return "Never";
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "Just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d === 1) return "Yesterday";
  if (d < 7) return `${d}d ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function AdminPage() {
  const router = useRouter();

  // Auth / Permission state
  const [isAuthorized, setIsAuthorized] = useState<boolean | null>(null);
  const [authError, setAuthError] = useState<string>("");

  // Data state
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [users, setUsers] = useState<AdminUserItem[]>([]);
  const [totalUsers, setTotalUsers] = useState<number>(0);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);

  // Inspector Drawer / Modal state
  const [selectedUser, setSelectedUser] = useState<AdminUserItem | null>(null);
  const [userGenerations, setUserGenerations] = useState<AdminGenerationItem[]>([]);
  const [isLoadingGenerations, setIsLoadingGenerations] = useState<boolean>(false);
  const [activeDraftTabs, setActiveDraftTabs] = useState<Record<string, number>>({});
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const loadDashboardData = useCallback(async (query: string = "") => {
    try {
      setIsLoading(true);
      const [statsData, usersData] = await Promise.all([
        getAdminStats(),
        getAdminUsers({ q: query, limit: 50 }),
      ]);
      setStats(statsData);
      setUsers(usersData.items);
      setTotalUsers(usersData.total);
      setIsAuthorized(true);
    } catch (err: unknown) {
      if (err instanceof ApiError && (err.status === 403 || err.status === 401)) {
        setIsAuthorized(false);
        setAuthError(
          err.status === 401
            ? "Authentication required. Please log in with an administrator account."
            : "Access Denied: You do not have administrator privileges to view this console."
        );
      } else {
        const message = err instanceof Error ? err.message : "Failed to load admin data.";
        toast.error(message);
      }
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      getAdminStats(),
      getAdminUsers({ q: "", limit: 50 }),
    ])
      .then(([statsData, usersData]) => {
        if (!cancelled) {
          setStats(statsData);
          setUsers(usersData.items);
          setTotalUsers(usersData.total);
          setIsAuthorized(true);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          if (err instanceof ApiError && (err.status === 403 || err.status === 401)) {
            setIsAuthorized(false);
            setAuthError(
              err.status === 401
                ? "Authentication required. Please log in with an administrator account."
                : "Access Denied: You do not have administrator privileges to view this console."
            );
          } else {
            const message = err instanceof Error ? err.message : "Failed to load admin data.";
            toast.error(message);
          }
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoading(false);
          setIsRefreshing(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Search debounce - only runs when authorized and search query is updated
  useEffect(() => {
    if (isAuthorized !== true) return;
    const timer = setTimeout(() => {
      loadDashboardData(searchQuery);
    }, 350);
    return () => clearTimeout(timer);
  }, [searchQuery, isAuthorized, loadDashboardData]);

  const handleInspectUser = async (user: AdminUserItem) => {
    setSelectedUser(user);
    setIsLoadingGenerations(true);
    try {
      const data = await getUserGenerations(user.id, 50, 0);
      setUserGenerations(data.items);
      toast.info(`Logged audit trail for inspecting @${user.username}'s posts`);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to load user content.";
      toast.error(message);
    } finally {
      setIsLoadingGenerations(false);
    }
  };

  const handleCopyText = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    toast.success("Draft copied to clipboard");
    setTimeout(() => setCopiedId(null), 2000);
  };

  // 1. Loading Skeleton Screen
  if (isAuthorized === null && isLoading) {
    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center p-6">
        <div className="flex flex-col items-center gap-4 text-center max-w-sm">
          <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center animate-pulse">
            <Shield className="w-6 h-6 text-primary animate-spin" />
          </div>
          <div className="space-y-1">
            <h3 className="font-semibold text-base">Verifying Administrator Access</h3>
            <p className="text-sm text-muted-foreground">Checking cryptographic credentials...</p>
          </div>
        </div>
      </div>
    );
  }

  // 2. Access Denied Screen (401 / 403)
  if (isAuthorized === false) {
    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center p-6">
        <div className="max-w-md w-full rounded-2xl border border-destructive/20 bg-card p-8 shadow-xl text-center space-y-6">
          <div className="mx-auto w-14 h-14 rounded-2xl bg-destructive/10 flex items-center justify-center">
            <ShieldAlert className="w-7 h-7 text-destructive" />
          </div>
          <div className="space-y-2">
            <h2 className="text-xl font-bold tracking-tight">Restricted Console</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">{authError}</p>
          </div>
          <div className="rounded-xl border border-border/60 bg-muted/40 p-4 text-xs text-muted-foreground text-left space-y-1.5">
            <div className="flex items-center gap-1.5 font-medium text-foreground">
              <Lock className="w-3.5 h-3.5 text-primary" />
              <span>Operator Safeguard</span>
            </div>
            <p>
              This area is restricted to operators via role-based access control. All access
              attempts and administrative queries are cryptographically verified and recorded.
            </p>
          </div>
          <div className="pt-2">
            <button
              onClick={() => router.push("/")}
              className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors shadow-sm"
            >
              <ArrowLeft className="w-4 h-4" />
              Return to PostCraft AI
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 3. Authorized Admin Console
  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Top Bar */}
      <header className="sticky top-0 z-30 border-b border-border/80 bg-background/85 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
              <ShieldCheck className="w-5 h-5 text-primary" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-base tracking-tight">PostCraft AI</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-primary/15 text-primary font-semibold tracking-wide uppercase">
                  Operator Admin
                </span>
              </div>
              <p className="text-xs text-muted-foreground">Audited Management Console</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                setIsRefreshing(true);
                loadDashboardData(searchQuery);
              }}
              disabled={isRefreshing}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-border bg-card hover:bg-muted/60 transition-colors text-muted-foreground hover:text-foreground"
              title="Refresh metrics"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? "animate-spin" : ""}`} />
              <span>Refresh</span>
            </button>
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium rounded-lg bg-muted hover:bg-muted/80 transition-colors text-foreground"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Back to App
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Metric Cards Grid */}
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1: Users */}
          <div className="rounded-2xl border border-border/70 bg-card p-5 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Total Users
              </span>
              <div className="w-8 h-8 rounded-lg bg-blue-500/10 text-blue-500 flex items-center justify-center">
                <Users className="w-4 h-4" />
              </div>
            </div>
            <div>
              <div className="text-3xl font-extrabold tracking-tight">
                {stats?.users.total.toLocaleString() ?? "—"}
              </div>
              <p className="text-xs text-muted-foreground mt-1">Real database registered accounts</p>
            </div>
            <div className="pt-2 border-t border-border/50 flex items-center justify-between text-xs text-muted-foreground">
              <span>+{(stats?.users.signups_last_24h ?? 0)} in 24h</span>
              <span>+{(stats?.users.signups_last_7d ?? 0)} in 7d</span>
              <span>+{(stats?.users.signups_last_30d ?? 0)} in 30d</span>
            </div>
          </div>

          {/* Card 2: Generations */}
          <div className="rounded-2xl border border-border/70 bg-card p-5 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Total Generations
              </span>
              <div className="w-8 h-8 rounded-lg bg-purple-500/10 text-purple-500 flex items-center justify-center">
                <Sparkles className="w-4 h-4" />
              </div>
            </div>
            <div>
              <div className="text-3xl font-extrabold tracking-tight">
                {stats?.generations.total.toLocaleString() ?? "—"}
              </div>
              <p className="text-xs text-muted-foreground mt-1">Multi-draft AI pipelines executed</p>
            </div>
            <div className="pt-2 border-t border-border/50 flex items-center justify-between text-xs text-muted-foreground">
              <span>{(stats?.generations.generations_last_24h ?? 0)} in 24h</span>
              <span>{(stats?.generations.generations_last_7d ?? 0)} in 7d</span>
              <span>{(stats?.generations.generations_last_30d ?? 0)} in 30d</span>
            </div>
          </div>

          {/* Card 3: Platform Breakdown */}
          <div className="rounded-2xl border border-border/70 bg-card p-5 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Platform Breakdown
              </span>
              <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
                <Share2 className="w-4 h-4" />
              </div>
            </div>
            <div className="space-y-2 pt-1">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">LinkedIn</span>
                <span className="font-semibold">{stats?.generations.platform_breakdown.linkedin ?? 0}</span>
              </div>
              <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden">
                <div
                  className="bg-blue-600 h-full rounded-full transition-all"
                  style={{
                    width: `${
                      stats?.generations.total
                        ? Math.round(
                            ((stats.generations.platform_breakdown.linkedin ?? 0) /
                              stats.generations.total) *
                              100
                          )
                        : 0
                    }%`,
                  }}
                />
              </div>
              <div className="flex items-center justify-between text-sm pt-1">
                <span className="text-muted-foreground">X / Twitter</span>
                <span className="font-semibold">{stats?.generations.platform_breakdown.x ?? 0}</span>
              </div>
              <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden">
                <div
                  className="bg-zinc-400 dark:bg-zinc-600 h-full rounded-full transition-all"
                  style={{
                    width: `${
                      stats?.generations.total
                        ? Math.round(
                            ((stats.generations.platform_breakdown.x ?? 0) /
                              stats.generations.total) *
                              100
                          )
                        : 0
                    }%`,
                  }}
                />
              </div>
            </div>
          </div>

          {/* Card 4: Audit & Security */}
          <div className="rounded-2xl border border-border/70 bg-card p-5 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Security & Audit
              </span>
              <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-500 flex items-center justify-center">
                <Lock className="w-4 h-4" />
              </div>
            </div>
            <div>
              <div className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
                Immutable Logging Active
              </div>
              <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
                User post inspections write un-deletable audit records to Postgres table{" "}
                <code className="px-1 py-0.5 rounded bg-muted font-mono text-[10px]">
                  admin_audit_logs
                </code>
                .
              </p>
            </div>
            <div className="pt-2 border-t border-border/50 text-[11px] text-muted-foreground">
              Passlib Argon2id + Fernet PII Encryption
            </div>
          </div>
        </section>

        {/* User Management Section */}
        <section className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold tracking-tight">Platform Users</h2>
              <p className="text-xs text-muted-foreground">
                Showing {users.length} of {totalUsers} registered accounts
              </p>
            </div>

            {/* Search Input */}
            <div className="relative w-full sm:w-72">
              <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by username..."
                className="w-full rounded-xl border border-border bg-card pl-9 pr-4 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground hover:text-foreground"
                >
                  Clear
                </button>
              )}
            </div>
          </div>

          {/* Users Table */}
          <div className="rounded-2xl border border-border/80 bg-card overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/40 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    <th className="px-5 py-3.5">User</th>
                    <th className="px-5 py-3.5">Role</th>
                    <th className="px-5 py-3.5">Signed Up</th>
                    <th className="px-5 py-3.5 text-center">Posts Generated</th>
                    <th className="px-5 py-3.5">Last Active</th>
                    <th className="px-5 py-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {users.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-5 py-10 text-center text-sm text-muted-foreground">
                        {searchQuery ? `No users matching "${searchQuery}"` : "No users found."}
                      </td>
                    </tr>
                  ) : (
                    users.map((user) => (
                      <tr
                        key={user.id}
                        className="hover:bg-muted/30 transition-colors group"
                      >
                        <td className="px-5 py-4">
                          <div className="font-semibold text-foreground">@{user.username}</div>
                          <div className="text-[11px] font-mono text-muted-foreground truncate max-w-[180px]">
                            {user.id}
                          </div>
                        </td>
                        <td className="px-5 py-4">
                          {user.is_admin ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-primary/15 text-primary border border-primary/20">
                              <ShieldCheck className="w-3 h-3" />
                              Admin
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs text-muted-foreground bg-muted">
                              Member
                            </span>
                          )}
                        </td>
                        <td className="px-5 py-4 text-xs text-muted-foreground whitespace-nowrap">
                          {formatDate(user.created_at)}
                        </td>
                        <td className="px-5 py-4 text-center">
                          <span
                            className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-semibold ${
                              user.generation_count > 0
                                ? "bg-primary/10 text-primary"
                                : "bg-muted text-muted-foreground"
                            }`}
                          >
                            {user.generation_count}
                          </span>
                        </td>
                        <td className="px-5 py-4 text-xs text-muted-foreground whitespace-nowrap">
                          {relativeTime(user.last_active_at)}
                        </td>
                        <td className="px-5 py-4 text-right">
                          <button
                            onClick={() => handleInspectUser(user)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-muted hover:bg-primary hover:text-primary-foreground transition-all text-foreground"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>View Posts</span>
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      </main>

      {/* Generation Inspector Drawer / Modal */}
      {selectedUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-end bg-background/80 backdrop-blur-sm animate-in fade-in-0">
          <div
            className="w-full max-w-2xl h-full bg-card border-l border-border shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-right duration-200"
            role="dialog"
            aria-modal="true"
          >
            {/* Modal Header */}
            <div className="p-6 border-b border-border flex items-start justify-between bg-muted/20">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-lg">@{selectedUser.username}&apos;s Posts</h3>
                  {selectedUser.is_admin && (
                    <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-primary/20 text-primary uppercase">
                      Admin
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground font-mono truncate max-w-md">
                  User ID: {selectedUser.id}
                </p>
              </div>
              <button
                onClick={() => {
                  setSelectedUser(null);
                  setUserGenerations([]);
                }}
                className="w-8 h-8 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted flex items-center justify-center transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Audit Notice */}
            <div className="px-6 py-2.5 bg-amber-500/10 border-b border-amber-500/20 text-amber-700 dark:text-amber-400 text-xs flex items-center gap-2">
              <Lock className="w-3.5 h-3.5 shrink-0" />
              <span>
                Administrative view logged: an audit trail record has been committed to{" "}
                <code className="font-mono text-[10px]">admin_audit_logs</code>.
              </span>
            </div>

            {/* Generations List */}
            <div className="flex-1 overflow-y-auto p-6 space-y-5">
              {isLoadingGenerations ? (
                <div className="py-20 flex flex-col items-center justify-center gap-3 text-muted-foreground">
                  <RefreshCw className="w-6 h-6 animate-spin text-primary" />
                  <span className="text-sm">Fetching user post history...</span>
                </div>
              ) : userGenerations.length === 0 ? (
                <div className="py-20 text-center text-muted-foreground space-y-2">
                  <Sparkles className="w-8 h-8 mx-auto opacity-30" />
                  <p className="text-sm">This user has not created any generations yet.</p>
                </div>
              ) : (
                userGenerations.map((gen) => {
                  const currentDraft = activeDraftTabs[gen.generation_id] ?? (gen.active_draft_index || 1);
                  const draftText =
                    currentDraft === 1
                      ? gen.draft_1
                      : currentDraft === 2
                      ? gen.draft_2
                      : gen.draft_3;

                  return (
                    <div
                      key={gen.generation_id}
                      className="rounded-xl border border-border/80 bg-card p-5 shadow-sm space-y-3"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <span
                              className={`text-[11px] font-semibold px-2 py-0.5 rounded uppercase tracking-wide ${
                                gen.platform === "linkedin"
                                  ? "bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20"
                                  : "bg-zinc-500/10 text-zinc-700 dark:text-zinc-300 border border-zinc-500/20"
                              }`}
                            >
                              {gen.platform === "x" ? "X / Twitter" : "LinkedIn"}
                            </span>
                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                              <Calendar className="w-3 h-3" />
                              {formatDate(gen.created_at)}
                            </span>
                          </div>
                          <h4 className="font-bold text-base mt-2 text-foreground">{gen.topic}</h4>
                        </div>
                        <span
                          className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${
                            gen.status === "finalized"
                              ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                              : "bg-muted text-muted-foreground"
                          }`}
                        >
                          {gen.status}
                        </span>
                      </div>

                      {/* Raw Thoughts */}
                      {gen.raw_thoughts && (
                        <div className="rounded-lg bg-muted/40 p-3 text-xs text-muted-foreground border border-border/50">
                          <span className="font-semibold text-foreground">Raw Thoughts: </span>
                          {gen.raw_thoughts}
                        </div>
                      )}

                      {/* Draft Tabs */}
                      <div className="pt-2 border-t border-border/60 space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1">
                            {[1, 2, 3].map((dNum) => (
                              <button
                                key={dNum}
                                onClick={() =>
                                  setActiveDraftTabs((prev) => ({
                                    ...prev,
                                    [gen.generation_id]: dNum,
                                  }))
                                }
                                className={`px-2.5 py-1 text-xs rounded-md font-medium transition-colors ${
                                  currentDraft === dNum
                                    ? "bg-primary text-primary-foreground font-semibold shadow-xs"
                                    : "bg-muted text-muted-foreground hover:text-foreground"
                                }`}
                              >
                                Draft {dNum}
                                {gen.active_draft_index === dNum && " ★"}
                              </button>
                            ))}
                          </div>

                          {draftText && (
                            <button
                              onClick={() => handleCopyText(draftText, gen.generation_id)}
                              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs text-muted-foreground hover:text-foreground rounded-md hover:bg-muted transition-colors"
                              title="Copy draft"
                            >
                              {copiedId === gen.generation_id ? (
                                <>
                                  <Check className="w-3 h-3 text-emerald-500" />
                                  <span className="text-emerald-500">Copied</span>
                                </>
                              ) : (
                                <>
                                  <Copy className="w-3 h-3" />
                                  <span>Copy</span>
                                </>
                              )}
                            </button>
                          )}
                        </div>

                        <div className="rounded-lg bg-muted/25 border border-border/50 p-4 text-xs font-mono whitespace-pre-wrap leading-relaxed max-h-60 overflow-y-auto text-foreground/90">
                          {draftText || <span className="text-muted-foreground italic">Draft not generated.</span>}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
