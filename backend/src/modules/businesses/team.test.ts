/**
 * modules/businesses/team.test.ts — Phase 2 integration tests.
 *
 * Runs against the real PostgreSQL database (never mock Prisma) [AGENTS §5].
 * Each test creates its own business via the service, so tests are isolated.
 * Cleanup removes the businesses created here (cascade clears children).
 *
 * Covers the rule IDs this task touches:
 *   A-2 scoping, A-3/A-4 role limits, FR-004 create, FR-006/007 invite flow,
 *   FR-008 resend/revoke, FR-009 change role, FR-010 remove, M-9 seat period.
 */
import "dotenv/config";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "../../lib/prisma.js";
import { AppError } from "../../lib/errors.js";
import { businessesService } from "./businesses.service.js";
import { membersService } from "../members/members.service.js";
import { invitesService } from "../invites/invites.service.js";
import type { MembershipContext } from "../../middleware/membership.js";

const createdBusinessIds: string[] = [];
const createdUserIds: string[] = [];

async function makeUser(prefix: string): Promise<string> {
  const user = await prisma.user.create({
    data: {
      email: `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}@test.local`,
      passwordHash: "x",
      name: `${prefix} User`,
    },
  });
  createdUserIds.push(user.id);
  return user.id;
}

async function ownerContext(businessId: string, userId: string): Promise<MembershipContext> {
  const membership = await prisma.membership.findUniqueOrThrow({
    where: { userId_businessId: { userId, businessId } },
  });
  return {
    membershipId: membership.id,
    userId,
    businessId,
    role: membership.role,
  };
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
  return { userId, businessId: summary.id, summary };
}

/** Add a member directly (bypassing invites) to test role rules. */
async function addMember(
  businessId: string,
  role: "OWNER" | "MANAGER" | "STAFF",
): Promise<MembershipContext> {
  const userId = await makeUser(role.toLowerCase());
  const membership = await prisma.membership.create({
    data: { userId, businessId, role, status: "ACTIVE", displayName: `${role} User` },
  });
  return { membershipId: membership.id, userId, businessId, role };
}

beforeAll(async () => {
  // Fail fast if the database is unreachable. [AGENTS §5]
  await prisma.$queryRaw`SELECT 1`;
});

afterAll(async () => {
  if (createdBusinessIds.length > 0) {
    await prisma.business.deleteMany({ where: { id: { in: createdBusinessIds } } });
  }
  if (createdUserIds.length > 0) {
    await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
  }
  await prisma.$disconnect();
});

describe("FR-004 create business", () => {
  it("creates business, location, Owner membership, and TRIALING subscription in one transaction", async () => {
    const { businessId, userId } = await createBusinessWithOwner("fr004");

    const [business, locations, membership, subscription] = await Promise.all([
      prisma.business.findUnique({ where: { id: businessId } }),
      prisma.location.findMany({ where: { businessId } }),
      prisma.membership.findUnique({
        where: { userId_businessId: { userId, businessId } },
      }),
      prisma.subscription.findUnique({ where: { businessId } }),
    ]);

    expect(business?.currency).toBe("NGN"); // M-3
    expect(locations).toHaveLength(1);
    expect(membership?.role).toBe("OWNER");
    expect(membership?.status).toBe("ACTIVE");
    // MVP-A creates the row but enforces nothing. [X-6]
    expect(subscription?.status).toBe("TRIALING");
    expect(subscription?.trialEndsAt).toBeInstanceOf(Date);
  });
});

describe("A-2 / A-9 business scoping", () => {
  it("listForUser returns only the caller's businesses", async () => {
    const a = await createBusinessWithOwner("a2a");
    const b = await createBusinessWithOwner("a2b");
    const list = await businessesService.listForUser(a.userId);
    expect(list.map((x) => x.id)).toEqual([a.businessId]);
    expect(list.map((x) => x.id)).not.toContain(b.businessId);
  });

  it("removed members are excluded from the member list (A-9)", async () => {
    const { businessId } = await createBusinessWithOwner("a9");
    const staff = await addMember(businessId, "STAFF");
    const owner = await ownerContext(
      businessId,
      (await prisma.membership.findFirstOrThrow({
        where: { businessId, role: "OWNER" },
      })).userId,
    );

    await membersService.remove(owner, staff.membershipId);
    const members = await membersService.list(businessId);
    expect(members.map((m) => m.membershipId)).not.toContain(staff.membershipId);
  });
});

