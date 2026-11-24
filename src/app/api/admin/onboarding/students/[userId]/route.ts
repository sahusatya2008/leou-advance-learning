import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiRole } from "@/lib/panels";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function toPlain<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export async function GET(_req: Request, ctx: { params: Promise<{ userId: string }> }) {
  const auth = await requireApiRole("ADMIN");
  if (auth.error) return auth.error;
  const { userId } = await ctx.params;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { studentProfile: { include: { classRoom: true, batches: { include: { batch: true } } } } },
  });
  if (!user || !user.studentProfile) {
    return NextResponse.json({ error: "Student not found." }, { status: 404 });
  }

  const requests = await prisma.onboardingRequest.findMany({
    where: { userId },
    orderBy: { createdAt: "asc" },
  });
  const codes = await prisma.serviceCode.findMany({ where: { userId }, orderBy: { createdAt: "desc" } });
  const activations = await prisma.serviceActivation.findMany({
    where: { userId },
    orderBy: { activatedAt: "desc" },
  });

  const subjectIds = Array.from(new Set(requests.flatMap((r) => (r.subjects as unknown as string[]) ?? [])));
  const [subjects, classRooms, boards] = await Promise.all([
    subjectIds.length ? prisma.subject.findMany({ where: { id: { in: subjectIds } }, select: { id: true, name: true } }) : [],
    prisma.classRoom.findMany({
      where: { id: { in: Array.from(new Set(requests.map((r) => r.classRoomId))) } },
      select: { id: true, name: true },
    }),
    prisma.board.findMany({ where: { id: { in: Array.from(new Set(requests.map((r) => r.boardId))) } }, select: { id: true, name: true } }),
  ]);
  const subjectName = new Map(subjects.map((s) => [s.id, s.name]));
  const className = new Map(classRooms.map((c) => [c.id, c.name]));
  const boardName = new Map(boards.map((b) => [b.id, b.name]));

  const requestDetails = requests.map((r) => ({
    ...toPlain(r),
    amount: r.amount != null ? Number(r.amount) : null,
    boardName: boardName.get(r.boardId) ?? null,
    classRoomName: className.get(r.classRoomId) ?? null,
    subjectNames: ((r.subjects as unknown as string[]) ?? []).map((id) => subjectName.get(id) ?? "Unknown"),
  }));

  return NextResponse.json(
    {
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        phone: user.phone,
        status: user.status,
        onboardingRequired: user.onboardingRequired,
        fullName: user.studentProfile.fullName,
        className: user.studentProfile.classRoom.name,
        batches: user.studentProfile.batches.map((b) => b.batch.name),
      },
      requests: requestDetails,
      codes: codes.map((c) => ({
        id: c.id,
        code: c.code,
        status: c.status,
        expiresAt: c.expiresAt.toISOString(),
        usedAt: c.usedAt?.toISOString() ?? null,
        createdAt: c.createdAt.toISOString(),
      })),
      activations: activations.map((a) => ({
        id: a.id,
        activatedAt: a.activatedAt.toISOString(),
        expiresAt: a.expiresAt.toISOString(),
      })),
    },
    { headers: { "cache-control": "no-store" } },
  );
}