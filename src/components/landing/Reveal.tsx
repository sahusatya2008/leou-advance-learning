"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { useInView } from "./motion";

/**
 * Fades and lifts its children into view once, when they first scroll in.
 *
 * The hidden state lives in CSS behind `prefers-reduced-motion: no-preference`
 * (see `.reveal` in globals.css), so this component only ever sets
 * `data-shown`. That means the entrance is not JavaScript-dependent for
 * correctness: with reduced motion, or with scripting unavailable, the content
 * simply renders as-is.
 */
export function Reveal({
  children,
  /** Milliseconds to wait after entering the viewport. Use to stagger a row. */
  delay = 0,
  /** Travel direction and distance. */
  variant = "up",
  /** Element to render, so lists stay valid HTML. */
  as = "div",
  className,
  style,
}: {
  children?: React.ReactNode;
  delay?: number;
  variant?: "up" | "far" | "x" | "scale";
  as?: React.ElementType;
  className?: string;
  style?: React.CSSProperties;
}) {
  const { ref, inView } = useInView<HTMLElement>({ once: true, rootMargin: "0px 0px -6% 0px" });

  const variants = {
    up: "reveal",
    far: "reveal reveal-far",
    x: "reveal reveal-x",
    scale: "reveal reveal-scale",
  } as const;

  return React.createElement(
    as,
    {
      ref,
      "data-shown": inView ? "true" : "false",
      className: cn(variants[variant], className),
      // `--reveal-delay` is a custom property, which CSSProperties does not
      // model; the assertion is safe because no declared property conflicts.
      style: { ...style, "--reveal-delay": `${delay}ms` } as React.CSSProperties,
    },
    children
  );
}
