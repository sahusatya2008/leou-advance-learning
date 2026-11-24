"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Loader2, ShieldCheck, KeyRound, Copy, CheckCircle2, XCircle, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

const inr = (n: number | null | undefined) => (n == null ? "—" : "₹" + n.toLocaleString("en-IN"));

type TopicQ = { name: string; rate: number };
type KindQ = { configured: boolean; items: TopicQ[]; total: number; residual: string[] };
type SubjectQ = {
  subjectId: string;
  subjectName: string;
  batchId: string | null;
  batchName: string | null;
  assignment: KindQ;
  mock: KindQ;
  test: KindQ;
  tutoring: { configured: boolean; plan: string; hours: number | null; rate: number; total: number; residual: string[] } | null;
};
type Breakdown = {
  perSubject?: SubjectQ[];
  totals?: { assignment: number; mock: number; test: number; tutoring: number; grand: number };
  warnings?: string[];
};

type CodeRow = { id: string; code: string; status: string; expiresAt: string; usedAt: string | null; createdAt: string };
type ActivationRow = { id: string; activatedAt: string; expiresAt: string };
type RequestRow = {
  id: string;
  status: string;
  amount: number | null;
  wantAssignments: boolean;
  wantMockTests: boolean;
  wantRealTests: boolean;
  wantTutoring: boolean;
  tutorPlan: string | null;
  tutorHours: number | null;
  subjectIds: number | never[];
  subjectNames: string[];
  assignmentTopics: string;
  mockTopics: string;
  testTopics: string;
  sameTopicsForMockTests: boolean;
  tutorGoals: string;
  boardName: string | null;
  classRoomName: string | null;
  breakdown: Breakdown | null;
  createdAt: string;
};

const STATUS_STYLES: Record<string, string> = {
  REQUESTED: "border-amber-400/50 bg-amber-500/10 text-amber-600",
  BILLED: "border-indigo-400/50 bg-indigo-500/10 text-indigo-500",
  ACTIVATED: "border-emerald-400/50 bg-emerald-500/10 text-emerald-600",
};

const PLAN_LABEL: Record<string, string> = {
  HOURLY: "hourly",
  WEEKLY: "per week",
  MONTHLY: "per month",
};

function topics(raw: string): string[] {
  return raw.split(",").map((t) => t.trim()).filter(Boolean);
}

