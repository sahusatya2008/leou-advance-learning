import crypto from "node:crypto";
import { prisma } from "@/lib/prisma";
import { ACCESS_CODE_LENGTH, ACCESS_CODE_TTL_MS } from "@/lib/constants";
import { logActivity } from "@/lib/log";
import type { LogType } from "@/generated/prisma/enums";

export async function issueAccessCode(studentUserId: string, createdBy?: string, ctx?: { ip?: string; userAgent?: string; deviceId?: string; source?: string }) {
  // Invalidate previous unused codes so exactly one live code exists per student.
  await prisma.accessCode.updateMany({
    where: { studentId: studentUserId, usedAt: null },
    data: { expiresAt: new Date() },
  });

  const code = crypto.randomInt(0, 1_000_000).toString().padStart(ACCESS_CODE_LENGTH, "0");
  const accessCode = await prisma.accessCode.create({
    data: {
      studentId: studentUserId,
      code,
      expiresAt: new Date(Date.now() + ACCESS_CODE_TTL_MS),
      createdBy: createdBy ?? null,
    },
  });

  await logActivity({
    userId: studentUserId,
    type: "ACCESS_CODE_GENERATED" as LogType,
    // `source` distinguishes an admin-issued code from one a student fetched
    // for themselves, without needing a second log row for the same event.
    metadata: { codeId: accessCode.id, ...(ctx?.source ? { source: ctx.source } : {}) },
    ip: ctx?.ip,
    userAgent: ctx?.userAgent,
    deviceId: ctx?.deviceId,
  });

  return { id: accessCode.id, code, expiresAt: accessCode.expiresAt.toISOString() };
}

export type ConsumeResult =
  | { ok: true }
  | { ok: false; reason: string; reasonCode: "not_found" | "already_used" | "expired" };

export async function consumeAccessCode(
  studentUserId: string,
  code: string,
  ctx?: { ip?: string; userAgent?: string; deviceId?: string }
): Promise<ConsumeResult> {
  const now = Date.now();
  const found = await prisma.accessCode.findFirst({
    where: { studentId: studentUserId, code },
    // Newest first: issuing a code expires the previous ones without deleting
    // them, so a collision with an old row must not shadow the live one. A live
    // code always has the latest expiresAt, since invalidation stamps the old
    // row with "now" while a fresh one is stamped "now + TTL".
    orderBy: { expiresAt: "desc" },
  });

  if (!found) {
    await logActivity({
      userId: studentUserId,
      type: "LOGIN_ACCESS_CODE" as LogType,
      metadata: { attempted: code, ok: false, reason: "code_not_found" },
      ip: ctx?.ip,
      userAgent: ctx?.userAgent,
      deviceId: ctx?.deviceId,
    });
    return { ok: false, reason: "Invalid access code.", reasonCode: "not_found" };
  }

  if (found.usedAt) {
    return { ok: false, reason: "This access code was already used. Get a new code and try again.", reasonCode: "already_used" };
  }

  if (found.expiresAt.getTime() < now) {
    return { ok: false, reason: "This access code has expired. Get a new code and try again.", reasonCode: "expired" };
  }

  await prisma.accessCode.update({ where: { id: found.id }, data: { usedAt: new Date() } });

  await logActivity({
    userId: studentUserId,
    type: "ACCESS_CODE_CONSUMED" as LogType,
    metadata: { codeId: found.id },
    ip: ctx?.ip,
    userAgent: ctx?.userAgent,
    deviceId: ctx?.deviceId,
  });

  return { ok: true };
}