import { cn } from "@/lib/utils";

/**
 * Hand-drawn-feeling SVG doodles and annotations.
 *
 * Drawn as strokes with round caps and deliberately uneven `feTurbulence`
 * displacement so they read as pen-on-paper rather than as vector art. They are
 * purely decorative: `aria-hidden`, `pointer-events-none`, and drawn in the
 * theme's own accent colours so they stay consistent in dark mode.
 */

type Props = {
  className?: string;
  /** Stroke colour. Defaults to the accent token. */
  color?: string;
  /** Opacity of the stroke. */
  opacity?: number;
  /**
   * Adds a wobble to the stroke edges. Turn it off for shapes where a wobbly
   * outline would look like a rendering fault rather than a doodle.
   */
  rough?: boolean;
};

function Defs({ id, color, rough }: { id: string; color: string; rough: boolean }) {
  return (
    <defs>
      {rough ? (
        <filter id={`${id}-rough`} x="-15%" y="-15%" width="130%" height="130%">
          <feTurbulence type="fractalNoise" baseFrequency="0.035" numOctaves={2} seed={7} result="noise" />
          <feDisplacementMap in="SourceGraphic" in2="noise" scale={2.4} xChannelSelector="R" yChannelSelector="G" />
        </filter>
      ) : null}
      <marker id={`${id}-arrow`} viewBox="0 0 10 10" refX="7" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
        <path d="M 0 1 L 8 5 L 0 9 z" fill={color} />
      </marker>
    </defs>
  );
}

/** A looping circle drawn as if by hand, plus a second pass to fake a re-stroke. */
export function CircleScribble({ className, color = "currentColor", opacity = 0.5, rough = true }: Props) {
  const id = "scribble";
  return (
    <svg viewBox="0 0 200 120" className={className} aria-hidden focusable="false" fill="none">
      <Defs id={id} color={color} rough={rough} />
      <g filter={rough ? `url(#${id}-rough)` : undefined} stroke={color} strokeOpacity={opacity} strokeWidth={2.5} strokeLinecap="round">
        <path d="M100 18 C 150 14 178 44 176 68 C 174 94 138 108 98 106 C 58 104 24 88 26 62 C 28 38 58 20 100 18" />
        <path d="M100 22 C 146 19 172 46 171 68 C 170 90 137 103 99 102 C 62 101 31 86 32 62 C 33 41 60 24 100 22" strokeOpacity={opacity * 0.5} />
      </g>
    </svg>
  );
}

/** A hand-drawn underline that sits beneath text. */
export function UnderlineScribble({ className, color = "currentColor", opacity = 0.65, rough = true }: Props) {
  const id = "underline";
  return (
    <svg viewBox="0 0 300 18" preserveAspectRatio="none" className={className} aria-hidden focusable="false" fill="none">
      <Defs id={id} color={color} rough={rough} />
      <g filter={rough ? `url(#${id}-rough)` : undefined} stroke={color} strokeOpacity={opacity} strokeWidth={3.5} strokeLinecap="round">
        <path d="M4 11 C 60 6 120 13 180 9 C 230 6 268 10 296 8" />
      </g>
    </svg>
  );
}

/** A curved arrow, for pointing at a feature. */
export function ArrowScribble({ className, color = "currentColor", opacity = 0.6, rough = true }: Props) {
  const id = "arrow";
  return (
    <svg viewBox="0 0 120 90" className={className} aria-hidden focusable="false" fill="none">
      <Defs id={id} color={color} rough={rough} />
      <g filter={rough ? `url(#${id}-rough)` : undefined} stroke={color} strokeOpacity={opacity} strokeWidth={2.5} strokeLinecap="round">
        <path d="M104 16 C 70 8 30 22 22 52 C 16 74 44 84 66 74" markerEnd={`url(#${id}-arrow)`} />
      </g>
    </svg>
  );
}

/** A curly arrow looping down, used to connect a caption to what it describes. */
export function LoopScribble({ className, color = "currentColor", opacity = 0.55, rough = true }: Props) {
  const id = "loop";
  return (
    <svg viewBox="0 0 100 130" className={className} aria-hidden focusable="false" fill="none">
      <Defs id={id} color={color} rough={rough} />
      <g filter={rough ? `url(#${id}-rough)` : undefined} stroke={color} strokeOpacity={opacity} strokeWidth={2.5} strokeLinecap="round">
        <path d="M20 8 C 58 12 76 34 70 58 C 66 74 48 82 38 96 C 34 102 36 110 44 114" markerEnd={`url(#${id}-arrow)`} />
      </g>
    </svg>
  );
}

