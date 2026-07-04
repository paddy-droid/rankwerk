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

## 5. ⚠️ Function-Timeout auf 26 s setzen (PFLICHT für langsame Shops)
Ein Audit ruft die Ziel-Seite + Gemini auf und braucht typisch **9–15 Sekunden**.
Netlify-Functions brechen bei Überschreitung mit `ERR_CONNECTION_RESET` / „Failed to fetch" ab
(genau das passiert bei langsamen Shops wie bellerei, wenn das Timeout zu niedrig ist).

**Fix:** Netlify UI → **Site configuration → Functions → Function timeout** → auf **26 s** setzen
(ab Pro-Plan verfügbar). Der Code hat ein hartes 20-s-Budget und bleibt darunter — 26 s gibt Puffer.

> Schnelle Shops (example.com) gehen auch mit dem Default; der eigene, langsamere Shop braucht die 26 s.

## Redeploy
Ist das Repo mit Netlify verbunden, löst **jeder `git push` auf `main` automatisch einen neuen Deploy aus** —
nichts weiter zu tun. Nur das Function-Timeout (Schritt 5) ist eine einmalige UI-Einstellung.

## 6. Lokaler Test
```bash
cp .env.example .env.local   # Keys eintragen
npm install
npm run dev                  # http://localhost:3000/dashboard
```

## 7. Google Search Console verbinden (GSC — optional)
Der Bereich `/gsc` beweist die Wirkung der Optimierung mit echten Search-Console-Daten
(Klicks, Impressionen, CTR, Ø-Position der letzten 28 Tage vs. Vorperiode + Striking-Distance).
Ohne Konfiguration zeigt `/gsc` einen freundlichen Setup-Hinweis statt eines Fehlers — die
Anbindung ist also rein optional.

**(a) OAuth-Client anlegen:** In der [Google Cloud Console](https://console.cloud.google.com/)
ein Projekt wählen/erstellen, die **„Search Console API"** aktivieren und unter
*APIs & Dienste → Anmeldedaten* einen **OAuth-Client-ID (Typ: Webanwendung)** erstellen.

**(b) Redirect-URIs eintragen** (im OAuth-Client, „Autorisierte Weiterleitungs-URIs"):
- `http://localhost:3000/api/gsc/callback` (lokale Entwicklung)
- `https://rankwerk.netlify.app/api/gsc/callback` (Live)

**(c) OAuth-Zustimmungsbildschirm:** Scope
`https://www.googleapis.com/auth/webmasters.readonly` (nur Lesezugriff) hinzufügen. Solange die
App im Test-Modus ist, den Google-Account als Test-Nutzer eintragen.

**(d) Keys hinterlegen:** In Netlify UI → *Site configuration → Environment variables*:
- `GSC_CLIENT_ID` = Client-ID aus Schritt (a)
- `GSC_CLIENT_SECRET` = Client-Secret aus Schritt (a)
- optional `GSC_REDIRECT_URI` = exakte Redirect-URI erzwingen (sonst aus dem Request-Origin abgeleitet)

Lokal dieselben Werte in `.env.local` (siehe `.env.example`). Danach `/gsc` öffnen →
„Google Search Console verbinden". Der Refresh-Token liegt ausschließlich in einem
httpOnly-Cookie (`gsc_rt`) — keine Datenbank, keine Secrets im Client.

> **Verlauf & Benchmark** brauchen keine Konfiguration: `/verlauf` speichert die Score-Historie
> rein lokal im Browser (localStorage), `/benchmark` nutzt denselben Audit-Motor; die
> Auto-Konkurrenzsuche verwendet den vorhandenen `JINA_API_KEY` (fehlt er, gibt man Konkurrenten
> manuell ein).

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
