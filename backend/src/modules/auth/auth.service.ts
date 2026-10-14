/**
 * modules/auth/auth.service.ts — Business rules for auth. [S-1]
 * All auth logic lives here; routes stay thin. Never import Prisma directly.
 *
 * Rules enforced:
 *   P-1 — passwords hashed with argon2id; codes/tokens stored hashed
 *   P-2 — 15-min access tokens, 30-day rotating refresh tokens
 *   P-3 — device trust via trustedAt
 *   P-4 — code limits: 5 attempts (6th invalidates) [FR-001], 7-day invite lock [FR-007]
 *   FR-001, FR-002, FR-003
 */
import argon2 from "argon2";
import crypto from "node:crypto";
import jwt from "jsonwebtoken";
import { env } from "../../config/env.js";
import { AppError, ErrorCode } from "../../lib/errors.js";
import {
  AUTH_CODE_TTL_MS,
  AUTH_CODE_MAX_ATTEMPTS,
  ACCESS_TOKEN_TTL,
  REFRESH_TOKEN_TTL_MS,
} from "../../lib/constants.js";
import { authRepository } from "./auth.repository.js";

type SessionPayload = { userId: string; sessionId: string };

/** Hash a password with argon2id. [P-1] */
async function hashPassword(password: string): Promise<string> {
  return argon2.hash(password, { type: argon2.argon2id });
}

/** Verify password against stored hash. [P-1] */
async function verifyPassword(hash: string, plain: string): Promise<boolean> {
  return argon2.verify(hash, plain);
}

/** Hash an opaque token (codes, refresh tokens) with SHA-256. [P-1] */
function hashToken(plain: string): string {
  return crypto.createHash("sha256").update(plain).digest("hex");
}

/** Generate a random opaque token of `byteLength` bytes, hex-encoded. */
function generateOpaqueToken(byteLength = 32): string {
  return crypto.randomBytes(byteLength).toString("hex");
}

/** Generate a random 6-digit code as a string. */
function generate6DigitCode(): string {
  // Generates a number in [0, 999999] and zero-pads to 6 digits
  const n = crypto.randomInt(0, 1_000_000);
  return n.toString().padStart(6, "0");
}

/** Sign a 15-minute access JWT. [P-2] */
function signAccessToken(payload: SessionPayload): string {
  return jwt.sign(payload, env.JWT_SECRET, { expiresIn: ACCESS_TOKEN_TTL });
}

/** Issue both tokens. Returns plain refresh token for client; stores hashed. [P-2] */
async function issueTokenPair(
  userId: string,
  deviceId?: string,
): Promise<{ accessToken: string; refreshToken: string; sessionId: string }> {
  const plainRefresh = generateOpaqueToken();
  const tokenHash = hashToken(plainRefresh);
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_MS);

  const stored = await authRepository.createRefreshToken({
    userId,
    tokenHash,
    deviceId,
    expiresAt,
  });

  const accessToken = signAccessToken({ userId, sessionId: stored.id });

  return { accessToken, refreshToken: plainRefresh, sessionId: stored.id };
}

