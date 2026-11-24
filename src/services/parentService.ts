import { prisma } from "@/lib/prisma";
import { isValidEmail, isValidPassword, isValidUsername } from "@/lib/validation";
import { passwordFields } from "@/lib/passwords";

/**
 * Parent accounts can be created two ways: an administrator using the Parents
 * console, or a student from their own profile ("register a parent"). The latter
 * needs a sensible default username and must refuse to link a second parent to a
 * student who already has one.
 */

/** A system-generated starting username for a student's parent, e.g. `rolex.parent`. */
export function suggestParentUsername(studentUsername: string): string {
  const base = studentUsername.replace(/[^a-zA-Z0-9_.]/g, "").slice(0, 24) || "parent";
  return `${base}.parent`.slice(0, 32);
}

/** The suggested username, bumped with a numeric suffix until it is free. */
export async function availableParentUsername(studentUsername: string): Promise<string> {
  const base = suggestParentUsername(studentUsername);
  let candidate = base;
  for (let i = 2; i < 200; i += 1) {
    const taken = await prisma.user.findUnique({ where: { username: candidate }, select: { id: true } });
    if (!taken) return candidate;
    candidate = `${base.slice(0, 28)}${i}`;
  }
  return `${base.slice(0, 24)}${Date.now().toString(36).slice(-7)}`;
}

export type RegisterParentInput = {
  studentUserId: string;
  username: string;
  password: string;
  fullName?: string;
  email?: string;
  phone?: string;
};

export type RegisterParentResult =
  | { ok: true; parentUserId: string; username: string }
  | { ok: false; error: string; status: number };

export async function registerParentForStudent(input: RegisterParentInput): Promise<RegisterParentResult> {
  const student = await prisma.user.findUnique({
    where: { id: input.studentUserId },
    include: { studentProfile: true },
  });
  if (!student || student.role !== "STUDENT" || !student.studentProfile) {
    return { ok: false, error: "Student not found.", status: 404 };
  }
  if (student.studentProfile.parentUserId) {
    return { ok: false, error: "This student already has a parent linked.", status: 409 };
  }

  const username = input.username.trim();
  if (!isValidUsername(username)) {
    return { ok: false, error: "Username must be 4-32 characters: letters, numbers, _ or .", status: 400 };
  }
  if (!isValidPassword(input.password)) {
    return { ok: false, error: "Password must be at least 8 characters.", status: 400 };
  }

  const usernameTaken = await prisma.user.findUnique({ where: { username }, select: { id: true } });
  if (usernameTaken) return { ok: false, error: "Username is already taken.", status: 409 };

  const emailInput = (input.email ?? "").trim();
  if (emailInput && !isValidEmail(emailInput)) {
    return { ok: false, error: "A valid email is required.", status: 400 };
  }
  const email = emailInput || `${username}@leou.local`;
  const emailTaken = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (emailTaken) return { ok: false, error: "Email is already registered.", status: 409 };

  const parent = await prisma.user.create({
    data: {
      username,
      email,
      phone: (input.phone ?? "").trim() || null,
      ...(await passwordFields(input.password)),
      role: "PARENT",
      parentProfile: {
        create: {
          fullName: (input.fullName ?? "").trim() || student.studentProfile.fullName,
          // Fixed once saved: the student gets a single opportunity to edit the
          // generated username, which is this form.
          usernameLocked: true,
        },
      },
    },
    include: { parentProfile: true },
  });

  await prisma.studentProfile.update({
    where: { id: student.studentProfile.id },
    data: { parentUserId: parent.parentProfile!.id },
  });

  return { ok: true, parentUserId: parent.id, username: parent.username };
}
