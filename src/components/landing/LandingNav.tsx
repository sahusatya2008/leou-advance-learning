"use client";

/**
 * The landing-page navigation.
 *
 * Design goals, in order of importance:
 *
 *  1. It should feel alive without ever fighting the reader. Nothing here
 *     loops faster than a slow ambient turn, and every moving part is either
 *     scroll-driven (so the visitor controls it) or hover-driven (so it only
 *     happens when asked for).
 *  2. It should tell the truth about where you are. A scroll-spy tracks which
 *     section is in view and an "ink" pill glides between links to mark it —
 *     the pill also follows the pointer on hover, so the bar feels tactile.
 *  3. It should degrade cleanly. Under `prefers-reduced-motion` the global
 *     stylesheet collapses every duration, so the morph and the glide become
 *     instant rather than disappearing; the layout and all links stay intact.
 *
 * Performance note: scroll position is read once per animation frame and only
 * written to React state when the *value changes* (stuck on/off, active index).
 * The `NavStuck`-style separate overlay that used to repaint the backdrop is
 * gone — the header now carries its own glass state directly.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { LeouGlyph, SparkDot } from "@/components/brand";
import s from "./landing.module.css";

export type LandingNavItem = { href: string; label: string };

/** Where the scroll-spy considers a section to have "taken over" the screen. */
const SPY_MARKER = 168;

export function LandingNav({ nav }: { nav: LandingNavItem[] }) {
  const [stuck, setStuck] = useState(false);
  const [active, setActive] = useState<number | null>(null);
  const [hover, setHover] = useState<number | null>(null);
  const [ink, setInk] = useState<{ x: number; w: number } | null>(null);

  const railRef = useRef<HTMLElement>(null);
  const linkRefs = useRef<(HTMLAnchorElement | null)[]>([]);

  /* ------------------------------------------------------------- glass morph */
  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      setStuck(window.scrollY > 24);
    };
    const schedule = () => {
      if (!frame) frame = window.requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", schedule, { passive: true });
    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      window.removeEventListener("scroll", schedule);
    };
  }, []);

  /* ---------------------------------------------------------------- scroll-spy */
  useEffect(() => {
    const ids = nav.map((n) => n.href.replace(/^#/, ""));
    let frame = 0;
    const update = () => {
      frame = 0;
      let current: number | null = null;
      ids.forEach((id, i) => {
        const el = document.getElementById(id);
        if (el && el.getBoundingClientRect().top <= SPY_MARKER) current = i;
      });
      setActive(current);
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
  }, [nav]);

  /* ---------------------------------------------------- gliding ink indicator */
  const target = hover ?? active;

  const place = useCallback(() => {
    const rail = railRef.current;
    const el = target == null ? null : linkRefs.current[target];
    if (!rail || !el) {
      setInk(null);
      return;
    }
    const railBox = rail.getBoundingClientRect();
    const linkBox = el.getBoundingClientRect();
    if (linkBox.width === 0) {
      setInk(null);
      return;
    }
    setInk({ x: linkBox.left - railBox.left, w: linkBox.width });
  }, [target]);

  useEffect(() => {
    place();
  }, [place]);

  useEffect(() => {
    window.addEventListener("resize", place);
    /* Web fonts land after first paint and change the links' widths; one extra
       measurement a moment later keeps the pill from sitting a few pixels off. */
    const late = window.setTimeout(place, 250);
    return () => {
      window.removeEventListener("resize", place);
      window.clearTimeout(late);
    };
  }, [place]);

  return (
    <header className={`${s.nav} ${stuck ? s.navStuck : ""}`} data-stuck={stuck || undefined}>
      <div className={s.navShell}>
        <div className={s.navInner}>
          <Link href="/" className={s.brand} aria-label="Leou. home">
            <span className={s.brandMark}>
              <span className={s.brandOrbit} aria-hidden />
              <LeouGlyph className={s.brandGlyph} />
            </span>
            <span className={s.brandText}>
              Leou
              <SparkDot className={s.brandSpark} />
            </span>
          </Link>

          {/* Desktop rail. The ink pill is a sibling of the links so it can slide
              underneath them, and the links stay real anchors for the noscript
              and no-JavaScript cases. */}
          <nav
            ref={railRef}
            className={s.navRail}
            aria-label="Sections"
            onMouseLeave={() => setHover(null)}
          >
            <span
              className={s.navInk}
              data-show={ink ? "true" : undefined}
              style={ink ? { transform: `translateX(${ink.x}px)`, width: `${ink.w}px` } : undefined}
              aria-hidden
            />
            {nav.map((n, i) => (
              <a
                key={n.href}
                href={n.href}
                ref={(el) => {
                  linkRefs.current[i] = el;
                }}
                className={s.navLink}
                data-active={active === i || undefined}
                aria-current={active === i ? "true" : undefined}
                onMouseEnter={() => setHover(i)}
                onFocus={() => setHover(i)}
                onBlur={() => setHover(null)}
              >
                <span className={s.navLinkText}>{n.label}</span>
              </a>
            ))}
          </nav>

          <div className={s.navActions}>
            <Link href="/login" className={`${s.btnGhost} ${s.navSignIn}`}>
              <span>Sign in</span>
            </Link>
            <Link href="/register" className={`${s.btnPrimary} ${s.navCta}`}>
              <span>Get started</span>
              <ArrowRight className={s.navCtaIcon} style={{ width: 14, height: 14 }} />
            </Link>
          </div>
        </div>
      </div>

      {/* Small screens get the section links as a snap-scrolling chip rail —
          they must stay reachable, not collapse into a hamburger. */}
      <nav className={`${s.navMobile} scrollbar-none`} aria-label="Sections">
        {nav.map((n, i) => (
          <a
            key={n.href}
            href={n.href}
            className={s.navMobileLink}
            data-active={active === i || undefined}
            onClick={() => setActive(i)}
          >
            {n.label}
          </a>
        ))}
      </nav>

      <div className={`lp-progress ${s.progress}`} aria-hidden />
    </header>
  );
}
