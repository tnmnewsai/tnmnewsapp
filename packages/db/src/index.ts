import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/client/client";

declare global {
  // eslint-disable-next-line no-var
  var __svtPrisma: PrismaClient | undefined;
}

// Engine-free Prisma client (engineType = "client" in schema.prisma) — talks
// to Postgres directly via this driver adapter instead of a native Rust
// query engine binary, so there's nothing platform-specific to bundle or
// trace into a serverless deployment.
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });

export const prisma = globalThis.__svtPrisma ?? new PrismaClient({ adapter });

if (process.env.NODE_ENV !== "production") {
  globalThis.__svtPrisma = prisma;
}

export * from "../generated/client/client";
