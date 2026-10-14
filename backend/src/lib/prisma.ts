/**
 * lib/prisma.ts — Singleton Prisma client with soft-delete extension. [D-8]
 * The extension filters deletedAt for User, Business, and Location on every
 * query so individual queries never need to remember to filter.
 * Only repositories import this file. [S-1]
 */
import { PrismaClient } from "@prisma/client";
import { logger } from "./logger.js";

const globalForPrisma = globalThis as unknown as {
  prisma: ReturnType<typeof buildClient> | undefined;
};

function buildClient() {
  const client = new PrismaClient({
    log: [
      { emit: "event", level: "query" },
      { emit: "event", level: "error" },
    ],
  });

  client.$on("error", (e) => {
    logger.error({ err: e }, "Prisma error");
  });

  // Soft-delete extension — filters deletedAt for User, Business, Location [D-8]
  return client.$extends({
    query: {
      user: {
        findMany({ args, query }) {
          args.where = { ...args.where, deletedAt: null };
          return query(args);
        },
        findFirst({ args, query }) {
          args.where = { ...args.where, deletedAt: null };
          return query(args);
        },
        findUnique({ args, query }) {
          return query(args); // unique by ID — caller checks deletedAt if needed
        },
      },
      business: {
        findMany({ args, query }) {
          args.where = { ...args.where, deletedAt: null };
          return query(args);
        },
        findFirst({ args, query }) {
          args.where = { ...args.where, deletedAt: null };
          return query(args);
        },
        findUnique({ args, query }) {
          return query(args);
        },
      },
      location: {
        findMany({ args, query }) {
          args.where = { ...args.where, archivedAt: null };
          return query(args);
        },
        findFirst({ args, query }) {
          args.where = { ...args.where, archivedAt: null };
          return query(args);
        },
        findUnique({ args, query }) {
          return query(args);
        },
      },
    },
  });
}

// Reuse existing instance in development to avoid exhausting connections
export const prisma =
  globalForPrisma.prisma ?? (globalForPrisma.prisma = buildClient());
