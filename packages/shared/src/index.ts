import { z } from "zod";

export const ROLES = ["OWNER", "MANAGER", "STAFF"] as const;
export type Role = (typeof ROLES)[number];
export const ERROR_CODES = {
  UNAUTHORIZED: "UNAUTHORIZED",
  FORBIDDEN: "FORBIDDEN",
  VALIDATION: "VALIDATION",
  NOT_FOUND: "NOT_FOUND",
  CONFLICT: "CONFLICT",
  RATE_LIMITED: "RATE_LIMITED",
  // Team / membership / invite (Phase 2)
  MEMBERSHIP_REQUIRED: "MEMBERSHIP_REQUIRED",
  INVITE_EXPIRED: "INVITE_EXPIRED",
  INVITE_LOCKED: "INVITE_LOCKED",
  INVITE_ALREADY_ACCEPTED: "INVITE_ALREADY_ACCEPTED",
  INVITE_REVOKED: "INVITE_REVOKED",
  OWNER_PROTECTED: "OWNER_PROTECTED",
} as const;
export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];

/**
 * Capability list and the permission matrix. The API enforces this on every
 * protected request; the app uses the same table only to decide what to show.
 * The server is the authority — the app never enforces. [A-3]
 *
 * Derived from PRD 7.3 and FR-006/009/010/011.
 */
export const CAPABILITIES = [
  "manageBilling",
  "editBusiness",
  "deleteBusiness",
  "managePositions",
  "inviteStaff",
  "inviteManagers",
  "changeRoles",
  "removeStaff",
  "removeManagers",
  "viewMembers",
  "leaveBusiness",
  // Draft shifts are the only shifts that can be deleted permanently. [FR-019]
  "deleteDraftShift",
] as const;
export type Capability = (typeof CAPABILITIES)[number];

export const PERMISSION_MATRIX: Record<Capability, Record<Role, boolean>> = {
  manageBilling: { OWNER: true, MANAGER: false, STAFF: false },
  editBusiness: { OWNER: true, MANAGER: false, STAFF: false },
  deleteBusiness: { OWNER: true, MANAGER: false, STAFF: false },
  managePositions: { OWNER: true, MANAGER: true, STAFF: false },
  inviteStaff: { OWNER: true, MANAGER: true, STAFF: false },
  // Only the Owner may invite a Manager or change roles. [FR-006, FR-009]
  inviteManagers: { OWNER: true, MANAGER: false, STAFF: false },
  changeRoles: { OWNER: true, MANAGER: false, STAFF: false },
  removeStaff: { OWNER: true, MANAGER: true, STAFF: false },
  removeManagers: { OWNER: true, MANAGER: false, STAFF: false },
  viewMembers: { OWNER: true, MANAGER: true, STAFF: true },
  // Staff and Managers may leave; the Owner cannot. [FR-011]
  leaveBusiness: { OWNER: false, MANAGER: true, STAFF: true },
  // Only the Owner and Manager manage shifts. [FR-013, FR-019]
  deleteDraftShift: { OWNER: true, MANAGER: true, STAFF: false },
};

/** Whether a role holds a capability. Deny by default. [A-3] */
export function roleHasCapability(role: Role, capability: Capability): boolean {
  return PERMISSION_MATRIX[capability][role] === true;
}

/**
 * Password policy, shared by the API and the app.
 *
 * Length is the enforced requirement ("length over composition"): a password
 * must be between the minimum and maximum below. The composition rules are
 * advisory only — they guide the user towards a stronger password but they
 * never block a password that meets the length requirement. [owner]
 */
export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 64;

export const PASSWORD_SPECIAL_CHARACTERS = "#@>^";

export type PasswordRuleId =
  | "lowercase"
  | "uppercase"
  | "number"
  | "special"
  | "length";

export type PasswordRule = {
  id: PasswordRuleId;
  label: string;
  test: (value: string) => boolean;
  /**
   * When true the rule is a hint only: it is shown while unmet but never
   * enforced, and it does not make a password invalid. [owner]
   */
  advisoryOnly?: boolean;
  /** Hide the rule from the hint list once it is satisfied. */
  hideWhenMet?: boolean;
};

