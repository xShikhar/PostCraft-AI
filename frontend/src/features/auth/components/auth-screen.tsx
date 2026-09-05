"use client";

import { useState, useEffect } from "react";
import { useAuth } from "../hooks/use-auth";
import { toast } from "sonner";
import { AtSign, Lock, Eye, EyeOff, ArrowRight, ShieldCheck } from "lucide-react";

interface AuthScreenProps {
  // Lets the auth-screen footer Privacy / Terms links open the legal view
  // without an account. The legal view is rendered separately by the
  // page-level dispatcher — this is just the trigger.
  onOpenLegal?: (kind: "privacy" | "terms") => void;
}

export function AuthScreen({ onOpenLegal }: AuthScreenProps = {}) {
  const { login, signup, isLoading } = useAuth();
  const [isLoginMode, setIsLoginMode] = useState(true);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);

  // Required only in signup mode. The submit button is disabled until
  // the user has actively checked the box — see the `canSubmit` calc
  // below. Login mode bypasses this so existing users aren't asked to
  // re-agree every time.
  const [agreedToTerms, setAgreedToTerms] = useState(false);

  // If we just landed here from the account-deletion flow, the ProfilePage
  // stashed a flag in sessionStorage. Surface a single, clear confirmation
  // and clear the flag so it doesn't repeat on a re-login.
  useEffect(() => {
    if (sessionStorage.getItem("postcraft:post_delete_notice") === "1") {
      sessionStorage.removeItem("postcraft:post_delete_notice");
      toast.success("Your account and data have been deleted.");
    }
  }, []);

  // Reset the agreement when toggling between login and signup so a user
  // who switches out of signup doesn't carry an implicit agreement with
  // them when they come back.
  const handleModeToggle = () => {
    setIsLoginMode((m) => !m);
    setUsername("");
    setPassword("");
    setAgreedToTerms(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // Defense in depth: even though the button is disabled, the form
    // could still be submitted by an Enter keypress from the password
    // field while the checkbox sits unchecked. Block that here.
    if (!isLoginMode && !agreedToTerms) {
      return;
    }
    if (isLoginMode) {
      await login(username, password);
    } else {
      await signup(username, password);
    }
  };

  const canSubmit = isLoginMode || agreedToTerms;

  return (
    <div className="min-h-screen flex items-center justify-center bg-canvas-base p-space-lg relative overflow-hidden">
      {/* Ambient background glows */}
      <div className="absolute -top-16 -right-16 w-44 h-44 bg-primary-container rounded-full blur-3xl pointer-events-none opacity-40" />
      <div className="absolute -bottom-16 -left-16 w-40 h-40 bg-secondary-fixed rounded-full blur-3xl pointer-events-none opacity-30" />

      <main className="w-full max-w-md mx-auto relative z-10">
        <div className="flex flex-col w-full">
          <div className="relative w-full overflow-hidden bg-surface-card rounded-xl p-space-lg sm:p-space-xl shadow-card-light">
            {/* Decorative inner glows */}
            <div className="absolute -top-16 -right-16 w-44 h-44 bg-surface-container rounded-full blur-3xl pointer-events-none" />
            <div className="absolute -bottom-16 -left-16 w-40 h-40 bg-secondary-fixed/40 rounded-full blur-3xl pointer-events-none" />

            {/* Brand block */}
            <div className="relative z-10 flex flex-col items-center text-center">
              <div className="w-14 h-14 rounded-full bg-surface-subtle p-space-2xs flex items-center justify-center shadow-sm mb-space-md">
                <svg className="w-10 h-10 text-primary" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                  <path d="M20 4L25 15L36 17L28 25L30 36L20 31L10 36L12 25L4 17L15 15L20 4Z" fill="currentColor" opacity="0.9"/>
                </svg>
              </div>
              <span className="font-label-xs text-label-xs uppercase tracking-widest text-primary font-bold mb-space-2xs">
                Editorial Intelligence
              </span>
              <h1 className="font-serif text-headline-md text-text-display mb-space-xs">
                PostCraft AI
              </h1>
              <p className="font-body-sm text-body-sm text-text-muted max-w-xs leading-relaxed">
                Welcome back — Log in to your social writing partner workspace.
              </p>
            </div>

            {/* Form */}
            <form className="relative z-10 mt-space-lg flex flex-col gap-space-md" onSubmit={handleSubmit}>
              {/* Username / email */}
              <div className="flex flex-col gap-space-2xs text-left">
                <label className="font-label-md text-label-md text-text-display" htmlFor="username">
                  Email or username
                </label>
                <div className="relative flex items-center">
                  <AtSign className="absolute left-space-sm text-outline w-4 h-4 pointer-events-none" />
                  <input
                    id="username"
                    autoComplete="username"
                    className="w-full bg-surface-container-low text-text-display font-body-sm text-body-sm pl-9 pr-space-md py-space-sm rounded-lg focus:outline-none focus:bg-surface-card focus:ring-2 focus:ring-primary-container transition-colors placeholder:text-outline"
                    placeholder="name@domain.com"
                    required
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    disabled={isLoading}
                  />
                </div>
              </div>

              {/* Password */}
              <div className="flex flex-col gap-space-2xs text-left">
                <div className="flex items-center justify-between">
                  <label className="font-label-md text-label-md text-text-display" htmlFor="password">
                    Password
                  </label>
                  <a
                    className="font-label-xs text-label-xs text-primary hover:text-primary-container transition-colors cursor-pointer"
                    href="#"
                    onClick={(e) => e.preventDefault()}
                  >
                    Forgot password?
                  </a>
                </div>
                <div className="relative flex items-center">
                  <Lock className="absolute left-space-sm text-outline w-4 h-4 pointer-events-none" />
                  <input
                    id="password"
                    autoComplete={isLoginMode ? "current-password" : "new-password"}
                    className="w-full bg-surface-container-low text-text-display font-body-sm text-body-sm pl-9 pr-10 py-space-sm rounded-lg focus:outline-none focus:bg-surface-card focus:ring-2 focus:ring-primary-container transition-colors placeholder:text-outline"
                    placeholder="Enter password"
                    required
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={isLoading}
                  />
                  <button
                    aria-label="Toggle password visibility"
                    className="absolute right-space-sm flex items-center justify-center text-outline hover:text-text-display transition-colors"
                    type="button"
                    onClick={() => setShowPassword((s) => !s)}
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Remember me */}
              <div className="flex items-center justify-between pt-space-2xs">
                <label className="relative flex items-center gap-space-xs cursor-pointer select-none">
                  <input
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="peer sr-only"
                    type="checkbox"
                  />
                  <div className="w-4 h-4 rounded bg-surface-container-high peer-checked:bg-primary flex items-center justify-center transition-colors">
                    <svg className="w-3.5 h-3.5 text-surface-card opacity-0 peer-checked:opacity-100 transition-opacity" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="3 8 7 12 13 4" />
                    </svg>
                  </div>
                  <span className="font-body-sm text-body-sm text-text-body">Remember this session (30 days)</span>
                </label>
              </div>

              {/* Terms agreement — only shown in signup mode. Required: the
                  submit button stays disabled until this is checked. */}
              {!isLoginMode && (
                <label className="relative flex items-start gap-space-xs cursor-pointer select-none pt-space-2xs">
                  <input
                    checked={agreedToTerms}
                    onChange={(e) => setAgreedToTerms(e.target.checked)}
                    className="peer sr-only"
                    type="checkbox"
                    aria-required="true"
                    required
                  />
                  <div className="mt-0.5 w-4 h-4 rounded bg-surface-container-high peer-checked:bg-primary flex items-center justify-center transition-colors shrink-0">
                    <svg className="w-3.5 h-3.5 text-surface-card opacity-0 peer-checked:opacity-100 transition-opacity" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="3 8 7 12 13 4" />
                    </svg>
                  </div>
                  <span className="font-body-sm text-body-sm text-text-body leading-snug">
                    I agree to the{" "}
                    <button
                      type="button"
                      onClick={() => onOpenLegal?.("terms")}
                      className="text-primary hover:text-primary-container underline underline-offset-2 decoration-primary/40 hover:decoration-primary transition-colors"
                    >
                      Terms of Service
                    </button>{" "}
                    and{" "}
                    <button
                      type="button"
                      onClick={() => onOpenLegal?.("privacy")}
                      className="text-primary hover:text-primary-container underline underline-offset-2 decoration-primary/40 hover:decoration-primary transition-colors"
                    >
                      Privacy Policy
                    </button>
                    .
                  </span>
                </label>
              )}

              {/* Submit */}
              <button
                type="submit"
                disabled={isLoading || !canSubmit}
                className="mt-space-2xs w-full py-space-sm px-space-lg rounded-full bg-text-display hover:bg-black dark:bg-primary dark:hover:bg-primary-container text-surface-card dark:text-on-primary font-label-md text-label-md font-semibold flex items-center justify-center gap-space-xs shadow-md hover:scale-[1.01] active:scale-[0.98] transition-all disabled:opacity-50 disabled:pointer-events-none"
              >
                <span>{isLoading ? "Please wait..." : isLoginMode ? "Sign in to PostCraft" : "Create account"}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>

            {/* Sign up / log in toggle */}
            <div className="relative z-10 mt-space-md text-center">
              <p className="font-body-sm text-body-sm text-text-muted">
                {isLoginMode ? "Don't have an account?" : "Already have an account?"}
                <button
                  type="button"
                  onClick={handleModeToggle}
                  className="font-label-md text-label-md text-primary font-semibold hover:text-primary-container transition-colors ml-1"
                  disabled={isLoading}
                >
                  {isLoginMode ? "Sign up" : "Log in"}
                </button>
              </p>
            </div>

            {/* Footer */}
            <div className="relative z-10 mt-space-lg pt-space-md flex flex-col items-center gap-space-2xs">
              <div className="inline-flex items-center gap-space-2xs text-text-muted font-label-xs text-label-xs bg-surface-subtle px-space-sm py-space-2xs rounded-full">
                <ShieldCheck className="w-3.5 h-3.5 text-primary" />
                <span>Enterprise 256-bit encryption</span>
              </div>
              <div className="flex items-center gap-space-xs font-label-xs text-label-xs text-text-muted">
                <button
                  type="button"
                  onClick={() => onOpenLegal?.("privacy")}
                  className="hover:text-text-display transition-colors"
                >
                  Privacy
                </button>
                <span className="w-1 h-1 rounded-full bg-outline-variant" />
                <button
                  type="button"
                  onClick={() => onOpenLegal?.("terms")}
                  className="hover:text-text-display transition-colors"
                >
                  Terms
                </button>
                <span className="w-1 h-1 rounded-full bg-outline-variant" />
                <a className="hover:text-text-display transition-colors" href="#" onClick={(e) => e.preventDefault()}>Status</a>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
