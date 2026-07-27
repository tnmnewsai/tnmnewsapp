import bcrypt from "bcryptjs";
import type { NextAuthConfig } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { prisma } from "@svt/db";
import { authConfigEdge } from "./edge";

export { can } from "./rbac";
export type { Capability, MembershipLike } from "./rbac";
export { authConfigEdge } from "./edge";

/** Same bcrypt used by the Credentials provider's compare() above — signup hashes with this, login verifies against it. */
export function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

/**
 * Full Auth.js config (Node runtime only — pulls in Prisma/bcrypt via the
 * Credentials provider). Use this in route handlers and server components.
 * Middleware must use `./edge`'s `authConfigEdge` instead, since Prisma's
 * engine can't run in the Edge runtime.
 */
export const authConfig: NextAuthConfig = {
  ...authConfigEdge,
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      authorize: async (credentials) => {
        const email = credentials?.email;
        const password = credentials?.password;
        if (typeof email !== "string" || typeof password !== "string") return null;

        const user = await prisma.user.findUnique({ where: { email } });
        if (!user) return null;

        const valid = await bcrypt.compare(password, user.passwordHash);
        if (!valid) return null;

        return { id: user.id, email: user.email, name: user.name };
      },
    }),
  ],
};
