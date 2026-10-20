"use client";
import { useRef } from "react";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { useMotionPreference } from "./use-motion-preference";
import "./living-ink.css";

/** Decorative ink: direct SVG updates keep pointer motion outside React rendering. */
export function LivingInk({ variant = "home" }: { variant?: "home" | "auth" }) {
  const root = useRef<HTMLDivElement>(null);
  const paused = useMotionPreference();
  useGSAP(() => {
    const layer = root.current, host = layer?.parentElement;
    if (!layer || !host || paused) return;
    const paths = [...layer.querySelectorAll<SVGPathElement>(".living-thread")];
    const sparks = [...layer.querySelectorAll<SVGTextElement>(".living-spark")];
    const ripple = layer.querySelector<SVGCircleElement>(".living-ripple")!;
    let x = 650, y = 300, targetX = x, targetY = y, wave = 0, time = 0, visible = true, typing = false;
    let bounds = host.getBoundingClientRect();
    const measure = () => { bounds = host.getBoundingClientRect(); };
    const move = (e: PointerEvent) => {
      if (typing || e.pointerType === "touch") return;
      targetX = (e.clientX - bounds.left) / Math.max(1, bounds.width) * 1200;
      targetY = (e.clientY - bounds.top) / Math.max(1, Math.min(bounds.height, 900)) * 800;
    };
    const click = (e: PointerEvent) => {
      if ((e.target as Element).closest("button,a,input,textarea,label,[role=button]") || typing) return;
      measure();
      targetX = (e.clientX - bounds.left) / Math.max(1, bounds.width) * 1200;
      targetY = (e.clientY - bounds.top) / Math.max(1, Math.min(bounds.height, 900)) * 800;
      wave = 1;
      ripple.setAttribute("cx", String(targetX)); ripple.setAttribute("cy", String(targetY));
    };
    const focus = () => { typing = !!document.activeElement?.matches("input,textarea,[contenteditable=true]"); };
    const reset = () => { targetX = 650; targetY = 300; };
    const draw = (_: number, delta: number) => {
      if (!visible || document.hidden || typing) return;
      const dt = Math.min(delta / 1000, .04);
      time += dt;
      x += (targetX - x) * (1 - Math.exp(-dt * 3));
      y += (targetY - y) * (1 - Math.exp(-dt * 3));
      wave = Math.max(0, wave - dt * .65);
      paths.forEach((path, i) => {
        const base = 180 + i * 57;
        const sway = Math.sin(time * .4 + i * .5) * 42 + Math.sin((1 - wave) * 18 + i) * wave * 60;
        path.setAttribute("d", `M-100 ${base + 100} C${x * .55} ${base - 200 + sway + y * .18},${600 + x * .25} ${base + 220 + sway - y * .18},1300 ${base - 150}`);
        const p = path.getPointAtLength(path.getTotalLength() * ((time * .025 + i * .19) % 1));
        sparks[i]?.setAttribute("transform", `translate(${p.x} ${p.y})`);
      });
      ripple.setAttribute("r", String((1 - wave) * 320));
      ripple.style.opacity = String(wave * .55);
    };
    const observer = new IntersectionObserver(entries => { visible = entries[0].isIntersecting; }, { rootMargin: "80px" });
    observer.observe(layer);
    const resize = new ResizeObserver(measure); resize.observe(host);
    host.addEventListener("pointerenter", measure);
    host.addEventListener("pointermove", move, { passive: true });
    host.addEventListener("pointerdown", click, { passive: true });
    host.addEventListener("pointerleave", reset);
    document.addEventListener("focusin", focus); document.addEventListener("focusout", focus);
    window.addEventListener("scroll", measure, { passive: true });
    gsap.ticker.add(draw);
    return () => {
      gsap.ticker.remove(draw); observer.disconnect(); resize.disconnect();
      host.removeEventListener("pointerenter", measure); host.removeEventListener("pointermove", move);
      host.removeEventListener("pointerdown", click); host.removeEventListener("pointerleave", reset);
      document.removeEventListener("focusin", focus); document.removeEventListener("focusout", focus);
      window.removeEventListener("scroll", measure);
      paths.forEach((path, i) => path.setAttribute("d", `M-100 ${280 + i * 57} C350 ${i * 57},800 ${400 + i * 57},1300 ${30 + i * 57}`));
      sparks.forEach(spark => spark.removeAttribute("transform")); ripple.style.opacity = "0";
    };
  }, { scope: root, dependencies: [paused], revertOnUpdate: true });
  return <div ref={root} className={`living-ink living-ink-${variant}`} aria-hidden="true">
    <svg viewBox="0 0 1200 800" preserveAspectRatio="none">
      {Array.from({ length: 5 }, (_, i) => <path className="living-thread" key={i} d={`M-100 ${280 + i * 57} C350 ${i * 57},800 ${400 + i * 57},1300 ${30 + i * 57}`} />)}
      {["✳", "“", "·", "↗", "”"].map((mark, i) => <text className="living-spark" key={i} x="0" y="0">{mark}</text>)}
      <circle className="living-ripple" r="0" />
    </svg>
    <span className="living-echo">{variant === "auth" ? "Imagine." : "Possibility."}</span>
  </div>;
}
