/**
 * modules/invites/invites.service.ts — Invite rules. [S-1]
 * FR-006: invite by email, link + 6-digit code, expires 7 days, stored hashed.
 * FR-007: 5th wrong code locks; accept activates membership + SeatPeriod.
 * FR-008: revoke and resend (resend voids the old link + code).
 */
import {
  type Capability,
  type InvitePreview,
  type InviteSummary,
  roleHasCapability,
  type Role,
} from "@rota/shared";
import { AppError, ErrorCode } from "../../lib/errors.js";
import { INVITE_CODE_MAX_ATTEMPTS, INVITE_TTL_DAYS } from "../../lib/constants.js";
import { env } from "../../config/env.js";
import type { MembershipContext } from "../../middleware/membership.js";
import {
  hashToken,
  generateOpaqueToken,
  generate6DigitCode,
} from "../auth/auth.service.js";
import { prisma } from "../../lib/prisma.js";
import { invitesRepository } from "./invites.repository.js";
import { enqueueInviteEmail } from "../../jobs/queues.js";

export interface CreatedInvite {
  invite: InviteSummary;
  /** Plain link + code, returned once so the app can show/copy them. [FR-006] */
  token: string;
  code: string;
  link: string;
}

export const invitesService = {
  /**
   * FR-006: create an invite. Only a capable role may invite (Owner: Staff and
   * Manager; Manager: Staff only). Email is the channel. The link token and
   * code are generated here, stored hashed, and returned once in plain text.
   */
  async create(
    actor: MembershipContext,
    input: { email: string; role: Role; positionIds: string[] },
  ): Promise<CreatedInvite> {
    assertInviteCapability(actor.role, input.role);

    await assertEditableBusiness(actor);
    await assertNotAlreadyMember(actor.businessId, input.email);
    await assertPositionsExist(actor.businessId, input.positionIds);
    await assertSeatLimit(actor.businessId, input.role);

    // Void any earlier live invite for the same email before issuing a new one,
    // so a person always has exactly one valid code. [FR-008]
    const existing = await invitesRepository.findLiveByEmail(
      actor.businessId,
      input.email,
    );
    if (existing) {
      await invitesRepository.revoke(existing.id);
    }

    const token = generateOpaqueToken();
    const code = generate6DigitCode();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + INVITE_TTL_DAYS);

    const invite = await invitesRepository.create({
      businessId: actor.businessId,
      invitedById: actor.membershipId,
      role: input.role,
      email: input.email,
      positionIds: input.positionIds,
      tokenHash: hashToken(token),
      codeHash: hashToken(code),
      expiresAt,
    });

    const link = buildInviteLink(token);
    await enqueueInviteEmail({
      email: input.email,
      businessName: await businessNameOf(actor.businessId),
      invitedByName: await displayNameOf(actor.membershipId),
      role: input.role,
      code,
      link,
    });

    return {
      invite: toSummary(invite, await displayNameOf(actor.membershipId)),
      token,
      code,
      link,
    };
  },

  /** FR-008: pending invites for a business. Members may view. */
  async list(actor: MembershipContext): Promise<InviteSummary[]> {
    const rows = await invitesRepository.listPending(actor.businessId);
    return rows.map((row) => ({
      id: row.id,
      email: row.email,
      role: row.role,
      positionIds: row.positionIds,
      status: "PENDING" as const,
      expiresAt: row.expiresAt.toISOString(),
      createdAt: row.createdAt.toISOString(),
      invitedByName: row.invitedBy.displayName,
    }));
  },

  /** FR-008: resend rotates link + code and voids the old ones. */
  async resend(actor: MembershipContext, inviteId: string): Promise<CreatedInvite> {
    const invite = await invitesRepository.findById(inviteId);
    if (!invite || invite.businessId !== actor.businessId) {
      throw new AppError(ErrorCode.NOT_FOUND, 404, "Invite not found");
    }
    assertInviteCapability(actor.role, invite.role);
    if (invite.acceptedAt) {
      throw new AppError(ErrorCode.INVITE_ALREADY_ACCEPTED, 409, "Invite already accepted");
    }
    if (invite.revokedAt) {
      throw new AppError(ErrorCode.INVITE_REVOKED, 409, "Invite already revoked");
    }
    if (!invite.email) {
      throw new AppError(ErrorCode.NOT_FOUND, 404, "Invite has no email");
    }
    await assertEditableBusiness(actor);

    const token = generateOpaqueToken();
    const code = generate6DigitCode();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + INVITE_TTL_DAYS);

    const updated = await invitesRepository.rotateCredentials(inviteId, {
      tokenHash: hashToken(token),
      codeHash: hashToken(code),
      expiresAt,
    });

    const link = buildInviteLink(token);
    await enqueueInviteEmail({
      email: invite.email,
      businessName: await businessNameOf(actor.businessId),
      invitedByName: await displayNameOf(actor.membershipId),
      role: invite.role,
      code,
      link,
    });

    return {
      invite: toSummary(updated, await displayNameOf(actor.membershipId)),
      token,
      code,
      link,
    };
  },

  /** FR-008: revoke an invite so its link and code stop working. */
  async revoke(actor: MembershipContext, inviteId: string): Promise<void> {
    const invite = await invitesRepository.findById(inviteId);
    if (!invite || invite.businessId !== actor.businessId) {
      throw new AppError(ErrorCode.NOT_FOUND, 404, "Invite not found");
    }
    assertInviteCapability(actor.role, invite.role);
    if (invite.acceptedAt) {
      throw new AppError(ErrorCode.INVITE_ALREADY_ACCEPTED, 409, "Invite already accepted");
    }
    if (invite.revokedAt) return; // already revoked — idempotent
    await invitesRepository.revoke(inviteId);
  },

  /**
   * FR-006: preview an invite by link token, so the app can show the business
   * and role before the person signs up or signs in. Never reveals the code.
   */
  async preview(token: string): Promise<InvitePreview> {
    const invite = await invitesRepository.findByTokenHash(hashToken(token));
    if (!invite) {
      throw new AppError(ErrorCode.NOT_FOUND, 404, "Invite not found");
    }
    const valid =
      !invite.acceptedAt &&
      !invite.revokedAt &&
      invite.expiresAt.getTime() > Date.now();
    return {
      businessName: invite.business.name,
      role: invite.role,
      invitedByName: invite.invitedBy.displayName,
      valid,
    };
  },

  /**
   * FR-007: accept an invite with link token + 6-digit code. The signed-in
   * caller's email must match the invited email. The 5th wrong code locks the
   * invite. Acceptance activates the membership and opens a SeatPeriod.
   */
  async accept(
    userId: string,
    input: { token: string; code: string },
  ): Promise<{ businessId: string; role: Role }> {
    const invite = await invitesRepository.findByTokenHash(hashToken(input.token));
    if (!invite) {
      throw new AppError(ErrorCode.NOT_FOUND, 404, "Invite not found");
    }

    if (invite.acceptedAt) {
      throw new AppError(
        ErrorCode.INVITE_ALREADY_ACCEPTED,
        409,
        "This invite has already been used",
      );
    }
    if (invite.revokedAt) {
      throw new AppError(ErrorCode.INVITE_REVOKED, 409, "This invite was revoked");
    }
    if (invite.expiresAt.getTime() <= Date.now()) {
      throw new AppError(ErrorCode.INVITE_EXPIRED, 410, "This invite has expired");
    }
    // Already locked: more wrong codes than allowed. [FR-007, P-4]
    if (invite.codeAttempts > INVITE_CODE_MAX_ATTEMPTS) {
      throw new AppError(ErrorCode.INVITE_LOCKED, 403, "This invite is locked");
    }

    // The caller must be the invited person. [FR-007]
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.deletedAt) {
      throw new AppError(ErrorCode.NOT_FOUND, 404, "User not found");
    }
    if (!invite.email || user.email !== invite.email) {
      throw new AppError(
        ErrorCode.FORBIDDEN,
        403,
        "Sign in with the email address this invite was sent to",
      );
    }

    // Wrong code: count it atomically. The 5th wrong code locks the invite, so
    // 4 wrong codes are tolerated. [FR-007, P-4, D-3]
    if (hashToken(input.code) !== invite.codeHash) {
      const updated = await invitesRepository.incrementCodeAttempts(invite.id);
      if (updated.codeAttempts > INVITE_CODE_MAX_ATTEMPTS) {
        throw new AppError(ErrorCode.INVITE_LOCKED, 403, "This invite is locked");
      }
      throw new AppError(ErrorCode.CODE_INVALID, 400, "That code is not correct");
    }

    // Enforce seat limit on accept
    if (invite.role === "STAFF") {
      const { billingRepository } = await import("../billing/billing.repository.js");
      const sub = await billingRepository.findSubscription(invite.businessId);
      const planCode = sub?.planCode || "STARTER";
      const plan = await billingRepository.findPlanByCode(planCode) || (await billingRepository.findPlan("STARTER" as any));
      if (plan && plan.extraSeatPriceMinor === 0) {
        const billable = await billingRepository.countBillableOccupants(invite.businessId);
        const count = typeof billable[0].count === "bigint" ? Number(billable[0].count) : Number(billable[0].count);
        // current count includes this pending invite? countBillableOccupants includes pending; after accept pending becomes active, count same. If at limit, block
        if (count >= plan.includedSeats) {
          throw new AppError(ErrorCode.PLAN_SEAT_LIMIT, 409, "Seat limit reached for this plan");
        }
      }
    }

    await invitesRepository.accept({
      inviteId: invite.id,
      businessId: invite.businessId,
      userId: user.id,
      role: invite.role,
      displayName: user.name,
      positionIds: await validPositionIds(invite.businessId, invite.positionIds),
    });

    return { businessId: invite.businessId, role: invite.role };
  },
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Owner may invite Staff and Managers; Manager may invite Staff only. [FR-006] */
function assertInviteCapability(role: Role, invitedRole: Role): void {
  const capability: Capability =
    invitedRole === "OWNER" || invitedRole === "MANAGER"
      ? "inviteManagers"
      : "inviteStaff";
  // Inviting an Owner is never allowed in the MVP.
  if (invitedRole === "OWNER" || !roleHasCapability(role, capability)) {
    throw new AppError(
      ErrorCode.FORBIDDEN,
      403,
      "You do not have permission to send this invite",
    );
  }
}

