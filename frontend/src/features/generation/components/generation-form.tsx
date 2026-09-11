"use client";

import { useRef } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { Loader2, Fingerprint } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

interface GenerationFormProps {
  topic: string;
  setTopic: (v: string) => void;
  platform: string;
  setPlatform: (v: string) => void;
  rawThoughts: string;
  setRawThoughts: (v: string) => void;
  profileContext: string;
  setProfileContext: (v: string) => void;
  useContext: boolean;
  setUseContext: (v: boolean) => void;
  loading: boolean;
  loadingStepText: string;
  activeStep: number;
  onSubmit: (e: React.FormEvent) => void;
}

const PIPELINE_STEPS = [
  { label: "Research", description: "Gathering context" },
  { label: "Analyze", description: "Tone & patterns" },
  { label: "Generate", description: "Drafting content" },
  { label: "Polish", description: "Quality check" },
];

export function GenerationForm({
  topic,
  setTopic,
  platform,
  setPlatform,
  rawThoughts,
  setRawThoughts,
  profileContext,
  setProfileContext,
  useContext,
  setUseContext,
  loading,
  loadingStepText,
  activeStep,
  onSubmit,
}: GenerationFormProps) {
  const formContainerRef = useRef<HTMLDivElement>(null);
  const trackerRef = useRef<HTMLDivElement>(null);
  const progressBarRef = useRef<HTMLDivElement>(null);
  const stepTextRef = useRef<HTMLSpanElement>(null);
  const labelsContainerRef = useRef<HTMLDivElement>(null);

  // Subtle focus elevation for input and textarea fields
  useGSAP(() => {
    const container = formContainerRef.current;
    if (!container) return;

    const mm = gsap.matchMedia();
    mm.add("(prefers-reduced-motion: no-preference)", () => {
      const handleFocusIn = (e: FocusEvent) => {
        const target = e.target as HTMLElement;
        if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA")) {
          gsap.to(target, {
            scale: 1.006,
            duration: 0.18,
            ease: "power2.out",
          });
        }
      };

      const handleFocusOut = (e: FocusEvent) => {
        const target = e.target as HTMLElement;
        if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA")) {
          gsap.to(target, {
            scale: 1.0,
            duration: 0.18,
            ease: "power2.out",
            clearProps: "transform",
          });
        }
      };

      container.addEventListener("focusin", handleFocusIn);
      container.addEventListener("focusout", handleFocusOut);

      return () => {
        container.removeEventListener("focusin", handleFocusIn);
        container.removeEventListener("focusout", handleFocusOut);
      };
    });

    return () => mm.revert();
  }, { scope: formContainerRef });

  // Entrance animation for tracker card when loading begins
  useGSAP(() => {
    if (!loading || !trackerRef.current) return;
    const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!prefersReduced) {
      gsap.from(trackerRef.current, {
        opacity: 0,
        y: -8,
        duration: 0.24,
        ease: "power2.out",
      });
    }
  }, { dependencies: [loading], scope: trackerRef });

  // State-to-state sequential pipeline step transition animation
  useGSAP(() => {
    if (!loading) return;

    const mm = gsap.matchMedia();

    mm.add("(prefers-reduced-motion: no-preference)", () => {
      // Smooth progress bar fill
      if (progressBarRef.current) {
        gsap.to(progressBarRef.current, {
          scaleX: (activeStep + 1) / PIPELINE_STEPS.length,
          duration: 0.35,
          ease: "power2.out",
        });
      }
      // Subtitle cross-fade
      if (stepTextRef.current) {
        gsap.fromTo(
          stepTextRef.current,
          { opacity: 0, y: 3 },
          { opacity: 1, y: 0, duration: 0.2, ease: "power2.out" }
        );
      }
      // Pulse active step label
      if (labelsContainerRef.current) {
        const labels = labelsContainerRef.current.querySelectorAll(".pipeline-step-label");
        const activeLabel = labels[activeStep];
        if (activeLabel) {
          gsap.fromTo(
            activeLabel,
            { scale: 1.12 },
            { scale: 1, duration: 0.22, ease: "back.out(2)" }
          );
        }
      }
    });

    mm.add("(prefers-reduced-motion: reduce)", () => {
      if (progressBarRef.current) {
        gsap.set(progressBarRef.current, {
          scaleX: (activeStep + 1) / PIPELINE_STEPS.length,
        });
      }
      if (stepTextRef.current) {
        gsap.set(stepTextRef.current, { opacity: 1, y: 0 });
      }
    });

    return () => mm.revert();
  }, { dependencies: [loading, activeStep, loadingStepText], scope: trackerRef });
  return (
    <div ref={formContainerRef} className="w-full max-w-5xl mx-auto">
      {/* Section header */}
      <div className="mb-space-lg">
        <p className="font-label-xs text-label-xs text-text-muted uppercase tracking-widest mb-space-2xs">
          Step 1 of 4
        </p>
        <h2 className="font-serif text-headline-lg text-text-display">
          Studio Workspace
        </h2>
        <p className="font-body-sm text-body-sm text-text-muted mt-space-2xs">
          Describe your idea and let PostCraft do the rest
        </p>
      </div>

      <form onSubmit={onSubmit} className="grid grid-cols-1 lg:grid-cols-5 gap-space-lg">

        {/* Left column — Platform + Topic */}
        <div className="lg:col-span-2 flex flex-col gap-space-md">
          {/* Platform selector */}
          <div className="bg-surface-card rounded-xl border border-border-subtle p-space-md">
            <label className="font-label-sm text-label-sm font-semibold text-text-display mb-space-sm block">
              Target Platform
            </label>
            <div className="grid grid-cols-2 gap-space-xs">
              <button
                type="button"
                onClick={() => setPlatform("linkedin")}
                className={`
                  flex items-center justify-center gap-space-xs py-space-sm rounded-xl border transition-all text-body-sm font-label-sm font-semibold btn-press
                  ${platform === "linkedin"
                    ? "bg-primary text-on-primary border-primary shadow-md"
                    : "bg-surface-subtle text-text-muted border-transparent hover:bg-surface-container-high hover:text-text-display"
                  }
                `}
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
                </svg>
                LinkedIn
              </button>
              <button
                type="button"
                onClick={() => setPlatform("x")}
                className={`
                  flex items-center justify-center gap-space-xs py-space-sm rounded-xl border transition-all text-body-sm font-label-sm font-semibold btn-press
                  ${platform === "x"
                    ? "bg-primary text-on-primary border-primary shadow-md"
                    : "bg-surface-subtle text-text-muted border-transparent hover:bg-surface-container-high hover:text-text-display"
                  }
                `}
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.746l7.73-8.835L1.254 2.25H8.08l4.259 5.631zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                </svg>
                X / Twitter
              </button>
            </div>
          </div>

          {/* Topic input */}
          <div className="bg-surface-card rounded-xl border border-border-subtle p-space-md">
            <label className="font-label-sm text-label-sm font-semibold text-text-display mb-space-sm block" htmlFor="topic">
              Main Topic / Theme
            </label>
            <Input
              id="topic"
              placeholder="e.g. Why async communication is the future of remote work"
              value={topic}
              onChange={e => setTopic(e.target.value)}
              required
              className="bg-surface-subtle border-transparent text-text-display placeholder:text-outline text-body-sm focus:ring-2 focus:ring-primary/50"
            />
          </div>

          {/* Profile context override */}
          <div className="bg-surface-card rounded-xl border border-border-subtle p-space-md">
            <label className="font-label-sm text-label-sm font-semibold text-text-display mb-space-xs block" htmlFor="profileContext">
              Profile Context <span className="font-normal text-text-muted">(optional — overrides saved settings)</span>
            </label>
            <Textarea
              id="profileContext"
              placeholder="Your bio, expertise, or what you're selling..."
              value={profileContext}
              onChange={e => setProfileContext(e.target.value)}
              rows={3}
              className="bg-surface-subtle border-transparent text-text-display placeholder:text-outline text-body-sm resize-none focus:ring-2 focus:ring-primary/50"
            />
          </div>

          {/* Include saved context toggle */}
          <div className="bg-surface-subtle rounded-xl p-space-md flex items-center justify-between">
            <div className="flex items-start gap-space-sm">
              <div className="w-8 h-8 rounded-lg bg-surface-container flex items-center justify-center text-primary mt-0.5 flex-shrink-0">
                <Fingerprint className="w-4 h-4" />
              </div>
              <div className="flex flex-col">
                <span className="text-title-sm font-semibold text-text-display">Include saved profile</span>
                <span className="text-body-sm text-text-muted">Applies your About Me and resume background</span>
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer flex-shrink-0 ml-space-sm">
              <input
                type="checkbox"
                checked={useContext}
                onChange={(e) => setUseContext(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-outline-variant rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-surface-card after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary peer-focus:outline-none" />
            </label>
          </div>
        </div>

        {/* Right column — Raw Thoughts + Submit */}
        <div className="lg:col-span-3 flex flex-col gap-space-md">
          {/* Raw thoughts */}
          <div className="bg-surface-card rounded-xl border border-border-subtle p-space-md flex flex-col flex-1">
            <label className="font-label-sm text-label-sm font-semibold text-text-display mb-space-sm block" htmlFor="rawThoughts">
              Your Raw Thoughts <span className="text-text-muted font-normal">(the substance)</span>
            </label>
            <Textarea
              id="rawThoughts"
              placeholder="Brain dump your core ideas here — don't worry about polish, just get the substance down..."
              value={rawThoughts}
              onChange={e => setRawThoughts(e.target.value)}
              required
              className="flex-1 min-h-[200px] bg-surface-subtle border-transparent text-text-display placeholder:text-outline text-body-sm resize-none focus:ring-2 focus:ring-primary/50"
            />
            <div className="flex items-center justify-between mt-space-sm">
              <span className="text-label-xs text-text-muted">
                {rawThoughts.length} characters
              </span>
            </div>
          </div>

          {/* Pipeline tracker */}
          {loading && (
            <div
              ref={trackerRef}
              className="bg-surface-card rounded-xl border border-border-subtle p-space-md"
            >
              <div className="flex items-center justify-between mb-space-md">
                <span ref={stepTextRef} className="font-label-xs text-label-xs text-text-muted">
                  {loadingStepText}
                </span>
                <Loader2 className="w-4 h-4 animate-spin text-primary" />
              </div>
              {/* Single horizontal progress bar that fills to the current step's
                 midpoint. Using scaleX (GPU) instead of width to avoid layout thrash. */}
              <div className="w-full h-1.5 rounded-full bg-surface-container overflow-hidden mb-space-sm">
                <div
                  ref={progressBarRef}
                  className="h-full w-full bg-primary pipeline-fill rounded-full"
                  style={{ transform: `scaleX(${(activeStep + 1) / PIPELINE_STEPS.length})` }}
                />
              </div>
              {/* Step labels — highlighted if reached, all visible at once */}
              <div ref={labelsContainerRef} className="flex justify-between">
                {PIPELINE_STEPS.map((step, i) => (
                  <span
                    key={step.label}
                    className={`pipeline-step-label inline-block font-label-xs text-label-xs transition-colors duration-300 ${
                      i <= activeStep ? "text-primary font-semibold" : "text-text-muted"
                    }`}
                  >
                    {step.label}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Generate button */}
          <Button
            type="submit"
            className="w-full h-14 text-base font-semibold rounded-xl bg-text-display hover:bg-black text-surface-card dark:bg-primary dark:hover:bg-primary-container dark:text-on-primary shadow-md hover:scale-[1.01] active:scale-[0.98] transition-all disabled:opacity-50 disabled:pointer-events-none btn-press"
            disabled={loading}
          >
            {loading ? (
              <>
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                {loadingStepText}
              </>
            ) : (
              <span className="font-label-md text-label-md">Generate Drafts</span>
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
