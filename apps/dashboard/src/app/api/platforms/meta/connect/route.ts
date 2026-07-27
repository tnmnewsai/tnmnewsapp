import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { getMetaAuthUrl } from "@svt/publishing-meta";
import { resolvePlatformAppCredentials } from "@svt/workflow/client";
import { requireCurrentBrand } from "@/lib/current-brand";

function redirectUri(): string {
  const base = process.env.APP_BASE_URL ?? "http://localhost:3000";
  return `${base}/api/platforms/meta/callback`;
}

/** Kicks off the Facebook Login redirect. Same CSRF-only `state` cookie pattern as the YouTube connect route. */
export async function GET(req: Request) {
  const brand = await requireCurrentBrand();

  try {
    const credentials = await resolvePlatformAppCredentials(brand.accountId, "META");
    const state = crypto.randomBytes(16).toString("hex");
    const { url } = getMetaAuthUrl(credentials, redirectUri(), state);

    const response = NextResponse.redirect(url);
    response.cookies.set("meta_oauth_state", state, {
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
