"use client";

import { useEffect, useRef, useState } from "react";
import { ShieldAlert } from "lucide-react";

/**
 * A client-side deterrent against casual inspection of the running app.
 *
 * Honest scope: nothing here is a security boundary. It cannot stop anyone who
 * opens the browser's own menu, uses a second browser, disables JavaScript, or
 * reads the network tab of a different device — a determined person inspects a
 * web app regardless of what the app wants. What it does do is remove the
 * easiest paths (right-click → Inspect, F12, the standard devtools shortcuts)
 * and cover the page with a "Restricted Area" notice the moment devtools is
 * detected, so casual snooping reads as blocked.
 *
 * Docked devtools is detected by the gap it leaves between the window's outer
 * and inner sizes. Undocked (separate-window) devtools, and any in-browser
 * preference that hides its own chrome, are invisible to this heuristic — the
 * gap stays at zero. That limitation is inherent and deliberate: the goal is a
 * deterrent, not a lock.
 */

const WIDTH_THRESHOLD = 200;
const HEIGHT_THRESHOLD = 200;
const POLL_MS = 1000;
const CONFIRMATIONS = 2;
// Below this width the outer/inner gap is dominated by mobile browser chrome
// and the on-screen keyboard, which would false-positive the overlay and trap
// phone users. Phones still get the shortcut/right-click block, just not the
// size probe.
const MIN_WIDTH_FOR_PROBE = 820;

function devtoolsLikelyOpen(): boolean {
  if (typeof window === "undefined") return false;
  if (window.innerWidth < MIN_WIDTH_FOR_PROBE) return false;
  const widthGap = window.outerWidth - window.innerWidth;
  const heightGap = window.outerHeight - window.innerHeight;
  return widthGap > WIDTH_THRESHOLD || heightGap > HEIGHT_THRESHOLD;
}

/**
 * Right-click stays available where blocking it would break legitimate work:
 * Monaco's editor menu, and copy/paste in form fields.
 */
function isExemptTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  if (target.closest(".monaco-editor")) return true;
  const tag = target.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  if (target instanceof HTMLElement && target.isContentEditable) return true;
  return false;
}

export default function DevtoolsGuard() {
  const [restricted, setRestricted] = useState(false);
  const positives = useRef(0);
  const negatives = useRef(0);

  useEffect(() => {
    const onContextMenu = (e: MouseEvent) => {
      if (isExemptTarget(e.target)) return;
      e.preventDefault();
    };

    const onKeyDown = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      const mod = e.ctrlKey || e.metaKey;
      const blocked =
        key === "f12" ||
        (mod && e.shiftKey && (key === "i" || key === "j" || key === "c" || key === "k")) ||
        (mod && !e.shiftKey && !e.altKey && key === "u") ||
        (e.metaKey && e.altKey && (key === "i" || key === "j" || key === "c"));
      if (!blocked) return;
      e.preventDefault();
      e.stopPropagation();
      // Immediate feedback; if no real devtools follows, the probe's negatives
      // dismiss the overlay again within a couple of seconds.
      setRestricted(true);
    };

    document.addEventListener("contextmenu", onContextMenu, true);
    document.addEventListener("keydown", onKeyDown, true);

    // Confirm over consecutive polls so a one-off resize (or the keyboard
    // opening) cannot flash the overlay.
    const timer = window.setInterval(() => {
      if (devtoolsLikelyOpen()) {
        positives.current += 1;
        negatives.current = 0;
        if (positives.current >= CONFIRMATIONS) setRestricted(true);
      } else {
        negatives.current += 1;
        positives.current = 0;
        if (negatives.current >= CONFIRMATIONS) setRestricted(false);
      }
    }, POLL_MS);

    return () => {
      document.removeEventListener("contextmenu", onContextMenu, true);
      document.removeEventListener("keydown", onKeyDown, true);
      window.clearInterval(timer);
    };
  }, []);

  if (!restricted) return null;

  return (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-label="Restricted Area"
      onContextMenu={(e) => e.preventDefault()}
      className="fixed inset-0 z-[2147483646] flex flex-col items-center justify-center gap-4 bg-zinc-950 px-6 text-center"
    >
      <ShieldAlert className="h-14 w-14 text-red-500" aria-hidden />
      <h1 className="text-2xl font-semibold tracking-tight text-zinc-50 sm:text-3xl">
        Restricted Area
      </h1>
      <p className="max-w-md text-sm leading-relaxed text-zinc-400">
        Developer tools and page inspection are disabled on this platform. Close
        the developer tools to continue.
      </p>
    </div>
  );
}