// Hint order. The composition rules are advisory; the length rule is the
// enforced one and is shown last.
export const PASSWORD_RULES: PasswordRule[] = [
  {
    id: "lowercase",
    label: "Password must contain a lowercase letter",
    test: (value) => /[a-z]/.test(value),
    advisoryOnly: true,
  },
  {
    id: "uppercase",
    label: "Password must contain an uppercase letter",
    test: (value) => /[A-Z]/.test(value),
    advisoryOnly: true,
  },
  {
    id: "number",
    label: "Password must contain a number",
    test: (value) => /[0-9]/.test(value),
    advisoryOnly: true,
  },
  {
    id: "special",
    label: `Password must contain a special character (${PASSWORD_SPECIAL_CHARACTERS})`,
    test: (value) =>
      [...PASSWORD_SPECIAL_CHARACTERS].some((char) => value.includes(char)),
    advisoryOnly: true,
  },
  {
    id: "length",
    label: `Between ${PASSWORD_MIN_LENGTH} and ${PASSWORD_MAX_LENGTH} characters`,
    test: (value) =>
      value.length >= PASSWORD_MIN_LENGTH && value.length <= PASSWORD_MAX_LENGTH,
    hideWhenMet: true,
  },
];

/**
 * The hints to present for a value, in priority order: the enforced length
 * rule first (it is what actually blocks submit), then the advisory
 * composition hints. Met hide-when-met rules are dropped.
 */
export function visiblePasswordRules(value: string): PasswordRule[] {
  const visible = PASSWORD_RULES.filter(
    (rule) => !(rule.hideWhenMet && rule.test(value)),
  );
  return visible.sort((a, b) => {
    if (a.advisoryOnly === b.advisoryOnly) return 0;
    return a.advisoryOnly ? 1 : -1;
  });
}

/** IDs of the rules the value fails, in hint order. */
export function failedPasswordRules(value: string): PasswordRuleId[] {
  return PASSWORD_RULES.filter((rule) => !rule.test(value)).map(
    (rule) => rule.id,
  );
}

/**
 * Whether a password satisfies the enforced policy. Only the length rule is
 * enforced; advisory composition rules never make a password invalid. [owner]
 */
export function isPasswordValid(value: string): boolean {
  return PASSWORD_RULES.filter((rule) => !rule.advisoryOnly).every((rule) =>
    rule.test(value),
  );
}

/** The enforced rules, for building a validation message. */
export function enforcedPasswordRules(): PasswordRule[] {
  return PASSWORD_RULES.filter((rule) => !rule.advisoryOnly);
}

/** Human-readable description of the enforced policy, for error messages. */
export function passwordPolicyMessage(): string {
  return `Password must be between ${PASSWORD_MIN_LENGTH} and ${PASSWORD_MAX_LENGTH} characters`;
}

// ---------------------------------------------------------------------------
// Team / business / invite schemas (Phase 2). Shared by the API for validation
// and by the app for its own pre-checks. The API is always the authority. [S-7]
// ---------------------------------------------------------------------------

export const BUSINESS_TYPES = [
  "RESTAURANT",
  "CLINIC",
  "RETAIL",
  "OTHER",
] as const;
export type BusinessTypeValue = (typeof BUSINESS_TYPES)[number];

export const DEFAULT_TIMEZONE = "Africa/Lagos";
export const DEFAULT_COUNTRY_CODE = "NG";

/** FR-004: create a business workspace. */
export const createBusinessSchema = z.object({
  name: z.string().trim().min(1, "Business name is required").max(100),
  type: z.enum(BUSINESS_TYPES),
  locationName: z.string().trim().min(1, "Location name is required").max(100),
  timezone: z.string().trim().min(1).default(DEFAULT_TIMEZONE),
  countryCode: z.string().trim().length(2).default(DEFAULT_COUNTRY_CODE),
});
export type CreateBusinessInput = z.infer<typeof createBusinessSchema>;

/** FR-006: invite a member. Email is the default channel. */
export const inviteMemberSchema = z
  .object({
    email: z.string().trim().toLowerCase().email("Enter a valid email address"),
    role: z.enum(ROLES).default("STAFF"),
    positionIds: z.array(z.string().min(1)).max(20).default([]),
  })
  .strict();
export type InviteMemberInput = z.infer<typeof inviteMemberSchema>;

/** FR-009: change a member between STAFF and MANAGER. */
export const changeMemberRoleSchema = z.object({
  role: z.enum(["MANAGER", "STAFF"]),
});
export type ChangeMemberRoleInput = z.infer<typeof changeMemberRoleSchema>;

