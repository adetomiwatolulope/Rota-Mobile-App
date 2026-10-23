import { prisma } from "../../lib/prisma.js";

export const settingsRepository = {
  find(userId: string) {
    return prisma.userSettings.findUnique({ where: { userId } });
  },

  createDefault(userId: string) {
    return prisma.userSettings.create({ data: { userId } });
  },

  create(userId: string, data: Record<string, unknown>) {
    return prisma.userSettings.create({ data: { userId, ...data } as never });
  },

  update(userId: string, data: Record<string, unknown>) {
    return prisma.userSettings.update({ where: { userId }, data });
  },
};
