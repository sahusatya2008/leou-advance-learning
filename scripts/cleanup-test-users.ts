/**
 * Removes disposable test users.
 *
 * Scoped to the reserved `@example.test` domain, which is the only place the
 * test fixtures create accounts - no real student can have that address, so
 * this can never touch production data. Request and payment rows go with them
 * via the schema's onDelete cascades, which is why the leftovers from an
 * interrupted run do not pile up and distort later counts.
 */
import "dotenv/config";
import { prisma } from "@/lib/prisma";

const TEST_DOMAIN = "@example.test";

async function main() {
  const junk = await prisma.user.findMany({
    where: { email: { endsWith: TEST_DOMAIN } },
    select: { id: true, email: true },
  });
  if (!junk.length) {
    console.log(`no disposable users; users=${await prisma.user.count()}`);
    return;
  }
  for (const u of junk) console.log(`removing ${u.email}`);

  const ids = junk.map((u) => u.id);
  const payments = await prisma.paymentRequest.deleteMany({ where: { userId: { in: ids } } });
  const requests = await prisma.onboardingRequest.deleteMany({ where: { userId: { in: ids } } });
  const { count } = await prisma.user.deleteMany({ where: { id: { in: ids } } });

  console.log(
    `deleted ${count} user(s), ${requests.count} request(s), ${payments.count} payment(s)`
  );
  console.log(
    `users now: ${await prisma.user.count()}, requests: ${await prisma.onboardingRequest.count()}, ` +
      `payments: ${await prisma.paymentRequest.count()}`
  );
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
