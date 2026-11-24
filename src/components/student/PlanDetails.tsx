import Link from "next/link";
import type { StudentPlanSummary } from "@/services/studentPlanService";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  AlertTriangle,
  BookOpen,
  CalendarClock,
  CheckCircle2,
  ClipboardList,
  Clock,
  FileQuestion,
  FlaskConical,
  GraduationCap,
  History,
  Layers,
  ShieldCheck,
  Sparkles,
  Wallet,
} from "lucide-react";

const PLAN_LABEL: Record<string, string> = {
  HOURLY: "Hourly tutoring",
  WEEKLY: "Weekly classes",
  MONTHLY: "Monthly plan",
};

function requestBadge(status: string) {
  switch (status) {
    case "ACTIVATED":
      return <Badge className="bg-emerald-500/20 text-emerald-300">Activated</Badge>;
    case "BILLED":
      return <Badge className="bg-sky-500/20 text-sky-300">Payment code issued</Badge>;
    case "REQUESTED":
      return <Badge className="bg-amber-500/20 text-amber-300">Awaiting admin</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

/**
 * The full plan, facilities, quotation, payments and history.
 *
 * Shared by the student panel (with self-service actions that link into the
 * onboarding flow) and the parent panel (read-only — a parent never edits a
 * plan, so every action link is suppressed with `mode="parent"`).
 */
export function PlanDetails({
  plan,
  mode = "student",
  paymentsHref = "/dashboard/payments",
}: {
  plan: StudentPlanSummary;
  mode?: "student" | "parent";
  paymentsHref?: string;
}) {
  const isStudent = mode === "student";
  const { account, request, activation, payments } = plan;
  const facilities = request
    ? [
        request.facilities.assignments
          ? { icon: ClipboardList, label: "Assignments", topics: request.topics.assignments }
          : null,
        request.facilities.mockTests
          ? { icon: FlaskConical, label: "Mock tests", topics: request.topics.mockTests }
          : null,
        request.facilities.realTests
          ? { icon: FileQuestion, label: "Real tests", topics: request.topics.realTests }
          : null,
      ].filter((f): f is { icon: typeof ClipboardList; label: string; topics: string[] } => f !== null)
    : [];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{isStudent ? "My plan & facilities" : "Plan & facilities"}</h1>
          <p className="text-sm text-muted-foreground">
            {isStudent
              ? "Everything your plan includes — services, subjects, charges and payment status."
              : "What this plan includes — services, subjects, charges and payment status."}
          </p>
        </div>
        {isStudent && (
          <Button asChild variant="outline" size="sm">
            <Link href="/onboarding">
              <Sparkles className="h-4 w-4" /> {request ? "Change my plan" : "Choose my plan"}
            </Link>
          </Button>
        )}
      </div>

      {/* plan status */}
      <Card className="glass">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <ShieldCheck className="h-4 w-4 text-accent" /> Plan status
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            {plan.active && activation ? (
              <Badge className="bg-emerald-500/20 text-emerald-300">
                <CheckCircle2 className="mr-1 h-3.5 w-3.5" /> Active
              </Badge>
            ) : account.onboardingRequired ? (
              <Badge className="bg-amber-500/20 text-amber-300">
                <AlertTriangle className="mr-1 h-3.5 w-3.5" /> Not active
              </Badge>
            ) : (
              <Badge variant="secondary">Unrestricted access</Badge>
            )}
            {request && requestBadge(request.status)}
          </div>
          {plan.active && activation ? (
            <div className="grid gap-3 sm:grid-cols-3">
              <Fact label="Activated on" value={new Date(activation.activatedAt).toLocaleDateString()} />
              <Fact label="Valid till" value={new Date(activation.expiresAt).toLocaleDateString()} />
              <Fact
                label="Days remaining"
                value={`${activation.daysLeft} day${activation.daysLeft === 1 ? "" : "s"}`}
              />
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              {account.onboardingRequired
                ? "Services are not active. A payment code must be redeemed or the admin must activate the plan."
                : "This account has full access to all classes and tests."}
            </p>
          )}
          {isStudent && plan.active && (
            <div className="mt-4 flex flex-wrap gap-2">
              <Button asChild variant="outline" size="sm">
                <Link href="/onboarding/renewal">Renew next month</Link>
              </Button>
              <Button asChild variant="outline" size="sm">
                <Link href="/onboarding/additional">Add more services</Link>
              </Button>
            </div>
          )}
          {plan.latestCode && (
            <p className="flex items-center gap-2 text-xs text-muted-foreground">
              <Clock className="h-3.5 w-3.5" />
              Latest payment code: {plan.latestCode.status.toLowerCase().replace("_", " ")}
              {plan.latestCode.status === "ISSUED" &&
                ` · expires ${new Date(plan.latestCode.expiresAt).toLocaleDateString()}`}
              {plan.latestCode.usedAt && ` · used ${new Date(plan.latestCode.usedAt).toLocaleDateString()}`}
            </p>
          )}
        </CardContent>
      </Card>

      {/* per-subscription cards */}
      {plan.subscriptions.length > 0 && (
        <Card className="glass">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Layers className="h-4 w-4 text-accent" /> Subscriptions
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              {plan.subscriptions.length === 1
                ? "One live subscription, valid for 30 days from activation."
                : "Each subscription runs its own 30 days from its own approval."}
            </p>
          </CardHeader>
          <CardContent className="space-y-3">
            {plan.subscriptions.map((sub) => (
              <div key={sub.activationId} className="rounded-xl border border-border bg-card/60 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap gap-1.5">
                    {sub.serviceLabels.map((label) => (
                      <Badge key={label} variant="secondary" className="text-xs">
                        {label}
                      </Badge>
                    ))}
                    {sub.serviceLabels.length === 0 && (
                      <Badge variant="outline" className="text-xs">No services</Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span>Valid till <span className="font-medium text-foreground">{new Date(sub.expiresAt).toLocaleDateString()}</span></span>
                    <span>{sub.daysLeft} day{sub.daysLeft === 1 ? "" : "s"} left</span>
                  </div>
                </div>

                {sub.subjects.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {sub.subjects.map((s) => (
                      <Badge key={s} className="text-xs">{s}</Badge>
                    ))}
                  </div>
                )}

                {sub.perSubjectTopics.length > 0 && (
                  <div className="mt-3 space-y-2">
                    {sub.perSubjectTopics.map((s) => (
                      <div key={s.subjectId} className="rounded-md bg-secondary/40 px-3 py-2 text-xs">
                        <span className="font-medium">{s.subjectName}</span>
                        {s.assignments.length > 0 && (
                          <span className="ml-2 text-muted-foreground">
                            Assignments: {s.assignments.join(", ")}
                          </span>
                        )}
                        {s.mockTests.length > 0 && (
                          <span className="ml-2 text-muted-foreground">
                            Mock: {s.mockTests.join(", ")}
                          </span>
                        )}
                        {s.realTests.length > 0 && (
                          <span className="ml-2 text-muted-foreground">
                            Real: {s.realTests.join(", ")}
                          </span>
                        )}
                        {s.assignments.length === 0 && s.mockTests.length === 0 && s.realTests.length === 0 && (
                          <span className="ml-2 text-muted-foreground">All chapters / topics</span>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {sub.tutoringSubjects.length > 0 && (
                  <p className="mt-2 text-xs text-muted-foreground">
                    Tutoring · {sub.tutoringSubjects.join(", ")}
                    {sub.tutoringPlan ? ` · ${PLAN_LABEL[sub.tutoringPlan] ?? sub.tutoringPlan}` : ""}
                  </p>
                )}

                {isStudent && (
                  <div className="mt-3 border-t border-border pt-2">
                    <Button asChild variant="outline" size="sm">
                      <Link href={`/onboarding/renewal?activationId=${sub.activationId}`}>
                        Renew this subscription
                      </Link>
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        {/* facilities */}
        <Card className="glass">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Sparkles className="h-4 w-4 text-accent" /> Facilities in the plan
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {!request ? (
              <p className="text-sm text-muted-foreground">
                No services requested yet. Choosing a plan unlocks assignments, mock tests, real
                tests and tutoring.
              </p>
            ) : (
              <>
                {facilities.map((f) => (
                  <div key={f.label} className="rounded-xl border border-border bg-card/60 p-4">
                    <p className="flex items-center gap-2 text-sm font-medium">
                      <f.icon className="h-4 w-4 text-indigo-300" /> {f.label}
                    </p>
                    {f.topics.length > 0 ? (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {f.topics.map((t) => (
                          <Badge key={t} variant="secondary" className="text-xs">
                            {t}
                          </Badge>
                        ))}
                      </div>
                    ) : (
                      <p className="mt-1 text-xs text-muted-foreground">All chapters / topics</p>
                    )}
                  </div>
                ))}
                {request.facilities.tutoring && (
                  <div className="rounded-xl border border-border bg-card/60 p-4">
                    <p className="flex items-center gap-2 text-sm font-medium">
                      <GraduationCap className="h-4 w-4 text-emerald-300" /> Tutoring
                    </p>
                    {request.tutoring && (
                      <div className="mt-2 space-y-1 text-xs text-muted-foreground">
                        {request.tutoring.plan && (
                          <p>
                            Plan:{" "}
                            <span className="text-foreground">
                              {PLAN_LABEL[request.tutoring.plan] ?? request.tutoring.plan}
                            </span>
                            {request.tutoring.hours ? ` · ${request.tutoring.hours} hrs` : ""}
                          </p>
                        )}
                        {request.tutoring.subjects.length > 0 && (
                          <p>
                            Subjects:{" "}
                            <span className="text-foreground">{request.tutoring.subjects.join(", ")}</span>
                          </p>
                        )}
                        {request.tutoring.goals && <p>Goals: {request.tutoring.goals}</p>}
                      </div>
                    )}
                  </div>
                )}
                {facilities.length === 0 && !request.facilities.tutoring && (
                  <p className="text-sm text-muted-foreground">No facilities selected on this request.</p>
                )}
              </>
            )}
          </CardContent>
        </Card>

        {/* subjects + charges */}
        <div className="space-y-6">
          <Card className="glass">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <BookOpen className="h-4 w-4 text-accent" /> Subjects
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <Row label="Class" value={account.classRoom} />
              <Row label="Stream" value={account.stream ?? "—"} />
              <Row label="School" value={account.schoolName} />
              {request?.board && <Row label="Board" value={request.board} />}
              {account.schoolStatus === "PAST" && account.schoolClassHistory && (
                <Row label="Class studied earlier" value={account.schoolClassHistory} />
              )}
              <Separator />
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Subjects
              </p>
              {request && request.subjects.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {request.subjects.map((s) => (
                    <Badge key={s} variant="secondary" className="text-xs">
                      {s}
                    </Badge>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground">No subjects selected on this plan.</p>
              )}
            </CardContent>
          </Card>

          <Card className="glass">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Wallet className="h-4 w-4 text-accent" /> Charges & payments
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {request?.breakdown ? (
                <div className="space-y-1.5 text-sm">
                  {request.breakdown.perSubject.map((s) => (
                    <div key={s.subjectId} className="rounded-lg border border-border bg-card/60 p-3">
                      <p className="font-medium">{s.subjectName}</p>
                      <div className="mt-1 space-y-0.5 text-xs text-muted-foreground">
                        {s.assignment.items.map((i) => (
                          <Row key={`a-${i.name}`} label={`Assignment · ${i.name}`} value={`₹${i.rate}`} />
                        ))}
                        {s.mock.items.map((i) => (
                          <Row key={`m-${i.name}`} label={`Mock · ${i.name}`} value={`₹${i.rate}`} />
                        ))}
                        {s.test.items.map((i) => (
                          <Row key={`t-${i.name}`} label={`Real test · ${i.name}`} value={`₹${i.rate}`} />
                        ))}
                        {s.tutoring && (
                          <Row
                            label="Tutoring"
                            value={`₹${s.tutoring.total}${
                              s.tutoring.hours ? ` · ${s.tutoring.hours} hrs` : ""
                            }`}
                          />
                        )}
                      </div>
                    </div>
                  ))}
                  <Separator />
                  <Row label="Assignments" value={`₹${request.breakdown.totals.assignment}`} />
                  <Row label="Mock tests" value={`₹${request.breakdown.totals.mock}`} />
                  <Row label="Real tests" value={`₹${request.breakdown.totals.test}`} />
                  <Row label="Tutoring" value={`₹${request.breakdown.totals.tutoring}`} />
                  <div className="flex items-center justify-between pt-1 text-base font-bold">
                    <span>Plan total</span>
                    <span>₹{request.breakdown.totals.grand.toFixed(2)}</span>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No itemised quotation for this plan yet.</p>
              )}

              <Separator />
              <div className="grid grid-cols-1 gap-3 text-center min-[380px]:grid-cols-3">
                <div>
                  <p className="text-lg font-bold">₹{payments.total.toFixed(0)}</p>
                  <p className="text-xs text-muted-foreground">Total fees</p>
                </div>
                <div>
                  <p className="text-lg font-bold text-emerald-300">₹{payments.paid.toFixed(0)}</p>
                  <p className="text-xs text-muted-foreground">Paid</p>
                </div>
                <div>
                  <p className="text-lg font-bold text-amber-300">₹{payments.pending.toFixed(0)}</p>
                  <p className="text-xs text-muted-foreground">Due</p>
                </div>
              </div>
              <Button asChild variant="outline" size="sm" className="w-full">
                <Link href={paymentsHref}>{isStudent ? "See all fee records" : "See fee records"}</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* history */}
      {plan.history.length > 1 && (
        <Card className="glass">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <History className="h-4 w-4 text-accent" /> Plan history
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {plan.history.map((h) => (
              <div
                key={h.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-card/60 px-4 py-2.5 text-sm"
              >
                <span className="text-muted-foreground">{new Date(h.createdAt).toLocaleDateString()}</span>
                {requestBadge(h.status)}
                <span className="font-medium">{h.amount != null ? `₹${h.amount.toFixed(2)}` : "—"}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* activation history */}
      {plan.activations.length > 0 && (
        <Card className="glass">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <CalendarClock className="h-4 w-4 text-accent" /> Activation history
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {plan.activations.map((a, i) => (
              <div
                key={`${a.activatedAt}-${i}`}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-card/60 px-4 py-2.5 text-sm"
              >
                <span>
                  {new Date(a.activatedAt).toLocaleDateString()} →{" "}
                  {new Date(a.expiresAt).toLocaleDateString()}
                </span>
                <Badge variant={a.current ? "default" : "outline"}>{a.current ? "current" : "ended"}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-card/60 p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-semibold">{value}</p>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium">{value}</span>
    </div>
  );
}
