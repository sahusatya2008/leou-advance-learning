import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiRole } from "@/lib/panels";
import type { OnboardingStatus } from "@/generated/prisma/enums";

export const runtime = "nodejs";

const STATUSES: OnboardingStatus[] = ["REQUESTED", "BILLED", "ACTIVATED"];

// Students who made service requests. Optional ?filter=REQUESTED|BILLED|ACTIVATED
// and optional ?learning=1 to return only students who asked for tutoring.
export async function GET(req: Request) {
  const auth = await requireApiRole("ADMIN");
  if (auth.error) return auth.error;
  const url = new URL(req.url);
  const filter = url.searchParams.get("filter");
  const learning = url.searchParams.get("learning") === "1";

  const where: {
    status?: OnboardingStatus;
    userId?: { in: string[] };
  } = filter && (STATUSES as string[]).includes(filter) ? { status: filter as OnboardingStatus } : {};

  type Row = {
    id: string;
    status: OnboardingStatus;
    amount: unknown;
    wantAssignments: boolean;
    wantMockTests: boolean;
    wantRealTests: boolean;
    wantTutoring: boolean;
    tutorPlan: string | null;
    tutorHours: number | null;
    subjects: unknown;
    user: { id: string; username: string; email: string; phone: string | null; status: string; studentProfile: { fullName: string } | null };
    createdAt: Date;
  };

  const requests = await prisma.onboardingRequest.findMany({
    where,
    orderBy: { createdAt: "desc" },
    distinct: ["userId"],
    include: {
      user: {
        select: {
          id: true,
          username: true,
          email: true,
          phone: true,
          status: true,
          studentProfile: { select: { fullName: true } },
        },
      },
    },
    take: 200,
  });

  let rows = requests as unknown as Row[];
  if (learning) rows = rows.filter((r) => r.wantTutoring);

  return NextResponse.json({
    students: rows.map((r) => ({
      userId: r.user.id,
      fullName: r.user.studentProfile?.fullName ?? r.user.username,
      username: r.user.username,
      email: r.user.email,
      phone: r.user.phone,
      userStatus: r.user.status,
      requestId: r.id,
      status: r.status,
      amount: r.amount != null ? Number(r.amount) : null,
      services: {
        assignment: r.wantAssignments,
        mock: r.wantMockTests,
        test: r.wantRealTests,
        tutoring: r.wantTutoring,
      },
      tutorPlan: r.tutorPlan,
      tutorHours: r.tutorHours,
      subjectCount: Array.isArray(r.subjects) ? (r.subjects as unknown[]).length : 0,
      requestedAt: r.createdAt.toISOString(),
    })),
  });
}