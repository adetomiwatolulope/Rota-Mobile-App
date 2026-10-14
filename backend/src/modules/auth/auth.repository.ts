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
  }) {
    return prisma.user.create({
      data: {
        email: data.email.toLowerCase(),
        passwordHash: data.passwordHash,
        name: data.name,
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

  consumeAuthCode(id: string) {
    return prisma.authCode.update({
      where: { id },
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

  /** Rotate: revoke old token and create a new one in a transaction. [P-2] */
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
      const newToken = await tx.refreshToken.create({ data: newTokenData });
      await tx.refreshToken.update({
        where: { id: oldId },
        data: { revokedAt: new Date(), replacedByTokenId: newToken.id },
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
