/**
 * middleware/auth.ts — JWT session authentication middleware. [A-1, P-2]
 *
 * The access token carries ONLY userId and sessionId — never a role. [A-1]
 * Role is always read from the membership table on every protected request.
 * Refresh tokens are handled in the auth routes, not here.
 */
import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
import { AppError, ErrorCode } from "../lib/errors.js";

export interface SessionPayload {
  userId: string;
  sessionId: string; // corresponds to RefreshToken.id
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      session?: SessionPayload;
      id?: string; // request ID injected by request-id middleware
    }
  }
}

export function requireAuth(req: Request, _res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    throw new AppError(ErrorCode.UNAUTHORIZED, 401, "Missing bearer token");
  }

  const token = authHeader.slice(7);
  try {
    const payload = jwt.verify(token, env.JWT_SECRET) as SessionPayload;
    req.session = { userId: payload.userId, sessionId: payload.sessionId };
    next();
  } catch {
    throw new AppError(ErrorCode.UNAUTHORIZED, 401, "Invalid or expired token");
  }
}
