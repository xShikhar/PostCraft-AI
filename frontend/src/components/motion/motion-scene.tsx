"use client";

import { useRef, type ReactNode } from "react";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useMotionPreference } from "./use-motion-preference";

gsap.registerPlugin(useGSAP, ScrollTrigger);

/** Each scene owns its effects, including nodes delivered by async API calls. */
export function MotionScene({ children, scene }: { children: ReactNode; scene: string }) {
  const root = useRef<HTMLDivElement>(null);
  const paused = useMotionPreference();
  useGSAP(() => {
    const container = root.current;
    if (!container) return;
    const media = gsap.matchMedia();
    media.add({ all: "all", reduced: "(prefers-reduced-motion: reduce)", fine: "(hover: hover) and (pointer: fine)" }, (mediaContext) => {
      const full = !paused && !mediaContext.conditions?.reduced && mediaContext.conditions?.fine;
      container.dataset.motionPolicy = mediaContext.conditions?.reduced || paused ? "reduced" : full ? "full" : "coarse";
      if (!full) return;
      const rule = container.querySelector(".motion-scene-rule");
      gsap.timeline().to(rule, { scaleX: 1, duration: 0.65, ease: "expo.out" }).to(rule, { scaleX: 0, transformOrigin: "right", duration: 0.6, ease: "power3.inOut" }, 0.7);
      gsap.fromTo(container.querySelector(".motion-scene-echo"), { x: 90, opacity: 0, clipPath: "inset(0 100% 0 0)" }, { x: 0, opacity: 0.055, clipPath: "inset(0 0% 0 0)", duration: 1.2, ease: "power3.out" });
      const effects = new Map<HTMLElement, () => void>();
      const seen = new WeakSet<HTMLElement>();
      const resets = new Set<() => void>();
      const discover = () => {
        // Removed status messages must not accumulate during a long writing session.
        effects.forEach((cleanup, element) => {
          if (!container.contains(element)) { cleanup(); effects.delete(element); }
        });
        container.querySelectorAll<HTMLElement>("[data-motion], .btn-primary, .btn-secondary, .icon-button").forEach((element, index) => {
          if (seen.has(element)) return;
          seen.add(element);
          const listeners: (() => void)[] = [];
          const local = gsap.context(() => {
            const kind = element.dataset.motion;
            const editable = !!element.querySelector("input, textarea, [contenteditable=true]");
            if (kind === "heading") {
              const words = element.querySelectorAll("[data-kinetic-word]");
              const title = element.querySelector("h1, h2, h3") || element;
              const target = words.length ? words : title;
              gsap.fromTo(target, { yPercent: words.length ? 115 : 40, rotation: words.length ? 4 : 0, opacity: 0 }, { yPercent: 0, rotation: 0, opacity: 1, duration: 0.8, stagger: words.length ? 0.055 : 0, ease: "expo.out", clearProps: "transform,opacity", scrollTrigger: { trigger: element, start: "top 96%", once: true } });
            } else if (kind === "bar") {
              gsap.fromTo(element, { scaleY: 0.05, transformOrigin: "bottom" }, { scaleY: 1, duration: 0.9, delay: Math.min(index * 0.04, 0.24), ease: "expo.out", clearProps: "transform,transformOrigin", scrollTrigger: { trigger: element, start: "top 96%", once: true } });
            } else if (kind === "feedback") {
              gsap.fromTo(element, { opacity: 0.65 }, { opacity: 1, duration: 0.22, clearProps: "opacity" });
            } else if (kind) {
              // Spatial theatre belongs to non-editable paper; typing never moves.
              gsap.fromTo(element, editable ? { opacity: 0.75 } : { opacity: 0.35, y: 46, rotationX: -5, transformPerspective: 1000 }, { opacity: 1, ...(editable ? {} : { y: 0, rotationX: 0 }), duration: 0.85, ease: "power3.out", delay: Math.min(index * 0.035, 0.14), clearProps: editable ? "opacity" : "opacity,transform", scrollTrigger: { trigger: element, start: "top 97%", once: true } });
            }
            // Magnetism is inside the hit target, so the button never escapes a click.
            if (!kind) {
              const icon = element.querySelector("svg");
              if (!icon) return;
              const iconX = gsap.quickTo(icon, "x", { duration: 0.45, ease: "power3.out" });
              const iconY = gsap.quickTo(icon, "y", { duration: 0.45, ease: "power3.out" });
              let box: DOMRect | null = null;
              const enter = () => { box = element.getBoundingClientRect(); };
              const move = (event: PointerEvent) => {
                if (element.matches(":disabled") || element === document.activeElement) return;
                if (!box) box = element.getBoundingClientRect();
                iconX(gsap.utils.clamp(-8, 8, (event.clientX - box.left - box.width / 2) * 0.15));
                iconY(gsap.utils.clamp(-5, 5, (event.clientY - box.top - box.height / 2) * 0.2));
              };
              const reset = () => { box = null; iconX(0); iconY(0); };
              resets.add(reset);
              element.addEventListener("pointerenter", enter);
              element.addEventListener("pointermove", move);
              element.addEventListener("pointerleave", reset);
              element.addEventListener("focusin", reset);
              listeners.push(() => { resets.delete(reset); element.removeEventListener("pointerenter", enter); element.removeEventListener("pointermove", move); element.removeEventListener("pointerleave", reset); element.removeEventListener("focusin", reset); });
              return;
            }
            if (kind !== "card" || editable) return;
            const x = gsap.quickTo(element, "rotationX", { duration: 0.5, ease: "power3.out" });
            const y = gsap.quickTo(element, "rotationY", { duration: 0.5, ease: "power3.out" });
            let bounds: DOMRect | null = null;
            const enter = () => { bounds = element.getBoundingClientRect(); };
            const move = (event: PointerEvent) => {
              if (element.contains(document.activeElement)) return;
              if (!bounds) bounds = element.getBoundingClientRect();
              x(gsap.utils.clamp(-6, 6, -(event.clientY - bounds.top - bounds.height / 2) / bounds.height * 12));
              y(gsap.utils.clamp(-6, 6, (event.clientX - bounds.left - bounds.width / 2) / bounds.width * 12));
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
  }, { scope: root, dependencies: [scene, paused], revertOnUpdate: true });
  const labels: Record<string, string> = { home: "Studio", compose: "Create", selection: "Possibility", editor: "Your voice", profile: "Identity", history: "Collected", privacy: "Trust", terms: "Clarity", admin: "Overview" };
  return <div ref={root} className="motion-scene min-w-0" data-motion-scene={scene}><div className="motion-scene-art" aria-hidden="true"><span className="motion-scene-echo">{labels[scene] || "PostCraft"}</span></div><div className="motion-scene-rule" aria-hidden="true" /><div className="motion-scene-content">{children}</div></div>;
}
