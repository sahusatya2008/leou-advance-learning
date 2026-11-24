import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiRole } from "@/lib/panels";
import { requireActiveService } from "@/services/onboardingService";
import { runnerSql } from "@/services/runner";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const auth = await requireApiRole("STUDENT");
  if (auth.error) return auth.error;
  const { user } = auth.current;
  const profId = user.studentProfile?.id;

  const guard = await requireActiveService(user.id);
  if (!guard.ok) return NextResponse.json({ error: guard.reason }, { status: 403 });

  let body: { assessmentQuestionId?: string; query?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }
  if (!body.query || body.query.length > 50_000)
    return NextResponse.json({ error: "No query provided." }, { status: 400 });

  const aq = await prisma.assessmentQuestion.findUnique({
    where: { id: String(body.assessmentQuestionId ?? "") },
    include: {
      question: { select: { sqlDialect: true, sqlSchemaSql: true, sqlSeedSql: true, type: true } },
      assessment: {
        include: {
          batch: { include: { students: { select: { studentId: true } } } },
        },
      },
    },
  });
  if (!aq || aq.question.type !== "SQL" || !profId) {
    return NextResponse.json({ error: "Question not found." }, { status: 404 });
  }
  if (!aq.assessment.batch.students.some((s) => s.studentId === profId)) {
    return NextResponse.json({ error: "Not a member of this batch." }, { status: 403 });
  }

  try {
    const result = await runnerSql(
      aq.question.sqlDialect ?? "PostgreSQL",
      aq.question.sqlSchemaSql ?? "",
      aq.question.sqlSeedSql ?? "",
      body.query
    );
    return NextResponse.json(result);
  } catch (e) {
    const err = e as Error & { status?: number };
    return NextResponse.json({ error: err.message }, { status: err.status ?? 500 });
  }
}