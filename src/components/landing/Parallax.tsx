"use client";

import * as React from "react";
import { useInView, useReducedMotion } from "./motion";

/**
 * Depth on scroll: the child drifts against the page at a fraction of its
 * speed, which reads as parallax.
 *
 * The transform is written straight to `style.transform` inside a
 * `requestAnimationFrame` callback rather than through React state, so a scroll
 * never triggers a render. Work only happens while the wrapper is near the
 * viewport, and the offset is clamped so a fast flick cannot throw content off
 * screen.
 */
export function Parallax({
  children,
  /** Fraction of scroll distance to offset by. Negative drifts the other way. */
  speed = 0.12,
  /** Largest offset in pixels. */
  limit = 90,
  className,
  style,
}: {
  children: React.ReactNode;
  speed?: number;
  limit?: number;
  className?: string;
  style?: React.CSSProperties;
}) {
  const reduced = useReducedMotion();
  const { ref, inView } = useInView<HTMLDivElement>({ once: false, rootMargin: "25% 0px 25% 0px" });
  const innerRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const inner = innerRef.current;
    const outer = ref.current;
    if (!inner || !outer) return;

    if (reduced) {
      inner.style.transform = "";
      return;
    }

    let frame = 0;

    const update = () => {
      frame = 0;
      const rect = outer.getBoundingClientRect();
      // Distance of this block's centre from the viewport centre. Positive when
      // the block sits below the fold.
      const delta = rect.top + rect.height / 2 - window.innerHeight / 2;
      const offset = Math.max(-limit, Math.min(limit, delta * speed));
      inner.style.transform = `translate3d(0, ${offset.toFixed(2)}px, 0)`;
    };

    const schedule = () => {
      if (!frame) frame = window.requestAnimationFrame(update);
    };

    /* Only listen while this block is anywhere near the viewport. Without this
       gate every Parallax on the page holds a scroll listener for the whole
       session, including the ones buried far below the fold. */
    if (!inView) {
      inner.style.transform = "";
      return;
    }

    update();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      inner.style.transform = "";
    };
  }, [reduced, speed, limit, ref, inView]);

  return (
    <div ref={ref} data-parallax className={className} style={style}>
      <div
        ref={innerRef}
        data-parallax-target
        style={inView && !reduced ? { willChange: "transform" } : undefined}
      >
        {children}
      </div>
    </div>
  );
}
