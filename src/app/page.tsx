import Link from "next/link";
import { Logo } from "@/components/Logo";

const features = [
  {
    icon: "🔍",
    title: "Vollständiges Shop-Audit",
    desc: "Scanner analysiert Content, Structured Data, Produkttexte, Performance und SEO-Signale in Sekunden.",
    badge: "Live",
  },
  {
    icon: "📊",
    title: "GSC-Daten-Integration",
    desc: "Verbinde die Google Search Console — sieh Klicks, Impressionen und Rankings der letzten 28 Tage und die Begriffe kurz vor Seite 1.",
    badge: "Live",
  },
  {
    icon: "🏆",
    title: "Wettbewerbs-Benchmark",
    desc: "Stell deinen Shop neben bis zu 3 Konkurrenten — Score, Sub-Scores und Kern-Checks im direkten Vergleich, inklusive Gewinnt/Verliert-Analyse.",
    badge: "Live",
  },
  {
    icon: "🤖",
    title: "Autonome Optimierung",
    desc: "Spezial-Agenten schreiben Produkttexte, erzeugen Schema.org JSON-LD, generieren Titelbilder und bauen Verlinkungen.",
    badge: "Roadmap",
  },
  {
    icon: "🛡️",
    title: "Marken-Guardrails",
    desc: "Schrift, Farben, Tonalität und Wording-Verbote sind harte Constraints. Der Agent erfindet nichts.",
    badge: "Live",
  },
  {
    icon: "↩️",
    title: "1-Klick-Rollback",
    desc: "Vor jeder Änderung wird ein Backup erstellt. Jede Optimierung lässt sich mit einem Klick zurücknehmen.",
    badge: "Live",
  },
  {
    icon: "🇩🇪",
    title: "DSGVO & EU-First",
    desc: "Änderungs-Log, transparente Agenten-Protokolle, EU-Datenverarbeitung. Verkaufbar im DE-Markt.",
    badge: "USP",
  },
];

const pricingTiers = [
  {
    name: "Start",
    price: "25",
    period: "/Monat",
    desc: "Audit + Schema + 2 Artikel + Produkt-Basis",
    features: [
      "Vollständiges Shop-Audit",
      "Schema.org Optimierung",
      "2 KI-Artikel / Monat",
      "Produkttext-Basis-Optimierung",
      "1-Klick-Rollback",
    ],
    highlight: false,
    cta: "14 Tage testen",
  },
  {
    name: "Wachstum",
    price: "79",
    period: "/Monat",
    desc: "Redaktionskalender + Bilder + Produkt/Kategorie-SEO + GSC-Loop",
    features: [
      "Alles aus Start",
      "Redaktionskalender + Auto-Publish",
      "KI-Bildgenerierung",
      "Kategorie- & Produkt-SEO",
      "GSC-Ranking-Loop",
      "Verlinkungs-Engine",
    ],
    highlight: true,
    cta: "14 Tage testen",
  },
  {
    name: "Autopilot",
    price: "199",
    period: "/Monat",
    desc: "Voll-autonom + CRO + Multi-Shop",
    features: [
      "Alles aus Wachstum",
      "Voll-autonomer Modus",
      "Conversion-Optimierung",
      "Multi-Shop-Verwaltung",
      "Priorisierter Support",
    ],
    highlight: false,
    cta: "Kontakt aufnehmen",
  },
];

const stats = [
  { value: "79", label: "Artikel automatisch erstellt & veröffentlicht" },
  { value: "+33%", label: "Klicks nach 4 Wochen Optimierung (Case Study)" },
  { value: "0", label: "Erfundene Fakten — nur belegte Shop-Daten" },
  { value: "<30s", label: "Vom Audit bis zum ersten Finding" },
];

const processSteps = [
  {
    step: "01",
    title: "Shop verbinden",
    desc: "WooCommerce oder Shopify einrichten — Plugin als MCP-Connector oder REST-API. Dauert 3 Minuten.",
  },
  {
    step: "02",
    title: "Audit ausführen",
    desc: "Der Scanner analysiert jeden Produkttext, jede Schema-Lücke, jedes SEO-Signal. Du bekommst einen priorisierten Report.",
  },
  {
    step: "03",
    title: "Agenten arbeiten",
    desc: "Spezial-Agenten schreiben Content, generieren Schema, erzeugen Bilder — im Auto- oder Freigabe-Modus.",
  },
  {
    step: "04",
    title: "Wirkung messen",
    desc: "GSC-Daten zeigen, welche Optimierungen Rankings gebracht haben. Die Agenten lernen aus den Ergebnissen.",
  },
];

