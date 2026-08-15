import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { encryptToken } from "@svt/publishing-core";
import { exchangeCodeForUserToken } from "@svt/publishing-meta";
import { resolvePlatformAppCredentials } from "@svt/workflow/client";
import { requireCurrentBrand } from "@/lib/current-brand";

function redirectUri(): string {
  const base = process.env.APP_BASE_URL ?? "http://localhost:3000";
  return `${base}/api/platforms/facebook/callback`;
}

/**
 * Unlike the other three platforms' callbacks, this doesn't finish the
 * connection directly — Facebook Page publishing needs the user to pick
 * WHICH Page (an account can manage several unrelated ones), so this only
 * exchanges the code for a long-lived user token, stashes it in a
 * short-lived cookie, and hands off to /platforms/facebook/choose-page.
 */
export async function GET(req: NextRequest) {
  await requireCurrentBrand();

  const code = req.nextUrl.searchParams.get("code");
  const state = req.nextUrl.searchParams.get("state");
  const cookieState = req.cookies.get("facebook_oauth_state")?.value;

  if (!code) {
    return NextResponse.redirect(new URL("/platforms?error=Facebook%20did%20not%20return%20an%20auth%20code.", req.url));
  }
  if (!state || !cookieState || state !== cookieState) {
    return NextResponse.redirect(new URL("/platforms?error=OAuth%20state%20mismatch%2C%20try%20connecting%20again.", req.url));
  }

  try {
    const brand = await requireCurrentBrand();
    const credentials = await resolvePlatformAppCredentials(brand.accountId, "FACEBOOK");
    const longLived = await exchangeCodeForUserToken(credentials, code, redirectUri());

    const pending = JSON.stringify({
      accessToken: longLived.accessToken,
      expiresAt: longLived.expiresAt ? longLived.expiresAt.toISOString() : null,
    });

    const response = NextResponse.redirect(new URL("/platforms/facebook/choose-page", req.url));
    response.cookies.delete("facebook_oauth_state");
    response.cookies.set("facebook_pending_token", encryptToken(pending), {
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
