import { NextResponse } from "next/server";
import { randomUUID } from "crypto";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const tenant = process.env.MICROSOFT_TENANT_ID;
  const clientId = process.env.MICROSOFT_CLIENT_ID;

  if (!tenant || !clientId) {
    return NextResponse.json(
      { error: "Microsoft connection is not configured in Vercel." },
      { status: 500 }
    );
  }

  const state = randomUUID();
  const redirectUri = new URL("/api/microsoft/callback", request.url).toString();
  const scopes = [
    "openid",
    "profile",
    "email",
    "offline_access",
    "User.Read",
    "Mail.Read",
    "Calendars.Read",
  ].join(" ");

  const authorize = new URL(
    `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/authorize`
  );
  authorize.searchParams.set("client_id", clientId);
  authorize.searchParams.set("response_type", "code");
  authorize.searchParams.set("redirect_uri", redirectUri);
  authorize.searchParams.set("response_mode", "query");
  authorize.searchParams.set("scope", scopes);
  authorize.searchParams.set("state", state);
  authorize.searchParams.set("prompt", "consent");

  const response = NextResponse.redirect(authorize);
  response.cookies.set("gm_ms_state", state, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 10 * 60,
  });
  return response;
}
