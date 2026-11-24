import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const UPLOAD_ROOT = path.join(process.cwd(), "uploads");
const UPLOAD_KINDS = new Set(["face", "question", "answer", "avatar"]);
export const MAX_IMAGE_BYTES = 12 * 1024 * 1024;

const EXT_MIME: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".pdf": "application/pdf",
  ".mp3": "audio/mpeg",
  ".mp4": "video/mp4",
  ".doc": "application/msword",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".txt": "text/plain",
  ".zip": "application/zip",
};

export type SaveUploadResult = { ok: true; url: string; mime: string } | { ok: false; error: string };

export function saveUpload(kind: string, buffer: Buffer, filename: string): SaveUploadResult {
  if (!UPLOAD_KINDS.has(kind)) return { ok: false, error: "Invalid upload kind." };
  if (buffer.byteLength === 0 || buffer.byteLength > MAX_IMAGE_BYTES)
    return { ok: false, error: "File is empty or too large (max 12 MB)." };

  const ext = (path.extname(filename).toLowerCase() || ".bin").slice(0, 12);
  const mime = EXT_MIME[ext];
  if (!mime) return { ok: false, error: "File type not allowed." };
  if (!mime.startsWith("image/") && mime !== "application/pdf") {
    return { ok: false, error: "Only images and PDFs are accepted right now." };
  }

  const dir = path.join(UPLOAD_ROOT, kind);
  fs.mkdirSync(dir, { recursive: true });
  const name = `${crypto.randomUUID()}${ext}`;
  fs.writeFileSync(path.join(dir, name), buffer);
  return { ok: true, url: `/api/files/${kind}/${name}`, mime };
}

export function resolveFilePath(uploadPath: string): { ok: true; abs: string; mime: string } | { ok: false; error: string } {
  const parts = uploadPath.split("/").filter(Boolean);
  // expect [kind, filename]
  if (parts.length !== 2 || !UPLOAD_KINDS.has(parts[0]) || !/^[\w.-]+$/.test(parts[1])) {
    return { ok: false, error: "Invalid file path." };
  }
  const abs = path.resolve(UPLOAD_ROOT, parts[0], parts[1]);
  const rel = path.relative(path.resolve(UPLOAD_ROOT), abs);
  if (rel.startsWith("..") || path.isAbsolute(rel)) return { ok: false, error: "Invalid file path." };
  const mime = EXT_MIME[path.extname(abs).toLowerCase()];
  if (!mime) return { ok: false, error: "Unsupported file." };
  if (!fs.existsSync(abs) || !fs.statSync(abs).isFile()) return { ok: false, error: "File not found." };
  return { ok: true, abs, mime };
}

export function saveImageDataUrl(
  kind: "face" | "question" | "answer" | "payment" | "payment-decision",
  dataUrl: string
): SaveUploadResult {
  const m = /^data:(image\/[a-z+]+);base64,(.+)$/.exec(dataUrl);
  if (!m) return { ok: false, error: "Invalid image data." };
  const raw = Buffer.from(m[2], "base64");
  const mime = m[1];
  const ext = mime === "image/png" ? ".png" : mime === "image/webp" ? ".webp" : ".jpg";
  if (raw.byteLength === 0 || raw.byteLength > MAX_IMAGE_BYTES)
    return { ok: false, error: "Image is empty or too large (max 12 MB)." };
  const dir = path.join(UPLOAD_ROOT, kind);
  fs.mkdirSync(dir, { recursive: true });
  const name = `${crypto.randomUUID()}${ext}`;
  fs.writeFileSync(path.join(dir, name), raw);
  return { ok: true, url: `/api/files/${kind}/${name}`, mime };
}