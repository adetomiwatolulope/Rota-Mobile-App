# Settings coordination

Requirement 7: one source of truth for user settings, synced to every device,
and enforced by the server.

## Stored on the server

`UserSettings` holds one row per user (`UserSettings.userId` is unique):

| Field | Meaning |
| --- | --- |
| `timezone` | IANA zone used to evaluate quiet hours on the server. Defaults to `Africa/Lagos`. |
| `language` | BCP-47 tag. English (`en`) is the only shipped language. |
| `theme` | `light`, `dark`, or `system`. The design system is light-only today, so the value is stored but not applied by the UI. |
| `quietHoursEnabled`, `quietHoursStart`, `quietHoursEnd` | Quiet window as minutes since local midnight. `null` when unset. |
| `shiftChanges`, `swaps`, `billing`, `reminders` | Notification type groups. Each maps to a row in the PRD 5.7 event table. |
| `updatedAt` | Set by PostgreSQL on every write. This is the conflict timestamp. |

`GET /v1/settings` creates a default row on first read. `PUT /v1/settings`
writes a partial patch and returns the canonical row.

## Sync between devices

- Each device loads settings on focus and whenever the app returns to the
  foreground; TanStack Query caches and dedupes the reads.
- Writes are optimistic: the control changes immediately, the server response
  replaces the local row, and the previous value is restored on failure.
- The server row is authoritative. A client never keeps a winning local copy.

## Conflict rule and its weakness

**Rule:** the most recent server write wins. The server stamps `updatedAt`; a
client that sends an `updatedAt` older than the stored one receives `409` and
must reload.

**Weakness:** this is last-write-wins per row, not per field. Two devices that
change different settings at almost the same time can overwrite each other
because a patch without `updatedAt` is treated as newest. Clock skew between
clients does not matter (the server stamps), but a stale device can still
replace a newer change once it submits. Per-field versioning would fix this and
is deliberately deferred; the UI surfaces "Saved to your account" so the loser
gets visible feedback and can re-apply.

## Server enforcement

`modules/notifications/notifications.push.ts` reads the settings row before
every push:

- If the notification's type group is disabled, nothing is sent.
- If the current time in the user's `timezone` falls inside quiet hours, the
  push job is re-enqueued with a BullMQ delay until the quiet window ends.
  Billing failures and read-only alerts are treated as urgent and sent
  immediately.
- Delivery stays in the `push` BullMQ worker; a request never sends push
  directly (S-2).
