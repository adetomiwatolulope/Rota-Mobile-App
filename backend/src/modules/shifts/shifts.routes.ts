/**
 * modules/shifts/shifts.routes.ts - Thin route handlers. [S-1]
 *   DELETE /v1/shifts/:id   delete a DRAFT shift (Owner, Manager) [FR-019]
 */
import { Router } from "express";
import { requireAuth } from "../../middleware/auth.js";
import { resolveActorContext } from "../../middleware/membership.js";
import { userRateLimit } from "../../middleware/rate-limit.js";
import { AppError, ErrorCode } from "../../lib/errors.js";
import { shiftsRepository } from "./shifts.repository.js";
import { shiftsService } from "./shifts.service.js";

const router = Router();

router.delete("/shifts/:id", requireAuth, userRateLimit, async (req, res, next) => {
  try {
    const shiftId = req.params.id;
    if (!shiftId) {
      throw new AppError(ErrorCode.NOT_FOUND, 404, "Shift not found");
    }

    // The target's business decides the actor context, never the request body.
    const shift = await shiftsRepository.findById(shiftId);
    const context = await resolveActorContext(req.session!.userId, shift);
    await shiftsService.deleteDraft(context, shiftId);

    res.json({ data: { deleted: true } });
  } catch (err) {
    next(err);
  }
});

export { router as shiftsRouter };
