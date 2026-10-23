/**
 * security.test.ts - HTTP-level security checks. [Requirement 4]
 *
 * These tests boot the real Express app on an ephemeral port and use fetch, so
 * the middleware order (helmet, body parsing, auth, membership, rate limiting,
 * validation, central error handling) is what production runs. The database and
 * Redis are real; Prisma is never mocked. [AGENTS section 5]
 *
 * Covered rules:
 *   A-1/A-2/A-3 role + tenant enforcement, FR-019 draft deletion
 *   P-5 no credentials in logs (asserted separately by inspection of config)
 *   P-7 Redis-backed rate limits
 *   S-1 thin routes / central error shape
 */
import "dotenv/config";
import http, { type Server } from "node:http";
import type { Express } from "express";
import express from "express";
import jwt from "jsonwebtoken";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../app.js";
import { env } from "../config/env.js";
import { prisma } from "../lib/prisma.js";
import { getRedis } from "../lib/redis.js";
import { errorHandler } from "../middleware/error-handler.js";
import { userRateLimit } from "../middleware/rate-limit.js";
import { businessesService } from "../modules/businesses/businesses.service.js";
import type { MembershipContext } from "../middleware/membership.js";

type JsonBody = {
  data?: unknown;
  error?: { code?: string; message?: string; details?: unknown };
};

type RequestOptions = {
  method?: string;
  token?: string;
  body?: unknown;
  rawBody?: string;
};

const createdBusinessIds: string[] = [];
const createdUserIds: string[] = [];
const createdNotificationIds: string[] = [];

let apiServer: Server;
let apiBaseUrl: string;
let limitServer: Server;
let limitBaseUrl: string;

function startServer(app: Express): Promise<{ server: Server; baseUrl: string }> {
  return new Promise((resolve, reject) => {
    const server = http.createServer(app);
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        reject(new Error("Expected a TCP address"));
        return;
      }
      resolve({ server, baseUrl: `http://127.0.0.1:${address.port}` });
    });
  });
}

function closeServer(server: Server): Promise<void> {
  return new Promise((resolve, reject) => {
    server.close((err) => (err ? reject(err) : resolve()));
  });
}

async function httpRequest(
  baseUrl: string,
  path: string,
  options: RequestOptions = {},
): Promise<{ status: number; body: JsonBody | null }> {
  const headers: Record<string, string> = {};
  if (options.token) {
    headers.Authorization = `Bearer ${options.token}`;
  }
  const hasBody = options.body !== undefined || options.rawBody !== undefined;
  if (hasBody) {
    headers["Content-Type"] = "application/json";
  }

  let requestBody: string | undefined;
  if (options.rawBody !== undefined) {
    requestBody = options.rawBody;
  } else if (options.body !== undefined) {
    requestBody = JSON.stringify(options.body);
  }

  const response = await fetch(`${baseUrl}${path}`, {
    method: options.method ?? "GET",
    headers,
    body: requestBody,
  });

  const text = await response.text();
  let body: JsonBody | null = null;
  if (text.length > 0) {
    try {
      body = JSON.parse(text) as JsonBody;
    } catch {
      body = null;
    }
  }
  return { status: response.status, body };
}

async function makeUser(prefix: string): Promise<string> {
  const user = await prisma.user.create({
    data: {
      email: `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}@test.local`,
      passwordHash: "not-a-real-hash",
      name: `${prefix} User`,
      emailVerifiedAt: new Date(),
    },
  });
  createdUserIds.push(user.id);
  return user.id;
}

/** Signs the same shape requireAuth expects: userId + sessionId only. [A-1] */
function tokenFor(userId: string): string {
  return jwt.sign(
    { userId, sessionId: `security-test-${userId}` },
    env.JWT_SECRET,
    { expiresIn: "15m" },
  );
}

async function createBusinessWithOwner(prefix: string) {
  const userId = await makeUser(prefix);
  const summary = await businessesService.create(userId, {
    name: `${prefix} Co`,
    type: "RESTAURANT",
    locationName: "Main",
    timezone: "Africa/Lagos",
    countryCode: "NG",
  });
  createdBusinessIds.push(summary.id);
  return { userId, businessId: summary.id, token: tokenFor(userId) };
}

async function addMember(
  businessId: string,
  role: "MANAGER" | "STAFF",
): Promise<MembershipContext & { token: string }> {
  const userId = await makeUser(role.toLowerCase());
  const membership = await prisma.membership.create({
    data: {
      userId,
      businessId,
      role,
      status: "ACTIVE",
      displayName: `${role} User`,
    },
  });
  return {
    membershipId: membership.id,
    userId,
    businessId,
    role,
    token: tokenFor(userId),
  };
}

async function ownerContext(businessId: string): Promise<MembershipContext> {
  const membership = await prisma.membership.findFirstOrThrow({
    where: { businessId, role: "OWNER" },
  });
  return {
    membershipId: membership.id,
    userId: membership.userId,
    businessId,
    role: membership.role,
  };
}

