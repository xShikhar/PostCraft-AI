"use client";

import { useEffect, useRef, useState } from "react";
import { Feather, Globe, Pause, Play, RotateCcw, ShieldCheck, Sparkles } from "lucide-react";
import { useMotionPreference } from "@/components/motion/use-motion-preference";
import "./generation-intermission.css";

type Flight = { y: number; velocity: number; distance: number; score: number; caught: number[] };
const fresh = (): Flight => ({ y: 160, velocity: 0, distance: 0, score: 0, caught: [] });
const words = ["Imagine.", "Explore.", "Create.", "Stay curious.", "Find your voice."];

export function GenerationIntermission({ elapsed }: { elapsed: number }) {
  const quiet = useMotionPreference();
  const heading = useRef<HTMLHeadingElement>(null);
  const field = useRef<HTMLButtonElement>(null);
  const flight = useRef<Flight>(fresh());
  const [frame, setFrame] = useState<Flight>(fresh);
  const [mode, setMode] = useState<"ready" | "playing" | "paused" | "over">("ready");
  const [best, setBest] = useState(0);
  const [quietScore, setQuietScore] = useState(0);
  const [craft, setCraft] = useState<number | null>(null);

  useEffect(() => { heading.current?.focus({ preventScroll: true }); heading.current?.scrollIntoView({ block: "start", behavior: "instant" }); }, []);
  useEffect(() => {
    const hide = () => { if (document.hidden) setMode(m => m === "playing" ? "paused" : m); };
    document.addEventListener("visibilitychange", hide);
    return () => document.removeEventListener("visibilitychange", hide);
  }, []);

  useEffect(() => {
    if (mode !== "playing" || quiet) return;
    let raf = 0, last = 0, paint = 0;
    const tick = (now: number) => {
      const dt = last ? Math.min((now - last) / 1000, .035) : 0;
      last = now;
      const f = flight.current;
      f.velocity += 390 * dt;
      f.y += f.velocity * dt;
      f.distance += 112 * dt;
      let collision = f.y < 14 || f.y > 306;
      for (let n = Math.max(0, Math.floor((f.distance - 700) / 260)); n < Math.ceil((f.distance + 700) / 260); n++) {
        const x = 560 + n * 260 - f.distance;
        const gap = 155 + Math.sin(n * 1.7) * 55;
        if (Math.abs(x - 135) < 26 && Math.abs(f.y - gap) > 81) collision = true;
        if (Math.abs(x - 135) < 30 && Math.abs(f.y - gap) < 36 && !f.caught.includes(n)) {
          f.caught.push(n); f.score += 1;
          setBest(b => Math.max(b, f.score));
        }
      }
      if (collision) { setFrame({ ...f }); setMode("over"); return; }
      if (now - paint > 30) { setFrame({ ...f }); paint = now; }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [mode, quiet]);

  const lift = () => {
    if (quiet) { setQuietScore(s => s + 1); return; }
    if (mode === "over" || mode === "ready") { flight.current = fresh(); setFrame(fresh()); }
    flight.current.velocity = -185;
    setMode("playing");
  };
  const obstacles = Array.from({ length: 6 }, (_, i) => Math.max(0, Math.floor((frame.distance - 560) / 260)) + i);
  const score = quiet ? quietScore : frame.score;

  return <section className="intermission" aria-label="Draft generation in progress" data-quiet={quiet}>
    <header className="intermission-heading">
      <div><p className="eyebrow">The creative intermission</p><h2 ref={heading} tabIndex={-1}>Good thoughts.<br /><em>Taking shape.</em></h2></div>
      <div className="intermission-clock"><span className="intermission-pulse" /><span role="status">Your drafts are in the works</span><strong aria-label={`Elapsed time ${elapsed} seconds`}>{Math.floor(elapsed / 60)}:{String(elapsed % 60).padStart(2, "0")}<small>elapsed</small></strong></div>
    </header>
    <div className="craft-pipeline" aria-label="Pipeline illustration: research, writing, review">
      {[{ Icon: Globe, title: "Discover", detail: "Research & context" }, { Icon: Feather, title: "Compose", detail: "Three ways to tell it" }, { Icon: ShieldCheck, title: "Consider", detail: "Quality & grounding" }].map(({ Icon, title, detail }, i) => <button type="button" className="craft-pipeline-node" key={title} aria-pressed={craft === i} aria-controls="craft-explanation" onClick={() => setCraft(c => c === i ? null : i)} style={{ "--node": i } as React.CSSProperties}><span className="pipeline-emblem"><Icon size={23} /></span><span><strong>{title}</strong><small>{detail}</small></span></button>)}
      <span className="pipeline-traveller" aria-hidden="true" />
    </div>
    <p id="craft-explanation" className="craft-explanation" aria-live="polite">{craft === null ? "Follow the thread. Tap a chapter to peek inside." : ["An idea starts with context. Available research and your chosen background help shape the writing.", "One idea, three interpretations. You’ll choose the draft that feels most like you.", "An editorial pass looks for substance and grounding. Feedback guides you; the final decision stays yours."][craft]}</p>
    <p className="pipeline-caption">A glimpse of the craft, not live stage tracking. {elapsed >= 60 ? "Still working—some ideas take a little longer. Your request is continuing." : "Your drafts will appear automatically when ready."}</p>
    <div className="thought-game">
      <div className="thought-game-heading"><div><p className="eyebrow"><Sparkles size={13} /> A little room to play</p><h3>Catch a thought.</h3></div><div className="thought-score" aria-live="polite" aria-atomic="true"><span><b>{String(score).padStart(2, "0")}</b> thoughts</span>{!quiet && <small>Session best {best}</small>}</div></div>
      <button ref={field} type="button" className="thought-field" aria-label={quiet ? "Collect a thought" : mode === "playing" ? "Lift the paper plane" : mode === "paused" ? "Resume flight" : "Start paper flight"} onClick={lift} onKeyDown={e => { if ((e.code === "Space" || e.code === "Enter") && e.repeat) e.preventDefault(); }}>
        <svg viewBox="0 0 800 320" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
          <path className="thought-orbit" d="M-50 240 Q240 10 470 170 T850 90 M-50 260 Q240 30 470 190 T850 110" />
          <text key={score} className={`thought-word ${score > 0 ? "thought-word-caught" : ""}`} x="400" y="180" textAnchor="middle">{quiet ? words[quietScore % words.length] : words[Math.max(0, frame.score - 1) % words.length]}</text>
          {!quiet && obstacles.map(n => {
            const x = 560 + n * 260 - frame.distance, gap = 155 + Math.sin(n * 1.7) * 55;
            return <g key={n} transform={`translate(${x} 0)`}>
              <rect className="ink-stroke" x="-9" y="-15" width="18" height={gap - 80} rx="9" />
              <rect className="ink-stroke" x="-9" y={gap + 95} width="18" height="320" rx="9" />
              {!frame.caught.includes(n) && <g transform={`translate(0 ${gap})`}><circle className="thought-coin" r="23" /><text className="thought-mark" textAnchor="middle" y="9">{["“", "*", "!", "?"][n % 4]}</text></g>}
            </g>;
          })}
          <g className="paper-flight" transform={`translate(135 ${quiet ? 160 : frame.y}) rotate(${quiet ? -12 : Math.max(-25, Math.min(35, frame.velocity / 8))})`}>
            <path className="paper-trail" d="M-22 3 Q-70 20 -115 5" />
            <path className="paper-wing" d="M-28 -15 L35 0 L-28 18 L-13 1 Z" /><path className="paper-fold" d="M-13 1 L35 0 L-21 10 Z" />
          </g>
        </svg>
        {(quiet || mode !== "playing") && <span className="thought-invitation"><strong>{quiet ? "A thought, at your own pace." : mode === "over" ? "Every landing is a new beginning." : mode === "paused" ? "A moment to breathe." : "Let your mind wander."}</strong><span>{quiet ? "Tap or press Space to collect a word · no moving obstacles" : mode === "over" ? "Tap to fly again" : mode === "paused" ? "Tap to resume" : "Tap to fly · Space to lift · collect punctuation"}</span></span>}
      </button>
      <footer className="thought-game-footer"><p>{quiet ? "Quiet play. No timer, no losing." : "Tap / Space to lift. Slip between the ink. Catch the sparks."}</p><div>{!quiet && <button type="button" className="thought-control" aria-label={mode === "playing" ? "Pause game" : "Resume game"} disabled={mode === "ready" || mode === "over"} onClick={() => { setMode(m => m === "playing" ? "paused" : "playing"); field.current?.focus({ preventScroll: true }); }}>{mode === "playing" ? <Pause size={15} /> : <Play size={15} />}</button>}<button type="button" className="thought-control" aria-label="Reset game" onClick={() => { flight.current = fresh(); setFrame(fresh()); setQuietScore(0); setMode("ready"); }}><RotateCcw size={15} /></button></div></footer>
    </div>
    <p className="intermission-footnote">Just for the joy of it. Playing never changes your drafts or slows down the request.</p>
  </section>;
}
