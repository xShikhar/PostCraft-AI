"use client";

import { useRef, useEffect } from "react";
import { Loader2, Copy, ArrowLeft, Check, MessageSquare, Send } from "lucide-react";
import { Button } from "@/components/ui/button";

export type ChatMessage = { role: "user" | "assistant"; content: string };

interface DraftEditorProps {
  activeDraftIndex: number;
  draftContent: string;
  isFinalized: boolean;
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
}: DraftEditorProps) {
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatHistory]);

  return (
    <div className="w-full max-w-6xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header row */}
      <div className="flex items-center justify-between mb-space-lg">
        <div className="flex items-center gap-space-md">
          <button
            onClick={onBack}
            className="w-9 h-9 rounded-lg bg-surface-subtle hover:bg-surface-container-high flex items-center justify-center text-text-muted hover:text-text-display transition-colors"
            aria-label="Back to drafts"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h2 className="font-serif text-headline-md text-text-display">
              Draft {activeDraftIndex}
            </h2>
            <p className="font-body-sm text-body-sm text-text-muted">
              Refine your post with natural language instructions
            </p>
          </div>
        </div>

        <div className="flex items-center gap-space-xs">
          {isFinalized ? (
            <span className="inline-flex items-center gap-space-2xs px-space-sm py-space-2xs rounded-full bg-green-500/10 text-green-600 font-label-xs text-label-xs font-semibold">
              <Check className="w-3.5 h-3.5" />
              Finalized
            </span>
          ) : (
            <Button
              onClick={onFinalize}
              disabled={loading}
              size="sm"
              className="rounded-full bg-primary hover:bg-primary-container text-on-primary font-label-sm font-semibold"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              <span>Finalize</span>
            </Button>
          )}
          <button
            onClick={() => onCopy(draftContent)}
            className="w-9 h-9 rounded-lg bg-surface-subtle hover:bg-surface-container-high flex items-center justify-center text-text-muted hover:text-text-display transition-colors"
            aria-label="Copy draft"
          >
            <Copy className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-space-lg">

        {/* Draft preview (left, 3/5) */}
        <div className="lg:col-span-3 flex flex-col gap-space-md">
          <div className="bg-surface-card rounded-xl border border-border-subtle p-space-lg flex-1 min-h-[400px]">
            <div className="flex items-center justify-between mb-space-md">
              <span className="font-label-xs text-label-xs text-text-muted uppercase tracking-wider">
                Draft Preview
              </span>
              <span className="font-body-sm text-body-sm text-text-muted">
                {draftContent.length} chars · {draftContent.split(/\s+/).filter(Boolean).length} words
              </span>
            </div>
            <div
              className="font-body-md text-body-md text-text-display leading-relaxed prose-editor"
              dangerouslySetInnerHTML={{ __html: renderMarkdown(draftContent) }}
            />
          </div>
        </div>

        {/* Chat stream (right, 2/5) */}
        <div className="lg:col-span-2 flex flex-col bg-surface-card rounded-xl border border-border-subtle overflow-hidden">
          {/* Chat header */}
          <div className="flex items-center gap-space-sm px-space-md py-space-sm border-b border-border-subtle bg-surface-subtle">
            <MessageSquare className="w-4 h-4 text-primary" />
            <span className="font-label-sm text-label-sm font-semibold text-text-display">
              Edit Stream
            </span>
          </div>

          {/* Chat messages */}
          <div className="flex-1 overflow-y-auto p-space-md space-y-space-md max-h-[420px]">
            {chatHistory.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full text-center py-space-xl">
                <MessageSquare className="w-8 h-8 text-outline mb-space-sm" />
                <p className="font-body-sm text-body-sm text-text-muted">
                  Your edits and responses will appear here
                </p>
              </div>
            )}
            {chatHistory.map((msg, i) => (
              <div
                key={i}
                className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[90%] rounded-xl px-space-sm py-space-xs text-body-sm text-body-sm ${
                    msg.role === "user"
                      ? "bg-primary text-on-primary"
                      : "bg-surface-subtle text-text-display"
                  }`}
                >
                  {msg.content}
                </div>
              </div>
            ))}
            <div ref={chatEndRef} />
          </div>

          {/* Quick chips */}
          {chatHistory.length === 0 && (
            <div className="px-space-md pb-space-sm">
              <p className="font-label-xs text-label-xs text-text-muted mb-space-2xs">
                Quick prompts
              </p>
              <div className="flex flex-wrap gap-space-2xs">
                {QUICK_CHIPS.map((chip) => (
                  <button
                    key={chip}
                    onClick={() => setEditInstruction(chip)}
                    className="px-space-xs py-space-2xs rounded-full bg-surface-subtle hover:bg-surface-container-high text-text-muted hover:text-text-display font-label-xs text-label-xs transition-colors"
                  >
                    {chip}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Input */}
          {!isFinalized && (
            <form
              onSubmit={onEditSubmit}
              className="p-space-sm border-t border-border-subtle bg-surface-subtle"
            >
              <div className="flex gap-space-xs">
                <textarea
                  value={editInstruction}
                  onChange={(e) => setEditInstruction(e.target.value)}
                  placeholder="Describe how you'd like to change this draft..."
                  rows={2}
                  className="flex-1 bg-surface-card border border-border-subtle rounded-lg px-space-sm py-space-xs text-body-sm text-text-display placeholder:text-outline resize-none focus:outline-none focus:ring-2 focus:ring-primary/50"
                  disabled={isEditing}
                />
                <button
                  type="submit"
                  disabled={isEditing || !editInstruction.trim()}
                  className="w-9 h-9 rounded-lg bg-primary hover:bg-primary-container text-on-primary flex items-center justify-center transition-colors disabled:opacity-40 disabled:pointer-events-none self-end"
                  aria-label="Send edit instruction"
                >
                  {isEditing ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4" />
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