async function createDraftShift(businessId: string, owner: MembershipContext) {
  const location = await prisma.location.findFirstOrThrow({
    where: { businessId },
  });
  const position = await prisma.position.create({
    data: {
      businessId,
      name: `Server-${Math.random().toString(16).slice(2)}`,
    },
  });
  return prisma.shift.create({
    data: {
      businessId,
      locationId: location.id,
      positionId: position.id,
      startsAt: new Date("2026-11-02T08:00:00.000Z"),
      endsAt: new Date("2026-11-02T16:00:00.000Z"),
      status: "DRAFT",
      createdById: owner.membershipId,
    },
  });
}

async function clearRateLimits(): Promise<void> {
  const redis = getRedis();
  const keys = await redis.keys("ratelimit:*");
  if (keys.length > 0) {
    await redis.del(...keys);
  }
}

beforeAll(async () => {
  await prisma.$queryRaw`SELECT 1`;

  const api = await startServer(createApp());
  apiServer = api.server;
  apiBaseUrl = api.baseUrl;

  // A second app isolates the 120/min test so it does not create 120 businesses.
  const limitApp = express();
  limitApp.use(express.json());
  limitApp.use((req, _res, next) => {
    req.session = { userId: "security-rate-limit-user", sessionId: "test" };
    next();
  });
  limitApp.post("/invites-limit", userRateLimit, (_req, res) => {
    res.json({ data: { ok: true } });
  });
  limitApp.use(errorHandler);

  const limit = await startServer(limitApp);
  limitServer = limit.server;
  limitBaseUrl = limit.baseUrl;
});

beforeEach(async () => {
  await clearRateLimits();
});

afterAll(async () => {
  await closeServer(apiServer);
  await closeServer(limitServer);

  await clearRateLimits();
  if (createdNotificationIds.length > 0) {
    await prisma.notification.deleteMany({
      where: { id: { in: createdNotificationIds } },
    });
  }
  if (createdBusinessIds.length > 0) {
    await prisma.business.deleteMany({ where: { id: { in: createdBusinessIds } } });
  }
  if (createdUserIds.length > 0) {
    await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
  }
  await prisma.$disconnect();
});

describe("A-3 / FR-019 draft shift deletion", () => {
  it("denies Staff and leaves the row untouched, then lets the Owner delete it", async () => {
    const owner = await createBusinessWithOwner("a3-owner");
    const staff = await addMember(owner.businessId, "STAFF");
    const context = await ownerContext(owner.businessId);
    const shift = await createDraftShift(owner.businessId, context);

    const denied = await httpRequest(apiBaseUrl, `/v1/shifts/${shift.id}`, {
      method: "DELETE",
      token: staff.token,
    });
    expect(denied.status).toBe(403);
    expect(denied.body?.error?.code).toBe("FORBIDDEN");
    expect(await prisma.shift.findUnique({ where: { id: shift.id } })).not.toBeNull();

    const allowed = await httpRequest(apiBaseUrl, `/v1/shifts/${shift.id}`, {
      method: "DELETE",
      token: owner.token,
    });
    expect(allowed.status).toBe(200);
    expect(await prisma.shift.findUnique({ where: { id: shift.id } })).toBeNull();
  });

  it("refuses to delete a published shift with 409 (FR-019)", async () => {
    const owner = await createBusinessWithOwner("a3-published");
    const context = await ownerContext(owner.businessId);
    const shift = await createDraftShift(owner.businessId, context);
    await prisma.shift.update({
      where: { id: shift.id },
      data: { status: "PUBLISHED", publishedAt: new Date() },
    });

    const response = await httpRequest(apiBaseUrl, `/v1/shifts/${shift.id}`, {
      method: "DELETE",
      token: owner.token,
    });
    expect(response.status).toBe(409);
    expect(await prisma.shift.findUnique({ where: { id: shift.id } })).not.toBeNull();
  });
});

