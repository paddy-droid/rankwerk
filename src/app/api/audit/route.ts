import { NextRequest, NextResponse } from "next/server";

// Route runs as a Netlify Function (Node runtime). No filesystem/env-file reads —
// keys come from process.env (locally via .env.local, on Netlify via the UI env vars).
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const GEMINI_MODEL = "gemini-3.5-flash";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Finding {
  category: string;
  severity: "critical" | "warning" | "info" | "good";
  title: string;
  description: string;
  recommendation: string;
}

interface SubScore {
  label: string;
  score: number;
}

interface CheckItem {
  label: string;
  ok: boolean;
  detail: string;
}

interface Performance {
  status: number;
  ttfbMs: number;
  totalMs: number;
  finalUrl: string;
  redirected: boolean;
  server: string;
  https: boolean;
  contentType: string;
  htmlKb: number;
}

interface AiAnalysis {
  shopName?: string;
  score?: number;
  summary?: string;
  findings?: Finding[];
  quickWins?: string[];
}

interface AuditResult {
  shopUrl: string;
  shopName: string;
  platform: string;
  score: number;
  summary: string;
  findings: Finding[];
  stats: {
    products: string;
    pages: string;
    pageTitle: string;
    metaDescription: string;
    hasSchema: boolean;
    hasOpenGraph: boolean;
    loadTime: string;
    mobileOptimized: boolean;
  };
  subScores: SubScore[];
  performance: Performance;
  checks: CheckItem[];
  techStack: string[];
  quickWins: string[];
  schemaTypes: string[];
  generatedAt: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function normalizeUrl(raw: string): string {
  let u = raw.trim();
  if (!/^https?:\/\//i.test(u)) u = "https://" + u;
  return u;
}

// Basic SSRF guard: refuse localhost / private ranges / metadata endpoints.
function isBlockedHost(hostname: string): boolean {
  const h = hostname.toLowerCase();
  if (h === "localhost" || h.endsWith(".local") || h.endsWith(".internal")) return true;
  if (h === "0.0.0.0" || h === "::1" || h === "[::1]") return true;
  if (h === "169.254.169.254" || h === "metadata.google.internal") return true;
  if (/^127\./.test(h)) return true;
  if (/^10\./.test(h)) return true;
  if (/^192\.168\./.test(h)) return true;
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(h)) return true;
  return false;
}

async function fetchWithTimeout(
  url: string,
  opts: RequestInit & { timeoutMs?: number } = {}
): Promise<Response> {
  const { timeoutMs = 15000, ...rest } = opts;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...rest, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

const BROWSER_UA =
  "Mozilla/5.0 (compatible; RankwerkAuditBot/1.0; +https://rankwerk.app) Chrome/124 Safari/537.36";

// Directly fetch the shop page: real timing, redirects, headers + raw HTML.
// Retries once — some hosts intermittently reset the first bot connection.
async function probeSite(url: string): Promise<{
  perf: Performance;
  html: string;
  ok: boolean;
} | null> {
  for (let attempt = 0; attempt < 2; attempt++) {
    const start = Date.now();
    try {
      const res = await fetchWithTimeout(url, {
        timeoutMs: 7000,
        redirect: "follow",
        headers: {
          "User-Agent": BROWSER_UA,
          Accept: "text/html,application/xhtml+xml,*/*",
          "Accept-Language": "de-DE,de;q=0.9,en;q=0.8",
        },
      });
      const ttfb = Date.now() - start;
      // Cap body to ~600 KB to stay memory-safe.
      const buf = await res.arrayBuffer();
      const total = Date.now() - start;
      const bytes = buf.byteLength;
      const html = new TextDecoder("utf-8").decode(buf.slice(0, 600_000));
      const finalUrl = res.url || url;
      return {
        ok: res.ok,
        html,
        perf: {
          status: res.status,
          ttfbMs: ttfb,
          totalMs: total,
          finalUrl,
          redirected: finalUrl.replace(/\/$/, "") !== url.replace(/\/$/, ""),
          server: res.headers.get("server") || res.headers.get("x-powered-by") || "unbekannt",
          https: finalUrl.startsWith("https://"),
          contentType: res.headers.get("content-type") || "",
          htmlKb: Math.round(bytes / 1024),
        },
      };
    } catch {
      // Retry only on a FAST failure (connection reset < 2.5s), never on a
      // genuine timeout — otherwise a slow host would cost two full timeouts.
      const elapsed = Date.now() - start;
      if (attempt === 0 && elapsed < 2500) {
        await new Promise((r) => setTimeout(r, 400));
      } else {
        break;
      }
    }
  }
  return null;
}

interface HtmlSignals {
  title: string;
  metaDescription: string;
  canonical: string;
  lang: string;
  hasViewport: boolean;
  charset: string;
  robotsMeta: string;
  noindex: boolean;
  h1Count: number;
  firstH1: string;
  imgCount: number;
  imgWithAlt: number;
  wordCount: number;
  hasOgTitle: boolean;
  hasOgImage: boolean;
  hasTwitterCard: boolean;
  hasFavicon: boolean;
  hreflangCount: number;
  schemaTypes: string[];
  platform: string;
  techStack: string[];
}

function textContent(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractHtmlSignals(html: string): HtmlSignals {
  const pick = (re: RegExp): string => (html.match(re)?.[1] || "").trim();

  const title = pick(/<title[^>]*>([\s\S]*?)<\/title>/i).replace(/\s+/g, " ");
  const metaDescription = pick(
    /<meta[^>]+name=["']description["'][^>]*content=["']([\s\S]*?)["']/i
  ) || pick(/<meta[^>]+content=["']([\s\S]*?)["'][^>]*name=["']description["']/i);
  const canonical = pick(/<link[^>]+rel=["']canonical["'][^>]*href=["']([^"']+)["']/i);
  const lang = pick(/<html[^>]*\blang=["']([^"']+)["']/i);
  const charset =
    pick(/<meta[^>]+charset=["']?([\w-]+)/i) ||
    pick(/charset=([\w-]+)/i);
  const robotsMeta = pick(/<meta[^>]+name=["']robots["'][^>]*content=["']([^"']+)["']/i);

  const h1Matches = html.match(/<h1[\s>]/gi) || [];
  const firstH1 = textContent(pick(/<h1[^>]*>([\s\S]*?)<\/h1>/i)).slice(0, 120);

  const imgTags = html.match(/<img\b[^>]*>/gi) || [];
  const imgWithAlt = imgTags.filter((t) => /\balt=["'][^"']*\S[^"']*["']/i.test(t)).length;

  const words = textContent(html).split(/\s+/).filter(Boolean);

  // JSON-LD @types
  const schemaTypes = new Set<string>();
  const ldBlocks = html.match(
    /<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi
  ) || [];
  for (const block of ldBlocks) {
    const inner = block.replace(/<[^>]+>/g, "");
    const typeMatches = inner.match(/"@type"\s*:\s*"([^"]+)"/g) || [];
    for (const tm of typeMatches) {
      const t = tm.match(/"@type"\s*:\s*"([^"]+)"/)?.[1];
      if (t) schemaTypes.add(t);
    }
  }

  // Platform + tech fingerprints
  const tech: string[] = [];
  const has = (re: RegExp) => re.test(html);
  let platform = "Unbekannt";
  if (has(/woocommerce|wp-content\/plugins\/woocommerce/i)) platform = "WooCommerce";
  else if (has(/cdn\.shopify|shopify\.com|x-shopify/i)) platform = "Shopify";
  else if (has(/shopware|shopware\.com/i)) platform = "Shopware";
  else if (has(/mage\/|magento|mage-cache/i)) platform = "Magento";
  else if (has(/jtl-shop|jtlshop/i)) platform = "JTL-Shop";
  else if (has(/wix\.com|_wix|wixstatic/i)) platform = "Wix";
  else if (has(/squarespace/i)) platform = "Squarespace";

  if (has(/wp-content|wp-includes/i)) tech.push("WordPress");
  if (has(/elementor/i)) tech.push("Elementor");
  if (has(/next\/static|__NEXT_DATA__/i)) tech.push("Next.js");
  if (has(/gtag\(|googletagmanager\.com/i)) tech.push("Google Analytics/GTM");
  if (has(/cloudflare/i)) tech.push("Cloudflare");
  if (has(/font-awesome|fontawesome/i)) tech.push("Font Awesome");
  if (platform !== "Unbekannt" && !tech.includes(platform)) tech.unshift(platform);

  return {
    title,
    metaDescription,
    canonical,
    lang,
    hasViewport: /<meta[^>]+name=["']viewport["']/i.test(html),
    charset: charset.toUpperCase(),
    robotsMeta,
    noindex: /noindex/i.test(robotsMeta),
    h1Count: h1Matches.length,
    firstH1,
    imgCount: imgTags.length,
    imgWithAlt,
    wordCount: words.length,
    hasOgTitle: /property=["']og:title["']/i.test(html),
    hasOgImage: /property=["']og:image["']/i.test(html),
    hasTwitterCard: /name=["']twitter:card["']/i.test(html),
    hasFavicon: /rel=["'](?:shortcut )?icon["']/i.test(html),
    hreflangCount: (html.match(/rel=["']alternate["'][^>]*hreflang=/gi) || []).length,
    schemaTypes: [...schemaTypes],
    platform,
    techStack: tech,
  };
}

// robots.txt + sitemap.xml presence (fast, parallel, non-fatal).
async function checkFile(
  origin: string,
  path: string
): Promise<{ ok: boolean; body: string }> {
  try {
    const res = await fetchWithTimeout(origin + path, {
      timeoutMs: 6000,
      headers: { "User-Agent": BROWSER_UA },
    });
    if (!res.ok) return { ok: false, body: "" };
    const body = (await res.text()).slice(0, 50_000);
    return { ok: true, body };
  } catch {
    return { ok: false, body: "" };
  }
}

// Jina Reader — used as a FALLBACK when the direct HTML is too thin
// (JS-rendered SPA shops). Returns clean markdown content.
async function fetchJinaReader(
  url: string,
  key: string
): Promise<{ content: string; title: string; url: string } | null> {
  try {
    const r = await fetchWithTimeout("https://r.jina.ai/", {
      method: "POST",
      timeoutMs: 9000,
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + key,
        Accept: "application/json",
        "X-Return-Format": "markdown",
      },
      body: JSON.stringify({ url }),
    });
    if (!r.ok) return null;
    const j = await r.json();
    return {
      content: j?.data?.content || "",
      title: j?.data?.title || "",
      url: j?.data?.url || url,
    };
  } catch {
    return null;
  }
}

function clamp(n: number, lo = 0, hi = 100): number {
  return Math.max(lo, Math.min(hi, Math.round(n)));
}

// Deterministic, reproducible sub-scores from real signals.
function computeSubScores(
  s: HtmlSignals,
  perf: Performance | null,
  robotsOk: boolean,
  sitemapOk: boolean
): SubScore[] {
  // Technik & Performance
  let tech = 100;
  if (!perf) tech -= 40;
  if (perf && !perf.https) tech -= 25;
  if (perf && perf.status >= 400) tech -= 30;
  if (perf && perf.ttfbMs > 1500) tech -= 20;
  else if (perf && perf.ttfbMs > 800) tech -= 10;
  if (!s.hasViewport) tech -= 15;
  if (!s.charset) tech -= 5;
  if (!s.hasFavicon) tech -= 5;

  // SEO-Basis
  let seo = 100;
  const tLen = s.title.length;
  if (!tLen) seo -= 25;
  else if (tLen < 30 || tLen > 65) seo -= 10;
  const dLen = s.metaDescription.length;
  if (!dLen) seo -= 20;
  else if (dLen < 70 || dLen > 165) seo -= 8;
  if (!s.canonical) seo -= 10;
  if (s.h1Count === 0) seo -= 15;
  else if (s.h1Count > 1) seo -= 8;
  if (!s.lang) seo -= 8;
  if (s.noindex) seo -= 40;
  if (!robotsOk) seo -= 6;
  if (!sitemapOk) seo -= 8;

  // Structured Data
  let schema = 40;
  if (s.schemaTypes.length > 0) schema = 70;
  const wanted = ["Product", "Organization", "BreadcrumbList", "WebSite", "FAQPage", "LocalBusiness"];
  schema += wanted.filter((w) => s.schemaTypes.some((t) => t.includes(w))).length * 6;
  if (s.schemaTypes.length === 0) schema = 20;

  // Content
  let content = 100;
  if (s.wordCount < 300) content -= 40;
  else if (s.wordCount < 600) content -= 20;
  if (s.h1Count === 0) content -= 15;
  const altCov = s.imgCount ? s.imgWithAlt / s.imgCount : 1;
  if (altCov < 0.5) content -= 20;
  else if (altCov < 0.8) content -= 10;

  // Social & Trust
  let social = 100;
  if (!s.hasOgTitle) social -= 25;
  if (!s.hasOgImage) social -= 30;
  if (!s.hasTwitterCard) social -= 15;

  return [
    { label: "Technik & Speed", score: clamp(tech) },
    { label: "SEO-Basis", score: clamp(seo) },
    { label: "Structured Data", score: clamp(schema) },
    { label: "Content", score: clamp(content) },
    { label: "Social & Trust", score: clamp(social) },
  ];
}

function buildChecks(
  s: HtmlSignals,
  perf: Performance | null,
  robotsOk: boolean,
  sitemapOk: boolean,
  sitemapUrls: number
): CheckItem[] {
  return [
    { label: "HTTPS aktiv", ok: !!perf?.https, detail: perf?.https ? "Verschlüsselt" : "Kein/ungültiges HTTPS" },
    {
      label: "Title-Tag",
      ok: s.title.length >= 30 && s.title.length <= 65,
      detail: s.title ? `${s.title.length} Zeichen` : "Fehlt",
    },
    {
      label: "Meta-Description",
      ok: s.metaDescription.length >= 70 && s.metaDescription.length <= 165,
      detail: s.metaDescription ? `${s.metaDescription.length} Zeichen` : "Fehlt",
    },
    { label: "Genau 1 H1", ok: s.h1Count === 1, detail: `${s.h1Count} gefunden` },
    { label: "Canonical-URL", ok: !!s.canonical, detail: s.canonical ? "Gesetzt" : "Fehlt" },
    { label: "Viewport (Mobile)", ok: s.hasViewport, detail: s.hasViewport ? "Gesetzt" : "Fehlt" },
    { label: "Sprache (lang)", ok: !!s.lang, detail: s.lang || "Fehlt" },
    { label: "Indexierbar", ok: !s.noindex, detail: s.noindex ? "noindex gesetzt!" : "Ja" },
    { label: "robots.txt", ok: robotsOk, detail: robotsOk ? "Vorhanden" : "Fehlt" },
    {
      label: "sitemap.xml",
      ok: sitemapOk,
      detail: sitemapOk ? `${sitemapUrls || "?"} URLs` : "Fehlt",
    },
    {
      label: "Structured Data",
      ok: s.schemaTypes.length > 0,
      detail: s.schemaTypes.length ? s.schemaTypes.slice(0, 4).join(", ") : "Keine",
    },
    {
      label: "Bild-Alt-Texte",
      ok: s.imgCount === 0 || s.imgWithAlt / s.imgCount >= 0.8,
      detail: s.imgCount ? `${s.imgWithAlt}/${s.imgCount} mit alt` : "Keine Bilder",
    },
    { label: "OpenGraph", ok: s.hasOgTitle && s.hasOgImage, detail: s.hasOgImage ? "Vorhanden" : "Unvollständig" },
  ];
}

function extractJson(text: string): unknown {
  const cleaned = text.replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    const m = cleaned.match(/\{[\s\S]*\}/);
    if (m) {
      try {
        return JSON.parse(m[0]);
      } catch {
        return null;
      }
    }
    return null;
  }
}

// ---------------------------------------------------------------------------
// GET — health check (no secrets leaked, only booleans)
// ---------------------------------------------------------------------------

export function GET() {
  return NextResponse.json({
    service: "rankwerk-audit",
    ok: true,
    model: GEMINI_MODEL,
    env: {
      geminiConfigured: (process.env.GEMINI_API_KEY || "").length > 20,
      jinaConfigured: (process.env.JINA_API_KEY || "").length > 20,
    },
  });
}

// ---------------------------------------------------------------------------
// POST — run the audit
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest) {
  const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "";
  const JINA_API_KEY = process.env.JINA_API_KEY || "";

  // Hard latency budget so the function always returns before the serverless
  // platform (Netlify) kills it. Everything downstream respects this deadline.
  const startedAt = Date.now();
  const BUDGET_MS = 20000;
  const remaining = () => BUDGET_MS - (Date.now() - startedAt);

  try {
    const body = await req.json().catch(() => ({}));
    const rawUrl = (body as { url?: unknown }).url;
    if (!rawUrl || typeof rawUrl !== "string" || !rawUrl.trim()) {
      return NextResponse.json({ error: "URL erforderlich" }, { status: 400 });
    }

    const shopUrl = normalizeUrl(rawUrl);
    let parsed: URL;
    try {
      parsed = new URL(shopUrl);
    } catch {
      return NextResponse.json({ error: "Ungültige URL" }, { status: 400 });
    }
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return NextResponse.json({ error: "Nur http/https werden unterstützt" }, { status: 400 });
    }
    if (isBlockedHost(parsed.hostname)) {
      return NextResponse.json(
        { error: "Interne/private Adressen sind nicht erlaubt." },
        { status: 400 }
      );
    }

    const origin = parsed.origin;

    // ---- Phase 1: fast parallel signals (direct probe + robots + sitemaps).
    // Keeps the common (server-rendered) case fast enough for serverless limits.
    const [probe, robots, sitemapRoot, sitemapIndex] = await Promise.all([
      probeSite(shopUrl),
      checkFile(origin, "/robots.txt"),
      checkFile(origin, "/sitemap.xml"),
      checkFile(origin, "/sitemap_index.xml"),
    ]);

    const html = probe?.html || "";
    const signals = extractHtmlSignals(html);

    // ---- Phase 2: Jina Reader ONLY as a fallback for thin/JS-rendered pages,
    // and only if there's enough time budget left for it + the Gemini call.
    let jina: { content: string; title: string; url: string } | null = null;
    if ((signals.wordCount < 200 || !html) && JINA_API_KEY.length > 20 && remaining() > 12000) {
      jina = await fetchJinaReader(shopUrl, JINA_API_KEY);
    }
    const jinaContent = jina?.content || "";

    // Need at least one source of page content.
    if (!html && !jinaContent) {
      return NextResponse.json(
        { error: "Shop konnte nicht geladen werden (weder direkt noch via Jina erreichbar)." },
        { status: 502 }
      );
    }

    // Sitemap detection: robots.txt "Sitemap:" directive OR either common path
    // (WordPress SEO plugins like RankMath/Yoast serve /sitemap_index.xml).
    const robotsSitemapDecl = (robots.body.match(/^\s*sitemap:\s*\S+/gim) || []).length > 0;
    const sitemapBody = sitemapRoot.ok ? sitemapRoot.body : sitemapIndex.ok ? sitemapIndex.body : "";
    const sitemapOk = sitemapRoot.ok || sitemapIndex.ok || robotsSitemapDecl;
    const sitemapUrls =
      (sitemapBody.match(/<loc>/g) || []).length ||
      (sitemapBody.match(/https?:\/\//g) || []).length ||
      0;

    // Prefer real <title>; fall back to Jina title.
    const pageTitle = signals.title || jina?.title || "";
    const pageUrl = probe?.perf.finalUrl || jina?.url || shopUrl;

    const subScores = computeSubScores(signals, probe?.perf ?? null, robots.ok, sitemapOk);
    const checks = buildChecks(signals, probe?.perf ?? null, robots.ok, sitemapOk, sitemapUrls);

    const deterministicOverall = Math.round(
      subScores.reduce((sum, s) => sum + s.score, 0) / subScores.length
    );

    // Estimate product count from content links.
    const contentForCount = jinaContent || textContent(html);
    const productMatches =
      contentForCount.match(/\/produkt\/|\/product\/|\/products\/|\/artikel\//gi) || [];
    const productCount = Math.min(Math.floor(productMatches.length / 2), 999);

    // ---- Gemini analysis (findings + summary) — non-fatal if it fails -----
    let analysis: AiAnalysis | null = null;

    // Only call Gemini if we have enough of the time budget left (else the
    // deterministic report carries the response and we never risk a timeout).
    if (GEMINI_API_KEY.length > 20 && remaining() > 6000) {
      const contentForAI = (jinaContent || textContent(html)).slice(0, 16000);
      const signalSummary = [
        `Plattform: ${signals.platform}`,
        `Title (${pageTitle.length} Z.): ${pageTitle || "FEHLT"}`,
        `Meta-Description (${signals.metaDescription.length} Z.): ${signals.metaDescription || "FEHLT"}`,
        `H1: ${signals.h1Count} (erste: ${signals.firstH1 || "-"})`,
        `Structured Data: ${signals.schemaTypes.join(", ") || "KEINE"}`,
        `Wortanzahl: ${signals.wordCount}`,
        `Bilder mit Alt: ${signals.imgWithAlt}/${signals.imgCount}`,
        `OpenGraph: ${signals.hasOgImage ? "ja" : "nein"} | Canonical: ${signals.canonical ? "ja" : "nein"} | lang: ${signals.lang || "-"}`,
        `robots.txt: ${robots.ok ? "ja" : "nein"} | sitemap: ${sitemapOk ? "ja" : "nein"}`,
        probe ? `Status ${probe.perf.status}, TTFB ${probe.perf.ttfbMs}ms, HTTPS ${probe.perf.https}` : "Direkt-Probe fehlgeschlagen",
      ].join("\n");

      const prompt =
        "Du bist ein E-Commerce-SEO- und CRO-Experte. Analysiere diesen Online-Shop auf Basis echter, gemessener Signale und des Seiteninhalts.\n\n" +
        `URL: ${shopUrl}\n\nGEMESSENE SIGNALE:\n${signalSummary}\n\n` +
        `SEITENINHALT (gekürzt):\n---\n${contentForAI}\n---\n\n` +
        "Gib NUR valides JSON zurück (keine Erklärung außenrum):\n" +
        '{"shopName":"Markenname","score":0-100,"summary":"2-3 Sätze Gesamteinschätzung","findings":[{"category":"SEO|Content|Structured Data|Performance|Trust|Conversion","severity":"critical|warning|info|good","title":"kurz","description":"konkret auf DIESEN Shop bezogen","recommendation":"konkreter nächster Schritt"}],"quickWins":["3 sofort umsetzbare Maßnahmen mit dem höchsten Hebel"]}\n' +
        "Regeln: 5-7 findings, priorisiert nach Wirkung, knapp formuliert. Beziehe dich konkret auf die gemessenen Signale und den Content. Erfinde keine Fakten. Alles auf Deutsch.";

      try {
        // Give Gemini the remaining budget minus a 2s safety margin for merge/serialize.
        const geminiTimeout = Math.max(4000, Math.min(14000, remaining() - 2000));
        const geminiResponse = await fetchWithTimeout(
          `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`,
          {
            method: "POST",
            timeoutMs: geminiTimeout,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contents: [{ parts: [{ text: prompt }] }],
              generationConfig: {
                temperature: 0.6,
                // Cap "thinking": unbounded reasoning eats the token budget and
                // truncates the JSON output; a small budget keeps it valid + fast.
                thinkingConfig: { thinkingBudget: 512 },
                maxOutputTokens: 2500,
                responseMimeType: "application/json",
              },
            }),
          }
        );
        if (geminiResponse.ok) {
          const geminiData = await geminiResponse.json();
          const geminiText: string =
            geminiData?.candidates?.[0]?.content?.parts?.[0]?.text || "";
          const parsedJson = extractJson(geminiText) as AiAnalysis | null;
          if (parsedJson) analysis = parsedJson;
        }
      } catch {
        // swallow — we fall back to deterministic findings below
      }
    }

    // ---- Deterministic findings (from checks that failed) -----------------
    const deterministicFindings: Finding[] = [];
    if (probe && probe.perf.ttfbMs > 1200) {
      deterministicFindings.push({
        category: "Performance",
        severity: probe.perf.ttfbMs > 2500 ? "critical" : "warning",
        title: `Langsame Serverantwort (${(probe.perf.ttfbMs / 1000).toFixed(2)}s TTFB)`,
        description:
          "Die Zeit bis zum ersten Byte liegt über dem Zielwert von 0,8s. Langsame Antwortzeiten kosten Rankings und Conversions.",
        recommendation:
          "Caching (z.B. WP Rocket / CDN) aktivieren, Server-Ressourcen prüfen, TTFB unter 0,8s bringen.",
      });
    }
    if (signals.noindex) {
      deterministicFindings.push({
        category: "SEO",
        severity: "critical",
        title: "Seite auf noindex gesetzt",
        description: "Der robots-Meta-Tag enthält noindex — die Seite wird aus dem Google-Index ausgeschlossen.",
        recommendation: "noindex entfernen, sofern die Seite ranken soll.",
      });
    }
    if (!signals.metaDescription) {
      deterministicFindings.push({
        category: "SEO",
        severity: "warning",
        title: "Meta-Description fehlt",
        description: "Ohne Meta-Description generiert Google ein zufälliges Snippet — schlechtere CTR.",
        recommendation: "70–160 Zeichen lange, keyword- und nutzenorientierte Description ergänzen.",
      });
    }
    if (signals.schemaTypes.length === 0) {
      deterministicFindings.push({
        category: "Structured Data",
        severity: "warning",
        title: "Kein Structured Data (JSON-LD) gefunden",
        description: "Ohne Schema.org-Markup entgehen dir Rich Results (Sterne, Preise, FAQ) in den Suchergebnissen.",
        recommendation: "Product-, Organization- und BreadcrumbList-Schema als JSON-LD ergänzen.",
      });
    }
    if (signals.imgCount > 0 && signals.imgWithAlt / signals.imgCount < 0.6) {
      deterministicFindings.push({
        category: "Content",
        severity: "info",
        title: `Nur ${signals.imgWithAlt} von ${signals.imgCount} Bildern mit Alt-Text`,
        description: "Fehlende Alt-Texte schaden Barrierefreiheit und Bilder-SEO.",
        recommendation: "Beschreibende Alt-Texte für alle Produkt- und Content-Bilder ergänzen.",
      });
    }

    // Merge AI + deterministic findings, dedupe by title, cap at 12.
    const aiFindings: Finding[] = (analysis?.findings || []).map((f) => ({
      category: f.category || "Allgemein",
      severity: (["critical", "warning", "info", "good"].includes(f.severity) ? f.severity : "info") as Finding["severity"],
      title: f.title || "Finding",
      description: f.description || "",
      recommendation: f.recommendation || "",
    }));
    const seenTitles = new Set<string>();
    const findings: Finding[] = [];
    for (const f of [...deterministicFindings, ...aiFindings]) {
      const key = f.title.toLowerCase().slice(0, 40);
      if (seenTitles.has(key)) continue;
      seenTitles.add(key);
      findings.push(f);
      if (findings.length >= 12) break;
    }

    // Guarantee a substantive report even if the AI returned nothing and every
    // check passed: emit positive "good" findings from the strongest signals.
    if (findings.length < 3) {
      const goods: Finding[] = [];
      if (signals.schemaTypes.length > 0) {
        goods.push({
          category: "Structured Data",
          severity: "good",
          title: "Structured Data vorhanden",
          description: `Erkannte Typen: ${signals.schemaTypes.slice(0, 6).join(", ")}.`,
          recommendation: "Product-/Offer-/Review-Markup pflegen, damit Rich Results erhalten bleiben.",
        });
      }
      if (probe && probe.perf.https && probe.perf.status < 400) {
        goods.push({
          category: "Technik",
          severity: "good",
          title: "Solide technische Basis",
          description: `HTTPS aktiv, HTTP ${probe.perf.status}, Ladezeit ${(probe.perf.totalMs / 1000).toFixed(2)}s.`,
          recommendation: "Performance über Caching/CDN halten und regelmäßig messen.",
        });
      }
      goods.push({
        category: "Content",
        severity: "info",
        title: "Nächster Hebel: Content-Tiefe & interne Verlinkung",
        description: "Die technischen Basis-Checks sind erfüllt — der größte verbleibende Hebel liegt meist in Content-Qualität, Themenclustern und interner Verlinkung.",
        recommendation: "Ratgeber-Content zu Kauffragen aufbauen und intern auf Kategorie-/Produktseiten verlinken.",
      });
      for (const g of goods) {
        const key = g.title.toLowerCase().slice(0, 40);
        if (seenTitles.has(key)) continue;
        seenTitles.add(key);
        findings.push(g);
      }
    }

    // Quick wins: prefer AI, else derive from failed checks, else generic.
    let quickWins: string[] = (analysis?.quickWins || []).filter((q) => typeof q === "string").slice(0, 4);
    if (quickWins.length === 0) {
      quickWins = checks
        .filter((c) => !c.ok)
        .slice(0, 4)
        .map((c) => `${c.label} korrigieren (${c.detail})`);
    }
    if (quickWins.length === 0) {
      quickWins = [
        "Ratgeber-Content zu den wichtigsten Kauffragen aufbauen",
        "Interne Verlinkung von Blog zu Kategorie-/Produktseiten stärken",
        "Reviews/Trust-Signale prominent platzieren (Conversion-Hebel)",
      ];
    }

    // Blend score: 65% deterministic (reproducible) + 35% AI (context).
    const aiScore =
      typeof analysis?.score === "number" ? clamp(analysis.score) : deterministicOverall;
    const score = clamp(0.65 * deterministicOverall + 0.35 * aiScore);

    const result: AuditResult = {
      shopUrl: pageUrl,
      shopName: analysis?.shopName || pageTitle || parsed.hostname,
      platform: signals.platform,
      score,
      summary:
        analysis?.summary ||
        `${signals.platform !== "Unbekannt" ? signals.platform + "-Shop. " : ""}Gesamt-Score ${score}/100 aus ${checks.filter((c) => c.ok).length}/${checks.length} bestandenen Basis-Checks. Größte Hebel: ${quickWins.slice(0, 2).join("; ") || "siehe Findings"}.`,
      findings,
      stats: {
        products: String(productCount),
        pages: sitemapOk && sitemapUrls ? String(sitemapUrls) : "-",
        pageTitle: pageTitle || "Fehlt",
        metaDescription: signals.metaDescription ? "Vorhanden" : "Fehlt",
        hasSchema: signals.schemaTypes.length > 0,
        hasOpenGraph: signals.hasOgTitle || signals.hasOgImage,
        loadTime: probe ? `${(probe.perf.totalMs / 1000).toFixed(2)}s` : "-",
        mobileOptimized: signals.hasViewport,
      },
      subScores,
      performance:
        probe?.perf ??
        {
          status: 0,
          ttfbMs: 0,
          totalMs: 0,
          finalUrl: shopUrl,
          redirected: false,
          server: "unbekannt",
          https: shopUrl.startsWith("https://"),
          contentType: "",
          htmlKb: 0,
        },
      checks,
      techStack: signals.techStack,
      quickWins,
      schemaTypes: signals.schemaTypes,
      generatedAt: new Date().toISOString(),
    };

    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unbekannter Fehler";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
