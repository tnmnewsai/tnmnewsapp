"use server";

import { revalidatePath } from "next/cache";
import { prisma, type Platform, type AiProvider } from "@svt/db";
import { encryptToken } from "@svt/publishing-core";
import { requireCurrentBrand, requireCapability } from "@/lib/current-brand";

export async function disconnectPlatformAccount(platformAccountId: string): Promise<void> {
  const brand = await requireCurrentBrand();

  const account = await prisma.platformAccount.findFirst({
    where: { id: platformAccountId, brandId: brand.id },
  });
  if (!account) throw new Error("Account not found.");

  await prisma.platformAccount.update({
    where: { id: platformAccountId },
    data: { status: "DISCONNECTED" },
  });

  revalidatePath("/platforms");
}

/**
 * The registered OAuth app's Client ID/Secret (one per platform per
 * Account — a company registers a single app used to connect every brand
 * under it). Gated on brand:manage since these are sensitive, account-wide
 * developer credentials, not per-brand connection state.
 */
export async function savePlatformAppCredentials(
  platform: Platform,
  clientId: string,
  clientSecret: string,
): Promise<void> {
  const { brand } = await requireCapability("brand:manage");

  const trimmedId = clientId.trim();
  const trimmedSecret = clientSecret.trim();
  if (!trimmedId || !trimmedSecret) {
    throw new Error("Both Client ID and Client Secret are required.");
  }

  await prisma.platformAppCredential.upsert({
    where: { accountId_platform: { accountId: brand.accountId, platform } },
    update: { clientIdEnc: encryptToken(trimmedId), clientSecretEnc: encryptToken(trimmedSecret) },
    create: {
      accountId: brand.accountId,
      platform,
      clientIdEnc: encryptToken(trimmedId),
      clientSecretEnc: encryptToken(trimmedSecret),
    },
  });

  revalidatePath("/platforms");
}

export async function deletePlatformAppCredentials(platform: Platform): Promise<void> {
  const { brand } = await requireCapability("brand:manage");
  await prisma.platformAppCredential.deleteMany({ where: { accountId: brand.accountId, platform } });
  revalidatePath("/platforms");
}

/**
 * One API key per AI provider per Account — each account's transcription,
 * clip-candidate detection, post-copy, and blog-to-video generation runs on
 * its own key/bill once configured. Same brand:manage gate as the platform
 * app credentials above.
 */
export async function saveAiProviderCredential(provider: AiProvider, apiKey: string): Promise<void> {
  const { brand } = await requireCapability("brand:manage");

  const trimmed = apiKey.trim();
  if (!trimmed) throw new Error("API key is required.");

  await prisma.aiProviderCredential.upsert({
    where: { accountId_provider: { accountId: brand.accountId, provider } },
    update: { apiKeyEnc: encryptToken(trimmed) },
    create: { accountId: brand.accountId, provider, apiKeyEnc: encryptToken(trimmed) },
  });

  revalidatePath("/platforms");
}

export async function deleteAiProviderCredential(provider: AiProvider): Promise<void> {
  const { brand } = await requireCapability("brand:manage");
  await prisma.aiProviderCredential.deleteMany({ where: { accountId: brand.accountId, provider } });
  revalidatePath("/platforms");
}
