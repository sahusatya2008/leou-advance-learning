import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiRole } from "@/lib/panels";
import { getRequestMeta } from "@/lib/requestMeta";
import { logActivity } from "@/lib/log";
import { createQuestion, type QuestionInput } from "@/services/questionService";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const auth = await requireApiRole("ADMIN");
  if (auth.error) return auth.error;
  const url = new URL(req.url);
  const type = url.searchParams.get("type") ?? undefined;
  const classRoomId = url.searchParams.get("classRoomId") ?? undefined;
  const subjectId = url.searchParams.get("subjectId") ?? undefined;
  const topic = url.searchParams.get("topic") ?? undefined;
  const q = url.searchParams.get("q") ?? undefined;
  const light = url.searchParams.get("light") === "1";
  // "1" = only practical-tagged, "0" = only non-practical, absent = both.
  const practical = url.searchParams.get("practical");

  const questions = await prisma.question.findMany({
    where: {
      ...(type ? { type: type as never } : {}),
      ...(classRoomId ? { classRoomId } : {}),
      ...(subjectId ? { subjectId } : {}),
      ...(topic ? { topic } : {}),
      ...(practical === "1" ? { isPractical: true } : practical === "0" ? { isPractical: false } : {}),
      ...(q ? { stem: { contains: q, mode: "insensitive" as const } } : {}),
    },
    include: light
      ? {
          classRoom: { select: { id: true, name: true } },
          subject: { select: { id: true, name: true } },
        }
      : {
          classRoom: { select: { id: true, name: true } },
          subject: { select: { id: true, name: true } },
          _count: { select: { options: true, testCases: true, inAssessments: true } },
        },
    orderBy: light ? [{ topic: "asc" as const }, { createdAt: "desc" as const }] : ({ createdAt: "desc" } as const),
    take: light ? 500 : 200,
  });
  return NextResponse.json({ questions });
}

export async function POST(req: Request) {
  const auth = await requireApiRole("ADMIN");
  if (auth.error) return auth.error;
  const admin = auth.current;
  const meta = getRequestMeta(req);

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const input: QuestionInput = {
    type: String(body.type ?? "") as QuestionInput["type"],
    classRoomId: String(body.classRoomId ?? ""),
    subjectId: String(body.subjectId ?? ""),
    difficulty: (body.difficulty as QuestionInput["difficulty"]) ?? "MEDIUM",
    topic: body.topic ? String(body.topic) : null,
    isPractical: body.isPractical === true || body.isPractical === "true",
    tags: Array.isArray(body.tags) ? (body.tags.map(String) as string[]) : null,
    stem: String(body.stem ?? ""),
    explanation: body.explanation ? String(body.explanation) : null,
    imageUrl: body.imageUrl ? String(body.imageUrl) : null,
    options: Array.isArray(body.options) ? (body.options as QuestionInput["options"]) : undefined,
    allowedLanguages: Array.isArray(body.allowedLanguages) ? body.allowedLanguages.map(String) : undefined,
    starterCode: body.starterCode && typeof body.starterCode === "object" ? (body.starterCode as Record<string, string>) : null,
    solutionCode: body.solutionCode ? String(body.solutionCode) : null,
    testCases: Array.isArray(body.testCases) ? (body.testCases as QuestionInput["testCases"]) : undefined,
    sqlDialect: (body.sqlDialect as QuestionInput["sqlDialect"]) ?? null,
    sqlSchemaSql: body.sqlSchemaSql ? String(body.sqlSchemaSql) : null,
    sqlSeedSql: body.sqlSeedSql ? String(body.sqlSeedSql) : null,
    sqlExpectedResult: body.sqlExpectedResult ?? null,
    sqlComparisonMode: body.sqlComparisonMode ? String(body.sqlComparisonMode) : null,
  };

  const result = await createQuestion(input);
  if (!result.ok) return NextResponse.json({ error: result.errors.join(" · ") }, { status: 400 });

  await logActivity({
    userId: admin.user.id,
    type: "ADMIN_CREATE_QUESTION",
    targetId: result.question.id,
    metadata: { type: result.question.type },
    ...meta,
  }).catch(() => null);

  return NextResponse.json({ question: result.question }, { status: 201 });
}