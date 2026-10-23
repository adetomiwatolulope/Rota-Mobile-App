/**
 * modules/shifts/shifts.service.ts - Shift rules. [S-1]
 *
 * The only shift operation in this phase is permanent deletion of a DRAFT.
 * PRD 5.2 state table: "Drafts can be deleted permanently." Published shifts
 * are cancelled instead, so their history and acknowledgements remain.
 */
import { roleHasCapability } from "@rota/shared";
import { AppError, ErrorCode } from "../../lib/errors.js";
import type { MembershipContext } from "../../middleware/membership.js";
import { shiftsRepository } from "./shifts.repository.js";

export const shiftsService = {
  /**
   * FR-019 / A-3: only the Owner or a Manager may delete a draft shift. The
   * caller's role comes from the membership row, never the request. [A-1]
   */
  async deleteDraft(actor: MembershipContext, shiftId: string): Promise<void> {
    if (!roleHasCapability(actor.role, "deleteDraftShift")) {
      throw new AppError(
        ErrorCode.FORBIDDEN,
        403,
        "You do not have permission to perform this action",
      );
    }

    const shift = await shiftsRepository.findById(shiftId);
    // Same 404 for "missing" and "another business" so ids cannot be probed. [A-2]
    if (!shift || shift.businessId !== actor.businessId) {
      throw new AppError(ErrorCode.NOT_FOUND, 404, "Shift not found");
    }
    if (shift.status !== "DRAFT") {
      throw new AppError(
        ErrorCode.CONFLICT,
        409,
        "Only draft shifts can be deleted",
      );
    }

    const result = await shiftsRepository.deleteDraft(shiftId, actor.businessId);
    if (result.count === 0) {
      // The shift was published or deleted after the read. Never retry blindly.
      throw new AppError(ErrorCode.CONFLICT, 409, "Shift changed; reload and try again");
    }
  },
};
