/**
 * modules/members/members.routes.ts — Thin route handlers. [S-1]
 *   GET    /v1/businesses/:id/members   list (members)
 *   PATCH  /v1/members/:id              change role (Owner) [FR-009]
 *   DELETE /v1/members/:id              remove member [FR-010]
 */
import { Router } from "express";
import { changeMemberRoleSchema } from "@rota/shared";
import { requireAuth } from "../../middleware/auth.js";
import {
  requireMembership,
  requireCapability,
  resolveActorContext,
} from "../../middleware/membership.js";
import { userRateLimit } from "../../middleware/rate-limit.js";
import { AppError, ErrorCode } from "../../lib/errors.js";
import { membersRepository } from "./members.repository.js";
import { membersService } from "./members.service.js";

const router = Router();

router.get(
  "/businesses/:id/members",
  requireAuth,
  userRateLimit,
  requireMembership,
  requireCapability("viewMembers"),
  async (req, res, next) => {
    try {
      const members = await membersService.list(req.membership!.businessId);
      res.json({ data: { members } });
    } catch (err) {
      next(err);
    }
  },
);

// The membership id identifies the business, so the actor context is resolved
// from the target's business inside the service helper. [A-2]
router.patch("/members/:id", requireAuth, userRateLimit, async (req, res, next) => {
  try {
    const membershipId = requireParam(req.params.id, "Member not found");
    const body = changeMemberRoleSchema.parse(req.body);
    const target = await membersRepository.findById(membershipId);
    const context = await resolveActorContext(req.session!.userId, target);
    await membersService.changeRole(context, membershipId, body.role);
    res.json({ data: { updated: true } });
  } catch (err) {
    next(err);
  }
});

router.delete("/members/:id", requireAuth, userRateLimit, async (req, res, next) => {
  try {
    const membershipId = requireParam(req.params.id, "Member not found");
    const target = await membersRepository.findById(membershipId);
    const context = await resolveActorContext(req.session!.userId, target);
    await membersService.remove(context, membershipId);
    res.json({ data: { removed: true } });
  } catch (err) {
    next(err);
  }
});

/** Read a required path param or throw 404. [noUncheckedIndexedAccess] */
function requireParam(value: string | undefined, message: string): string {
  if (!value) {
    throw new AppError(ErrorCode.NOT_FOUND, 404, message);
  }
  return value;
}

export { router as membersRouter };
