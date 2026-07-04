"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Logo } from "@/components/Logo";

type AuditState = "idle" | "fetching" | "analyzing" | "done" | "error";

interface Finding {
  category: string;
  severity: "critical" | "warning" | "info" | "good";
  title: string;
  description: string;
  recommendation: string;
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
  subScores?: { label: string; score: number }[];
  performance?: {
    status: number;
    ttfbMs: number;
    totalMs: number;
    finalUrl: string;
    redirected: boolean;
    server: string;
    https: boolean;
    contentType: string;
    htmlKb: number;
  };
  checks?: { label: string; ok: boolean; detail: string }[];
  techStack?: string[];
  quickWins?: string[];
  schemaTypes?: string[];
  generatedAt?: string;
}

function scoreColor(score: number): string {
  return score >= 70 ? "rgb(16 185 129)" : score >= 40 ? "rgb(245 158 11)" : "rgb(239 68 68)";
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export default function DashboardPage() {
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [state, setState] = useState<AuditState>("idle");
  const [progress, setProgress] = useState(0);
  const [progressLabel, setProgressLabel] = useState("");
  const [result, setResult] = useState<AuditResult | null>(null);
  const [error, setError] = useState("");

  async function runAudit() {
    if (!url.trim()) return;

    setState("fetching");
    setProgress(10);
    setProgressLabel("Shop wird gescannt...");
    setError("");
    setResult(null);

    try {
      setProgressLabel("Direkt-Probe: Ladezeit, Schema, Meta-Tags, robots/sitemap...");
      setProgress(25);

      const response = await fetch("/api/audit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim() }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || `HTTP ${response.status}`);
      }

      setProgress(55);
      setProgressLabel("Gemini 3.5 Flash: Analysiere Content, SEO, Schema, Performance...");
      setState("analyzing");

      const data: AuditResult = await response.json();

      setProgress(85);
      setProgressLabel("Erstelle Audit-Report...");
      await new Promise((r) => setTimeout(r, 350));

      setProgress(100);
      setResult(data);
      setState("done");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Unbekannter Fehler");
      setState("error");
    }
  }

  function downloadReport() {
    if (!result) return;
    const c = scoreColor(result.score);
    const date = new Date(result.generatedAt || Date.now()).toLocaleString("de-DE");
    const findingsHtml = result.findings
      .map(
        (f) => `
      <div class="finding sev-${f.severity}">
        <div class="fhead"><span class="sev">${escapeHtml(f.severity)}</span><span class="cat">${escapeHtml(f.category)}</span></div>
        <h4>${escapeHtml(f.title)}</h4>
        <p>${escapeHtml(f.description)}</p>
        <p class="rec"><strong>→ Empfehlung:</strong> ${escapeHtml(f.recommendation)}</p>
      </div>`
      )
      .join("");
    const checksHtml = (result.checks || [])
      .map(
        (ch) =>
          `<tr><td>${ch.ok ? "✅" : "❌"}</td><td>${escapeHtml(ch.label)}</td><td>${escapeHtml(ch.detail)}</td></tr>`
      )
      .join("");
    const subHtml = (result.subScores || [])
      .map((s) => `<li><b>${escapeHtml(s.label)}</b>: ${s.score}/100</li>`)
      .join("");
    const winsHtml = (result.quickWins || []).map((q) => `<li>${escapeHtml(q)}</li>`).join("");

    const html = `<!doctype html><html lang="de"><head><meta charset="utf-8">
<title>Rankwerk Audit — ${escapeHtml(result.shopName)}</title>
<style>
  body{font-family:-apple-system,Segoe UI,Roboto,sans-serif;max-width:820px;margin:40px auto;padding:0 24px;color:#1e2532;line-height:1.55}
  h1{font-size:26px;margin:0 0 4px} h2{font-size:18px;margin:32px 0 12px;border-bottom:2px solid #eceef2;padding-bottom:6px}
  .meta{color:#7a8598;font-size:14px;margin-bottom:24px}
  .scorebox{display:flex;align-items:center;gap:20px;background:#f6f7f9;border-radius:14px;padding:20px;margin:16px 0}
  .score{font-size:48px;font-weight:800;color:${c}}
  .finding{border:1px solid #d4d8e0;border-left:5px solid #7a8598;border-radius:8px;padding:12px 16px;margin:10px 0}
  .finding.sev-critical{border-left-color:#ef4444}.finding.sev-warning{border-left-color:#f59e0b}
  .finding.sev-info{border-left-color:#0c85eb}.finding.sev-good{border-left-color:#10b981}
  .fhead{font-size:11px;text-transform:uppercase;letter-spacing:.05em;color:#7a8598;margin-bottom:4px}
  .fhead .cat{margin-left:8px;background:#eceef2;padding:1px 8px;border-radius:6px}
  .finding h4{margin:2px 0 6px} .finding p{margin:4px 0;font-size:14px} .rec{background:#f6f7f9;padding:8px 10px;border-radius:6px}
  table{width:100%;border-collapse:collapse;font-size:14px} td{padding:6px 8px;border-bottom:1px solid #eceef2}
  ul{font-size:14px} footer{margin-top:40px;color:#aab2c1;font-size:12px;text-align:center}
</style></head><body>
  <h1>Rankwerk Shop-Audit</h1>
  <div class="meta">${escapeHtml(result.shopName)} · ${escapeHtml(result.shopUrl)} · ${escapeHtml(result.platform)} · ${date}</div>
  <div class="scorebox"><div class="score">${result.score}</div><div><b>Gesamt-Score</b> / 100<br><span style="color:#7a8598">${escapeHtml(result.summary)}</span></div></div>
  ${subHtml ? `<h2>Sub-Scores</h2><ul>${subHtml}</ul>` : ""}
  ${winsHtml ? `<h2>Quick Wins</h2><ol>${winsHtml}</ol>` : ""}
  <h2>Findings (${result.findings.length})</h2>${findingsHtml}
  ${checksHtml ? `<h2>Technische Checks</h2><table>${checksHtml}</table>` : ""}
  <footer>Erstellt mit Rankwerk · ${date}</footer>
</body></html>`;

    const blob = new Blob([html], { type: "text/html;charset=utf-8" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    const safe = (result.shopName || "shop").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    link.download = `rankwerk-audit-${safe || "report"}.html`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(link.href), 4000);
  }

  const severityStyles: Record<string, string> = {
    critical: "border-danger-500/30 bg-danger-500/5 text-danger-400",
    warning: "border-warn-500/30 bg-warn-500/5 text-warn-400",
    info: "border-brand-500/30 bg-brand-500/5 text-brand-400",
    good: "border-accent-500/30 bg-accent-500/5 text-accent-400",
  };

  const severityLabels: Record<string, string> = {
    critical: "Kritisch",
    warning: "Warnung",
    info: "Hinweis",
    good: "Gut",
  };

  const severityIcons: Record<string, string> = {
    critical: "🔴",
    warning: "🟡",
    info: "🔵",
    good: "🟢",
  };

  return (
    <div className="min-h-screen bg-ink-950">
      {/* Top Bar */}
      <nav className="border-b border-ink-800/50 bg-ink-950/80 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-8">
            <button onClick={() => router.push("/")}>
              <Logo />
            </button>
            <div className="hidden md:flex items-center gap-1 text-sm">
              <span className="px-3 py-1.5 rounded-lg bg-ink-800/50 text-ink-200 font-medium">
                Dashboard
              </span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-2 text-xs text-ink-400">
              <span className="w-2 h-2 rounded-full bg-accent-500 animate-pulse" />
              Beta
            </div>
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-brand-500 to-accent-500 flex items-center justify-center text-sm font-semibold text-white">
              P
            </div>
          </div>
        </div>
      </nav>

      <div className="max-w-5xl mx-auto px-6 py-12">
        {/* Header */}
        <div className="mb-10">
          <h1 className="text-3xl font-bold mb-2">Shop-Audit</h1>
          <p className="text-ink-400">
            Gib deine Shop-URL ein. Der Scanner misst echte Signale (Ladezeit, Schema,
            robots/sitemap, Meta-Tags) und lässt Gemini priorisierte Empfehlungen ableiten.
          </p>
        </div>

        {/* URL Input */}
        <div className="relative mb-8">
          <div className="glass rounded-2xl p-2 flex items-center gap-2 focus-within:border-brand-500/50 transition-colors">
            <div className="pl-4 text-ink-400">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <path
                  d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
            <input
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && state !== "fetching" && state !== "analyzing" && runAudit()}
              placeholder="https://dein-shop.com"
              disabled={state === "fetching" || state === "analyzing"}
              className="flex-1 bg-transparent text-white placeholder-ink-500 px-2 py-3 focus:outline-none disabled:opacity-50"
            />
            <button
              onClick={runAudit}
              disabled={!url.trim() || state === "fetching" || state === "analyzing"}
              className="px-6 py-3 rounded-xl bg-white text-ink-950 font-semibold text-sm hover:bg-ink-100 transition-colors disabled:opacity-30 disabled:cursor-not-allowed flex items-center gap-2 whitespace-nowrap"
            >
              {state === "fetching" || state === "analyzing" ? (
                <>
                  <span className="w-4 h-4 border-2 border-ink-400 border-t-transparent rounded-full animate-spin" />
                  Analysiere...
                </>
              ) : (
                <>
                  Audit starten
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                    <path d="M5 12H19M19 12L12 5M19 12L12 19" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Progress */}
        {(state === "fetching" || state === "analyzing") && (
          <div className="glass rounded-2xl p-8 mb-8 animate-fade-in">
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm text-ink-300">{progressLabel}</span>
              <span className="text-sm font-mono text-brand-400">{progress}%</span>
            </div>
            <div className="h-2 bg-ink-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-brand-500 to-accent-500 rounded-full transition-all duration-500"
                style={{ width: `${progress}%` }}
              />
            </div>
            <div className="grid grid-cols-3 gap-4 mt-6">
              {[
                { label: "Signale scannen", target: 25, done: progress >= 25 },
                { label: "Gemini Analyse", target: 55, done: progress >= 55 },
                { label: "Report", target: 100, done: progress >= 100 },
              ].map((step, i) => (
                <div key={i} className="flex items-center gap-2">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs ${step.done ? "bg-accent-500 text-white" : "bg-ink-800 text-ink-500"}`}>
                    {step.done ? "✓" : i + 1}
                  </div>
                  <span className={`text-xs ${step.done ? "text-ink-200" : "text-ink-500"}`}>
                    {step.label}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Error */}
        {state === "error" && (
          <div className="rounded-2xl border border-danger-500/30 bg-danger-500/5 p-6 mb-8 animate-fade-in">
            <div className="flex items-start gap-4">
              <div className="text-2xl">⚠️</div>
              <div>
                <h3 className="font-semibold text-danger-400 mb-1">Audit fehlgeschlagen</h3>
                <p className="text-sm text-ink-400">{error}</p>
                <button
                  onClick={() => { setState("idle"); setError(""); }}
                  className="mt-3 text-sm text-brand-400 hover:underline"
                >
                  Erneut versuchen
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Results */}
        {state === "done" && result && (
          <div className="space-y-6 animate-fade-in">
            {/* Score Card */}
            <div className="glass rounded-2xl p-8 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-64 h-64 bg-brand-600/10 rounded-full blur-[60px]" />
              <div className="relative flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
                <div>
                  <div className="text-sm text-ink-400 mb-2">Audit-Ergebnis für</div>
                  <h2 className="text-2xl font-bold mb-1">{result.shopName || result.shopUrl}</h2>
                  <p className="text-sm text-ink-400">
                    {result.platform} · {result.stats.products} Produkte geschätzt · {result.stats.pages} Seiten (Sitemap)
                  </p>
                  {result.techStack && result.techStack.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-3">
                      {result.techStack.map((t, i) => (
                        <span key={i} className="text-xs px-2.5 py-1 rounded-md bg-ink-800/60 text-ink-300 border border-ink-700/50">
                          {t}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                {/* Score circle */}
                <div className="relative flex-shrink-0">
                  <svg width="120" height="120" viewBox="0 0 120 120" className="transform -rotate-90">
                    <circle cx="60" cy="60" r="52" stroke="rgb(45 53 69)" strokeWidth="8" fill="none" />
                    <circle
                      cx="60" cy="60" r="52"
                      stroke={scoreColor(result.score)}
                      strokeWidth="8" fill="none" strokeLinecap="round"
                      strokeDasharray={`${(result.score / 100) * 327} 327`}
                      className="transition-all duration-1000"
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-4xl font-bold">{result.score}</span>
                    <span className="text-xs text-ink-400">/ 100</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Sub-Scores */}
            {result.subScores && result.subScores.length > 0 && (
              <div className="glass rounded-2xl p-6">
                <h3 className="text-sm font-semibold text-ink-300 uppercase tracking-wider mb-4">Score-Aufschlüsselung</h3>
                <div className="space-y-4">
                  {result.subScores.map((s, i) => (
                    <div key={i}>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-sm text-ink-200">{s.label}</span>
                        <span className="text-sm font-mono text-ink-400">{s.score}</span>
                      </div>
                      <div className="h-2 bg-ink-800 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-1000"
                          style={{ width: `${s.score}%`, background: scoreColor(s.score) }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Performance strip */}
            {result.performance && result.performance.status > 0 && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { label: "Ladezeit", value: result.stats.loadTime, good: result.performance.totalMs < 2000 },
                  { label: "TTFB", value: `${result.performance.ttfbMs} ms`, good: result.performance.ttfbMs < 800 },
                  { label: "HTTP-Status", value: String(result.performance.status), good: result.performance.status < 400 },
                  { label: "Server", value: result.performance.server, good: true },
                ].map((m, i) => (
                  <div key={i} className="glass rounded-xl p-4">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-ink-400">{m.label}</span>
                      <span className={`w-2 h-2 rounded-full ${m.good ? "bg-accent-500" : "bg-danger-500"}`} />
                    </div>
                    <div className={`text-sm font-medium truncate ${m.good ? "text-ink-100" : "text-danger-400"}`} title={m.value}>
                      {m.value}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Quick Stats Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: "Title Tag", value: result.stats.pageTitle, good: result.stats.pageTitle !== "Fehlt" && result.stats.pageTitle.length > 10 },
                { label: "Meta Description", value: result.stats.metaDescription, good: result.stats.metaDescription !== "Fehlt" },
                { label: "Schema.org", value: result.stats.hasSchema ? "Gefunden" : "Fehlt", good: result.stats.hasSchema },
                { label: "Open Graph", value: result.stats.hasOpenGraph ? "Aktiv" : "Fehlt", good: result.stats.hasOpenGraph },
              ].map((stat, i) => (
                <div key={i} className="glass rounded-xl p-4">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-ink-400">{stat.label}</span>
                    <span className={`w-2 h-2 rounded-full ${stat.good ? "bg-accent-500" : "bg-danger-500"}`} />
                  </div>
                  <div className={`text-sm font-medium truncate ${stat.good ? "text-ink-100" : "text-danger-400"}`} title={stat.value}>
                    {stat.value}
                  </div>
                </div>
              ))}
            </div>

            {/* Quick Wins */}
            {result.quickWins && result.quickWins.length > 0 && (
              <div className="rounded-2xl border border-accent-500/30 bg-accent-500/5 p-6">
                <h3 className="text-sm font-semibold text-accent-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                  ⚡ Quick Wins — größter Hebel zuerst
                </h3>
                <ol className="space-y-2">
                  {result.quickWins.map((q, i) => (
                    <li key={i} className="flex items-start gap-3 text-sm text-ink-200">
                      <span className="flex-shrink-0 w-5 h-5 rounded-full bg-accent-500/20 text-accent-400 flex items-center justify-center text-xs font-bold">
                        {i + 1}
                      </span>
                      {q}
                    </li>
                  ))}
                </ol>
              </div>
            )}

            {/* Summary */}
            <div className="glass rounded-2xl p-6">
              <h3 className="text-sm font-semibold text-ink-300 uppercase tracking-wider mb-3">Zusammenfassung</h3>
              <p className="text-ink-200 leading-relaxed">{result.summary}</p>
            </div>

            {/* Technical checks */}
            {result.checks && result.checks.length > 0 && (
              <div className="glass rounded-2xl p-6">
                <h3 className="text-sm font-semibold text-ink-300 uppercase tracking-wider mb-4">Technische Checks</h3>
                <div className="grid sm:grid-cols-2 gap-2">
                  {result.checks.map((ch, i) => (
                    <div key={i} className="flex items-center gap-3 py-2 px-3 rounded-lg bg-ink-900/40">
                      <span className={`flex-shrink-0 text-sm ${ch.ok ? "text-accent-400" : "text-danger-400"}`}>
                        {ch.ok ? "✓" : "✕"}
                      </span>
                      <span className="text-sm text-ink-200 flex-1">{ch.label}</span>
                      <span className="text-xs text-ink-500 truncate max-w-[45%]" title={ch.detail}>{ch.detail}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Findings */}
            <div>
              <h3 className="text-sm font-semibold text-ink-300 uppercase tracking-wider mb-4">
                Findings ({result.findings.length})
              </h3>
              <div className="space-y-3">
                {result.findings.map((finding, i) => (
                  <div
                    key={i}
                    className={`rounded-xl border p-5 ${severityStyles[finding.severity]}`}
                  >
                    <div className="flex items-start gap-4">
                      <div className="text-xl flex-shrink-0">{severityIcons[finding.severity]}</div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3 mb-1">
                          <span className="text-xs font-medium uppercase tracking-wider opacity-80">
                            {severityLabels[finding.severity]}
                          </span>
                          <span className="text-xs px-2 py-0.5 rounded-md bg-ink-800/60 text-ink-400">
                            {finding.category}
                          </span>
                        </div>
                        <h4 className="font-semibold text-white mb-1">{finding.title}</h4>
                        <p className="text-sm text-ink-300 mb-2">{finding.description}</p>
                        <div className="text-sm text-ink-200 bg-ink-900/50 rounded-lg p-3 border border-ink-700/30">
                          <span className="text-accent-400 font-medium">→ Empfehlung: </span>
                          {finding.recommendation}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* CTA */}
            <div className="glass rounded-2xl p-8 text-center">
              <h3 className="text-xl font-semibold mb-2">Möchtest du diese Probleme automatisch beheben?</h3>
              <p className="text-ink-400 mb-6">
                Rankwerk Autopilot übernimmt: Content-Optimierung, Schema-Erstellung, Produkttexte — jeden Tag.
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                <button className="px-6 py-3 rounded-xl bg-white text-ink-950 font-semibold text-sm hover:bg-ink-100 transition-colors">
                  Autopilot aktivieren
                </button>
                <button
                  onClick={downloadReport}
                  className="px-6 py-3 rounded-xl border border-ink-600 text-ink-200 font-medium text-sm hover:border-ink-400 transition-colors"
                >
                  Report herunterladen
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Empty State */}
        {state === "idle" && (
          <div className="text-center py-16">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-ink-800/50 mb-4">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" className="text-ink-500">
                <path d="M21 21L16.514 16.506M19 10.5C19 15.247 15.247 19 10.5 19S2 15.247 2 10.5S5.753 2 10.5 2S19 5.753 19 10.5Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-ink-300 mb-1">Bereit zum Start</h3>
            <p className="text-sm text-ink-500 max-w-md mx-auto">
              Gib oben eine Shop-URL ein und klicke auf &quot;Audit starten&quot;. Funktioniert mit jedem WooCommerce- oder Shopify-Shop.
            </p>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
              <span className="text-xs text-ink-500">Beispiel:</span>
              {["bellerei-shop.com", "nooon-cbd.com"].map((ex) => (
                <button
                  key={ex}
                  onClick={() => setUrl(`https://${ex}`)}
                  className="text-xs px-3 py-1.5 rounded-lg border border-ink-700 hover:border-brand-500/50 text-ink-300 hover:text-white transition-colors"
                >
                  {ex}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
