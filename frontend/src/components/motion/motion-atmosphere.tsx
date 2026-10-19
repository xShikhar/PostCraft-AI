"use client";
import { useEffect, useRef, useState } from "react";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { Pause, Play } from "lucide-react";
import { setMotionPaused, useMotionPreference } from "./use-motion-preference";
import "./motion-design.css";

gsap.registerPlugin(useGSAP);

export function MotionAtmosphere() {
  const root = useRef<HTMLDivElement>(null);
  const paused = useMotionPreference();
  const [systemReduced, setSystemReduced] = useState(false);
  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setSystemReduced(query.matches);
    sync();
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, []);
  useGSAP(() => {
    if (paused || !root.current) return;
    const media = gsap.matchMedia();
    media.add("(hover: hover) and (pointer: fine)", () => {
      const layer = root.current!;
      const planes = gsap.utils.toArray<HTMLElement>("[data-atmosphere-plane]", layer);
      const movers = planes.map((plane, index) => ({
        x: gsap.quickTo(plane, "x", { duration: 1.3, ease: "power3.out" }),
        y: gsap.quickTo(plane, "y", { duration: 1.3, ease: "power3.out" }),
        distance: 28 + index * 30,
      }));
      const entrance = gsap.fromTo(planes, { opacity: 0, scale: 0.85 }, { opacity: 1, scale: 1, duration: 1.5, stagger: 0.12, ease: "power3.out" });
      let width = window.innerWidth, height = window.innerHeight;
      const resize = () => { width = window.innerWidth; height = window.innerHeight; };
      const move = (event: PointerEvent) => {
        if (document.hidden || document.activeElement?.matches("input,textarea,[contenteditable=true]")) return;
        const x = event.clientX / width - 0.5, y = event.clientY / height - 0.5;
        movers.forEach((mover) => { mover.x(x * mover.distance); mover.y(y * mover.distance); });
      };
      const reset = () => movers.forEach((mover) => { mover.x(0); mover.y(0); });
      const visibility = () => { if (document.hidden) { entrance.progress(1); reset(); movers.forEach(mover => { mover.x.tween.progress(1).pause(); mover.y.tween.progress(1).pause(); }); } };
      window.addEventListener("pointermove", move, { passive: true });
      window.addEventListener("resize", resize, { passive: true });
      window.addEventListener("blur", reset);
      document.addEventListener("focusin", reset);
      document.addEventListener("visibilitychange", visibility);
      return () => {
        window.removeEventListener("pointermove", move);
        window.removeEventListener("resize", resize);
        window.removeEventListener("blur", reset);
        document.removeEventListener("focusin", reset);
        document.removeEventListener("visibilitychange", visibility);
      };
    });
    return () => media.revert();
  }, { scope: root, dependencies: [paused], revertOnUpdate: true });
  const toggle = () => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) return;
    setMotionPaused(!paused);
  };
  return <>
    <div ref={root} className="motion-atmosphere" aria-hidden="true">
      <div data-atmosphere-plane className="motion-ink motion-ink-one" />
      <div data-atmosphere-plane className="motion-ink motion-ink-two" />
      <svg data-atmosphere-plane className="motion-contours" viewBox="0 0 1400 1000" preserveAspectRatio="xMidYMid slice" fill="none">
        <ellipse cx="1120" cy="170" rx="650" ry="300" transform="rotate(-30 1120 170)" />
        <ellipse cx="1120" cy="170" rx="580" ry="265" transform="rotate(-30 1120 170)" />
        <ellipse cx="1120" cy="170" rx="510" ry="230" transform="rotate(-30 1120 170)" />
        <path d="M-100 850C300 430 620 1160 1500 590" />
      </svg>
    </div>
    <button type="button" className="motion-toggle" aria-label={systemReduced ? "Motion reduced by system preference" : paused ? "Resume motion" : "Pause motion"} aria-pressed={paused} disabled={systemReduced} onClick={toggle} title="Motion also follows your system accessibility preference">
      {paused ? <Play size={12} /> : <Pause size={12} />}<span>{systemReduced ? "Reduced motion" : paused ? "Motion paused" : "Pause motion"}</span>
    </button>
  </>;
}
