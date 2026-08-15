"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@svt/db";
import { decryptToken, encryptToken } from "@svt/publishing-core";
import { findFacebookPageById } from "@svt/publishing-meta";
import { requireCurrentBrand } from "@/lib/current-brand";

interface PendingFacebookToken {
  accessToken: string;
  expiresAt: string | null;
}

async function readPendingToken(): Promise<PendingFacebookToken> {
  const cookieStore = await cookies();
  const raw = cookieStore.get("facebook_pending_token")?.value;
  if (!raw) {
    throw new Error("Your Facebook connection session expired — reconnect from the Platforms page.");
  }
  return JSON.parse(decryptToken(raw)) as PendingFacebookToken;
}

/** Finalizes the Facebook connection once the user picks a specific Page from the picker. */
export async function chooseFacebookPage(pageId: string): Promise<void> {
  const brand = await requireCurrentBrand();
  const pending = await readPendingToken();

  const { pageAccessToken, pageId: confirmedPageId, label } = await findFacebookPageById(
    pending.accessToken,
    pageId,
  );

  await prisma.platformAccount.upsert({
    where: {
      brandId_platform_externalAccountId: {
        brandId: brand.id,
        platform: "FACEBOOK",
        externalAccountId: confirmedPageId,
      },
    },
    update: {
      label,
      accessTokenEnc: encryptToken(pageAccessToken),
      refreshTokenEnc: encryptToken(pending.accessToken),
      tokenExpiresAt: pending.expiresAt ? new Date(pending.expiresAt) : null,
      status: "CONNECTED",
    },
    create: {
      brandId: brand.id,
      platform: "FACEBOOK",
      externalAccountId: confirmedPageId,
      label,
      accessTokenEnc: encryptToken(pageAccessToken),
      refreshTokenEnc: encryptToken(pending.accessToken),
      tokenExpiresAt: pending.expiresAt ? new Date(pending.expiresAt) : null,
    },
  });

  const cookieStore = await cookies();
  cookieStore.delete("facebook_pending_token");

  redirect("/platforms?connected=Facebook");
}
