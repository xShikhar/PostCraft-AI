import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Loader2, Copy, CheckCircle2 } from "lucide-react";
import { ChatMessage } from "@/lib/api/generation";

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
  return (
    <div className="space-y-6 animate-in zoom-in-95 duration-300">
      <Card className="border-primary shadow-lg shadow-primary/5">
        <CardHeader className="border-b border-border/50 pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Badge variant="default" className="bg-primary">Active Draft 0{activeDraftIndex}</Badge>
              {isFinalized && <Badge variant="secondary" className="bg-green-500/10 text-green-500">Finalized</Badge>}
            </div>
            <div className="flex gap-2">
              {!isFinalized && (
                <Button variant="ghost" size="sm" onClick={onBack}>Back</Button>
              )}
              <Button variant="outline" size="sm" onClick={() => onCopy(draftContent)}>
                <Copy className="w-4 h-4 mr-2" /> Copy
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-6 pb-6 text-base leading-relaxed h-auto max-h-[60vh] overflow-y-auto">
          <div dangerouslySetInnerHTML={{ __html: renderMarkdown(draftContent) }} />
        </CardContent>
        {!isFinalized && (
          <CardFooter className="bg-muted/10 border-t border-border/50 pt-4 flex justify-end">
            <Button onClick={onFinalize} disabled={loading} className="gap-2">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
              Finalize & Save Preferences
            </Button>
          </CardFooter>
        )}
      </Card>

      {!isFinalized && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-primary" /> AI Editor
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3 max-h-60 overflow-y-auto pr-2">
              {chatHistory.length === 0 && (
                <p className="text-center text-sm text-muted-foreground italic py-4">
                  Suggest edits like "Make it punchier" or "Remove the emojis"
                </p>
              )}
              {chatHistory.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[80%] rounded-xl px-4 py-2 text-sm ${msg.role === 'user' ? 'bg-primary text-primary-foreground rounded-br-none' : 'bg-muted rounded-bl-none'}`}>
                    {msg.content}
                  </div>
                </div>
              ))}
              {isEditing && (
                <div className="flex justify-start">
                  <div className="bg-muted rounded-xl rounded-bl-none px-4 py-2">
                    <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                  </div>
                </div>
              )}
            </div>
            
            <form onSubmit={onEditSubmit} className="flex gap-2 pt-2 border-t border-border/50">
              <Input 
                placeholder="Type your instructions..." 
                value={editInstruction}
                onChange={e => setEditInstruction(e.target.value)}
                disabled={isEditing}
                className="bg-background"
              />
              <Button type="submit" disabled={isEditing || !editInstruction.trim()}>Send</Button>
            </form>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
