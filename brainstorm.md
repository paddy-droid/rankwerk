# Rankwerk – Brainstorm

> Ideensammlung. Alles rein, was uns zu Rankwerk einfällt. Nichts ist zu klein.
> Struktur ist nur ein Vorschlag – einfach unter der passenden Überschrift ergänzen.
>
> **Legende:** Aufzählungen ohne Kennung = Rohideen (Carlo). Blöcke mit `→ Lösung` =
> Umsetzungsvorschlag/Machbarkeit (Patric + Claude), oft mit Verweis auf Tools, die wir
> in unseren Shop-Projekten (bellerei, Willenskraft, nooon) **bereits gebaut** haben.

---

## 💡 Ideen / Features

- **Blog (später)** mit:
  - AJAX-Suche (Live-Suche ohne Seitenreload)
  - Sticky Sidebar
  - Inhaltsverzeichnis (TOC) links neben dem Artikel, rechts daneben der Blogtext

  → **Lösung:** Genau dieses Blog-Muster haben wir für patric-jauker.at und nur.marketing
  schon gebaut (Next.js: `posts/index.ts` als Datenquelle, ISR + Scheduling per `publishAt`,
  TOC aus den H2/H3 generiert, Sticky-Sidebar per CSS `position: sticky`). AJAX-Suche =
  clientseitiger Filter über den Post-Index (kein Backend nötig). **Aufwand: klein**, aber
  bewusst „später" — für ein Audit-Tool ist der Blog Marketing-Beiwerk, kein Kern.

- **Weitere Feature-Ideen (Vorschlag):**
  - **Audit-Verlauf / History** — jeden Lauf speichern, Vorher/Nachher-Vergleich zeigen
    (Score-Kurve über Zeit). Das ist der Hook, der aus einem Einmal-Tool ein Abo macht.
  - **Wettbewerbsvergleich** — 2–3 Konkurrenz-URLs gegen den eigenen Shop auditen und
    nebeneinander stellen. → Nutzt exakt dieselbe Audit-Route, nur mehrfach; SERP-Konkurrenz
    finden wir über **Jina Search** (haben wir im Einsatz).
  - **Core Web Vitals** aus echten Felddaten via **Google CrUX / PageSpeed-Insights-API**
    (kostenloser Key) statt nur unserer TTFB-Messung.
  - **PDF-/Whitelabel-Report** als Lead-Magnet (Agentur-Branding).

## 🎯 Ziel & Zielgruppe

→ **Vorschlag (steht teils schon auf der Landingpage / im Pricing):**

- **Primär:** DACH-Shopbetreiber auf **WooCommerce & Shopify** (Solo/KMU), die SEO wollen,
  aber keine Agentur zahlen. Einstieg 25 €/Monat (Start-Tarif).
- **Sekundär:** **Agenturen / Freelancer** als White-Label (399 €/Monat-Idee) — Audit als
  Akquise-Türöffner, Optimierung als wiederkehrende Leistung.
- **Abgrenzung / USP:** kein weiteres „Ratgeber-Tool", sondern der Agent, **der den Shop
  wirklich anfasst** (Content schreibt, Schema baut, verlinkt) — markensicher, DSGVO/EU-first,
  nicht-destruktiv (Backup + Rollback). Das ist genau das Playbook, das wir bei bellerei
  manuell gefahren sind (**Case: +33 % Klicks nach 4 Wochen**).

## 🔍 Audit / Analyse (was soll gecheckt werden?)

- **llms.txt-Validator-Check**: Prüfen, ob eine `llms.txt` vorhanden und valide ist (Existenz, Erreichbarkeit, korrektes Format) und als eigener Audit-Punkt bewerten.

  → **Lösung (schnell umsetzbar):** Wir haben `llms.txt` für bellerei bereits als mu-Plugin
  gebaut (`bellerei-a11y-llms.php` serviert `/llms.txt`) — wir kennen also das Zielformat.
  Im Audit: ein `checkFile(origin, "/llms.txt")` analog zu robots/sitemap ergänzen, dann
  validieren (Erreichbarkeit 200, mind. eine `# H1`, sinnvolle Abschnitte/Links, kein HTML).
  Als eigener Check + kleiner Beitrag zum „SEO/AEO"-Sub-Score. **Aufwand: ~1 h** in der
  bestehenden Route.

