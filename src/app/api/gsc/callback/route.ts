import { NextRequest, NextResponse } from "next/server";
import { exchangeCode, getRedirectUri, getOrigin } from "@/lib/gsc";

// Runs as a Netlify Function (Node runtime). Handles the OAuth redirect back
// from Google: swaps the code for a refresh token and stores it in an httpOnly
// cookie (never exposed to client JS).
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const COOKIE_NAME = "gsc_rt";
const THIRTY_DAYS = 60 * 60 * 24 * 30;

export async function GET(req: NextRequest) {
  const origin = getOrigin(req);
  const redirect = (path: string) => NextResponse.redirect(`${origin}${path}`, 302);

  const params = req.nextUrl.searchParams;

  // User denied consent or Google returned an error.
  const oauthError = params.get("error");
  if (oauthError) {
    return redirect(`/gsc?error=${encodeURIComponent(oauthError)}`);
  }

  const code = params.get("code");
  if (!code) {
    return redirect(`/gsc?error=${encodeURIComponent("kein_code")}`);
  }

  // CSRF: the state we returned must match the one we set before the redirect.
  const state = params.get("state");
  const savedState = req.cookies.get("gsc_state")?.value;
  if (savedState && state && savedState !== state) {
    return redirect(`/gsc?error=${encodeURIComponent("state_ungueltig")}`);
  }

  try {
    const redirectUri = getRedirectUri(req);
    const tokens = await exchangeCode(code, redirectUri);

    if (!tokens.refresh_token) {
      // Google only hands out a refresh_token on first consent; prompt=consent
      // forces it, so this normally only happens if the app was pre-authorized.
      return redirect(`/gsc?error=${encodeURIComponent("kein_refresh_token")}`);
    }

    const res = NextResponse.redirect(`${origin}/gsc?connected=1`, 302);
    res.cookies.set(COOKIE_NAME, tokens.refresh_token, {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
      maxAge: THIRTY_DAYS,
    });
    // Clear the one-time state cookie.
    res.cookies.set("gsc_state", "", { httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: 0 });
    return res;
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "unbekannter_fehler";
    return redirect(`/gsc?error=${encodeURIComponent(msg)}`);
  }
}
