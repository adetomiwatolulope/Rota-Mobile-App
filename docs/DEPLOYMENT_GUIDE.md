# Deployment Guide (Backend)

## Overview
Deploy the Rota API + Workers to a managed service (Render, Railway, Fly.io) with managed Postgres and Redis.

## Prerequisites
- Git repo pushed to GitHub/GitLab
- Managed Postgres (e.g., Render Postgres, Railway Postgres, Neon)
- Managed Redis (e.g., Upstash Redis, Render Redis)
- Environment variables ready

## Required Environment Variables
Set these in your hosting provider:
- `NODE_ENV=production`
- `DATABASE_URL` (Postgres connection string)
- `REDIS_URL` (Redis connection string)
- `JWT_SECRET` (>=32 chars)
- `JWT_REFRESH_SECRET` (>=32 chars)
- `API_BASE_URL` (e.g., https://your-api.onrender.com)
- `SITE_URL` (web/billing base URL)
- `EMAIL_FROM`
- `POSTMARK_TOKEN` or SMTP settings
- `FLUTTERWAVE_SECRET_KEY`, `FLUTTERWAVE_PUBLIC_KEY`, `FLUTTERWAVE_WEBHOOK_SECRET_HASH`
- `EXPO_ACCESS_TOKEN` (for push)
- `SENTRY_DSN`, `POSTHOG_API_KEY` (optional)
- `SEAT_PRICE` (in kobo, if needed)

## Build/Start Commands
- Build: `npm run build --workspace=@rota/api`
- Start API: `node apps/api/dist/main.js` or `npm run start --workspace=@rota/api`
- Start Workers: `node apps/api/dist/worker.js` or `npm run start:worker --workspace=@rota/api`

## Deployment Steps (Render example)
1. Create a new Web Service from your repo
2. Build Command: `npm install && npm run build --workspace=@rota/api`
3. Start Command: `node apps/api/dist/main.js`
4. Add environment variables
5. Create a separate Background Worker for `apps/api/src/worker.ts` (or separate service with start command pointing to worker)
6. Add Postgres and Redis
7. Run migrations: `npx prisma migrate deploy` (from backend directory or via release command)

## Migrations
Run `cd backend && npx prisma migrate deploy` after deploy or as a release command.

## Health Check
`GET /health` should return `{"status":"ok"}`

## Notes
- Use HTTPS
- Set CORS appropriately
- Run API and workers as separate processes (S-2)
- Never commit secrets
- Use managed services with backups
