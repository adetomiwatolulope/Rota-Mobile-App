/**
 * scripts/explain-inbox.ts — Captures EXPLAIN ANALYZE for the first page of the
 * inbox keyset query, so the supporting index can be compared before/after.
 *
 * Run: npx tsx scripts/explain-inbox.ts <seedUserId>
 */
import "dotenv/config";
import { prisma } from "../src/lib/prisma.js";

const userId = process.argv[2];
if (!userId) {
  console.error("Usage: npx tsx scripts/explain-inbox.ts <userId>");
  process.exit(1);
}

async function main() {
  const sql = `
    EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
    SELECT id, "userId", type, title, body, "requiresAck", "readAt", "createdAt"
    FROM "Notification"
    WHERE "userId" = $1
      AND "createdAt" >= now() - interval '90 days'
    ORDER BY "createdAt" DESC, id DESC
    LIMIT 21
  `;

  const rows = await prisma.$queryRawUnsafe<{ "QUERY PLAN": string }[]>(sql, userId);
  for (const row of rows) {
    console.log(row["QUERY PLAN"]);
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (err) => {
    console.error(err);
    await prisma.$disconnect();
    process.exit(1);
  });
