/**
 * modules/notifications/notifications.test.ts — Inbox cursor pagination.
 *
 * Runs against the real PostgreSQL database [AGENTS §5]. Proves PRD 7.1:
 * keyset pagination never skips or repeats items, including rows that share a
 * timestamp, and stays correct when new rows are inserted at the top.
 */
import "dotenv/config";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "../../lib/prisma.js";
import { INBOX_WINDOW_DAYS } from "../../lib/constants.js";
import { notificationsService } from "./notifications.service.js";

const userIds: string[] = [];

async function makeUser(prefix: string): Promise<string> {
  const user = await prisma.user.create({
    data: {
      email: `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}@test.local`,
      passwordHash: "x",
      name: "Inbox Tester",
    },
  });
  userIds.push(user.id);
  return user.id;
}

async function seed(userId: string, count: number, baseMs: number) {
  const now = Date.now();
  await prisma.notification.createMany({
    data: Array.from({ length: count }, (_, i) => ({
      userId,
      type: "SCHEDULE_PUBLISHED" as const,
      title: `n${i}`,
      body: `body ${i}`,
      // Four rows share each millisecond to exercise the id tie-break.
      createdAt: new Date(now - Math.floor(i / 4) * baseMs),
    })),
  });
}

beforeAll(async () => {
  await prisma.$queryRaw`SELECT 1`;
});

afterAll(async () => {
  if (userIds.length > 0) {
    await prisma.notification.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  }
  await prisma.$disconnect();
});

describe("notifications cursor pagination [FR-045, PRD 7.1]", () => {
  it("walks every item exactly once across pages, newest first", async () => {
    const userId = await makeUser("pg-all");
    await seed(userId, 95, 60_000);

    const seen: string[] = [];
    let cursor: string | undefined;
    let pages = 0;
    for (;;) {
      const page = await notificationsService.list(userId, { cursor, limit: 10 });
      seen.push(...page.items.map((n) => n.id));
      pages++;
      if (!page.hasMore || !page.nextCursor) break;
      cursor = page.nextCursor;
      if (pages > 50) throw new Error("runaway pagination");
    }

    expect(seen).toHaveLength(95);
    expect(new Set(seen).size).toBe(95); // no duplicates
    expect(pages).toBe(10); // 95 items / 10 per page

    // Newest first.
    const created = await prisma.notification.findMany({
      where: { userId },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      select: { id: true },
    });
    expect(seen).toEqual(created.map((c) => c.id));
  });

  it("does not skip items that share the same timestamp", async () => {
    const userId = await makeUser("pg-ties");
    // 40 rows over only 3 distinct timestamps.
    const t0 = Date.now();
    await prisma.notification.createMany({
      data: Array.from({ length: 40 }, (_, i) => ({
        userId,
        type: "SHIFT_ASSIGNED" as const,
        title: `tie${i}`,
        body: "x",
        createdAt: new Date(t0 - (i % 3)),
      })),
    });

    const seen: string[] = [];
    let cursor: string | undefined;
    for (;;) {
      const page = await notificationsService.list(userId, { cursor, limit: 7 });
      seen.push(...page.items.map((n) => n.id));
      if (!page.hasMore || !page.nextCursor) break;
      cursor = page.nextCursor;
    }
    expect(seen).toHaveLength(40);
    expect(new Set(seen).size).toBe(40);
  });

  it("stays correct when new rows are inserted at the top mid-scroll", async () => {
    const userId = await makeUser("pg-insert");
    await seed(userId, 50, 60_000);

    const first = await notificationsService.list(userId, { limit: 10 });
    const firstIds = first.items.map((n) => n.id);

    // Three brand-new notifications arrive after page 1 was read.
    await prisma.notification.createMany({
      data: Array.from({ length: 3 }, (_, i) => ({
        userId,
        type: "SWAP_OFFERED" as const,
        title: `new${i}`,
        body: "x",
        createdAt: new Date(),
      })),
    });

    const second = await notificationsService.list(userId, {
      cursor: first.nextCursor ?? undefined,
      limit: 10,
    });
    const overlap = second.items.filter((n) => firstIds.includes(n.id));
    // The cursor is anchored below the last item seen, so page 2 has no repeat.
    expect(overlap).toHaveLength(0);
  });

  it("excludes notifications older than 90 days [FR-045]", async () => {
    const userId = await makeUser("pg-window");
    const old = new Date();
    old.setDate(old.getDate() - INBOX_WINDOW_DAYS - 5);
    await prisma.notification.create({
      data: { userId, type: "SCHEDULE_PUBLISHED", title: "old", body: "x", createdAt: old },
    });
    await prisma.notification.create({
      data: { userId, type: "SCHEDULE_PUBLISHED", title: "new", body: "x" },
    });

    const page = await notificationsService.list(userId, {});
    expect(page.items.map((n) => n.title)).toEqual(["new"]);
  });

  it("only marks the caller's own notification read [A-2]", async () => {
    const owner = await makeUser("pg-owner");
    const other = await makeUser("pg-other");
    const n = await prisma.notification.create({
      data: { userId: owner, type: "SWAP_RESOLVED", title: "mine", body: "x" },
    });

    await expect(
      notificationsService.markRead(other, n.id),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });

    await notificationsService.markRead(owner, n.id);
    const updated = await prisma.notification.findUniqueOrThrow({ where: { id: n.id } });
    expect(updated.readAt).not.toBeNull();
  });

  it("reports an unread count within the 90-day window [FR-045]", async () => {
    const userId = await makeUser("pg-unread");
    await prisma.notification.createMany({
      data: [
        { userId, type: "SCHEDULE_PUBLISHED", title: "a", body: "x" },
        { userId, type: "SCHEDULE_PUBLISHED", title: "b", body: "x", readAt: new Date() },
        { userId, type: "SCHEDULE_PUBLISHED", title: "c", body: "x" },
      ],
    });
    const page = await notificationsService.list(userId, {});
    expect(page.unreadCount).toBe(2);
  });
});
