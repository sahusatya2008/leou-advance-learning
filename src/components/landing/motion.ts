"use client";

import * as React from "react";

/**
 * Subscribes to a media query.
 *
 * `useSyncExternalStore` rather than `useState` + `matchMedia` listener: the
 * browser already owns this state, so React should read it as an external store
 * instead of mirroring it into component state.
 *
 * The server snapshot is `true` for "reduce motion", so the first paint of a
 * page is the static, motion-free version. That ordering matters — someone who
 * asked for reduced motion should never watch the animation start before we
 * notice and stop it.
 */
function useMediaQuery(query: string): boolean {
  const subscribe = React.useCallback(
    (onChange: () => void) => {
      const mq = window.matchMedia(query);
      mq.addEventListener("change", onChange);
      return () => mq.removeEventListener("change", onChange);
    },
    [query]
  );

  const getSnapshot = React.useCallback(() => window.matchMedia(query).matches, [query]);

  return React.useSyncExternalStore(
    subscribe,
    getSnapshot,
    // Server render: assume reduced motion.
    () => true
  );
}

export function useReducedMotion(): boolean {
  return useMediaQuery("(prefers-reduced-motion: reduce)");
}

/** True on devices with a precise pointer, where hovering and tilt make sense. */
export function useFinePointer(): boolean {
  return useMediaQuery("(pointer: fine)");
}

/**
 * True once the element has scrolled into view.
 *
 * Used to start animations off-screen and to stop the expensive ones (parallax,
 * typing demos) once they have scrolled away, so an idle long page costs
 * nothing.
 */
export function useInView<T extends HTMLElement>(options?: { once?: boolean; rootMargin?: string }) {
  const once = options?.once ?? true;
  const rootMargin = options?.rootMargin ?? "0px 0px -10% 0px";

  // Lazily initialised: without IntersectionObserver, show content rather than
  // hide it forever. Reading a global here is a render-safe capability check,
  // not a ref read.
  const [inView, setInView] = React.useState(() => typeof IntersectionObserver === "undefined");

  const ref = React.useRef<T>(null);
  const observerRef = React.useRef<IntersectionObserver | undefined>(undefined);

  React.useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") return;

    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          if (once) io.disconnect();
        } else if (!once) {
          setInView(false);
        }
      },
      { rootMargin }
    );
    observerRef.current = io;
    io.observe(el);
    return () => io.disconnect();
  }, [once, rootMargin]);

  return { ref, inView };
}

/**
 * A timer that only runs when the document is visible.
 *
 * Auto-playing demos are the main battery and CPU cost on this page. Pausing
 * them when the tab is in the background (or the phone is locked) is the
 * difference between a page you can leave open and one that heats the device.
 */
export function useVisibleInterval(callback: () => void, delayMs: number | null) {
  const saved = React.useRef(callback);

  // Kept current in an effect rather than during render, so the render pass
  // stays free of ref writes.
  React.useEffect(() => {
    saved.current = callback;
  }, [callback]);

  React.useEffect(() => {
    if (delayMs == null) return;
    if (typeof document !== "undefined" && document.hidden) return;

    let id: number | undefined;
    const start = () => {
      if (id != null) return;
      id = window.setInterval(() => saved.current(), delayMs);
    };
    const stop = () => {
      if (id == null) return;
      window.clearInterval(id);
      id = undefined;
    };
    const onVisibility = () => (document.hidden ? stop() : start());

    start();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [delayMs]);
}

/**
 * How far down the document the visitor has scrolled, 0 → 1.
 *
 * The value is written to a CSS custom property and read back by CSS, so the
 * nav's progress hairline animates without re-rendering React on every frame
 * of a scroll.
 */
export function useScrollProgress(prop = "--lp-progress") {
  React.useEffect(() => {
    if (typeof window === "undefined") return;

    let frame = 0;
    const update = () => {
      frame = 0;
      const max = document.documentElement.scrollHeight - window.innerHeight;
      const ratio = max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0;
      document.documentElement.style.setProperty(prop, ratio.toFixed(4));
    };
    const schedule = () => {
      if (!frame) frame = window.requestAnimationFrame(update);
    };

    update();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
    };
  }, [prop]);
}

/**
 * Progress through the first screenful, 0 → 1.
 *
 * Distinct from `useScrollProgress`: that one measures the whole document for
 * the nav hairline, this one measures only the hero so the headline can recede
 * — fading, lifting and shrinking a touch — as the reader starts to scroll.
 * Written to a custom property for the same reason: the animation is a pure CSS
 * consequence of the scroll, so React never re-renders while the wheel turns.
 */
export function useHeroScroll(prop = "--lp-hero") {
  React.useEffect(() => {
    if (typeof window === "undefined") return;

    let frame = 0;
    const update = () => {
      frame = 0;
      const span = window.innerHeight || 1;
      const ratio = Math.min(1, Math.max(0, window.scrollY / span));
      document.documentElement.style.setProperty(prop, ratio.toFixed(4));
    };
    const schedule = () => {
      if (!frame) frame = window.requestAnimationFrame(update);
    };

    update();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
    };
  }, [prop]);
}
