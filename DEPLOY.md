# Rankwerk — Deploy auf Netlify

## 1. Voraussetzungen
- Node 20 (in `netlify.toml` gepinnt)
- Zwei API-Keys: `GEMINI_API_KEY` (Google AI Studio), `JINA_API_KEY` (jina.ai)

## 2. Repo vorbereiten
```bash
cd rankwerk
git init
git add .
git commit -m "Rankwerk initial"
```
Die `.gitignore` schützt `.env.local` — **die echten Keys landen NIE im Repo.**

## 3. Auf Netlify deployen
**Variante A — GitHub:** Repo zu GitHub pushen, in Netlify „Add new site → Import from Git" wählen. Build-Command (`npm run build`) und Publish-Dir (`.next`) kommen aus `netlify.toml`. Das offizielle `@netlify/plugin-nextjs` wird automatisch installiert und macht aus `/api/audit` eine Netlify-Function.

**Variante B — CLI:**
```bash
npm i -g netlify-cli
netlify deploy --build --prod
```

## 4. Environment-Variablen setzen (WICHTIG)
Netlify UI → **Site configuration → Environment variables** → hinzufügen:
- `GEMINI_API_KEY` = dein Gemini-Key
- `JINA_API_KEY` = dein Jina-Key

Danach einmal neu deployen. Prüfen unter `https://DEINE-SITE.netlify.app/api/audit` (GET) —
Antwort muss `"geminiConfigured": true, "jinaConfigured": true` zeigen.

## 5. Function-Timeout erhöhen (falls Audits abbrechen)
Ein Audit ruft die Ziel-Seite + Gemini auf und braucht typisch **8–18 Sekunden**.
Netlify-Functions haben standardmäßig **10 s** Timeout. Falls Audits mit Timeout abbrechen:
- Netlify UI → **Site configuration → Functions → Function timeout** → auf **26 s** setzen
  (verfügbar ab dem Pro-Plan). Der Code ist so gebaut, dass er unter 26 s bleibt.

## 6. Lokaler Test
```bash
cp .env.example .env.local   # Keys eintragen
npm install
npm run dev                  # http://localhost:3000/dashboard
```

## Was der Audit prüft (echte Signale, keine Schätzung)
- **Performance:** TTFB, Ladezeit, HTTP-Status, Redirects, Server-Header, HTTPS (direkter Fetch, 1 Retry)
- **SEO-Basis:** Title, Meta-Description, Canonical, `lang`, genau-1-H1, noindex, robots.txt, sitemap.xml/sitemap_index.xml
- **Structured Data:** echte JSON-LD-`@type`-Extraktion
- **Content:** Wortanzahl, Bild-Alt-Abdeckung
- **Social/Trust:** OpenGraph, Twitter Card
- **Plattform/Tech-Stack-Fingerprint:** WooCommerce, Shopify, Shopware, Magento, JTL, Wix …
- **Gemini** leitet aus diesen Signalen + Seiteninhalt priorisierte Findings + Quick Wins ab.
- Deterministische Sub-Scores (reproduzierbar) werden 65:35 mit dem AI-Score gemischt.

Fällt Gemini oder Jina aus, liefert der Audit trotzdem ein vollständiges Ergebnis
aus den gemessenen Signalen (graceful degradation).
