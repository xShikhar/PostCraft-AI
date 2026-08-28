import { Button } from "@/components/ui/button";
import { LogOut, PenTool } from "lucide-react";

interface TopNavigationProps {
  onLogout: () => void;
  onProfileSettings: () => void;
}

export function TopNavigation({ onLogout, onProfileSettings }: TopNavigationProps) {
  return (
    <header className="w-full flex items-center justify-between pb-6 mb-6 border-b border-border/40">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-cyan-500 flex items-center justify-center shadow-lg shadow-primary/20">
          <PenTool className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground">PostCraft</h1>
          <p className="text-xs text-muted-foreground font-medium">Workspace</p>
        </div>
      </div>
      
      <div className="flex items-center gap-4">
        <Button 
          variant="outline" 
          size="sm" 
          onClick={onProfileSettings}
          className="text-muted-foreground hover:text-foreground"
        >
          Profile
        </Button>
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={onLogout}
          className="text-muted-foreground hover:text-foreground hover:bg-muted/50"
        >
          <LogOut className="w-4 h-4 mr-2" />
          Sign Out
        </Button>
      </div>
    </header>
  );
}
