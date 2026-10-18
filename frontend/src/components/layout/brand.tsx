"use client";
import Image from "next/image";
import { useTheme } from "next-themes";
import { useMounted } from "@/lib/use-mounted";
export function Brand({ compact = false }: { compact?: boolean }) {
  const { resolvedTheme } = useTheme();
  const mounted = useMounted();
  return (
    <span className="inline-flex items-center gap-2.5 text-text-display">
      <Image
        src={
          mounted && resolvedTheme === "dark"
            ? "/logo-dark.png"
            : "/logo-light.png"
        }
        alt=""
        width={34}
        height={34}
        className="rounded-lg"
      />
      <span className={compact ? "sr-only" : "wordmark text-lg"}>
        PostCraft
        <span className="font-sans text-[10px] tracking-normal text-text-muted ml-1.5">
          AI
        </span>
      </span>
    </span>
  );
}