- **Bereits im Audit live (zur Einordnung, was schon gecheckt wird):** HTTPS, Title/Meta,
  Canonical, genau-1-H1, Viewport, `lang`, noindex, robots.txt, sitemap.xml/sitemap_index.xml,
  JSON-LD-`@type`-Extraktion, Bild-Alt-Abdeckung, OpenGraph, Plattform-/Tech-Fingerprint,
  echte Performance (TTFB/Ladezeit/Redirects). → 13 Checks + 5 Sub-Scores + KI-Findings.

- **Cookie-Consent-Check (DSGVO/TTDSG)**: prüfen, ob Cookies **vor** der Einwilligung gesetzt
  werden (Prior-Consent-Verstoß) und ob eine echte **Opt-out-/Widerruf-Möglichkeit** besteht.

- **Google Fonts lokal statt CDN**: prüfen, ob Google Fonts über `fonts.googleapis.com` /
  `fonts.gstatic.com` extern geladen werden (DSGVO-Risiko, EuGH-Urteil LG München) oder
  bereits selbst gehostet sind.

- **`/wp-admin` sichtbar (nur bei WordPress-Seiten)**: prüfen, ob der Login-Bereich öffentlich
  erreichbar ist (kein IP-Schutz/Basic-Auth/Umbenennung), als Teil des Security-Sub-Scores.

- **Sinnvolle Ergänzungen (Vorschlag):**
  - **Security-Header-Check** (siehe Carlos Punkt unter Technik) — Header liegen im Audit
    schon vor, nur noch auswerten.
  - **AggregateRating/Review-Schema-Check** (siehe Marketing: die „Sterne").
  - **Broken-Links / Mixed-Content** (http-Ressourcen auf https-Seite).
  - **Mehrseiten-Stichprobe** statt nur Startseite (Kategorie + 1 Produkt aus der Sitemap
    ziehen) — deckt Produkttexte & Produkt-Schema mit ab.

## 🎨 Design & UX

- **Hell-/Dunkelmodus** (Weiß-/Dark-Mode umschaltbar)
- **Schriftgröße mindestens 1,0 rem** (keine winzigen Texte)
- **Barrierefreiheit**: Kontrastfarben mindestens auf WCAG-AA-Niveau
- **Responsive Navigation** mit sanft aufklappbaren Menüs (weiche Animation)

  → **Lösung:** Rankwerk ist aktuell **Dark-only**. Umschaltung = Tailwind `darkMode: "class"`
  + Toggle im Header (Präferenz in `localStorage`), Farbtokens gibt's schon (`ink/brand/accent`).
  Mindest-Schriftgröße und AA-Kontrast als harte Regel ins Design-System — Achtung: unser
  aktuelles Grün `#00b67a` mit Weiß = **2,63:1 (AA-Fail)**, wie bei bellerei; für Buttons das
  dunklere `#047857`/Gradient nehmen (dieselbe Lektion, die wir dort schon gezogen haben).
  Ironie/USP: **Rankwerk sollte seinen eigenen Audit bestehen** — Kontrast-Check ins Tool
  aufnehmen und die eigene Seite grün bekommen.

## ⚙️ Technik / Backend

- **Security-Header angleichen**: einheitliches, sauberes Header-Setup
  - CSP (Content-Security-Policy) setzen
  - HSTS inkl. `preload`
  - `X-Powered-By` entfernen (nicht verraten, dass Next.js läuft)
  - veraltetes `X-XSS-Protection` raus (deprecated, kann sogar schaden)
  - **soll auch WordPress-Websites prüfen** (Header-Check nicht nur für Next.js, sondern für jede beliebige URL / WP-Seite)

  → **Lösung — zwei Ebenen:**
  1. **Als Audit-Feature (für JEDE URL, inkl. WordPress):** Der Audit macht bereits einen
     direkten Fetch und hat die Response-Header im Objekt (`server`, `x-powered-by` werten
     wir schon aus). Wir ziehen zusätzlich **CSP, HSTS, X-Frame-Options, X-Content-Type-Options,
     Referrer-Policy, Permissions-Policy** raus und bewerten sie in einem neuen **Sub-Score
     „Sicherheit"**. Das funktioniert plattform-unabhängig (WP, Shopify, Next – es sind nur
     HTTP-Header). **Aufwand: klein**, weil die Header schon vorliegen.
  2. **Als Fix (autonom):** Bei unseren WP-Kunden setzen wir Header per `.htaccess` oder
     mu-Plugin (SSH/WP-CLI-Zugang vorhanden) — genau der Weg, den Rankwerk-Autopilot später
     ausführen kann. Für **Rankwerk selbst** (Next auf Netlify): Header in `netlify.toml`
     (`[[headers]]`) bzw. `next.config.mjs`-`headers()`. `X-Powered-By` in Next per
     `poweredByHeader: false` abschalten.

