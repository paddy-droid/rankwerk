import { NextRequest, NextResponse } from "next/server";
import { isConfigured, refreshAccessToken, listSites, type GscSite } from "@/lib/gsc";

// Runs as a Netlify Function (Node runtime). Reports whether GSC is configured
// and connected, and — when connected — the reachable property list.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

interface StatusResponse {
  configured: boolean;
  connected: boolean;
  sites?: GscSite[];
  error?: string;
}

export async function GET(req: NextRequest) {
  const configured = isConfigured();
  const refreshToken = req.cookies.get("gsc_rt")?.value;
  const connected = !!refreshToken;

  const out: StatusResponse = { configured, connected };

  // Only try to enumerate sites if we can actually authenticate.
  if (configured && connected && refreshToken) {
    try {
      const accessToken = await refreshAccessToken(refreshToken);
      out.sites = await listSites(accessToken);
    } catch (e: unknown) {
      // Tolerant: a revoked/expired token must not 500 the status endpoint.
      out.error = e instanceof Error ? e.message : "Properties konnten nicht geladen werden";
    }
  }

  return NextResponse.json(out);
}
