"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/features/auth/hooks/use-auth";
import { AuthScreen } from "@/features/auth/components/auth-screen";
import { AppLayout } from "@/components/layout/app-layout";
import { TopNavigation } from "@/components/layout/top-navigation";
import { GenerationForm } from "@/features/generation/components/generation-form";
import { ProfileSettingsModal } from "@/features/generation/components/profile-settings-modal";
import { DraftEditor } from "@/features/editor/components/draft-editor";

import { Card, CardContent, CardHeader, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, Copy, Edit2 } from "lucide-react";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";
import { Drafts, ChatMessage, SourceItem, generateDrafts, editDraft, finalizeDraft } from "@/lib/api/generation";

const renderMarkdown = (text: string): string => {
  if (!text) return '';
  let html = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/^### (.+)$/gm, '<h4 class="text-base font-semibold mt-4 mb-2">$1</h4>')
    .replace(/^## (.+)$/gm, '<h3 class="text-lg font-semibold mt-5 mb-2">$1</h3>')
    .replace(/^# (.+)$/gm, '<h2 class="text-xl font-bold mt-6 mb-3">$1</h2>')
    .replace(/\*\*(.+?)\*\*/g, '<strong class="font-semibold text-foreground">$1</strong>')
    .replace(/(?<![*])\*(?![*])(.+?)(?<![*])\*(?![*])/g, '<em class="italic text-foreground/90">$1</em>')
    .replace(/^[*\-] (.+)$/gm, '<li class="ml-6 list-disc mt-1 text-muted-foreground">$1</li>')
    .replace(/\n/g, '<br/>');
  return html;
};

export default function Home() {
  const { token, isAuthenticated, isInitializing, logout } = useAuth();
  
  // Generation State
  const [topic, setTopic] = useState("");
  const [platform, setPlatform] = useState("linkedin");
  const [rawThoughts, setRawThoughts] = useState("");
  const [profileContext, setProfileContext] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState(0);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  
  const [generationId, setGenerationId] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Drafts | null>(null);
  
  // Editor State
  const [activeDraftIndex, setActiveDraftIndex] = useState<number | null>(null);
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [editInstruction, setEditInstruction] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [isFinalized, setIsFinalized] = useState(false);

  // Sources State
  const [sources, setSources] = useState<SourceItem[]>([]);
  const [researchConfidence, setResearchConfidence] = useState<string | null>(null);
  const [researchSource, setResearchSource] = useState<string | null>(null);

  const steps = [
    "Researching topic...",
    "Analyzing tone and patterns...",
    "Generating drafts...",
    "Quality check and polish..."
  ];

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
    setResearchConfidence(null);
    setResearchSource(null);

    try {
      const data = await generateDrafts({ topic, platform, raw_thoughts: rawThoughts, profile_context: profileContext || undefined });

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
      setResearchConfidence(data.research_confidence || null);
      setResearchSource(data.research_source || null);
      
    } catch (err: any) {
      toast.error(err.message || "Failed to generate drafts");
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
      toast.error(err.message || "Edit failed");
      setChatHistory(prev => [...prev, { role: "assistant", content: `Error: ${err.message}` }]);
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
      toast.error(err.message || "Finalization failed");
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast("Copied to clipboard!");
  };

  if (isInitializing) {
    return <div className="min-h-screen flex items-center justify-center bg-background"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  }

  if (!isAuthenticated) {
    return (
      <>
        <AuthScreen />
        <Toaster theme="dark" position="top-center" />
      </>
    );
  }

  return (
    <AppLayout>
      <Toaster theme="dark" position="top-center" />
      <TopNavigation onLogout={logout} onProfileSettings={() => setIsProfileModalOpen(true)} />
      <ProfileSettingsModal open={isProfileModalOpen} onOpenChange={setIsProfileModalOpen} />
      
      <main className="w-full max-w-4xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
        
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
            loading={loading}
            loadingStepText={steps[loadingStep]}
            onSubmit={handleGenerate}
          />
        )}

        {drafts && !activeDraftIndex && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pt-4 animate-in fade-in slide-in-from-bottom-8 duration-700">
            {[1, 2, 3].map((num) => {
              const text = drafts[`draft_${num}` as keyof Drafts];
              if (!text) return null;
              return (
                <Card key={num} className="relative overflow-hidden group hover:border-primary/50 transition-colors">
                  <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary to-cyan-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                  <CardHeader className="pb-3 border-b border-border/50 bg-muted/20">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary" className="bg-primary/10 text-primary hover:bg-primary/20">
                          0{num}
                        </Badge>
                        <span className="font-semibold text-sm">Option {num}</span>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-4 pb-0 text-sm leading-relaxed text-muted-foreground h-64 overflow-y-auto">
                    <div dangerouslySetInnerHTML={{ __html: renderMarkdown(text) }} />
                  </CardContent>
                  <CardFooter className="pt-4 flex gap-2">
                    <Button variant="default" size="sm" className="flex-1" onClick={() => setActiveDraftIndex(num)}>
                      <Edit2 className="w-4 h-4 mr-2" /> Select
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => copyToClipboard(text)}>
                      <Copy className="w-4 h-4" />
                    </Button>
                  </CardFooter>
                </Card>
              );
            })}
          </div>
        )}

        {activeDraftIndex && drafts && (
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
            onBack={() => setActiveDraftIndex(null)}
            onCopy={copyToClipboard}
            renderMarkdown={renderMarkdown}
          />
        )}
      </main>
    </AppLayout>
  );
}
