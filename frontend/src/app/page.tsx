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
import ReactMarkdown from "react-markdown";

const renderMarkdown = (text: string): string => {
  if (!text) return '';
  let html = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/^### (.+)$/gm, '<h4 class="text-base font-semibold mt-4 mb-2">$1</h4>')
    .replace(/^## (.+)$/gm, '<h3 class="text-lg font-semibold mt-5 mb-2">$1</h3>')
    .replace(/^# (.+)$/gm, '<h2 class="text-xl font-bold mt-6 mb-3">$1</h2>')
    .replace(/\*\*(.+?)\*\*/g, '<strong class="font-semibold text-text-display">$1</strong>')
    .replace(/(?<![*])\*(?![*])(.+?)(?<![*])\*(?![*])/g, '<em class="italic text-text-body/90">$1</em>')
    .replace(/^[*\-] (.+)$/gm, '<li class="ml-6 list-disc mt-1 text-text-muted">$1</li>')
    .replace(/\n/g, '<br/>');

  // Sanitize the generated HTML to prevent XSS from malicious AI content
  // DOMPurify removes dangerous attributes, tags, and JS while preserving formatting
  return DOMPurify.sanitize(html);
};

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
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [editInstruction, setEditInstruction] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [isFinalized, setIsFinalized] = useState(false);

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
    setChatHistory([]);
    setIsFinalized(false);
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

    } catch (err: any) {
      // 429s already carry a rate-limit-specific message; surface as-is.
      // Other errors fall back to the server's message or a generic one.
      const message = err instanceof ApiError
        ? err.message
        : err?.message || "Failed to generate drafts";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editInstruction.trim() || !generationId || activeDraftIndex === null) return;

    setIsEditing(true);
    const newInstruction = editInstruction;
    setEditInstruction("");
    setChatHistory(prev => [...prev, { role: "user", content: newInstruction }]);

    try {
      const data = await editDraft(generationId, activeDraftIndex, newInstruction);
      setChatHistory(prev => [...prev, { role: "assistant", content: "Draft revised successfully." }]);
      setDrafts(prev => prev ? { ...prev, [`draft_${activeDraftIndex}`]: data.revised_draft } : prev);
      toast.success("Draft updated!");
    } catch (err: any) {
      const message = err instanceof ApiError
        ? err.message
        : err?.message || "Edit failed";
      toast.error(message);
      setChatHistory(prev => [...prev, { role: "assistant", content: `Error: ${message}` }]);
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
      toast.success("Draft finalized and preferences saved!");
    } catch (err: any) {
      const message = err instanceof ApiError
        ? err.message
        : err?.message || "Finalization failed";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast("Copied to clipboard!");
  };

  const handleOpenHistoryItem = async (genId: string) => {
    setLoading(true);
    try {
      const full = await getGenerationFull(genId);
      setGenerationId(full.generation_id);
      setDrafts({
        draft_1: full.draft_1 || "",
        draft_2: full.draft_2 || "",
        draft_3: full.draft_3 || "",
      });
      setActiveDraftIndex(full.active_draft_index || 1);
      setChatHistory(full.chat_history || []);
      setIsFinalized(full.status === "finalized");
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
    setChatHistory([]);
    setIsFinalized(false);
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

      <main className="w-full space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">

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
            chatHistory={chatHistory}
            editInstruction={editInstruction}
            setEditInstruction={setEditInstruction}
            isEditing={isEditing}
            loading={loading}
            onEditSubmit={handleEditSubmit}
            onFinalize={handleFinalize}
            onBack={() => { setActiveDraftIndex(null); setView("home"); }}
            onCopy={copyToClipboard}
            renderMarkdown={renderMarkdown}
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

