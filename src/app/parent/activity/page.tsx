import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/panels";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Activity as ActivityIcon } from "lucide-react";

export const dynamic = "force-dynamic";

const LOGIN_LABEL: Record<string, string> = {
  LOGIN_PASSWORD: "Signed in with password",
  LOGIN_FACE: "Face login",
  LOGIN_ACCESS_CODE: "Access-code login",
  LOGIN_SUCCESS: "Login",
  LOGOUT: "Signed out",
  PARENT_LOGIN: "Parent signed in",
};

function fmtDate(v: Date | string) {
  return new Date(v).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default async function ParentActivityPage() {
  const { user } = await requireRole("PARENT");
  const profile = user.parentProfile;

  const students = profile
    ? await prisma.studentProfile.findMany({
        where: { parentUserId: profile.id },
        include: { user: { select: { id: true, username: true } } },
        orderBy: { fullName: "asc" },
      })
    : [];

  const rows = await Promise.all(
    students.map(async (s) => {
      const [events, practicalCount] = await Promise.all([
        prisma.activityLog.findMany({
          where: { userId: s.user.id },
          orderBy: { createdAt: "desc" },
          take: 30,
          select: { id: true, type: true, createdAt: true, ip: true },
        }),
        prisma.practicalAttempt.count({ where: { studentId: s.id } }),
      ]);
      return { s, events, practicalCount };
    }),
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <ActivityIcon className="h-6 w-6 text-primary" /> Activity
        </h1>
        <p className="text-sm text-muted-foreground">
          Recent sign-ins and activity for your linked students. Results and payments live on each
          child&apos;s page.
        </p>
      </div>

      {rows.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center text-sm text-muted-foreground">
            No students linked yet.
          </CardContent>
        </Card>
      ) : (
        rows.map(({ s, events, practicalCount }) => (
          <Card key={s.id}>
            <CardHeader className="pb-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <CardTitle className="text-lg">{s.fullName}</CardTitle>
                <Badge variant="secondary">{practicalCount} practical sessions</Badge>
              </div>
              <p className="text-xs text-muted-foreground">@{s.user.username}</p>
            </CardHeader>
            <CardContent>
              {events.length === 0 ? (
                <p className="py-3 text-sm text-muted-foreground">Nothing recorded yet.</p>
              ) : (
                <div className="divide-y rounded-md border">
                  {events.map((a) => (
                    <div key={a.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                      <span>{LOGIN_LABEL[a.type] ?? a.type}</span>
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {fmtDate(a.createdAt)}
                        {a.ip ? ` · ${a.ip}` : ""}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
}