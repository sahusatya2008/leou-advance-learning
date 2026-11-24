import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiRole } from "@/lib/panels";
import { logActivity } from "@/lib/log";
import { getRequestMeta } from "@/lib/requestMeta";
import { revealPassword } from "@/lib/passwords";

export const runtime = "nodejs";

/**
 * Reveal the stored password copy for a student or parent account.
 *
 * Fetched on demand rather than baked into the page payload, so a list of
 * hundreds of accounts never ships hundreds of plaintext passwords to the
 * browser — only the one an administrator explicitly asks for.
 */
export async function GET(req: Request) {
  const auth = await requireApiRole("ADMIN");
  if (auth.error) return auth.error;
  const meta = getRequestMeta(req);

  const userId = new URL(req.url).searchParams.get("userId") ?? "";
  if (!userId) return NextResponse.json({ error: "userId is required." }, { status: 400 });

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, role: true, passwordEnc: true },
  });
  if (!user || (user.role !== "STUDENT" && user.role !== "PARENT")) {
    return NextResponse.json({ error: "Account not found." }, { status: 404 });
  }

  await logActivity({
    userId: auth.current.user.id,
    type: "ADMIN_MANAGE_PARENT",
    targetId: user.id,
    metadata: { action: "reveal_password", targetRole: user.role },
    ...meta,
  }).catch(() => null);

  return NextResponse.json(
    { password: revealPassword(user.passwordEnc) },
    { headers: { "cache-control": "no-store" } },
  );
}
