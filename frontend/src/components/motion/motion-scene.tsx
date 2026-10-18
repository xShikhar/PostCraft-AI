"use client";

import { useRef, type ReactNode } from "react";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(useGSAP, ScrollTrigger);

/** Each scene owns its effects, including nodes delivered by async API calls. */
export function MotionScene({ children, scene }: { children: ReactNode; scene: string }) {
  const root = useRef<HTMLDivElement>(null);
  useGSAP(() => {
    const container = root.current;
    if (!container) return;
    const media = gsap.matchMedia();
    media.add({ all: "all", reduced: "(prefers-reduced-motion: reduce)", fine: "(hover: hover) and (pointer: fine)" }, (mediaContext) => {
      const full = !mediaContext.conditions?.reduced && mediaContext.conditions?.fine;
      container.dataset.motionPolicy = mediaContext.conditions?.reduced ? "reduced" : full ? "full" : "coarse";
      if (!full) return;
      const effects = new Map<HTMLElement, () => void>();
      const seen = new WeakSet<HTMLElement>();
      const resets = new Set<() => void>();
      const discover = () => {
        // Removed status messages must not accumulate during a long writing session.
        effects.forEach((cleanup, element) => {
          if (!container.contains(element)) { cleanup(); effects.delete(element); }
        });
        container.querySelectorAll<HTMLElement>("[data-motion]").forEach((element, index) => {
          if (seen.has(element)) return;
          seen.add(element);
          const listeners: (() => void)[] = [];
          const local = gsap.context(() => {
            const kind = element.dataset.motion;
            const editable = !!element.querySelector("input, textarea, [contenteditable=true]");
            if (kind === "bar") {
              gsap.fromTo(element, { scaleY: 0.15, transformOrigin: "bottom" }, { scaleY: 1, duration: 0.5, delay: Math.min(index * 0.035, 0.2), clearProps: "transform,transformOrigin", scrollTrigger: { trigger: element, start: "top 96%", once: true } });
            } else if (kind === "feedback") {
              gsap.fromTo(element, { opacity: 0.65 }, { opacity: 1, duration: 0.22, clearProps: "opacity" });
            } else {
              gsap.fromTo(element, { opacity: 0.85, y: editable ? 0 : kind === "heading" ? 8 : 12 }, { opacity: 1, y: 0, duration: 0.48, ease: "power2.out", delay: Math.min(index * 0.035, 0.16), clearProps: "opacity,transform", scrollTrigger: { trigger: element, start: "top 96%", once: true } });
            }
            if (kind !== "card" || editable) return;
            const x = gsap.quickTo(element, "rotationX", { duration: 0.35, ease: "power2.out" });
            const y = gsap.quickTo(element, "rotationY", { duration: 0.35, ease: "power2.out" });
            let bounds: DOMRect | null = null;
            const enter = () => { bounds = element.getBoundingClientRect(); };
            const move = (event: PointerEvent) => {
              if (!bounds || element.contains(document.activeElement)) return;
              x(gsap.utils.clamp(-1.5, 1.5, -(event.clientY - bounds.top - bounds.height / 2) / bounds.height * 2.4));
              y(gsap.utils.clamp(-1.5, 1.5, (event.clientX - bounds.left - bounds.width / 2) / bounds.width * 2.4));
            };
            const reset = () => { bounds = null; x(0); y(0); };
            resets.add(reset);
            element.addEventListener("pointerenter", enter);
            element.addEventListener("pointermove", move);
            element.addEventListener("pointerleave", reset);
            element.addEventListener("focusin", reset);
            listeners.push(() => {
              resets.delete(reset);
              element.removeEventListener("pointerenter", enter);
              element.removeEventListener("pointermove", move);
              element.removeEventListener("pointerleave", reset);
              element.removeEventListener("focusin", reset);
            });
          });
          effects.set(element, () => {
            listeners.forEach((cleanup) => cleanup());
            local.revert();
          });
        });
      };
      // Nested contexts have individual lifetimes; the observer prunes removed nodes.
      mediaContext.ignore(discover);
      const observer = new MutationObserver(() => mediaContext.ignore(discover));
      observer.observe(container, { childList: true, subtree: true });
      const resetAll = () => resets.forEach((reset) => reset());
      window.addEventListener("scroll", resetAll, { passive: true, capture: true });
      window.addEventListener("resize", resetAll, { passive: true });
      window.addEventListener("blur", resetAll);
      document.addEventListener("visibilitychange", resetAll);
      return () => {
        observer.disconnect();
        window.removeEventListener("scroll", resetAll, true);
        window.removeEventListener("resize", resetAll);
        window.removeEventListener("blur", resetAll);
        document.removeEventListener("visibilitychange", resetAll);
        effects.forEach((cleanup) => cleanup());
        effects.clear();
      };
    });
    return () => media.revert();
  }, { scope: root, dependencies: [scene], revertOnUpdate: true });
  return <div ref={root} className="motion-scene min-w-0" data-motion-scene={scene}>{children}</div>;
}
