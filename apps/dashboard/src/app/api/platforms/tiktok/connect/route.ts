import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { getTikTokAuthUrl } from "@svt/publishing-tiktok";
import { resolvePlatformAppCredentials } from "@svt/workflow/client";
import { requireCurrentBrand } from "@/lib/current-brand";

function redirectUri(): string {
  const base = process.env.APP_BASE_URL ?? "http://localhost:3000";
  return `${base}/api/platforms/tiktok/callback`;
}

/** Kicks off the TikTok Login Kit redirect. Same CSRF-only `state` cookie pattern as the YouTube/Meta connect routes. */
export async function GET(req: Request) {
  const brand = await requireCurrentBrand();

  try {
    const credentials = await resolvePlatformAppCredentials(brand.accountId, "TIKTOK");
    const state = crypto.randomBytes(16).toString("hex");
    const { url } = getTikTokAuthUrl(credentials, redirectUri(), state);

    const response = NextResponse.redirect(url);
    response.cookies.set("tiktok_oauth_state", state, {
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