export const authService = {
  /** FR-001: Register with email, password (≥10 chars), and name. */
  async register(data: {
    email: string;
    password: string;
    name: string;
    deviceId: string;
  }) {
    if (data.password.length < 10) {
      throw new AppError(
        ErrorCode.VALIDATION,
        400,
        "Password must be at least 10 characters",
      );
    }

    const existing = await authRepository.findUserByEmail(data.email);
    if (existing) {
      throw new AppError(ErrorCode.CONFLICT, 409, "Email already registered");
    }

    const passwordHash = await hashPassword(data.password);
    const user = await authRepository.createUser({
      email: data.email,
      passwordHash,
      name: data.name,
    });

    // Register device (not trusted yet — trust requires email verification + device code)
    await authRepository.upsertDevice({ userId: user.id, deviceId: data.deviceId });

    // Send email verification code
    const code = generate6DigitCode();
    const expiresAt = new Date(Date.now() + AUTH_CODE_TTL_MS);
    await authRepository.createAuthCode({
      userId: user.id,
      email: data.email.toLowerCase(),
      purpose: "VERIFY_EMAIL",
      codeHash: hashToken(code),
      expiresAt,
    });

    // In production the email provider sends the code; here we return it for
    // the provider to forward. The route must not log it. [P-5]
    return { userId: user.id, verificationCodeForEmail: code };
  },

  /** FR-001: Verify email with a 6-digit code. 6th wrong attempt invalidates. */
  async verifyEmail(data: { email: string; code: string; deviceId: string }) {
    const record = await authRepository.findActiveAuthCode(
      data.email,
      "VERIFY_EMAIL",
    );

    if (!record) {
      throw new AppError(ErrorCode.CODE_EXPIRED, 400, "No active verification code");
    }

    // 6th attempt invalidates by consuming the code [FR-001, P-4]
    if (record.attempts >= AUTH_CODE_MAX_ATTEMPTS) {
      await authRepository.consumeAuthCode(record.id);
      throw new AppError(ErrorCode.CODE_LOCKED, 400, "Too many attempts. Request a new code.");
    }

    const match = record.codeHash === hashToken(data.code);
    if (!match) {
      await authRepository.incrementAuthCodeAttempts(record.id);
      const attemptsLeft = AUTH_CODE_MAX_ATTEMPTS - record.attempts - 1;
      throw new AppError(
        ErrorCode.CODE_INVALID,
        400,
        `Invalid code. ${attemptsLeft} attempt${attemptsLeft === 1 ? "" : "s"} remaining.`,
      );
    }

    await authRepository.consumeAuthCode(record.id);
    if (record.userId) {
      await authRepository.markEmailVerified(record.userId);
      await authRepository.trustDevice(record.userId, data.deviceId);
    }

    return { verified: true };
  },

  /** FR-002: Login. Unknown device requires device verification before tokens are issued. */
  async login(data: {
    email: string;
    password: string;
    deviceId: string;
  }) {
    const user = await authRepository.findUserByEmail(data.email);
    if (!user) {
      // Constant-time: still run argon even if user not found
      await argon2.hash("dummy_to_prevent_timing_attack");
      throw new AppError(ErrorCode.UNAUTHORIZED, 401, "Invalid credentials");
    }

    const valid = await verifyPassword(user.passwordHash, data.password);
    if (!valid) {
      throw new AppError(ErrorCode.UNAUTHORIZED, 401, "Invalid credentials");
    }

    if (!user.emailVerifiedAt) {
      throw new AppError(
        ErrorCode.EMAIL_NOT_VERIFIED,
        403,
        "Email not verified. Check your inbox.",
      );
    }

    // Check device trust [P-3, FR-002]
    const device = await authRepository.findDevice(user.id, data.deviceId);
    const isTrusted = Boolean(device?.trustedAt);

    if (!isTrusted) {
      // Upsert device row but do NOT trust it yet — issue a new-device code
      await authRepository.upsertDevice({ userId: user.id, deviceId: data.deviceId });

      const code = generate6DigitCode();
      const expiresAt = new Date(Date.now() + AUTH_CODE_TTL_MS);
      await authRepository.createAuthCode({
        userId: user.id,
        email: user.email,
        purpose: "LOGIN_NEW_DEVICE",
        codeHash: hashToken(code),
        expiresAt,
      });

      return {
        requiresDeviceVerification: true as const,
        deviceCodeForEmail: code,
      };
    }

    // Known trusted device — issue tokens
    const tokens = await issueTokenPair(user.id, device?.id);
    return { requiresDeviceVerification: false as const, ...tokens };
  },

  /** FR-002: Verify new-device code after login. Sets trustedAt and issues tokens. */
  async verifyDevice(data: {
    email: string;
    code: string;
    deviceId: string;
  }) {
    const user = await authRepository.findUserByEmail(data.email);
    if (!user) {
      throw new AppError(ErrorCode.UNAUTHORIZED, 401, "User not found");
    }

    const record = await authRepository.findActiveAuthCode(
      data.email,
      "LOGIN_NEW_DEVICE",
    );

    if (!record) {
      throw new AppError(ErrorCode.CODE_EXPIRED, 400, "No active device code");
    }

    if (record.attempts >= AUTH_CODE_MAX_ATTEMPTS) {
      await authRepository.consumeAuthCode(record.id);
      throw new AppError(ErrorCode.CODE_LOCKED, 400, "Too many attempts. Request a new code.");
    }

    const match = record.codeHash === hashToken(data.code);
    if (!match) {
      await authRepository.incrementAuthCodeAttempts(record.id);
      throw new AppError(ErrorCode.CODE_INVALID, 400, "Invalid code");
    }

    await authRepository.consumeAuthCode(record.id);
    await authRepository.trustDevice(user.id, data.deviceId);

    const device = await authRepository.findDevice(user.id, data.deviceId);
    const tokens = await issueTokenPair(user.id, device?.id ?? undefined);
    return tokens;
  },

  /** FR-002: Rotate refresh token. Reuse of a rotated token revokes the session. [P-2] */
  async refreshTokens(plainRefreshToken: string) {
    const tokenHash = hashToken(plainRefreshToken);
    const stored = await authRepository.findRefreshToken(tokenHash);

    if (!stored) {
      throw new AppError(ErrorCode.UNAUTHORIZED, 401, "Invalid refresh token");
    }

    // Detect reuse of a rotated token — revoke entire session [P-2]
    if (stored.revokedAt) {
      await authRepository.revokeAllUserRefreshTokens(stored.userId);
      throw new AppError(
        ErrorCode.TOKEN_REVOKED,
        401,
        "Token reuse detected. All sessions revoked.",
      );
    }

    if (stored.expiresAt < new Date()) {
      throw new AppError(ErrorCode.UNAUTHORIZED, 401, "Refresh token expired");
    }

    const plainNew = generateOpaqueToken();
    const newHash = hashToken(plainNew);
    const expiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_MS);

    const newToken = await authRepository.rotateRefreshToken(stored.id, {
      userId: stored.userId,
      tokenHash: newHash,
      deviceId: stored.deviceId ?? undefined,
      expiresAt,
    });

    const accessToken = signAccessToken({
      userId: stored.userId,
      sessionId: newToken.id,
    });

    return { accessToken, refreshToken: plainNew };
  },

  /** FR-002: Logout — revoke current refresh token. */
  async logout(sessionId: string) {
    await authRepository.revokeRefreshToken(sessionId);
  },

  /** FR-003: Request password-reset code. */
  async requestPasswordReset(email: string) {
    const user = await authRepository.findUserByEmail(email);
    // Always return 200 to prevent user enumeration
    if (!user) return { codeSentIfExists: true };

    const code = generate6DigitCode();
    const expiresAt = new Date(Date.now() + AUTH_CODE_TTL_MS);
    await authRepository.createAuthCode({
      userId: user.id,
      email: user.email,
      purpose: "PASSWORD_RESET",
      codeHash: hashToken(code),
      expiresAt,
    });

    return { codeSentIfExists: true, resetCodeForEmail: code };
  },

  /** FR-003: Complete password reset and revoke all sessions. */
  async resetPassword(data: {
    email: string;
    code: string;
    newPassword: string;
  }) {
    if (data.newPassword.length < 10) {
      throw new AppError(
        ErrorCode.VALIDATION,
        400,
        "Password must be at least 10 characters",
      );
    }

    const record = await authRepository.findActiveAuthCode(
      data.email,
      "PASSWORD_RESET",
    );

    if (!record) {
      throw new AppError(ErrorCode.CODE_EXPIRED, 400, "No active reset code");
    }

    if (record.attempts >= AUTH_CODE_MAX_ATTEMPTS) {
      await authRepository.consumeAuthCode(record.id);
      throw new AppError(ErrorCode.CODE_LOCKED, 400, "Too many attempts");
    }

    if (record.codeHash !== hashToken(data.code)) {
      await authRepository.incrementAuthCodeAttempts(record.id);
      throw new AppError(ErrorCode.CODE_INVALID, 400, "Invalid code");
    }

    if (!record.userId) {
      throw new AppError(ErrorCode.NOT_FOUND, 404, "User not found");
    }

    await authRepository.consumeAuthCode(record.id);
    const passwordHash = await hashPassword(data.newPassword);
    await authRepository.updatePassword(record.userId, passwordHash);
    // Revoke all sessions after password reset [FR-003]
    await authRepository.revokeAllUserRefreshTokens(record.userId);

    return { success: true };
  },

  /** GET /v1/me — return caller's user profile (no sensitive fields). */
  async getMe(userId: string) {
    const user = await authRepository.findUserById(userId);
    if (!user || user.deletedAt) {
      throw new AppError(ErrorCode.NOT_FOUND, 404, "User not found");
    }
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      emailVerifiedAt: user.emailVerifiedAt,
      createdAt: user.createdAt,
    };
  },
};
