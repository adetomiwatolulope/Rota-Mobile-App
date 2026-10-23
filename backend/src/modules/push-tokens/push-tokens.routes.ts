/**
 * modules/push-tokens/push-tokens.routes.ts
 */
import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../../middleware/auth.js";
import { userRateLimit } from "../../middleware/rate-limit.js";
import { prisma } from "../../lib/prisma.js";
import { AppError, ErrorCode } from "../../lib/errors.js";

const router = Router();

const registerSchema = z.object({
  expoPushToken: z.string().min(1),
  platform: z.enum(["IOS", "ANDROID"]),
  deviceId: z.string().optional(),
});

router.post("/push-tokens", requireAuth, userRateLimit, async (req, res, next) => {
  try {
    const body = registerSchema.parse(req.body);
    const userId = req.session!.userId;
    await prisma.pushToken.upsert({
      where: { expoPushToken: body.expoPushToken },
      create: {
        userId,
        expoPushToken: body.expoPushToken,
        platform: body.platform as any,
        deviceId: body.deviceId || null,
        lastSeenAt: new Date(),
      },
      update: {
        userId,
        deviceId: body.deviceId || null,
        platform: body.platform as any,
        disabledAt: null,
        lastSeenAt: new Date(),
      },
    });
    res.json({ data: { registered: true } });
  } catch (err) {
    next(err);
  }
});

router.delete("/push-tokens/:token", requireAuth, userRateLimit, async (req, res, next) => {
  try {
    const token = req.params.token;
    if (!token) throw new AppError(ErrorCode.NOT_FOUND, 404, "Token not found");
    const existing = await prisma.pushToken.findUnique({ where: { expoPushToken: token } });
    if (existing && existing.userId === req.session!.userId) {
      await prisma.pushToken.update({
        where: { id: existing.id },
        data: { disabledAt: new Date() },
      });
    }
    res.json({ data: { deleted: true } });
  } catch (err) {
    next(err);
  }
});

export { router as pushTokensRouter };
