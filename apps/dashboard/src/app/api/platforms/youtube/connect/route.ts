import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { getYouTubeAuthUrl } from "@svt/publishing-youtube";
import { resolvePlatformAppCredentials } from "@svt/workflow/client";
import { requireCurrentBrand } from "@/lib/current-brand";

function redirectUri(): string {
  const base = process.env.APP_BASE_URL ?? "http://localhost:3000";
  return `${base}/api/platforms/youtube/callback`;
}

/** Kicks off the OAuth redirect. A random `state` is stored in a short-lived cookie and checked at the callback — pure CSRF protection, not a data channel. */
export async function GET(req: Request) {
  const brand = await requireCurrentBrand();

  try {
    const credentials = await resolvePlatformAppCredentials(brand.accountId, "YOUTUBE");
    const state = crypto.randomBytes(16).toString("hex");
    const { url } = getYouTubeAuthUrl(credentials, redirectUri(), state);

    const response = NextResponse.redirect(url);
    response.cookies.set("yt_oauth_state", state, {
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
