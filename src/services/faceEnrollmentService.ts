import { embedFaces, FaceServiceError, type EmbedResponse } from "@/lib/faceService";
import { selectFaceGroup } from "@/lib/face";
import { FACE_CONFIG } from "@/lib/constants";

/**
 * Face enrollment validation, shared by the admin path and the self-service
 * re-enrollment path.
 *
 * Both callers must enforce exactly the same quality bar, otherwise a student
 * could get a weaker enrollment by re-enrolling themselves than by having an
 * admin do it. Kept in one place so the rules cannot drift apart.
 */

export const MIN_SAMPLES = 3;
export const MAX_SAMPLES = 12;

export type EnrollmentInput =
  | { ok: true; images: string[]; embeddings: number[][]; accepted: number; embed: EmbedResponse }
  | { ok: false; message: string; status: number };

function sampleIssue(failed: EmbedResponse["results"], goodCount: number, total: number): string {
  if (goodCount === 0) {
    const reasons = [
      ...new Set(
        failed
          .map((r) => r.error)
          .filter((e): e is string => !!e)
          .map((e) => {
            if (e === "no_face") return "no face was detected";
            if (e === "multiple_faces") return "more than one face was detected";
            if (e === "image_decode") return "an image could not be decoded";
            return "a sample could not be processed";
          })
      ),
    ];
    return `${reasons.join("; ")}. Upload a clear, unobstructed photo of the student's face facing the camera.`;
  }
  return `${goodCount} of ${total} samples were usable. At least ${MIN_SAMPLES} clear samples are required — use a different photo or retake the capture.`;
}

/** Pulls `data:image/...` payloads out of an untrusted body. */
export function collectImages(body: unknown): string[] {
  const raw = (body as { images?: unknown } | null)?.images;
  if (!Array.isArray(raw)) return [];
  return raw.filter((s): s is string => typeof s === "string" && s.startsWith("data:image/") && s.length > 200);
}

/**
 * Validates and embeds a set of face samples.
 *
 * Returns either the embeddings to store, or a student-readable explanation.
 * Never throws for expected input problems; the face service being down is the
 * only failure that surfaces as an exception.
 */
export async function buildEnrollment(images: string[]): Promise<EnrollmentInput> {
  if (images.length < MIN_SAMPLES) {
    return { ok: false, status: 400, message: `At least ${MIN_SAMPLES} face samples are required.` };
  }
  if (images.length > MAX_SAMPLES) {
    return { ok: false, status: 400, message: `At most ${MAX_SAMPLES} images per enrollment.` };
  }

  let embed: EmbedResponse;
  try {
    embed = await embedFaces(images);
  } catch (e) {
    const msg = e instanceof FaceServiceError ? e.message : "Face service unavailable.";
    return { ok: false, status: 503, message: msg };
  }

  // Keep each usable result paired with the image it came from, so an outlier
  // dropped below also drops its photo instead of the two drifting apart.
  const usable = embed.results
    .map((r, imageIndex) => ({ r, imageIndex }))
    .filter(
      ({ r }) =>
        r.ok === true &&
        Array.isArray(r.embedding) &&
        r.embedding.length === FACE_CONFIG.EMBEDDING_DIM &&
        (r.embedding as number[]).every((n) => Number.isFinite(n))
    );
  if (usable.length < MIN_SAMPLES) {
    return { ok: false, status: 400, message: sampleIssue(embed.results, usable.length, images.length) };
  }

  // Every stored sample must be the SAME person, or the enrolled set would match
  // against two different faces and the login vote becomes meaningless. Rather
  // than reject the whole set on a single stray frame, keep the consistent
  // majority and discard the outliers; only a genuinely mixed set (no majority,
  // or two sizeable faces) is refused.
  const all = usable.map((u) => u.r.embedding as number[]);
  const selection = selectFaceGroup(all, {
    selfMax: FACE_CONFIG.SELF_MAX_DISTANCE,
    minCore: MIN_SAMPLES,
  });
  if (!selection.ok || selection.kept.length < MIN_SAMPLES) {
    return {
      ok: false,
      status: 400,
      message: "The samples appear to be different faces. Use the same student in every sample.",
    };
  }

  const embeddings = selection.kept.map((k) => all[k]);
  const keptImages = selection.kept.map((k) => images[usable[k].imageIndex]);

  // The raw embed response travels with the result so callers can log liveness
  // details without paying for a second embedding pass. The face service is
  // single-process and shared by every user on the box.
  return { ok: true, images: keptImages, embeddings, accepted: embeddings.length, embed };
}

/** Liveness detail for the activity log; null when the service reported none. */
export function livenessLog(embed: EmbedResponse | null) {
  if (!embed) return null;
  return embed.results.map((r) =>
    r.liveness ? { is_real: r.liveness.is_real, score: r.liveness.score ?? null } : null
  );
}