describe("A-2 tenant isolation", () => {
  it("returns 404 across businesses for reads, role changes, and deletes", async () => {
    const a = await createBusinessWithOwner("a2-a");
    const b = await createBusinessWithOwner("a2-b");
    const staffA = await addMember(a.businessId, "STAFF");
    const contextA = await ownerContext(a.businessId);
    const shiftA = await createDraftShift(a.businessId, contextA);

    const readBusiness = await httpRequest(
      apiBaseUrl,
      `/v1/businesses/${a.businessId}`,
      { token: b.token },
    );
    expect(readBusiness.status).toBe(404);

    const readMembers = await httpRequest(
      apiBaseUrl,
      `/v1/businesses/${a.businessId}/members`,
      { token: b.token },
    );
    expect(readMembers.status).toBe(404);

    const createInvite = await httpRequest(
      apiBaseUrl,
      `/v1/businesses/${a.businessId}/invites`,
      {
        method: "POST",
        token: b.token,
        body: { email: "intruder@test.local", role: "STAFF", positionIds: [] },
      },
    );
    expect(createInvite.status).toBe(404);

    const changeRole = await httpRequest(
      apiBaseUrl,
      `/v1/members/${staffA.membershipId}`,
      { method: "PATCH", token: b.token, body: { role: "MANAGER" } },
    );
    expect(changeRole.status).toBe(404);

    const deleteShift = await httpRequest(apiBaseUrl, `/v1/shifts/${shiftA.id}`, {
      method: "DELETE",
      token: b.token,
    });
    expect(deleteShift.status).toBe(404);

    // The caller's own list never includes another business. [A-2]
    const list = await httpRequest(apiBaseUrl, "/v1/businesses", {
      token: b.token,
    });
    expect(list.status).toBe(200);
    expect(JSON.stringify(list.body)).toContain(b.businessId);
    expect(JSON.stringify(list.body)).not.toContain(a.businessId);

    // Nothing changed in business A.
    const staffAfter = await prisma.membership.findUniqueOrThrow({
      where: { id: staffA.membershipId },
    });
    expect(staffAfter.role).toBe("STAFF");
    expect(await prisma.shift.findUnique({ where: { id: shiftA.id } })).not.toBeNull();
  });

  it("never returns another user's inbox (A-2)", async () => {
    const a = await createBusinessWithOwner("inbox-a");
    const b = await createBusinessWithOwner("inbox-b");

    const notificationA = await prisma.notification.create({
      data: {
        userId: a.userId,
        businessId: a.businessId,
        type: "SCHEDULE_PUBLISHED",
        title: "A only",
        body: "Private to A",
      },
    });
    const notificationB = await prisma.notification.create({
      data: {
        userId: b.userId,
        businessId: b.businessId,
        type: "SCHEDULE_PUBLISHED",
        title: "B only",
        body: "Private to B",
      },
    });
    createdNotificationIds.push(notificationA.id, notificationB.id);

    const response = await httpRequest(apiBaseUrl, "/v1/notifications", {
      token: b.token,
    });
    expect(response.status).toBe(200);
    const serialized = JSON.stringify(response.body);
    expect(serialized).toContain(notificationB.id);
    expect(serialized).not.toContain(notificationA.id);
  });
});

describe("Zod boundary validation", () => {
  it("rejects an unknown business type with 400 VALIDATION", async () => {
    const owner = await createBusinessWithOwner("zod-business");
    const response = await httpRequest(apiBaseUrl, "/v1/businesses", {
      method: "POST",
      token: owner.token,
      body: {
        name: "Invalid Co",
        type: "SPACESHIP",
        locationName: "Main",
      },
    });
    expect(response.status).toBe(400);
    expect(response.body?.error?.code).toBe("VALIDATION");
  });

  it("rejects an invalid role change with 400 VALIDATION", async () => {
    const owner = await createBusinessWithOwner("zod-role");
    const staff = await addMember(owner.businessId, "STAFF");
    const response = await httpRequest(
      apiBaseUrl,
      `/v1/members/${staff.membershipId}`,
      { method: "PATCH", token: owner.token, body: { role: "OWNER" } },
    );
    expect(response.status).toBe(400);
    expect(response.body?.error?.code).toBe("VALIDATION");
  });

  it("rejects malformed JSON with 400, not 500", async () => {
    const response = await httpRequest(apiBaseUrl, "/v1/auth/login", {
      method: "POST",
      rawBody: "{",
    });
    expect(response.status).toBe(400);
    expect(response.body?.error?.code).toBe("VALIDATION");
  });
});

describe("P-7 Redis rate limiting", () => {
  it("blocks the 6th auth request per IP and email with 429 RATE_LIMITED", async () => {
    const attempt = () =>
      httpRequest(apiBaseUrl, "/v1/auth/login", {
        method: "POST",
        body: {
          email: "rate-limit@test.local",
          password: "",
          deviceId: "security-test-device",
        },
      });

    for (let i = 0; i < 5; i += 1) {
      const response = await attempt();
      expect(response.status).toBe(400);
    }

    const blocked = await attempt();
    expect(blocked.status).toBe(429);
    expect(blocked.body?.error?.code).toBe("RATE_LIMITED");

    const keys = await getRedis().keys("ratelimit:auth:*");
    expect(keys).toContain("ratelimit:auth:email:rate-limit@test.local");
  });

  it("enforces 120 per minute per user for non-auth endpoints (invites use this)", async () => {
    for (let i = 0; i < 120; i += 1) {
      const response = await httpRequest(limitBaseUrl, "/invites-limit", {
        method: "POST",
        body: {},
      });
      expect(response.status).toBe(200);
    }

    const blocked = await httpRequest(limitBaseUrl, "/invites-limit", {
      method: "POST",
      body: {},
    });
    expect(blocked.status).toBe(429);
    expect(blocked.body?.error?.code).toBe("RATE_LIMITED");
  });
});
