import { hashPassword } from "@/lib/validation";
import { open, seal } from "@/lib/secrets";

/**
 * Every place a password is set must persist both halves:
 *   - `passwordHash` — bcrypt, what the login route verifies;
 *   - `passwordEnc`  — AES-256-GCM copy, what the admin management pages reveal.
 *
 * Funnelling both through this helper keeps them from drifting apart, which is
 * exactly the bug that would leave an admin staring at a password the student
 * can no longer log in with.
 */
export async function passwordFields(plain: string): Promise<{ passwordHash: string; passwordEnc: string | null }> {
  const passwordHash = await hashPassword(plain);
  return { passwordHash, passwordEnc: seal(plain) };
}

/**
 * Reveal a stored password copy for admin display.
 *
 * Accepts either a raw sealed string or a row carrying `passwordEnc`. Returns
 * `null` when the value is absent or undecryptable, which the UI renders as
 * "not recorded" (accounts created before this feature have no copy).
 */
export function revealPassword(source: string | null | undefined | { passwordEnc?: string | null }): string | null {
  if (source && typeof source === "object") return open(source.passwordEnc);
  return open(source);
}
