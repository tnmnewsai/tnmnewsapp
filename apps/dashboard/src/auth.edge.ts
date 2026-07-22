import NextAuth from "next-auth";
import { authConfigEdge } from "@svt/auth/edge";

/**
 * Edge-safe auth instance for middleware only — no Credentials provider, so
 * no Prisma import reaches the Edge runtime. Route handlers, server
 * components, and server actions use the full instance in `./auth.ts`.
 */
export const { auth } = NextAuth(authConfigEdge);
