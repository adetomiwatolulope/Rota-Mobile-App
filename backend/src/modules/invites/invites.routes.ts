/**
 * modules/invites/invites.routes.ts — Thin route handlers. [S-1]
 *   POST   /v1/businesses/:id/invites        create [FR-006]
 *   GET    /v1/businesses/:id/invites        list pending [FR-008]
 *   POST   /v1/invites/:id/resend            resend, rotates link+code [FR-008]
 *   DELETE /v1/invites/:id                   revoke [FR-008]
 *   GET    /v1/invites/preview?token=...     preview by link token [FR-006]
 *   POST   /v1/invites/accept                accept with token + code [FR-007]
 */
import { Router } from "express";
import { z } from "zod";
import { acceptInviteSchema, inviteMemberSchema, resendInviteSchema } from "@rota/shared";
import { requireAuth } from "../../middleware/auth.js";
import {
  requireMembership,
  requireCapability,
  resolveActorContext,
} from "../../middleware/membership.js";
import { publicRateLimit, userRateLimit } from "../../middleware/rate-limit.js";
import { AppError, ErrorCode } from "../../lib/errors.js";
import { invitesRepository } from "./invites.repository.js";
import { invitesService } from "./invites.service.js";

const router = Router();

const invitePreviewQuerySchema = z.object({
  token: z.string().min(1, "Missing invite token"),
});

router.post(
  "/businesses/:id/invites",
  requireAuth,
  userRateLimit,
  requireMembership,
  async (req, res, next) => {
    try {
      const input = inviteMemberSchema.parse(req.body);
      const created = await invitesService.create(req.membership!, input);
      res.status(201).json({ data: created });
    } catch (err) {
      next(err);
    }
  },
);

router.get(
  "/businesses/:id/invites",
  requireAuth,
  userRateLimit,
  requireMembership,
  requireCapability("viewMembers"),
  async (req, res, next) => {
    try {
      const invites = await invitesService.list(req.membership!);
      res.json({ data: { invites } });
    } catch (err) {
      next(err);
    }
  },
);

// Preview is public: the link is the credential and the code still gates accept.
router.get("/invites/preview", publicRateLimit, async (req, res, next) => {
  try {
    const { token } = invitePreviewQuerySchema.parse(req.query);
    const preview = await invitesService.preview(token);
    res.json({ data: preview });
  } catch (err) {
    next(err);
  }
});

router.post("/invites/accept", requireAuth, userRateLimit, async (req, res, next) => {
  try {
    const input = acceptInviteSchema.parse(req.body);
    const result = await invitesService.accept(req.session!.userId, input);
    res.json({ data: result });
  } catch (err) {
    next(err);
  }
});

router.post("/invites/:id/resend", requireAuth, userRateLimit, async (req, res, next) => {
  try {
    // Body is optional; kept for future channel selection. [FR-008]
    resendInviteSchema.parse(req.body ?? {});
    const inviteId = requireParam(req.params.id, "Invite not found");
    const invite = await invitesRepository.findById(inviteId);
    const context = await resolveActorContext(req.session!.userId, invite);
    const created = await invitesService.resend(context, inviteId);
    res.json({ data: created });
  } catch (err) {
    next(err);
  }
});

router.delete("/invites/:id", requireAuth, userRateLimit, async (req, res, next) => {
  try {
    const inviteId = requireParam(req.params.id, "Invite not found");
    const invite = await invitesRepository.findById(inviteId);
    const context = await resolveActorContext(req.session!.userId, invite);
    await invitesService.revoke(context, inviteId);
    res.json({ data: { revoked: true } });
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

export { router as invitesRouter };
