/**
 * modules/businesses/businesses.routes.ts — Thin route handlers. [S-1]
 *   POST /v1/businesses            create (any authenticated user) [FR-004]
 *   GET  /v1/businesses            list the caller's businesses [FR-012]
 *   GET  /v1/businesses/:id        get one (members only) [A-2]
 */
import { Router } from "express";
import { createBusinessSchema } from "@rota/shared";
import { requireAuth } from "../../middleware/auth.js";
import { userRateLimit } from "../../middleware/rate-limit.js";
import { requireMembership } from "../../middleware/membership.js";
import { businessesService } from "./businesses.service.js";

const router = Router();

router.post("/businesses", requireAuth, userRateLimit, async (req, res, next) => {
  try {
    const input = createBusinessSchema.parse(req.body);
    const business = await businessesService.create(req.session!.userId, input);
    res.status(201).json({ data: business });
  } catch (err) {
    next(err);
  }
});

router.get("/businesses", requireAuth, userRateLimit, async (req, res, next) => {
  try {
    const businesses = await businessesService.listForUser(req.session!.userId);
    res.json({ data: { businesses } });
  } catch (err) {
    next(err);
  }
});

// requireMembership returns 404 for non-members, preventing ID probing. [A-2]
router.get(
  "/businesses/:id",
  requireAuth,
  userRateLimit,
  requireMembership,
  async (req, res, next) => {
    try {
      const business = await businessesService.get(
        req.membership!.businessId,
        req.membership!.role,
      );
      res.json({ data: business });
    } catch (err) {
      next(err);
    }
  },
);

export { router as businessesRouter };
