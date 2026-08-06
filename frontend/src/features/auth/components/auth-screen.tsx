import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "../hooks/use-auth";
import { Sparkles, Zap, Target } from "lucide-react";

export function AuthScreen() {
  const { login, signup, isLoading } = useAuth();
  const [isLoginMode, setIsLoginMode] = useState(true);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoginMode) {
      await login(username, password);
    } else {
      await signup(username, password);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 relative overflow-hidden bg-background">
      {/* Background Decorators */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="z-10 w-full max-w-md space-y-8">
        <div className="text-center space-y-2">
          <h1 className="text-4xl font-bold tracking-tight bg-gradient-to-br from-primary to-cyan-400 bg-clip-text text-transparent pb-1">
            PostCraft AI
          </h1>
          <p className="text-muted-foreground">
            AI-Powered Content That Sounds Like You
          </p>
        </div>

        <Card className="border-muted/50 shadow-2xl backdrop-blur-sm bg-card/80">
          <CardHeader>
            <CardTitle className="text-2xl text-center">
              {isLoginMode ? "Welcome Back" : "Join PostCraft AI"}
            </CardTitle>
            <CardDescription className="text-center">
              {isLoginMode 
                ? "Enter your credentials to access your dashboard" 
                : "Create an account to start generating posts"}
            </CardDescription>
          </CardHeader>
          <form onSubmit={handleSubmit}>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-muted-foreground" htmlFor="username">
                  Username
                </label>
                <Input
                  id="username"
                  placeholder="e.g. maxbogo"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                  disabled={isLoading}
                  className="bg-background/50 focus-visible:ring-primary"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-muted-foreground" htmlFor="password">
                  Password
                </label>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={isLoading}
                  className="bg-background/50 focus-visible:ring-primary"
                />
              </div>
            </CardContent>
            <CardFooter className="flex flex-col space-y-4">
              <Button type="submit" className="w-full h-11 text-base font-medium" disabled={isLoading}>
                {isLoading ? "Please wait..." : (isLoginMode ? "Log In" : "Sign Up")}
              </Button>
              <div className="text-sm text-center text-muted-foreground">
                {isLoginMode ? "Don't have an account? " : "Already have an account? "}
                <button
                  type="button"
                  onClick={() => {
                    setIsLoginMode(!isLoginMode);
                    setUsername("");
                    setPassword("");
                  }}
                  className="text-primary font-medium hover:underline focus:outline-none"
                  disabled={isLoading}
                >
                  {isLoginMode ? "Sign up" : "Log in"}
                </button>
              </div>
            </CardFooter>
          </form>
        </Card>

        {/* Feature Highlights */}
        <div className="grid grid-cols-3 gap-4 pt-4">
          <div className="flex flex-col items-center text-center space-y-2">
            <div className="p-2 bg-primary/10 rounded-full text-primary">
              <Sparkles className="w-5 h-5" />
            </div>
            <span className="text-xs text-muted-foreground font-medium">Smart Format</span>
          </div>
          <div className="flex flex-col items-center text-center space-y-2">
            <div className="p-2 bg-cyan-500/10 rounded-full text-cyan-500">
              <Target className="w-5 h-5" />
            </div>
            <span className="text-xs text-muted-foreground font-medium">Platform Specific</span>
          </div>
          <div className="flex flex-col items-center text-center space-y-2">
            <div className="p-2 bg-amber-500/10 rounded-full text-amber-500">
              <Zap className="w-5 h-5" />
            </div>
            <span className="text-xs text-muted-foreground font-medium">Instant Drafts</span>
          </div>
        </div>
      </div>
    </div>
  );
}
