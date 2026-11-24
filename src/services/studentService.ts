import { prisma } from "@/lib/prisma";
import { isValidEmail, isValidPassword, isValidUsername } from "@/lib/validation";
import { passwordFields } from "@/lib/passwords";
import { FACE_CONFIG, type StreamKey } from "@/lib/constants";
import { isEmbeddingArray } from "@/lib/face";
import { saveImageDataUrl, type SaveUploadResult } from "@/lib/uploads";
import type { SchoolStatus } from "@/generated/prisma/enums";

export type RegisterStudentInput = {
  fullName: string;
  classRoomId: string;
  stream?: StreamKey | null;
  subjectIds: string[];
  schoolName: string;
  schoolStatus: SchoolStatus;
  schoolClassHistory?: string;
  email: string;
  phone: string;
  username: string;
  password: string;
  faceEmbeddings: number[][];
  facePhotoUrl: string;
  onboardingRequired?: boolean;
};

export function validateStudentInput(input: RegisterStudentInput): string[] {
  const errors: string[] = [];
  if (typeof input.fullName !== "string" || input.fullName.trim().length < 3)
    errors.push("Full name must be at least 3 characters.");
  if (!input.classRoomId) errors.push("Class is required.");
  if (!isValidEmail(input.email)) errors.push("A valid email is required.");
  if (typeof input.phone !== "string" || !/^[0-9+\-\s]{7,15}$/.test(input.phone))
    errors.push("A valid phone number is required.");
  if (!isValidUsername(input.username)) errors.push("Username must be 4-32 chars (letters, numbers, _ .).");
  if (!isValidPassword(input.password)) errors.push("Password must be at least 8 characters.");
  if (!input.schoolName || input.schoolName.trim().length < 2) errors.push("School name is required.");
  if (!isEmbeddingArray(input.faceEmbeddings)) errors.push("Valid face embeddings are required.");
  if (!input.facePhotoUrl) errors.push("A face photo is required.");
  if (input.faceEmbeddings.length < FACE_CONFIG.ENROLL_SAMPLES)
    errors.push(`At least ${FACE_CONFIG.ENROLL_SAMPLES} face samples are required.`);
  return errors;
}

export type CreateStudentInput = Omit<RegisterStudentInput, "facePhotoUrl"> & {
  facePhoto: string;
  // Only the self-registration route sets this; admin-created accounts are unaffected.
  onboardingRequired?: boolean;
};

export type CreateStudentResult =
  | { ok: true; user: { id: string; username: string }; photo: SaveUploadResult }
  | { ok: false; errors: string[]; photo?: SaveUploadResult };

/**
 * Shared student creation used by both self-registration and the admin
 * "Create Student" wizard. Saves the face photo and registers the account.
 */
export async function createStudent(input: CreateStudentInput): Promise<CreateStudentResult> {
  const photo = saveImageDataUrl("face", input.facePhoto);
  if (!photo.ok) return { ok: false, errors: [photo.error] };

  const result = await registerStudent({
    ...input,
    facePhotoUrl: photo.url,
  });

  if (!result.ok) return { ok: false, errors: result.errors };
  return {
    ok: true,
    user: { id: result.user.id, username: result.user.username },
    photo: { ok: true, url: photo.url, mime: photo.mime },
  };
}

export async function registerStudent(input: RegisterStudentInput) {
  const errors = validateStudentInput(input);
  if (errors.length) return { ok: false as const, errors };

  const classRoom = await prisma.classRoom.findUnique({ where: { id: input.classRoomId } });
  if (!classRoom || !classRoom.isActive)
    return { ok: false as const, errors: ["Selected class is not available."] };

  if (classRoom.hasStreams && !input.stream)
    return { ok: false as const, errors: ["Stream selection is required for this class."] };

  const subjectCount = await prisma.subjectClass.count({
    where: { classRoomId: input.classRoomId, subjectId: { in: input.subjectIds } },
  });
  if (subjectCount !== input.subjectIds.length)
    return { ok: false as const, errors: ["One or more subjects are not offered for this class."] };

  const usernameTaken = !!(await prisma.user.findUnique({ where: { username: input.username } }));
  if (usernameTaken) return { ok: false as const, errors: ["Username is already taken."] };

  const emailTaken = !!(await prisma.user.findUnique({ where: { email: input.email } }));
  if (emailTaken) return { ok: false as const, errors: ["Email is already registered."] };

  const phoneTaken = !!(await prisma.user.findFirst({ where: { phone: input.phone } }));
  if (phoneTaken) return { ok: false as const, errors: ["Phone number is already registered."] };

  const { passwordHash, passwordEnc } = await passwordFields(input.password);

  const student = await prisma.user.create({
    data: {
      username: input.username,
      email: input.email,
      phone: input.phone,
      passwordHash,
      passwordEnc,
      role: "STUDENT",
      onboardingRequired: input.onboardingRequired ?? false,
      studentProfile: {
        create: {
          fullName: input.fullName.trim(),
          classRoomId: input.classRoomId,
          stream: (input.stream as never) ?? null,
          schoolName: input.schoolName.trim(),
          schoolStatus: input.schoolStatus,
          schoolClassHistory: input.schoolClassHistory?.trim() || null,
          facePhotoUrl: input.facePhotoUrl,
          faceEmbeddings: input.faceEmbeddings as never,
        },
      },
    },
    include: { studentProfile: true },
  });

  return { ok: true as const, user: student };
}