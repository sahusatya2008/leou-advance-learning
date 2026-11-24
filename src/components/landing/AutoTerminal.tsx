"use client";

/**
 * An auto-typing terminal for the security section.
 *
 * It shows an illustrative activity trace of what the platform does around a
 * submission — grade it, verify the student's face, check the fee ledger — in
 * the shape those events are written to the audit log. It deliberately stops at
 * product-level outcomes and never exposes how any of it is implemented.
 *
 * It types itself only while on screen, stops for good under reduced motion
 * (where it renders the finished transcript instead of an empty box), and
 * replays from the top each time it scrolls into view.
 */

import { useEffect, useRef, useState } from "react";
import { useInView, useReducedMotion } from "./motion";
import s from "./landing.module.css";

type Line = { text: string; tone?: "dim" | "good" | "cyan" | "warn" };

const SCRIPT: Line[] = [
  { text: '$ leou grade --assignment "Coding 04"', tone: "cyan" },
  { text: "  student      Aarav M." },
  { text: "  submitted    02 Oct, 7:41 pm" },
  { text: "  auto-scored  41 / 44", tone: "good" },
  { text: "  ✓ result held until release · 1.2s", tone: "good" },
  { text: "" },
  { text: "$ leou verify --student aarav", tone: "cyan" },
  { text: '  {"liveness":true,"match":true,"ready":true}', tone: "dim" },
  { text: "" },
  { text: "$ leou fees --pending", tone: "cyan" },
  { text: "  3 to confirm · 0 mismatched", tone: "dim" },
  { text: "  ✓ all matched", tone: "good" },
];

const FLAT = SCRIPT.map((l) => l.text);

const tone = (t?: Line["tone"]) =>
  t === "good"
    ? s.tkStr
    : t === "cyan"
      ? s.tkFn
      : t === "warn"
        ? s.tkNum
        : undefined;

const Transcript = ({ lines }: { lines: number }) => (
  <>
    {SCRIPT.slice(0, lines).map((l, i) => (
      <div key={i} className={tone(l.tone)}>
        {l.text || " "}
      </div>
    ))}
    {lines < FLAT.length ? <span className={s.cursor} /> : null}
  </>
);

export function AutoTerminal() {
  const reduced = useReducedMotion();
  const { ref, inView } = useInView<HTMLDivElement>({ once: false, rootMargin: "20% 0px" });

  const [chars, setChars] = useState(0);
  const [run, setRun] = useState(0);
  const wasVisible = useRef(false);

  /* Replay whenever it comes back into view. Guarded by a ref so this only
     bumps on an actual false→true edge, not on every render. */
  useEffect(() => {
    if (inView && !wasVisible.current) setRun((r) => r + 1);
    wasVisible.current = inView;
  }, [inView]);

  useEffect(() => {
    /* Reduced motion and off-screen both render the finished transcript, so the
       count is only advanced while the element is on screen and animation is
       allowed. No reset here: the incrementing `run` key already restarts it. */
    if (reduced || !inView) return;

    let i = 0;
    let timer: number;
    const tick = () => {
      /* Pause at line ends so the transcript reads as commands, not a blur. */
      const hold = FLAT[i]?.endsWith("\n") || FLAT[i] === undefined;
      i = Math.min(FLAT.length, i + 1);
      setChars(i);
      timer = window.setTimeout(tick, hold ? 340 : 16);
    };
    timer = window.setTimeout(tick, 400);
    return () => window.clearTimeout(timer);
  }, [reduced, inView, run]);

  return (
    <div ref={ref} className={`${s.editor} ${s.lpEdge}`} style={{ borderRadius: "0.7rem" }}>
      <div className={s.editorBar}>
        <span>leou · activity</span>
        <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span
            style={{
              width: 6,
              height: 6,
              borderRadius: 999,
              background: "var(--lp-good)",
              boxShadow: "0 0 8px var(--lp-good)",
            }}
          />
          live
        </span>
      </div>
      <div className={s.code} data-terminal-body style={{ minHeight: "13.5rem" }}>
        {reduced ? (
          <Transcript lines={FLAT.length} />
        ) : (
          <Transcript lines={chars} />
        )}
      </div>
    </div>
  );
}
