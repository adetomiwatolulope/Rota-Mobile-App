/**
 * lib/errors.ts — AppError and error codes. [S-1, Coding-standard.md §4]
 * Central error class used by all layers. Routes must never leak stack traces.
 * Error codes are defined in packages/shared and re-exported here for API use.
 */
export class AppError extends Error {
  constructor(
    public readonly code: string,
    public readonly httpStatus: number,
    message: string,
  ) {
    super(message);
    this.name = "AppError";
  }
}

// Well-known error codes — keep in sync with packages/shared
export const ErrorCode = {
  UNAUTHORIZED: "UNAUTHORIZED",
  FORBIDDEN: "FORBIDDEN",
  VALIDATION: "VALIDATION",
  NOT_FOUND: "NOT_FOUND",
  CONFLICT: "CONFLICT",
  GONE: "GONE",
  RATE_LIMITED: "RATE_LIMITED",
  INTERNAL: "INTERNAL",
  // Shift-specific
  STALE_VERSION: "STALE_VERSION",
  SHIFT_ENDED: "SHIFT_ENDED",
  POSITION_MISMATCH: "POSITION_MISMATCH",
  // Auth-specific
  EMAIL_NOT_VERIFIED: "EMAIL_NOT_VERIFIED",
  DEVICE_NOT_TRUSTED: "DEVICE_NOT_TRUSTED",
  CODE_INVALID: "CODE_INVALID",
  CODE_EXPIRED: "CODE_EXPIRED",
  CODE_LOCKED: "CODE_LOCKED",
  TOKEN_REVOKED: "TOKEN_REVOKED",
  // Invite-specific
  INVITE_EXPIRED: "INVITE_EXPIRED",
  INVITE_LOCKED: "INVITE_LOCKED",
  INVITE_ALREADY_ACCEPTED: "INVITE_ALREADY_ACCEPTED",
  INVITE_REVOKED: "INVITE_REVOKED",
  // Membership-specific
  MEMBERSHIP_REQUIRED: "MEMBERSHIP_REQUIRED",
  OWNER_PROTECTED: "OWNER_PROTECTED",
  // Billing
  SUBSCRIPTION_READ_ONLY: "SUBSCRIPTION_READ_ONLY",
  BILLING_NOT_CONFIGURED: "BILLING_NOT_CONFIGURED",
  PLAN_NOT_FOUND: "PLAN_NOT_FOUND",
  PLAN_SEAT_LIMIT: "PLAN_SEAT_LIMIT",
  INVOICE_NOT_FOUND: "INVOICE_NOT_FOUND",
  CHECKOUT_NOT_FOUND: "CHECKOUT_NOT_FOUND",
  PAYMENT_PROVIDER_ERROR: "PAYMENT_PROVIDER_ERROR",
  IDEMPOTENCY_REQUIRED: "IDEMPOTENCY_REQUIRED",
  BILLING_CONFLICT: "BILLING_CONFLICT",
  DOUBLE_CHARGE_ATTEMPT: "DOUBLE_CHARGE_ATTEMPT",
  PENDING_CHECKOUT_EXISTS: "PENDING_CHECKOUT_EXISTS",
  DOWNGRADE_SCHEDULED: "DOWNGRADE_SCHEDULED",
  INVALID_PRORATION: "INVALID_PRORATION",
} as const;

export type ErrorCodeValue = (typeof ErrorCode)[keyof typeof ErrorCode];

export class PaymentProviderError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this.name = "PaymentProviderError";
  }
}
