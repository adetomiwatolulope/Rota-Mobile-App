-- Push notification support and server-side settings coordination.
-- Adds device linkage to push tokens and the single-source-of-truth
-- UserSettings row. [FR-043..FR-045, 7.4, Requirement 7]

-- PushToken: link a token to the device that registered it.
ALTER TABLE "PushToken" ADD COLUMN "deviceId" TEXT;

CREATE INDEX "PushToken_userId_deviceId_idx" ON "PushToken"("userId", "deviceId");

-- UserSettings: one row per user. The server sets updatedAt; the most recent
-- write wins (see docs/SETTINGS_COORDINATION.md).
CREATE TABLE "UserSettings" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "timezone" TEXT NOT NULL DEFAULT 'Africa/Lagos',
    "language" TEXT NOT NULL DEFAULT 'en',
    "theme" TEXT NOT NULL DEFAULT 'system',
    "quietHoursEnabled" BOOLEAN NOT NULL DEFAULT false,
    "quietHoursStart" INTEGER,
    "quietHoursEnd" INTEGER,
    "shiftChanges" BOOLEAN NOT NULL DEFAULT true,
    "swaps" BOOLEAN NOT NULL DEFAULT true,
    "billing" BOOLEAN NOT NULL DEFAULT true,
    "reminders" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserSettings_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "UserSettings_userId_key" ON "UserSettings"("userId");

-- Quiet-hours bounds are minutes since local midnight.
ALTER TABLE "UserSettings" ADD CONSTRAINT "UserSettings_quiet_start_check"
    CHECK ("quietHoursStart" IS NULL OR ("quietHoursStart" >= 0 AND "quietHoursStart" < 1440));
ALTER TABLE "UserSettings" ADD CONSTRAINT "UserSettings_quiet_end_check"
    CHECK ("quietHoursEnd" IS NULL OR ("quietHoursEnd" >= 0 AND "quietHoursEnd" < 1440));

ALTER TABLE "UserSettings" ADD CONSTRAINT "UserSettings_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
