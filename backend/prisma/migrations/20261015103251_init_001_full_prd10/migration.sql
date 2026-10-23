-- CreateEnum
CREATE TYPE "Role" AS ENUM ('OWNER', 'MANAGER', 'STAFF');

-- CreateEnum
CREATE TYPE "MembershipStatus" AS ENUM ('ACTIVE', 'REMOVED');

-- CreateEnum
CREATE TYPE "BusinessType" AS ENUM ('RESTAURANT', 'CLINIC', 'RETAIL', 'OTHER');

-- CreateEnum
CREATE TYPE "Currency" AS ENUM ('NGN', 'USD');

-- CreateEnum
CREATE TYPE "Platform" AS ENUM ('IOS', 'ANDROID');

-- CreateEnum
CREATE TYPE "AuthCodePurpose" AS ENUM ('VERIFY_EMAIL', 'LOGIN_NEW_DEVICE', 'PASSWORD_RESET');

-- CreateEnum
CREATE TYPE "ShiftStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ShiftChangeType" AS ENUM ('PUBLISHED', 'TIME_CHANGED', 'ASSIGNEE_CHANGED', 'POSITION_CHANGED', 'NOTES_CHANGED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "SwapScope" AS ENUM ('DIRECT', 'POOL');

-- CreateEnum
CREATE TYPE "SwapStatus" AS ENUM ('AWAITING_PEER', 'AWAITING_MANAGER', 'APPROVED', 'REJECTED', 'DECLINED', 'CANCELLED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "ClaimStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'WITHDRAWN');

-- CreateEnum
CREATE TYPE "TimeOffStatus" AS ENUM ('PENDING', 'APPROVED', 'DENIED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('SCHEDULE_PUBLISHED', 'SHIFT_ASSIGNED', 'SHIFT_CHANGED', 'SHIFT_REMOVED', 'SHIFT_NOTES_CHANGED', 'OPEN_SHIFT_AVAILABLE', 'SWAP_OFFERED', 'SWAP_NEEDS_APPROVAL', 'SWAP_RESOLVED', 'CLAIM_RESOLVED', 'TIME_OFF_REQUESTED', 'TIME_OFF_RESOLVED', 'SHIFT_REMINDER', 'ACK_REMINDER', 'TRIAL_ENDING', 'BILLING_ALERT');

-- CreateEnum
CREATE TYPE "DeliveryChannel" AS ENUM ('PUSH', 'EMAIL', 'SMS');

-- CreateEnum
CREATE TYPE "DeliveryStatus" AS ENUM ('QUEUED', 'SENT', 'DELIVERED', 'FAILED');

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('TRIALING', 'ACTIVE', 'PAST_DUE', 'READ_ONLY', 'CANCELLED');

-- CreateEnum
CREATE TYPE "InvoiceStatus" AS ENUM ('OPEN', 'PAID', 'FAILED', 'VOID');

-- CreateEnum
CREATE TYPE "InvoiceLineKind" AS ENUM ('SEATS', 'PRORATION');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phoneE164" TEXT,
    "emailVerifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuthCode" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "email" TEXT NOT NULL,
    "purpose" "AuthCodePurpose" NOT NULL,
    "codeHash" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuthCode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RefreshToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "deviceLabel" TEXT,
    "deviceId" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "replacedByTokenId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RefreshToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PushToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expoPushToken" TEXT NOT NULL,
    "platform" "Platform" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "disabledAt" TIMESTAMP(3),

    CONSTRAINT "PushToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Device" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "label" TEXT,
    "trustedAt" TIMESTAMP(3),
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Device_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Business" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "BusinessType" NOT NULL,
    "countryCode" TEXT NOT NULL DEFAULT 'NG',
    "currency" "Currency" NOT NULL DEFAULT 'NGN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Business_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Location" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT,
    "timezone" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "archivedAt" TIMESTAMP(3),

    CONSTRAINT "Location_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Position" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "archivedAt" TIMESTAMP(3),

    CONSTRAINT "Position_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Membership" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "status" "MembershipStatus" NOT NULL DEFAULT 'ACTIVE',
    "displayName" TEXT NOT NULL,
    "preferredMaxWeeklyMinutes" INTEGER,
    "activatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "removedAt" TIMESTAMP(3),
    "anonymizedAt" TIMESTAMP(3),

    CONSTRAINT "Membership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MembershipPosition" (
    "membershipId" TEXT NOT NULL,
    "positionId" TEXT NOT NULL,

    CONSTRAINT "MembershipPosition_pkey" PRIMARY KEY ("membershipId","positionId")
);

-- CreateTable
CREATE TABLE "SeatPeriod" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "membershipId" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "endedAt" TIMESTAMP(3),

    CONSTRAINT "SeatPeriod_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Invite" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "invitedById" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'STAFF',
    "email" TEXT,
    "phoneE164" TEXT,
    "positionIds" TEXT[],
    "tokenHash" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "codeAttempts" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "acceptedAt" TIMESTAMP(3),
    "acceptedByUserId" TEXT,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Invite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AvailabilityWindow" (
    "id" TEXT NOT NULL,
    "membershipId" TEXT NOT NULL,
    "dayOfWeek" INTEGER NOT NULL,
    "startMinute" INTEGER NOT NULL,
    "endMinute" INTEGER NOT NULL,

    CONSTRAINT "AvailabilityWindow_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TimeOffRequest" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "membershipId" TEXT NOT NULL,
    "startDate" DATE NOT NULL,
    "endDate" DATE NOT NULL,
    "note" TEXT,
    "status" "TimeOffStatus" NOT NULL DEFAULT 'PENDING',
    "decidedById" TEXT,
    "decidedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TimeOffRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Shift" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "positionId" TEXT NOT NULL,
    "assigneeId" TEXT,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "breakMinutes" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,
    "status" "ShiftStatus" NOT NULL DEFAULT 'DRAFT',
    "version" INTEGER NOT NULL DEFAULT 1,
    "publishedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "uncoveredAt" TIMESTAMP(3),
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Shift_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShiftChange" (
    "id" TEXT NOT NULL,
    "shiftId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "type" "ShiftChangeType" NOT NULL,
    "summary" TEXT NOT NULL,
    "requiresAck" BOOLEAN NOT NULL DEFAULT false,
    "changedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ShiftChange_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShiftChangeAck" (
    "id" TEXT NOT NULL,
    "shiftChangeId" TEXT NOT NULL,
    "membershipId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ackedAt" TIMESTAMP(3),

    CONSTRAINT "ShiftChangeAck_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SwapRequest" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "shiftId" TEXT NOT NULL,
    "requesterId" TEXT NOT NULL,
    "scope" "SwapScope" NOT NULL,
    "targetId" TEXT,
    "acceptedById" TEXT,
    "status" "SwapStatus" NOT NULL DEFAULT 'AWAITING_PEER',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "peerRespondedAt" TIMESTAMP(3),
    "decidedById" TEXT,
    "decidedAt" TIMESTAMP(3),
    "decisionNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SwapRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShiftClaim" (
    "id" TEXT NOT NULL,
    "shiftId" TEXT NOT NULL,
    "membershipId" TEXT NOT NULL,
    "status" "ClaimStatus" NOT NULL DEFAULT 'PENDING',
    "decidedById" TEXT,
    "decidedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ShiftClaim_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "businessId" TEXT,
    "type" "NotificationType" NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "data" JSONB,
    "requiresAck" BOOLEAN NOT NULL DEFAULT false,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificationDelivery" (
    "id" TEXT NOT NULL,
    "notificationId" TEXT NOT NULL,
    "channel" "DeliveryChannel" NOT NULL,
    "status" "DeliveryStatus" NOT NULL DEFAULT 'QUEUED',
    "providerRef" TEXT,
    "error" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NotificationDelivery_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Subscription" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "status" "SubscriptionStatus" NOT NULL DEFAULT 'TRIALING',
    "currency" "Currency" NOT NULL,
    "seatPriceMinor" INTEGER NOT NULL,
    "trialEndsAt" TIMESTAMP(3) NOT NULL,
    "currentPeriodStart" TIMESTAMP(3),
    "currentPeriodEnd" TIMESTAMP(3),
    "graceEndsAt" TIMESTAMP(3),
    "cancelAtPeriodEnd" BOOLEAN NOT NULL DEFAULT false,
    "cancelledAt" TIMESTAMP(3),
    "providerName" TEXT,
    "providerCustomerRef" TEXT,
    "providerPaymentTokenRef" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Invoice" (
    "id" TEXT NOT NULL,
    "subscriptionId" TEXT NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "dueAt" TIMESTAMP(3) NOT NULL,
    "seatCount" INTEGER NOT NULL,
    "totalMinor" INTEGER NOT NULL,
    "currency" "Currency" NOT NULL,
    "status" "InvoiceStatus" NOT NULL DEFAULT 'OPEN',
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "nextAttemptAt" TIMESTAMP(3),
    "providerTxnRef" TEXT,
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Invoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InvoiceLine" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "kind" "InvoiceLineKind" NOT NULL,
    "description" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unitAmountMinor" INTEGER NOT NULL,
    "amountMinor" INTEGER NOT NULL,

    CONSTRAINT "InvoiceLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentEvent" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerEventId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),

    CONSTRAINT "PaymentEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "actorId" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "AuthCode_email_purpose_createdAt_idx" ON "AuthCode"("email", "purpose", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "RefreshToken_tokenHash_key" ON "RefreshToken"("tokenHash");

-- CreateIndex
CREATE INDEX "RefreshToken_userId_idx" ON "RefreshToken"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "PushToken_expoPushToken_key" ON "PushToken"("expoPushToken");

-- CreateIndex
CREATE INDEX "PushToken_userId_idx" ON "PushToken"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Device_userId_deviceId_key" ON "Device"("userId", "deviceId");

-- CreateIndex
CREATE INDEX "Location_businessId_idx" ON "Location"("businessId");

-- CreateIndex
CREATE UNIQUE INDEX "Position_businessId_name_key" ON "Position"("businessId", "name");

-- CreateIndex
CREATE INDEX "Membership_businessId_status_role_idx" ON "Membership"("businessId", "status", "role");

-- CreateIndex
CREATE UNIQUE INDEX "Membership_userId_businessId_key" ON "Membership"("userId", "businessId");

-- CreateIndex
CREATE INDEX "SeatPeriod_businessId_startedAt_endedAt_idx" ON "SeatPeriod"("businessId", "startedAt", "endedAt");

-- CreateIndex
CREATE INDEX "SeatPeriod_membershipId_idx" ON "SeatPeriod"("membershipId");

-- CreateIndex
CREATE UNIQUE INDEX "Invite_tokenHash_key" ON "Invite"("tokenHash");

-- CreateIndex
CREATE INDEX "Invite_businessId_idx" ON "Invite"("businessId");

-- CreateIndex
CREATE INDEX "Invite_email_idx" ON "Invite"("email");

-- CreateIndex
CREATE INDEX "AvailabilityWindow_membershipId_dayOfWeek_idx" ON "AvailabilityWindow"("membershipId", "dayOfWeek");

-- CreateIndex
CREATE INDEX "TimeOffRequest_businessId_status_idx" ON "TimeOffRequest"("businessId", "status");

-- CreateIndex
CREATE INDEX "TimeOffRequest_membershipId_startDate_idx" ON "TimeOffRequest"("membershipId", "startDate");

-- CreateIndex
CREATE INDEX "Shift_businessId_startsAt_idx" ON "Shift"("businessId", "startsAt");

-- CreateIndex
CREATE INDEX "Shift_assigneeId_startsAt_idx" ON "Shift"("assigneeId", "startsAt");

-- CreateIndex
CREATE INDEX "Shift_locationId_startsAt_idx" ON "Shift"("locationId", "startsAt");

-- CreateIndex
CREATE UNIQUE INDEX "ShiftChange_shiftId_version_key" ON "ShiftChange"("shiftId", "version");

-- CreateIndex
CREATE INDEX "ShiftChangeAck_membershipId_ackedAt_idx" ON "ShiftChangeAck"("membershipId", "ackedAt");

-- CreateIndex
CREATE UNIQUE INDEX "ShiftChangeAck_shiftChangeId_membershipId_key" ON "ShiftChangeAck"("shiftChangeId", "membershipId");

-- CreateIndex
CREATE INDEX "SwapRequest_businessId_status_idx" ON "SwapRequest"("businessId", "status");

-- CreateIndex
CREATE INDEX "SwapRequest_status_expiresAt_idx" ON "SwapRequest"("status", "expiresAt");

-- CreateIndex
CREATE INDEX "SwapRequest_shiftId_idx" ON "SwapRequest"("shiftId");

-- CreateIndex
CREATE INDEX "ShiftClaim_shiftId_status_idx" ON "ShiftClaim"("shiftId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "ShiftClaim_shiftId_membershipId_key" ON "ShiftClaim"("shiftId", "membershipId");

-- CreateIndex
CREATE INDEX "Notification_userId_createdAt_idx" ON "Notification"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "NotificationDelivery_notificationId_idx" ON "NotificationDelivery"("notificationId");

-- CreateIndex
CREATE INDEX "NotificationDelivery_channel_status_idx" ON "NotificationDelivery"("channel", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Subscription_businessId_key" ON "Subscription"("businessId");

-- CreateIndex
CREATE INDEX "Subscription_status_currentPeriodEnd_idx" ON "Subscription"("status", "currentPeriodEnd");

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_providerTxnRef_key" ON "Invoice"("providerTxnRef");

-- CreateIndex
CREATE INDEX "Invoice_subscriptionId_status_idx" ON "Invoice"("subscriptionId", "status");

-- CreateIndex
CREATE INDEX "Invoice_status_nextAttemptAt_idx" ON "Invoice"("status", "nextAttemptAt");

-- CreateIndex
CREATE INDEX "InvoiceLine_invoiceId_idx" ON "InvoiceLine"("invoiceId");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentEvent_provider_providerEventId_key" ON "PaymentEvent"("provider", "providerEventId");

-- CreateIndex
CREATE INDEX "AuditLog_businessId_createdAt_idx" ON "AuditLog"("businessId", "createdAt");

-- AddForeignKey
ALTER TABLE "AuthCode" ADD CONSTRAINT "AuthCode_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RefreshToken" ADD CONSTRAINT "RefreshToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RefreshToken" ADD CONSTRAINT "RefreshToken_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "Device"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PushToken" ADD CONSTRAINT "PushToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Device" ADD CONSTRAINT "Device_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Location" ADD CONSTRAINT "Location_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Position" ADD CONSTRAINT "Position_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MembershipPosition" ADD CONSTRAINT "MembershipPosition_membershipId_fkey" FOREIGN KEY ("membershipId") REFERENCES "Membership"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MembershipPosition" ADD CONSTRAINT "MembershipPosition_positionId_fkey" FOREIGN KEY ("positionId") REFERENCES "Position"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SeatPeriod" ADD CONSTRAINT "SeatPeriod_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SeatPeriod" ADD CONSTRAINT "SeatPeriod_membershipId_fkey" FOREIGN KEY ("membershipId") REFERENCES "Membership"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invite" ADD CONSTRAINT "Invite_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invite" ADD CONSTRAINT "Invite_invitedById_fkey" FOREIGN KEY ("invitedById") REFERENCES "Membership"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AvailabilityWindow" ADD CONSTRAINT "AvailabilityWindow_membershipId_fkey" FOREIGN KEY ("membershipId") REFERENCES "Membership"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimeOffRequest" ADD CONSTRAINT "TimeOffRequest_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimeOffRequest" ADD CONSTRAINT "TimeOffRequest_membershipId_fkey" FOREIGN KEY ("membershipId") REFERENCES "Membership"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimeOffRequest" ADD CONSTRAINT "TimeOffRequest_decidedById_fkey" FOREIGN KEY ("decidedById") REFERENCES "Membership"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Shift" ADD CONSTRAINT "Shift_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Shift" ADD CONSTRAINT "Shift_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Shift" ADD CONSTRAINT "Shift_positionId_fkey" FOREIGN KEY ("positionId") REFERENCES "Position"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Shift" ADD CONSTRAINT "Shift_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "Membership"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Shift" ADD CONSTRAINT "Shift_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "Membership"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShiftChange" ADD CONSTRAINT "ShiftChange_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "Shift"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShiftChange" ADD CONSTRAINT "ShiftChange_changedById_fkey" FOREIGN KEY ("changedById") REFERENCES "Membership"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShiftChangeAck" ADD CONSTRAINT "ShiftChangeAck_shiftChangeId_fkey" FOREIGN KEY ("shiftChangeId") REFERENCES "ShiftChange"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShiftChangeAck" ADD CONSTRAINT "ShiftChangeAck_membershipId_fkey" FOREIGN KEY ("membershipId") REFERENCES "Membership"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SwapRequest" ADD CONSTRAINT "SwapRequest_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SwapRequest" ADD CONSTRAINT "SwapRequest_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "Shift"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SwapRequest" ADD CONSTRAINT "SwapRequest_requesterId_fkey" FOREIGN KEY ("requesterId") REFERENCES "Membership"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SwapRequest" ADD CONSTRAINT "SwapRequest_targetId_fkey" FOREIGN KEY ("targetId") REFERENCES "Membership"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SwapRequest" ADD CONSTRAINT "SwapRequest_acceptedById_fkey" FOREIGN KEY ("acceptedById") REFERENCES "Membership"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SwapRequest" ADD CONSTRAINT "SwapRequest_decidedById_fkey" FOREIGN KEY ("decidedById") REFERENCES "Membership"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShiftClaim" ADD CONSTRAINT "ShiftClaim_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "Shift"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShiftClaim" ADD CONSTRAINT "ShiftClaim_membershipId_fkey" FOREIGN KEY ("membershipId") REFERENCES "Membership"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShiftClaim" ADD CONSTRAINT "ShiftClaim_decidedById_fkey" FOREIGN KEY ("decidedById") REFERENCES "Membership"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationDelivery" ADD CONSTRAINT "NotificationDelivery_notificationId_fkey" FOREIGN KEY ("notificationId") REFERENCES "Notification"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "Subscription"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceLine" ADD CONSTRAINT "InvoiceLine_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "Membership"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ---- Raw SQL constraints (PRD Section 10; Prisma cannot express these) ----

-- One active owner per business
CREATE UNIQUE INDEX one_active_owner_per_business
  ON "Membership" ("businessId")
  WHERE role = 'OWNER' AND status = 'ACTIVE';

-- One active swap per shift
CREATE UNIQUE INDEX one_active_swap_per_shift
  ON "SwapRequest" ("shiftId")
  WHERE status IN ('AWAITING_PEER', 'AWAITING_MANAGER');

-- Shift time sanity
ALTER TABLE "Shift" ADD CONSTRAINT shift_end_after_start CHECK ("endsAt" > "startsAt");

-- Availability sanity (end may pass midnight, up to 2880)
ALTER TABLE "AvailabilityWindow" ADD CONSTRAINT availability_valid
  CHECK ("dayOfWeek" BETWEEN 1 AND 7
     AND "startMinute" BETWEEN 0 AND 1439
     AND "endMinute" BETWEEN 1 AND 2880
     AND "endMinute" > "startMinute"
     AND "endMinute" - "startMinute" <= 1440);

-- One open seat period per membership
CREATE UNIQUE INDEX one_open_seat_period_per_membership
  ON "SeatPeriod" ("membershipId")
  WHERE "endedAt" IS NULL;

-- Seat period sanity
ALTER TABLE "SeatPeriod" ADD CONSTRAINT seat_period_valid
  CHECK ("endedAt" IS NULL OR "endedAt" >= "startedAt");
