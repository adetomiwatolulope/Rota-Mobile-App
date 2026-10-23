/**
 * modules/auth/auth.routes.ts — Thin Express route handlers for auth. [S-1]
 * Routes: validate input → call service → return response.
 * Business logic lives in auth.service.ts, never here.
 *
 * Endpoints per PRD 7.2:
 *   POST /v1/auth/register
 *   POST /v1/auth/verify-email
 *   POST /v1/auth/login
 *   POST /v1/auth/login/verify-device
 *   POST /v1/auth/google
 *   POST /v1/auth/refresh
 *   POST /v1/auth/logout
 *   POST /v1/auth/password/forgot
 *   POST /v1/auth/password/reset
 *   GET  /v1/me
 */
import { Router } from "express";
import { z } from "zod";
import { PASSWORD_MIN_LENGTH, PASSWORD_MAX_LENGTH } from "@rota/shared";
import { authService } from "./auth.service.js";
import {
  enqueueDeviceCodeEmail,
  enqueuePasswordResetEmail,
  enqueueVerificationEmail,
} from "../../jobs/queues.js";
import { requireAuth } from "../../middleware/auth.js";
import { authRateLimit, userRateLimit } from "../../middleware/rate-limit.js";

const router = Router();

// Shared schemas
const emailSchema = z.string().email().toLowerCase();
// Length is the enforced requirement; composition rules are advisory only and
// never rejected by the API. [FR-001]
const passwordSchema = z
  .string()
  .min(
    PASSWORD_MIN_LENGTH,
    `Password must be at least ${PASSWORD_MIN_LENGTH} characters`,
  )
  .max(
    PASSWORD_MAX_LENGTH,
    `Password must be at most ${PASSWORD_MAX_LENGTH} characters`,
  );
const deviceIdSchema = z.string().min(1);
const codeSchema = z.string().length(6);

/**
 * POST /v1/auth/register [FR-001]
 * Rate-limited by the auth rate-limit middleware applied at the router level.
 */
router.post("/auth/register", authRateLimit, async (req, res, next) => {
  try {
    const body = z
      .object({
        email: emailSchema,
        password: passwordSchema,
        name: z.string().min(1).max(100),
        deviceId: deviceIdSchema,
      })
      .parse(req.body);

    const result = await authService.register(body);

    // Enqueue delivery; the BullMQ worker sends the email. [S-2]
    // The code is never returned to the client and never logged. [P-5]
    await enqueueVerificationEmail({
      email: body.email,
      name: result.name,
      code: result.verificationCodeForEmail,
    });

    res.status(201).json({
      data: {
        userId: result.userId,
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
        message: "Verification code sent to your email",
      },
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /v1/auth/verify-email [FR-001]
 */
router.post("/auth/verify-email", authRateLimit, async (req, res, next) => {
  try {
    const body = z
      .object({
        email: emailSchema,
        code: codeSchema,
        deviceId: deviceIdSchema,
      })
      .parse(req.body);

    const result = await authService.verifyEmail(body);
    res.json({ data: result });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /v1/auth/login [FR-002]
 */
router.post("/auth/login", authRateLimit, async (req, res, next) => {
  try {
    const body = z
      .object({
        email: emailSchema,
        password: z.string().min(1),
        deviceId: deviceIdSchema,
      })
      .parse(req.body);

    const result = await authService.login(body);

    if (result.requiresDeviceVerification) {
      // Send the new-device code in the worker, never return it here. [P-5, S-2]
      await enqueueDeviceCodeEmail({
        email: body.email,
        name: result.name,
        code: result.deviceCodeForEmail,
      });
      res.status(202).json({
        data: { requiresDeviceVerification: true },
      });
      return;
    }

    res.json({
      data: {
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
      },
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /v1/auth/login/verify-device [FR-002]
 */
router.post("/auth/login/verify-device", authRateLimit, async (req, res, next) => {
  try {
    const body = z
      .object({
        email: emailSchema,
        code: codeSchema,
        deviceId: deviceIdSchema,
      })
      .parse(req.body);

    const result = await authService.verifyDevice(body);
    res.json({
      data: { accessToken: result.accessToken, refreshToken: result.refreshToken },
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /v1/auth/google — owner-approved Google sign-in (PRD deviation).
 * Verifies the Google ID token and issues a normal session. Disabled with a
 * 503 when GOOGLE_CLIENT_ID is not set.
 */
router.post("/auth/google", authRateLimit, async (req, res, next) => {
  try {
    const body = z
      .object({
        idToken: z.string().min(1),
        deviceId: deviceIdSchema,
      })
      .parse(req.body);

    const result = await authService.signInWithGoogle(body);
    res.json({
      data: {
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
      },
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /v1/auth/refresh [P-2]
 */
router.post("/auth/refresh", authRateLimit, async (req, res, next) => {
  try {
    const { refreshToken } = z
      .object({ refreshToken: z.string().min(1) })
      .parse(req.body);

    const result = await authService.refreshTokens(refreshToken);
    res.json({ data: result });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /v1/auth/logout
 * Body: { allDevices?: boolean } — when true, revokes every session for the
 * user so all devices must sign in again.
 */
router.post("/auth/logout", requireAuth, userRateLimit, async (req, res, next) => {
  try {
    const body = z
      .object({ allDevices: z.boolean().optional() })
      .parse(req.body ?? {});
    if (body.allDevices) {
      await authService.logoutAll(req.session!.userId);
    } else {
      await authService.logout(req.session!.sessionId);
    }
    res.json({ data: { success: true } });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /v1/auth/password/forgot [FR-003]
 */
router.post("/auth/password/forgot", authRateLimit, async (req, res, next) => {
  try {
    const { email } = z.object({ email: emailSchema }).parse(req.body);
    const result = await authService.requestPasswordReset(email);
    if (result.resetCodeForEmail) {
      // Delivery happens in the worker, never in the request. [S-2]
      // The code is not returned to the client. [P-5]
      await enqueuePasswordResetEmail({
        email,
        name: result.name,
        code: result.resetCodeForEmail,
      });
    }
    // Always 200 — prevents user enumeration
    res.json({ data: { message: "If this email exists, a reset code was sent" } });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /v1/auth/password/reset [FR-003]
 */
router.post("/auth/password/reset", authRateLimit, async (req, res, next) => {
  try {
    const body = z
      .object({
        email: emailSchema,
        code: codeSchema,
        newPassword: passwordSchema,
      })
      .parse(req.body);

    const result = await authService.resetPassword(body);
    res.json({ data: result });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /v1/me — caller's profile and memberships
 */
router.get("/me", requireAuth, userRateLimit, async (req, res, next) => {
  try {
    const user = await authService.getMe(req.session!.userId);
    res.json({ data: user });
  } catch (err) {
    next(err);
  }
});

export { router as authRouter };
