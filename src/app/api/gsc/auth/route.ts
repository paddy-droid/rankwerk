import { NextRequest, NextResponse } from "next/server";
import { isConfigured, getRedirectUri, buildAuthUrl } from "@/lib/gsc";

// Runs as a Netlify Function (Node runtime). Kicks off the OAuth consent flow.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET(req: NextRequest) {
  // Not configured → don't 500, return a helpful JSON hint (200).
  if (!isConfigured()) {
    return NextResponse.json({
      configured: false,
      hint:
        "GSC ist noch nicht eingerichtet: GSC_CLIENT_ID und GSC_CLIENT_SECRET fehlen. " +
        "Lege in der Google Cloud Console einen OAuth-Client (Typ: Web) an, trage die Redirect-URI " +
        "/api/gsc/callback dort ein und hinterlege die beiden Werte in den Netlify-Umgebungsvariablen. " +
        "Details siehe DEPLOY.md / .env.example.",
    });
  }

  const redirectUri = getRedirectUri(req);
  // CSRF state — one-time random token, mirrored in a short-lived cookie and
  // verified in the callback.
  const state = Math.random().toString(36).slice(2) + Date.now().toString(36);
  const url = buildAuthUrl(state, redirectUri);

  const res = NextResponse.redirect(url, 302);
  res.cookies.set("gsc_state", state, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 600, // 10 minutes
  });
  return res;
}
