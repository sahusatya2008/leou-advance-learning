import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/panels";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { ArrowRight, Inbox, Wallet } from "lucide-react";
import { PaymentQueueTabs, type TabKey } from "@/components/admin/payments/PaymentQueueTabs";
import { paymentSetupProblems } from "@/lib/paymentSetup";

export const dynamic = "force-dynamic";

/**
 * A renewal or top-up is a real request the moment the student submits it - the
 * money may already be in the academy's account before any proof is uploaded.
 * Those requests are shown alongside the proofs so nothing waits on the student
 * remembering to attach a screenshot, and the admin can record the statement
 * entry from the request's own page.
 */
const REQUEST_TAB: Record<string, TabKey> = {
  RENEWAL: "RENEWAL",
  ADDITIONAL: "ADDITIONAL_SERVICE",
};

const KIND_LABEL: Record<string, string> = {
  RENEWAL: "Renewal",
  ADDITIONAL: "Additional services",
  INITIAL: "New registration",
};

const TABS: { key: TabKey; label: string; blurb: string }[] = [
  {
    key: "REGISTRATION",
    label: "Newly registering",
    blurb: "First payment from a student starting their services.",
  },
  {
    key: "RENEWAL",
    label: "Renewal",
    blurb: "A returning student paying for the next month.",
  },
  {
    key: "ADDITIONAL_SERVICE",
    label: "Additional services",
    blurb: "A student already active who asked for more subjects or chapters.",
  },
];

