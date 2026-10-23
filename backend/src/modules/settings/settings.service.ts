/**
 * modules/settings/settings.service.ts - Server-owned user settings. [S-1]
 * Requirement 7: one source of truth, synced to every device, enforced by the
 * notification job. The server stamps `updatedAt`; the most recent write wins.
 * A write that carries an `updatedAt` older than the stored row is rejected
 * with 409 so a stale device cannot silently clobber a newer change.
 */
import { AppError, ErrorCode } from "../../lib/errors.js";
import { settingsRepository } from "./settings.repository.js";
import type { UserSettings } from "@prisma/client";

export type SettingsPatch = {
  timezone?: string;
  language?: string;
  theme?: string;
  quietHoursEnabled?: boolean;
  quietHoursStart?: number | null;
  quietHoursEnd?: number | null;
  shiftChanges?: boolean;
  swaps?: boolean;
  billing?: boolean;
  reminders?: boolean;
  updatedAt?: string;
};

export const settingsService = {
  async get(userId: string): Promise<UserSettings> {
    const existing = await settingsRepository.find(userId);
    if (existing) return existing;
    return settingsRepository.createDefault(userId);
  },

  async update(userId: string, patch: SettingsPatch): Promise<UserSettings> {
    const current = await settingsRepository.find(userId);
    if (current && patch.updatedAt) {
      const clientTs = new Date(patch.updatedAt).getTime();
      const serverTs = current.updatedAt.getTime();
      if (Number.isFinite(clientTs) && clientTs < serverTs - 1000) {
        throw new AppError(
          ErrorCode.CONFLICT,
          409,
          `Settings conflict. Server updatedAt: ${current.updatedAt.toISOString()}`,
        );
      }
    }
    const data = buildUpdate(patch);
    if (!current) {
      return settingsRepository.create(userId, data);
    }
    return settingsRepository.update(userId, data);
  },
};

function buildUpdate(patch: SettingsPatch): Record<string, unknown> {
  const data: Record<string, unknown> = {};
  const assign = (key: keyof SettingsPatch) => {
    if (patch[key] !== undefined) data[key] = patch[key];
  };
  assign("timezone");
  assign("language");
  assign("theme");
  assign("quietHoursEnabled");
  assign("quietHoursStart");
  assign("quietHoursEnd");
  assign("shiftChanges");
  assign("swaps");
  assign("billing");
  assign("reminders");
  return data;
}
