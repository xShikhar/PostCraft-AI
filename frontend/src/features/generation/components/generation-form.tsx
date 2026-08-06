import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Sparkles, Loader2 } from "lucide-react";

interface GenerationFormProps {
  topic: string;
  setTopic: (v: string) => void;
  platform: string;
  setPlatform: (v: string) => void;
  rawThoughts: string;
  setRawThoughts: (v: string) => void;
  loading: boolean;
  loadingStepText: string;
  onSubmit: (e: React.FormEvent) => void;
}

export function GenerationForm({
  topic,
  setTopic,
  platform,
  setPlatform,
  rawThoughts,
  setRawThoughts,
  loading,
  loadingStepText,
  onSubmit,
}: GenerationFormProps) {
  return (
    <Card className="border-muted bg-card shadow-lg">
      <CardHeader>
        <CardTitle>Create New Post</CardTitle>
        <CardDescription>Give PostCraft the context and it will generate high-performing drafts.</CardDescription>
      </CardHeader>
      <form onSubmit={onSubmit}>
        <CardContent className="space-y-6">
          <div className="space-y-3">
            <label className="text-sm font-medium">Target Platform</label>
            <div className="flex gap-4">
              <Button
                type="button"
                variant={platform === "linkedin" ? "default" : "outline"}
                className="flex-1"
                onClick={() => setPlatform("linkedin")}
              >
                LinkedIn
              </Button>
              <Button
                type="button"
                variant={platform === "x" ? "default" : "outline"}
                className="flex-1"
                onClick={() => setPlatform("x")}
              >
                X (Twitter)
              </Button>
            </div>
          </div>

          <div className="space-y-3">
            <label className="text-sm font-medium" htmlFor="topic">Main Topic / Theme</label>
            <Input 
              id="topic" 
              placeholder="e.g. Why async communication is the future of remote work" 
              value={topic} 
              onChange={e => setTopic(e.target.value)} 
              required 
              className="bg-background/50"
            />
          </div>

          <div className="space-y-3">
            <label className="text-sm font-medium" htmlFor="rawThoughts">Your Raw Thoughts (The Substance)</label>
            <Textarea 
              id="rawThoughts" 
              placeholder="Brain dump your core ideas here..." 
              value={rawThoughts} 
              onChange={e => setRawThoughts(e.target.value)} 
              required 
              className="min-h-[120px] bg-background/50 resize-y"
            />
          </div>
        </CardContent>
        <CardFooter>
          <Button type="submit" className="w-full h-12 text-base font-medium group" disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                {loadingStepText}
              </>
            ) : (
              <>
                <Sparkles className="w-5 h-5 mr-2 text-cyan-400 group-hover:animate-pulse" />
                Generate Drafts
              </>
            )}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
