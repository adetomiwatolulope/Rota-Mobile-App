/**
 * main.ts — Express HTTP server entry point.
 * Binds to 0.0.0.0 so Expo on a physical device can reach it over LAN. [Checkpoint 3]
 */
import "dotenv/config";
import express from "express";
import helmet from "helmet";
import cors from "cors";
import pinoHttp from "pino-http";
import { randomUUID } from "node:crypto";
import { env } from "./config/env.js";
import { logger } from "./lib/logger.js";
import { authRouter } from "./modules/auth/auth.routes.js";
import { errorHandler } from "./middleware/error-handler.js";

const app = express();

// Security headers [PRD 7.8]
app.use(helmet());

// CORS — allow all origins in dev; restrict in production [Checkpoint 3]
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

// Structured JSON logging — never console.log [PRD 7.8]
app.use(
  pinoHttp({
    logger,
    genReqId: (req) => req.id ?? randomUUID(),
  }),
);

app.use(express.json({ limit: "256kb" }));

// Health check — no auth required
app.get("/health", (_req, res) => {
  res.json({ status: "ok", ts: new Date().toISOString() });
});

// All API routes under /v1
app.use("/v1", authRouter);

// Central error handler — must be last [S-1]
app.use(errorHandler);

// Bind to 0.0.0.0 so mobile devices on the same LAN can reach the API
app.listen(env.PORT, "0.0.0.0", () => {
  logger.info(`Rota API listening on http://0.0.0.0:${env.PORT}`);
});

export default app;
