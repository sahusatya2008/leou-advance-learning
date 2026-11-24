import { NextResponse } from "next/server";
import { clearSessionCookies, getCurrentUser, logout } from "@/lib/auth";
import { logActivity } from "@/lib/log";
import { getRequestMeta } from "@/lib/requestMeta";

export const runtime = "nodejs";

export async function GET() {
  const current = await getCurrentUser();
  if (!current) return NextResponse.json({ user: null });

  const { user } = current;
  const profile =
    user.role === "STUDENT"
      ? {
          fullName: user.studentProfile?.fullName ?? null,
          classRoomId: user.studentProfile?.classRoomId ?? null,
          facePhotoUrl: user.studentProfile?.facePhotoUrl ?? null,
        }
      : user.role === "ADMIN"
        ? { fullName: "Administrator" }
        : { fullName: user.username };

  return NextResponse.json({
    user: {
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
      status: user.status,
      ...profile,
    },
  });
}

export async function DELETE(req: Request) {
  const current = await getCurrentUser();
  const meta = getRequestMeta(req);
  if (current) {
    await logActivity({ userId: current.user.id, type: "LOGOUT", ...meta });
    await logout(current.sid);
  }
  // Revoking the row alone left the (now dead) cookie in the browser, so every
  // later request carried a credential that failed validation and answered
  // with a redirect to the login page. Clearing the cookie is what actually
  // ends the login on the client.
  const res = NextResponse.json({ ok: true });
  clearSessionCookies(res);
  return res;
}