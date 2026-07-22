import { PrismaClient } from "../generated/client";

declare global {
  // eslint-disable-next-line no-var
  var __svtPrisma: PrismaClient | undefined;
}

export const prisma = globalThis.__svtPrisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalThis.__svtPrisma = prisma;
}

export * from "../generated/client";
