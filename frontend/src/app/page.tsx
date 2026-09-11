"use client";

import { useState, useEffect } from "react";
import DOMPurify from "isomorphic-dompurify";
import { useAuth } from "@/features/auth/hooks/use-auth";
import { AuthScreen } from "@/features/auth/components/auth-screen";
import { AppShell } from "@/components/layout/app-shell";
import { HomeView } from "@/features/home/components/home-view";
import { GenerationForm } from "@/features/generation/components/generation-form";
import { DraftEditor } from "@/features/editor/components/draft-editor";
import { DraftSelectionGrid } from "@/features/editor/components/draft-selection-grid";
import { ProfilePage } from "@/features/profile/components/profile-page";
import { HistoryList } from "@/features/history/components/history-list";
import { LegalView } from "@/features/legal/legal-view";
import { getCurrentUser } from "@/lib/api/user";

import { Loader2 } from "lucide-react";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";
import { Drafts, ChatMessage, SourceItem, generateDrafts, editDraft, finalizeDraft } from "@/lib/api/generation";
import { getGenerationFull } from "@/lib/api/history";
import { ApiError } from "@/lib/api/client";
import { renderMarkdown } from "@/lib/utils/markdown";

function getHeaderTitle(view: string): string {
  switch (view) {
    case "history": return "Archive & Logs";
    case "profile": return "Persona Engine";
    case "editor": return "Draft Edition";
    case "privacy": return "Privacy Policy";
    case "terms": return "Terms of Service";
    default: return "Intelligent Publishing Workspace";
  }
}

