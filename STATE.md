# STATE.md — Where every piece of data lives, and why

Rota keeps data in three places, chosen by the kind of data it is. This file is
the map. If you add a piece of data, add a row here.

## The three kinds of state

| Kind | Meaning | Tool in Rota |
|---|---|---|
| **Server state** | Data owned by the API (`/v1`). It can change on the server at any time, so the server is always the authority. | **TanStack Query** (fetch, cache, refresh) |
| **Client state** | Data that exists only in the running app and never needs to be shared with the server. | **React state** — `useState` / `useReducer` / Context |
| **Persisted state** | Server state we keep on the device so it can be read with no network. | **TanStack Query persisted cache** → **AsyncStorage** |

**One client-state tool: React state.** We do not add Zustand (or any other
global store). `AGENTS.md` §5 says "Never add Redux or another global store,"
and the mobile stack is locked. React state covers everything this app needs
today: form fields, the selected tab, and small screens that own their own data.
When a value must be shared across routes it goes through React Context, which is
still React state. Adding a second store would duplicate TanStack Query's cache
and break the "one source of truth per piece of data" rule below.

## The one rule

**Every piece of data has exactly one home.** Server data is never copied into
client state. If a screen needs server data, it reads it from TanStack Query, not
from a `useState` copy. This is why the inbox and team screens were rewritten:
they used to copy server responses into local state, which drifts. Now they read
the query cache directly.

## Server data (TanStack Query)

| Data | Query key | Endpoint | `staleTime` | Persisted? | Why it lives here |
|---|---|---|---|---|---|
| Signed-in user (`me`) | `["me"]` | `GET /v1/auth/me` | 60s | no | Identity changes rarely; refetch on focus is enough. |
| Businesses the user belongs to | `["businesses"]` | `GET /v1/businesses` | 60s | yes | Shared by the team screen; read offline. |
| One business | `["business", id]` | `GET /v1/businesses/:id` | 60s | yes | Detail view of a business. |
| Members of a business | `["members", businessId]` | `GET /v1/businesses/:id/members` | 60s | yes | Team screen; read offline. Role change is optimistic. |
| Pending invites | `["invites", businessId]` | `GET /v1/businesses/:id/invites` | 60s | yes | Team screen; read offline. |
| Inbox notifications | `["notifications"]` | `GET /v1/notifications?cursor=&limit=` | **30s** | yes | Changes often, so it is refreshed more eagerly. Cursor-paginated (FR-045). |

### Cache times, explained

Set in `frontend/src/lib/queryClient.ts` (`QUERY_CACHE`) and documented here so
the numbers are explicit, not scattered.

- **`staleTime: 60_000` (60s)** — the default for slow-moving server data
  (team, businesses). Inside this window a screen shows cached data without a
  refetch; after it, a background refetch runs on mount/focus.
- **`inboxStaleTime: 30_000` (30s)** — the inbox changes more often than the
  team, so it goes stale sooner.
- **`gcTime: 24h`** — an unused cached query is kept in memory for a day, so
  going back to a screen is instant.
- **`persistMaxAge: 7 days`** — on restore, cached data older than this is
  dropped, so the app never shows week-old data as if it were current.
- **`retry: 2`** — transient failures retry twice before surfacing the error.
- **`refetchOnWindowFocus: false`** — avoids refetch storms while the user tabs
  around; pull-to-refresh and mount handle freshness.

## Persisted state (offline reading)

The whole TanStack Query cache is serialized to **AsyncStorage** under the key
`rota-query-cache` (see `frontend/src/providers/AppProviders.tsx`). On launch it
is restored **before** the app renders queries, so offline reads show the last
known data.

- **What is persisted:** every query above marked "yes" — businesses, members,
  invites, and the inbox.
- **What is not persisted:** nothing else. No tokens (those stay in
  `expo-secure-store`), no card data, no secrets.
- **Visible "last updated":** the inbox and team screens show the query's
  `dataUpdatedAt` as a human time ("Updated 5m ago"). When a fetch fails but
  cached data exists, the screen says it is showing saved data and the same
  timestamp. This satisfies "persist … so they display offline, with a visible
  'last updated' time."

## Optimistic updates with rollback

An optimistic update shows the result immediately, sends the request, and rolls
back if the server rejects it. It makes the app feel fast and stops double-taps.

| Action | Screen | Optimistic behaviour | Rollback |
|---|---|---|---|
| Mark notification read | `app/inbox.tsx` | The row flips to read and the unread badge drops by one before the server replies. Rapid taps are ignored while the request is in flight. | `onError` restores the snapshot taken in `onMutate`; `onSettled` refetches to reconcile. |
| Change a member's role | `app/team.tsx` | The member's role label changes immediately; the control is disabled while pending. | `onError` restores the member list snapshot; `onSettled` refetches. |

Both follow the same shape: `onMutate` cancels in-flight queries, snapshots the
old value, writes the new value; `onError` puts the snapshot back; `onSettled`
invalidates so the server's answer wins.

## Client state (React state)

| Data | Where | Why client state |
|---|---|---|
| Email + role in the invite form | `InviteMemberForm.tsx` (`useState`) | Draft input; not server data until submitted. |
| Which chip/segment is selected | component-local `useState` | Pure UI selection. |
| In-flight / error flags for a button | component-local `useState` | Belongs to the component that renders the button. |
| Auth tokens | `expo-secure-store` (via `lib/secureStore.ts`) | Persisted secret; never in React state or the query cache. |
| Device id | `expo-secure-store` | Stable device identity; not server data. |

## Deferred — needs the shifts/swaps feature (not built yet)

These rows are part of the state model but **cannot be implemented now** because
the feature they belong to does not exist in the codebase yet. They are listed so
the map stays honest. They will be filled in when the shifts/swaps feature is
built (FR-013–FR-028).

| Data | Planned home | Note |
|---|---|---|
| Upcoming shifts (offline) | TanStack Query persisted cache, same as the inbox | PRD 7.5 cache window is 7 days back to 14 days ahead. Needs the shifts feature + schedule screen. |
| Shift detail / member list for schedule | TanStack Query | Needs the shifts feature. |
| Swap request (optimistic) | TanStack Query mutation, same rollback shape as role change | The requirement's "Request swap" scenario. Needs the swap feature (FR-023–028) and its endpoints first. |

The optimistic-rollback pattern above is the exact pattern a swap request will
reuse; only the query key and mutation function change.

## Files that implement this

- `frontend/src/providers/AppProviders.tsx` — `QueryClient` + persisted cache.
- `frontend/src/lib/queryClient.ts` — the cache-time constants.
- `frontend/src/api/queryKeys.ts` — every query key in one place.
- `frontend/app/inbox.tsx` — cursor-paginated inbox, optimistic mark-read, offline "last updated".
- `frontend/app/team.tsx` — team data queries, optimistic role change, offline "last updated".
- `frontend/app/_layout.tsx`, `frontend/app/_layout.web.tsx` — wrap the app in `AppProviders`.
