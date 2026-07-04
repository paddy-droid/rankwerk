<div align="center">

# 🔧 Rankwerk

**Der KI-Agent, der Online-Shops nicht nur bewertet — sondern optimiert.**

Ein KI-gestützter Shop-Audit für WooCommerce, Shopify & Co.: misst echte SEO-, Performance-
und Structured-Data-Signale und leitet mit Gemini priorisierte, umsetzbare Empfehlungen ab.

Next.js 16 · React 19 · Tailwind · Gemini · Jina · Netlify-ready

</div>

---

## Inhalt

- [Was ist Rankwerk?](#was-ist-rankwerk)
- [Live-Feature: Der Shop-Audit](#live-feature-der-shop-audit)
- [Wie der Audit funktioniert](#wie-der-audit-funktioniert)
- [Tech-Stack](#tech-stack)
- [Projektstruktur](#projektstruktur)
- [Lokale Einrichtung](#lokale-einrichtung)
- [Environment-Variablen](#environment-variablen)
- [API-Referenz](#api-referenz)
- [Deployment (Netlify)](#deployment-netlify)
- [Design-System](#design-system)
- [Grenzen & Betriebshinweise](#grenzen--betriebshinweise)
- [Roadmap](#roadmap)

---

## Was ist Rankwerk?

Rankwerk ist ein SaaS-Prototyp, der das bewährte Shop-Optimierungs-Playbook produktisiert.
Kern ist ein **Audit**, das eine Shop-URL in wenigen Sekunden analysiert und einen
priorisierten Report liefert — nicht auf Basis von Schätzungen, sondern aus **echten,
gemessenen Signalen** der Seite, angereichert um eine KI-Einschätzung.

Die App besteht aus drei Teilen:

| Route | Typ | Zweck |
|-------|-----|-------|
| `/` | statisch | Marketing-Landingpage (Features, Preise, Ablauf) |
| `/dashboard` | statisch (Client) | Audit-UI: URL eingeben, Report ansehen, exportieren |
| `/api/audit` | Serverless Function | Der eigentliche Audit-Endpoint |

---

## Live-Feature: Der Shop-Audit

Ein Audit liefert:

- **Gesamt-Score (0–100)** — reproduzierbar aus deterministischen Sub-Scores, gemischt mit der KI-Bewertung (65 : 35)
- **5 Sub-Scores** — Technik & Speed · SEO-Basis · Structured Data · Content · Social & Trust
- **Performance (real gemessen)** — TTFB, Ladezeit, HTTP-Status, Redirect-Erkennung, Server-Header, HTTPS
- **13 technische Checks** — Ampel-Liste (Title, Meta, Canonical, H1, Viewport, `lang`, Indexierbarkeit, robots.txt, sitemap, Structured Data, Bild-Alt, OpenGraph)
- **Structured Data** — echte JSON-LD-`@type`-Extraktion aus dem Quelltext
- **Plattform- & Tech-Stack-Erkennung** — WooCommerce, Shopify, Shopware, Magento, JTL, Wix, Squarespace + WordPress/Elementor/Next.js/GTM/Cloudflare
- **Priorisierte Findings** — mit Schweregrad (kritisch/warnung/hinweis/gut), Beschreibung und konkreter Empfehlung
- **Quick Wins** — die 3–4 Maßnahmen mit dem höchsten Hebel zuerst
- **Report-Export** — self-contained HTML-Datei zum Speichern & Teilen

---

## Wie der Audit funktioniert

Der Endpoint ist auf niedrige Latenz und Ausfallsicherheit ausgelegt:

```
POST /api/audit  { "url": "..." }
        │
        ├─ 1. Validierung + Normalisierung + SSRF-Guard (blockt localhost/private IPs)
        │
        ├─ 2. Phase 1 — parallel (schnell):
        │     ├─ Direkt-Fetch der Seite  → TTFB, Ladezeit, Status, Redirects, Header, roh-HTML
        │     │                            (1 Retry gegen Connection-Resets)
        │     ├─ /robots.txt
        │     ├─ /sitemap.xml
        │     └─ /sitemap_index.xml       (RankMath/Yoast-robust)
        │
        ├─ 3. Signal-Extraktion aus dem HTML (Title, Meta, Canonical, H1, JSON-LD, OG, Alt-Abdeckung …)
        │
        ├─ 4. Phase 2 — Jina Reader NUR als Fallback,
        │     wenn das Server-HTML zu dünn ist (JS-gerenderte SPA-Shops)
        │
        ├─ 5. Deterministische Sub-Scores + Checks (reproduzierbar)
        │
        ├─ 6. Gemini: Findings, Summary, Quick Wins aus Signalen + Content
        │     (nicht-fatal — fällt Gemini aus, trägt der deterministische Teil den Report)
        │
        └─ 7. Merge + Dedupe + Score-Blend → JSON-Response
```

**Graceful degradation:** Fällt Gemini oder Jina aus, liefert der Audit trotzdem ein
vollständiges Ergebnis aus den gemessenen Signalen. Ein Report ist nie leer.

---

## Tech-Stack

| Bereich | Technologie |
|---------|-------------|
| Framework | Next.js 16 (App Router, Turbopack) |
| UI | React 19, Tailwind CSS 3 |
| Sprache | TypeScript (strict) |
| KI-Analyse | Google Gemini (`gemini-3.5-flash`) |
| Content-Fallback | Jina AI Reader (`r.jina.ai`) |
| Hosting | Netlify (`@netlify/plugin-nextjs`) |
| Runtime | Node 20 (Serverless Functions) |

Keine schweren Dependencies: die HTML-/Signal-Analyse läuft dependency-frei
(kein Cheerio/Puppeteer), damit die Function schlank und serverless-tauglich bleibt.

---

## Projektstruktur

```
rankwerk/
├── src/
│   ├── app/
│   │   ├── page.tsx              # Landingpage
│   │   ├── layout.tsx            # Root-Layout, Metadata, Fonts
│   │   ├── globals.css           # Tailwind + Design-Utilities
│   │   ├── dashboard/page.tsx    # Audit-UI (Client Component)
│   │   └── api/audit/route.ts    # Audit-Endpoint (GET Health, POST Audit)
│   ├── components/Logo.tsx
│   └── lib/utils.ts
├── netlify.toml                  # Build + Node-Version + Next-Plugin
├── next.config.mjs               # turbopack.root-Pin
├── tailwind.config.cjs           # Design-Tokens (ink/brand/accent/warn/danger)
├── postcss.config.cjs
├── .env.example                  # Vorlage für Keys
├── .gitignore                    # schützt .env.local
└── DEPLOY.md                     # Netlify-Deploy-Anleitung
```

---

## Lokale Einrichtung

```bash
git clone https://github.com/paddy-droid/rankwerk.git
cd rankwerk
npm install

cp .env.example .env.local        # dann die Keys eintragen
npm run dev                       # http://localhost:3000
```

Dann im Browser `http://localhost:3000/dashboard` öffnen und eine Shop-URL eingeben.

**Scripts:**

| Script | Wirkung |
|--------|---------|
| `npm run dev` | Dev-Server (Turbopack, Hot Reload) |
| `npm run build` | Produktions-Build (inkl. Typecheck) |
| `npm start` | Produktions-Server lokal |
| `npm run lint` | ESLint |

---

## Environment-Variablen

Zwei Keys werden benötigt (lokal in `.env.local`, auf Netlify in den Site-Env-Vars):

| Variable | Quelle | Zweck |
|----------|--------|-------|
| `GEMINI_API_KEY` | [Google AI Studio](https://aistudio.google.com/apikey) | KI-Analyse (Findings, Summary, Quick Wins) |
| `JINA_API_KEY` | [jina.ai](https://jina.ai) | Content-Fallback für JS-gerenderte Shops |

Die Keys werden ausschließlich serverseitig über `process.env` gelesen — sie gelangen
**nie** ins Client-Bundle. `.env.local` ist per `.gitignore` vom Repo ausgeschlossen.

---

## API-Referenz

### `GET /api/audit` — Health Check

Prüft ohne Secrets zu leaken, ob die Keys konfiguriert sind.

```json
{
  "service": "rankwerk-audit",
  "ok": true,
  "model": "gemini-3.5-flash",
  "env": { "geminiConfigured": true, "jinaConfigured": true }
}
```

### `POST /api/audit` — Audit ausführen

**Request:**

```json
{ "url": "bellerei-shop.com" }
```

**Response (200):**

```jsonc
{
  "shopUrl": "https://www.bellerei-shop.com/",
  "shopName": "bellerei",
  "platform": "WooCommerce",
  "score": 88,
  "summary": "…",
  "findings": [
    {
      "category": "SEO",
      "severity": "critical | warning | info | good",
      "title": "…",
      "description": "…",
      "recommendation": "…"
    }
  ],
  "stats": {
    "products": "38", "pages": "5",
    "pageTitle": "…", "metaDescription": "Vorhanden",
    "hasSchema": true, "hasOpenGraph": true,
    "loadTime": "0.85s", "mobileOptimized": true
  },
  "subScores": [ { "label": "Technik & Speed", "score": 90 } ],
  "performance": {
    "status": 200, "ttfbMs": 813, "totalMs": 880,
    "finalUrl": "https://www.bellerei-shop.com/", "redirected": true,
    "server": "Apache", "https": true, "contentType": "text/html", "htmlKb": 512
  },
  "checks":      [ { "label": "HTTPS aktiv", "ok": true, "detail": "Verschlüsselt" } ],
  "techStack":   [ "WooCommerce", "WordPress", "Elementor" ],
  "quickWins":   [ "…" ],
  "schemaTypes": [ "Product", "Organization", "BreadcrumbList" ],
  "generatedAt": "2026-07-04T…Z"
}
```

**Fehler-Antworten:**

| Status | Bedeutung |
|--------|-----------|
| `400` | URL fehlt/ungültig, oder interne/private Adresse (SSRF-Guard) |
| `502` | Shop weder direkt noch via Jina erreichbar |
| `500` | Unerwarteter Serverfehler |

**Beispiel:**

```bash
curl -X POST https://DEINE-SITE.netlify.app/api/audit \
  -H "Content-Type: application/json" \
  -d '{"url":"bellerei-shop.com"}'
```

---

## Deployment (Netlify)

Ausführliche Schritt-für-Schritt-Anleitung: **[DEPLOY.md](./DEPLOY.md)**. Kurzform:

1. Repo zu GitHub (erledigt) → in Netlify **Import from Git** → `paddy-droid/rankwerk`.
   Build-Command (`npm run build`) und Publish-Dir (`.next`) kommen aus `netlify.toml`;
   `@netlify/plugin-nextjs` macht aus `/api/audit` automatisch eine Function.
2. **Env-Variablen** in der Netlify-UI setzen: `GEMINI_API_KEY`, `JINA_API_KEY`.
3. Check nach dem Deploy: `GET /api/audit` muss `geminiConfigured: true, jinaConfigured: true` liefern.
4. Falls Audits mit Timeout abbrechen: **Function-Timeout auf 26 s** erhöhen (ab Pro-Plan) —
   der Code ist darauf ausgelegt, darunter zu bleiben.

---

## Design-System

Dunkles, modernes UI mit Tailwind-Tokens (`tailwind.config.cjs`):

- **ink** — Graustufen-Palette (Hintergründe, Text)
- **brand** — Blau (`#0c85eb`), primäre Akzente
- **accent** — Grün (`#10b981`), Erfolg/positiv
- **warn** — Amber · **danger** — Rot
- Utilities in `globals.css`: `.glass`, `.card-hover`, `.text-gradient`, `.grid-bg`, `.dot-bg`
- Font: Inter (self-hosted via `next/font`)

---

## Grenzen & Betriebshinweise

- Der Audit analysiert die **übergebene URL** (i. d. R. die Startseite), kein Full-Site-Crawl.
- Ein Lauf dauert typisch **8–18 s** (Direkt-Fetch + Gemini). Netlify-Functions haben
  standardmäßig 10 s Timeout → siehe DEPLOY.md, Schritt 4.
- Der **Score ist reproduzierbar** (deterministischer Kern), die KI-Findings variieren
  leicht zwischen Läufen — das ist gewollt (Kontext-Sensitivität).
- `htmlKb` und Body-Parsing sind auf ~600 KB gedeckelt (Memory-Schutz).
- SSRF-Guard blockt `localhost`, private IP-Ranges und Cloud-Metadata-Endpoints.

---

## Roadmap

Der Audit ist live. Die Landingpage skizziert die produktisierte Vollausbaustufe:

- [ ] **GSC-Integration** — Rankings & Striking-Distance-Keywords direkt einlesen *(Beta)*
- [ ] **Autonome Optimierung** — Agenten schreiben Produkttexte, erzeugen Schema, bauen Verlinkungen *(Roadmap)*
- [ ] **Marken-Guardrails** — Schrift/Farben/Wording als harte Constraints
- [ ] **1-Klick-Rollback** — Backup vor jeder Änderung
- [ ] **Multi-Shop-Verwaltung** & Redaktionskalender

---

<div align="center">

Gebaut mit dem bewährten Optimierungs-Playbook · © 2026 Rankwerk

</div>
