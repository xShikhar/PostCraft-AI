"use client";
import { revealDraft, clearDraftTransition } from "@/components/motion/draft-transition";
import {
  useState,
  useEffect,
  useRef,
  useCallback,
  type FormEvent,
} from "react";
import { toast } from "sonner";
import { useAuth } from "@/features/auth/hooks/use-auth";
import { type WorkspaceView } from "@/components/layout/sidebar";
import { getCurrentUser, type UserResponse } from "@/lib/api/user";
import {
  generateDrafts,
  editDraft,
  finalizeDraft,
  saveDraft,
  type Drafts,
  type FinalizeQuality,
  type GenerationParams,
} from "@/lib/api/generation";
import { getGenerationFull, type GenerationFull } from "@/lib/api/history";
export const TITLES: Record<WorkspaceView, string> = {
  home: "The studio",
  compose: "New post",
  selection: "Your variations",
  editor: "The writing room",
  profile: "Profile & Voice",
  history: "Your archive",
  privacy: "Privacy",
  terms: "Terms",
};
const VIEWS = new Set(Object.keys(TITLES));
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const draftKey = (n: number) => `draft_${n}` as keyof Drafts;
function locationState(search: string) {
  const p = new URLSearchParams(search),
    candidate = p.get("view") || "home",
    id = p.get("generation");
  return {
    view: (VIEWS.has(candidate) ? candidate : "home") as WorkspaceView,
    id: id && UUID.test(id) ? id : null,
    index: [1, 2, 3].includes(Number(p.get("draft")))
      ? Number(p.get("draft"))
      : 1,
  };
}
export function useWorkspace() {
  const { logout } = useAuth();
  const [user, setUser] = useState<UserResponse | null>(null),
    [view, setView] = useState<WorkspaceView>("home");
  const [topic, setTopic] = useState(""),
    [platform, setPlatform] = useState("linkedin"),
    [rawThoughts, setRawThoughts] = useState(""),
    [profileContext, setProfileContext] = useState(""),
    [useContext, setUseContext] = useState(true);
  const [record, updateRecord] = useState<GenerationFull | null>(null),
    [active, setActive] = useState(1),
    [buffer, setBuffer] = useState(""),
    [expectedVersion, setExpectedVersion] = useState<string | null>(null),
    [instruction, setInstruction] = useState(""),
    [busy, setBusy] = useState<string | null>(null),
    [error, setError] = useState(""),
    [elapsed, setElapsed] = useState(0),
    [profileDirty, setProfileDirty] = useState(false),
    [pending, setPending] = useState<(() => void) | null>(null);
  const [finalizeReview, setFinalizeReview] = useState<{ quality: FinalizeQuality; id: string; index: number } | null>(null);
  const [draftsReady, setDraftsReady] = useState(false);
  const recordRef = useRef<GenerationFull | null>(null);
  const historyIndex = useRef(0),
    suppressPop = useRef(false),
    replayPop = useRef(false),
    editorDirtyRef = useRef(false);
  const setRecord = (
    next:
      | GenerationFull
      | null
      | ((old: GenerationFull | null) => GenerationFull | null),
  ) => {
    const value = typeof next === "function" ? next(recordRef.current) : next;
    recordRef.current = value;
    updateRecord(value);
  };
  const profileDirtyRef = useRef(false);
  const operation = useRef<string | null>(null),
    alive = useRef(true),
    userRef = useRef<UserResponse | null>(null),
    urlRef = useRef(""),
    guardRef = useRef<(fn: () => void) => void>(() => {}),
    lastParams = useRef<GenerationParams | null>(null);
  const savedText = record?.[draftKey(active)] || "";
  const editorDirty = !!record && buffer !== savedText;
  const dirty = editorDirty || profileDirty;
  const setOperation = (value: string | null) => {
    operation.current = value;
    setBusy(value);
  };
  const writeUrl = useCallback(
    (v: WorkspaceView, id?: string | null, index = 1, replace = false) => {
      const q = new URLSearchParams();
      if (v !== "home") q.set("view", v);
      if (id && (v === "selection" || v === "editor")) {
        q.set("generation", id);
        q.set("draft", String(index));
      }
      const url = "/" + (q.size ? "?" + q.toString() : "");
      const entryIndex = replace
        ? historyIndex.current
        : historyIndex.current + 1;
      historyIndex.current = entryIndex;
      window.history[replace ? "replaceState" : "pushState"](
        { ...window.history.state, postcraftIndex: entryIndex },
        "",
        url,
      );
      urlRef.current = url;
    },
    [],
  );
  const hydrate = useCallback(
    (full: GenerationFull, index: number, v: WorkspaceView = "editor") => {
      setDraftsReady(false);
      setRecord(full);
      setActive(index);
      setTopic(full.topic);
      setRawThoughts(full.raw_thoughts);
      setPlatform(full.platform);
      setInstruction("");
      setError("");
      let text = full[draftKey(index)] || "",
        version = full.updated_at;
      const owner = userRef.current?.id;
      if (owner) {
        try {
          const stored = sessionStorage.getItem(
            `postcraft:editor:${owner}:${full.generation_id}:${index}`,
          );
          if (stored) {
            const recovery = JSON.parse(stored);
            if (
              typeof recovery.text === "string" &&
              recovery.text.length <= 20000 &&
              typeof recovery.baseVersion === "string" &&
              full.status !== "finalized"
            ) {
              text = recovery.text;
              version = recovery.baseVersion;
              if (version !== full.updated_at)
                setError(
                  "Recovered unsaved text is based on an older version. Copy it before reloading the saved version.",
                );
            }
          }
        } catch {
          /* A malformed recovery entry cannot block server data. */
        }
      }
      setBuffer(text);
      setExpectedVersion(version);
      setView(v);
    },
    [],
  );
  const openRecord = useCallback(
    async (
      id: string,
      index?: number,
      target: WorkspaceView = "editor",
      replace = false,
      writeLocation = true,
    ) => {
      if (operation.current) return;
      setOperation("load");
      setError("");
      try {
        const full = await getGenerationFull(id);
        if (!alive.current) return;
        const idx = index || full.active_draft_index || 1;
        lastParams.current = null;
        const show = () => {
          if (!alive.current) return;
          setOperation(null);
          hydrate(full, idx, target);
          if (writeLocation) writeUrl(target, id, idx, replace);
        };
        if (target === "editor") revealDraft(id, show); else show();
      } catch (e) {
        clearDraftTransition();
        if (alive.current) {
          setError(
            e instanceof Error ? e.message : "Could not open this draft.",
          );
          toast.error(
            e instanceof Error ? e.message : "Could not open this draft.",
          );
          setView("history");
          writeUrl("history", null, 1, true);
        }
      } finally {
        if (alive.current) setOperation(null);
      }
    },
    [hydrate, writeUrl],
  );
  useEffect(() => {
    alive.current = true;
    let valid = true;
    urlRef.current = window.location.pathname + window.location.search;
    historyIndex.current = window.history.state?.postcraftIndex || 0;
    getCurrentUser()
      .then((data) => {
        if (!valid) return;
        userRef.current = data;
        setUser(data);
        try {
          const input = sessionStorage.getItem(`postcraft:compose:${data.id}`);
          if (input) {
            const parsed = JSON.parse(input);
            if (
              typeof parsed.topic === "string" &&
              typeof parsed.raw_thoughts === "string"
            ) {
              setTopic(parsed.topic.slice(0, 255));
              setRawThoughts(parsed.raw_thoughts.slice(0, 5000));
              setPlatform(parsed.platform === "x" ? "x" : "linkedin");
              if (typeof parsed.profile_context === "string")
                setProfileContext(parsed.profile_context.slice(0, 3000));
              setUseContext(parsed.use_context !== false);
            }
          }
        } catch {
          /* Invalid local input is ignored. */
        }
        const state = locationState(window.location.search);
        if (state.id && (state.view === "editor" || state.view === "selection"))
          void openRecord(state.id, state.index, state.view, true);
        else {
          const next =
            state.view === "editor" || state.view === "selection"
              ? "home"
              : state.view;
          setView(next);
          writeUrl(next, null, 1, true);
        }
      })
      .catch(() => {
        if (valid)
          toast.error("Your profile could not be loaded. Refresh to retry.");
      });
    return () => {
      valid = false;
      alive.current = false;
    };
  }, [openRecord, writeUrl]);
  useEffect(() => {
    const handler = (event: Event) => {
      profileDirtyRef.current = !!(event as CustomEvent<boolean>).detail;
      setProfileDirty(profileDirtyRef.current);
    };
    window.addEventListener("postcraft:profile-dirty", handler);
    return () => window.removeEventListener("postcraft:profile-dirty", handler);
  }, []);
  useEffect(() => {
    if (!user || view !== "compose") return;
    sessionStorage.setItem(
      `postcraft:compose:${user.id}`,
      JSON.stringify({
        topic,
        raw_thoughts: rawThoughts,
        platform,
        profile_context: profileContext,
        use_context: useContext,
      }),
    );
  }, [user, view, topic, rawThoughts, platform, profileContext, useContext]);
  useEffect(() => {
    if (!user || !record) return;
    const key = `postcraft:editor:${user.id}:${record.generation_id}:${active}`;
    if (editorDirty)
      sessionStorage.setItem(
        key,
        JSON.stringify({ text: buffer, baseVersion: expectedVersion }),
      );
    else sessionStorage.removeItem(key);
  }, [user, record, active, buffer, editorDirty, expectedVersion]);
  useEffect(() => {
    if (!dirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);
  useEffect(() => {
    if (busy !== "generate") return;
    const timer = setInterval(() => setElapsed((v) => v + 1), 1000);
    return () => clearInterval(timer);
  }, [busy]);
  const request = (action: () => void) => {
    if (operation.current) {
      toast.info("Please wait for the current operation to finish.");
      return;
    }
    if (editorDirty || profileDirtyRef.current) setPending(() => action);
    else action();
  };
  useEffect(() => {
    guardRef.current = request;
  });
  useEffect(() => {
    editorDirtyRef.current = editorDirty;
  }, [editorDirty]);
  useEffect(() => {
    const handler = (event: PopStateEvent) => {
      if (suppressPop.current) {
        suppressPop.current = false;
        return;
      }
      const target = window.location.search,
        targetUrl = window.location.pathname + target;
      const targetIndex =
        typeof event.state?.postcraftIndex === "number"
          ? event.state.postcraftIndex
          : historyIndex.current - 1;
      const delta = targetIndex - historyIndex.current || -1;
      if (
        !replayPop.current &&
        (operation.current || editorDirtyRef.current || profileDirtyRef.current)
      ) {
        suppressPop.current = true;
        window.history.go(-delta);
        if (operation.current)
          toast.info("Please wait for the current operation to finish.");
        else
          setPending(() => () => {
            replayPop.current = true;
            window.history.go(delta);
          });
        return;
      }
      replayPop.current = false;
      historyIndex.current = targetIndex;
      urlRef.current = targetUrl;
      const state = locationState(target);
      if (state.id && (state.view === "editor" || state.view === "selection"))
        void openRecord(state.id, state.index, state.view, false, false);
      else {
        const v =
          state.view === "editor" || state.view === "selection"
            ? "home"
            : state.view;
        setView(v);
        if (v !== state.view) writeUrl(v, null, 1, true);
      }
    };
    window.addEventListener("popstate", handler);
    return () => window.removeEventListener("popstate", handler);
  }, [openRecord, writeUrl]);
  const navigate = (v: WorkspaceView) =>
    request(() => {
      setDraftsReady(false);
      setView(v);
      writeUrl(v, record?.generation_id, active);
    });
  const newPost = (thought = "") =>
    request(() => {
      setDraftsReady(false);
      setRecord(null);
      setBuffer("");
      setExpectedVersion(null);
      setTopic("");
      setRawThoughts(thought);
      setProfileContext("");
      setUseContext(true);
      setInstruction("");
      setError("");
      setView("compose");
      writeUrl("compose");
    });
  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Copied to clipboard.");
    } catch {
      toast.error(
        "Clipboard access was blocked. Select and copy the text manually.",
      );
    }
  };
  const generate = async (params?: GenerationParams) => {
    if (operation.current) return;
    const input = params || {
      topic,
      platform,
      raw_thoughts: rawThoughts,
      profile_context: profileContext || undefined,
      use_context: useContext,
    };
    if (!input.topic.trim() || !input.raw_thoughts.trim()) return;
    lastParams.current = input;
    setOperation("generate");
    setElapsed(0);
    setError("");
    try {
      const data = await generateDrafts(input);
      if (!alive.current) return;
      const full: GenerationFull = {
        ...data,
        project_id: "",
        topic: input.topic,
        raw_thoughts: input.raw_thoughts,
        platform: input.platform,
        active_draft_index: 1,
        created_at: null,
        updated_at: data.updated_at,
        chat_history: [],
        sources: data.sources || [],
        quality:
          typeof data.substance_score === "number"
            ? {
                result:
                  data.status === "needs_review" ? "needs_review" : "pass",
                substance_score: data.substance_score,
                scope: "generation",
              }
            : null,
      };
      hydrate(full, 1, view === "compose" ? "compose" : "selection");
      setDraftsReady(view === "compose");
      writeUrl("selection", data.generation_id, 1);
      if (userRef.current)
        sessionStorage.removeItem(`postcraft:compose:${userRef.current.id}`);
      toast[data.status === "needs_review" ? "warning" : "success"](
        data.status === "needs_review"
          ? "Drafts are ready with quality notes to review."
          : "Three drafts are ready.",
      );
    } catch (e) {
      if (alive.current) {
        const message =
          e instanceof Error
            ? e.message
            : "Generation failed. Your input has been kept.";
        setError(message);
        toast.error(message);
      }
    } finally {
      if (alive.current) setOperation(null);
    }
  };
  const save = async (): Promise<boolean> => {
    if (!record || operation.current) return false;
    if (!editorDirty) return true;
    if (!expectedVersion) {
      setError("Reload the saved draft before saving new changes.");
      return false;
    }
    if (!buffer.trim()) {
      setError("A draft cannot be empty.");
      return false;
    }
    setOperation("save");
    setError("");
    try {
      const data = await saveDraft(
        record.generation_id,
        active,
        buffer,
        expectedVersion,
      );
      if (!alive.current) return false;
      setRecord((previous) =>
        previous
          ? {
              ...previous,
              [draftKey(active)]: data.content,
              updated_at: data.updated_at,
              status: data.status,
              quality: null,
            }
          : previous,
      );
      setBuffer(data.content);
      setExpectedVersion(data.updated_at);
      if (userRef.current)
        sessionStorage.removeItem(
          `postcraft:editor:${userRef.current.id}:${record.generation_id}:${active}`,
        );
      toast.success("Your changes are saved.");
      return true;
    } catch (e) {
      if (alive.current) {
        setError(
          e instanceof Error
            ? e.message
            : "Save failed. Your text is still here.",
        );
        toast.error(e instanceof Error ? e.message : "Could not save.");
      }
      return false;
    } finally {
      if (alive.current) setOperation(null);
    }
  };
  const refine = async (e: FormEvent) => {
    e.preventDefault();
    if (
      !record ||
      !instruction.trim() ||
      operation.current ||
      record.status === "finalized"
    )
      return;
    const run = async () => {
      setOperation("edit");
      setError("");
      const text = instruction.trim();
      try {
        const revised = await editDraft(record.generation_id, active, text);
        if (!alive.current) return;
        setInstruction("");
        setRecord((prev) =>
          prev
            ? {
                ...prev,
                [draftKey(active)]: revised.revised_draft,
                updated_at: null,
                status: revised.status,
                quality: null,
                chat_history: [
                  ...prev.chat_history,
                  { role: "user", content: text, draft_index: active },
                  {
                    role: "assistant",
                    content: revised.reply || "Draft revised.",
                    draft_index: active,
                  },
                ],
              }
            : prev,
        );
        setBuffer(revised.revised_draft);
        setExpectedVersion(null);
        try {
          const full = await getGenerationFull(record.generation_id);
          if (alive.current) hydrate(full, active, "editor");
        } catch {
          setError(
            "The revision was saved, but the latest version could not be loaded. Reload before further edits.",
          );
        }
        toast.success("Your draft has been refined.");
      } catch (err) {
        if (alive.current) {
          setError(err instanceof Error ? err.message : "Revision failed.");
          toast.error(err instanceof Error ? err.message : "Revision failed.");
        }
      } finally {
        if (alive.current) setOperation(null);
      }
    };
    request(() => void run());
  };
  const finalize = (reviewToken?: string) => {
    if (!record || record.status === "finalized" || operation.current) return;
    if (reviewToken && (finalizeReview?.id !== record.generation_id || finalizeReview.index !== active || editorDirty)) { setFinalizeReview(null); return; }
    request(
      () =>
        void (async () => {
          setOperation("finalize");
          setError("");
          try {
            const result = await finalizeDraft(record.generation_id, active, reviewToken);
            if (!alive.current) return;
            if (result.status === "needs_review" && result.quality) {
              setRecord(prev => prev ? { ...prev, quality: result.quality, status: "needs_review", updated_at: result.updated_at || prev.updated_at } : prev);
              if (result.updated_at) setExpectedVersion(result.updated_at);
              setFinalizeReview({ quality: result.quality, id: record.generation_id, index: active });
              return;
            }
            if (result.status !== "finalized") throw new Error("Finalization did not complete. Please try again.");
            setFinalizeReview(null);
            setRecord((prev) =>
              prev
                ? { ...prev, status: "finalized", active_draft_index: active, quality: result.quality || prev.quality }
                : prev,
            );
            toast.success("Draft finalized. Your refinements have been saved.");
            if (result.warning) toast.info(result.warning);
          } catch (e) {
            if (alive.current) {
              setError(e instanceof Error ? e.message : "Finalization failed.");
              toast.error(
                e instanceof Error ? e.message : "Could not finalize.",
              );
            }
          } finally {
            if (alive.current) setOperation(null);
          }
        })(),
    );
  };
  const switchDraft = (index: number) =>
    request(() => {
      const latest = recordRef.current;
      if (!latest) return;
      hydrate(latest, index, "editor");
      writeUrl("editor", latest.generation_id, index);
    });
  const discard = () => {
    if (user && record)
      sessionStorage.removeItem(
        `postcraft:editor:${user.id}:${record.generation_id}:${active}`,
      );
    setBuffer(savedText);
    setProfileDirty(false);
    setError("");
    const action = pending;
    setPending(null);
    action?.();
  };
  const evidence = record
    ? {
        sources: record.sources,
        research_source: record.research_source,
        research_confidence: record.research_confidence,
        research_retrieved_at: record.research_retrieved_at,
      }
    : { sources: [] };
  const drafts = record
    ? {
        draft_1: record.draft_1 || "",
        draft_2: record.draft_2 || "",
        draft_3: record.draft_3 || "",
      }
    : null;
  return {
    setView,
    user,
    view,
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
    record,
    active,
    buffer,
    setBuffer,
    instruction,
    setInstruction,
    busy,
    error,
    elapsed,
    draftsReady,
    profileDirty,
    pending,
    setPending,
    editorDirty,
    navigate,
    newPost,
    request,
    openRecord,
    writeUrl,
    logout,
    copy,
    generate,
    refine,
    save,
    finalize,
    finalizeReview,
    setFinalizeReview,
    switchDraft,
    discard,
    evidence,
    drafts,
    lastParams,
  };
}