describe("A-4 / FR-009 role limits", () => {
  it("a Manager cannot change roles", async () => {
    const { businessId } = await createBusinessWithOwner("fr009m");
    const manager = await addMember(businessId, "MANAGER");
    const staff = await addMember(businessId, "STAFF");
    await expect(
      membersService.changeRole(manager, staff.membershipId, "MANAGER"),
    ).rejects.toBeInstanceOf(AppError);
  });

  it("the Owner role cannot be changed", async () => {
    const { businessId, userId } = await createBusinessWithOwner("fr009o");
    const owner = await ownerContext(businessId, userId);
    await expect(
      membersService.changeRole(owner, owner.membershipId, "MANAGER"),
    ).rejects.toMatchObject({ code: "OWNER_PROTECTED" });
  });

  it("the Owner can promote a Staff member to Manager", async () => {
    const { businessId, userId } = await createBusinessWithOwner("fr009p");
    const owner = await ownerContext(businessId, userId);
    const staff = await addMember(businessId, "STAFF");
    await membersService.changeRole(owner, staff.membershipId, "MANAGER");
    const updated = await prisma.membership.findUniqueOrThrow({
      where: { id: staff.membershipId },
    });
    expect(updated.role).toBe("MANAGER");
  });
});

describe("FR-010 remove member", () => {
  it("a Manager cannot remove another Manager", async () => {
    const { businessId } = await createBusinessWithOwner("fr010m");
    const managerA = await addMember(businessId, "MANAGER");
    const managerB = await addMember(businessId, "MANAGER");
    await expect(
      membersService.remove(managerA, managerB.membershipId),
    ).rejects.toBeInstanceOf(AppError);
  });

  it("the Owner cannot be removed", async () => {
    const { businessId, userId } = await createBusinessWithOwner("fr010o");
    const owner = await ownerContext(businessId, userId);
    await expect(
      membersService.remove(owner, owner.membershipId),
    ).rejects.toMatchObject({ code: "OWNER_PROTECTED" });
  });

  it("removal closes the open SeatPeriod (M-9)", async () => {
    const { businessId, userId } = await createBusinessWithOwner("fr010s");
    const owner = await ownerContext(businessId, userId);
    const staff = await addMember(businessId, "STAFF");
    await prisma.seatPeriod.create({
      data: { businessId, membershipId: staff.membershipId, startedAt: new Date() },
    });

    await membersService.remove(owner, staff.membershipId);

    const open = await prisma.seatPeriod.findMany({
      where: { membershipId: staff.membershipId, endedAt: null },
    });
    expect(open).toHaveLength(0);
  });
});

