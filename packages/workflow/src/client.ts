import { Inngest } from "inngest";

/**
 * Shared across every app: apps/dashboard sends events (`inngest.send(...)`),
 * apps/worker serves the functions that handle them. In local dev, with no
 * signing key configured, the SDK talks to the local Inngest Dev Server
 * (`npx inngest-cli dev`) automatically — no account needed.
 */
export const inngest = new Inngest({ id: "svt" });
