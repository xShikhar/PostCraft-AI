import { flushSync } from "react-dom";

/** Start the visual handoff only after the server has authenticated the user. */
export async function enterStudio(update: () => void) {
  if (!document.startViewTransition || document.documentElement.dataset.motionPaused !== "false" ||
      matchMedia("(prefers-reduced-motion: reduce)").matches) { update(); return; }
  let applied = false;
  const apply = () => { if (!applied) { applied = true; flushSync(update); } };
  document.documentElement.dataset.studioEntry = "true";
  try {
    const transition = document.startViewTransition(apply);
    const stop = () => transition.skipTransition();
    const media = matchMedia("(prefers-reduced-motion: reduce)");
    window.addEventListener("postcraft:motion-change", stop);
    media.addEventListener("change", stop);
    void transition.finished.catch(() => {}).finally(() => {
      delete document.documentElement.dataset.studioEntry;
      window.removeEventListener("postcraft:motion-change", stop);
      media.removeEventListener("change", stop);
    });
    await transition.updateCallbackDone;
  } catch (error) {
    delete document.documentElement.dataset.studioEntry;
    if (!applied) apply(); else throw error;
  }
}
