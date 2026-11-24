import "dotenv/config";
import { prisma } from "@/lib/prisma";
import { newLeouPayRef } from "@/lib/leouPay";

/**
 * Older service requests predate the LeouPay reference, so their Pay Now page
 * would have nothing to show. This mints one for each, without touching the
 * quotation, amount, status or any selection the student already made.
 */
async function main() {
  const missing = await prisma.onboardingRequest.findMany({
    where: { leouPayRef: null },
    select: { id: true, status: true },
  });

  for (const r of missing) {
    const ref = newLeouPayRef();
    await prisma.onboardingRequest.update({ where: { id: r.id }, data: { leouPayRef: ref } });
    console.log(`minted ${ref} for request ${r.id} (${r.status})`);
  }

  const total = await prisma.onboardingRequest.count();
  const withRef = await prisma.onboardingRequest.count({ where: { leouPayRef: { not: null } } });
  console.log(`\n${withRef}/${total} service requests now have a payment reference`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
