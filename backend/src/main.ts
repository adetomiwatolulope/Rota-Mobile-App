/**
 * main.ts - Express HTTP server entry point.
 * Binds to 0.0.0.0 so Expo on a physical device can reach it over LAN.
 */
import "dotenv/config";
import { env } from "./config/env.js";
import { logger } from "./lib/logger.js";
import { createApp } from "./app.js";

const app = createApp();

// Bind to 0.0.0.0 so mobile devices on the same LAN can reach the API
app.listen(env.PORT, "0.0.0.0", () => {
  logger.info(`Rota API listening on http://0.0.0.0:${env.PORT}`);
});

export default app;