export default async function AdminPaymentsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  await requireRole("ADMIN");
  const { tab } = await searchParams;
  const active = (TABS.find((t) => t.key === tab)?.key ?? "REGISTRATION") as TabKey;

  // Counts cover every open item, not just the tab being viewed, so the admin
  // can see where the work is sitting before clicking into it. A submitted
  // service request with no payment against it counts too: that is exactly the
  // renewal the admin has to look for in the statement.
  const [open, pendingRequests, ...counts] = await Promise.all([
    prisma.paymentRequest.findMany({
      where: { status: "SUBMITTED" },
      orderBy: { submittedAt: "asc" },
      include: {
        user: {
          select: {
            username: true,
            studentProfile: { select: { fullName: true, classRoom: { select: { name: true } } } },
          },
        },
        attachments: { select: { url: true } },
      },
      take: 200,
    }),
    prisma.onboardingRequest.findMany({
      where: {
        kind: { in: ["RENEWAL", "ADDITIONAL"] },
        // REQUESTED is an untouched request; BILLED means a service code was
        // issued by hand but the money was never recorded against the request -
        // the renewal in the original report sat in exactly that state, invisible
        // to this page. Both are still "money owed", ACTIVATED is finished.
        status: { in: ["REQUESTED", "BILLED"] },
        amount: { gt: 0 },
        paymentRequests: { none: { status: { in: ["SUBMITTED", "APPROVED"] } } },
      },
      orderBy: { createdAt: "asc" },
      include: {
        user: {
          select: {
            username: true,
            studentProfile: { select: { fullName: true, classRoom: { select: { name: true } } } },
          },
        },
      },
      take: 200,
    }),
    ...TABS.map((t) =>
      prisma.paymentRequest.count({ where: { status: "SUBMITTED", purpose: t.key as never } })
    ),
  ]);

  const queue = open.filter((p) => p.purpose === active);
  const tabRequests = pendingRequests.filter((r) => REQUEST_TAB[r.kind] === active);
  const requestCounts = TABS.map(
    (t) => pendingRequests.filter((r) => REQUEST_TAB[r.kind] === t.key).length
  );
  const totalFor = (i: number) => counts[i] + requestCounts[i];
  const isEmpty = queue.length === 0 && tabRequests.length === 0;
  const decided = await prisma.paymentRequest.findMany({
    where: { status: { in: ["APPROVED", "REJECTED"] } },
    orderBy: { decidedAt: "desc" },
    include: {
      user: { select: { username: true, studentProfile: { select: { fullName: true } } } },
    },
    take: 20,
  });

  const meta = TABS.find((t) => t.key === active)!;

  const setupProblems = paymentSetupProblems();

  return (
    <div className="space-y-6">
      {setupProblems.length > 0 && (
        <div className="rounded-lg border border-red-400/50 bg-red-500/10 px-4 py-3 text-sm text-red-700">
          <p className="font-semibold">Payments are not ready to accept money</p>
          <ul className="mt-1 list-disc space-y-1 pl-5">
            {setupProblems.map((msg) => (
              <li key={msg}>{msg}</li>
            ))}
          </ul>
        </div>
      )}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Payments</h1>
        <p className="text-sm text-muted-foreground">
          Match each payment against your UPI statement using the LEOU payment id, then approve or
          reject. Approving switches the student&apos;s services on immediately.
        </p>
      </div>

      <PaymentQueueTabs
        active={active}
        tabs={TABS.map((t, i) => ({ key: t.key, label: t.label, count: totalFor(i) }))}
      />

      <div>
        <p className="text-sm text-muted-foreground">{meta.blurb}</p>
      </div>

      {isEmpty && (
        <Card className="glass">
          <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
            <div className="grid h-12 w-12 place-items-center rounded-xl bg-gradient-to-br from-indigo-500/25 to-cyan-500/25 text-indigo-300">
              <Inbox className="h-6 w-6" />
            </div>
            <p className="max-w-sm text-sm text-muted-foreground">
              Nothing waiting under this heading.
            </p>
          </CardContent>
        </Card>
      )}

      {tabRequests.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-medium">Requests awaiting payment</h2>
            <Badge className="bg-amber-500/20 text-amber-300">{tabRequests.length}</Badge>
          </div>
          <p className="text-xs text-muted-foreground">
            Submitted by the student but not paid against yet. If the money is already in your
            statement, open the request and record its transaction id.
          </p>
          {tabRequests.map((r) => (
            <Card key={r.id} className="glass border-amber-400/40">
              <CardContent className="flex flex-wrap items-center justify-between gap-4 p-5">
                <div className="min-w-0">
                  <p className="font-medium">
                    {r.user.studentProfile?.fullName ?? r.user.username}
                    <span className="ml-2 text-sm font-normal text-muted-foreground">
                      {r.user.studentProfile?.classRoom?.name ?? "—"}
                    </span>
                    <span className="ml-2 text-sm font-normal text-muted-foreground">
                      · {KIND_LABEL[r.kind] ?? r.kind}
                    </span>
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    <code className="rounded bg-muted px-1.5 py-0.5">{r.leouPayRef ?? "no reference yet"}</code>
                    {" · "}
                    <span className="font-medium text-foreground">
                      ₹{Number(r.amount ?? 0).toFixed(2)}
                    </span>
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {r.status === "BILLED"
                      ? "A service code was issued by hand, but no payment is recorded against this request"
                      : r.lockedAt
                        ? "Locked for payment"
                        : "Student can still edit this selection"}{" "}
                    · submitted {formatAge(r.createdAt)}
                  </p>
                </div>
                <Button asChild size="sm" variant="outline">
                  <Link href={`/admin/payments/requests/${r.id}`}>
                    Record payment <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {queue.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-medium">Payments waiting for verification</h2>
            <Badge className="bg-sky-500/20 text-sky-300">{queue.length}</Badge>
          </div>
          {queue.map((p) => (
            <Card key={p.id} className="glass">
              <CardContent className="flex flex-wrap items-center justify-between gap-4 p-5">
                <div className="min-w-0">
                  <p className="font-medium">
                    {p.user.studentProfile?.fullName ?? p.user.username}
                    <span className="ml-2 text-sm font-normal text-muted-foreground">
                      {p.user.studentProfile?.classRoom?.name ?? "—"}
                    </span>
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    <code className="rounded bg-muted px-1.5 py-0.5">{p.leouPayRef}</code>
                    {p.transactionId ? (
                      <>
                        {" · txn "}
                        <code className="rounded bg-muted px-1.5 py-0.5">{p.transactionId}</code>
                      </>
                    ) : null}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {p.method === "TRANSACTION_ID"
                      ? "Entered by hand"
                      : p.method === "SCREENSHOT"
                        ? "Screenshot attached"
                        : "Camera scan"}{" "}
                    · waiting {formatAge(p.submittedAt)}
                    {p.amountExpected ? ` · expected ₹${Number(p.amountExpected).toFixed(2)}` : ""}
                  </p>
                </div>
                <Button asChild size="sm">
                  <Link href={`/admin/payments/${p.id}`}>
                    Verify <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {decided.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-medium text-muted-foreground">Recently decided</h2>
          {decided.map((p) => (
            <Card key={p.id}>
              <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
                <div>
                  <p className="text-sm font-medium">
                    {p.user.studentProfile?.fullName ?? p.user.username}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    <code className="rounded bg-muted px-1.5 py-0.5">{p.leouPayRef}</code>
                    {p.decidedAt ? ` · ${formatAge(p.decidedAt)}` : ""}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <Badge
                    className={
                      p.status === "APPROVED"
                        ? "bg-emerald-500/20 text-emerald-300"
                        : "bg-red-500/20 text-red-300"
                    }
                  >
                    {p.status}
                  </Badge>
                  <Button asChild variant="ghost" size="sm">
                    <Link href={`/admin/payments/${p.id}`}>
                      <Wallet className="h-4 w-4" /> Open
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function formatAge(d: Date): string {
  const mins = Math.round((Date.now() - d.getTime()) / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  return `${Math.round(hrs / 24)}d`;
}
