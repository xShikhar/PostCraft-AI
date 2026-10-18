"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowUpRight, Download, FileText, Loader2, LogOut, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { getCurrentUser, updateCurrentUser, deleteMyAccount, type UserUpdate } from "@/lib/api/user";
import { getResume, uploadResume, deleteResume, updateResume, type ResumeResponse } from "@/lib/api/resume";
import { getStyleProfile, type StyleProfileDimensions } from "@/lib/api/style-profile";
import { fetchApi } from "@/lib/api/client";
import { useAuth } from "@/features/auth/hooks/use-auth";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

type FieldKey = "about_me" | "profile_context" | "writing_style";
const fields: { key: FieldKey; title: string; description: string; placeholder: string; limit: number }[] = [
  { key: "about_me", title: "A little about you", description: "Your role, interests and perspective. Give your writing a human starting point.", placeholder: "I’m a founder working at the intersection of…", limit: 2000 },
  { key: "profile_context", title: "Experience & background", description: "The work, expertise and experiences your drafts can draw on.", placeholder: "What have you learned, built or helped others understand?", limit: 3000 },
  { key: "writing_style", title: "Your writing voice", description: "Tell us how you like to sound. Specific examples are welcome.", placeholder: "Direct and thoughtful. Short paragraphs, practical examples…", limit: 2000 },
];
const blank = { about_me: "", profile_context: "", writing_style: "" };
const errorMessage = (error: unknown) => error instanceof Error ? error.message : "Something went wrong. Please try again.";

