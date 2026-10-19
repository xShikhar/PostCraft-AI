import { flushSync } from "react-dom";
let source: { id: string; element: HTMLElement; time: number } | undefined;
export function prepareDraftTransition(id: string, element: HTMLElement) {
  source = { id, element, time: performance.now() };
}
export function clearDraftTransition() { source = undefined; }
export function hasDraftTransitionSource() { return !!source?.element.isConnected; }
/** Fetching stays outside the snapshot. A failed request never produces a transition. */
export function revealDraft(id: string, update: () => void) {
  const origin = source;
  source = undefined;
  if (!origin || origin.id !== id || !origin.element.isConnected || performance.now() - origin.time > 10000 ||
    !document.startViewTransition || document.documentElement.dataset.motionPaused !== "false" ||
    matchMedia("(prefers-reduced-motion: reduce)").matches) { update(); return; }
  origin.element.style.viewTransitionName = "draft-paper";
  let applied = false;
  const apply = () => { if (!applied) { applied = true; flushSync(update); } };
  try {
    const transition = document.startViewTransition(apply);
    const media = matchMedia("(prefers-reduced-motion: reduce)");
    const stop = () => transition.skipTransition();
    window.addEventListener("postcraft:motion-change", stop);
    media.addEventListener("change", stop);
    // Unsupported snapshots or interrupted transitions must never prevent navigation.
    void transition.updateCallbackDone.catch(() => apply());
    void transition.finished.catch(() => {}).finally(() => { origin.element.style.removeProperty("view-transition-name"); window.removeEventListener("postcraft:motion-change", stop); media.removeEventListener("change", stop); });
  } catch {
    origin.element.style.removeProperty("view-transition-name");
    apply();
  }
}
