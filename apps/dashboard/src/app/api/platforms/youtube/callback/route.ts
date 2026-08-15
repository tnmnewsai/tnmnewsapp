import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { encryptToken } from "@svt/publishing-core";
import { exchangeCodeForGoogleTokens } from "@svt/publishing-youtube";
import { resolvePlatformAppCredentials } from "@svt/workflow/client";
import { requireCurrentBrand } from "@/lib/current-brand";

function redirectUri(): string {
  const base = process.env.APP_BASE_URL ?? "http://localhost:3000";
  return `${base}/api/platforms/youtube/callback`;
}

/**
 * A Google account can own several YouTube channels (a personal one plus
 * one or more Brand Channels) — this only exchanges the code for a
 * token pair and stashes it in a short-lived cookie, handing off to
 * /platforms/youtube/choose-channel to let the user pick which channel
 * this brand publishes to, rather than defaulting to whichever channel
 * the API happens to list first.
 */
export async function GET(req: NextRequest) {
  await requireCurrentBrand();

  const code = req.nextUrl.searchParams.get("code");
  const state = req.nextUrl.searchParams.get("state");
  const cookieState = req.cookies.get("yt_oauth_state")?.value;

  if (!code) {
    return NextResponse.redirect(new URL("/platforms?error=Google%20did%20not%20return%20an%20auth%20code.", req.url));
  }
  if (!state || !cookieState || state !== cookieState) {
    return NextResponse.redirect(new URL("/platforms?error=OAuth%20state%20mismatch%2C%20try%20connecting%20again.", req.url));
  }

  try {
    const brand = await requireCurrentBrand();
    const credentials = await resolvePlatformAppCredentials(brand.accountId, "YOUTUBE");
    const tokens = await exchangeCodeForGoogleTokens(credentials, code, redirectUri());

    if (!tokens.refreshToken) {
      throw new Error(
        "Google didn't return a refresh token — this can happen on a repeat connect. Revoke this app's access at " +
          "https://myaccount.google.com/permissions and try connecting again.",
      );
    }

    const pending = JSON.stringify({
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresAt: tokens.expiresAt.toISOString(),
    });

    const response = NextResponse.redirect(new URL("/platforms/youtube/choose-channel", req.url));
    response.cookies.delete("yt_oauth_state");
    response.cookies.set("youtube_pending_token", encryptToken(pending), {
      httpOnly: true,
      maxAge: 600,
      path: "/",
      sameSite: "lax",
    });
    return response;
  } catch (err) {
    return NextResponse.redirect(new URL(`/platforms?error=${encodeURIComponent(String(err))}`, req.url));
  }
}
