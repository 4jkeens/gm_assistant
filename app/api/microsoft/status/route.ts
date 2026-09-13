import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export const dynamic = "force-dynamic";

async function refreshAccessToken(refreshToken: string) {
  const tenant = process.env.MICROSOFT_TENANT_ID;
  const clientId = process.env.MICROSOFT_CLIENT_ID;
  const clientSecret = process.env.MICROSOFT_CLIENT_SECRET;
  if (!tenant || !clientId || !clientSecret) return null;

  const response = await fetch(
    `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
        grant_type: "refresh_token",
        scope:
          "openid profile email offline_access User.Read Mail.Read Calendars.Read",
      }),
      cache: "no-store",
    }
  );

  if (!response.ok) return null;
  return response.json();
}

export async function GET() {
  const cookieStore = await cookies();
  let accessToken = cookieStore.get("gm_ms_access")?.value || "";
  const refreshToken = cookieStore.get("gm_ms_refresh")?.value || "";
  let refreshed: any = null;

  if (!accessToken && refreshToken) {
    refreshed = await refreshAccessToken(refreshToken);
    accessToken = refreshed?.access_token || "";
  }

  if (!accessToken) {
    return NextResponse.json({ connected: false });
  }

  const graph = await fetch(
    "https://graph.microsoft.com/v1.0/me?$select=displayName,mail,userPrincipalName",
    {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: "no-store",
    }
  );

  if (!graph.ok) {
    return NextResponse.json({ connected: false }, { status: 401 });
  }

  const profile = await graph.json();
  const response = NextResponse.json({
    connected: true,
    name: profile.displayName || "",
    email: profile.mail || profile.userPrincipalName || "",
  });

  if (refreshed?.access_token) {
    response.cookies.set("gm_ms_access", refreshed.access_token, {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
      maxAge: Math.max(60, Number(refreshed.expires_in || 3600) - 60),
    });
  }
  if (refreshed?.refresh_token) {
    response.cookies.set("gm_ms_refresh", refreshed.refresh_token, {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 90,
    });
  }

  return response;
}
