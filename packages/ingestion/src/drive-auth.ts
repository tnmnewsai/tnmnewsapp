import { JWT } from "google-auth-library";

interface ServiceAccountKey {
  client_email: string;
  private_key: string;
}

function loadServiceAccountKey(): ServiceAccountKey | null {
  const base64 = process.env.GOOGLE_SERVICE_ACCOUNT_KEY_BASE64;
  if (!base64) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(Buffer.from(base64, "base64").toString("utf8"));
  } catch {
    throw new Error(
      "GOOGLE_SERVICE_ACCOUNT_KEY_BASE64 is set but isn't valid base64-encoded JSON — " +
        "base64-encode the full service account JSON key file you downloaded from Google Cloud Console.",
    );
  }

  const key = parsed as Partial<ServiceAccountKey>;
  if (!key.client_email || !key.private_key) {
    throw new Error(
      "GOOGLE_SERVICE_ACCOUNT_KEY_BASE64 decoded but is missing client_email/private_key — " +
        "make sure it's the full service account JSON key, not something else.",
    );
  }
  return { client_email: key.client_email, private_key: key.private_key };
}

/**
 * Returns null (not an error) when no service account is configured — callers
 * fall back to unauthenticated public-link access, which is the only thing
 * that worked before this feature existed and still works for anyone who
 * hasn't set up a dedicated Drive.
 */
export async function getDriveAccessToken(): Promise<string | null> {
  const key = loadServiceAccountKey();
  if (!key) return null;

  const client = new JWT({
    email: key.client_email,
    key: key.private_key,
    scopes: ["https://www.googleapis.com/auth/drive.readonly"],
  });

  const { token } = await client.getAccessToken();
  if (!token) throw new Error("Failed to obtain a Google Drive access token from the service account.");
  return token;
}
