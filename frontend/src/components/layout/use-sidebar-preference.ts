"use client";
import { useSyncExternalStore } from "react";
const key = "postcraft:sidebar-collapsed";
const eventName = "postcraft:sidebar-change";
let live: boolean | undefined;
function snapshot() {
  if (live !== undefined) return live;
  try { return localStorage.getItem(key) === "true"; } catch { return false; }
}
function subscribe(notify: () => void) {
  const storage = (event: StorageEvent) => {
    if (event.key !== null && event.key !== key) return;
    live = undefined;
    notify();
  };
  window.addEventListener(eventName, notify);
  window.addEventListener("storage", storage);
  return () => {
    window.removeEventListener(eventName, notify);
    window.removeEventListener("storage", storage);
  };
}
export function useSidebarPreference() {
  const collapsed = useSyncExternalStore(subscribe, snapshot, () => false);
  const toggle = () => {
    live = !snapshot();
    try { localStorage.setItem(key, String(live)); } catch { /* Live control remains usable. */ }
    window.dispatchEvent(new Event(eventName));
  };
  return { collapsed, toggle };
}
