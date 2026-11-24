import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiRole } from "@/lib/panels";
import { getRequestMeta } from "@/lib/requestMeta";
import { logActivity } from "@/lib/log";
import { updateQuestion, type QuestionInput } from "@/services/questionService";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, ctx: Ctx) {
  const auth = await requireApiRole("ADMIN");
  if (auth.error) return auth.error;
  const admin = auth.current;
  const meta = getRequestMeta(req);
  const { id } = await ctx.params;

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

  const existing = await prisma.question.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Question not found." }, { status: 404 });

  const result = await updateQuestion(id, input);
  if (!result.ok) return NextResponse.json({ error: result.errors.join(" · ") }, { status: 400 });

  await logActivity({
    userId: admin.user.id,
    type: "ADMIN_UPDATE_QUESTION",
    targetId: id,
    metadata: { type: result.question.type },
    ...meta,
  }).catch(() => null);

  return NextResponse.json({ question: result.question });
}

export async function DELETE(req: Request, ctx: Ctx) {
  const auth = await requireApiRole("ADMIN");
  if (auth.error) return auth.error;
  const admin = auth.current;
  const meta = getRequestMeta(req);
  const { id } = await ctx.params;

  const question = await prisma.question.findUnique({
    where: { id },
    include: { _count: { select: { inAssessments: true } } },
  });
  if (!question) return NextResponse.json({ error: "Question not found." }, { status: 404 });
  if (question._count.inAssessments > 0) {
    return NextResponse.json(
      { error: "Cannot delete: this question is used in one or more assessments." },
      { status: 409 }
    );
  }

  await prisma.question.delete({ where: { id } });
  await logActivity({
    userId: admin.user.id,
    type: "ADMIN_DELETE_QUESTION",
    targetId: id,
    metadata: { type: question.type },
    ...meta,
  }).catch(() => null);

  return NextResponse.json({ ok: true });
}