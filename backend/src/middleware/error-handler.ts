/**
 * middleware/error-handler.ts — Central error middleware. [S-1]
 * Returns { "error": { "code": "...", "message": "..." } }.
 * Never leaks stack traces to clients. [Coding-standard §4]
 */
import type { Request, Response, NextFunction } from "express";
import { ZodError } from "zod";
import { AppError, ErrorCode } from "../lib/errors.js";
import { logger } from "../lib/logger.js";

export function errorHandler(
  err: unknown,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction,
): void {
  if (err instanceof AppError) {
    if (err.httpStatus >= 500) {
      logger.error({ err, reqId: req.id }, "Application error");
    }
    res.status(err.httpStatus).json({
      error: { code: err.code, message: err.message },
    });
    return;
  }

  if (err instanceof ZodError) {
    res.status(400).json({
      error: {
        code: ErrorCode.VALIDATION,
        message: "Validation failed",
        details: err.flatten().fieldErrors,
      },
    });
    return;
  }

  // express.json throws a SyntaxError with status 400 for malformed JSON.
  // Return a validation error instead of turning a client mistake into a 500.
  if (
    err instanceof SyntaxError &&
    (err as SyntaxError & { status?: number }).status === 400
  ) {
    res.status(400).json({
      error: { code: ErrorCode.VALIDATION, message: "Invalid JSON body" },
    });
    return;
  }

  // Unknown error — log but never expose internals
  logger.error({ err, reqId: req.id }, "Unhandled error");
  res.status(500).json({
    error: { code: ErrorCode.INTERNAL, message: "Internal server error" },
  });
}
