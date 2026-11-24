import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiRole } from "@/lib/panels";
import { getRequestMeta } from "@/lib/requestMeta";
import { logActivity } from "@/lib/log";
import { isValidPassword } from "@/lib/validation";
import { passwordFields } from "@/lib/passwords";
import type { UserStatus } from "@/generated/prisma/enums";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

const parentInclude = {
  parentProfile: {
    include: {
      students: {
        select: {
          id: true,
          fullName: true,
          parentUserId: true,
          user: { select: { id: true, username: true, status: true } },
          classRoom: { select: { name: true } },
        },
      },
    },
  },
} as const;

/**
 * The user scalar fields that are safe to hand a browser. Dropping the
 * unrestricted `include` here is deliberate: it echoed `passwordHash` and
 * `passwordEnc` on every read and save. Admins reveal passwords through
 * /api/admin/secret, which is audited; the raw hash never needs to leave the
 * server.
 */
const parentUserSelect = {
  id: true,
  username: true,
  email: true,
  phone: true,
  role: true,
  status: true,
  onboardingRequired: true,
  createdAt: true,
  updatedAt: true,
  parentProfile: parentInclude.parentProfile,
} as const;

export async function GET(_req: Request, ctx: Ctx) {
  const auth = await requireApiRole("ADMIN");
  if (auth.error) return auth.error;
  const { id } = await ctx.params;

  const parent = await prisma.user.findUnique({ where: { id }, select: parentUserSelect });
  if (!parent || parent.role !== "PARENT") {
    return NextResponse.json({ error: "Parent not found." }, { status: 404 });
  }
  return NextResponse.json({ parent });
}

export async function PATCH(req: Request, ctx: Ctx) {
  const auth = await requireApiRole("ADMIN");
  if (auth.error) return auth.error;
  const admin = auth.current;
  const meta = getRequestMeta(req);
  const { id } = await ctx.params;

  const parent = await prisma.user.findUnique({ where: { id }, include: { parentProfile: true } });
  if (!parent || parent.role !== "PARENT" || !parent.parentProfile) {
    return NextResponse.json({ error: "Parent not found." }, { status: 404 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const fullName = body.fullName !== undefined ? String(body.fullName).trim() : undefined;
  const phone = body.phone !== undefined ? String(body.phone).trim() : undefined;
  const password = body.password !== undefined ? String(body.password) : undefined;
  const status = body.status !== undefined ? String(body.status) : undefined;

  if (fullName !== undefined && !fullName) {
    return NextResponse.json({ error: "Full name cannot be empty." }, { status: 400 });
  }
  if (password !== undefined && password !== "" && !isValidPassword(password)) {
    return NextResponse.json({ error: "Password must be at least 8 characters." }, { status: 400 });
  }
  if (status !== undefined && !["ACTIVE", "SUSPENDED", "BLOCKED"].includes(status)) {
    return NextResponse.json({ error: "Invalid status." }, { status: 400 });
  }

  const changes: string[] = [];
  if (fullName !== undefined && fullName !== parent.parentProfile.fullName) changes.push("fullName");
  if (phone !== undefined && (phone || null) !== parent.phone) changes.push("phone");
  if (password) changes.push("password");
  if (status !== undefined && status !== parent.status) changes.push("status");

  const updated = await prisma.user.update({
    where: { id },
    data: {
      ...(phone !== undefined ? { phone: phone || null } : {}),
      ...(status !== undefined ? { status: status as UserStatus } : {}),
      ...(password ? await passwordFields(password) : {}),
      ...(fullName !== undefined
        ? { parentProfile: { update: { fullName } } }
        : {}),
    },
    select: parentUserSelect,
  });

  if (changes.length) {
    await logActivity({
      userId: admin.user.id,
      type: "ADMIN_MANAGE_PARENT",
      targetId: id,
      metadata: {
        action: "update",
        username: parent.username,
        changes,
        ...(status !== undefined ? { status } : {}),
        passwordReset: !!password,
      },
      ...meta,
    }).catch(() => null);
  }

  return NextResponse.json({ parent: updated });
}

export async function DELETE(req: Request, ctx: Ctx) {
  const auth = await requireApiRole("ADMIN");
  if (auth.error) return auth.error;
  const admin = auth.current;
  const meta = getRequestMeta(req);
  const { id } = await ctx.params;

  const parent = await prisma.user.findUnique({
    where: { id },
    include: { parentProfile: { include: { students: { select: { id: true } } } } },
  });
  if (!parent || parent.role !== "PARENT") {
    return NextResponse.json({ error: "Parent not found." }, { status: 404 });
  }

  const childCount = parent.parentProfile?.students.length ?? 0;
  if (childCount > 0) {
    return NextResponse.json(
      { error: `Unlink ${childCount} student${childCount === 1 ? "" : "s"} first.` },
      { status: 409 },
    );
  }

  await prisma.user.delete({ where: { id } });

  await logActivity({
    userId: admin.user.id,
    type: "ADMIN_MANAGE_PARENT",
    targetId: id,
    metadata: { action: "delete", username: parent.username, fullName: parent.parentProfile?.fullName },
    ...meta,
  }).catch(() => null);

  return NextResponse.json({ ok: true });
}
