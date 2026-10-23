/**
 * modules/auth/auth.repository.ts — Data access for auth domain.
 * Only this file (and other *.repository.ts files) import Prisma. [S-1]
 */
import { prisma } from "../../lib/prisma.js";
import type { AuthCodePurpose } from "@prisma/client";

export const authRepository = {
  /** Find a user by email (lowercase). Soft-deleted users are excluded by the Prisma extension. */
  findUserByEmail(email: string) {
    return prisma.user.findFirst({ where: { email: email.toLowerCase() } });
  },

  findUserById(id: string) {
    return prisma.user.findUnique({ where: { id } });
  },

  createUser(data: {
    email: string;
    passwordHash: string;
    name: string;
    emailVerifiedAt?: Date;
  }) {
    return prisma.user.create({
      data: {
        email: data.email.toLowerCase(),
        passwordHash: data.passwordHash,
        name: data.name,
        emailVerifiedAt: data.emailVerifiedAt,
      },
    });
  },

  /** Find the most recent unconsumed, unexpired auth code for email+purpose. */
  findActiveAuthCode(email: string, purpose: AuthCodePurpose) {
    return prisma.authCode.findFirst({
      where: {
        email: email.toLowerCase(),
        purpose,
        consumedAt: null,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: "desc" },
    });
  },

  findAuthCodeById(id: string) {
    return prisma.authCode.findUnique({ where: { id } });
  },

  createAuthCode(data: {
    userId?: string;
    email: string;
    purpose: AuthCodePurpose;
    codeHash: string;
    expiresAt: Date;
  }) {
    return prisma.authCode.create({ data });
  },

  incrementAuthCodeAttempts(id: string) {
    return prisma.authCode.update({
      where: { id },
      data: { attempts: { increment: 1 } },
    });
  },

  /**
   * Consume a code exactly once. Returns the number of rows changed so the
   * caller can reject a code that another request consumed first. [P-4]
   */
  consumeAuthCode(id: string) {
    return prisma.authCode.updateMany({
      where: { id, consumedAt: null },
      data: { consumedAt: new Date() },
    });
  },

  /**
   * Void earlier live codes for the same email and purpose before issuing a new
   * one, so only the most recent code can ever be used. [FR-001, FR-003]
   */
  invalidateActiveAuthCodes(email: string, purpose: AuthCodePurpose) {
    return prisma.authCode.updateMany({
      where: {
        email: email.toLowerCase(),
        purpose,
        consumedAt: null,
        expiresAt: { gt: new Date() },
      },
      data: { consumedAt: new Date() },
    });
  },

  markEmailVerified(userId: string) {
    return prisma.user.update({
      where: { id: userId },
      data: { emailVerifiedAt: new Date() },
    });
  },

  createRefreshToken(data: {
    userId: string;
    tokenHash: string;
    deviceId?: string;
    deviceLabel?: string;
    expiresAt: Date;
  }) {
    return prisma.refreshToken.create({ data });
  },

  findRefreshToken(tokenHash: string) {
    return prisma.refreshToken.findUnique({ where: { tokenHash } });
  },

  revokeRefreshToken(id: string) {
    return prisma.refreshToken.update({
      where: { id },
      data: { revokedAt: new Date() },
    });
  },

  /**
   * Rotate: consume the old token and create the new one in one transaction.
   * The conditional update makes reuse detection atomic: if another request
   * already rotated (or revoked) the token, no row changes and this returns
   * null so the caller can reject the reused token. [P-2, D-3]
   */
  async rotateRefreshToken(
    oldId: string,
    newTokenData: {
      userId: string;
      tokenHash: string;
      deviceId?: string;
      expiresAt: Date;
    },
  ) {
    return prisma.$transaction(async (tx) => {
      const consumed = await tx.refreshToken.updateMany({
        where: { id: oldId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      if (consumed.count === 0) return null;

      const newToken = await tx.refreshToken.create({ data: newTokenData });
      await tx.refreshToken.update({
        where: { id: oldId },
        data: { replacedByTokenId: newToken.id },
      });
      return newToken;
    });
  },

  /** Revoke all refresh tokens for a user (password reset, logout all). [FR-003] */
  revokeAllUserRefreshTokens(userId: string) {
    return prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  },

  /** Find or create a Device row. Sets trustedAt when code is valid. [FR-002, P-3] */
  findDevice(userId: string, deviceId: string) {
    return prisma.device.findUnique({ where: { userId_deviceId: { userId, deviceId } } });
  },

  upsertDevice(data: { userId: string; deviceId: string; label?: string }) {
    return prisma.device.upsert({
      where: { userId_deviceId: { userId: data.userId, deviceId: data.deviceId } },
      create: { userId: data.userId, deviceId: data.deviceId, label: data.label },
      update: { lastSeenAt: new Date(), label: data.label ?? undefined },
    });
  },

  trustDevice(userId: string, deviceId: string) {
    return prisma.device.update({
      where: { userId_deviceId: { userId, deviceId } },
      data: { trustedAt: new Date(), lastSeenAt: new Date() },
    });
  },

  updatePassword(userId: string, passwordHash: string) {
    return prisma.user.update({ where: { id: userId }, data: { passwordHash } });
  },
};
