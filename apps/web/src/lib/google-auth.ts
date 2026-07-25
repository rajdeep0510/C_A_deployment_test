import { OAuth2Client } from "google-auth-library";

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI;

function getClient() {
  if (!CLIENT_ID || !CLIENT_SECRET || !REDIRECT_URI) {
    throw new Error("Google OAuth env vars missing (GOOGLE_CLIENT_ID/SECRET/REDIRECT_URI)");
  }
  return new OAuth2Client({ clientId: CLIENT_ID, clientSecret: CLIENT_SECRET, redirectUri: REDIRECT_URI });
}

export function getGoogleAuthUrl(state: string) {
  return getClient().generateAuthUrl({
    access_type: "online",
    prompt: "select_account",
    scope: ["openid", "email", "profile"],
    state,
  });
}

export type GoogleProfile = {
  sub: string;
  email: string;
  emailVerified: boolean;
  name: string | null;
  picture: string | null;
};

export async function exchangeCodeForProfile(code: string): Promise<GoogleProfile> {
  const client = getClient();
  const { tokens } = await client.getToken(code);
  if (!tokens.id_token) throw new Error("Google response missing id_token");

  const ticket = await client.verifyIdToken({ idToken: tokens.id_token, audience: CLIENT_ID });
  const payload = ticket.getPayload();
  if (!payload?.sub || !payload.email) throw new Error("Google id_token missing sub/email");

  return {
    sub: payload.sub,
    email: payload.email,
    emailVerified: Boolean(payload.email_verified),
    name: payload.name ?? null,
    picture: payload.picture ?? null,
  };
}
