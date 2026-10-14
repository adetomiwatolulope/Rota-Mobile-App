/**
 * lib/constants.ts — Every PRD timing constant lives here. [S-13]
 * Never repeat these numbers inline — cite the FR number where used.
 */

// Auth [FR-001, FR-002, FR-003]
export const AUTH_CODE_TTL_MS = 10 * 60 * 1000; // 10 minutes
export const AUTH_CODE_MAX_ATTEMPTS = 5; // 6th attempt invalidates [FR-001]

// Tokens [P-2]
export const ACCESS_TOKEN_TTL = "15m";
export const REFRESH_TOKEN_TTL_DAYS = 30;
export const REFRESH_TOKEN_TTL_MS = REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000;

// Invites [FR-006, FR-007]
export const INVITE_TTL_DAYS = 7;
export const INVITE_CODE_MAX_ATTEMPTS = 4; // 5th attempt locks [FR-007]

// Trials [FR-046] — MVP-A creates row, enforces nothing [X-6]
export const TRIAL_DURATION_DAYS = 14;

// Swaps [FR-023] — D3 PENDING: only first stage implemented
export const SWAP_PEER_TTL_HOURS = 48; // expires at: min(createdAt + 48h, shiftStart)
// SWAP_MANAGER_TTL_HOURS = 24 — behind named constant, off by default [D3 rule]
export const SWAP_MANAGER_TTL_HOURS = 24;
export const SWAP_MANAGER_WINDOW_ENABLED = false; // wire in when D3 is approved

// Shifts [FR-013, FR-015]
export const SHIFT_MAX_DURATION_HOURS = 24; // [ASSUMPTION]
export const REST_GAP_HOURS = 8; // min rest between shifts [FR-015, ASSUMPTION]
export const DEFAULT_MAX_WEEKLY_HOURS = 48; // used when member has no preference [FR-015]

// Notifications [FR-022, FR-044]
export const SHORT_NOTICE_THRESHOLD_HOURS = 12; // [FR-022]
export const ACK_REMINDER_STANDARD_HOURS = 12; // [FR-022]
export const ACK_FLAG_STANDARD_HOURS = 24; // [FR-022]
export const ACK_REMINDER_SHORT_HOURS = 1; // [FR-022]
export const ACK_FLAG_SHORT_HOURS = 2; // [FR-022]
export const PUSH_PLUS_EMAIL_THRESHOLD_HOURS = 6; // [FR-044]
export const SHIFT_REMINDER_BEFORE_HOURS = 2; // [FR-042, ASSUMPTION]

// Receipts [FR-044, PRD 7.4]
export const PUSH_RECEIPT_POLL_DELAY_MINUTES = 15;

// Rate limits [P-7]
export const RATE_LIMIT_AUTH_PER_MINUTE = 5;
export const RATE_LIMIT_OTHER_PER_MINUTE = 120;

// Retention [FR-057]
export const RETENTION_MONTHS = 24;
export const SOFT_DELETE_ANONYMIZE_DAYS = 30; // [FR-056]

// Billing — seat price is never hardcoded [M-6]
// SEAT_PRICE is read from env only in billing module (MVP-B)
