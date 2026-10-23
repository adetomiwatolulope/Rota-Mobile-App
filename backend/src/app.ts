/**
 * app.ts - Express application factory.
 *
 * `main.ts` owns the listener; tests build the same app and bind it to an
 * ephemeral port, so HTTP tests exercise the real middleware stack without
 * starting a second server on the development port.
 */
import express from "express";
import helmet from "helmet";
import cors from "cors";
import pinoHttp from "pino-http";
import { randomUUID } from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";
import { env } from "./config/env.js";
import { logger } from "./lib/logger.js";
import { authRouter } from "./modules/auth/auth.routes.js";
import { businessesRouter } from "./modules/businesses/businesses.routes.js";
import { membersRouter } from "./modules/members/members.routes.js";
import { invitesRouter } from "./modules/invites/invites.routes.js";
import { notificationsRouter } from "./modules/notifications/notifications.routes.js";
import { shiftsRouter } from "./modules/shifts/shifts.routes.js";
import { errorHandler } from "./middleware/error-handler.js";
import { billingRouter, webhookRouter } from "./modules/billing/billing.routes.js";
import { requireNotReadOnly } from "./middleware/read-only.js";
import { pushTokensRouter } from "./modules/push-tokens/push-tokens.routes.js";
import { settingsRouter } from "./modules/settings/settings.routes.js";

export function createApp() {
  const app = express();

  // Security headers [PRD 7.8]
  app.use(helmet());

  // CORS - allow all origins in dev; restrict in production [Checkpoint 3]
  app.use(
    cors({
      origin: env.NODE_ENV === "production" ? false : "*",
      methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization", "If-Match"],
    }),
  );

  // Request ID for log correlation [PRD 7.8]
  app.use((req, _res, next) => {
    req.id = randomUUID();
    next();
  });

  // Structured JSON logging - never console.log [PRD 7.8]
  // Custom serializers drop headers (Authorization) and query strings (invite
  // tokens) so credentials never reach the log. [P-5]
  app.use(
    pinoHttp({
      logger,
      genReqId: (req) => req.id ?? randomUUID(),
      serializers: {
        req: (req: IncomingMessage & { id?: string }) => ({
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        }),
        res: (res: ServerResponse) => ({ statusCode: res.statusCode }),
      },
    }),
  );

  // A bounded body stops oversized payloads from reaching validation. [PRD 7.8]
  app.use(express.json({ limit: "256kb" }));

  // Health check - no auth required
  app.get("/health", (_req, res) => {
    res.json({ status: "ok", ts: new Date().toISOString() });
  });

  // All API routes under /v1
  app.use("/v1", authRouter);
  app.use("/v1", businessesRouter);
  app.use("/v1", membersRouter);
  app.use("/v1", invitesRouter);
  app.use("/v1", notificationsRouter);
  app.use("/v1", shiftsRouter);
  app.use("/v1", billingRouter);
  app.use("/v1", webhookRouter);
  app.use("/v1", pushTokensRouter);
  app.use("/v1", settingsRouter);
  // apply read-only after routes
  app.use("/v1", requireNotReadOnly as any);

  // Central error handler - must be last [S-1]
  app.use(errorHandler);

  return app;
}
