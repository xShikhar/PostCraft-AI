"use client";

import { useState, useEffect, useRef } from "react";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { toast } from "sonner";
import { ArrowRight, Eye, EyeOff, Moon, Sun, ShieldCheck, Asterisk } from "lucide-react";
import { useTheme } from "next-themes";
import Image from "next/image";
import { useMounted } from "@/lib/use-mounted";
import { useAuth } from "../hooks/use-auth";
import "./auth.css";

gsap.registerPlugin(useGSAP);

interface AuthScreenProps {
  onOpenLegal?: (kind: "privacy" | "terms") => void;
}

/** Brand illustration only: these papers never represent sample user data. */
function EditorialStage({ dark }: { dark: boolean }) {
  const stage = useRef<HTMLElement>(null);
  useGSAP(() => {
    const media = gsap.matchMedia();
    media.add("(prefers-reduced-motion: no-preference)", () => {
      gsap.from(".auth-stage-enter", { y: 18, opacity: 0, duration: 0.6, stagger: 0.06, ease: "power2.out" });
    });
    media.add("(hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)", () => {
      const element = stage.current;
      if (!element) return;
      const movers = Array.from(element.querySelectorAll<HTMLElement>("[data-auth-paper]")).map((paper, index) => ({
        x: gsap.quickTo(paper, "x", { duration: 0.65, ease: "power3.out" }),
        y: gsap.quickTo(paper, "y", { duration: 0.65, ease: "power3.out" }),
        depth: (index + 1) * 4,
      }));
      let bounds = element.getBoundingClientRect();
      const measure = () => { bounds = element.getBoundingClientRect(); };
      const move = (event: PointerEvent) => {
        const x = (event.clientX - bounds.left) / bounds.width - 0.5;
        const y = (event.clientY - bounds.top) / bounds.height - 0.5;
        movers.forEach(mover => { mover.x(x * mover.depth * 2); mover.y(y * mover.depth * 2); });
      };
      const reset = () => movers.forEach(mover => { mover.x(0); mover.y(0); });
      element.addEventListener("pointerenter", measure);
      element.addEventListener("pointermove", move);
      element.addEventListener("pointerleave", reset);
      window.addEventListener("resize", measure);
      return () => {
        element.removeEventListener("pointerenter", measure);
        element.removeEventListener("pointermove", move);
        element.removeEventListener("pointerleave", reset);
        window.removeEventListener("resize", measure);
      };
    });
    return () => media.revert();
  }, { scope: stage });

  return (
    <section className="auth-stage" ref={stage} aria-label="Your writing, with intention">
      <div className="auth-brand auth-stage-enter">
        <span className="auth-brand-mark"><Image src={dark ? "/logo-dark.png" : "/logo-light.png"} alt="" width={38} height={38} priority /></span>
        <h1>POSTCRAFT AI</h1><span className="auth-brand-edition">THE WRITING STUDIO</span>
      </div>
      <div className="auth-stage-copy auth-stage-enter">
        <p className="auth-overline"><span /> A SPACE FOR YOUR PERSPECTIVE</p>
        <h2>Good ideas.<br />Your <em>voice.</em><br />Lasting impact.</h2>
        <p className="auth-stage-description">Turn what you know into something<br className="auth-desktop-break" /> worth putting into words.</p>
      </div>
      <div className="auth-art auth-stage-enter" aria-hidden="true">
        <svg className="auth-orbit" viewBox="0 0 640 330" fill="none"><ellipse cx="320" cy="165" rx="300" ry="114" transform="rotate(-19 320 165)" /><path d="M32 230h72M540 69h72M322 16v30M322 288v27" /><circle cx="590" cy="80" r="5" /><circle cx="48" cy="236" r="3" /></svg>
        <div className="auth-paper auth-paper-back" data-auth-paper><span className="auth-paper-label">01 / THE SPARK</span><span className="auth-paper-word">Think.</span><span className="auth-paper-rule" /><span className="auth-paper-note">It starts with a point of view.</span></div>
        <div className="auth-paper auth-paper-middle" data-auth-paper><span className="auth-paper-label">02 / THE CRAFT</span><span className="auth-paper-word">Shape.</span><span className="auth-paper-rule" /><span className="auth-paper-note">Find the words that feel like you.</span></div>
        <div className="auth-paper auth-paper-front" data-auth-paper><div className="auth-paper-top"><span className="auth-paper-label">03 / YOUR VOICE</span><Asterisk size={24} strokeWidth={1} /></div><span className="auth-paper-word">Share.</span><span className="auth-paper-rule" /><span className="auth-paper-note">Something only you could say.</span><span className="auth-paper-corner">↗</span></div>
        <span className="auth-art-caption">A THOUGHT, GIVEN FORM.</span>
      </div>
      <div className="auth-stage-footer auth-stage-enter"><span>Made for the way you think.</span><span>Written with intention. <Asterisk size={16} /></span></div>
    </section>
  );
}