export default function ServiceOnboardingCard({ userId }: { userId: string }) {
  const [requests, setRequests] = useState<RequestRow[] | null>(null);
  const [codes, setCodes] = useState<CodeRow[]>([]);
  const [activations, setActivations] = useState<ActivationRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [generated, setGenerated] = useState<string | null>(null);
  const [generatedExpiry, setGeneratedExpiry] = useState<string | null>(null);

  async function load() {
    const res = await fetch(`/api/admin/onboarding/students/${userId}`);
    const data = await res.json();
    if (!res.ok) return;
    setRequests(data.requests);
    setCodes(data.codes);
    setActivations(data.activations);
  }

  useEffect(() => {
    let cancelled = false;
    void fetch(`/api/admin/onboarding/students/${userId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (cancelled || !data) return;
        setRequests(data.requests);
        setCodes(data.codes);
        setActivations(data.activations);
      });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  async function allowAndGenerate() {
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/onboarding/students/${userId}/issue-code`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Could not allow the student.");
        return;
      }
      setGenerated(data.code);
      setGeneratedExpiry(data.expiresAt);
      toast.success("Services allowed & billed. Share the 15-digit access code with the student.");
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function copy(code: string) {
    await navigator.clipboard.writeText(code);
    toast.success("Code copied.");
  }

  const latest = requests?.[requests.length - 1] ?? null;
  const hasRequest = !!latest;
  const perSubject = latest?.breakdown?.perSubject ?? [];
  const warnings = latest?.breakdown?.warnings ?? [];

  return (
    <Card className="glass">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <ShieldCheck className="h-4 w-4" /> Service onboarding & payment
        </CardTitle>
        <CardDescription>
          {hasRequest
            ? "Full service request, quotation breakdown and payment history."
            : "This student has not submitted any service request yet."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {!hasRequest && (
          <p className="text-sm text-muted-foreground">
            Handled from the student&apos;s &ldquo;My Plan&rdquo; page after they select services.
          </p>
        )}

        {latest && (
          <>
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <Badge className={STATUS_STYLES[latest.status] ?? ""}>{latest.status.replace(/_/g, " ")}</Badge>
                {latest.boardName && <Badge variant="outline">{latest.boardName}</Badge>}
                {latest.classRoomName && <Badge variant="outline">{latest.classRoomName}</Badge>}
                <span className="text-xs text-muted-foreground">Requested {new Date(latest.createdAt).toLocaleDateString("en-IN")}</span>
              </div>

              {latest.subjectNames.length > 0 && (
                <div>
                  <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">Subjects</p>
                  <div className="flex flex-wrap gap-1.5">
                    {latest.subjectNames.map((s) => (
                      <Badge key={s} variant="secondary">{s}</Badge>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">Requested services & topics</p>
                <div className="space-y-1.5">
                  {latest.wantAssignments && (
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Badge variant="outline" className="text-xs">Assignments</Badge>
                      {topics(latest.assignmentTopics).map((t) => (
                        <span key={t} className="rounded-md bg-secondary text-xs text-muted-foreground">{t}</span>
                      ))}
                      {topics(latest.assignmentTopics).length === 0 && <span className="text-xs text-muted-foreground">(no chapters)</span>}
                    </div>
                  )}
                  {latest.wantMockTests && (
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Badge variant="outline" className="text-xs">Mock tests</Badge>
                      {topics(latest.sameTopicsForMockTests ? latest.assignmentTopics : latest.mockTopics).map((t) => (
                        <span key={t} className="rounded-md bg-secondary text-xs text-muted-foreground">{t}</span>
                      ))}
                      {topics(latest.sameTopicsForMockTests ? latest.assignmentTopics : latest.mockTopics).length === 0 && (
                        <span className="text-xs text-muted-foreground">(no chapters)</span>
                      )}
                    </div>
                  )}
                  {latest.wantRealTests && (
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Badge variant="outline" className="text-xs">Real tests</Badge>
                      {topics(latest.sameTopicsForMockTests ? latest.assignmentTopics : latest.testTopics).map((t) => (
                        <span key={t} className="rounded-md bg-secondary text-xs text-muted-foreground">{t}</span>
                      ))}
                      {topics(latest.sameTopicsForMockTests ? latest.assignmentTopics : latest.testTopics).length === 0 && (
                        <span className="text-xs text-muted-foreground">(no chapters)</span>
                      )}
                    </div>
                  )}
                  {latest.wantTutoring && (
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Badge variant="outline" className="text-xs">Learning from teacher</Badge>
                      <span className="text-xs text-muted-foreground">
                        {latest.tutorPlan ? PLAN_LABEL[latest.tutorPlan] : "—"}
                        {latest.tutorPlan === "HOURLY" && latest.tutorHours ? ` · ${latest.tutorHours} h` : ""}
                      </span>
                      {latest.tutorGoals && <span className="text-xs italic text-muted-foreground">“{latest.tutorGoals}”</span>}
                    </div>
                  )}
                </div>
              </div>

              {perSubject.length > 0 ? (
                <div>
                  <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">Invoice & breakdown</p>
                  <div className="space-y-2">
                    {perSubject.map((s) => (
                      <div key={s.subjectId} className="rounded-lg border border-border p-3 text-sm">
                        <div className="flex items-center justify-between">
                          <span className="font-medium">{s.subjectName}</span>
                          {s.batchName && <span className="text-xs text-muted-foreground">{s.batchName}</span>}
                        </div>
                        <KindRow label="Assignments" q={s.assignment} />
                        <KindRow label="Mock tests" q={s.mock} />
                        <KindRow label="Real tests" q={s.test} />
                        {s.tutoring && (
                          <div className="mt-1 flex items-center justify-between text-xs">
                            <span className="text-muted-foreground">
                              Learning from teacher · {PLAN_LABEL[s.tutoring.plan] ?? s.tutoring.plan}
                              {s.tutoring.hours != null ? ` · ${s.tutoring.hours} h` : ""}
                              {s.tutoring.rate > 0 ? ` · ${inr(s.tutoring.rate)}` : ""}
                            </span>
                            <span className="tabular-nums font-medium">{inr(s.tutoring.total)}</span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="space-y-1 rounded-lg border border-border p-3 text-sm">
                  <div className="flex justify-between"><span className="text-muted-foreground">Assignments</span><span>{inr(latest.breakdown?.totals?.assignment)}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Mock tests</span><span>{inr(latest.breakdown?.totals?.mock)}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Real tests</span><span>{inr(latest.breakdown?.totals?.test)}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Learning from teacher</span><span>{inr(latest.breakdown?.totals?.tutoring)}</span></div>
                </div>
              )}

              {warnings.length > 0 && (
                <div className="rounded-lg border border-amber-400/40 bg-amber-500/10 p-3">
                  <p className="mb-1 flex items-center gap-1.5 text-xs font-medium text-amber-600">
                    <AlertTriangle className="h-3.5 w-3.5" /> Quotation warnings
                  </p>
                  <ul className="list-inside list-disc space-y-0.5 text-xs text-muted-foreground">
                    {warnings.map((w) => (
                      <li key={w}>{w}</li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="mt-2 flex items-center justify-between rounded-lg border border-border px-3 py-2.5">
                <span className="text-sm font-medium">Billable total</span>
                <span className="text-lg font-semibold text-primary">{inr(latest.amount ?? latest.breakdown?.totals?.grand)}</span>
              </div>
            </div>

            {latest.status !== "ACTIVATED" && (
              <Button onClick={allowAndGenerate} disabled={busy} className="w-full">
                {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <KeyRound className="mr-2 h-4 w-4" />}
                Allow student for requested services & final billed — generate access code
              </Button>
            )}

            {generated && (
              <div className="rounded-lg border border-emerald-400/40 bg-emerald-500/10 p-3">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Payment success access code</p>
                    <p className="font-mono text-2xl font-bold tracking-[0.2em] text-emerald-600">{generated}</p>
                    {generatedExpiry && (
                      <p className="text-xs text-muted-foreground">Valid until {new Date(generatedExpiry).toLocaleString("en-IN")}</p>
                    )}
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => copy(generated)}>
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </>
        )}

        {(codes.length > 0 || activations.length > 0) && <Separator />}

        {activations.length > 0 && (
          <div>
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Activation history</p>
            <div className="space-y-1.5">
              {activations.map((a) => (
                <div key={a.id} className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-sm">
                  <span className="flex items-center gap-1.5 text-emerald-600">
                    <CheckCircle2 className="h-4 w-4" /> Activated {new Date(a.activatedAt).toLocaleDateString("en-IN")}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    until {new Date(a.expiresAt).toLocaleDateString("en-IN")}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {codes.length > 0 && (
          <div>
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Issued access codes</p>
            <div className="space-y-1.5">
              {codes.map((c) => (
                <div key={c.id} className="flex items-center justify-between gap-2 rounded-lg border border-border px-3 py-2 text-sm">
                  <span className="font-mono tracking-wider">{c.code}</span>
                  <span
                    className={cn(
                      "flex items-center gap-1 text-xs",
                      c.status === "USED" ? "text-emerald-600" : c.status === "EXPIRED" ? "text-destructive" : "text-muted-foreground"
                    )}
                  >
                    {c.status === "USED" ? <CheckCircle2 className="h-3.5 w-3.5" /> : c.status === "EXPIRED" ? <XCircle className="h-3.5 w-3.5" /> : <KeyRound className="h-3.5 w-3.5" />}
                    {c.status === "USED" ? "used" : c.status === "EXPIRED" ? "expired" : c.usedAt ? `used ${new Date(c.usedAt).toLocaleDateString("en-IN")}` : "issued"}
                  </span>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => copy(c.code)}>
                    <Copy className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function KindRow({ label, q }: { label: string; q?: KindQ | null }) {
  if (!q) return null;
  return (
    <div className="mt-1">
      {q.items.length > 0 ? (
        <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
          <span className="text-muted-foreground">{label}:</span>
          {q.items.map((i) => (
            <span key={i.name} className="rounded bg-secondary px-1.5 py-0.5">{i.name} · {inr(i.rate)}</span>
          ))}
          <span className="tabular-nums font-medium">= {inr(q.total)}</span>
        </div>
      ) : (
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>{label}</span>
          <span>{q.configured ? inr(q.total) : "—"}</span>
        </div>
      )}
      {q.residual.length > 0 && (
        <p className="mt-0.5 text-xs text-amber-500">
          no admin rate: {q.residual.map((t) => `“${t}”`).join(", ")}
        </p>
      )}
    </div>
  );
}