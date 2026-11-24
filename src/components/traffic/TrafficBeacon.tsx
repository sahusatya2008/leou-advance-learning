"use client";

import { useEffect } from "react";

/**
 * Reports the browser-only half of a visitor's device profile (language, time
 * zone, screen, platform) to the traffic manager. The server can parse a user
 * agent, but only the client knows these.
 *
 * Fires at most once per browser session and renders nothing. It is pure
 * bookkeeping, so it stays silent on every failure.
 */
const SESSION_KEY = "leou_traffic_identified";

export default function TrafficBeacon() {
  useEffect(() => {
    try {
      if (window.sessionStorage.getItem(SESSION_KEY) === "1") return;
      window.sessionStorage.setItem(SESSION_KEY, "1");
    } catch {
      // Private mode / storage disabled: still send, just without the guard.
    }

    const nav = navigator as Navigator & { userAgentData?: { platform?: string } };
    const body = JSON.stringify({
      language: nav.language,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      screen: `${window.screen.width}x${window.screen.height}`,
      platform: nav.userAgentData?.platform ?? nav.platform,
    });

    fetch("/api/traffic/identify", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body,
      keepalive: true,
    }).catch(() => {});
  }, []);

  return null;
}
