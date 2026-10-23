/**
 * modules/settings/settings.routes.ts - Thin route handlers. [S-1]
 *   GET /v1/settings   server-owned settings (creates defaults on first read)
 *   PUT /v1/settings   partial update; most recent server write wins
 */
import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../../middleware/auth.js";
import { userRateLimit } from "../../middleware/rate-limit.js";
import { settingsService } from "./settings.service.js";

const router = Router();

const settingsSchema = z.object({
  timezone: z.string().min(1).optional(),
  language: z.string().min(1).optional(),
  theme: z.enum(["light", "dark", "system"]).optional(),
  quietHoursEnabled: z.boolean().optional(),
  quietHoursStart: z.number().int().min(0).max(1439).nullable().optional(),
  quietHoursEnd: z.number().int().min(0).max(1439).nullable().optional(),
  shiftChanges: z.boolean().optional(),
  swaps: z.boolean().optional(),
  billing: z.boolean().optional(),
  reminders: z.boolean().optional(),
  updatedAt: z.string().datetime().optional(),
});

router.get("/settings", requireAuth, userRateLimit, async (req, res, next) => {
  try {
    const settings = await settingsService.get(req.session!.userId);
    res.json({ data: { settings } });
  } catch (err) {
    next(err);
  }
});

router.put("/settings", requireAuth, userRateLimit, async (req, res, next) => {
  try {
    const body = settingsSchema.parse(req.body);
    const settings = await settingsService.update(req.session!.userId, body);
    res.json({ data: { settings } });
  } catch (err) {
    next(err);
  }
});

export { router as settingsRouter };
