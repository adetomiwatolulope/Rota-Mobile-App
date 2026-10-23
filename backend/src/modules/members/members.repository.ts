/**
 * modules/members/members.repository.ts — Data access for memberships.
 * Only repositories import Prisma. [S-1]
 */
import { prisma } from "../../lib/prisma.js";
import type { MembershipStatus, Role } from "@prisma/client";

export const membersRepository = {
  /** ACTIVE members of a business with role and positions. [FR] */
  listActive(businessId: string) {
    return prisma.membership.findMany({
      where: { businessId, status: "ACTIVE" },
      select: {
        id: true,
        userId: true,
        role: true,
        status: true,
        displayName: true,
        user: { select: { email: true } },
        positions: { select: { positionId: true } },
      },
      orderBy: [{ role: "asc" }, { displayName: "asc" }],
    });
  },

  findById(membershipId: string) {
    return prisma.membership.findUnique({
      where: { id: membershipId },
      select: {
        id: true,
        userId: true,
        businessId: true,
        role: true,
        status: true,
        displayName: true,
      },
    });
  },

  /** Count ACTIVE owners — used to protect the last Owner. [FR-009] */
  countActiveOwners(businessId: string) {
    return prisma.membership.count({
      where: { businessId, role: "OWNER", status: "ACTIVE" },
    });
  },

  updateRole(membershipId: string, role: Role) {
    return prisma.membership.update({
      where: { id: membershipId },
      data: { role },
    });
  },

  /**
   * FR-010: remove a member. Closes the open SeatPeriod and sets status REMOVED
   * in one transaction. Shifts/swaps/claims effects arrive with those features.
   */
  removeMember(membershipId: string) {
    return prisma.$transaction(async (tx) => {
      await tx.seatPeriod.updateMany({
        where: { membershipId, endedAt: null },
        data: { endedAt: new Date() },
      });
      return tx.membership.update({
        where: { id: membershipId },
        data: { status: "REMOVED" as MembershipStatus, removedAt: new Date() },
      });
    });
  },

  writeAudit(data: {
    businessId: string;
    actorId: string;
    action: string;
    entityId: string;
    metadata?: Record<string, unknown>;
  }) {
    return prisma.auditLog.create({
      data: {
        businessId: data.businessId,
        actorId: data.actorId,
        action: data.action,
        entityType: "Membership",
        entityId: data.entityId,
        metadata: data.metadata as never,
      },
    });
  },
};
