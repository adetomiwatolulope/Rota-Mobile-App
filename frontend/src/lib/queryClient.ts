/**
 * lib/queryClient.ts — Cache policy constants. The numbers are documented in
 * STATE.md so the "sensible cache times" are explicit, not scattered inline.
 *
 * Rule of thumb:
 *  - short staleTime  = data changes often, keep it fresh (inbox)
 *  - longer staleTime = data changes rarely, avoid refetching (team/business)
 *  - gcTime / persistMaxAge = how long a cached page survives for offline reads
 */
export const QUERY_CACHE = {
  // Default stale window for server data (team, businesses, member lists).
  staleTime: 60_000,
  // Keep cached pages in memory for 24h so navigating back is instant.
  gcTime: 24 * 60 * 60 * 1000,
  // Persisted offline cache is discarded after 7 days, matching the offline
  // window the PRD describes for the schedule cache. [PRD 7.5]
  persistMaxAge: 7 * 24 * 60 * 60 * 1000,
  // The inbox changes often (new notifications), so refresh it more eagerly.
  inboxStaleTime: 30_000,
  // Page size for cursor-paginated lists.
  inboxPageSize: 20,
} as const;
