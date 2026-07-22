import type { DefaultSession, NextAuthConfig } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
    } & DefaultSession["user"];
  }
}

/**
 * Edge-safe subset of the auth config — no providers, so nothing here ever
 * imports Prisma/bcrypt. This is the only auth config allowed inside
 * middleware (Edge runtime can't run Prisma's Node engine). The full config
 * in `./index.ts` spreads this and adds the Credentials provider on top for
 * use in route handlers and server components (Node runtime).
 */
export const authConfigEdge: NextAuthConfig = {
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  providers: [],
  callbacks: {
    jwt: async ({ token, user }) => {
      if (user?.id) token.sub = user.id;
      return token;
    },
    session: async ({ session, token }) => {
      if (session.user && token.sub) session.user.id = token.sub;
      return session;
    },
  },
};
