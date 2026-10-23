/**
 * middleware/rate-limit.ts - Redis-backed shared rate limiting. [P-7, S-10]
 *
 * Counters live in Redis so two API instances see the same number. There is no
 * in-memory fallback: losing Redis must not silently disable a security control,
 * so a Redis error is passed to the central error handler (fail closed).
 *
 * PRD 7.3 limits:
 *   - auth endpoints: 5 per minute per IP AND per email
 *   - all other endpoints: 120 per minute per user
 */
import type { Request, Response, NextFunction } from "express";
import { AppError, ErrorCode } from "../lib/errors.js";
import {
  RATE_LIMIT_AUTH_PER_MINUTE,
  RATE_LIMIT_OTHER_PER_MINUTE,
  RATE_LIMIT_WINDOW_MS,
} from "../lib/constants.js";
import { getRedis } from "../lib/redis.js";

// INCR and EXPIRE must happen together; otherwise a crash between them leaves
// a counter with no TTL and the key would block the caller forever.
const WINDOW_SCRIPT = `
local current = redis.call("INCR", KEYS[1])
if current == 1 then
  redis.call("PEXPIRE", KEYS[1], ARGV[1])
end
return current
`;

export type RateLimitOptions = {
  /** Namespace that keeps unrelated limits apart. */
  scope: string;
  limit: number;
  windowMs?: number;
  /** One counter is checked per returned key. Empty keys are ignored. */
  keys: (req: Request) => string[];
};

async function incrementCounter(key: string, windowMs: number): Promise<number> {
  const result = await getRedis().eval(
    WINDOW_SCRIPT,
    1,
    key,
    String(windowMs),
  );
  return Number(result);
}

/** Build an Express middleware for one rate-limit rule. */
export function rateLimit(options: RateLimitOptions) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const windowMs = options.windowMs ?? RATE_LIMIT_WINDOW_MS;
      const keys = options.keys(req).filter((key) => key.length > 0);

      for (const key of keys) {
        const count = await incrementCounter(
          `ratelimit:${options.scope}:${key}`,
          windowMs,
        );
        if (count > options.limit) {
          res.setHeader("Retry-After", String(Math.ceil(windowMs / 1000)));
          throw new AppError(
            ErrorCode.RATE_LIMITED,
            429,
            "Too many requests. Try again shortly.",
          );
        }
      }

      next();
    } catch (err) {
      next(err);
    }
  };
}

function clientIp(req: Request): string {
  return req.ip ?? req.socket.remoteAddress ?? "unknown";
}

function normalizedEmail(req: Request): string | null {
  const value = req.body as { email?: unknown } | undefined;
  if (!value || typeof value.email !== "string") return null;
  const email = value.email.trim().toLowerCase();
  return email.length > 0 ? email : null;
}

/**
 * Auth endpoints: 5 per minute per IP and per email. Both counters run, so a
 * single IP cannot spray many addresses and one address cannot be sprayed from
 * many IPs. [P-7]
 */
export const authRateLimit = rateLimit({
  scope: "auth",
  limit: RATE_LIMIT_AUTH_PER_MINUTE,
  keys: (req) => {
    const keys = [`ip:${clientIp(req)}`];
    const email = normalizedEmail(req);
    if (email) keys.push(`email:${email}`);
    return keys;
  },
});

/**
 * Authenticated (non-auth) endpoints: 120 per minute per user. This also
 * covers invite creation, resend, and revocation. [P-7, FR-006]
 */
export const userRateLimit = rateLimit({
  scope: "user",
  limit: RATE_LIMIT_OTHER_PER_MINUTE,
  keys: (req) => [req.session ? `user:${req.session.userId}` : `ip:${clientIp(req)}`],
});

/** Public credential-bearing endpoints (invite preview): 120 per minute per IP. */
export const publicRateLimit = rateLimit({
  scope: "public",
  limit: RATE_LIMIT_OTHER_PER_MINUTE,
  keys: (req) => [`ip:${clientIp(req)}`],
});
