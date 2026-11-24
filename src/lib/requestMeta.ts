import type { NextRequest } from "next/server";
import { makeDeviceId, parseDevice, type ParsedDevice } from "@/lib/device";

export type RequestMeta = {
  ip: string;
  userAgent: string;
  deviceId: string;
  device: ParsedDevice;
};

export function getRequestMeta(req: NextRequest | Request): RequestMeta {
  const headers = req.headers;
  const userAgent = headers.get("user-agent") ?? "";
  const ip =
    headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    headers.get("x-real-ip") ||
    "unknown";
  return {
    ip,
    userAgent,
    deviceId: makeDeviceId(ip, userAgent),
    device: parseDevice(userAgent),
  };
}