export default function HomePage() {
  return (
    <div className="min-h-screen">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-ink-800/50 bg-ink-950/80 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <Logo />
          <div className="hidden md:flex items-center gap-8 text-sm text-ink-300">
            <a href="#features" className="hover:text-white transition-colors">
              Funktionen
            </a>
            <a href="#process" className="hover:text-white transition-colors">
              So funktioniert's
            </a>
            <a href="#pricing" className="hover:text-white transition-colors">
              Preise
            </a>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/dashboard"
              className="text-sm text-ink-300 hover:text-white transition-colors px-4 py-2"
            >
              Dashboard
            </Link>
            <Link
              href="/dashboard"
              className="text-sm font-medium bg-white text-ink-950 px-4 py-2 rounded-lg hover:bg-ink-100 transition-colors"
            >
              Kostenlos testen
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative pt-40 pb-24 overflow-hidden">
        {/* Background effects */}
        <div className="absolute inset-0 grid-bg opacity-40" />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[500px] bg-brand-600/20 rounded-full blur-[120px] -z-10" />
        <div className="absolute top-40 right-0 w-[400px] h-[400px] bg-accent-500/10 rounded-full blur-[100px] -z-10" />

        <div className="max-w-5xl mx-auto px-6 text-center">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-ink-700 bg-ink-900/50 text-xs text-ink-300 mb-8 animate-fade-in">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-accent-500"></span>
            </span>
            Beta — Bewährtes System, jetzt als Produkt
          </div>

          {/* Headline */}
          <h1 className="text-5xl md:text-7xl font-bold tracking-tight text-balance leading-[1.1] mb-6 animate-slide-up">
            Der KI-Agent, der
            <br />
            deinen Shop <span className="text-gradient">wirklich anfasst</span>
          </h1>

          {/* Subheadline */}
          <p className="text-lg md:text-xl text-ink-300 max-w-2xl mx-auto leading-relaxed mb-10 animate-slide-up [animation-delay:100ms]">
            Kein Ratgeber-Tool. Ein autonomer Optimierer, der Content schreibt,
            Schema baut, Produkttexte verbessert und Rankings verfolgt —
            datengetrieben, markensicher, nicht-destruktiv.
          </p>

          {/* CTA */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 animate-slide-up [animation-delay:200ms]">
            <Link
              href="/dashboard"
              className="group relative inline-flex items-center gap-2 px-8 py-4 rounded-xl bg-white text-ink-950 font-semibold text-base hover:bg-ink-100 transition-all glow-brand"
            >
              Shop kostenlos analysieren
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                className="group-hover:translate-x-1 transition-transform"
              >
                <path
                  d="M5 12H19M19 12L12 5M19 12L12 19"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </Link>
            <a
              href="#process"
              className="inline-flex items-center gap-2 px-8 py-4 rounded-xl border border-ink-700 text-ink-200 font-medium text-base hover:border-ink-500 hover:text-white transition-all"
            >
              So funktioniert's
            </a>
          </div>

          {/* Trust line */}
          <p className="mt-8 text-sm text-ink-400 animate-fade-in [animation-delay:300ms]">
            Keine Kreditkarte erforderlich · WooCommerce & Shopify · DSGVO-konform
          </p>
        </div>
      </section>

      {/* Stats */}
      <section className="py-16 border-y border-ink-800/50 bg-ink-900/30">
        <div className="max-w-6xl mx-auto px-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {stats.map((stat, i) => (
              <div key={i} className="text-center">
                <div className="text-4xl md:text-5xl font-bold text-gradient mb-2">
                  {stat.value}
                </div>
                <div className="text-sm text-ink-400 leading-tight max-w-[180px] mx-auto">
                  {stat.label}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-24">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-16">
            <span className="text-sm font-medium text-brand-400 uppercase tracking-wider">
              Funktionen
            </span>
            <h2 className="text-3xl md:text-5xl font-bold mt-3 mb-4 text-balance">
              Mehr als SEO-Software.
              <br />
              <span className="text-ink-400">Ein Agent, der Optimierung durchführt.</span>
            </h2>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
            {features.map((feature, i) => (
              <div
                key={i}
                className="group relative p-6 rounded-2xl glass card-hover animate-slide-up"
                style={{ animationDelay: `${i * 50}ms` }}
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="w-12 h-12 rounded-xl bg-ink-800 flex items-center justify-center text-2xl group-hover:scale-110 transition-transform">
                    {feature.icon}
                  </div>
                  <span
                    className={`text-xs px-2.5 py-1 rounded-full font-medium ${
                      feature.badge === "Live"
                        ? "bg-accent-500/15 text-accent-400 border border-accent-500/30"
                        : feature.badge === "USP"
                        ? "bg-brand-500/15 text-brand-400 border border-brand-500/30"
                        : feature.badge === "Beta"
                        ? "bg-warn-500/15 text-warn-400 border border-warn-500/30"
                        : "bg-ink-700/50 text-ink-400 border border-ink-600"
                    }`}
                  >
                    {feature.badge}
                  </span>
                </div>
                <h3 className="text-lg font-semibold mb-2">{feature.title}</h3>
                <p className="text-sm text-ink-400 leading-relaxed">
                  {feature.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Process */}
      <section id="process" className="py-24 bg-ink-900/30 border-y border-ink-800/50">
        <div className="max-w-5xl mx-auto px-6">
          <div className="text-center mb-16">
            <span className="text-sm font-medium text-brand-400 uppercase tracking-wider">
              In 4 Schritten
            </span>
            <h2 className="text-3xl md:text-5xl font-bold mt-3 text-balance">
              Vom Shop zum autonomen Optimierer
            </h2>
          </div>

          <div className="space-y-4">
            {processSteps.map((step, i) => (
              <div
                key={i}
                className="flex gap-6 items-start p-6 rounded-2xl border border-ink-800 hover:border-ink-700 transition-colors group"
              >
                <div className="text-5xl font-bold text-ink-800 group-hover:text-brand-600 transition-colors tabular-nums">
                  {step.step}
                </div>
                <div className="flex-1 pt-1">
                  <h3 className="text-xl font-semibold mb-2">{step.title}</h3>
                  <p className="text-ink-400 leading-relaxed">{step.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="py-24">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-16">
            <span className="text-sm font-medium text-brand-400 uppercase tracking-wider">
              Preise
            </span>
            <h2 className="text-3xl md:text-5xl font-bold mt-3 mb-4 text-balance">
              Kontingent-basiert. Skaliert mit deinem Shop.
            </h2>
            <p className="text-ink-400 max-w-xl mx-auto">
              Modell-Mix + Caching macht es profitabel. Harte Kontingente, günstige
              Modelle für die Masse, inkrementell — nur was GSC flaggt.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {pricingTiers.map((tier, i) => (
              <div
                key={i}
                className={`relative rounded-2xl p-8 ${
                  tier.highlight
                    ? "gradient-border glow-brand"
                    : "glass card-hover"
                }`}
              >
                {tier.highlight && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full bg-gradient-to-r from-brand-500 to-accent-500 text-xs font-semibold text-white">
                    Beliebt
                  </div>
                )}
                <h3 className="text-lg font-semibold mb-1">{tier.name}</h3>
                <p className="text-sm text-ink-400 mb-6">{tier.desc}</p>
                <div className="flex items-baseline gap-1 mb-6">
                  <span className="text-4xl font-bold">{tier.price}</span>
                  <span className="text-ink-400">€{tier.period}</span>
                </div>
                <Link
                  href="/dashboard"
                  className={`block text-center py-3 rounded-xl font-medium transition-all ${
                    tier.highlight
                      ? "bg-white text-ink-950 hover:bg-ink-100"
                      : "border border-ink-600 text-white hover:border-ink-400"
                  }`}
                >
                  {tier.cta}
                </Link>
                <ul className="mt-8 space-y-3">
                  {tier.features.map((feat, j) => (
                    <li key={j} className="flex items-start gap-3 text-sm text-ink-300">
                      <svg
                        width="18"
                        height="18"
                        viewBox="0 0 24 24"
                        fill="none"
                        className="text-accent-400 mt-0.5 flex-shrink-0"
                      >
                        <path
                          d="M20 6L9 17L4 12"
                          stroke="currentColor"
                          strokeWidth="2.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                      {feat}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          {/* Agency */}
          <div className="mt-8 text-center">
            <p className="text-sm text-ink-400">
              Agentur oder White-Label?{" "}
              <a href="#" className="text-brand-400 hover:underline">
                Ab 399 €/Monat →
              </a>
            </p>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 relative overflow-hidden">
        <div className="absolute inset-0 dot-bg opacity-30" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] bg-brand-600/15 rounded-full blur-[100px]" />
        <div className="max-w-3xl mx-auto px-6 text-center relative">
          <h2 className="text-3xl md:text-5xl font-bold mb-6 text-balance">
            Bereit, deinen Shop
            <br />
            <span className="text-gradient">automatisch wachsen zu lassen?</span>
          </h2>
          <p className="text-ink-400 mb-8 max-w-xl mx-auto">
            Schließe jetzt dein Shop-Audit ab. Keine Kreditkarte, keine
            Installation — nur deine URL.
          </p>
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 px-8 py-4 rounded-xl bg-white text-ink-950 font-semibold text-base hover:bg-ink-100 transition-all glow-brand"
          >
            Shop jetzt analysieren
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path
                d="M5 12H19M19 12L12 5M19 12L12 19"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-ink-800/50 py-12">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <Logo />
            <p className="text-sm text-ink-500">
              © 2026 Rankwerk. Gebaut mit dem bewährten Optimierungs-Playbook.
            </p>
            <div className="flex gap-6 text-sm text-ink-400">
              <a href="#" className="hover:text-white transition-colors">
                Datenschutz
              </a>
              <a href="#" className="hover:text-white transition-colors">
                Impressum
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
