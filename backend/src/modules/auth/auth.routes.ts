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
 *   POST /v1/auth/refresh
 *   POST /v1/auth/logout
 *   POST /v1/auth/password/forgot
 *   POST /v1/auth/password/reset
 *   GET  /v1/me
 */
import { Router } from "express";
import { z } from "zod";
import { authService } from "./auth.service.js";
import { requireAuth } from "../../middleware/auth.js";

const router = Router();

// Shared schemas
const emailSchema = z.string().email().toLowerCase();
const passwordSchema = z.string().min(10);
const deviceIdSchema = z.string().min(1);
const codeSchema = z.string().length(6);

/**
 * POST /v1/auth/register [FR-001]
 * Rate-limited by the auth rate-limit middleware applied at the router level.
 */
router.post("/auth/register", async (req, res, next) => {
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

    // Send the code via email provider (stubbed in scaffold; provider wired in notifications task)
    // Never return the code to the client — it's for the email provider only. [P-5]
    res.status(201).json({
      data: {
        userId: result.userId,
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
router.post("/auth/verify-email", async (req, res, next) => {
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
router.post("/auth/login", async (req, res, next) => {
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
      // Do not return the code here — email provider sends it. [P-5]
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
router.post("/auth/login/verify-device", async (req, res, next) => {
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
 * POST /v1/auth/refresh [P-2]
 */
router.post("/auth/refresh", async (req, res, next) => {
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
 */
router.post("/auth/logout", requireAuth, async (req, res, next) => {
  try {
    await authService.logout(req.session!.sessionId);
    res.json({ data: { success: true } });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /v1/auth/password/forgot [FR-003]
 */
router.post("/auth/password/forgot", async (req, res, next) => {
  try {
    const { email } = z.object({ email: emailSchema }).parse(req.body);
    await authService.requestPasswordReset(email);
    // Always 200 — prevents user enumeration
    res.json({ data: { message: "If this email exists, a reset code was sent" } });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /v1/auth/password/reset [FR-003]
 */
router.post("/auth/password/reset", async (req, res, next) => {
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
router.get("/me", requireAuth, async (req, res, next) => {
  try {
    const user = await authService.getMe(req.session!.userId);
    res.json({ data: user });
  } catch (err) {
    next(err);
  }
});

export { router as authRouter };