export function AuthScreen({ onOpenLegal }: AuthScreenProps = {}) {
  const { login, signup, isLoading } = useAuth();
  const { resolvedTheme, setTheme } = useTheme();
  const mounted = useMounted();
  const dark = mounted && resolvedTheme === "dark";
  const [isLoginMode, setIsLoginMode] = useState(true);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const heading = useRef<HTMLDivElement>(null);
  const pending = useRef(false);

  useEffect(() => {
    const notice = sessionStorage.getItem("postcraft:post_delete_notice");
    if (notice) {
      sessionStorage.removeItem("postcraft:post_delete_notice");
      toast.info(notice === "1" ? "Your account has been deleted." : notice);
    }
  }, []);
  useGSAP(() => {
    const media = gsap.matchMedia();
    media.add("(prefers-reduced-motion: no-preference)", () => {
      gsap.from(heading.current, { opacity: 0, y: 5, duration: 0.2, ease: "power2.out" });
    });
    return () => media.revert();
  }, { scope: heading, dependencies: [isLoginMode], revertOnUpdate: true });

  const handleModeToggle = () => {
    setIsLoginMode(mode => !mode);
    setUsername(""); setPassword(""); setShowPassword(false); setAgreedToTerms(false);
  };
  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (pending.current || isLoading || (!isLoginMode && !agreedToTerms)) return;
    pending.current = true;
    try {
      if (isLoginMode) await login(username, password, rememberMe);
      else await signup(username, password, rememberMe);
    } finally { pending.current = false; }
  };

  return (
    <main className="auth-page">
      <EditorialStage dark={dark} />
      <section className="auth-entry" aria-labelledby="auth-form-heading">
        <div className="auth-entry-top"><span>YOUR NEXT CHAPTER STARTS HERE</span><button type="button" className="auth-theme icon-button" aria-label={`Switch to ${dark ? "light" : "dark"} theme`} onClick={() => setTheme(dark ? "light" : "dark")} disabled={!mounted}>{dark ? <Sun size={18} /> : <Moon size={18} />}</button></div>
        <div className="auth-form-wrap">
          <div className="auth-form-heading" ref={heading}>
            <p className="auth-overline">{isLoginMode ? "BACK TO YOUR STUDIO" : "MAKE ROOM FOR YOUR IDEAS"}</p>
            <h2 id="auth-form-heading">{isLoginMode ? "Welcome back." : "Begin with you."}</h2>
            <p>{isLoginMode ? "A fresh page. A familiar voice. Let’s get writing." : "Your perspective is the starting point. Let’s build on it."}</p>
          </div>
          <form className="auth-form" onSubmit={handleSubmit} aria-busy={isLoading}>
            <div className="auth-field-group"><label htmlFor="username">Email or username</label><input id="username" className="field auth-input" autoComplete="username" placeholder="Your email or username" required minLength={3} maxLength={255} type="text" value={username} onChange={event => setUsername(event.target.value)} disabled={isLoading} autoCapitalize="none" spellCheck={false} /></div>
            <div className="auth-field-group"><label htmlFor="password">Password</label><div className="auth-password"><input id="password" className="field auth-input" autoComplete={isLoginMode ? "current-password" : "new-password"} placeholder={isLoginMode ? "Enter your password" : "At least 8 characters"} required minLength={isLoginMode ? 1 : 8} maxLength={128} type={showPassword ? "text" : "password"} value={password} onChange={event => setPassword(event.target.value)} disabled={isLoading} aria-describedby={!isLoginMode ? "auth-password-hint" : undefined} /><button type="button" className="auth-password-toggle" aria-label={showPassword ? "Hide password" : "Show password"} aria-pressed={showPassword} onClick={() => setShowPassword(value => !value)} disabled={isLoading}>{showPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button></div>{!isLoginMode && <p id="auth-password-hint" className="auth-field-hint">Use 8–128 characters.</p>}</div>
            <label className="auth-check"><input type="checkbox" checked={rememberMe} onChange={event => setRememberMe(event.target.checked)} disabled={isLoading} /><span>Remember this session (30 days)</span></label>
            {!isLoginMode && <div className="auth-consent"><label className="auth-check"><input type="checkbox" checked={agreedToTerms} onChange={event => setAgreedToTerms(event.target.checked)} required aria-required="true" disabled={isLoading} /><span>I agree to the Terms of Service and Privacy Policy.</span></label><div className="auth-consent-links"><button type="button" onClick={() => onOpenLegal?.("terms")}>Read Terms of Service</button><span>·</span><button type="button" onClick={() => onOpenLegal?.("privacy")}>Read Privacy Policy</button></div></div>}
            <button type="submit" disabled={isLoading || (!isLoginMode && !agreedToTerms)} className="btn-primary auth-submit"><span>{isLoading ? "Please wait…" : isLoginMode ? "Sign in to PostCraft" : "Create account"}</span>{isLoading ? <span className="auth-loading" aria-hidden="true" /> : <ArrowRight size={18} />}</button>
          </form>
          <p className="auth-switch">{isLoginMode ? "New to PostCraft?" : "Already have an account?"} <button type="button" onClick={handleModeToggle} disabled={isLoading}>{isLoginMode ? "Sign up" : "Log in"}<ArrowRight size={14} /></button></p>
          <div className="auth-private"><ShieldCheck size={17} strokeWidth={1.5} /><span>Your private background stays encrypted.</span></div>
        </div>
        <footer className="auth-entry-footer"><span>A little space. A lot of possibility.</span><nav aria-label="Legal"><button type="button" onClick={() => onOpenLegal?.("privacy")}>Privacy</button><button type="button" onClick={() => onOpenLegal?.("terms")}>Terms</button></nav></footer>
      </section>
    </main>
  );
}
