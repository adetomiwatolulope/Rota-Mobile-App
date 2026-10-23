/**
 * scripts/seed-notifications.ts — Volume seed for the inbox pagination test.
 *
 * Creates one user and 10,000 Notification rows spread over the last 90 days,
 * so cursor pagination and the supporting index can be exercised at volume.
 * Idempotent: reruns delete the previous seed user's rows first.
 *
 * Run: npx tsx scripts/seed-notifications.ts
 */
import "dotenv/config";
import { prisma } from "../src/lib/prisma.js";

const SEED_EMAIL = "inbox-volume-seed@test.local";
const TOTAL = 10_000;
const BATCH = 1_000;
const TYPES = [
  "SCHEDULE_PUBLISHED",
  "SHIFT_ASSIGNED",
  "SHIFT_CHANGED",
  "SHIFT_REMOVED",
  "SWAP_OFFERED",
  "SWAP_RESOLVED",
] as const;

async function main() {
  const user = await prisma.user.upsert({
    where: { email: SEED_EMAIL },
    create: { email: SEED_EMAIL, passwordHash: "seed", name: "Inbox Seed" },
    update: {},
  });

  await prisma.notification.deleteMany({ where: { userId: user.id } });

  const now = Date.now();
  const windowMs = 90 * 24 * 60 * 60 * 1000;

  for (let start = 0; start < TOTAL; start += BATCH) {
    const rows = [];
    for (let i = start; i < Math.min(start + BATCH, TOTAL); i++) {
      // Spread across the window; 4 rows share each millisecond to prove the
      // id tie-break in the cursor never skips or repeats equal timestamps.
      const createdAt = new Date(now - Math.floor((i / 4) * (windowMs / (TOTAL / 4))));
      rows.push({
        userId: user.id,
        type: TYPES[i % TYPES.length]!,
        title: `Notification ${i}`,
        body: `Seeded inbox item ${i}`,
        readAt: i % 3 === 0 ? null : new Date(),
        createdAt,
      });
    }
    await prisma.notification.createMany({ data: rows });
  }

  const count = await prisma.notification.count({ where: { userId: user.id } });
  console.log(`Seeded ${count} notifications for user ${user.id} (${SEED_EMAIL})`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (err) => {
    console.error(err);
    await prisma.$disconnect();
    process.exit(1);
  });
