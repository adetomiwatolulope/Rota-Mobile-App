/**
 * modules/members/members.service.ts — Membership rules. [S-1]
 * FR-009: change a member between STAFF and MANAGER (Owner only).
 * FR-010: remove a member (Owner/Manager, with ownership protection).
 */
import { type Capability, type MemberSummary, roleHasCapability } from "@rota/shared";
import { AppError, ErrorCode } from "../../lib/errors.js";
import { membersRepository } from "./members.repository.js";
import type { MembershipContext } from "../../middleware/membership.js";

export const membersService = {
  /** List ACTIVE members. Reaching here means the caller is a member. [A-2] */
  async list(businessId: string): Promise<MemberSummary[]> {
    const rows = await membersRepository.listActive(businessId);
    return rows.map((row) => ({
      membershipId: row.id,
      userId: row.userId,
      displayName: row.displayName,
      email: row.user.email,
      role: row.role,
      status: row.status,
      positionIds: row.positions.map((p) => p.positionId),
    }));
  },

  /**
   * FR-009: Owner changes a member between STAFF and MANAGER. The Owner role is
   * never changeable in the MVP, and a Manager cannot change roles. The target
   * role is validated at the route (only MANAGER/STAFF).
   */
  async changeRole(
    actor: MembershipContext,
    targetMembershipId: string,
    newRole: "MANAGER" | "STAFF",
  ): Promise<void> {
    this.assertCapability(actor.role, "changeRoles");

    const target = await membersRepository.findById(targetMembershipId);
    if (!target || target.businessId !== actor.businessId || target.status !== "ACTIVE") {
      throw new AppError(ErrorCode.NOT_FOUND, 404, "Member not found");
    }

    // The Owner role cannot be changed in the MVP. [FR-009]
    if (target.role === "OWNER") {
      throw new AppError(
        ErrorCode.OWNER_PROTECTED,
        403,
        "The Owner role cannot be changed",
      );
    }

    await membersRepository.updateRole(targetMembershipId, newRole);
    await membersRepository.writeAudit({
      businessId: actor.businessId,
      actorId: actor.membershipId,
      action: "MEMBER_ROLE_CHANGED",
      entityId: targetMembershipId,
      metadata: { from: target.role, to: newRole },
    });
  },

  /**
   * FR-010: remove a member. Managers cannot remove Managers or the Owner.
   * The last Owner can never be removed. [FR-009, FR-010]
   */
  async remove(actor: MembershipContext, targetMembershipId: string): Promise<void> {
    const target = await membersRepository.findById(targetMembershipId);
    if (!target || target.businessId !== actor.businessId || target.status !== "ACTIVE") {
      throw new AppError(ErrorCode.NOT_FOUND, 404, "Member not found");
    }

    // The Owner cannot be removed by anyone in the MVP. [FR-010]
    if (target.role === "OWNER") {
      throw new AppError(
        ErrorCode.OWNER_PROTECTED,
        403,
        "The Owner cannot be removed",
      );
    }

    // Managers may remove Staff only; the Owner may remove Staff and Managers.
    const capability: Capability =
      target.role === "MANAGER" ? "removeManagers" : "removeStaff";
    this.assertCapability(actor.role, capability);

    await membersRepository.removeMember(targetMembershipId);
    await membersRepository.writeAudit({
      businessId: actor.businessId,
      actorId: actor.membershipId,
      action: "MEMBER_REMOVED",
      entityId: targetMembershipId,
      metadata: { role: target.role },
    });
  },

  assertCapability(role: MembershipContext["role"], capability: Capability): void {
    if (!roleHasCapability(role, capability)) {
      throw new AppError(
        ErrorCode.FORBIDDEN,
        403,
        "You do not have permission to perform this action",
      );
    }
  },
};
