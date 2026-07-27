import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { getXAuthUrl } from "@svt/publishing-x";
import { resolvePlatformAppCredentials } from "@svt/workflow/client";
import { requireCurrentBrand } from "@/lib/current-brand";

function redirectUri(): string {
  const base = process.env.APP_BASE_URL ?? "http://localhost:3000";
  return `${base}/api/platforms/x/callback`;
}

/**
 * Kicks off the X OAuth 2.0 PKCE redirect. Unlike YouTube/Meta/TikTok, X
 * requires a code_verifier alongside `state` — both go in short-lived
 * cookies and get checked/reused at the callback.
 */
export async function GET(req: Request) {
  const brand = await requireCurrentBrand();

  try {
    const credentials = await resolvePlatformAppCredentials(brand.accountId, "X");
    const state = crypto.randomBytes(16).toString("hex");
    const { url, codeVerifier } = getXAuthUrl(credentials, redirectUri(), state);

    const response = NextResponse.redirect(url);
    response.cookies.set("x_oauth_state", state, {
      httpOnly: true,
      maxAge: 600,
      path: "/",
      sameSite: "lax",
    });
    if (codeVerifier) {
      response.cookies.set("x_oauth_code_verifier", codeVerifier, {
        httpOnly: true,
        maxAge: 600,
        path: "/",
        sameSite: "lax",
      });
    }
    return response;
  } catch (err) {
    return NextResponse.redirect(new URL(`/platforms?error=${encodeURIComponent(String(err))}`, req.url));
  }
}
