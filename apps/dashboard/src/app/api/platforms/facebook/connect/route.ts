import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { getMetaAuthUrl } from "@svt/publishing-meta";
import { resolvePlatformAppCredentials } from "@svt/workflow/client";
import { requireCurrentBrand } from "@/lib/current-brand";

function redirectUri(): string {
  const base = process.env.APP_BASE_URL ?? "http://localhost:3000";
  return `${base}/api/platforms/facebook/callback`;
}

/**
 * Kicks off the Facebook Login redirect for Page publishing — a separate
 * connection from Meta (Instagram) above, but the same registered Meta App
 * and OAuth scopes (`getMetaAuthUrl` is shared), so credentials resolve
 * under "META" (see resolvePlatformAppCredentials's CREDENTIAL_PLATFORM
 * alias), not a distinct "FACEBOOK" credential row.
 */
export async function GET(req: Request) {
  const brand = await requireCurrentBrand();

  try {
    const credentials = await resolvePlatformAppCredentials(brand.accountId, "FACEBOOK");
    const state = crypto.randomBytes(16).toString("hex");
    const { url } = getMetaAuthUrl(credentials, redirectUri(), state);

    const response = NextResponse.redirect(url);
    response.cookies.set("facebook_oauth_state", state, {
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
