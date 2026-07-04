# Rankwerk – Brainstorm

> Ideensammlung. Alles rein, was uns zu Rankwerk einfällt. Nichts ist zu klein.
> Struktur ist nur ein Vorschlag – einfach unter der passenden Überschrift ergänzen.

## 💡 Ideen / Features

- **Blog (später)** mit:
  - AJAX-Suche (Live-Suche ohne Seitenreload)
  - Sticky Sidebar
  - Inhaltsverzeichnis (TOC) links neben dem Artikel, rechts daneben der Blogtext

## 🎯 Ziel & Zielgruppe

-

## 🔍 Audit / Analyse (was soll gecheckt werden?)

- **llms.txt-Validator-Check**: Prüfen, ob eine `llms.txt` vorhanden und valide ist (Existenz, Erreichbarkeit, korrektes Format) und als eigener Audit-Punkt bewerten.

## 🎨 Design & UX

- **Hell-/Dunkelmodus** (Weiß-/Dark-Mode umschaltbar)
- **Schriftgröße mindestens 1,0 rem** (keine winzigen Texte)
- **Barrierefreiheit**: Kontrastfarben mindestens auf WCAG-AA-Niveau
- **Responsive Navigation** mit sanft aufklappbaren Menüs (weiche Animation)

## ⚙️ Technik / Backend

- **Security-Header angleichen**: einheitliches, sauberes Header-Setup
  - CSP (Content-Security-Policy) setzen
  - HSTS inkl. `preload`
  - `X-Powered-By` entfernen (nicht verraten, dass Next.js läuft)
  - veraltetes `X-XSS-Protection` raus (deprecated, kann sogar schaden)
  - **soll auch WordPress-Websites prüfen** (Header-Check nicht nur für Next.js, sondern für jede beliebige URL / WP-Seite)

## 📈 Marketing / SEO / Vermarktung

- **Google-Bewertungs-Sterne in die Meta-Beschreibung** integrieren (Rich Snippet / Rating in den Suchergebnissen sichtbar machen)

### Preise / Recht

- Preise **netto** ausweisen
- **Footer-Hinweis: Verkauf ausschließlich an B2B-Kunden** → damit kein Widerrufsrecht-Problem

## ❓ Offene Fragen

-

## ✅ Erledigt / Entschieden

-
