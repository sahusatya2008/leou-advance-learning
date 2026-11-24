import { existsSync } from "node:fs";
import { join } from "node:path";
import { PAYMENT_CONFIG, PAYMENT_IS_PLACEHOLDER } from "@/lib/constants";

/**
 * Is the payment setup actually finished?
 *
 * Every value in PAYMENT_CONFIG has a default so the app boots cleanly on a fresh
 * machine - which is exactly why an unconfigured UPI id is dangerous. The pay
 * page renders perfectly and the QR scans, so the money would go to a placeholder
 * and nobody would notice. The admin queue checks this instead.
 *
 * Server-only: it touches the filesystem, and @/lib/constants is imported by
 * client components.
 */
export function paymentSetupProblems(): string[] {
  const problems: string[] = [];

  if (PAYMENT_IS_PLACEHOLDER) {
    problems.push(
      `PAYMENT_UPI_ID is still the placeholder ("${PAYMENT_CONFIG.upiId}"). Students who scan the QR would be paying nobody - set it in .env and redeploy.`
    );
  }

  if (PAYMENT_CONFIG.qrImage) {
    const file = join(process.cwd(), "public", PAYMENT_CONFIG.qrImage.replace(/^\//, ""));
    if (!existsSync(file)) {
      problems.push(
        `PAYMENT_QR_IMAGE points at "${PAYMENT_CONFIG.qrImage}" but there is no such file in /public, so a generated QR is being shown instead.`
      );
    }
  }

  return problems;
}
