# Demo Script (3 minutes)

## Goal
Show signup/login, team/invites, dashboard, and inbox. Highlight server-enforced permissions and offline-friendly inbox.

## Setup
- API running on localhost:4000, workers running, Postgres + Redis up
- Mobile app running in Expo Go or dev build
- Clean test account ready

## Shot list with timestamps

| Time | Screen | Action | Narration |
|---|---|---|---|
| 00:00 - 00:15 | Splash/Auth | Open app, go to Sign up | "Rota helps small shift-based businesses manage teams and shifts." |
| 00:15 - 00:40 | Register | Create account with email/password, verify email (code from worker logs in dev) | "Sign up with email verification. Codes are hashed and rate-limited." |
| 00:40 - 01:00 | Create Business | Create business and location (Owner) | "Owners create a business. A trial subscription is created on first business." |
| 01:00 - 01:15 | Team/Invites | Invite member by email/link, show invite list | "Invite staff by email or link. Invites are hashed and locked after wrong attempts." |
| 01:15 - 01:30 | Dashboard | Show dashboard (Team, Inbox, Settings) - Team CTA matches Inbox style | "Role-based access. Only authorized roles can perform actions." |
| 01:30 - 02:00 | Inbox | Open inbox, show notifications (paginated) | "In-app inbox with cursor pagination. Cached for offline reading." |
| 02:00 - 02:30 | Permissions demo | Try to perform manager action as staff (show error) | "Permissions enforced server-side - UI can't bypass them." |
| 02:30 - 03:00 | Wrap up | Show settings, logout | "Secure auth with rotating refresh tokens, device trust, and server-enforced rules." |

## Notes
- In dev, verification codes appear in worker logs (SMTP JSON transport).
- Push requires dev build (not Expo Go).
- Offline: show inbox cached after network disconnect.
