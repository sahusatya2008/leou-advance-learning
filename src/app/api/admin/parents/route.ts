import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiRole } from "@/lib/panels";
import { getRequestMeta } from "@/lib/requestMeta";
import { logActivity } from "@/lib/log";
import { isValidEmail, isValidPassword, isValidUsername } from "@/lib/validation";
import { passwordFields } from "@/lib/passwords";

export const runtime = "nodejs";

const parentStudentSelect = {
  id: true,
  fullName: true,
  parentUserId: true,
  user: { select: { id: true, username: true, status: true } },
  classRoom: { select: { name: true } },
} as const;

const parentInclude = {
  parentProfile: {
    include: {
      students: { select: parentStudentSelect },
    },
  },
} as const;

/**
 * Safe user scalars for a browser response. The old unrestricted `include`
 * returned `passwordHash`, `passwordEnc` and every linked student's face
 * template; admins reveal passwords through the audited /api/admin/secret.
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

export async function GET() {
  const auth = await requireApiRole("ADMIN");
  if (auth.error) return auth.error;
  const parents = await prisma.user.findMany({
    where: { role: "PARENT" },
    orderBy: { createdAt: "desc" },
    select: parentUserSelect,
  });
  return NextResponse.json({ parents });
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

  const username = String(body.username ?? "").trim();
  const fullName = String(body.fullName ?? "").trim();
  const password = String(body.password ?? "");
  const phone = String(body.phone ?? "").trim();
  const emailInput = String(body.email ?? "").trim();

  if (!isValidUsername(username)) {
    return NextResponse.json(
      { error: "Username must be 4-32 characters: letters, numbers, _ or ." },
      { status: 400 },
    );
  }
  if (!fullName) return NextResponse.json({ error: "Full name is required." }, { status: 400 });
  if (!isValidPassword(password)) {
    return NextResponse.json({ error: "Password must be at least 8 characters." }, { status: 400 });
  }

  // A parent's email is optional in the UI; the User model needs one, so we
  // synthesize a unique placeholder from the username when it is left blank.
  const email = emailInput || `${username}.parent@leou.local`;
  if (emailInput && !isValidEmail(emailInput)) {
    return NextResponse.json({ error: "A valid email is required." }, { status: 400 });
  }

  const usernameTaken = !!(await prisma.user.findUnique({ where: { username } }));
  if (usernameTaken) return NextResponse.json({ error: "Username is already taken." }, { status: 409 });
  const emailTaken = !!(await prisma.user.findUnique({ where: { email } }));
  if (emailTaken) return NextResponse.json({ error: "Email is already registered." }, { status: 409 });

  const parent = await prisma.user.create({
    data: {
      username,
      email,
      phone: phone || null,
      ...(await passwordFields(password)),
      role: "PARENT",
      parentProfile: { create: { fullName } },
    },
    select: parentUserSelect,
  });

  await logActivity({
    userId: admin.user.id,
    type: "ADMIN_MANAGE_PARENT",
    targetId: parent.id,
    metadata: { action: "create", username, fullName, phone },
    ...meta,
  }).catch(() => null);

  return NextResponse.json({ parent }, { status: 201 });
}