/** A removed member's business might be gone; keep invites scoped and real. */
async function assertEditableBusiness(actor: MembershipContext): Promise<void> {
  const business = await prisma.business.findUnique({
    where: { id: actor.businessId },
    select: { id: true },
  });
  if (!business) {
    throw new AppError(ErrorCode.NOT_FOUND, 404, "Business not found");
  }
}

async function assertNotAlreadyMember(
  businessId: string,
  email: string,
): Promise<void> {
  const existing = await invitesRepository.findActiveMembershipByEmail(
    businessId,
    email,
  );
  if (existing) {
    throw new AppError(
      ErrorCode.CONFLICT,
      409,
      "That person is already a member of this business",
    );
  }
}

async function assertSeatLimit(businessId: string, invitedRole: Role): Promise<void> {
  if (invitedRole !== "STAFF") {
    return;
  }
  const { billingRepository } = await import("../billing/billing.repository.js");
  const { prisma } = await import("../../lib/prisma.js");
  const sub = await billingRepository.findSubscription(businessId);
  const planCode = sub?.planCode || "STARTER";
  const plan = await billingRepository.findPlanByCode(planCode) || (await billingRepository.findPlan("STARTER" as any));
  if (!plan) return;
  if (plan.extraSeatPriceMinor === 0) {
    const billable = await billingRepository.countBillableOccupants(businessId);
    // billable is bigint-like
    const count = typeof billable[0].count === "bigint" ? Number(billable[0].count) : Number(billable[0].count);
    if (count >= plan.includedSeats) {
      throw new AppError(ErrorCode.PLAN_SEAT_LIMIT, 409, "Seat limit reached for this plan");
    }
  }
}

