"use client";

/**
 * Small, state-free scroll affordances for the landing page.
 *
 * Each renders nothing and exists only to run a hook that writes a value to a
 * CSS custom property. Keeping the scroll position out of React state means the
 * progress bar and the hero's recede cost zero re-renders per frame.
 *
 *   `ScrollProgress` — whole-document progress for the nav hairline.
 *   `HeroScroll`     — first-screenful progress for the hero recede.
 *
 * The nav's own "stuck" glass state lives in `LandingNav`, since it needs a
 * class on the header element rather than a custom property.
 */

import { useHeroScroll, useScrollProgress } from "./motion";

export function ScrollProgress() {
  useScrollProgress();
  return null;
}

export function HeroScroll() {
  useHeroScroll();
  return null;
}

/**
 * Writes pointer position into `--mx` / `--my` on the hovered cell so the
 * spotlight in landing.module.css can follow the cursor. Mutating a custom
 * property is far cheaper than a state update per mousemove.
 */
export function SpotlightGrid({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={className}
      onPointerMove={(e) => {
        const el = e.currentTarget;
        const r = el.getBoundingClientRect();
        el.style.setProperty("--mx", `${e.clientX - r.left}px`);
        el.style.setProperty("--my", `${e.clientY - r.top}px`);
      }}
    >
      {children}
    </div>
  );
}
