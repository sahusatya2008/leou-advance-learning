import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollText, Monitor, Smartphone, Globe } from "lucide-react";

const TYPE_STYLE: Record<string, string> = {
  LOGIN_PASSWORD: "bg-emerald-500/15 text-emerald-300",
  LOGIN_FACE: "bg-emerald-500/15 text-emerald-300",
  LOGIN_ACCESS_CODE: "bg-cyan-500/15 text-cyan-300",
  LOGIN_PASSWORD_FAIL: "bg-amber-500/15 text-amber-300",
  LOGIN_FACE_FAIL: "bg-amber-500/15 text-amber-300",
  ACCESS_CODE_GENERATED: "bg-indigo-500/15 text-indigo-300",
  ACCESS_CODE_CONSUMED: "bg-indigo-500/15 text-indigo-300",
  FACE_ENROLL: "bg-indigo-500/15 text-indigo-300",
  LOGOUT: "bg-secondary text-muted-foreground",
  SESSION_REVOKED: "bg-red-500/15 text-red-300",
  SUBMIT: "bg-violet-500/15 text-violet-300",
  ATTEMPT_START: "bg-violet-500/15 text-violet-300",
};

const LOGIN_TYPES = new Set([
  "LOGIN_PASSWORD",
  "LOGIN_FACE",
  "LOGIN_ACCESS_CODE",
  "LOGIN_PASSWORD_FAIL",
  "LOGIN_FACE_FAIL",
  "LOGOUT",
]);

function describeDevice(ua: string | null) {
  if (!ua) return null;
  const browser = /Edg\//.test(ua)
    ? "Edge"
    : /OPR\//.test(ua)
      ? "Opera"
      : /Chrome\//.test(ua) && !/Chromium/.test(ua)
        ? "Chrome"
        : /Firefox\//.test(ua)
          ? "Firefox"
          : /Safari\//.test(ua) && !/Chrome\//.test(ua)
            ? "Safari"
            : /Mobile/.test(ua)
              ? "Mobile browser"
              : "Browser";
  const os =
    /Windows/.test(ua)
      ? "Windows"
      : /Android/.test(ua)
        ? "Android"
        : /iPhone|iPad|iPod/.test(ua)
          ? "iOS"
          : /Mac OS X/.test(ua)
            ? "macOS"
            : /Linux/.test(ua)
              ? "Linux"
              : /CrOS/.test(ua)
                ? "ChromeOS"
                : "OS";
  const isMobile = /Mobile|Android|iPhone|iPad/.test(ua);
  return { browser, os, mobile: isMobile };
}

export default async function StudentActivityLog({ studentUserId }: { studentUserId: string }) {
  const logs = await prisma.activityLog.findMany({
    where: { userId: studentUserId },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return (
    <Card className="glass">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <ScrollText className="h-4 w-4" /> Activity, logins & devices
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {logs.length === 0 && (
          <p className="text-sm text-muted-foreground">No activity recorded yet.</p>
        )}
        {logs.map((log) => {
          const device = describeDevice(log.userAgent);
          const isLogin = LOGIN_TYPES.has(log.type);
          return (
            <div key={log.id} className="rounded-lg border border-border bg-card/50 px-4 py-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex min-w-0 flex-wrap items-center gap-2">
                  <Badge className={TYPE_STYLE[log.type] ?? "bg-secondary text-muted-foreground"}>
                    {log.type.replace(/_/g, " ")}
                  </Badge>
                  {isLogin && log.ip ? (
                    <span className="flex items-center gap-1 font-mono text-xs text-muted-foreground">
                      <Globe className="h-3 w-3" /> {log.ip}
                    </span>
                  ) : (
                    log.ip && <span className="font-mono text-xs text-muted-foreground">{log.ip}</span>
                  )}
                </div>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {log.createdAt.toLocaleString()}
                </span>
              </div>
              {isLogin && (log.userAgent || device) && (
                <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
                  {device?.mobile ? (
                    <Smartphone className="h-3 w-3" />
                  ) : (
                    <Monitor className="h-3 w-3" />
                  )}
                  <span>
                    {device ? `${device.browser} · ${device.os}` : log.userAgent?.slice(0, 60)}
                  </span>
                </div>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}