import "server-only";

/**
 * Doubt recordings live on disk under UPLOAD_ROOT/doubt, which is the
 * `leou_uploads` volume mounted at /app/uploads — so a container rebuild does not
 * take a student's recordings with it.
 *
 * These files are deliberately NOT reachable through /api/files/[...path]: that
 * route only asks "is anybody logged in", which is fine for a face photo but not
 * for a recording of a student explaining their doubt. Playback goes through the
 * doubt routes, which check that the caller is the owning student or an admin.
 */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const UPLOAD_ROOT = path.join(process.cwd(), "uploads");
const DOUBT_DIR = path.join(UPLOAD_ROOT, "doubt");

/** Recordings are short by design; this is a ceiling, not a target. */
export const MAX_SCREEN_BYTES = 25 * 1024 * 1024;
export const MAX_VOICE_BYTES = 10 * 1024 * 1024;

/**
 * Only formats a browser can actually produce for these two captures. Anything
 * else is refused rather than stored, so the volume cannot be used as a drop for
 * arbitrary files.
 */
const ALLOWED: Record<string, { mime: string; ext: string; max: number }> = {
  SCREEN: { mime: "video/webm", ext: ".webm", max: MAX_SCREEN_BYTES },
  VOICE: { mime: "audio/webm", ext: ".webm", max: MAX_VOICE_BYTES },
};

export type RecordingKindName = "SCREEN" | "VOICE";

/** EBML header, the first four bytes of every Matroska/WebM stream. */
function isWebm(buffer: Buffer): boolean {
  return buffer.length >= 4 && buffer[0] === 0x1a && buffer[1] === 0x45 && buffer[2] === 0xdf && buffer[3] === 0xa3;
}

export function saveRecording(
  kind: RecordingKindName,
  buffer: Buffer
): { ok: true; storageName: string; mimeType: string; sizeBytes: number } | { ok: false; error: string } {
  const spec = ALLOWED[kind];
  if (!spec) return { ok: false, error: "That recording type is not supported." };
  if (buffer.byteLength === 0) return { ok: false, error: "The recording was empty." };
  if (buffer.byteLength > spec.max)
    return { ok: false, error: `That recording is too large (max ${Math.round(spec.max / 1024 / 1024)} MB).` };
  // WebM (and Matroska) start with the EBML magic number. Checking it means this
  // endpoint cannot be used to park arbitrary bytes in the uploads volume under a
  // .webm name; the browser recorder always emits a real header.
  if (!isWebm(buffer))
    return { ok: false, error: "That file is not a WebM recording." };

  fs.mkdirSync(DOUBT_DIR, { recursive: true });
  const storageName = `${crypto.randomUUID()}${spec.ext}`;
  fs.writeFileSync(path.join(DOUBT_DIR, storageName), buffer);
  return { ok: true, storageName, mimeType: spec.mime, sizeBytes: buffer.byteLength };
}

/**
 * Resolves a stored filename to an absolute path, or refuses. The name comes from
 * the database, but it is still rebuilt from the directory root and re-checked, so
 * a corrupted or tampered row cannot walk out of uploads/doubt.
 */
export function resolveRecordingPath(storageName: string): { ok: true; abs: string } | { ok: false; error: string } {
  if (!/^[0-9a-f-]{36}\.webm$/.test(storageName)) return { ok: false, error: "Invalid recording." };
  const abs = path.resolve(DOUBT_DIR, storageName);
  const rel = path.relative(path.resolve(DOUBT_DIR), abs);
  if (rel.startsWith("..") || path.isAbsolute(rel)) return { ok: false, error: "Invalid recording." };
  return { ok: true, abs };
}

export function deleteRecordingFile(storageName: string) {
  const resolved = resolveRecordingPath(storageName);
  if (!resolved.ok) return;
  fs.rmSync(resolved.abs, { force: true });
}

/** Sweeps files with no row pointing at them. The purge marks rows deleted rather
 * than removing them, so orphans are only ever genuine leftovers. */
export function listRecordingFiles(): string[] {
  if (!fs.existsSync(DOUBT_DIR)) return [];
  return fs.readdirSync(DOUBT_DIR).filter((f) => f.endsWith(".webm"));
}

export function deleteOrphanRecordings(knownNames: Set<string>): number {
  let removed = 0;
  for (const file of listRecordingFiles()) {
    if (knownNames.has(file)) continue;
    deleteRecordingFile(file);
    removed++;
  }
  return removed;
}