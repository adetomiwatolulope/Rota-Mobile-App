# LEARNING-LOG.md

## Fixes and learnings

### Environment & infrastructure
- **Corrupted Postgres cluster (5433)**: Rebuilt cluster at `C:\Users\user\AppData\Local\Rota\pgdata16`, preserved corrupt backup. Ran all 4 Prisma migrations with `prisma migrate deploy`.
- **Redis**: Started local Redis (5.0.14.1) for BullMQ/rate limiting; BullMQ warns on older Redis but works.
- **IP flapping**: Laptop Wi-Fi IP changed (10.89.79.239 ↔ 192.168.1.183). Mobile app now resolves API host from Expo `hostUri` with fallback to `EXPO_PUBLIC_API_BASE_URL`.
- **Network timeouts**: Added `fetchWithTimeout` (15s) with user-friendly message "Cannot reach the Rota server. Check your connection and try again."

### Auth & email
- **Email provider override**: Switched to SMTP/Nodemailer adapter with JSON transport in dev (logs codes) while keeping `EmailProvider` interface. All email jobs now use SMTP adapter.
- **Worker started**: Started BullMQ worker to process verification/invite/password/device emails; codes delivered via worker logs in dev.
- **Registration/login flow**: Fixed API reachability; verified register/login endpoints.

### Mobile
- **Push notifications**: Kept lazy-loading of `expo-notifications` in `frontend/src/features/notifications/push.ts` (Expo Go Android cannot register `ExpoTopicSubscriptionModule`).
- **API base resolution**: Centralized in `frontend/src/api/base.ts` to handle changing LAN IP.
- **Dashboard UI**: Made Team CTA match Inbox CTA style (outlined/secondary).

### Database inspection
- **Prisma Studio**: Run from `backend/` directory (`cd backend && npx prisma studio`) due to schema discovery.

### Lessons
- Always run API/worker from correct workspace with env loaded.
- LAN IP changes break hardcoded URLs - need runtime resolution for dev.
- Expo Go has module limitations - dev build needed for full push testing.
- Provider interfaces (S-3) allow swapping adapters without touching services.
