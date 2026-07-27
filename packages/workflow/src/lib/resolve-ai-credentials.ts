import { prisma } from "@svt/db";
import { decryptToken } from "@svt/publishing-core";

export type AiProvider = "OPENAI" | "ANTHROPIC";

const PROVIDER_LABEL: Record<AiProvider, string> = {
  OPENAI: "OpenAI",
  ANTHROPIC: "Anthropic",
};

/**
 * Strictly per-account, no shared fallback — every account brings its own
 * key so its transcription/clip-detection/copy/blog-to-video generation
 * runs on its own usage and its own bill. Deliberately does NOT fall back
 * to any env var: a shared default would let every self-service signup
 * silently ride on the operator's own key.
 */
export async function resolveAiProviderApiKey(accountId: string, provider: AiProvider): Promise<string> {
  const stored = await prisma.aiProviderCredential.findUnique({
    where: { accountId_provider: { accountId, provider } },
  });
  if (!stored) {
    throw new Error(
      `No ${PROVIDER_LABEL[provider]} API key configured for this account. Add one on the Platforms page.`,
    );
  }
  return decryptToken(stored.apiKeyEnc);
}
