// Server-side client for the Python face verification service (InsightFace
// ArcFace + DeepFace anti-spoofing). Server-only: never import from a client
// component.
//
// The service defaults to http://127.0.0.1:8000 (start via `npm run face:serve`
// or ./face/serve.sh) and is overridable with FACE_SVC_URL.
const FACE_SVC_URL = process.env.FACE_SVC_URL ?? "http://127.0.0.1:8000";

export class FaceServiceError extends Error {}

type FaceServicePath = "/embed" | "/verify" | "/health" | "/scan-payment";

export async function faceServiceRequest<TBody extends object, TOut = unknown>(
  path: FaceServicePath,
  body: TBody
): Promise<TOut> {
  const controller = new AbortController();
  // Allow a generous window: the model may still be cold-loading on first call.
  const timer = setTimeout(() => controller.abort(), 120_000);
  try {
    const res = await fetch(`${FACE_SVC_URL}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
      cache: "no-store",
    });
    if (!res.ok) {
      // Surface the Python-side detail (e.g. validation) when present.
      const detail = await res.text().catch(() => "");
      throw new FaceServiceError(`face service error ${res.status}: ${detail.slice(0, 200)}`);
    }
    return (await res.json()) as TOut;
  } catch (e) {
    if (e instanceof FaceServiceError) throw e;
    throw new FaceServiceError(
      `Face verification service is not reachable at ${FACE_SVC_URL}. Start it with \`npm run face:serve\`.`
    );
  } finally {
    clearTimeout(timer);
  }
}

export type EmbedResult = {
  index: number;
  ok: boolean;
  error?: string;
  embedding?: number[];
  det_score?: number;
  face_px?: number;
  width?: number;
  liveness?: { is_real: boolean | null; score: number | null; unavailable?: string };
  ms?: number;
};

export type EmbedResponse = { results: EmbedResult[] };

export type VerifyResult = EmbedResult & {
  matched: boolean;
  distance: number | null;
  reason?: string | null;
};

export type VerifyResponse = {
  samples: number;
  valid: number;
  votes_required: number;
  pass: boolean;
  results: VerifyResult[];
};

export async function embedFaces(images: string[]): Promise<EmbedResponse> {
  return faceServiceRequest<{ images: string[] }, EmbedResponse>("/embed", { images });
}

export async function verifyFace(
  images: string[],
  enrollments: number[][],
  opts: { matchDistance: number; minFacePx: number; requireLiveness?: boolean } = {
    matchDistance: 0.4,
    minFacePx: 64,
    requireLiveness: true,
  }
): Promise<VerifyResponse> {
  return faceServiceRequest<object, VerifyResponse>("/verify", {
    images,
    enrollments,
    match_distance: opts.matchDistance,
    min_face_px: opts.minFacePx,
    require_liveness: opts.requireLiveness ?? true,
  });
}

export type PaymentScanResult = {
  ok: boolean;
  error?: string;
  transactionId?: string;
  confidence?: number;
  alternatives?: string[];
  text?: string;
  /** Money read off the screen, so it can be checked against the quotation. */
  amount?: number | null;
  amountConfidence?: number;
  /** When the payment was made, as read off the screen. */
  date?: string | null;
  time?: string | null;
  payee?: string | null;
};

/**
 * Ask the Python service to read a UPI transaction id off a camera frame.
 *
 * The answer is a proposal, not a verdict: the student is shown what was read
 * and has to confirm it before anything is submitted, because a misread
 * transaction id would send the admin looking for a payment that never existed.
 */
export async function scanPaymentProof(image: string): Promise<PaymentScanResult> {
  try {
    return await faceServiceRequest<{ image: string }, PaymentScanResult>("/scan-payment", { image });
  } catch (e) {
    return {
      ok: false,
      error:
        e instanceof FaceServiceError
          ? "The scanner is unavailable right now. Enter the transaction id instead."
          : "Could not scan the payment screen. Enter the transaction id instead.",
    };
  }
}
