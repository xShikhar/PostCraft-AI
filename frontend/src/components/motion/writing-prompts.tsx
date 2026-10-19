"use client";
import { useRef } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { useMotionPreference } from "./use-motion-preference";
import "./writing-motion.css";
const prompts = ["A lesson you learned the hard way.", "An observation nobody is talking about.", "A small win with a bigger story.", "An opinion you can make a case for."];
export function WritingPrompts({ active }: { active: boolean }) {
  const root = useRef<HTMLDivElement>(null);
  const paused = useMotionPreference();
  useGSAP(() => {
    if (paused || !active) return;
    const lines = gsap.utils.toArray<HTMLElement>(".writing-prompt-line", root.current);
    const timeline = gsap.timeline({ repeat: -1, repeatDelay: 0 });
    lines.forEach((line, i) => {
      const next = lines[(i + 1) % lines.length];
      const at = i * 5 + 4.2;
      timeline.to(line, { yPercent: -110, opacity: 0, rotationX: 25, duration: .55, ease: "power3.inOut" }, at)
        .fromTo(next, { yPercent: 110, opacity: 0, rotationX: -25 }, { yPercent: 0, opacity: 1, rotationX: 0, duration: .65, ease: "power3.out", immediateRender: false }, at + .12);
    });
    const visibility = () => document.hidden ? timeline.pause() : timeline.resume();
    document.addEventListener("visibilitychange", visibility);
    visibility();
    return () => document.removeEventListener("visibilitychange", visibility);
  }, { scope: root, dependencies: [paused, active], revertOnUpdate: true });
  return <div ref={root} className="writing-prompts" data-prompt-active={active && !paused}>
    <span className="writing-prompt-star" aria-hidden="true">✳</span>
    <span className="sr-only">Writing inspiration: a lesson, an observation, a small win, or an opinion.</span>
    <div className="writing-prompt-window" aria-hidden="true">{prompts.map(text => <span className="writing-prompt-line" key={text}>{text}</span>)}</div>
  </div>;
}
