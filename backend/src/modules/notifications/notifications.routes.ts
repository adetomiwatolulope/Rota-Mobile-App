/**
 * modules/notifications/notifications.routes.ts �?" Thin route handlers. [S-1]
 *   GET  /v1/notifications            inbox page (cursor paginated) [FR-045]
 *   POST /v1/notifications/:id/read   mark read [FR-045]
 */
import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../../middleware/auth.js";
import { userRateLimit } from "../../middleware/rate-limit.js";
import { AppError, ErrorCode } from "../../lib/errors.js";
import { notificationsService } from "./notifications.service.js";

const router = Router();

const listQuerySchema = z.object({
  cursor: z.string().min(1).optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
});

router.get("/notifications", requireAuth, userRateLimit, async (req, res, next) => {
  try {
    const query = listQuerySchema.parse(req.query);
    const page = await notificationsService.list(req.session!.userId, query);
    res.json({ data: page });
  } catch (err) {
    next(err);
  }
});

router.post("/notifications/:id/read", requireAuth, userRateLimit, async (req, res, next) => {
  try {
    const id = req.params.id;
    if (!id) {
      throw new AppError(ErrorCode.NOT_FOUND, 404, "Notification not found");
    }
    await notificationsService.markRead(req.session!.userId, id);
    res.json({ data: { read: true } });
  } catch (err) {
    next(err);
  }
});

export { router as notificationsRouter };