- **Weitere Technik-Punkte (Vorschlag):**
  - **Vom Prototyp zum echten SaaS:** aktuell statisches Next.js ohne DB/Auth. Für History,
    Konten und Kontingente brauchen wir: **Auth** (z. B. Clerk/Auth.js), **DB** (Neon/Postgres —
    nutzen wir schon in der Trainer-Kursplattform), **Job-Queue** für lange Optimierungs-Läufe.
  - **Langläufer aus dem Request holen:** Audits mit Autopilot-Aktionen dürfen nicht am
    Serverless-Timeout hängen → **Background-Function / Queue** statt Sync-Request
    (die 26-s-Timeout-Grenze haben wir beim Audit schon zu spüren bekommen).
  - **Caching** der Audit-Ergebnisse pro URL (spart Gemini-Kosten; Pricing-Seite baut genau
    darauf auf: „Modell-Mix + Caching macht es profitabel").

## 📈 Marketing / SEO / Vermarktung

- **Google-Bewertungs-Sterne in die Meta-Beschreibung** integrieren (Rich Snippet / Rating in den Suchergebnissen sichtbar machen)

  → **Lösung + wichtige Klarstellung:** Sterne kommen technisch **nicht** aus der
  Meta-Description, sondern aus **`AggregateRating`/`Review`-JSON-LD** (Rich Results). Genau
  das haben wir gebaut: bei bellerei/nooon liefern mu-Plugins Product-Schema mit **echten
  reviews.io-Bewertungen** (`bellerei-product-schema.php`, `bellerei-cbd-cat-schema.php`).
  Rankwerk kann daher (a) im **Audit prüfen**, ob valides AggregateRating vorhanden ist, und
  (b) im **Autopilot** das Schema aus vorhandenen Shop-Reviews **erzeugen** — reproduzierbar,
  keine erfundenen Werte. Das ist ein starker, verkaufbarer „Quick Win".

### Preise / Recht

- Preise **netto** ausweisen
- **Footer-Hinweis: Verkauf ausschließlich an B2B-Kunden** → damit kein Widerrufsrecht-Problem

  → **Lösung:** Reine Copy-/Config-Änderung. Pricing-Tabelle: „zzgl. USt." + im Footer den
  B2B-Hinweis. Zusätzlich griffbereit halten: **Impressum, Datenschutz, AGB** (die Footer-Links
  existieren schon, führen aber noch auf `#`). Für DSGVO/EU-first als USP sollten die stehen.

---

## 🤖 Autonome Optimierung — der eigentliche Rankwerk-Kern (vieles ist schon gebaut!)

> Die Kern-These: **Rankwerk produktisiert das Playbook, das wir bei bellerei & Co. manuell
> gefahren haben.** Für fast jedes „Autopilot"-Feature existiert bei uns schon eine erprobte
> Umsetzung — es geht ums Verpacken, nicht ums Erfinden.

| Autopilot-Feature | Was wir dafür schon haben (erprobt) |
|---|---|
| **Shop verbinden (Connector)** | WooCommerce REST v3, Shopify Admin API, WP-CLI/SSH/MySQL — bei bellerei/nooon/Willenskraft täglich im Einsatz |
| **Schema.org automatisch bauen** | mu-Plugins für Product, Organization/OnlineStore, FAQPage, CollectionPage, ItemList, BreadcrumbList, Recipe — inkl. `<script>`-sicherem Speicherweg (SQL/`$wpdb`, weil `wp_kses` Script-Tags strippt) |
| **Meta-Reparatur** | RankMath Title/Description per WP-CLI/REST bulk gesetzt (Längen-Limits, Keyword-Fokus) |
| **Produkttexte optimieren** | ~70 Produktbeschreibungen bei bellerei überarbeitet — nur belegte Fakten, food-/heilclaim-sicher |
| **Interne Verlinkung** | TF-IDF-„Verlinkungs-Engine" (207 Posts, 771 Related-Links, Waisen-Posts angebunden) |
| **Content + Redaktionskalender** | Gemini-Artikelpipeline + 26 auto-publizierende `future`-Posts mit Guard-mu-Plugin |
| **Titelbilder** | Gemini-Bildgenerierung (Marken-Stil, kein Text im Bild) |
| **Wirkungs-Loop** | GSC-Analyse (OAuth, Striking-Distance, CTR-Lücken, Position-Tracking) + GA4-Funnel (Vorher/Nachher) |
| **Marken-Guardrails** | Genau unser „Skill = Ground Truth"-Prinzip: Wording-Verbote, Farben, Fakten-only als harte Constraints |
| **1-Klick-Rollback** | „Backup vor jeder Änderung" ist bei uns Standard (Datei-/DB-Snapshots vor jedem Write) |
| **Multi-Shop / parallel** | Multi-Agent-Workflow-Orchestrierung (mehrere Shops/Aufgaben gleichzeitig) |

→ **Roadmap-Empfehlung (realistisch priorisiert):**
- **Now (Audit härten & verkaufen):** llms.txt-Check + Security-Header-Check + AggregateRating-Check
  + Audit-History. Alles kleine Ergänzungen der bestehenden Route, sofort demofähig.
- **Next (erster echter Autopilot-Schritt):** **Schema-Generierung als Service** — Shop verbinden,
  fehlendes Product/Organization/FAQ-Schema erzeugen, mit Backup + Rollback. Höchster Hebel bei
  kleinstem Risiko (additiv, nicht-destruktiv), und wir haben den Code-Kern schon.
- **Later:** Content/Verlinkung/Redaktionskalender als Voll-Autopilot, GSC-Loop, Multi-Shop.

---

## ❓ Offene Fragen

→ **Zu klären (Vorschlag):**
- **Connector-Modell:** Plugin (WP) + OAuth (Shopify) — oder generischer „nur-lesen-Audit"
  ohne Login für den Einstieg und „schreiben" erst nach Verbindung?
- **Datenhaltung/DSGVO:** Wo speichern wir Audit-History + Shop-Daten (EU-Region, Neon/Netlify)?
  Was genau versprechen wir mit „EU-first"?
- **Kosten pro Audit:** Gemini-Kosten je Lauf messen und gegen die Tarife rechnen (Caching-Strategie).
- **Free-Tier:** Wie viele Gratis-Audits vor der Registrierung? (Lead-Gen vs. Kostenbremse)
- **Abgrenzung zu unseren Kundenprojekten:** Rankwerk als eigenes Produkt vs. „Nichts Neues bis
  Q4 2026"-Fokus — bewusst als Nebengleis/Prototyp, oder ernster Push?

## ✅ Erledigt / Entschieden

- **Audit-MVP ist live** (`rankwerk.netlify.app`): echter Signal-Probe, 13 Checks, 5 Sub-Scores,
  JSON-LD-Extraktion, Gemini-Findings + Quick Wins, Report-Export, Plattform-Erkennung.
- **Netlify-Deploy** läuft (Keys via `process.env`, `.gitignore` schützt Secrets, Auto-Redeploy
  bei `git push`). Bekannte Betriebsregel: **Function-Timeout 26 s** für langsame Shops.
- **Gemini-Thinking gedeckelt** (`thinkingBudget: 512`) → valides JSON + schnell; hartes 20-s-Budget
  gegen Timeouts.
- **Repo & Zusammenarbeit:** `paddy-droid/rankwerk`, wir arbeiten zu zweit (Patric + Carlo/planmyseo);
  Beiträge laufen über Commits/PRs, Autorschaft ist pro Commit sichtbar.
