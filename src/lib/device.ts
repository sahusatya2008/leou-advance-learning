import crypto from "node:crypto";

export type ParsedDevice = {
  browser: string;
  os: string;
  device: string;
  isMobile: boolean;
};

export function parseDevice(userAgent?: string | null): ParsedDevice {
  const ua = userAgent ?? "";
  let os = "Unknown OS";
  let browser = "Unknown browser";
  let device = "Desktop";
  let isMobile = false;

  if (/Android/i.test(ua)) {
    os = "Android";
    isMobile = true;
    device = "Mobile";
  } else if (/iPhone|iPad|iPod/i.test(ua)) {
    os = "iOS";
    isMobile = true;
    device = "Mobile";
  } else if (/Mac OS X/i.test(ua) || /Mac OS/i.test(ua)) {
    os = "macOS";
  } else if (/Windows NT/i.test(ua)) {
    os = "Windows";
  } else if (/Linux/i.test(ua)) {
    os = "Linux";
  }

  if (/Edg\//i.test(ua)) browser = "Edge";
  else if (/OPR\/|Opera/i.test(ua)) browser = "Opera";
  else if (/Firefox\//i.test(ua)) browser = "Firefox";
  else if (/Chrome\//i.test(ua)) browser = "Chrome";
  else if (/Safari\//i.test(ua)) browser = "Safari";

  if (isMobile && /iPad/i.test(ua)) device = "Tablet";

  return { browser, os, device, isMobile };
}

export function makeDeviceId(ip?: string, userAgent?: string): string {
  const raw = [ip ?? "?", userAgent ?? "?"].join("|");
  return crypto.createHash("sha256").update(raw).digest("hex").slice(0, 24);
}