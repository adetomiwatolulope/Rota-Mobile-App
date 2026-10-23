/**
 * jobs/push-receipts.ts - Poll push receipts and clean invalid tokens
 */
import { prisma } from "../lib/prisma.js";
import { expoPushProvider } from "../providers/push/expo/index.js";
// @ts-ignore
import { DateTime } from "luxon";

export async function pollPushReceipts() {
  // In practice, store ticket IDs; for now, scan recent tokens? Or track separately
  // Simplified: poll receipts for tokens updated recently? Not fully tracked; implement structure
  // Look for push tickets older than 15 minutes - store in metadata? Skip complex tracking for now
  // But implement logic to clean invalid tokens when we detect
}

export async function cleanInvalidTokensByReceipts(ticketIds: string[]) {
  if (ticketIds.length === 0) return;
  const receipts = await expoPushProvider.getReceipts(ticketIds);
  for (const [id, receipt] of Object.entries(receipts)) {
    if (receipt.status === "error") {
      const err = receipt.details?.error;
      if (err === "DeviceNotRegistered" || err === "InvalidCredentials") {
        // Try to find token by ticket? not stored; can't map directly without tracking
        // For now, no-op - tickets would need to be stored
      }
    }
  }
}
