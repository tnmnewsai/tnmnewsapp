import crypto from "node:crypto";

/** X's OAuth 2.0 user-context flow requires PKCE — unlike YouTube/Meta/TikTok, which don't. */
export function generateCodeVerifier(): string {
  return crypto.randomBytes(32).toString("base64url");
}

export function generateCodeChallenge(verifier: string): string {
  return crypto.createHash("sha256").update(verifier).digest("base64url");
}
