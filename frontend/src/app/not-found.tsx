import Link from "next/link";
import { ArrowLeft, Feather } from "lucide-react";
import { Brand } from "@/components/layout/brand";
import { MotionScene } from "@/components/motion/motion-scene";
import { KineticText } from "@/components/motion/kinetic-text";
export default function NotFound() {
  return (
    <MotionScene scene="not-found"><main className="min-h-screen px-6 py-10 max-w-6xl mx-auto flex flex-col">
      <Link href="/" aria-label="PostCraft home">
        <Brand />
      </Link>
      <section data-motion="panel" className="flex-1 flex flex-col items-center justify-center py-24 text-center">
        <span data-motion="ornament" className="w-16 h-16 rounded-full border border-border-hover flex items-center justify-center text-primary mb-8">
          <Feather size={24} strokeWidth={1.2} />
        </span>
        <p className="eyebrow mb-5">404 / A page out of place</p>
        <h1 data-motion="heading" className="page-title !text-5xl max-w-xl">
          <KineticText text="Let’s turn to" />
          <br />
          <em className="text-primary"><KineticText text="a fresh page." /></em>
        </h1>
        <p className="text-sm text-text-muted max-w-sm mt-6 mb-8">
          This page isn’t here. Your writing workspace is just one step away.
        </p>
        <Link href="/" className="btn-primary">
          <ArrowLeft size={15} />
          Back to the studio
        </Link>
      </section>
      <p className="text-[10px] text-text-muted text-center">
        PostCraft AI · Written with intention.
      </p>
    </main></MotionScene>
  );
}
