// Google Search Console (GSC) helpers — pure Node/TS, no Next imports here so the
// module stays reusable. OAuth client credentials come from process.env
// (locally via .env.local, on Netlify via the UI env vars). Secrets NEVER reach
// the client: only the route handlers import this, and they only return booleans
// and already-public data (site list, aggregated metrics).

const AUTH_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
const SITES_ENDPOINT = "https://www.googleapis.com/webmasters/v3/sites";
export const GSC_SCOPE = "https://www.googleapis.com/auth/webmasters.readonly";

// ---------------------------------------------------------------------------
// Small, dependency-free JSON coercion helpers (keeps us off `any`).
// ---------------------------------------------------------------------------

function asRecord(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" ? (v as Record<string, unknown>) : {};
}
function str(v: unknown): string {
  return typeof v === "string" ? v : v == null ? "" : String(v);
}
function num(v: unknown): number {
  return typeof v === "number" && Number.isFinite(v) ? v : 0;
}

// ---------------------------------------------------------------------------
// Config / origin
// ---------------------------------------------------------------------------

/** True only when both OAuth client credentials are present. */
export function isConfigured(): boolean {
  return !!(process.env.GSC_CLIENT_ID && process.env.GSC_CLIENT_SECRET);
}

/**
 * Resolve the public origin of the deployment, honouring the proxy headers
 * Netlify sets. Falls back to the parsed request URL.
 */
export function getOrigin(req: Request): string {
  const h = req.headers;
  const proto = h.get("x-forwarded-proto") || "https";
  const host = h.get("x-forwarded-host") || h.get("host") || "";
  if (host) return `${proto}://${host}`;
  try {
    return new URL(req.url).origin;
  } catch {
    return "";
  }
}

/**
 * The OAuth redirect URI. Prefer an explicit env var (it must match EXACTLY the
 * value registered in the Google Cloud Console); otherwise derive it from the
 * request origin.
 */
export function getRedirectUri(req: Request): string {
  const explicit = process.env.GSC_REDIRECT_URI;
  if (explicit && explicit.trim()) return explicit.trim();
  return `${getOrigin(req)}/api/gsc/callback`;
}

// ---------------------------------------------------------------------------
// OAuth
// ---------------------------------------------------------------------------

/** Build the Google consent-screen URL (offline access → returns a refresh token). */
export function buildAuthUrl(state: string, redirectUri: string): string {
  const params = new URLSearchParams({
    client_id: process.env.GSC_CLIENT_ID || "",
    redirect_uri: redirectUri,
    response_type: "code",
    scope: GSC_SCOPE,
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
    state,
  });
  return `${AUTH_ENDPOINT}?${params.toString()}`;
}

export interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  scope?: string;
  token_type?: string;
}

/** Exchange the authorization code for tokens (grant_type=authorization_code). */
export async function exchangeCode(code: string, redirectUri: string): Promise<TokenResponse> {
  const body = new URLSearchParams({
    code,
    client_id: process.env.GSC_CLIENT_ID || "",
    client_secret: process.env.GSC_CLIENT_SECRET || "",
    redirect_uri: redirectUri,
    grant_type: "authorization_code",
  });
  const res = await fetch(TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  const json = asRecord(await res.json().catch(() => ({})));
  if (!res.ok) {
    const msg = str(json.error_description) || str(json.error) || `Token-Austausch fehlgeschlagen (${res.status})`;
    throw new Error(msg);
  }
  return {
    access_token: str(json.access_token),
    refresh_token: json.refresh_token ? str(json.refresh_token) : undefined,
    expires_in: num(json.expires_in),
    scope: str(json.scope),
    token_type: str(json.token_type),
  };
}

/** Trade a refresh token for a fresh short-lived access token (grant_type=refresh_token). */
export async function refreshAccessToken(refreshToken: string): Promise<string> {
  const body = new URLSearchParams({
    refresh_token: refreshToken,
    client_id: process.env.GSC_CLIENT_ID || "",
    client_secret: process.env.GSC_CLIENT_SECRET || "",
    grant_type: "refresh_token",
  });
  const res = await fetch(TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  const json = asRecord(await res.json().catch(() => ({})));
  const accessToken = str(json.access_token);
  if (!res.ok || !accessToken) {
    const msg = str(json.error_description) || str(json.error) || `Token-Refresh fehlgeschlagen (${res.status})`;
    throw new Error(msg);
  }
  return accessToken;
}

// ---------------------------------------------------------------------------
// Search Console Web API
// ---------------------------------------------------------------------------

export interface GscSite {
  siteUrl: string;
  permissionLevel: string;
}

/** List the properties the connected account can read. */
export async function listSites(accessToken: string): Promise<GscSite[]> {
  const res = await fetch(SITES_ENDPOINT, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const json = asRecord(await res.json().catch(() => ({})));
  if (!res.ok) {
    const err = asRecord(json.error);
    throw new Error(str(err.message) || `Sites konnten nicht geladen werden (${res.status})`);
  }
  const entries = Array.isArray(json.siteEntry) ? json.siteEntry : [];
  return entries
    .map((raw) => {
      const e = asRecord(raw);
      return { siteUrl: str(e.siteUrl), permissionLevel: str(e.permissionLevel) };
    })
    .filter((s) => s.siteUrl);
}

export interface AnalyticsRow {
  keys?: string[];
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

/**
 * POST to searchAnalytics/query. `body` is passed through verbatim (startDate,
 * endDate, dimensions, rowLimit, …). Returns the normalized rows.
 */
export async function queryAnalytics(
  accessToken: string,
  siteUrl: string,
  body: Record<string, unknown>,
): Promise<AnalyticsRow[]> {
  const endpoint = `${SITES_ENDPOINT}/${encodeURIComponent(siteUrl)}/searchAnalytics/query`;
  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const json = asRecord(await res.json().catch(() => ({})));
  if (!res.ok) {
    const err = asRecord(json.error);
    throw new Error(str(err.message) || `Search-Analytics-Abfrage fehlgeschlagen (${res.status})`);
  }
  const rows = Array.isArray(json.rows) ? json.rows : [];
  return rows.map((raw) => {
    const r = asRecord(raw);
    return {
      keys: Array.isArray(r.keys) ? r.keys.map((k) => str(k)) : undefined,
      clicks: num(r.clicks),
      impressions: num(r.impressions),
      ctr: num(r.ctr),
      position: num(r.position),
    };
  });
}
