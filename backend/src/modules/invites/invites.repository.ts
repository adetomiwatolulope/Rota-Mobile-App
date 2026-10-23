/**
 * modules/invites/invites.repository.ts — Data access for invites.
 * Only repositories import Prisma. [S-1]
 */
import { prisma } from "../../lib/prisma.js";
import type { Role } from "@prisma/client";

export const invitesRepository = {
  create(data: {
    businessId: string;
    invitedById: string;
    role: Role;
    email: string;
    positionIds: string[];
    tokenHash: string;
    codeHash: string;
    expiresAt: Date;
  }) {
    return prisma.invite.create({
      data: {
        businessId: data.businessId,
        invitedById: data.invitedById,
        role: data.role,
        email: data.email,
        positionIds: data.positionIds,
        tokenHash: data.tokenHash,
        codeHash: data.codeHash,
        expiresAt: data.expiresAt,
      },
    });
  },

  /** A live (unaccepted, unrevoked, unexpired) invite for an email in a business. */
  findLiveByEmail(businessId: string, email: string) {
    return prisma.invite.findFirst({
      where: {
        businessId,
        email,
        acceptedAt: null,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: "desc" },
    });
  },

  /** Pending invites for the members/invites list screen. [FR-008] */
  listPending(businessId: string) {
    return prisma.invite.findMany({
      where: { businessId, acceptedAt: null, revokedAt: null, expiresAt: { gt: new Date() } },
      select: {
        id: true,
        email: true,
        role: true,
        positionIds: true,
        expiresAt: true,
        createdAt: true,
        invitedBy: { select: { displayName: true } },
      },
      orderBy: { createdAt: "desc" },
    });
  },

  findById(inviteId: string) {
    return prisma.invite.findUnique({ where: { id: inviteId } });
  },

  /** Look up by the unique token hash. [P-1] */
  findByTokenHash(tokenHash: string) {
    return prisma.invite.findUnique({
      where: { tokenHash },
      include: {
        business: { select: { name: true } },
        invitedBy: { select: { displayName: true } },
      },
    });
  },

  /**
   * FR-007: increment wrong-code attempts atomically and lock on the 5th. One
   * conditional update; no read-then-write. [D-3]
   */
  incrementCodeAttempts(inviteId: string) {
    return prisma.invite.update({
      where: { id: inviteId },
      data: { codeAttempts: { increment: 1 } },
      select: { codeAttempts: true },
    });
  },

  /** Resend (FR-008): rotate the link token, code, and expiry. */
  rotateCredentials(
    inviteId: string,
    data: { tokenHash: string; codeHash: string; expiresAt: Date },
  ) {
    return prisma.invite.update({
      where: { id: inviteId },
      data: {
        tokenHash: data.tokenHash,
        codeHash: data.codeHash,
        expiresAt: data.expiresAt,
        codeAttempts: 0,
      },
    });
  },

  revoke(inviteId: string) {
    return prisma.invite.update({
      where: { id: inviteId },
      data: { revokedAt: new Date() },
    });
  },

  /**
   * FR-007: accept an invite. In ONE transaction mark it accepted, activate the
   * membership (reusing the existing row if the person was removed), open a
   * SeatPeriod, and write the audit row. [FR-010, M-9]
   */
  accept(data: {
    inviteId: string;
    businessId: string;
    userId: string;
    role: Role;
    displayName: string;
    positionIds: string[];
  }) {
    return prisma.$transaction(async (tx) => {
      await tx.invite.update({
        where: { id: data.inviteId },
        data: { acceptedAt: new Date(), acceptedByUserId: data.userId },
      });

      // Reuse the same membership row when a removed member returns. [FR-010]
      const membership = await tx.membership.upsert({
        where: {
          userId_businessId: {
            userId: data.userId,
            businessId: data.businessId,
          },
        },
        create: {
          userId: data.userId,
          businessId: data.businessId,
          role: data.role,
          status: "ACTIVE",
          displayName: data.displayName,
        },
        update: {
          role: data.role,
          status: "ACTIVE",
          displayName: data.displayName,
          activatedAt: new Date(),
          removedAt: null,
        },
      });

      // The email invite code proves the address, so it also verifies the
      // email and no second code is needed. [FR-001]
      await tx.user.updateMany({
        where: { id: data.userId, emailVerifiedAt: null },
        data: { emailVerifiedAt: new Date() },
      });

      if (data.positionIds.length > 0) {
        await tx.membershipPosition.createMany({
          data: data.positionIds.map((positionId) => ({
            membershipId: membership.id,
            positionId,
          })),
          skipDuplicates: true,
        });
      }

      // Open a SeatPeriod on activation. [M-9]
      await tx.seatPeriod.create({
        data: {
          businessId: data.businessId,
          membershipId: membership.id,
          startedAt: new Date(),
        },
      });

      await tx.auditLog.create({
        data: {
          businessId: data.businessId,
          actorId: membership.id,
          action: "INVITE_ACCEPTED",
          entityType: "Invite",
          entityId: data.inviteId,
          metadata: { role: data.role } as never,
        },
      });

      return membership;
    });
  },

  /** Position ids that exist and are not archived for a business. [FR-005] */
  validPositionIds(businessId: string, positionIds: string[]) {
    return prisma.position.findMany({
      where: { businessId, archivedAt: null, id: { in: positionIds } },
      select: { id: true },
    });
  },

  /** Existing ACTIVE membership for an email in a business, if any. [FR-006] */
  async findActiveMembershipByEmail(businessId: string, email: string) {
    return prisma.membership.findFirst({
      where: {
        businessId,
        status: "ACTIVE",
        user: { email },
      },
      select: { id: true },
    });
  },

  /** The current user by email, to link an accepted invite. [FR-007] */
  findUserByEmail(email: string) {
    return prisma.user.findUnique({
      where: { email },
      select: { id: true, name: true, emailVerifiedAt: true },
    });
  },
};
