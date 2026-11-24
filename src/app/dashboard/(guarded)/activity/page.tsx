import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/panels";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Activity, ScrollText, Megaphone } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function ActivityPage() {
  const { user } = await requireRole("STUDENT");
  const profId = user.studentProfile?.id;

  const [logs, notices] = await Promise.all([
    prisma.activityLog.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
    prisma.notice.findMany({
      where: profId ? { batchId: { in: (await prisma.batchStudent.findMany({
        where: { studentId: profId },
        select: { batchId: true },
      })).map((b) => b.batchId) } } : {},
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Activity</h1>
        <p className="text-sm text-muted-foreground">Your recent actions alongside batch notices.</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="glass">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <ScrollText className="h-4 w-4" /> My activity
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {logs.length === 0 && (
              <p className="text-sm text-muted-foreground">No activity recorded yet.</p>
            )}
            {logs.map((log) => (
              <div key={log.id} className="flex items-center justify-between gap-3 rounded-lg border border-border bg-card/50 px-4 py-2.5">
                <Badge variant="secondary" className="font-mono text-xs">{log.type}</Badge>
                <span className="text-xs text-muted-foreground">{log.createdAt.toLocaleString()}</span>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="glass">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Megaphone className="h-4 w-4" /> Notices
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {notices.length === 0 && (
              <div className="flex items-center gap-3 text-sm text-muted-foreground">
                <Activity className="h-4 w-4" /> No notices for your batches.
              </div>
            )}
            {notices.map((n) => (
              <div key={n.id} className="rounded-lg border border-border bg-card/60 px-4 py-3">
                <p className="text-sm font-medium">{n.title}</p>
                {n.body && <p className="mt-1 text-xs text-muted-foreground">{n.body}</p>}
                <p className="mt-2 text-xs text-muted-foreground">{n.createdAt.toLocaleDateString()}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}