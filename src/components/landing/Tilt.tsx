"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { useFinePointer, useReducedMotion } from "./motion";

/**
 * A card that leans towards the pointer.
 *
 * Bounded to 6 degrees and eased back with a transition on exit, so it reads as
 * a physical object rather than a glitch. Pointer events only: a touch drag
 * would otherwise tilt the card while the visitor is trying to scroll, and
 * gyroscope-style parallax on a phone is nauseating.
 */
export function Tilt({
  children,
  className,
  /** Degrees of rotation at the edge of the card. */
  max = 6,
  /** How far the highlight follows the pointer, in percent. */
  glare = true,
}: {
  children: React.ReactNode;
  className?: string;
  max?: number;
  glare?: boolean;
}) {
  const reduced = useReducedMotion();
  const finePointer = useFinePointer();
  const ref = React.useRef<HTMLDivElement>(null);
  const [active, setActive] = React.useState(false);

  // Fine pointers only, and never for reduced motion: a touch drag would tilt
  // the card mid-scroll, and tilt on a phone is nausea rather than delight.
  const enabled = finePointer && !reduced;

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!enabled) return;
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const px = (e.clientX - rect.left) / rect.width;
    const py = (e.clientY - rect.top) / rect.height;
    el.style.setProperty("--tilt-x", `${(0.5 - py) * max * 2}deg`);
    el.style.setProperty("--tilt-y", `${(px - 0.5) * max * 2}deg`);
    if (glare) {
      el.style.setProperty("--glare-x", `${px * 100}%`);
      el.style.setProperty("--glare-y", `${py * 100}%`);
    }
  };

  const reset = () => {
    const el = ref.current;
    if (!el) return;
    el.style.setProperty("--tilt-x", "0deg");
    el.style.setProperty("--tilt-y", "0deg");
  };

  return (
    <div
      ref={ref}
      onPointerMove={onPointerMove}
      onPointerEnter={() => setActive(true)}
      onPointerLeave={() => {
        setActive(false);
        reset();
      }}
      className={cn(
        "group/tilt relative [transform-style:preserve-3d] [transition:transform_400ms_cubic-bezier(0.22,1,0.36,1),box-shadow_400ms_ease]",
        "[transform:perspective(900px)_rotateX(var(--tilt-x,0deg))_rotateY(var(--tilt-y,0deg))]",
        enabled && active && "transition-none",
        className
      )}
    >
      {glare ? (
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 rounded-[inherit] opacity-0 transition-opacity duration-300 group-hover/tilt:opacity-100"
          style={{
            background:
              "radial-gradient(420px circle at var(--glare-x,50%) var(--glare-y,50%), rgb(255 255 255 / 0.07), transparent 62%)",
          }}
        />
      ) : null}
      {children}
    </div>
  );
}
