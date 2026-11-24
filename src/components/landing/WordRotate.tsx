"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { useInView, useReducedMotion, useVisibleInterval } from "./motion";

/**
 * A headline that cycles through words on its own.
 *
 * All words are rendered at once and stacked, because animating `width` to
 * match a changing string would reflow the headline on every frame. Only the
 * active word animates, and each is given the same slot so the line never
 * shifts.
 *
 * Under reduced motion it renders the first word, statically.
 */
export function WordRotate({
  words,
  intervalMs = 2800,
  className,
}: {
  words: readonly string[];
  intervalMs?: number;
  className?: string;
}) {
  const reduced = useReducedMotion();
  const { ref, inView } = useInView<HTMLSpanElement>({ once: false, rootMargin: "0px 0px -15% 0px" });
  const [index, setIndex] = React.useState(0);

  useVisibleInterval(() => setIndex((i) => (i + 1) % words.length), inView && !reduced ? intervalMs : null);

  return (
    <span ref={ref} className={cn("relative inline-grid text-left align-bottom", className)}>
      {/* Sizing element: keeps the slot as wide as the longest word so the
          headline does not resize as the words change. */}
      <span className="invisible col-start-1 row-start-1" aria-hidden>
        {words.reduce((a, b) => (a.length >= b.length ? a : b))}
      </span>
      {words.map((w, i) => (
        <span
          key={w}
          className={cn(
            "col-start-1 row-start-1 whitespace-nowrap",
            i === index ? "opacity-100" : "opacity-0"
          )}
          style={
            reduced
              ? undefined
              : {
                  transition: "opacity 420ms ease, transform 420ms cubic-bezier(0.22,1,0.36,1)",
                  transform: i === index ? "translateY(0)" : i < index ? "translateY(-45%)" : "translateY(45%)",
                }
          }
          aria-hidden={i !== index}
        >
          {w}
        </span>
      ))}
      {/* Announced once, so a screen reader hears a stable sentence. */}
      <span className="sr-only">{words[0]}</span>
    </span>
  );
}
