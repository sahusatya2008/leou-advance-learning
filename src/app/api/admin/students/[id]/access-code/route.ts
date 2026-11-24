import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiRole } from "@/lib/panels";
import { getRequestMeta } from "@/lib/requestMeta";
import { issueAccessCode } from "@/services/accessCodeService";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: Request, ctx: Ctx) {
  const auth = await requireApiRole("ADMIN");
  if (auth.error) return auth.error;
  const admin = auth.current;
  const meta = getRequestMeta(req);
  const { id } = await ctx.params;

  const user = await prisma.user.findUnique({ where: { id }, select: { id: true, role: true } });
  if (!user || user.role !== "STUDENT") return NextResponse.json({ error: "Student not found." }, { status: 404 });

  const code = await issueAccessCode(user.id, admin.user.id, meta);
  return NextResponse.json(code);
}