describe("FR-006 / FR-007 / FR-008 invites", () => {
  it("creates an invite storing link and code hashed (P-1)", async () => {
    const { businessId, userId } = await createBusinessWithOwner("fr006");
    const owner = await ownerContext(businessId, userId);
    const email = `invitee-${Date.now()}@test.local`;

    const created = await invitesService.create(owner, {
      email,
      role: "STAFF",
      positionIds: [],
    });

    const row = await prisma.invite.findUniqueOrThrow({ where: { id: created.invite.id } });
    expect(row.tokenHash).not.toBe(created.token);
    expect(row.codeHash).not.toBe(created.code);
    expect(row.expiresAt.getTime()).toBeGreaterThan(Date.now());
  });

  it("a Manager cannot invite a Manager (FR-006 / A-4)", async () => {
    const { businessId } = await createBusinessWithOwner("fr006m");
    const manager = await addMember(businessId, "MANAGER");
    await expect(
      invitesService.create(manager, {
        email: `x-${Date.now()}@test.local`,
        role: "MANAGER",
        positionIds: [],
      }),
    ).rejects.toBeInstanceOf(AppError);
  });

  it("accepts an invite and opens a SeatPeriod, activating the membership (FR-007, M-9)", async () => {
    const { businessId, userId } = await createBusinessWithOwner("fr007");
    const owner = await ownerContext(businessId, userId);
    const inviteeId = await makeUser("fr007invitee");
    const invitee = await prisma.user.findUniqueOrThrow({ where: { id: inviteeId } });

    const created = await invitesService.create(owner, {
      email: invitee.email,
      role: "STAFF",
      positionIds: [],
    });

    const result = await invitesService.accept(inviteeId, {
      token: created.token,
      code: created.code,
    });
    expect(result.businessId).toBe(businessId);

    const membership = await prisma.membership.findUniqueOrThrow({
      where: { userId_businessId: { userId: inviteeId, businessId } },
    });
    expect(membership.status).toBe("ACTIVE");
    const openSeat = await prisma.seatPeriod.findMany({
      where: { membershipId: membership.id, endedAt: null },
    });
    expect(openSeat).toHaveLength(1);
  });

  it("locks the invite on the 5th wrong code (FR-007, P-4)", async () => {
    const { businessId, userId } = await createBusinessWithOwner("fr007lock");
    const owner = await ownerContext(businessId, userId);
    const inviteeId = await makeUser("fr007lockinvitee");
    const invitee = await prisma.user.findUniqueOrThrow({ where: { id: inviteeId } });

    const created = await invitesService.create(owner, {
      email: invitee.email,
      role: "STAFF",
      positionIds: [],
    });

    let lastError: unknown;
    for (let i = 0; i < 5; i++) {
      lastError = await invitesService
        .accept(inviteeId, { token: created.token, code: "000000" })
        .catch((e: unknown) => e);
    }
    expect(lastError).toMatchObject({ code: "INVITE_LOCKED" });
  });

  it("rejects accepting an invite sent to a different email (FR-007)", async () => {
    const { businessId, userId } = await createBusinessWithOwner("fr007mail");
    const owner = await ownerContext(businessId, userId);
    const otherId = await makeUser("fr007other");

    const created = await invitesService.create(owner, {
      email: `someone-${Date.now()}@test.local`,
      role: "STAFF",
      positionIds: [],
    });

    await expect(
      invitesService.accept(otherId, { token: created.token, code: created.code }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("resend rotates the code so the old code no longer works (FR-008)", async () => {
    const { businessId, userId } = await createBusinessWithOwner("fr008");
    const owner = await ownerContext(businessId, userId);
    const inviteeId = await makeUser("fr008invitee");
    const invitee = await prisma.user.findUniqueOrThrow({ where: { id: inviteeId } });

    const created = await invitesService.create(owner, {
      email: invitee.email,
      role: "STAFF",
      positionIds: [],
    });
    const resent = await invitesService.resend(owner, created.invite.id);
    expect(resent.code).not.toBe(created.code);

    await expect(
      invitesService.accept(inviteeId, { token: created.token, code: created.code }),
    ).rejects.toBeInstanceOf(AppError);

    await invitesService.accept(inviteeId, { token: resent.token, code: resent.code });
  });

  it("revoked invites cannot be accepted (FR-008)", async () => {
    const { businessId, userId } = await createBusinessWithOwner("fr008rev");
    const owner = await ownerContext(businessId, userId);
    const inviteeId = await makeUser("fr008revinvitee");
    const invitee = await prisma.user.findUniqueOrThrow({ where: { id: inviteeId } });

    const created = await invitesService.create(owner, {
      email: invitee.email,
      role: "STAFF",
      positionIds: [],
    });
    await invitesService.revoke(owner, created.invite.id);

    await expect(
      invitesService.accept(inviteeId, { token: created.token, code: created.code }),
    ).rejects.toMatchObject({ code: "INVITE_REVOKED" });
  });
});
