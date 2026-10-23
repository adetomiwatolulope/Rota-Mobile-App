/**
 * modules/shifts/shifts.repository.ts - Data access for shifts. [S-1]
 * Only repositories import Prisma.
 */
import { prisma } from "../../lib/prisma.js";

export const shiftsRepository = {
  /** Load only what authorization needs before a write. */
  findById(shiftId: string) {
    return prisma.shift.findUnique({
      where: { id: shiftId },
      select: { id: true, businessId: true, status: true },
    });
  },

  /**
   * Delete a DRAFT shift, scoped by business so a stale id can never cross a
   * tenant boundary. deleteMany makes the status + business checks part of the
   * same statement; a concurrent publish turns this into count 0. [A-2, D-3]
   */
  deleteDraft(shiftId: string, businessId: string) {
    return prisma.shift.deleteMany({
      where: { id: shiftId, businessId, status: "DRAFT" },
    });
  },
};