export default function Home() {
  const { isAuthenticated, isInitializing } = useAuth();

  // View state
  const [view, setView] = useState<"home" | "editor" | "profile" | "history" | "privacy" | "terms">("home");

  // Lets the unauthenticated footer links (Privacy / Terms) display the legal
  // doc without forcing the user through sign-up. Resets on auth.
  const [legalView, setLegalView] = useState<"privacy" | "terms" | null>(null);

  // Generation State
  const [topic, setTopic] = useState("");
  const [platform, setPlatform] = useState("linkedin");
  const [rawThoughts, setRawThoughts] = useState("");
  const [profileContext, setProfileContext] = useState("");
  const [useContext, setUseContext] = useState(true);
  const [loading, setLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState(0);

  const [generationId, setGenerationId] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Drafts | null>(null);

  // Editor State
  const [activeDraftIndex, setActiveDraftIndex] = useState<number | null>(null);
  const [chatHistories, setChatHistories] = useState<Record<number, ChatMessage[]>>({ 1: [], 2: [], 3: [] });
  const [editInstruction, setEditInstruction] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [isFinalized, setIsFinalized] = useState(false);
  const [finalizedDraftIndex, setFinalizedDraftIndex] = useState<number | null>(null);

  // Sources
  const [sources, setSources] = useState<SourceItem[]>([]);

  // User info
  const [username, setUsername] = useState("");

  const steps = [
    "Researching topic...",
    "Analyzing tone and patterns...",
    "Generating drafts...",
    "Quality check and polish...",
  ];

  useEffect(() => {
    if (isAuthenticated) {
      getCurrentUser()
        .then((u) => setUsername(u.username))
        .catch(() => setUsername("there"));
    }
  }, [isAuthenticated]);

  // Pick up any pending thought from the quick capture bar
  useEffect(() => {
    const thought = sessionStorage.getItem("postcraft:pending_thought");
    if (thought) {
      setRawThoughts((prev) => (prev ? prev + "\n" + thought : thought));
      sessionStorage.removeItem("postcraft:pending_thought");
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (loading) {
      setLoadingStep(0);
      const interval = setInterval(() => {
        setLoadingStep(prev => (prev + 1) % steps.length);
      }, 2000);
      return () => clearInterval(interval);
    }
  }, [loading]);

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setDrafts(null);
    setActiveDraftIndex(null);
    setChatHistories({ 1: [], 2: [], 3: [] });
    setIsFinalized(false);
    setFinalizedDraftIndex(null);
    setSources([]);

    try {
      const data = await generateDrafts({
        topic,
        platform,
        raw_thoughts: rawThoughts,
        profile_context: profileContext || undefined,
        use_context: useContext,
      });

      if (data.status === "needs_review") {
        toast.warning("The quality checker flagged these drafts. They may need manual editing.");
      } else {
        toast.success("Drafts generated successfully!");
      }

      setGenerationId(data.generation_id);
      setDrafts({
        draft_1: data.draft_1,
        draft_2: data.draft_2,
        draft_3: data.draft_3,
      });
      setSources(data.sources || []);

    } catch (err: unknown) {
      // 429s already carry a rate-limit-specific message; surface as-is.
      // Other errors fall back to the server's message or a generic one.
      const message = err instanceof ApiError
        ? err.message
        : err instanceof Error
          ? err.message
          : "Failed to generate drafts";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editInstruction.trim() || !generationId || activeDraftIndex === null || isFinalized) return;

    setIsEditing(true);
    const newInstruction = editInstruction;
    const currentIdx = activeDraftIndex;
    setEditInstruction("");
    setChatHistories(prev => ({
      ...prev,
      [currentIdx]: [...(prev[currentIdx] || []), { role: "user", content: newInstruction, draft_index: currentIdx }]
    }));

    try {
      const data = await editDraft(generationId, currentIdx, newInstruction);
      const botReply = data.reply || "Draft revised successfully.";
      setChatHistories(prev => ({
        ...prev,
        [currentIdx]: [...(prev[currentIdx] || []), { role: "assistant", content: botReply, draft_index: currentIdx }]
      }));
      setDrafts(prev => prev ? { ...prev, [`draft_${currentIdx}`]: data.revised_draft } : prev);
      toast.success("Draft updated!");
    } catch (err: unknown) {
      const message = err instanceof ApiError
        ? err.message
        : err instanceof Error
          ? err.message
          : "Edit failed";
      toast.error(message);
      setChatHistories(prev => ({
        ...prev,
        [currentIdx]: [...(prev[currentIdx] || []), { role: "assistant", content: `Error: ${message}`, draft_index: currentIdx }]
      }));
    } finally {
      setIsEditing(false);
    }
  };

  const handleFinalize = async () => {
    if (!generationId || activeDraftIndex === null) return;
    setLoading(true);
    try {
      await finalizeDraft(generationId, activeDraftIndex);
      setIsFinalized(true);
      setFinalizedDraftIndex(activeDraftIndex);
      toast.success("Draft finalized and preferences saved!");
    } catch (err: unknown) {
      const message = err instanceof ApiError
        ? err.message
        : err instanceof Error
          ? err.message
          : "Finalization failed";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast("Copied to clipboard!");
  };

  const handleOpenHistoryItem = async (genId: string, preferredDraftIndex?: number) => {
    setLoading(true);
    try {
      const full = await getGenerationFull(genId);
      setGenerationId(full.generation_id);
      setDrafts({
        draft_1: full.draft_1 || "",
        draft_2: full.draft_2 || "",
        draft_3: full.draft_3 || "",
      });
      const initialIdx = preferredDraftIndex || full.active_draft_index || 1;
      setActiveDraftIndex(initialIdx);

      // Partition chat history per draft
      const partitioned: Record<number, ChatMessage[]> = { 1: [], 2: [], 3: [] };
      if (full.chat_history) {
        full.chat_history.forEach((msg) => {
          const idx = msg.draft_index || 1;
          if (!partitioned[idx]) partitioned[idx] = [];
          partitioned[idx].push(msg);
        });
      }
      setChatHistories(partitioned);
      const isFin = full.status === "finalized";
      setIsFinalized(isFin);
      setFinalizedDraftIndex(isFin ? (full.active_draft_index || 1) : null);
      setTopic(full.topic);
      setRawThoughts(full.raw_thoughts);
      setPlatform(full.platform);
      setView("editor");
      toast.success("Opened from history.");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to open generation";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleNewPost = () => {
    setView("home");
    setActiveDraftIndex(null);
    setDrafts(null);
    setChatHistories({ 1: [], 2: [], 3: [] });
    setIsFinalized(false);
    setFinalizedDraftIndex(null);
    setTopic("");
    setRawThoughts("");
  };

  const handleNavigate = (v: "home" | "editor" | "profile" | "history" | "privacy" | "terms") => {
    setView(v);
  };

  if (isInitializing) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-canvas-base">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAuthenticated) {
    // Legal docs are readable without an account — the auth-screen footer
    // links route here.
    if (legalView) {
      return (
        <LegalView
          kind={legalView}
          onBack={() => setLegalView(null)}
        />
      );
    }
    return (
      <AuthScreen onOpenLegal={(k) => setLegalView(k)} />
    );
  }

  return (
    <AppShell
      currentView={view}
      onNavigate={handleNavigate}
      onNewPost={handleNewPost}
      headerTitle={getHeaderTitle(view)}
      username={username}
      initials={username.slice(0, 2).toUpperCase()}
    >
      <Toaster theme="light" position="top-center" richColors />

      <main key={view} className="w-full space-y-8 animate-fade-slide-up">

        {view === "profile" ? (
          <ProfilePage onBack={() => setView("home")} />
        ) : view === "history" ? (
          <HistoryList
            onBack={() => setView("home")}
            onOpen={handleOpenHistoryItem}
          />
        ) : view === "privacy" || view === "terms" ? (
          <LegalView kind={view} onBack={() => setView("home")} />
        ) : view === "editor" && activeDraftIndex && drafts ? (
          <DraftEditor
            activeDraftIndex={activeDraftIndex}
            draftContent={drafts[`draft_${activeDraftIndex}` as keyof Drafts]}
            isFinalized={isFinalized}
            finalizedDraftIndex={finalizedDraftIndex}
            chatHistory={chatHistories[activeDraftIndex] || []}
            editInstruction={editInstruction}
            setEditInstruction={setEditInstruction}
            isEditing={isEditing}
            loading={loading}
            onEditSubmit={handleEditSubmit}
            onFinalize={handleFinalize}
            onBack={() => { setActiveDraftIndex(null); setView("home"); }}
            onCopy={copyToClipboard}
            renderMarkdown={renderMarkdown}
            allDrafts={drafts}
            onSelectDraftIndex={(idx) => {
              setActiveDraftIndex(idx);
              setEditInstruction("");
            }}
          />
        ) : (
          <>
            {/* Home view (greeting + quick capture + recent drafts + cadence) */}
            <HomeView
              username={username}
              onNewPost={handleNewPost}
              onOpenHistory={handleOpenHistoryItem}
              onGoHistory={() => setView("history")}
            />

            {/* Generation form (shown when view === "home" and no drafts yet) */}
            {!activeDraftIndex && (
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
                loading={loading}
                loadingStepText={steps[loadingStep]}
                activeStep={loadingStep}
                onSubmit={handleGenerate}
              />
            )}

            {/* Draft selection grid (shown after generation) */}
            {drafts && !activeDraftIndex && (
              <DraftSelectionGrid
                drafts={drafts}
                platform={platform}
                onSelect={(num) => { setActiveDraftIndex(num); setView("editor"); }}
                onCopy={copyToClipboard}
                renderMarkdown={renderMarkdown}
              />
            )}
          </>
        )}
      </main>
    </AppShell>
  );
}

