/**
 * api/queryKeys.ts — One place for every TanStack Query key, so invalidation is
 * exact and no two screens invent different shapes.
 */
import type { Role } from "@rota/shared";

export const queryKeys = {
  me: ["me"] as const,
  businesses: ["businesses"] as const,
  business: (businessId: string) => ["business", businessId] as const,
  members: (businessId: string) => ["members", businessId] as const,
  invites: (businessId: string) => ["invites", businessId] as const,
  notifications: ["notifications"] as const,
  settings: ["settings"] as const,
  /** Buyer/role for a member role change — kept for type-safety of callers. */
  memberRole: (membershipId: string, role: Role) => ["member-role", membershipId, role] as const,
} as const;
