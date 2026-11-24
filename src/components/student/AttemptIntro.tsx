"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Clock, Loader2, Play, Sparkles, ListChecks, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { kindBadge } from "@/lib/assessmentConstants";
import type { AssessmentKind } from "@/generated/prisma/enums";
import { durationLabel } from "@/lib/assessmentTime";

type Breakdown = { type: string; count: number }[];

export default function AttemptIntro({
  assessmentId,
  title,
  kind,
  durationMinutes,
  totalMarks,
  instructions,
  questionCount,
  breakdown,
  deadline,
  closesAt,
  attemptHint,
}: {
  assessmentId: string;
  title: string;
  kind: AssessmentKind;
  durationMinutes: number;
  totalMarks: number;
  instructions: string | null;
  questionCount: number;
  breakdown: Breakdown;
  deadline: string | null;
  closesAt: string | null;
  attemptHint?: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [remaining] = useState<number | null>(() =>
    deadline ? Math.max(0, Math.floor((new Date(deadline).getTime() - Date.now()) / 60_000)) : null
  );

  const begin = async () => {
    setBusy(true);
    try {
      const res = await fetch("/api/student/attempt/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assessmentId }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) return toast.error(body.error ?? "Could not open the attempt.");
      router.push(`/dashboard/assessments/${assessmentId}?begin=1`);
      router.refresh();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <div className="space-y-1.5">
        <Badge variant="outline">{kindBadge(kind)}</Badge>
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        {instructions && (
          <p className="whitespace-pre-wrap rounded-xl border border-border bg-card/60 px-4 py-3 text-sm text-muted-foreground">
            {instructions}
          </p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat
          icon={<Clock className="h-4 w-4" />}
          label={remaining != null ? "Time left" : "Duration"}
          value={remaining != null ? `${remaining} min` : durationLabel(durationMinutes)}
        />
        <Stat icon={<Sparkles className="h-4 w-4" />} label="Total marks" value={`${totalMarks}`} />
        <Stat icon={<ListChecks className="h-4 w-4" />} label="Questions" value={`${questionCount}`} />
        <Stat icon={<FileText className="h-4 w-4" />} label="Status" value={remaining != null ? "Resuming" : (closesAt ? `closes ${new Date(closesAt).toLocaleDateString()}` : "Ready")} />
      </div>

      {breakdown.length > 0 && (
        <Card className="glass">
          <CardContent className="p-4">
            <p className="mb-2 text-xs font-medium text-muted-foreground">Question types</p>
            <div className="flex flex-wrap gap-2">
              {breakdown.map((b) => (
                <Badge key={b.type} variant="secondary">
                  {b.count} × {b.type}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="glass">
        <CardContent className="flex items-center justify-between gap-4 p-5">
          <div className="text-sm text-muted-foreground">
            {remaining != null ? (
              <>
                You already started. The clock is running — <span className="font-semibold text-foreground">{remaining} min</span> left.
              </>
            ) : (
              <>
                The timer starts the moment you begin. Your answers are saved automatically as you go.
              </>
            )}
            {attemptHint && (
              <p className="mt-1 text-xs font-medium text-primary">{attemptHint}</p>
            )}
          </div>
          <Button onClick={() => void begin()} disabled={busy} className="shrink-0">
            {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Play className="mr-2 h-4 w-4" />}
            {remaining != null ? "Resume attempt" : "Start attempt"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <Card className="glass">
      <CardContent className="space-y-1 p-4">
        <div className="text-muted-foreground">{icon}</div>
        <p className="text-xl font-bold">{value}</p>
        <p className="text-xs text-muted-foreground">{label}</p>
      </CardContent>
    </Card>
  );
}