/** Four-point sparkle, the "shiny" doodle. */
export function Sparkle({ className, color = "currentColor", opacity = 0.8 }: Props) {
  return (
    <svg viewBox="0 0 40 40" className={className} aria-hidden focusable="false" fill="none">
      <path
        d="M20 2 C 21.5 13 27 18.5 38 20 C 27 21.5 21.5 27 20 38 C 18.5 27 13 21.5 2 20 C 13 18.5 18.5 13 20 2 Z"
        fill={color}
        fillOpacity={opacity}
      />
    </svg>
  );
}

/** A small asterisk / star burst for scattering around a section heading. */
type StarBurstProps = Props;

export function StarBurst({ className, color = "currentColor", opacity = 0.6 }: StarBurstProps) {
  const id = "burst";
  return (
    <svg viewBox="0 0 60 60" className={className} aria-hidden focusable="false" fill="none" stroke={color} strokeOpacity={opacity}>
      <defs>
        <filter id={`${id}-rough`} x="-20%" y="-20%" width="140%" height="140%">
          <feTurbulence type="fractalNoise" baseFrequency="0.04" numOctaves={2} seed={3} result="n" />
          <feDisplacementMap in2="n" scale={1.6} />
        </filter>
      </defs>
      <g filter={`url(#${id}-rough)`} strokeWidth={2} strokeLinecap="round">
        <path d="M30 8 L30 52" />
        <path d="M8 30 L52 30" />
        <path d="M14 14 L46 46" />
        <path d="M46 14 L14 46" />
      </g>
    </svg>
  );
}

/** A rounded "scribbled box" used to frame a callout. */
export function BoxScribble({ className, color = "currentColor", opacity = 0.4, rough = true }: Props) {
  const id = "box";
  return (
    <svg viewBox="0 0 240 120" className={className} aria-hidden focusable="false" fill="none" preserveAspectRatio="none">
      <Defs id={id} color={color} rough={rough} />
      <g filter={rough ? `url(#${id}-rough)` : undefined} stroke={color} strokeOpacity={opacity} strokeWidth={2.5} strokeLinecap="round">
        <path d="M12 16 C 60 10 180 12 228 14 C 232 40 230 80 228 106 C 160 110 60 108 12 106 C 8 70 10 46 12 16 Z" />
      </g>
    </svg>
  );
}

/** A hand-drawn lightning bolt, for the "fast" stat. */
export function BoltDoodle({ className, color = "currentColor", opacity = 0.7 }: Props) {
  const id = "bolt";
  return (
    <svg viewBox="0 0 60 100" className={className} aria-hidden focusable="false" fill="none">
      <defs>
        <filter id={`${id}-rough`} x="-20%" y="-20%" width="140%" height="140%">
          <feTurbulence type="fractalNoise" baseFrequency="0.05" numOctaves={2} seed={11} result="n" />
          <feDisplacementMap in2="n" scale={1.8} />
        </filter>
      </defs>
      <g filter={`url(#${id}-rough)`}>
        <path
          d="M36 4 L 14 52 L 30 52 L 22 96 L 48 44 L 32 44 Z"
          fill={color}
          fillOpacity={opacity * 0.35}
          stroke={color}
          strokeOpacity={opacity}
          strokeWidth={2.5}
          strokeLinejoin="round"
        />
      </g>
    </svg>
  );
}

/** A row of hand-drawn dots, like an ellipsis drawn in a notebook. */
export function DotsDoodle({ className, color = "currentColor", opacity = 0.6 }: Props) {
  return (
    <svg viewBox="0 0 70 20" className={className} aria-hidden focusable="false" fill={color} fillOpacity={opacity}>
      <circle cx="10" cy="10" r="3" />
      <circle cx="35" cy="10" r="3" />
      <circle cx="60" cy="10" r="3" />
    </svg>
  );
}

/** A stack of doodle decorations for a section corner. */
export function DoodleCluster({ className, variant = "mixed" }: { className?: string; variant?: "mixed" | "code" | "exam" | "reports" }) {
  const doodles: Record<string, React.ReactNode> = {
    mixed: (
      <>
        <CircleScribble className="h-14 w-20" />
        <Sparkle className="h-5 w-5" />
        <DotsDoodle className="h-4 w-12" />
      </>
    ),
    code: (
      <>
        <Sparkle className="h-6 w-6" />
        <UnderlineScribble className="h-3 w-16" />
      </>
    ),
    exam: (
      <>
        <LoopScribble className="h-14 w-11" />
        <StarBurst className="h-8 w-8" />
      </>
    ),
    reports: (
      <>
        <ArrowScribble className="h-14 w-18" />
        <DotsDoodle className="h-4 w-12" />
      </>
    ),
  };
  return (
    <div className={cn("pointer-events-none absolute select-none text-accent", className)} aria-hidden>
      {doodles[variant]}
    </div>
  );
}