/** FR-007: accept an invite with a link token and a 6-digit code. */
export const acceptInviteSchema = z.object({
  token: z.string().min(1),
  code: z.string().length(6),
});
export type AcceptInviteInput = z.infer<typeof acceptInviteSchema>;

/** FR-008: resend issues a new link + code. */
export const resendInviteSchema = z.object({
  email: z.string().trim().toLowerCase().email().optional(),
});
export type ResendInviteInput = z.infer<typeof resendInviteSchema>;

// Response shapes (documentation + client typing).
export type BusinessSummary = {
  id: string;
  name: string;
  type: BusinessTypeValue;
  countryCode: string;
  currency: "NGN";
  role: Role;
};

export type MemberSummary = {
  membershipId: string;
  userId: string;
  displayName: string;
  email: string | null;
  role: Role;
  status: "ACTIVE" | "REMOVED";
  positionIds: string[];
};

export type InviteSummary = {
  id: string;
  email: string | null;
  role: Role;
  positionIds: string[];
  status: "PENDING" | "ACCEPTED" | "REVOKED" | "EXPIRED";
  expiresAt: string;
  createdAt: string;
  invitedByName: string;
};

export type InvitePreview = {
  businessName: string;
  role: Role;
  invitedByName: string;
  valid: boolean;
};

// ---------------------------------------------------------------------------
// Cursor pagination (PRD 7.1: "Cursor pagination for lists").
//
// Keyset pagination on (createdAt, id): the cursor is an opaque string that
// points at the last item the caller saw. New items added at the top do not
// shift the caller's position, and items with identical timestamps are not
// skipped because `id` breaks the tie.
// ---------------------------------------------------------------------------

export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;

/** One page of a cursor-paginated list. */
export type CursorPage<T> = {
  items: T[];
  /** Pass this back as `cursor` to get the next (older) page. Null at the end. */
  nextCursor: string | null;
  hasMore: boolean;
};

/** Inbox entry for the in-app notification list. [FR-045] */
export type NotificationItem = {
  id: string;
  type: string;
  title: string;
  body: string;
  requiresAck: boolean;
  readAt: string | null;
  createdAt: string;
  data: unknown;
};

// ---------------------------------------------------------------------------
// Billing (MVP-B)
// ---------------------------------------------------------------------------

export const BILLING_PLAN_CODES = ["STARTER", "TEAM", "BUSINESS"] as const;
export type BillingPlanCode = (typeof BILLING_PLAN_CODES)[number];

export const billingSessionSchema = z
  .object({
    planCode: z.enum(BILLING_PLAN_CODES).optional(),
  })
  .strict();
export type BillingSessionInput = z.infer<typeof billingSessionSchema>;

export const billingPlanChangeSchema = z
  .object({
    planCode: z.enum(BILLING_PLAN_CODES),
  })
  .strict();
export type BillingPlanChangeInput = z.infer<typeof billingPlanChangeSchema>;

export type BillingPlanSummary = {
  code: BillingPlanCode;
  name: string;
  monthlyPriceMinor: number;
  includedSeats: number;
  extraSeatPriceMinor: number;
  currency: "NGN";
};

export type SubscriptionSummary = {
  id: string;
  status: string;
  currency: "NGN";
  planCode: BillingPlanCode | null;
  pendingPlanCode: BillingPlanCode | null;
  seatPriceMinor: number;
  trialEndsAt: string;
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
  graceEndsAt: string | null;
  cancelAtPeriodEnd: boolean;
  cancelledAt: string | null;
};

export type InvoiceLineSummary = {
  id: string;
  kind: string;
  description: string;
  quantity: number;
  unitAmountMinor: number;
  amountMinor: number;
};

export type InvoiceSummary = {
  id: string;
  periodStart: string;
  periodEnd: string;
  dueAt: string;
  seatCount: number;
  totalMinor: number;
  currency: "NGN";
  status: string;
  attemptCount: number;
  nextAttemptAt: string | null;
  paidAt: string | null;
  createdAt: string;
  lines: InvoiceLineSummary[];
};

export type BillingSessionResult = {
  checkoutId: string;
  url: string;
  status: string;
  purpose: string;
  amountMinor: number;
  seatCount: number;
};

