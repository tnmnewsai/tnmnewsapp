"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@svt/db";
import { decryptToken, encryptToken } from "@svt/publishing-core";
import { findYouTubeChannelById } from "@svt/publishing-youtube";
import { requireCurrentBrand } from "@/lib/current-brand";

interface PendingGoogleToken {
  accessToken: string;
  refreshToken: string;
  expiresAt: string;
}

async function readPendingToken(): Promise<PendingGoogleToken> {
  const cookieStore = await cookies();
  const raw = cookieStore.get("youtube_pending_token")?.value;
  if (!raw) {
    throw new Error("Your Google connection session expired — reconnect from the Platforms page.");
  }
  return JSON.parse(decryptToken(raw)) as PendingGoogleToken;
}

/** Finalizes the YouTube connection once the user picks a specific channel from the picker. */
export async function chooseYouTubeChannel(channelId: string): Promise<void> {
  const brand = await requireCurrentBrand();
  const pending = await readPendingToken();

  const { externalAccountId, label } = await findYouTubeChannelById(pending.accessToken, channelId);

  await prisma.platformAccount.upsert({
    where: {
      brandId_platform_externalAccountId: {
        brandId: brand.id,
        platform: "YOUTUBE",
        externalAccountId,
      },
    },
    update: {
      label,
      accessTokenEnc: encryptToken(pending.accessToken),
      refreshTokenEnc: encryptToken(pending.refreshToken),
      tokenExpiresAt: new Date(pending.expiresAt),
      status: "CONNECTED",
    },
    create: {
      brandId: brand.id,
      platform: "YOUTUBE",
      externalAccountId,
      label,
      accessTokenEnc: encryptToken(pending.accessToken),
      refreshTokenEnc: encryptToken(pending.refreshToken),
      tokenExpiresAt: new Date(pending.expiresAt),
    },
  });

  const cookieStore = await cookies();
  cookieStore.delete("youtube_pending_token");

  redirect("/platforms?connected=YouTube");
}
