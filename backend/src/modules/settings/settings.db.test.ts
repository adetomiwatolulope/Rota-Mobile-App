import "dotenv/config";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "../../lib/prisma.js";
import { AppError } from "../../lib/errors.js";
import { settingsService } from "./settings.service.js";

/**
 * Requirement 7: settings live on the server, are created on first read, and
 * reject a stale write so the most recent change wins.
 */
describe("Requirement 7 settings coordination", () => {
  const userIds: string[] = [];

  async function makeUser(prefix: string): Promise<string> {
    const user = await prisma.user.create({
      data: {
        email: `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}@test.local`,
        passwordHash: "x",
        name: `${prefix} User`,
      },
    });
    userIds.push(user.id);
    return user.id;
  }

  beforeAll(async () => {
    await prisma.$queryRaw`SELECT 1`;
  });

  afterAll(async () => {
    if (userIds.length > 0) {
      await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    }
  });

  it("creates a default row on first read with server defaults", async () => {
    const userId = await makeUser("settings-default");
    const settings = await settingsService.get(userId);
    expect(settings.timezone).toBe("Africa/Lagos");
    expect(settings.language).toBe("en");
    expect(settings.theme).toBe("system");
    expect(settings.quietHoursEnabled).toBe(false);
    expect(settings.shiftChanges).toBe(true);
    expect(settings.updatedAt).toBeInstanceOf(Date);
  });

  it("persists a patch and advances the server updatedAt", async () => {
    const userId = await makeUser("settings-update");
    const first = await settingsService.get(userId);
    const updated = await settingsService.update(userId, {
      quietHoursEnabled: true,
      quietHoursStart: 22 * 60,
      quietHoursEnd: 6 * 60,
      timezone: "Africa/Lagos",
    });
    expect(updated.quietHoursEnabled).toBe(true);
    expect(updated.quietHoursStart).toBe(1320);
    expect(updated.quietHoursEnd).toBe(360);
    expect(updated.updatedAt.getTime()).toBeGreaterThanOrEqual(first.updatedAt.getTime());
  });

  it("rejects a stale write with 409 so the newest change wins", async () => {
    const userId = await makeUser("settings-conflict");
    await settingsService.get(userId);
    await new Promise((resolve) => setTimeout(resolve, 1100));
    await settingsService.update(userId, { swaps: false });

    await expect(
      settingsService.update(userId, {
        swaps: true,
        updatedAt: new Date(Date.now() - 60_000).toISOString(),
      }),
    ).rejects.toBeInstanceOf(AppError);

    const stored = await settingsService.get(userId);
    expect(stored.swaps).toBe(false);
  });
});
