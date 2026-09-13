import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const error = url.searchParams.get("error");
  const errorDescription = url.searchParams.get("error_description");
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");

  if (error) {
    const target = new URL("/admin", request.url);
    target.searchParams.set("microsoft", "error");
    target.searchParams.set(
      "message",
      errorDescription || error || "Microsoft authorization was not completed."
    );
    return NextResponse.redirect(target);
  }

  const cookieStore = await cookies();
  const expectedState = cookieStore.get("gm_ms_state")?.value;

  if (!code || !state || !expectedState || state !== expectedState) {
    const target = new URL("/admin", request.url);
    target.searchParams.set("microsoft", "error");
    target.searchParams.set("message", "Microsoft sign-in validation failed.");
    return NextResponse.redirect(target);
  }

  const tenant = process.env.MICROSOFT_TENANT_ID;
  const clientId = process.env.MICROSOFT_CLIENT_ID;
  const clientSecret = process.env.MICROSOFT_CLIENT_SECRET;

  if (!tenant || !clientId || !clientSecret) {
    return NextResponse.json(
      { error: "Microsoft connection is not fully configured in Vercel." },
      { status: 500 }
    );
  }

  const redirectUri = new URL("/api/microsoft/callback", request.url).toString();
  const tokenResponse = await fetch(
    `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
        scope:
          "openid profile email offline_access User.Read Mail.Read Calendars.Read",
      }),
      cache: "no-store",
    }
  );

  const token = await tokenResponse.json();

  if (!tokenResponse.ok || !token.access_token) {
    const target = new URL("/admin", request.url);
    target.searchParams.set("microsoft", "error");
    target.searchParams.set(
      "message",
      token.error_description || token.error || "Microsoft token exchange failed."
    );
    return NextResponse.redirect(target);
  }

  const response = NextResponse.redirect(new URL("/admin?microsoft=connected", request.url));
  response.cookies.delete("gm_ms_state");
  response.cookies.set("gm_ms_access", token.access_token, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: Math.max(60, Number(token.expires_in || 3600) - 60),
  });

  if (token.refresh_token) {
    response.cookies.set("gm_ms_refresh", token.refresh_token, {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 90,
    });
  }

  return response;
}