export interface ProfilePageProps { onBack: () => void }
export function ProfilePage({ onBack }: ProfilePageProps) {
  const { logout } = useAuth();
  const [values, setValues] = useState(blank);
  const [saved, setSaved] = useState(blank);
  const [username, setUsername] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [retry, setRetry] = useState(0);
  const [saving, setSaving] = useState<Partial<Record<FieldKey, boolean>>>({});
  const [feedback, setFeedback] = useState<Partial<Record<FieldKey, string>>>({});
  const [errors, setErrors] = useState<Partial<Record<FieldKey, string>>>({});
  const [resume, setResume] = useState<ResumeResponse | null>(null);
  const [resumeError, setResumeError] = useState("");
  const [resumeBusy, setResumeBusy] = useState(false);
  const [resumeEditing, setResumeEditing] = useState(false);
  const [resumeText, setResumeText] = useState("");
  const [removeOpen, setRemoveOpen] = useState(false);
  const [style, setStyle] = useState<StyleProfileDimensions | null>(null);
  const [styleError, setStyleError] = useState("");
  const [exporting, setExporting] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const [leaveAction, setLeaveAction] = useState<"back" | "logout" | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const dirty = fields.some(({ key }) => values[key] !== saved[key]) || (resumeEditing && resumeText !== (resume?.raw_text ?? ""));

  useEffect(() => {
    let active = true;
    const load = async () => {
      const [userResult, resumeResult, styleResult] = await Promise.allSettled([getCurrentUser(), getResume(), getStyleProfile()]);
      if (!active) return;
      if (userResult.status === "fulfilled") {
        const user = userResult.value;
        const background = user.profile_context ?? "";
        const legacyStyle = background.match(/\[writing_style\]\s*([\s\S]*)$/)?.[1]?.trim() ?? "";
        const initial = { about_me: user.about_me ?? "", profile_context: background.replace(/\[writing_style\]\s*[\s\S]*$/, "").trim(), writing_style: user.writing_style || legacyStyle };
        setValues(initial); setSaved(initial); setUsername(user.username); setLoadError("");
      } else setLoadError(errorMessage(userResult.reason));
      if (resumeResult.status === "fulfilled") { setResume(resumeResult.value); setResumeText(resumeResult.value?.raw_text ?? ""); setResumeError(""); }
      else setResumeError(errorMessage(resumeResult.reason));
      if (styleResult.status === "fulfilled") { setStyle(styleResult.value.current); setStyleError(""); }
      else setStyleError(errorMessage(styleResult.reason));
      setLoading(false);
    };
    void load();
    return () => { active = false; };
  }, [retry]);

  useEffect(() => {
    window.dispatchEvent(new CustomEvent("postcraft:profile-dirty", { detail: dirty }));
    if (!dirty) return;
    const preventLeave = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", preventLeave);
    return () => { window.removeEventListener("beforeunload", preventLeave); window.dispatchEvent(new CustomEvent("postcraft:profile-dirty", { detail: false })); };
  }, [dirty]);

  const leave = (action: "back" | "logout") => { if (dirty) setLeaveAction(action); else if (action === "logout") logout(); else onBack(); };
  const save = async (key: FieldKey) => {
    const submitted = values[key];
    setSaving(previous => ({ ...previous, [key]: true })); setErrors(previous => ({ ...previous, [key]: "" }));
    try {
      await updateCurrentUser({ [key]: submitted } as UserUpdate);
      setSaved(previous => ({ ...previous, [key]: submitted })); setFeedback(previous => ({ ...previous, [key]: "Saved" }));
    } catch (error) { setErrors(previous => ({ ...previous, [key]: errorMessage(error) })); }
    finally { setSaving(previous => ({ ...previous, [key]: false })); }
  };
  const upload = async (file?: File) => {
    if (!file) return;
    if (file.size > 5 * 1024 * 1024 || !/\.(pdf|docx|txt|md)$/i.test(file.name)) { setResumeError("Choose a PDF, DOCX, TXT or Markdown file up to 5 MB."); return; }
    setResumeBusy(true); setResumeError("");
    try { const result = await uploadResume(file); setResume(result); setResumeText(result.raw_text); setResumeEditing(false); toast.success("Resume saved."); }
    catch (error) { setResumeError(errorMessage(error)); }
    finally { setResumeBusy(false); if (fileInput.current) fileInput.current.value = ""; }
  };
  const saveResume = async () => {
    setResumeBusy(true); setResumeError("");
    try { const result = await updateResume(resumeText); setResume(result); setResumeText(result.raw_text); setResumeEditing(false); toast.success("Resume text saved."); }
    catch (error) { setResumeError(errorMessage(error)); }
    finally { setResumeBusy(false); }
  };
  const removeResume = async () => {
    setResumeBusy(true); setResumeError("");
    try { await deleteResume(); setResume(null); setResumeText(""); setResumeEditing(false); setRemoveOpen(false); toast.success("Resume removed."); }
    catch (error) { setResumeError(errorMessage(error)); }
    finally { setResumeBusy(false); }
  };
  const exportData = async () => {
    setExporting(true);
    try {
      const data = await fetchApi<unknown>("/api/users/me/export");
      const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
      const link = document.createElement("a"); link.href = url; link.download = "postcraft-export.json"; document.body.appendChild(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
      toast.success("Your data export is ready.");
    } catch (error) { toast.error(errorMessage(error)); }
    finally { setExporting(false); }
  };
  const deleteAccount = async () => {
    if (!username || deleteConfirm !== username) return;
    setDeleting(true); setDeleteError("");
    try { const result = await deleteMyAccount(); try { sessionStorage.setItem("postcraft:post_delete_notice", result.message); } catch {} logout(); }
    catch (error) { setDeleteError(errorMessage(error)); }
    finally { setDeleting(false); }
  };

  return <div className="workspace-enter mx-auto w-full max-w-5xl space-y-10 pb-12">
    <header className="space-y-5">
      <button className="btn-secondary" onClick={() => leave("back")}><ArrowLeft size={16} /> Back to workspace</button>
      <div><p className="eyebrow mb-3">Your creative foundation</p><h1 className="page-title">Make it sound like you.</h1><p className="mt-4 max-w-xl text-base leading-7 text-text-muted">A little context goes a long way. Shape the background and voice behind your next draft.</p></div>
    </header>
    {loading ? <div role="status" className="paper flex items-center gap-3 p-8"><Loader2 className="animate-spin" size={20} /> Loading your profile…</div> : loadError ? <div role="alert" className="paper space-y-4 p-8"><p>We couldn’t load your profile. {loadError}</p><button className="btn-secondary" onClick={() => { setLoading(true); setRetry(n => n + 1); }}>Try again</button></div> : <>
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_250px]">
        <div className="space-y-6">
          {fields.map(({ key, title, description, placeholder, limit }, index) => <section key={key} className="paper p-6 sm:p-8">
            <p className="eyebrow mb-3">0{index + 1} / {key === "writing_style" ? "Voice" : key === "about_me" ? "Identity" : "Background"}</p>
            <h2 className="font-serif text-2xl text-text-display"><label htmlFor={`profile-${key}`}>{title}</label></h2>
            <p id={`${key}-help`} className="mt-3 max-w-lg text-sm leading-6 text-text-muted">{description}</p>
            <textarea id={`profile-${key}`} aria-describedby={`${key}-help ${key}-count`} className="field mt-6 min-h-40 w-full resize-y leading-7" rows={5} maxLength={limit} value={values[key]} placeholder={placeholder} onChange={event => { setValues(previous => ({ ...previous, [key]: event.target.value })); setFeedback(previous => ({ ...previous, [key]: "" })); }} />
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3"><span id={`${key}-count`} className="text-xs tabular-nums text-text-muted">{values[key].length.toLocaleString()} / {limit.toLocaleString()} characters</span><div className="flex flex-wrap items-center justify-end gap-3"><span role="status" className="text-sm text-text-muted">{values[key] !== saved[key] ? "Unsaved changes" : feedback[key]}</span><button className="btn-primary" disabled={saving[key] || values[key] === saved[key]} onClick={() => void save(key)}>{saving[key] ? "Saving…" : "Save changes"}</button></div></div>
            {errors[key] && <p role="alert" className="mt-4 text-sm text-red-700 dark:text-red-300">{errors[key]}</p>}
          </section>)}
        </div>
        <aside className="space-y-6 lg:pt-3"><div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 font-serif text-2xl text-primary" aria-hidden="true">{username.slice(0, 1).toUpperCase()}</div><div><p className="break-words text-lg font-semibold text-text-display">{username}</p><p className="mt-2 text-sm leading-6 text-text-muted">Your profile is optional. Add what helps, and return whenever your perspective evolves.</p></div><div className="border-t border-border-subtle pt-6"><p className="eyebrow mb-3">A useful starting point</p><p className="text-sm leading-6 text-text-muted">What do you know well? Who are you writing for? How would you explain it to a friend?</p></div></aside>
      </div>
      <section className="paper p-6 sm:p-8"><p className="eyebrow mb-3">04 / Source material</p><h2 className="font-serif text-2xl text-text-display">Your resume</h2><p className="mt-3 text-sm leading-6 text-text-muted">Add professional context from an existing document. Review and edit the extracted text.</p>
        <input ref={fileInput} type="file" className="sr-only" aria-label="Upload resume" accept=".pdf,.docx,.txt,.md" disabled={resumeBusy || resumeEditing} onChange={event => void upload(event.target.files?.[0])} />
        {resume ? <div className="mt-6 flex flex-wrap items-center justify-between gap-5 rounded-xl border border-border-subtle p-5"><div className="flex min-w-0 items-center gap-3"><FileText size={22} className="shrink-0 text-primary" /><div className="min-w-0"><p className="break-words font-medium text-text-display">{resume.filename}</p><p className="mt-1 text-xs text-text-muted">{resume.raw_text_length.toLocaleString()} characters extracted{resume.structured_summary?.role ? ` · ${resume.structured_summary.role}` : ""}</p></div></div><div className="flex flex-wrap gap-2"><button className="btn-secondary" disabled={resumeBusy || resumeEditing} onClick={() => { setResumeText(resume.raw_text); setResumeEditing(true); }}>Review text <ArrowUpRight size={14} /></button><button className="icon-button" aria-label="Remove resume" disabled={resumeBusy} onClick={() => setRemoveOpen(true)}><Trash2 size={17} /></button></div></div> : <div className="mt-6 rounded-xl border border-dashed border-border-subtle p-6"><p className="mb-4 text-sm text-text-muted">No resume added yet.</p><button className="btn-secondary" disabled={resumeBusy || Boolean(resumeError)} onClick={() => fileInput.current?.click()}><Upload size={16} />{resumeBusy ? "Processing resume…" : "Choose a document"}</button><p className="mt-3 text-xs text-text-muted">PDF, DOCX, TXT or Markdown · Up to 5 MB</p></div>}
        {resume && !resumeEditing && <button className="btn-secondary mt-4" disabled={resumeBusy} onClick={() => fileInput.current?.click()}><Upload size={16} />{resumeBusy ? "Processing…" : "Replace document"}</button>}
        {resumeEditing && <div className="mt-6 space-y-4"><label className="block text-sm font-medium" htmlFor="resume-text">Extracted resume text</label><textarea id="resume-text" className="field min-h-64 w-full leading-7" maxLength={100000} value={resumeText} onChange={event => setResumeText(event.target.value)} /><p className="text-xs text-text-muted">{resumeText.length.toLocaleString()} / 100,000 characters</p><div className="flex flex-wrap gap-3"><button className="btn-primary" disabled={resumeBusy || !resumeText.trim() || resumeText === resume?.raw_text} onClick={() => void saveResume()}>{resumeBusy ? "Saving…" : "Save resume text"}</button><button className="btn-secondary" disabled={resumeBusy} onClick={() => { setResumeText(resume?.raw_text ?? ""); setResumeEditing(false); }}>Cancel edits</button></div></div>}
        {resumeError && <div role="alert" className="mt-4 space-y-3 text-sm text-red-700 dark:text-red-300"><p>{resumeError}</p><button className="btn-secondary" onClick={() => { setResumeError(""); if (!resume) void getResume().then(result => { setResume(result); setResumeText(result?.raw_text ?? ""); }).catch(error => setResumeError(errorMessage(error))); }}>Try again</button></div>}
      </section>
      <section className="paper p-6 sm:p-8"><p className="eyebrow mb-3">05 / Learned from your choices</p><h2 className="font-serif text-2xl text-text-display">An evolving voice</h2><p className="mt-3 text-sm leading-6 text-text-muted">Your finalized drafts help shape future suggestions.</p>{styleError ? <div role="alert" className="mt-6 space-y-3"><p className="text-sm text-text-muted">Couldn’t load your learned voice. {styleError}</p><button className="btn-secondary" onClick={() => void getStyleProfile().then(result => { setStyle(result.current); setStyleError(""); }).catch(error => setStyleError(errorMessage(error)))}>Try again</button></div> : style ? <><p className="mt-5 text-xs uppercase tracking-wider text-primary">{style.platform === "x" ? "X" : style.platform === "linkedin" ? "LinkedIn" : style.platform} voice profile</p><dl className="mt-6 grid gap-x-8 gap-y-6 sm:grid-cols-2">{(["structure", "tone", "pacing", "storytelling_technique", "formatting", "cta_style"] as const).map(key => <div key={key} className="border-t border-border-subtle pt-4"><dt className="text-xs font-semibold uppercase tracking-wider text-text-muted">{key.replaceAll("_", " ")}</dt><dd className="mt-2 text-sm leading-6 text-text-display">{style[key] || "Not learned yet"}</dd></div>)}</dl></> : <p className="mt-6 rounded-xl bg-surface-subtle p-5 text-sm leading-6 text-text-muted">Your voice profile is still a blank page. Finalize a draft to start learning from your choices.</p>}</section>
      <section className="paper p-6 sm:p-8"><p className="eyebrow mb-3">06 / Your account</p><h2 className="font-serif text-2xl text-text-display">Your data, your decision.</h2><div className="mt-6 grid gap-8 sm:grid-cols-2"><div><p className="text-sm leading-6 text-text-muted">Download your saved account data as a JSON file.</p><button className="btn-secondary mt-4" disabled={exporting} onClick={() => void exportData()}><Download size={16} />{exporting ? "Preparing export…" : "Export my data"}</button></div><div><p className="text-sm leading-6 text-text-muted">Ready to leave? Sign out of this session.</p><button className="btn-secondary mt-4" onClick={() => leave("logout")}><LogOut size={16} /> Sign out</button></div></div><div className="mt-8 flex flex-wrap items-center justify-between gap-4 border-t border-border-subtle pt-6"><div><h3 className="font-semibold text-text-display">Delete account</h3><p className="mt-2 text-sm leading-6 text-text-muted">Permanently remove your account and associated data.</p></div><button className="btn-secondary text-red-700 dark:text-red-300" onClick={() => { setDeleteOpen(true); setDeleteConfirm(""); setDeleteError(""); }}><Trash2 size={16} /> Delete account</button></div></section>
    </>}
    <Dialog open={removeOpen} onOpenChange={open => { if (!resumeBusy) setRemoveOpen(open); }}><DialogContent><DialogHeader><DialogTitle>Remove your resume?</DialogTitle><DialogDescription>“{resume?.filename}” and its extracted text will be removed. Future drafts will no longer use this resume.</DialogDescription></DialogHeader>{resumeError && <p role="alert" className="text-sm text-red-700 dark:text-red-300">{resumeError}</p>}<DialogFooter><button className="btn-secondary" disabled={resumeBusy} onClick={() => setRemoveOpen(false)}>Keep resume</button><button className="btn-primary" disabled={resumeBusy} onClick={() => void removeResume()}>{resumeBusy ? "Removing…" : "Remove resume"}</button></DialogFooter></DialogContent></Dialog>
    <Dialog open={deleteOpen} onOpenChange={open => { if (!deleting) setDeleteOpen(open); }}><DialogContent><DialogHeader><DialogTitle>Delete your account permanently?</DialogTitle><DialogDescription>Your profile, saved drafts and associated data will be removed. This cannot be undone. Type your username, {username}, to confirm.</DialogDescription></DialogHeader><label htmlFor="delete-confirm" className="text-sm font-medium">Your username</label><input id="delete-confirm" className="field" autoComplete="off" value={deleteConfirm} onChange={event => setDeleteConfirm(event.target.value)} />{deleteError && <p role="alert" className="text-sm text-red-700 dark:text-red-300">{deleteError}</p>}<DialogFooter><button className="btn-secondary" disabled={deleting} onClick={() => setDeleteOpen(false)}>Keep my account</button><button className="btn-primary" disabled={deleting || !username || deleteConfirm !== username} onClick={() => void deleteAccount()}>{deleting ? "Deleting…" : "Delete permanently"}</button></DialogFooter></DialogContent></Dialog>
    <Dialog open={Boolean(leaveAction)} onOpenChange={open => { if (!open) setLeaveAction(null); }}><DialogContent><DialogHeader><DialogTitle>Leave unsaved changes?</DialogTitle><DialogDescription>Your profile has unsaved edits. Stay here to save them, or discard them and continue.</DialogDescription></DialogHeader><DialogFooter><button className="btn-secondary" onClick={() => setLeaveAction(null)}>Keep editing</button><button className="btn-primary" onClick={() => { const action = leaveAction; setLeaveAction(null); window.dispatchEvent(new CustomEvent("postcraft:profile-dirty", { detail: false })); if (action === "logout") logout(); else onBack(); }}>Discard and {leaveAction === "logout" ? "sign out" : "leave"}</button></DialogFooter></DialogContent></Dialog>
  </div>;
}
