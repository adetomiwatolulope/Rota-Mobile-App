/**
 * modules/businesses/businesses.service.ts — Business rules. [S-1]
 * FR-004: create a business; FR-012: belong to more than one business.
 */
import type { Role } from "@prisma/client";
import {
  createBusinessSchema,
  type BusinessSummary,
  type CreateBusinessInput,
} from "@rota/shared";
import { AppError, ErrorCode } from "../../lib/errors.js";
import { env } from "../../config/env.js";
import { TRIAL_DURATION_DAYS } from "../../lib/constants.js";
import { prisma } from "../../lib/prisma.js";
import { businessesRepository } from "./businesses.repository.js";

export const businessesService = {
  /**
   * FR-004: create the business, location, Owner membership, and TRIALING
   * subscription in one transaction. The creator is always the Owner. The
   * userId comes from the verified session, never the client body. [A-1]
   */
  async create(userId: string, input: CreateBusinessInput) {
    const data = createBusinessSchema.parse(input);

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.deletedAt) {
      throw new AppError(ErrorCode.NOT_FOUND, 404, "User not found");
    }

    const trialEndsAt = new Date();
    trialEndsAt.setDate(trialEndsAt.getDate() + TRIAL_DURATION_DAYS);

    const { business } = await businessesRepository.createWithOwner({
      name: data.name,
      type: data.type,
      countryCode: data.countryCode,
      currency: "NGN",
      locationName: data.locationName,
      timezone: data.timezone,
      ownerUserId: userId,
      ownerDisplayName: user.name,
      trialEndsAt,
      // M-6: never invent a price. MVP-A stores whatever SEAT_PRICE is (0 when
      // unset, which is the owner's MVP-A default) and enforces nothing. [X-6]
      seatPriceMinor: env.SEAT_PRICE,
    });

    return {
      id: business.id,
      name: business.name,
      type: business.type,
      countryCode: business.countryCode,
      // M-3: MVP always transacts in NGN; USD stays in the enum, unused.
      currency: "NGN" as const,
      role: "OWNER" as Role,
    } satisfies BusinessSummary;
  },

  /** FR-012: businesses the caller belongs to. Scoped to the caller. */
  async listForUser(userId: string): Promise<BusinessSummary[]> {
    const rows = await businessesRepository.listForUser(userId);
    return rows.map((row) => ({
      id: row.business.id,
      name: row.business.name,
      type: row.business.type as BusinessSummary["type"],
      countryCode: row.business.countryCode,
      currency: "NGN" as const,
      role: row.role,
    }));
  },

  /**
   * Get one business. Authorization is enforced by requireMembership before the
   * service runs, so reaching here means the caller is an ACTIVE member. [A-2]
   */
  async get(businessId: string, role: Role) {
    const business = await businessesRepository.findById(businessId);
    if (!business) {
      throw new AppError(ErrorCode.NOT_FOUND, 404, "Business not found");
    }
    return {
      id: business.id,
      name: business.name,
      type: business.type,
      countryCode: business.countryCode,
      currency: business.currency,
      role,
      locations: business.locations.map((l) => ({
        id: l.id,
        name: l.name,
        timezone: l.timezone,
      })),
    };
  },
};
