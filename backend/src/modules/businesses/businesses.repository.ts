/**
 * modules/businesses/businesses.repository.ts — Data access for businesses.
 * Only repositories import Prisma. [S-1]
 */
import { prisma } from "../../lib/prisma.js";
import type { BusinessType, Currency, Role } from "@prisma/client";

export const businessesRepository = {
  /**
   * FR-004: create the business, its first Location, the Owner membership, and
   * the TRIALING subscription in ONE transaction.
   */
  createWithOwner(data: {
    name: string;
    type: BusinessType;
    countryCode: string;
    currency: Currency;
    locationName: string;
    timezone: string;
    ownerUserId: string;
    ownerDisplayName: string;
    trialEndsAt: Date;
    seatPriceMinor: number;
  }) {
    return prisma.$transaction(async (tx) => {
      const business = await tx.business.create({
        data: {
          name: data.name,
          type: data.type,
          countryCode: data.countryCode,
          currency: data.currency,
        },
      });

      await tx.location.create({
        data: {
          businessId: business.id,
          name: data.locationName,
          timezone: data.timezone,
        },
      });

      const membership = await tx.membership.create({
        data: {
          userId: data.ownerUserId,
          businessId: business.id,
          role: "OWNER",
          status: "ACTIVE",
          displayName: data.ownerDisplayName,
        },
      });

      // MVP-A creates the subscription row; MVP-B uses plans.
      await tx.subscription.create({
        data: {
          businessId: business.id,
          status: "TRIALING",
          currency: data.currency,
          seatPriceMinor: data.seatPriceMinor,
          trialEndsAt: data.trialEndsAt,
          planCode: "STARTER",
        } as any,
      });

      return { business, membership };
    });
  },

  /** All ACTIVE businesses the user belongs to, with the user's role. [FR-012] */
  async listForUser(userId: string) {
    const memberships = await prisma.membership.findMany({
      where: { userId, status: "ACTIVE", business: { deletedAt: null } },
      select: {
        role: true,
        business: {
          select: {
            id: true,
            name: true,
            type: true,
            countryCode: true,
            currency: true,
          },
        },
      },
      orderBy: { activatedAt: "asc" },
    });
    return memberships;
  },

  findById(businessId: string) {
    return prisma.business.findUnique({
      where: { id: businessId },
      include: { locations: true },
    });
  },

  /** The caller's role in a business (used to shape responses). [A-1] */
  async findRoleForUser(userId: string, businessId: string): Promise<Role | null> {
    const membership = await prisma.membership.findUnique({
      where: { userId_businessId: { userId, businessId } },
      select: { role: true, status: true },
    });
    if (!membership || membership.status !== "ACTIVE") return null;
    return membership.role;
  },
};
