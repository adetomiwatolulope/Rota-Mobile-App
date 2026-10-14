/* Rota: full schema migration (PRD Section 10)
   Enforces: one active owner per business, one active swap per shift,
   shift end after start, availability sanity (end may pass midnight up to 2880),
   one open seat period per membership, seat period sanity.
*/

-- One active owner per business
CREATE UNIQUE INDEX IF NOT EXISTS one_active_owner_per_business
  ON "Membership" ("businessId")
  WHERE role = 'OWNER' AND status = 'ACTIVE';

-- One active swap per shift
CREATE UNIQUE INDEX IF NOT EXISTS one_active_swap_per_shift
  ON "SwapRequest" ("shiftId")
  WHERE status IN ('AWAITING_PEER', 'AWAITING_MANAGER');

-- Shift time sanity
ALTER TABLE "Shift" ADD CONSTRAINT IF NOT EXISTS shift_end_after_start CHECK ("endsAt" > "startsAt");

-- Availability sanity (end may pass midnight, up to 2880)
ALTER TABLE "AvailabilityWindow" ADD CONSTRAINT IF NOT EXISTS availability_valid
  CHECK ("dayOfWeek" BETWEEN 1 AND 7
     AND "startMinute" BETWEEN 0 AND 1439
     AND "endMinute" BETWEEN 1 AND 2880
     AND "endMinute" > "startMinute"
     AND "endMinute" - "startMinute" <= 1440);

-- One open seat period per membership
CREATE UNIQUE INDEX IF NOT EXISTS one_open_seat_period_per_membership
  ON "SeatPeriod" ("membershipId")
  WHERE "endedAt" IS NULL;

-- Seat period sanity
ALTER TABLE "SeatPeriod" ADD CONSTRAINT IF NOT EXISTS seat_period_valid
  CHECK ("endedAt" IS NULL OR "endedAt" >= "startedAt");
