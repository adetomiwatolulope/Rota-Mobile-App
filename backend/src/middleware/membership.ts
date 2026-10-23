/**
 * middleware/membership.ts — Membership + role authorization. [A-1, A-2, A-3]
 *
 * Rules:
 *   A-1 — the caller's role is read from the membership table on every request.
 *         The access token holds only userId + sessionId.
 *   A-2 — business scoping comes from the caller's membership, never from the
 *         request body alone.
 *   A-3 — permissions are enforced on the server, deny by default.
 *
 * `requireMembership` loads the caller's ACTIVE membership for the business in
 * the route param (`:id` for /businesses/:id, or `:businessId`) and attaches it
 * to `req.membership`. `requireCapability` then checks the shared matrix.
 */
import type { Request, Response, NextFunction } from "express";
import { roleHasCapability, type Capability, type Role } from "@rota/shared";
import { AppError, ErrorCode } from "../lib/errors.js";
import { prisma } from "../lib/prisma.js";

export interface MembershipContext {
  membershipId: string;
  userId: string;
  businessId: string;
  role: Role;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      membership?: MembershipContext;
    }
  }
}

function businessIdFrom(req: Request): string | undefined {
  const id = req.params.id ?? req.params.businessId;
  return typeof id === "string" && id.length > 0 ? id : undefined;
}

/**
 * Load the caller's ACTIVE membership for the target business. 404 when the
 * business does not exist or the caller is not a member — the same response in
 * both cases, so a non-member cannot probe for business IDs. [A-2, IDOR]
 */
export async function requireMembership(
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!req.session) {
      throw new AppError(ErrorCode.UNAUTHORIZED, 401, "Authentication required");
    }

    const businessId = businessIdFrom(req);
    if (!businessId) {
      throw new AppError(ErrorCode.NOT_FOUND, 404, "Business not found");
    }

    const business = await prisma.business.findUnique({
      where: { id: businessId },
      select: { id: true },
    });
    if (!business) {
      throw new AppError(ErrorCode.NOT_FOUND, 404, "Business not found");
    }

    const membership = await prisma.membership.findUnique({
      where: {
        userId_businessId: {
          userId: req.session.userId,
          businessId,
        },
      },
      select: { id: true, role: true, status: true },
    });

    // REMOVED memberships are treated as no membership: access ends on the very
    // next request. [A-9]
    if (!membership || membership.status !== "ACTIVE") {
      throw new AppError(ErrorCode.NOT_FOUND, 404, "Business not found");
    }

    req.membership = {
      membershipId: membership.id,
      userId: req.session.userId,
      businessId,
      role: membership.role,
    };
    next();
  } catch (err) {
    next(err);
  }
}

/**
 * Check one capability from the shared matrix. Must run after requireMembership.
 * Deny by default. [A-3]
 */
export function requireCapability(capability: Capability) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    try {
      const membership = req.membership;
      if (!membership) {
        throw new AppError(ErrorCode.FORBIDDEN, 403, "Not permitted");
      }
      if (!roleHasCapability(membership.role, capability)) {
        throw new AppError(
          ErrorCode.FORBIDDEN,
          403,
          "You do not have permission to perform this action",
        );
      }
      next();
    } catch (err) {
      next(err);
    }
  };
}

/**
 * Resolve the caller's membership context for the business that owns a child
 * entity addressed by its own id (e.g. PATCH /v1/members/:id). The business is
 * taken from the entity, never the request body, so a caller cannot act across
 * businesses. Throws 404 when either side is not an ACTIVE member. [A-2]
 */
export async function resolveActorContext(
  userId: string,
  entity: { businessId: string } | null,
): Promise<MembershipContext> {
  if (!entity) {
    throw new AppError(ErrorCode.NOT_FOUND, 404, "Not found");
  }
  const membership = await prisma.membership.findUnique({
    where: { userId_businessId: { userId, businessId: entity.businessId } },
    select: { id: true, role: true, status: true },
  });
  if (!membership || membership.status !== "ACTIVE") {
    throw new AppError(ErrorCode.NOT_FOUND, 404, "Not found");
  }
  return {
    membershipId: membership.id,
    userId,
    businessId: entity.businessId,
    role: membership.role,
  };
}
