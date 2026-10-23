import { describe, expect, it } from "vitest";
import { isInQuietHours, shouldSendForType } from "../notifications/notifications.push.js";

/**
 * Requirement 7: quiet hours are evaluated in the user's time zone on the
 * server, and each notification group can be switched off independently.
 */
describe("Requirement 7 settings enforcement", () => {
  it("treats 22:00-06:00 as quiet across midnight in Africa/Lagos", () => {
    // 2026-10-23T23:30 Africa/Lagos (UTC+1) = 22:30 UTC.
    const late = new Date("2026-10-23T22:30:00.000Z");
    expect(isInQuietHours("Africa/Lagos", true, 22 * 60, 6 * 60, late)).toBe(true);
  });

  it("allows notifications outside the quiet window", () => {
    // 12:00 Africa/Lagos = 11:00 UTC.
    const noon = new Date("2026-10-23T11:00:00.000Z");
    expect(isInQuietHours("Africa/Lagos", true, 22 * 60, 6 * 60, noon)).toBe(false);
  });

  it("evaluates the same instant differently in another time zone", () => {
    // 23:30 Lagos, but 18:30 in New York (UTC-4 in October).
    const instant = new Date("2026-10-23T22:30:00.000Z");
    expect(isInQuietHours("Africa/Lagos", true, 22 * 60, 6 * 60, instant)).toBe(true);
    expect(isInQuietHours("America/New_York", true, 22 * 60, 6 * 60, instant)).toBe(false);
  });

  it("ignores quiet hours when disabled or unset", () => {
    const late = new Date("2026-10-23T22:30:00.000Z");
    expect(isInQuietHours("Africa/Lagos", false, 22 * 60, 6 * 60, late)).toBe(false);
    expect(isInQuietHours("Africa/Lagos", true, null, null, late)).toBe(false);
  });

  it("maps notification types to the four toggle groups", () => {
    const all = { shiftChanges: true, swaps: true, billing: true, reminders: true };
    expect(shouldSendForType({ ...all, swaps: false }, "SWAP_OFFER")).toBe(false);
    expect(shouldSendForType({ ...all, billing: false }, "PAYMENT_FAILED")).toBe(false);
    expect(shouldSendForType({ ...all, reminders: false }, "SHIFT_REMINDER")).toBe(false);
    expect(shouldSendForType({ ...all, shiftChanges: false }, "SHIFT_CHANGED")).toBe(false);
    expect(shouldSendForType(all, "SWAP_OFFER")).toBe(true);
  });
});
