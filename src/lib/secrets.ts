import crypto from "node:crypto";

/**
 * Reversible encryption for the small set of values an administrator must be
 * able to read back — currently only the password copy shown in the student and
 * parent management pages (see `User.passwordEnc` in the Prisma schema).
 *
 * This is deliberately separate from the login path: login verifies the bcrypt
 * `passwordHash`, and this module only ever produces or reads the display copy.
 *
 * AES-256-GCM with a random 96-bit IV per record, so identical passwords do not
 * encrypt to identical ciphertext. The key is derived once from the same
 * `JWT_SECRET` the session layer uses, through scrypt with a fixed salt, so it
 * survives restarts and needs no extra deployment secret. Rotating
 * `JWT_SECRET` therefore invalidates every stored copy, which is acceptable for
 * display-only data: the affected records simply read as "not recorded" until
 * the password is set again.
 */

const VERSION = "v1";
const SALT = "leou:recoverable-secret:v1";

let cachedKey: Buffer | null = null;

function key(): Buffer {
  if (cachedKey) return cachedKey;
  const base = process.env.JWT_SECRET;
  // Same rule as the session layer (see src/lib/auth.ts): never derive the
  // display-copy key from a known default in production.
  if (!base || base === "dev-secret-change-me") {
    if (process.env.NODE_ENV === "production") {
      throw new Error("JWT_SECRET is not set — refusing to derive the secret-storage key from a known default.");
    }
    cachedKey = crypto.scryptSync("dev-secret-change-me", SALT, 32);
    return cachedKey;
  }
  cachedKey = crypto.scryptSync(base, SALT, 32);
  return cachedKey;
}

/** Encrypt a plaintext string. Returns `null` for an empty/blank value. */
export function seal(plain: string): string | null {
  if (!plain) return null;
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key(), iv);
  const ciphertext = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [VERSION, iv.toString("base64url"), tag.toString("base64url"), ciphertext.toString("base64url")].join(".");
}

/**
 * Decrypt a value produced by `seal`. Returns `null` when the value is missing,
 * malformed, or was sealed under a different key — callers render that as
 * "not recorded" rather than crashing a page.
 */
export function open(sealed: string | null | undefined): string | null {
  if (!sealed) return null;
  const parts = sealed.split(".");
  if (parts.length !== 4 || parts[0] !== VERSION) return null;
  try {
    const iv = Buffer.from(parts[1], "base64url");
    const tag = Buffer.from(parts[2], "base64url");
    const ciphertext = Buffer.from(parts[3], "base64url");
    const decipher = crypto.createDecipheriv("aes-256-gcm", key(), iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
  } catch {
    return null;
  }
}
