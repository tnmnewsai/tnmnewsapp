import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { prisma } from "@svt/db";
import { encryptToken } from "@svt/publishing-core";
import { exchangeMetaCode } from "@svt/publishing-meta";
import { resolvePlatformAppCredentials } from "@svt/workflow/client";
import { requireCurrentBrand } from "@/lib/current-brand";

function redirectUri(): string {
  const base = process.env.APP_BASE_URL ?? "http://localhost:3000";
  return `${base}/api/platforms/meta/callback`;
}

export async function GET(req: NextRequest) {
  const brand = await requireCurrentBrand();

  const code = req.nextUrl.searchParams.get("code");
  const state = req.nextUrl.searchParams.get("state");
  const cookieState = req.cookies.get("meta_oauth_state")?.value;

  if (!code) {
    return NextResponse.redirect(new URL("/platforms?error=Meta%20did%20not%20return%20an%20auth%20code.", req.url));
  }
  if (!state || !cookieState || state !== cookieState) {
    return NextResponse.redirect(new URL("/platforms?error=OAuth%20state%20mismatch%2C%20try%20connecting%20again.", req.url));
  }

  try {
    const credentials = await resolvePlatformAppCredentials(brand.accountId, "META");
    const tokens = await exchangeMetaCode(credentials, code, redirectUri());

    await prisma.platformAccount.upsert({
      where: {
        brandId_platform_externalAccountId: {
          brandId: brand.id,
          platform: "META",
          externalAccountId: tokens.externalAccountId,
        },
      },
      update: {
        label: tokens.label,
        accessTokenEnc: encryptToken(tokens.accessToken),
        refreshTokenEnc: tokens.refreshToken ? encryptToken(tokens.refreshToken) : undefined,
        tokenExpiresAt: tokens.expiresAt,
        status: "CONNECTED",
      },
      create: {
        brandId: brand.id,
        platform: "META",
        externalAccountId: tokens.externalAccountId,
        label: tokens.label,
        accessTokenEnc: encryptToken(tokens.accessToken),
        refreshTokenEnc: tokens.refreshToken ? encryptToken(tokens.refreshToken) : null,
        tokenExpiresAt: tokens.expiresAt,
      },
    });

    const response = NextResponse.redirect(new URL("/platforms?connected=Meta", req.url));
    response.cookies.delete("meta_oauth_state");
    return response;
  } catch (err) {
    return NextResponse.redirect(new URL(`/platforms?error=${encodeURIComponent(String(err))}`, req.url));
  }
}
