"use client";

import { useRef } from "react";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { ArrowDown, ArrowUpRight } from "lucide-react";
import { useMotionPreference } from "@/components/motion/use-motion-preference";
import "./craft-story.css";

gsap.registerPlugin(useGSAP, ScrollTrigger);

const chapters = [
  { title: "Think.", label: "Capture the spark", body: "Start with something you noticed. A hard-earned lesson, a useful question, an idea that won’t leave you alone.", note: "An imperfect thought is enough.", symbol: "✳" },
  { title: "Shape.", label: "Give it substance", body: "Bring your context. Explore an angle, check the research, and turn a loose thought into a draft with something to say.", note: "Find the thread. Follow it.", symbol: "↗" },
  { title: "Share.", label: "Make it yours", body: "Read it out loud. Refine the details. Keep the words that sound like you, then take your finished draft into the world.", note: "Your judgment. Your voice.", symbol: "“" },
];

export function CraftStory({ onNewPost }: { onNewPost: (thought?: string) => void }) {
  const root = useRef<HTMLElement>(null);
  const paused = useMotionPreference();
  useGSAP(() => {
    const section = root.current;
    if (!section || paused) return;
    const media = gsap.matchMedia();
    media.add("(min-width: 1024px) and (min-height: 700px) and (hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)", () => {
      section.dataset.storyMode = "pinned";
      const cards = section.querySelectorAll<HTMLElement>(".craft-paper");
      gsap.set(cards[0], { rotation: -5, y: 12, transformPerspective: 1200 });
      gsap.set(cards[1], { rotation: 12, y: 680, x: 65, rotationX: -24, z: -180, transformPerspective: 1200 });
      gsap.set(cards[2], { rotation: -14, y: 740, x: -55, rotationX: 28, z: -240, transformPerspective: 1200 });
      const timeline = gsap.timeline({
        defaults: { ease: "none" },
        scrollTrigger: {
          id: "craft-paper-story", trigger: section.querySelector(".craft-stage"),
          start: "top 80px", end: () => `+=${Math.min(window.innerHeight, 950)}`,
          pin: true, scrub: 0.4, invalidateOnRefresh: true,
        },
      });
      timeline.to(cards[0], { rotation: -9, scale: 0.94, y: -22, duration: 1 }, 0)
        .to(cards[1], { rotation: 4, y: 8, x: 0, rotationX: 0, z: 0, duration: 0.85 }, 0.12)
        .to(cards[1], { rotation: 8, scale: 0.96, y: -12, duration: 0.8 }, 1)
        .to(cards[2], { rotation: -2, y: 0, x: 0, rotationX: 0, z: 0, duration: 0.85 }, 1.12)
        .fromTo(cards[1].querySelector(".craft-paper-copy"), { clipPath: "inset(0 0 100% 0)" }, { clipPath: "inset(0 0 0% 0)", duration: .5 }, .45)
        .fromTo(cards[2].querySelector(".craft-paper-copy"), { clipPath: "inset(0 0 100% 0)" }, { clipPath: "inset(0 0 0% 0)", duration: .5 }, 1.45)
        .to(".craft-word", { x: (i: number) => [18, -12, 25][i], duration: 2, stagger: 0.025 }, 0)
        .to(".craft-orbit", { rotation: 85, y: -100, duration: 2 }, 0)
        .fromTo(".craft-progress-fill", { scaleX: 0 }, { scaleX: 1, duration: 2 }, 0);
      // Font loading can change preceding dashboard height after initial setup.
      let live = true;
      const papers = section.querySelector<HTMLElement>(".craft-papers")!;
      const tiltX = gsap.quickTo(papers, "rotationX", { duration: .9, ease: "power3.out" });
      const tiltY = gsap.quickTo(papers, "rotationY", { duration: .9, ease: "power3.out" });
      gsap.set(papers, { transformPerspective: 1400 });
      const move = (event: PointerEvent) => {
        const box = papers.getBoundingClientRect();
        tiltX(gsap.utils.clamp(-5, 5, -(event.clientY - box.top - box.height / 2) / box.height * 10));
        tiltY(gsap.utils.clamp(-7, 7, (event.clientX - box.left - box.width / 2) / box.width * 14));
      };
      const reset = () => { tiltX(0); tiltY(0); };
      papers.addEventListener("pointermove", move); papers.addEventListener("pointerleave", reset);
      document.fonts.ready.then(() => { if (live) ScrollTrigger.refresh(); });
      return () => { live = false; papers.removeEventListener("pointermove", move); papers.removeEventListener("pointerleave", reset); delete section.dataset.storyMode; };
    });
    return () => media.revert();
  }, { scope: root, dependencies: [paused], revertOnUpdate: true });

  return (
    <section ref={root} className="craft-story" aria-labelledby="craft-story-title">
      <div className="craft-stage">
        <div className="craft-topline">
          <span className="eyebrow">The PostCraft practice</span>
          <a href="#craft-story-next" className="craft-skip" onClick={(event) => {
            event.preventDefault();
            const next = document.getElementById("craft-story-next");
            next?.scrollIntoView({ behavior: "instant", block: "center" });
            next?.focus({ preventScroll: true });
          }}>Skip story <ArrowDown size={13} /></a>
        </div>
        <div className="craft-composition">
          <div className="craft-editorial">
            <span className="craft-orbit" aria-hidden="true">✳</span>
            <h2 id="craft-story-title"><span className="craft-word">A thought.</span><span className="craft-word">A draft.</span><span className="craft-word craft-word-accent">Your voice.</span></h2>
            <p>Good writing is a practice.<br />Make a little room for yours.</p>
            <div className="craft-progress" aria-hidden="true"><span className="craft-progress-fill" /></div>
            <span className="craft-scroll-note" aria-hidden="true">SCROLL TO TURN THE PAGE</span>
          </div>
          <div className="craft-papers">
            {chapters.map((chapter, index) => (
              <article className={`craft-paper craft-paper-${index + 1}`} key={chapter.title}>
                <div className="craft-paper-meta"><span>FIELD NOTES / 0{index + 1}</span><span>POSTCRAFT</span></div>
                <span className="craft-paper-symbol" aria-hidden="true">{chapter.symbol}</span>
                <div className="craft-paper-copy"><p className="craft-chapter-label">{chapter.label}</p><h3>{chapter.title}</h3><p>{chapter.body}</p></div>
                <p className="craft-paper-note">{chapter.note}</p>
              </article>
            ))}
          </div>
        </div>
      </div>
      <div className="craft-next" id="craft-story-next" tabIndex={-1}>
        <p>The next page starts with you.</p>
        <button className="btn-primary" onClick={() => onNewPost()}>Start with a thought <ArrowUpRight size={16} /></button>
      </div>
    </section>
  );
}
