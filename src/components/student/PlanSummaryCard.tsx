import Link from "next/link";
import { getStudentPlanSummary } from "@/services/studentPlanService";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  CalendarClock,
  ClipboardList,
  FileQuestion,
  FlaskConical,
  GraduationCap,
  Sparkles,
  ChevronRight,
  Info,
} from "lucide-react";

function statusLabel(status: string) {
  switch (status) {
    case "REQUESTED":
      return { label: "Awaiting admin approval", variant: "secondary" as const };
    case "BILLED":
      return { label: "Payment code issued", variant: "secondary" as const };
    case "ACTIVATED":
      return { label: "Activated", variant: "default" as const };
    default:
      return { label: status, variant: "outline" as const };
  }
}

export async function PlanSummaryCard({ userId }: { userId: string }) {
  const plan = await getStudentPlanSummary(userId);

  if (!plan) return null;
  const { request, activation, payments } = plan;

  const facilityChips = request
    ? [
        request.facilities.assignments ? { icon: ClipboardList, label: "Assignments" } : null,
        request.facilities.mockTests ? { icon: FlaskConical, label: "Mock tests" } : null,
        request.facilities.realTests ? { icon: FileQuestion, label: "Real tests" } : null,
        request.facilities.tutoring ? { icon: GraduationCap, label: "Tutoring" } : null,
      ].filter((c): c is { icon: typeof ClipboardList; label: string } => c !== null)
    : [];

  return (
    <Card className="glass">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Sparkles className="h-4 w-4 text-accent" /> My plan & facilities
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {plan.account.onboardingRequired && (
          <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card/60 px-4 py-3">
            <div className="flex items-center gap-2 text-sm">
              <CalendarClock
                className={`h-4 w-4 ${plan.active ? "text-emerald-400" : "text-amber-300"}`}
              />
              {plan.active && activation ? (
                <span>
                  Active ·{" "}
                  <span className="font-medium">{activation.daysLeft} day{activation.daysLeft === 1 ? "" : "s"}</span>{" "}
                  left (till {new Date(activation.expiresAt).toLocaleDateString()})
                </span>
              ) : (
                <span>No active plan</span>
              )}
            </div>
            {request && <Badge variant={statusLabel(request.status).variant}>{statusLabel(request.status).label}</Badge>}
          </div>
        )}

        <div>
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Facilities given to you
          </p>
          {facilityChips.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {request ? "No facilities selected yet." : "You have not requested any services yet."}
            </p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {facilityChips.map((c) => (
                <Badge key={c.label} variant="secondary" className="gap-1">
                  <c.icon className="h-3 w-3" /> {c.label}
                </Badge>
              ))}
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl border border-border bg-card/60 p-3">
            <p className="text-xs text-muted-foreground">Plan amount</p>
            <p className="text-lg font-bold">
              {request?.amount != null ? `₹${request.amount.toFixed(2)}` : "—"}
            </p>
          </div>
          <div className="rounded-xl border border-border bg-card/60 p-3">
            <p className="text-xs text-muted-foreground">Fee records</p>
            <p className="text-lg font-bold">
              ₹{payments.paid.toFixed(0)}
              <span className="text-xs font-normal text-muted-foreground"> paid</span>
            </p>
            {payments.pending > 0 && (
              <p className="text-xs text-amber-300">₹{payments.pending.toFixed(0)} due</p>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between gap-2">
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Info className="h-3.5 w-3.5" /> Subjects, topics, quotation & history
          </p>
          <Button asChild variant="outline" size="sm">
            <Link href="/dashboard/plan">
              Full details <ChevronRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
