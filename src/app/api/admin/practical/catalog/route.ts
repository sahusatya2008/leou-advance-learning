import { NextResponse } from "next/server";
import { requireApiRole } from "@/lib/panels";
import { getPracticalCatalog } from "@/services/practicalService";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const auth = await requireApiRole("ADMIN");
  if (auth.error) return auth.error;
  const url = new URL(req.url);
  // Computer Science only for now; pass subject=all to widen later.
  const scope = url.searchParams.get("subject") ?? "CS";
  const catalog = await getPracticalCatalog(scope === "all" ? null : scope);
  return NextResponse.json({ catalog });
}