import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiRole } from "@/lib/panels";
import { getActiveServices, getServiceState } from "@/services/onboardingService";

export const runtime = "nodejs";

function toPlain<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export async function GET() {
  const auth = await requireApiRole("STUDENT");
  if (auth.error) return auth.error;
  const { user } = auth.current;
  const state = await getServiceState(user.id);

  let request = null;
  if (state?.latestRequest) {
    const full = await prisma.onboardingRequest.findUnique({
      where: { id: state.latestRequest.id },
      include: {
        classRoom: { select: { id: true, name: true } },
        user: { select: { id: true, studentProfile: { select: { fullName: true } } } },
      },
    });
    if (full) {
      request = {
        id: full.id,
        status: full.status,
        boardId: full.boardId,
        classRoomId: full.classRoomId,
        subjectIds: (full.subjects as unknown as string[]) ?? [],
        wantAssignments: full.wantAssignments,
        assignmentTopics: full.assignmentTopics,
        wantMockTests: full.wantMockTests,
        mockTopics: full.mockTopics,
        wantRealTests: full.wantRealTests,
        testTopics: full.testTopics,
        sameTopicsForMockTests: full.sameTopicsForMockTests,
        subjectTopics: full.subjectTopics ?? null,
        locked: full.lockedAt != null,
        wantTutoring: full.wantTutoring,
        tutorSubjects: (full.tutorSubjects as unknown as string[]) ?? [],
        tutorGoals: full.tutorGoals,
        tutorPlan: full.tutorPlan,
        tutorHours: full.tutorHours,
        amount: full.amount != null ? Number(full.amount) : null,
        createdAt: full.createdAt.toISOString(),
        updatedAt: full.updatedAt.toISOString(),
        breakdown: toPlain(full.breakdown ?? null),
        classRoom: { id: full.classRoom.id, name: full.classRoom.name },
        studentName: full.user.studentProfile?.fullName ?? null,
      };
    }
  }

  // The union across every live request, so a student who topped up earlier is
  // shown the whole plan they hold rather than whichever request was written last.
  const services = await getActiveServices(user.id);
  return NextResponse.json({ state, request, services });
}