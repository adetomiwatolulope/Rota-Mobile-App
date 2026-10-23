/**
 * modules/auth/session.test.ts — Refresh rotation, reuse detection, logout-all,
 * and single-use password-reset codes. Runs against the real PostgreSQL database.
 *
 * Rules covered: P-2 (rotating refresh tokens, reuse revokes), FR-002 (logout),
 * FR-003 (single-use, expiring reset code, all sessions revoked on reset).
 */
import "dotenv/config";
import { afterAll, describe, expect, it } from "vitest";
import argon2 from "argon2";
import { authService, generateOpaqueToken, hashToken } from "./auth.service.js";
import { prisma } from "../../lib/prisma.js";
import { REFRESH_TOKEN_TTL_MS } from "../../lib/constants.js";

const runId = Date.now();
const createdEmails: string[] = [];

async function createUser(label: string) {
  const email = `session-${label}-${runId}@example.com`;
  createdEmails.push(email);
  const passwordHash = await argon2.hash(generateOpaqueToken());
  const user = await prisma.user.create({
    data: {
      email,
      passwordHash,
      name: "Session Tester",
      emailVerifiedAt: new Date(),
    },
  });
  const device = await prisma.device.create({
    data: { userId: user.id, deviceId: `device-${label}-${runId}`, trustedAt: new Date() },
  });
  return { user, device, email };
}

async function createRefreshToken(userId: string, deviceId: string) {
  const plain = generateOpaqueToken();
  const token = await prisma.refreshToken.create({
    data: {
      userId,
      deviceId,
      tokenHash: hashToken(plain),
      expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
    },
  });
  return { plain, token };
}

afterAll(async () => {
  await prisma.user.deleteMany({ where: { email: { in: createdEmails } } });
  await prisma.$disconnect();
});

describe("refresh token rotation [P-2]", () => {
  it("rotates the refresh token and links the old token to the new one [P-2]", async () => {
    const { user, device } = await createUser("rotate");
    const { plain, token } = await createRefreshToken(user.id, device.id);

    const next = await authService.refreshTokens(plain);
    expect(next.accessToken).toEqual(expect.any(String));
    expect(next.refreshToken).not.toBe(plain);

    const oldRow = await prisma.refreshToken.findUnique({ where: { id: token.id } });
    expect(oldRow?.revokedAt).not.toBeNull();
    expect(oldRow?.replacedByTokenId).not.toBeNull();

    const newRow = await prisma.refreshToken.findUnique({
      where: { tokenHash: hashToken(next.refreshToken) },
    });
    expect(newRow).not.toBeNull();
    expect(newRow?.revokedAt).toBeNull();
  });

  it("rejects reuse of a rotated token and revokes the chain [P-2]", async () => {
    const { user, device } = await createUser("reuse");
    const { plain } = await createRefreshToken(user.id, device.id);

    const next = await authService.refreshTokens(plain);

    await expect(authService.refreshTokens(plain)).rejects.toMatchObject({
      code: "TOKEN_REVOKED",
      httpStatus: 401,
    });

    // Reuse revokes every session, including the token issued by the rotation.
    const issued = await prisma.refreshToken.findUnique({
      where: { tokenHash: hashToken(next.refreshToken) },
    });
    expect(issued?.revokedAt).not.toBeNull();
  });

  it("rejects a refresh token that has expired [P-2]", async () => {
    const { user, device } = await createUser("expired");
    const plain = generateOpaqueToken();
    await prisma.refreshToken.create({
      data: {
        userId: user.id,
        deviceId: device.id,
        tokenHash: hashToken(plain),
        expiresAt: new Date(Date.now() - 1000),
      },
    });

    await expect(authService.refreshTokens(plain)).rejects.toMatchObject({
      httpStatus: 401,
    });
  });
});

describe("logout [FR-002]", () => {
  it("revokes only the calling session on logout", async () => {
    const { user, device } = await createUser("logout");
    const first = await createRefreshToken(user.id, device.id);
    const second = await createRefreshToken(user.id, device.id);

    await authService.logout(first.token.id);

    const rows = await prisma.refreshToken.findMany({
      where: { id: { in: [first.token.id, second.token.id] } },
    });
    expect(rows.find((r) => r.id === first.token.id)?.revokedAt).not.toBeNull();
    expect(rows.find((r) => r.id === second.token.id)?.revokedAt).toBeNull();
  });

  it("log out of all devices revokes every refresh token [FR-002]", async () => {
    const { user, device } = await createUser("logout-all");
    const first = await createRefreshToken(user.id, device.id);
    const second = await createRefreshToken(user.id, device.id);

    await authService.logoutAll(user.id);

    const rows = await prisma.refreshToken.findMany({
      where: { id: { in: [first.token.id, second.token.id] } },
    });
    expect(rows.every((r) => r.revokedAt !== null)).toBe(true);
  });
});

describe("password reset [FR-003]", () => {
  it("issues a single-use reset code and revokes every session on success", async () => {
    const { user, device, email } = await createUser("reset");
    const session = await createRefreshToken(user.id, device.id);

    const requested = await authService.requestPasswordReset(email);
    expect(requested.resetCodeForEmail).toMatch(/^\d{6}$/);

    await authService.resetPassword({
      email,
      code: requested.resetCodeForEmail!,
      newPassword: "A-strong-new-password-1",
    });

    const revoked = await prisma.refreshToken.findUnique({
      where: { id: session.token.id },
    });
    expect(revoked?.revokedAt).not.toBeNull();

    await expect(
      authService.resetPassword({
        email,
        code: requested.resetCodeForEmail!,
        newPassword: "Another-strong-password-2",
      }),
    ).rejects.toMatchObject({ httpStatus: 400 });
  });

  it("rejects an expired reset code [FR-003]", async () => {
    const { user, email } = await createUser("reset-expired");
    await prisma.authCode.create({
      data: {
        userId: user.id,
        email,
        purpose: "PASSWORD_RESET",
        codeHash: hashToken("123456"),
        expiresAt: new Date(Date.now() - 1000),
      },
    });

    await expect(
      authService.resetPassword({
        email,
        code: "123456",
        newPassword: "A-strong-new-password-1",
      }),
    ).rejects.toMatchObject({ httpStatus: 400 });
  });
});
