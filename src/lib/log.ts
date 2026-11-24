import { prisma } from "@/lib/prisma";
import type { LogType } from "@/generated/prisma/enums";

export type LogInput = {
  userId?: string;
  type: LogType;
  metadata?: Record<string, unknown>;
  targetId?: string;
  ip?: string;
  userAgent?: string;
  deviceId?: string;
  device?: Record<string, unknown>;
};

export async function logActivity(input: LogInput) {
  await prisma.activityLog
    .create({
      data: {
        userId: input.userId ?? null,
        type: input.type,
        metadata: {
          ...(input.metadata ?? {}),
          ...(input.targetId ? { targetId: input.targetId } : {}),
        } as never,
        ip: input.ip ?? null,
        userAgent: input.userAgent ?? null,
        deviceId: input.deviceId ?? null,
        device: input.device as never,
      },
    })
    .catch((err) => console.error("logActivity failed", err));
}