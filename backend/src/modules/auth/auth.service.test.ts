/**
 * modules/auth/auth.service.test.ts — Google sign-in against a real database.
 * Owner-approved PRD deviation (Google OAuth is not in the PRD).
 *
 * Prisma is never mocked [Testing-standard]: every test runs against the real
 * Postgres. Only Google's remote verification is stubbed through the service's
 * dependency seam — that is an external network call, not our data layer.
 */
import "dotenv/config";
import { describe, expect, it, afterAll } from "vitest";
import { authService } from "./auth.service.js";
import { prisma } from "../../lib/prisma.js";
import { AppError } from "../../lib/errors.js";
import type { GoogleIdentity } from "../../providers/identity/google/index.js";

const runId = Date.now();
const createdEmails: string[] = [];

const identity = (email: string, emailVerified = true): GoogleIdentity => ({
  email,
  name: "Google Tester",
  emailVerified,
});

const stubGoogle = (value: GoogleIdentity) => ({
  verifyGoogleIdToken: async () => value,
});

afterAll(async () => {
  await prisma.user.deleteMany({ where: { email: { in: createdEmails } } });
  await prisma.$disconnect();
});

describe("authService.signInWithGoogle", () => {
  it("creates a verified user and trusts the device on first sign-in [FR-001, P-3]", async () => {
    const email = `google-first-${runId}@example.com`;
    createdEmails.push(email);

    const tokens = await authService.signInWithGoogle(
      { idToken: "stub-token", deviceId: `device-${runId}-a` },
      stubGoogle(identity(email)),
    );

    expect(tokens.accessToken).toEqual(expect.any(String));
    expect(tokens.refreshToken).toEqual(expect.any(String));

    const user = await prisma.user.findUnique({ where: { email } });
    expect(user).not.toBeNull();
    expect(user?.emailVerifiedAt).not.toBeNull();

    const device = await prisma.device.findUnique({
      where: {
        userId_deviceId: { userId: user!.id, deviceId: `device-${runId}-a` },
      },
    });
    expect(device?.trustedAt).not.toBeNull();
  });

  it("reuses the same user on a second sign-in instead of duplicating [FR-001]", async () => {
    const email = `google-repeat-${runId}@example.com`;
    createdEmails.push(email);

    await authService.signInWithGoogle(
      { idToken: "stub-token", deviceId: `device-${runId}-b` },
      stubGoogle(identity(email)),
    );
    await authService.signInWithGoogle(
      { idToken: "stub-token", deviceId: `device-${runId}-b` },
      stubGoogle(identity(email)),
    );

    const users = await prisma.user.findMany({ where: { email } });
    expect(users).toHaveLength(1);
  });

  it("rejects a Google account whose email is not verified [P-3]", async () => {
    const email = `google-unverified-${runId}@example.com`;

    await expect(
      authService.signInWithGoogle(
        { idToken: "stub-token", deviceId: `device-${runId}-c` },
        stubGoogle(identity(email, false)),
      ),
    ).rejects.toMatchObject({ httpStatus: 401 });
  });

  it("keeps password login impossible for Google-created users [L-4]", async () => {
    const email = `google-nopassword-${runId}@example.com`;
    createdEmails.push(email);

    await authService.signInWithGoogle(
      { idToken: "stub-token", deviceId: `device-${runId}-d` },
      stubGoogle(identity(email)),
    );

    // The locked schema keeps passwordHash non-null, so Google-created users
    // carry a hash of a random pre-image nobody knows. [L-4]
    await expect(
      authService.login({ email, password: "guessing1234", deviceId: `device-${runId}-d` }),
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("surfaces the provider's 503 when GOOGLE_CLIENT_ID is not configured", async () => {
    const email = `google-unconfigured-${runId}@example.com`;
    const failing = {
      verifyGoogleIdToken: async () => {
        throw new AppError("UNAUTHORIZED", 503, "Google sign-in is not configured on this server");
      },
    };

    await expect(
      authService.signInWithGoogle({ idToken: "stub-token", deviceId: `device-${runId}-e` }, failing),
    ).rejects.toMatchObject({ httpStatus: 503 });
  });
});
