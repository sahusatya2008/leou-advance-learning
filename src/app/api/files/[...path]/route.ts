import { NextResponse, type NextRequest } from "next/server";
import fs from "node:fs";
import { getCurrentUser } from "@/lib/auth";
import { resolveFilePath } from "@/lib/uploads";

export async function GET(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  const user = await getCurrentUser();
  if (!user) return new NextResponse("Unauthorized", { status: 401 });

  const { path: segments } = await ctx.params;
  const joined = segments.join("/");
  const resolved = resolveFilePath(joined);
  if (!resolved.ok) return new NextResponse(resolved.error, { status: 404 });

  const stream = fs.createReadStream(resolved.abs);
  return new NextResponse(stream as unknown as BodyInit, {
    headers: {
      "Content-Type": resolved.mime,
      "Cache-Control": "private, max-age=31536000, immutable",
    },
  });
}