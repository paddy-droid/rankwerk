import { NextRequest, NextResponse } from "next/server";
import { runAudit, type AuditResult } from "@/lib/audit";

// Route runs as a Netlify Function (Node runtime). Keys come from process.env
// (locally via .env.local, on Netlify via the UI env vars). Never leaked to client.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

// ---------------------------------------------------------------------------
// Small helpers (self-contained — audit.ts does not export its internals).
// ---------------------------------------------------------------------------

async function fetchWithTimeout(
  url: string,
  opts: RequestInit & { timeoutMs?: number } = {}
): Promise<Response> {
  const { timeoutMs = 10000, ...rest } = opts;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...rest, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

function hostOf(raw: string): string {
  try {
    let u = raw.trim();
    if (!/^https?:\/\//i.test(u)) u = "https://" + u;
    return new URL(u).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return "";
  }
}

// Rough registrable-domain (last two labels). Good enough for own-domain and
// duplicate filtering — not meant to be a full public-suffix implementation.
function baseDomain(host: string): string {
  const parts = host.split(".").filter(Boolean);
  if (parts.length <= 2) return host;
  return parts.slice(-2).join(".");
}

function normalizeCompUrl(raw: string): string {
  let u = raw.trim();
  if (!/^https?:\/\//i.test(u)) u = "https://" + u;
  return u;
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function joinNames(names: string[]): string {
  if (names.length <= 1) return names[0] || "";
  return names.slice(0, -1).join(", ") + " und " + names[names.length - 1];
}

// Marketplaces / aggregators / socials that are not real competitor shops.
const MARKETPLACES = [
  "amazon.",
  "ebay.",
  "otto.",
  "idealo.",
  "google.",
  "wikipedia.",
  "youtube.",
  "youtu.be",
  "facebook.",
  "instagram.",
  "pinterest.",
  "tiktok.",
  "twitter.",
  "x.com",
  "reddit.",
  "linkedin.",
  "kaufland.",
  "check24.",
  "billiger.de",
  "geizhals.",
  "preisvergleich.",
  "guenstiger.de",
  "trustpilot.",
  "yelp.",
  "bing.",
  "yahoo.",
  "gutefrage.",
  "chip.de",
  "t3n.",
  "medium.com",
  "shopping.google",
];

function isMarketplace(host: string): boolean {
  return MARKETPLACES.some((m) => host === m.replace(/\.$/, "") || host.includes(m));
}

// Map an audit error message to an HTTP status (mirrors the /api/audit route).
function statusForError(message: string): number {
  if (message.startsWith("Shop konnte nicht geladen werden")) return 502;
  if (
    message === "URL erforderlich" ||
    message === "Ungültige URL" ||
    message === "Nur http/https werden unterstützt" ||
    message === "Interne/private Adressen sind nicht erlaubt."
  ) {
    return 400;
  }
  return 500;
}

// ---------------------------------------------------------------------------
// Competitor discovery
// ---------------------------------------------------------------------------

function cleanCompetitors(list: string[], ownHost: string): string[] {
  const ownBase = baseDomain(ownHost);
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of list) {
    const host = hostOf(raw);
    if (!host) continue;
    const base = baseDomain(host);
    if (ownBase && base === ownBase) continue;
    if (isMarketplace(host)) continue;
    if (seen.has(base)) continue;
    seen.add(base);
    out.push(normalizeCompUrl(raw));
    if (out.length >= 3) break;
  }
  return out;
}

// Derive a plausible search query from the own audit result (brand + niche).
function deriveQuery(own: AuditResult): string {
  const brand = (own.shopName || "").trim();
  let base =
    own.stats?.pageTitle && own.stats.pageTitle !== "Fehlt" ? own.stats.pageTitle : "";
  if (brand && base) {
    base = base.replace(new RegExp(escapeRegExp(brand), "ig"), " ");
  }
  const segs = base
    .split(/[|\-–—:•·»<>]+/)
    .map((s) => s.trim())
    .filter(Boolean);
  base = segs.sort((a, b) => b.length - a.length)[0] || base;
  const stop = new Set([
    "online",
    "shop",
    "onlineshop",
    "kaufen",
    "store",
    "der",
    "die",
    "das",
    "und",
    "für",
    "fur",
    "mit",
    "dein",
    "deine",
    "home",
    "startseite",
    "willkommen",
    "offiziell",
  ]);
  const words = base
    .split(/\s+/)
    .map((w) => w.trim())
    .filter((w) => w.length > 1 && !stop.has(w.toLowerCase()))
    .slice(0, 4);
  let core = words.join(" ").trim();
  if (!core) core = brand || own.platform || "online";
  return `${core} shop kaufen`.replace(/\s+/g, " ").trim();
}

function extractShopUrls(items: unknown[], ownHost: string): string[] {
  const ownBase = baseDomain(ownHost);
  const seen = new Set<string>();
  const out: string[] = [];
  for (const it of items) {
    const url =
      it && typeof it === "object" && typeof (it as { url?: unknown }).url === "string"
        ? ((it as { url: string }).url as string)
        : "";
    if (!url) continue;
    const host = hostOf(url);
    if (!host) continue;
    const base = baseDomain(host);
    if (ownBase && base === ownBase) continue;
    if (isMarketplace(host)) continue;
    if (seen.has(base)) continue;
    seen.add(base);
    out.push("https://" + host);
    if (out.length >= 3) break;
  }
  return out;
}

// Jina Search → up to 3 real competitor shop domains. Tolerant: any failure
// (no key, Cloudflare, 000, bad JSON) yields 0 competitors + a clear note.
async function discoverCompetitors(
  own: AuditResult,
  ownHost: string
): Promise<{ urls: string[]; note?: string }> {
  const key = process.env.JINA_API_KEY || "";
  if (key.length < 20) {
    return {
      urls: [],
      note: "Automatische Konkurrenzsuche nicht verfügbar (Jina nicht konfiguriert). Gib Konkurrenten einfach manuell ein.",
    };
  }
  const query = deriveQuery(own);
  try {
    const r = await fetchWithTimeout("https://s.jina.ai/", {
      method: "POST",
      timeoutMs: 12000,
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + key,
        Accept: "application/json",
      },
      body: JSON.stringify({ q: query, hl: "de", gl: "at" }),
    });
    if (!r.ok) {
      return {
        urls: [],
        note: `Automatische Konkurrenzsuche fehlgeschlagen (Jina HTTP ${r.status}). Du kannst Konkurrenten manuell eingeben.`,
      };
    }
    const j: unknown = await r.json().catch(() => null);
    const data = (j as { data?: unknown; results?: unknown })?.data;
    const results = (j as { data?: unknown; results?: unknown })?.results;
    const items: unknown[] = Array.isArray(data)
      ? data
      : Array.isArray(results)
        ? results
        : [];
    const urls = extractShopUrls(items, ownHost);
    if (urls.length === 0) {
      return {
        urls: [],
        note: `Keine passenden Konkurrenten für „${query}“ gefunden. Gib Konkurrenten manuell ein.`,
      };
    }
    return {
      urls,
      note: `${urls.length} Konkurrent${urls.length > 1 ? "en" : ""} automatisch über die Suche „${query}“ gefunden.`,
    };
  } catch {
    return {
      urls: [],
      note: "Automatische Konkurrenzsuche nicht erreichbar. Du kannst Konkurrenten manuell eingeben.",
    };
  }
}

// ---------------------------------------------------------------------------
// Comparison — wins/losses sentences across sub-scores and core checks.
// ---------------------------------------------------------------------------

interface BenchmarkComparison {
  wins: string[];
  losses: string[];
}

const CORE_CHECKS: { label: string; phrase: string }[] = [
  { label: "Structured Data", phrase: "Structured Data (Schema.org)" },
  { label: "HTTPS aktiv", phrase: "sauberes HTTPS" },
  { label: "HSTS-Header", phrase: "den HSTS-Sicherheitsheader" },
  { label: "Content-Security-Policy", phrase: "eine Content-Security-Policy" },
  { label: "llms.txt", phrase: "eine llms.txt (KI-Sichtbarkeit)" },
  { label: "Meta-Description", phrase: "eine optimale Meta-Description" },
  { label: "OpenGraph", phrase: "vollständige OpenGraph-Tags" },
];

function nameOf(a: AuditResult): string {
  return a.shopName || hostOf(a.shopUrl) || "Konkurrent";
}

function subScoreOf(a: AuditResult, label: string): number | null {
  const s = a.subScores.find((x) => x.label === label);
  return s ? s.score : null;
}

function checkOk(a: AuditResult, label: string): boolean | null {
  const c = a.checks.find((x) => x.label === label);
  return c ? c.ok : null;
}

function buildComparison(
  own: AuditResult,
  competitors: AuditResult[]
): BenchmarkComparison {
  const wins: string[] = [];
  const losses: string[] = [];
  if (competitors.length === 0) return { wins, losses };

  // Overall score first (most emotional signal).
  let bestTotal = -1;
  let bestTotalName = "";
  for (const c of competitors) {
    if (c.score > bestTotal) {
      bestTotal = c.score;
      bestTotalName = nameOf(c);
    }
  }
  if (bestTotal >= 0) {
    if (own.score > bestTotal) {
      wins.push(
        `Dein Gesamt-Score (${own.score}/100) liegt über allen Konkurrenten – der stärkste (${bestTotalName}) kommt nur auf ${bestTotal}/100.`
      );
    } else if (bestTotal > own.score) {
      losses.push(
        `${bestTotalName} hat mit ${bestTotal}/100 den höheren Gesamt-Score als dein Shop (${own.score}/100).`
      );
    }
  }

  // Sub-scores: compare against the strongest competitor per label.
  const MARGIN = 6;
  for (const s of own.subScores) {
    const label = s.label;
    const ownS = s.score;
    let bestScore = -1;
    let bestName = "";
    for (const c of competitors) {
      const cs = subScoreOf(c, label);
      if (cs === null) continue;
      if (cs > bestScore) {
        bestScore = cs;
        bestName = nameOf(c);
      }
    }
    if (bestScore < 0) continue;
    if (ownS >= bestScore + MARGIN) {
      wins.push(
        `Bei „${label}“ führst du mit ${ownS}/100 – der stärkste Konkurrent (${bestName}) kommt nur auf ${bestScore}/100.`
      );
    } else if (bestScore >= ownS + MARGIN) {
      losses.push(
        `Bei „${label}“ liegt ${bestName} mit ${bestScore}/100 vor dir (${ownS}/100).`
      );
    }
  }

  // Core checks: binary have/have-not.
  for (const { label, phrase } of CORE_CHECKS) {
    const ownOk = checkOk(own, label);
    if (ownOk === null) continue;
    const withIt = competitors.filter((c) => checkOk(c, label) === true).map(nameOf);
    const withoutIt = competitors.filter((c) => checkOk(c, label) === false).map(nameOf);
    if (ownOk && withoutIt.length > 0) {
      wins.push(
        `Du hast ${phrase} – ${joinNames(withoutIt)} ${withoutIt.length > 1 ? "haben" : "hat"} das nicht.`
      );
    } else if (!ownOk && withIt.length > 0) {
      losses.push(
        `${joinNames(withIt)} ${withIt.length > 1 ? "haben" : "hat"} ${phrase} – du nicht.`
      );
    }
  }

  return { wins, losses };
}

// ---------------------------------------------------------------------------
// POST — run the benchmark
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}) as Record<string, unknown>);
  const rawUrl = (body as { url?: unknown }).url;
  if (!rawUrl || typeof rawUrl !== "string" || !rawUrl.trim()) {
    return NextResponse.json({ error: "URL erforderlich" }, { status: 400 });
  }

  const provided = Array.isArray((body as { competitors?: unknown }).competitors)
    ? ((body as { competitors?: unknown }).competitors as unknown[])
        .filter((c): c is string => typeof c === "string" && c.trim().length > 0)
        .map((c) => c.trim())
    : [];

  const ownHost = hostOf(rawUrl);

  // Kick off the FULL own audit immediately (with AI).
  const ownPromise = runAudit(rawUrl);

  let ownResult: AuditResult;
  let competitorUrls: string[] = [];
  let note: string | undefined;
  let competitorResults: AuditResult[] = [];

  if (provided.length > 0) {
    // Manual competitors: own + all competitors run fully in parallel.
    competitorUrls = cleanCompetitors(provided, ownHost);
    if (competitorUrls.length === 0) {
      note =
        "Die angegebenen Konkurrenten konnten nicht verwendet werden (eigene Domain oder Marktplatz).";
    }
    const settled = await Promise.all([
      ownPromise,
      ...competitorUrls.map((c) => runAudit(c, { skipAi: true, budgetMs: 12000 })),
    ]);
    const own = settled[0];
    if ("error" in own) {
      return NextResponse.json(
        { error: own.error },
        { status: statusForError(own.error) }
      );
    }
    ownResult = own;
    competitorResults = settled
      .slice(1)
      .filter((r): r is AuditResult => !("error" in r));
  } else {
    // Auto-discovery needs the own result first to derive the search term.
    const own = await ownPromise;
    if ("error" in own) {
      return NextResponse.json(
        { error: own.error },
        { status: statusForError(own.error) }
      );
    }
    ownResult = own;
    const disc = await discoverCompetitors(own, ownHost);
    competitorUrls = disc.urls;
    note = disc.note;
    if (competitorUrls.length > 0) {
      const settled = await Promise.all(
        competitorUrls.map((c) => runAudit(c, { skipAi: true, budgetMs: 12000 }))
      );
      competitorResults = settled.filter((r): r is AuditResult => !("error" in r));
    }
  }

  // If some competitor audits failed, surface it transparently.
  if (competitorUrls.length > 0 && competitorResults.length < competitorUrls.length) {
    const failed = competitorUrls.length - competitorResults.length;
    const extra = `${failed} Konkurrent${failed > 1 ? "en" : ""} konnte${failed > 1 ? "n" : ""} nicht geladen werden.`;
    note = note ? `${note} ${extra}` : extra;
  }
  if (competitorResults.length === 0 && !note) {
    note = "Aktuell keine Konkurrenten zum Vergleich verfügbar.";
  }

  const comparison = buildComparison(ownResult, competitorResults);

  return NextResponse.json({
    own: ownResult,
    competitors: competitorResults,
    comparison,
    ...(note ? { note } : {}),
  });
}
