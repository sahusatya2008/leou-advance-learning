import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { saveUpload } from "@/lib/uploads";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // `formData()` throws on a malformed or over-sized multipart body. Left
  // unguarded that became an HTML error page, which the browser then tried to
  // read as JSON ("Unexpected token '<'"). Answer in JSON instead.
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "That upload could not be read. Please try a smaller file." }, { status: 400 });
  }

  const kind = String(form.get("kind") ?? "");
  const file = form.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file provided." }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const result = saveUpload(kind, buffer, file.name);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });

  return NextResponse.json({ url: result.url, mime: result.mime });
}