import { NextResponse } from "next/server";
import { embedFaces, FaceServiceError } from "@/lib/faceService";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Per-IP guard so this public endpoint can't be hammered into an ML loop. It has
// to stay public: self-registration embeds a face before the account exists, so
// there is no session to check. Abuse control is therefore mostly the proxy's
// per-device budget below; this is a backstop.
//
// It was 12 per minute per IP, which a school sharing one NAT address exhausts
// by enrolling a handful of students, and the 429 that followed was reported
// back on the photo step where the alert was not rendered - so the admin saw a
// spinner stop and nothing else. The proxy allows 20/min per device and
// 200/min per IP, so this backstop sits above a normal burst instead of below
// it.
const EMBED_MAX_PER_IP_PER_MIN = 30;
// Cap the map so a flood of distinct/spoofed source IPs cannot grow it without
// bound. Entries idle for the whole window are swept out once we cross the cap.
const MAX_TRACKED_IPS = 5_000;
const recentHits = new Map<string, number[]>();

function sweep(now: number) {
  if (recentHits.size <= MAX_TRACKED_IPS) return;
  for (const [key, hits] of recentHits) {
    if (hits.length === 0 || now - hits[hits.length - 1] > 60_000) recentHits.delete(key);
  }
  // If every entry is still hot the cap is meaningless — start fresh rather than
  // grow past it, since the alternative is unbounded memory.
  if (recentHits.size > MAX_TRACKED_IPS) recentHits.clear();
}

function rateOk(ip: string): boolean {
  const now = Date.now();
  const hits = (recentHits.get(ip) ?? []).filter((t) => now - t < 60_000);
  hits.push(now);
  recentHits.set(ip, hits);
  sweep(now);
  return hits.length <= EMBED_MAX_PER_IP_PER_MIN;
}

export async function POST(req: Request) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (!rateOk(ip)) {
    return NextResponse.json(
      { error: "Too many face scans from this network. Wait a minute, then try again." },
      { status: 429 }
    );
  }

  let body: { images?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const images = Array.isArray(body.images)
    ? (body.images as unknown[]).filter(
        (s): s is string =>
          typeof s === "string" && s.startsWith("data:image/") && s.length > 200
      )
    : [];

  if (images.length === 0) {
    return NextResponse.json(
      { error: "At least one camera image is required." },
      { status: 400 }
    );
  }
  if (images.length > 12) {
    return NextResponse.json({ error: "Too many images." }, { status: 400 });
  }

  let embed: Awaited<ReturnType<typeof embedFaces>>;
  try {
    embed = await embedFaces(images);
  } catch (e) {
    const msg = e instanceof FaceServiceError ? e.message : "Face service unavailable.";
    return NextResponse.json({ error: msg }, { status: 503 });
  }

  // Keep only the values the client actually needs; always reject degenerate or
  // wrong-dimension vectors so garbage can never be stored as an enrollment.
  const results = embed.results.map((r) => {
    const ok =
      r.ok === true &&
      Array.isArray(r.embedding) &&
      r.embedding.length === 512 &&
      r.embedding.every((n) => Number.isFinite(n));
    return {
      ok,
      error: ok ? undefined : r.error ?? "unusable_embedding",
      embedding: ok ? r.embedding : undefined,
      det_score: ok ? r.det_score : undefined,
      face_px: ok ? r.face_px : undefined,
      // No liveness block means anti-spoof never reached a verdict, which is
      // not the same as a verdict of "real". Defaulting it to true showed a
      // pass that was never measured; null keeps "not checked" distinguishable
      // from "checked and real".
      liveness: ok
        ? r.liveness
          ? { is_real: r.liveness.is_real, score: r.liveness.score ?? null }
          : { is_real: null, score: null }
        : undefined,
    };
  });

  // A rejected frame is only ever reported back to the browser, so a capture the
  // model could not read left no trace and looked identical to a frozen button.
  // One line is enough to tell "the camera never saw a face" apart from "this
  // network is being rate limited" when an enrollment fails.
  const rejected = results.filter((r) => !r.ok);
  if (rejected.length > 0) {
    console.warn(
      `[face/embed] ${rejected.length}/${results.length} frame(s) rejected from ${ip}:`,
      rejected.map((r) => r.error).join(", ")
    );
  }

  return NextResponse.json({ results });
}