import type { NextConfig } from "next";

// Prisma's client lives at packages/db/generated/client (a custom output
// path, not the default node_modules/.prisma/client), and this app runs on
// Next.js 16's Turbopack builder by default — its file tracing doesn't
// automatically know the query engine binary is needed at runtime, so it
// gets dropped from the deployed serverless function on Vercel. Explicitly
// including it here fixes "could not locate the Query Engine" in production.
const nextConfig: NextConfig = {
  outputFileTracingIncludes: {
    "/**/*": ["../../packages/db/generated/client/**/*"],
  },
};

export default nextConfig;
