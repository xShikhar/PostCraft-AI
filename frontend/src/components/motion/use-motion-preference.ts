"use client";
import { useEffect, useState } from "react";

export const MOTION_EVENT = "postcraft:motion-change";
export const MOTION_STORAGE = "postcraft:motion-paused";
let livePreference: boolean | undefined;

export function setMotionPaused(value: boolean) {
  livePreference = value;
  try { localStorage.setItem(MOTION_STORAGE, String(value)); } catch { /* Live control remains available when storage is full or blocked. */ }
  window.dispatchEvent(new CustomEvent(MOTION_EVENT, { detail: { paused: value } }));
}

/** OS reduction is always honored; the in-app switch can also pause all effects. */
export function useMotionPreference() {
  const [paused, setPaused] = useState(true);
  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = (event?: Event) => {
      if (event?.type === "storage") {
        const key = (event as StorageEvent).key;
        if (key !== null && key !== MOTION_STORAGE) return;
        livePreference = undefined;
      }
      if (event?.type === MOTION_EVENT) {
        const detail = (event as CustomEvent<{ paused?: boolean }>).detail;
        livePreference = typeof detail?.paused === "boolean" ? detail.paused : undefined;
      }
      let saved = livePreference;
      if (saved === undefined) {
        try { saved = localStorage.getItem(MOTION_STORAGE) === "true"; } catch { saved = false; }
      }
      const value = media.matches || saved;
      document.documentElement.dataset.motionPaused = String(value);
      setPaused(value);
    };
    sync();
    media.addEventListener("change", sync);
    window.addEventListener(MOTION_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      media.removeEventListener("change", sync);
      window.removeEventListener(MOTION_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);
  return paused;
}
