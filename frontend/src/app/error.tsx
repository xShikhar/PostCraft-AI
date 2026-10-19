"use client";
import { RefreshCw } from "lucide-react";
import { MotionScene } from "@/components/motion/motion-scene";
import { KineticText } from "@/components/motion/kinetic-text";
export default function ErrorPage({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <MotionScene scene="error"><main className="min-h-[75vh] flex items-center justify-center p-6">
      <section data-motion="panel" className="paper p-10 sm:p-14 max-w-lg text-center">
        <p className="eyebrow mb-5">A momentary interruption</p>
        <h1 data-motion="heading" className="page-title">
          <KineticText text="Let’s pick up" />
          <br />
          <em className="text-primary"><KineticText text="the thread." /></em>
        </h1>
        <p className="text-sm text-text-muted mt-6 mb-8">
          The workspace couldn’t open this view. Try again to continue.
        </p>
        <button onClick={reset} className="btn-primary">
          <RefreshCw size={14} />
          Try again
        </button>
      </section>
    </main></MotionScene>
  );
}
