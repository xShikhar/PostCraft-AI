"use client";
import { useState, useEffect } from "react";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/features/auth/hooks/use-auth";
import { AuthScreen } from "@/features/auth/components/auth-screen";
import { AppShell } from "@/components/layout/app-shell";
import { hasDraftTransitionSource } from "@/components/motion/draft-transition";
import { MotionScene } from "@/components/motion/motion-scene";
import { HomeView } from "@/features/home/components/home-view";
import { GenerationForm } from "@/features/generation/components/generation-form";
import { DraftEditor } from "@/features/editor/components/draft-editor";
import { DraftSelectionGrid } from "@/features/editor/components/draft-selection-grid";
import { ProfilePage } from "@/features/profile/components/profile-page";
import { HistoryList } from "@/features/history/components/history-list";
import { LegalView } from "@/features/legal/legal-view";
import { renderMarkdown } from "@/lib/utils/markdown";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  useWorkspace,
  TITLES,
  draftKey,
} from "@/features/workspace/hooks/use-workspace";
function Loading() {
  return (
    <div
      role="status"
      className="min-h-[55vh] flex flex-col items-center justify-center gap-4 text-text-muted"
    >
      <Loader2 size={23} className="animate-spin text-primary" />
      <span className="text-xs">Opening your workspace…</span>
    </div>
  );
}
function Workspace() {
  const {
    setView,
    user,
    view,
    topic,
    setTopic,
    platform,
    setPlatform,
    rawThoughts,
    setRawThoughts,
    profileContext,
    setProfileContext,
    useContext,
    setUseContext,
    record,
    active,
    buffer,
    setBuffer,
    instruction,
    setInstruction,
    busy,
    error,
    elapsed,
    profileDirty,
    pending,
    setPending,
    editorDirty,
    navigate,
    newPost,
    request,
    openRecord,
    writeUrl,
    logout,
    copy,
    generate,
    refine,
    save,
    finalize,
    finalizeReview,
    setFinalizeReview,
    switchDraft,
    discard,
    evidence,
    drafts,
    lastParams,
  } = useWorkspace();
  return (
    <AppShell
      currentView={view}
      onNavigate={navigate}
      onNewPost={() => newPost()}
      onOpenGeneration={(id) => request(() => void openRecord(id))}
      headerTitle={TITLES[view]}
      username={user?.username || ""}
      isAdmin={user?.is_admin}
      onLogout={() =>
        request(() => {
          writeUrl("home", null, 1, true);
          logout();
        })
      }
    >
      {busy === "load" && hasDraftTransitionSource() && <p role="status" className="pointer-events-none fixed right-6 top-24 z-50 rounded-full border border-border-subtle bg-surface-card px-4 py-2 text-xs text-primary shadow-sm">Opening your draft…</p>}
      {busy === "load" && !hasDraftTransitionSource() ? (
        <Loading />
      ) : (
        <MotionScene key={view} scene={view}><main className="min-w-0" inert={busy === "load"}>
          {view === "home" ? (
            <HomeView
              username={user?.username || "writer"}
              onNewPost={newPost}
              onOpenHistory={(id, index) =>
                request(() => void openRecord(id, index))
              }
              onGoHistory={() => navigate("history")}
              onGoProfile={() => navigate("profile")}
            />
          ) : view === "profile" ? (
            <ProfilePage onBack={() => navigate("home")} />
          ) : view === "history" ? (
            <HistoryList
              onBack={() => navigate("home")}
              onOpen={(id, index) => request(() => void openRecord(id, index))}
            />
          ) : view === "privacy" || view === "terms" ? (
            <LegalView kind={view} onBack={() => navigate("home")} />
          ) : view === "compose" ? (
            <>
              <GenerationForm
                topic={topic}
                setTopic={setTopic}
                platform={platform}
                setPlatform={setPlatform}
                rawThoughts={rawThoughts}
                setRawThoughts={setRawThoughts}
                profileContext={profileContext}
                setProfileContext={setProfileContext}
                useContext={useContext}
                setUseContext={setUseContext}
                loading={busy === "generate"}
                elapsed={elapsed}
                onSubmit={(e) => {
                  e.preventDefault();
                  void generate();
                }}
                onGoProfile={() => navigate("profile")}
              />
              {error && (
                <p role="alert" className="mt-5 paper p-5 text-sm text-error">
                  {error}
                </p>
              )}
            </>
          ) : view === "selection" && drafts && record ? (
            <DraftSelectionGrid
              drafts={drafts}
              platform={record.platform}
              {...evidence}
              quality={record.quality}
              onSelect={switchDraft}
              onCopy={(text) => void copy(text)}
              renderMarkdown={renderMarkdown}
              onRefine={() => navigate("compose")}
              onRegenerate={() =>
                request(() => {
                  if (lastParams.current) {
                    setView("compose");
                    writeUrl("compose");
                    void generate(lastParams.current);
                  } else {
                    setView("compose");
                    writeUrl("compose");
                  }
                })
              }
            />
          ) : view === "editor" && drafts && record ? (
            <DraftEditor
              key={`${record.generation_id}-${active}`}
              topic={record.topic}
              platform={record.platform}
              activeDraftIndex={active}
              draftContent={buffer}
              onChange={setBuffer}
              dirty={editorDirty}
              isFinalized={record.status === "finalized"}
              finalizedDraftIndex={record.active_draft_index}
              chatHistory={record.chat_history.filter(
                (m) => (m.draft_index || 1) === active,
              )}
              editInstruction={instruction}
              setEditInstruction={setInstruction}
              busy={busy}
              onEditSubmit={refine}
              onSave={save}
              onFinalize={() => finalize()}
              onBack={() => navigate("selection")}
              onCopy={(text) => void copy(text)}
              renderMarkdown={renderMarkdown}
              allDrafts={drafts}
              onSelectDraftIndex={switchDraft}
              error={error}
              onReload={() =>
                request(() => {
                  if (user)
                    sessionStorage.removeItem(
                      `postcraft:editor:${user.id}:${record.generation_id}:${active}`,
                    );
                  void openRecord(record.generation_id, active);
                })
              }
              quality={record.quality}
              original={record.original_drafts?.[draftKey(active)]}
              {...evidence}
            />
          ) : (
            <Loading />
          )}
        </main></MotionScene>
      )}
      <Dialog
        open={!!pending}
        onOpenChange={(open) => {
          if (!open) setPending(null);
        }}
      >
        <DialogContent>
          <DialogTitle className="font-serif text-2xl">
            Unsaved changes
          </DialogTitle>
          <DialogDescription>
            {profileDirty
              ? "Your profile has unsaved changes. Keep editing to save them, or discard them before leaving."
              : "Keep this thought safe. Save your edits before you leave, or discard them and continue."}
          </DialogDescription>
          <div className="flex flex-wrap justify-end gap-2 mt-5">
            <button className="btn-secondary" onClick={() => setPending(null)}>
              Keep editing
            </button>
            <button className="btn-secondary text-error" onClick={discard}>
              Discard changes
            </button>
            {editorDirty && !profileDirty && (
              <button
                className="btn-primary"
                disabled={!!busy || !buffer.trim()}
                onClick={async () => {
                  if (await save()) {
                    const action = pending;
                    setPending(null);
                    action?.();
                  }
                }}
              >
                {busy === "save" ? "Saving…" : "Save and continue"}
              </button>
            )}
          </div>
        </DialogContent>
      </Dialog>
      <Dialog open={!!finalizeReview} onOpenChange={open => { if (!open && busy !== "finalize") setFinalizeReview(null); }}>
        <DialogContent>
          <DialogTitle>{finalizeReview?.quality.review_unavailable ? "Review unavailable" : "Your draft, your decision"}</DialogTitle>
          <DialogDescription>The automated review is guidance, not a publishing restriction. You can revise your draft or finalize this version with the feedback below.</DialogDescription>
          <div className="rounded-xl border border-primary/20 bg-primary/5 p-5 space-y-3">
            <p className="font-serif text-2xl">{finalizeReview?.quality.substance_score != null ? `Substance score: ${finalizeReview.quality.substance_score}/10` : "Score unavailable"}</p>
            <p className="text-sm leading-6 whitespace-pre-wrap">{finalizeReview?.quality.result.replace(/^FAIL\s*:?\s*/i, "")}</p>
          </div>
          <p className="text-xs text-text-muted">Finalizing locks this draft and does not publish it to social media.</p>
          {error && <p role="alert" className="text-sm text-error">{error}</p>}
          <div className="flex flex-wrap justify-end gap-3">
            <button className="btn-secondary" disabled={busy === "finalize"} onClick={() => setFinalizeReview(null)}>Keep editing</button>
            <button className="btn-primary" disabled={busy === "finalize" || !finalizeReview?.quality.review_token} onClick={() => finalize(finalizeReview?.quality.review_token)}>{busy === "finalize" ? "Finalizing…" : "Finalize anyway"}</button>
          </div>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
export default function Home() {
  const { token, isInitializing } = useAuth();
  const [legal, setLegal] = useState<"privacy" | "terms" | null>(null);
  useEffect(() => {
    const syncLegal = () => {
      const view = new URLSearchParams(window.location.search).get("view");
      setLegal(view === "privacy" || view === "terms" ? view : null);
    };
    queueMicrotask(syncLegal);
    window.addEventListener("popstate", syncLegal);
    return () => window.removeEventListener("popstate", syncLegal);
  }, []);
  if (isInitializing) return <Loading />;
  if (!token)
    return legal ? (
      <MotionScene scene={legal}><LegalView
        kind={legal}
        onBack={() => {
          setLegal(null);
          window.history.replaceState({}, "", "/");
        }}
      /></MotionScene>
    ) : (
      <AuthScreen
        onOpenLegal={(kind) => {
          setLegal(kind);
          window.history.pushState({}, "", `/?view=${kind}`);
        }}
      />
    );
  return <Workspace key={token} />;
}
