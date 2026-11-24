import { NextResponse } from "next/server";
import { requireApiRole } from "@/lib/panels";
import { listDoubtsForAdmin } from "@/services/practicalService";

export const runtime = "nodejs";

/** The doubt inbox: every thread, newest activity first, optionally by status. */
export async function GET(req: Request) {
  const auth = await requireApiRole("ADMIN");
  if (auth.error) return auth.error;

  const url = new URL(req.url);
  const raw = url.searchParams.get("status");
  const status = raw === "OPEN" || raw === "ANSWERED" || raw === "SATISFIED" ? raw : undefined;

  const doubts = await listDoubtsForAdmin(status ? { status } : {});
  return NextResponse.json({ doubts });
}