async function assertPositionsExist(
  businessId: string,
  positionIds: string[],
): Promise<void> {
  if (positionIds.length === 0) return;
  const valid = await validPositionIds(businessId, positionIds);
  if (valid.length !== positionIds.length) {
    throw new AppError(
      ErrorCode.VALIDATION,
      400,
      "One or more positions are not part of this business",
    );
  }
}

async function validPositionIds(
  businessId: string,
  positionIds: string[],
): Promise<string[]> {
  if (positionIds.length === 0) return [];
  const valid = await invitesRepository.validPositionIds(businessId, positionIds);
  return valid.map((p) => p.id);
}

async function businessNameOf(businessId: string): Promise<string> {
  const business = await prisma.business.findUnique({
    where: { id: businessId },
    select: { name: true },
  });
  return business?.name ?? "a business";
}

async function displayNameOf(membershipId: string): Promise<string> {
  const membership = await prisma.membership.findUnique({
    where: { id: membershipId },
    select: { displayName: true },
  });
  return membership?.displayName ?? "A teammate";
}

/** The app deep-links to this; the API serves no HTML for it. [S-4] */
function buildInviteLink(token: string): string {
  const base = env.APP_LINK_BASE_URL || "rota://invite";
  return `${base.replace(/\/$/, "")}/${token}`;
}

function toSummary(
  invite: {
    id: string;
    email: string | null;
    role: Role;
    positionIds: string[];
    expiresAt: Date;
    createdAt: Date;
  },
  invitedByName: string,
): InviteSummary {
  return {
    id: invite.id,
    email: invite.email,
    role: invite.role,
    positionIds: invite.positionIds,
    status: "PENDING",
    expiresAt: invite.expiresAt.toISOString(),
    createdAt: invite.createdAt.toISOString(),
    invitedByName,
  };
}
