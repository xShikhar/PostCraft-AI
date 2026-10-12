"use client";

import { useState, useEffect, useRef } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import {
  ArrowLeft,
  Save,
  Loader2,
  FileText,
  Briefcase,
  PenLine,
  Trash2,
  AlertTriangle,
  UploadCloud,
  CheckCircle2,
  Lock,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";
import { getCurrentUser, updateCurrentUser, deleteMyAccount } from "@/lib/api/user";
import { getResume, uploadResume, deleteResume, type ResumeResponse } from "@/lib/api/resume";
import { useAuth } from "@/features/auth/hooks/use-auth";
import { ApiError } from "@/lib/api/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

// ---------------------------------------------------------------------------
// Reusable card wrapper — keeps the visual language consistent across sections
// ---------------------------------------------------------------------------

interface ProfileCardProps {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  children: React.ReactNode;
}

function ProfileCard({ icon, title, subtitle, children }: ProfileCardProps) {
  return (
    <section className="bg-surface-card rounded-xl p-space-lg shadow-card-light flex flex-col gap-space-md border border-border-subtle">
      <header className="flex items-start gap-space-sm">
        <div className="w-10 h-10 rounded-lg bg-surface-subtle flex items-center justify-center text-primary shrink-0">
          {icon}
        </div>
        <div className="flex flex-col">
          <h2 className="font-serif text-title-lg text-text-display leading-tight">{title}</h2>
          <p className="font-body-sm text-body-sm text-text-muted mt-1">{subtitle}</p>
        </div>
      </header>
      <div className="flex flex-col gap-space-sm pt-space-xs">{children}</div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Field — controlled textarea with hover/focus inversion
// ---------------------------------------------------------------------------

interface ProfileFieldProps {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  rows?: number;
  initial: string;
}

function ProfileField({ value, onChange, placeholder, rows = 6, initial }: ProfileFieldProps) {
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      rows={rows}
      className="w-full bg-surface-subtle text-text-display font-body-md text-body-md placeholder:text-text-muted rounded-lg p-space-sm border border-border-subtle focus:outline-none focus:border-primary focus:bg-surface-card input-focus-smooth transition-colors resize-y leading-relaxed"
      data-initial={initial}
    />
  );
}

// ---------------------------------------------------------------------------
// SaveButton — black-inversion primary CTA, mirrors HomeView "New post"
// ---------------------------------------------------------------------------

interface SaveButtonProps {
  onClick: () => void;
  saving: boolean;
  dirty: boolean;
  label: string;
}

function SaveButton({ onClick, saving, dirty, label }: SaveButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={saving || !dirty}
      className="self-end flex items-center gap-space-2xs px-space-md py-space-xs bg-text-display dark:bg-primary text-surface-card dark:text-on-primary rounded-full font-label-md text-label-md tracking-wide shadow-sm hover:scale-[1.01] active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
    >
      {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
      <span>{saving ? "Saving..." : label}</span>
    </button>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export interface ProfilePageProps {
  onBack: () => void;
}

export function ProfilePage({ onBack }: ProfilePageProps) {
  const [loading, setLoading] = useState(true);
  // Field-level state — initialized from the API once on mount.
  const [aboutMe, setAboutMe] = useState("");
  const [resumeBackground, setResumeBackground] = useState("");
  const [writingStyle, setWritingStyle] = useState("");

  // Resume file state
  const [resumeData, setResumeData] = useState<ResumeResponse | null>(null);
  const [uploadingResume, setUploadingResume] = useState(false);
  const [deletingResume, setDeletingResume] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const profileContainerRef = useRef<HTMLDivElement>(null);

  // Subtle focus elevation for input and textarea fields across the profile
  useGSAP(() => {
    const container = profileContainerRef.current;
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
  }, { scope: profileContainerRef, dependencies: [loading] });

  // Per-section saving flags + initial values for the dirty check.
  const [savingAbout, setSavingAbout] = useState(false);
  const [savingResume, setSavingResume] = useState(false);
  const [savingStyle, setSavingStyle] = useState(false);

  const [initialAbout, setInitialAbout] = useState("");
  const [initialResume, setInitialResume] = useState("");
  const [initialStyle, setInitialStyle] = useState("");
  const [initialUsername, setInitialUsername] = useState("");

  // Account deletion state — the dialog is the only path to the API call,
  // and the call is gated by typed confirmation.
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [deleting, setDeleting] = useState(false);
  const { logout } = useAuth();

  // Load the user and saved resume on mount
  useEffect(() => {
    let cancelled = false;
    Promise.all([
      getCurrentUser(),
      getResume().catch(() => null),
    ])
      .then(([u, rData]) => {
        if (cancelled) return;
        // about_me → About Me
        const a = u.about_me ?? "";
        // profile_context carries resume / professional background.
        const r = u.profile_context ?? "";
        // Extract writing_style from profile_context if it was previously saved
        const styleMatch = r.match(/\[writing_style\]\s*([\s\S]*)$/);
        const w = styleMatch ? styleMatch[1].trim() : "";
        setAboutMe(a);
        setResumeBackground(r.replace(/\[writing_style\]\s*[\s\S]*$/, "").trim());
        setWritingStyle(w);
        setInitialAbout(a);
        setInitialResume(r.replace(/\[writing_style\]\s*[\s\S]*$/, "").trim());
        setInitialStyle(w);
        setInitialUsername(u.username ?? "");
        setResumeData(rData);
      })
      .catch(() => {
        toast.error("Failed to load profile.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // writingStyle intentionally not in deps — this is mount-once fetch.
  }, []);

  const handleFileUpload = async (file: File) => {
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      toast.error("File exceeds maximum allowed size of 5MB.");
      return;
    }

    const name = file.name.toLowerCase();
    if (!name.endsWith(".pdf") && !name.endsWith(".docx") && !name.endsWith(".txt")) {
      toast.error("Please upload a PDF, DOCX, or TXT file.");
      return;
    }

    setUploadingResume(true);
    const toastId = toast.loading("Decoding and analyzing resume with AI...");
    try {
      const data = await uploadResume(file);
      setResumeData(data);
      toast.success("Resume decoded & saved! Your experience is stored.", { id: toastId });
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? err.message
          : err instanceof Error
          ? err.message
          : "Failed to upload resume.";
      toast.error(msg, { id: toastId });
    } finally {
      setUploadingResume(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleDeleteResume = async () => {
    setDeletingResume(true);
    try {
      await deleteResume();
      setResumeData(null);
      toast.success("Resume removed. Future posts will not use this resume context.");
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? err.message
          : err instanceof Error
          ? err.message
          : "Failed to delete resume.";
      toast.error(msg);
    } finally {
      setDeletingResume(false);
    }
  };

  const handleSaveAbout = async () => {
    setSavingAbout(true);
    try {
      await updateCurrentUser({ about_me: aboutMe });
      setInitialAbout(aboutMe);
      toast.success("About me saved.");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to save about me.";
      toast.error(msg);
    } finally {
      setSavingAbout(false);
    }
  };

  const handleSaveResume = async () => {
    setSavingResume(true);
    try {
      await updateCurrentUser({ profile_context: resumeBackground });
      setInitialResume(resumeBackground);
      toast.success("Resume & background saved.");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to save resume & background.";
      toast.error(msg);
    } finally {
      setSavingResume(false);
    }
  };

  const handleSaveStyle = async () => {
    // Writing style is local-only for now — we still keep the same PATCH shape
    // so the rest of the app sees a consistent contract. Persist alongside
    // profile_context by appending a structured marker, which the backend
    // treats as opaque text.
    setSavingStyle(true);
    try {
      const combined = resumeBackground
        ? `${resumeBackground}\n\n---\n[writing_style]\n${writingStyle}`
        : `[writing_style]\n${writingStyle}`;
      await updateCurrentUser({ profile_context: combined });
      setInitialStyle(writingStyle);
      toast.success("Writing style saved.");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to save writing style.";
      toast.error(msg);
    } finally {
      setSavingStyle(false);
    }
  };

  // Account deletion — irreversible. The dialog asks the user to type
  // their username to confirm. The flow on success is: DELETE /api/users/me
  // → server cascades DB + ChromaDB → we clear the local token and let
  // the page-level !isAuthenticated branch route the user to AuthScreen.
  // We do NOT navigate from this component — clearing the token is the
  // only state change we need, and the dispatcher will re-render.
  const handleConfirmDelete = async () => {
    if (deleteConfirm.trim() !== initialUsername) return;
    setDeleting(true);
    try {
      await deleteMyAccount();
      // Server confirmed. The toast lands in the new (logged-out) session;
      // sonner keeps it visible across the auth flip because the Toaster
      // is mounted in AppShell only when authenticated. To make sure the
      // confirmation reaches the user after they land on AuthScreen, we
      // also stash a flag in sessionStorage and clear the token in one go.
      sessionStorage.setItem("postcraft:post_delete_notice", "1");
      logout();
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? err.message
          : err instanceof Error
          ? err.message
          : "Failed to delete account.";
      toast.error(msg);
    } finally {
      setDeleting(false);
      setDeleteOpen(false);
    }
  };

  if (loading) {
    return (
      <div className="w-full flex items-center justify-center py-space-2xl">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div ref={profileContainerRef} className="flex flex-col w-full gap-space-2xl">
      {/* Header */}
      <header className="flex flex-col gap-space-sm">
        <button
          type="button"
          onClick={onBack}
          className="self-start flex items-center gap-space-2xs px-space-sm py-space-2xs rounded-full text-text-muted hover:text-text-display hover:bg-surface-subtle transition-colors font-label-md text-label-md"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to workspace</span>
        </button>

        <div className="flex items-center gap-space-xs flex-wrap">
          <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
          <span className="font-label-xs text-label-xs uppercase tracking-widest text-primary font-bold">
            PERSONA ENGINE
          </span>
          <span className="text-outline-variant text-label-xs">•</span>
          <span className="font-label-xs text-label-xs uppercase tracking-wider text-text-muted">
            VOICE &amp; CONTEXT
          </span>
        </div>

        <h1 className="font-serif text-display-hero text-text-display tracking-tight leading-none">
          Persona Engine
        </h1>
        <p className="font-body-lg text-body-lg text-text-muted max-w-2xl">
          Tell PostCraft who you are, what you have done, and how you want to sound.
          Each section sharpens the next generation so it reads like you, not a template.
        </p>
      </header>

      {/* Cards */}
      <div className="flex flex-col gap-space-lg">
        <ProfileCard
          icon={<FileText className="w-5 h-5" />}
          title="About Me"
          subtitle="A short bio — who you write for, what you stand for, what you are tired of."
        >
          <ProfileField
            value={aboutMe}
            onChange={setAboutMe}
            initial={initialAbout}
            rows={5}
            placeholder="e.g. I write for early-stage founders who hate generic thought-leadership. Direct, concrete, and allergic to buzzwords..."
          />
          <SaveButton
            onClick={handleSaveAbout}
            saving={savingAbout}
            dirty={aboutMe !== initialAbout}
            label="Save about me"
          />
        </ProfileCard>

        <ProfileCard
          icon={<Briefcase className="w-5 h-5" />}
          title="Resume &amp; Background"
          subtitle="Upload your resume to automatically decode your expertise, role, and industry. Stored securely and applied to future posts."
        >
          {/* 1. Resume File Upload / Summary Area */}
          <div className="flex flex-col gap-space-sm">
            {resumeData ? (
              <div className="rounded-xl border border-primary/25 bg-primary/[0.04] dark:bg-primary/[0.08] p-space-md flex flex-col gap-space-sm transition-all">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-space-xs">
                    <div className="w-10 h-10 rounded-lg bg-primary/15 text-primary flex items-center justify-center shrink-0">
                      <FileText className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-label-md text-label-md font-semibold text-text-display">
                          {resumeData.filename}
                        </span>
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                          <CheckCircle2 className="w-3 h-3" />
                          Decoded &amp; Saved
                        </span>
                      </div>
                      <span className="font-body-xs text-body-xs text-text-muted">
                        Uploaded {new Date(resumeData.uploaded_at).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleFileUpload(file);
                      }}
                      accept=".pdf,.docx,.txt,application/pdf"
                      className="hidden"
                    />
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploadingResume}
                      className="px-3 py-1.5 rounded-lg border border-border-subtle bg-surface-card hover:bg-surface-subtle text-text-display font-label-sm text-label-sm transition-colors flex items-center gap-1.5 disabled:opacity-50"
                    >
                      {uploadingResume ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <RefreshCw className="w-3.5 h-3.5" />
                      )}
                      <span>Replace PDF</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleDeleteResume}
                      disabled={deletingResume}
                      className="px-3 py-1.5 rounded-lg border border-red-200 dark:border-red-950/50 bg-red-50/50 dark:bg-red-950/20 text-red-600 dark:text-red-400 hover:bg-red-100/60 dark:hover:bg-red-950/40 font-label-sm text-label-sm transition-colors flex items-center gap-1.5 disabled:opacity-50"
                    >
                      {deletingResume ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Trash2 className="w-3.5 h-3.5" />
                      )}
                      <span>Remove</span>
                    </button>
                  </div>
                </div>

                {/* Decoded Insights Grid */}
                {resumeData.structured_summary && (
                  <div className="mt-2 pt-3 border-t border-primary/15 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                    {resumeData.structured_summary.role && (
                      <div className="flex flex-col">
                        <span className="text-[11px] uppercase tracking-wider font-semibold text-text-muted">
                          Identified Role
                        </span>
                        <span className="font-body-sm text-body-sm font-medium text-text-display mt-0.5">
                          {resumeData.structured_summary.role}
                        </span>
                      </div>
                    )}
                    {resumeData.structured_summary.industry && (
                      <div className="flex flex-col">
                        <span className="text-[11px] uppercase tracking-wider font-semibold text-text-muted">
                          Industry
                        </span>
                        <span className="font-body-sm text-body-sm font-medium text-text-display mt-0.5">
                          {resumeData.structured_summary.industry}
                        </span>
                      </div>
                    )}
                    {resumeData.structured_summary.experience_level && (
                      <div className="flex flex-col">
                        <span className="text-[11px] uppercase tracking-wider font-semibold text-text-muted">
                          Experience Level
                        </span>
                        <span className="font-body-sm text-body-sm font-medium text-text-display capitalize mt-0.5">
                          {resumeData.structured_summary.experience_level}
                        </span>
                      </div>
                    )}
                    {resumeData.structured_summary.past_employer && (
                      <div className="flex flex-col">
                        <span className="text-[11px] uppercase tracking-wider font-semibold text-text-muted">
                          Past Employer / Organization
                        </span>
                        <span className="font-body-sm text-body-sm font-medium text-text-display mt-0.5">
                          {resumeData.structured_summary.past_employer}
                        </span>
                      </div>
                    )}
                    {resumeData.structured_summary.education && (
                      <div className="flex flex-col">
                        <span className="text-[11px] uppercase tracking-wider font-semibold text-text-muted">
                          Education
                        </span>
                        <span className="font-body-sm text-body-sm font-medium text-text-display mt-0.5">
                          {resumeData.structured_summary.education}
                        </span>
                      </div>
                    )}
                    {resumeData.structured_summary.expertise_areas && resumeData.structured_summary.expertise_areas.length > 0 && (
                      <div className="flex flex-col sm:col-span-2 md:col-span-3 mt-1">
                        <span className="text-[11px] uppercase tracking-wider font-semibold text-text-muted mb-1">
                          Extracted Expertise &amp; Skills
                        </span>
                        <div className="flex flex-wrap gap-1.5">
                          {resumeData.structured_summary.expertise_areas.map((exp, i) => (
                            <span
                              key={i}
                              className="px-2 py-0.5 rounded-md bg-surface-card border border-border-subtle text-text-display text-body-xs font-medium"
                            >
                              {exp}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                <div className="flex items-center gap-1.5 text-[11px] text-text-muted pt-1">
                  <Lock className="w-3.5 h-3.5 text-primary" />
                  <span>Resume content is encrypted at rest (AES-128 Fernet) and private to your account.</span>
                </div>
              </div>
            ) : (
              /* Dropzone for Uploading Resume */
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragActive(true);
                }}
                onDragLeave={() => setDragActive(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragActive(false);
                  const file = e.dataTransfer.files?.[0];
                  if (file) handleFileUpload(file);
                }}
                className={`rounded-xl border-2 border-dashed p-space-lg flex flex-col items-center justify-center text-center transition-all cursor-pointer ${
                  dragActive
                    ? "border-primary bg-primary/10 scale-[1.005]"
                    : "border-border-subtle bg-surface-subtle/50 hover:bg-surface-subtle hover:border-primary/50"
                }`}
                onClick={() => fileInputRef.current?.click()}
              >
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleFileUpload(file);
                  }}
                  accept=".pdf,.docx,.txt,application/pdf"
                  className="hidden"
                />

                {uploadingResume ? (
                  <div className="flex flex-col items-center gap-space-xs py-space-sm">
                    <Loader2 className="w-8 h-8 text-primary animate-spin" />
                    <span className="font-label-md text-label-md font-semibold text-text-display">
                      Decoding resume with AI...
                    </span>
                    <span className="font-body-xs text-body-xs text-text-muted max-w-sm">
                      Extracting role, background, industry domains, and experience level.
                    </span>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-space-xs py-space-xs">
                    <div className="w-12 h-12 rounded-full bg-primary/10 text-primary flex items-center justify-center mb-1">
                      <UploadCloud className="w-6 h-6" />
                    </div>
                    <div className="flex flex-col gap-0.5">
                      <span className="font-label-md text-label-md font-semibold text-text-display">
                        Upload your Resume (Optional)
                      </span>
                      <span className="font-body-xs text-body-xs text-text-muted max-w-md">
                        Drop your <strong>PDF</strong>, DOCX, or TXT file here, or click to browse (max 5MB).
                      </span>
                    </div>
                    <span className="text-[11px] text-primary/80 mt-1">
                      Gemini decodes your real experience and persists it so every future post sounds authentically like you.
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* 2. Optional Manual Notes Textarea */}
          <div className="flex flex-col gap-1.5 mt-2 pt-3 border-t border-border-subtle">
            <span className="font-label-sm text-label-sm font-semibold text-text-display">
              Additional Background &amp; Notes (Optional)
            </span>
            <span className="font-body-xs text-body-xs text-text-muted mb-1">
              Add any extra context, current ventures, or details not on your resume that you want the model to remember.
            </span>
            <ProfileField
              value={resumeBackground}
              onChange={setResumeBackground}
              initial={initialResume}
              rows={5}
              placeholder="e.g. 8 years building B2B SaaS. Former PM at Linear, now founder of a dev-tools startup. CS background, ex-Stripe eng..."
            />
            <SaveButton
              onClick={handleSaveResume}
              saving={savingResume}
              dirty={resumeBackground !== initialResume}
              label="Save background"
            />
          </div>
        </ProfileCard>

        <ProfileCard
          icon={<PenLine className="w-5 h-5" />}
          title="Writing Style Profile"
          subtitle="Tone, cadence, vocabulary, and the topics or phrasings you want to avoid."
        >
          <ProfileField
            value={writingStyle}
            onChange={setWritingStyle}
            initial={initialStyle}
            rows={7}
            placeholder="e.g. Short sentences. No em-dashes. Avoid 'delve', 'leverage', 'in today's landscape'. Open with a concrete scene or number, not a hook..."
          />
          <SaveButton
            onClick={handleSaveStyle}
            saving={savingStyle}
            dirty={writingStyle !== initialStyle}
            label="Save style profile"
          />
        </ProfileCard>

        {/* Destructive section — visually separated, clearly labelled, not
            reachable by accident. Requires typed confirmation before the API
            call fires. */}
        <section className="mt-space-xl pt-space-lg border-t border-border-subtle flex flex-col gap-space-md">
          <div className="flex items-center gap-space-sm">
            <div className="w-8 h-8 rounded-lg bg-red-50 dark:bg-red-950/30 flex items-center justify-center text-red-500 shrink-0">
              <AlertTriangle className="w-4 h-4" />
            </div>
            <div>
              <h2 className="font-serif text-title-lg text-text-display leading-tight">
                Danger Zone
              </h2>
              <p className="font-body-sm text-body-sm text-text-muted">
                Irreversible actions — read carefully before proceeding.
              </p>
            </div>
          </div>

          <div className="bg-surface-subtle rounded-xl p-space-md flex items-center justify-between gap-space-md">
            <div className="flex flex-col">
              <span className="font-label-md text-label-md text-text-display">
                Delete account
              </span>
              <span className="font-body-sm text-body-sm text-text-muted mt-0.5">
                Permanently removes your account, resume, all generations, style profile,
                and saved context. This cannot be undone.
              </span>
            </div>
            <button
              type="button"
              onClick={() => setDeleteOpen(true)}
              className="flex items-center gap-space-xs px-space-sm py-space-xs rounded-full border border-red-200 dark:border-red-800 text-red-500 font-label-md text-label-md hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors shrink-0"
            >
              <Trash2 className="w-4 h-4" />
              <span>Delete</span>
            </button>
          </div>
        </section>
      </div>

      {/* Confirmation dialog — type your username to confirm */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="bg-surface-card border-border-subtle shadow-card-light">
          <DialogHeader>
            <DialogTitle className="font-serif text-title-lg text-text-display flex items-center gap-space-xs">
              <AlertTriangle className="w-5 h-5 text-red-500" />
              Delete your account?
            </DialogTitle>
            <DialogDescription className="font-body-md text-body-md text-text-muted leading-relaxed">
              This will permanently delete your account and all associated data:
            </DialogDescription>
          </DialogHeader>

          <ul className="list-disc pl-space-lg space-y-1 font-body-sm text-body-sm text-text-body">
            <li>Your account and login credentials</li>
            <li>Your uploaded resume</li>
            <li>All generated drafts and history</li>
            <li>Your style profile</li>
            <li>Your profile context and About Me</li>
          </ul>

          <p className="font-body-sm text-body-sm text-text-muted">
            This action is <strong className="text-text-display">permanent and irreversible.</strong>
          </p>

          <div className="flex flex-col gap-space-2xs">
            <label
              htmlFor="delete-confirm"
              className="font-label-md text-label-md text-text-display"
            >
              Type <span className="font-semibold">{initialUsername || "your username"}</span> to confirm:
            </label>
            <input
              id="delete-confirm"
              type="text"
              value={deleteConfirm}
              onChange={(e) => setDeleteConfirm(e.target.value)}
              placeholder={initialUsername || "your username"}
              autoComplete="off"
              spellCheck={false}
              className="w-full bg-surface-subtle text-text-display font-body-md text-body-md placeholder:text-text-muted rounded-lg p-space-sm border border-border-subtle focus:outline-none focus:border-red-400 focus:bg-surface-card input-focus-smooth transition-colors"
            />
          </div>

          <DialogFooter className="gap-space-sm sm:gap-space-md">
            <button
              type="button"
              onClick={() => { setDeleteOpen(false); setDeleteConfirm(""); }}
              className="flex-1 py-space-xs px-space-md rounded-full border border-border-subtle text-text-display font-label-md text-label-md hover:bg-surface-subtle transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleConfirmDelete}
              disabled={
                deleting ||
                deleteConfirm.trim() !== initialUsername ||
                !initialUsername
              }
              className="flex-1 flex items-center justify-center gap-space-xs py-space-xs px-space-md rounded-full bg-red-500 hover:bg-red-600 text-white font-label-md text-label-md font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-red-500"
            >
              {deleting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Deleting...</span>
                </>
              ) : (
                <>
                  <Trash2 className="w-4 h-4" />
                  <span>Delete permanently</span>
                </>
              )}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
