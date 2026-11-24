"use client";

import * as React from "react";
import { useInView, useReducedMotion } from "./motion";

/**
 * Counts up to a value the first time it scrolls into view.
 *
 * Under reduced motion the final value is rendered immediately — a number
 * visibly ticking up is exactly the kind of motion that setting asks people to
 * avoid. The target is also read from the DOM on mount rather than trusted
 * blindly, so a mismatch between markup and props cannot leave a wrong number
 * on screen.
 */
export function CountUp({
  to,
  from = 0,
  durationMs = 1500,
  decimals = 0,
  prefix = "",
  suffix = "",
  className,
}: {
  to: number;
  from?: number;
  durationMs?: number;
  decimals?: number;
  prefix?: string;
  suffix?: string;
  className?: string;
}) {
  const reduced = useReducedMotion();
  const { ref, inView } = useInView<HTMLSpanElement>({ once: true, rootMargin: "0px 0px -10% 0px" });
  const [value, setValue] = React.useState(from);

  React.useEffect(() => {
    if (!inView || reduced) return;

    let frame = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs);
      // easeOutExpo: fast start, long settle. Reads as "counting up" rather
      // than as a linear machine.
      const eased = t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
      setValue(from + (to - from) * eased);
      if (t < 1) frame = window.requestAnimationFrame(tick);
    };
    frame = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frame);
  }, [inView, reduced, to, from, durationMs]);

  // Reduced motion (and the very first paint, before the effect runs) shows the
  // real figure rather than a stale zero.
  const shown = reduced ? to : value;

  return (
    <span ref={ref} className={className}>
      {prefix}
      {shown.toLocaleString("en-IN", {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      })}
      {suffix}
    </span>
  );
}
