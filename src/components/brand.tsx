import { useId } from "react";
import { cn } from "@/lib/utils";

/**
 * Leou mark — a crown fused with a forward-sloping mortarboard, its central
 * spire an ascending arrow.
 *
 * Three peaks (peak achievement, leadership) rise from a gem-cut diamond that
 * reads as a graduation cap, and the whole form leans forward: the ascent of
 * the learner. Pure vector geometry only — the gentle lean is a single shear
 * transform, so the underlying construction stays clean and mirror-symmetric
 * and the mark stays razor-sharp from a 16px favicon to a hero banner.
 *
 * Drawn on a 72×72 grid.
 */
export function LeouGlyph({ className }: { className?: string }) {
  const uid = useId().replace(/[^a-zA-Z0-9_]/g, "");
  const gold = `leou-gold-${uid}`;
  return (
    <svg
      viewBox="0 0 72 72"
      className={cn("h-8 w-8 drop-shadow-[0_2px_12px_rgba(245,158,11,0.35)]", className)}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={gold} x1="0" y1="0" x2="0.55" y2="1">
          <stop offset="0" stopColor="#FBBF24" />
          <stop offset="0.5" stopColor="#F59E0B" />
          <stop offset="1" stopColor="#D97706" />
        </linearGradient>
      </defs>
      <g transform="matrix(1 0 -0.06 1 2.16 0)">
        <path
          d="M8 44 L14 40.6 L20 20 L27 33 L36 12 L45 33 L52 20 L58 40.6 L64 44 L36 60 Z"
          fill={`url(#${gold})`}
        />
      </g>
    </svg>
  );
}

/** The signature four-point sparkle — used as the full stop in "Leou✦". */
export function SparkDot({ className }: { className?: string }) {
  const uid = useId().replace(/[^a-zA-Z0-9_]/g, "");
  const spark = `leou-dot-${uid}`;
  return (
    <svg viewBox="0 0 10 10" className={cn("inline-block h-[0.72em] w-[0.72em]", className)} aria-hidden="true">
      <defs>
        <linearGradient id={spark} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fcd34d" />
          <stop offset="1" stopColor="#f59e0b" />
        </linearGradient>
      </defs>
      <path
        d="M 5 0 C 6 3.2 6.8 4 10 5 C 6.8 6 6 6.8 5 10 C 4 6.8 3.2 6 0 5 C 3.2 4 4 3.2 5 0 Z"
        fill={`url(#${spark})`}
      />
    </svg>
  );
}

export function Brand({
  className,
  showText = true,
  textClassName,
  glyphClassName,
  tagline = false,
}: {
  className?: string;
  showText?: boolean;
  textClassName?: string;
  glyphClassName?: string;
  tagline?: boolean;
}) {
  const wordmark = (
    <span className={cn("font-extrabold tracking-tight text-lg", textClassName)}>
      Leou
      <SparkDot className="ml-0.5 text-[0.66em]" />
    </span>
  );

  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <LeouGlyph className={glyphClassName} />
      {showText &&
        (tagline ? (
          <span className="flex flex-col gap-1 leading-none">
            {wordmark}
            <span className="text-[0.5rem] font-medium uppercase tracking-[0.28em] text-slate-400">
              Learn · Grow · Build your future
            </span>
          </span>
        ) : (
          wordmark
        ))}
    </span>
  );
}
