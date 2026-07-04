"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Logo } from "@/components/Logo";

// ---------------------------------------------------------------------------
// Types (subset of the audit engine + benchmark response shape)
// ---------------------------------------------------------------------------

interface SubScore {
  label: string;
  score: number;
}

interface CheckItem {
  label: string;
  ok: boolean;
  detail: string;
}

interface AuditResult {
  shopUrl: string;
  shopName: string;
  platform: string;
  score: number;
  subScores: SubScore[];
  checks: CheckItem[];
}

interface BenchmarkResponse {
  own: AuditResult;
  competitors: AuditResult[];
  comparison: { wins: string[]; losses: string[] };
  note?: string;
}

type State = "idle" | "loading" | "done" | "error";

// Core checks shown as rows (label in API = friendly display name here).
const CORE_CHECK_ROWS: { label: string; display: string }[] = [
  { label: "Structured Data", display: "Structured Data" },
  { label: "HTTPS aktiv", display: "HTTPS" },
  { label: "HSTS-Header", display: "HSTS" },
  { label: "Content-Security-Policy", display: "CSP" },
  { label: "llms.txt", display: "llms.txt" },
  { label: "Meta-Description", display: "Meta-Description" },
  { label: "OpenGraph", display: "OpenGraph" },
];

function scoreColor(score: number): string {
  return score >= 70 ? "rgb(16 185 129)" : score >= 40 ? "rgb(245 158 11)" : "rgb(239 68 68)";
}

function hostOf(u: string): string {
  try {
    return new URL(u).hostname.replace(/^www\./, "");
  } catch {
    return u;
  }
}

function subScoreOf(a: AuditResult, label: string): number | null {
  const s = a.subScores.find((x) => x.label === label);
  return s ? s.score : null;
}

function checkOf(a: AuditResult, label: string): boolean | null {
  const c = a.checks.find((x) => x.label === label);
  return c ? c.ok : null;
}

export default function BenchmarkPage() {
  const router = useRouter();
  const [ownUrl, setOwnUrl] = useState("");
  const [competitorsText, setCompetitorsText] = useState("");
  const [state, setState] = useState<State>("idle");
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<BenchmarkResponse | null>(null);
  const [error, setError] = useState("");
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  function stopProgress() {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }

  function startProgress() {
    setProgress(6);
    stopProgress();
    timerRef.current = setInterval(() => {
      setProgress((p) => (p < 92 ? p + Math.max(1, Math.round((92 - p) / 14)) : p));
    }, 550);
  }

  const busy = state === "loading";

  async function runBenchmark() {
    if (!ownUrl.trim() || busy) return;

    setState("loading");
    setError("");
    setResult(null);
    startProgress();

    const competitors = competitorsText
      .split(/[\n,;]+/)
      .map((s) => s.trim())
      .filter(Boolean);

    try {
      const res = await fetch("/api/benchmark", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: ownUrl.trim(),
          competitors: competitors.length > 0 ? competitors : undefined,
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `HTTP ${res.status}`);
      }

      const data: BenchmarkResponse = await res.json();
      stopProgress();
      setProgress(100);
      setResult(data);
      setState("done");
    } catch (err: unknown) {
      stopProgress();
      setError(err instanceof Error ? err.message : "Unbekannter Fehler");
      setState("error");
    }
  }

  const progressLabel =
    progress < 30
      ? "Dein Shop wird per KI tiefenanalysiert…"
      : progress < 60
        ? "Konkurrenten werden gesucht und gescannt…"
        : progress < 92
          ? "Signale werden Zeile für Zeile verglichen…"
          : "Vergleichs-Report wird erstellt…";

  const shops: AuditResult[] = result ? [result.own, ...result.competitors] : [];
  const subLabels = result ? result.own.subScores.map((s) => s.label) : [];

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
                Benchmark
              </span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push("/dashboard")}
              className="flex items-center gap-2 text-sm text-ink-300 hover:text-white transition-colors"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path
                  d="M19 12H5M5 12L12 19M5 12L12 5"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              <span className="hidden sm:inline">Zurück zum Dashboard</span>
            </button>
          </div>
        </div>
      </nav>

      <div className="max-w-5xl mx-auto px-6 py-12">
        {/* Header */}
        <div className="mb-10">
          <h1 className="text-3xl font-bold mb-2">
            Wettbewerbs-<span className="text-gradient">Benchmark</span>
          </h1>
          <p className="text-ink-400 max-w-2xl">
            Stell deinen Shop direkt neben die Konkurrenz. Gib eine Shop-URL ein — Rankwerk
            findet automatisch bis zu 3 Wettbewerber (oder trag sie selbst ein) und zeigt dir
            schwarz auf weiß, wo du führst und wo du liegen lässt.
          </p>
        </div>

        {/* Input */}
        <div className="glass rounded-2xl p-6 mb-8">
          <label className="block text-sm font-medium text-ink-200 mb-2">Deine Shop-URL</label>
          <div className="flex items-center gap-2 rounded-xl border border-ink-700/60 bg-ink-900/40 px-3 focus-within:border-brand-500/50 transition-colors mb-5">
            <span className="text-ink-400">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
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
            </span>
            <input
              type="text"
              value={ownUrl}
              onChange={(e) => setOwnUrl(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !busy && runBenchmark()}
              placeholder="https://dein-shop.com"
              disabled={busy}
              className="flex-1 bg-transparent text-white placeholder-ink-500 px-1 py-3 focus:outline-none disabled:opacity-50"
            />
          </div>

          <label className="block text-sm font-medium text-ink-200 mb-2">
            Konkurrenten <span className="text-ink-500 font-normal">(optional — sonst automatisch gefunden)</span>
          </label>
          <textarea
            value={competitorsText}
            onChange={(e) => setCompetitorsText(e.target.value)}
            placeholder={"konkurrent-1.com, konkurrent-2.com\nkonkurrent-3.com"}
            disabled={busy}
            rows={3}
            className="w-full rounded-xl border border-ink-700/60 bg-ink-900/40 text-white placeholder-ink-500 px-4 py-3 focus:outline-none focus:border-brand-500/50 transition-colors disabled:opacity-50 text-sm resize-none mb-5"
          />

          <button
            onClick={runBenchmark}
            disabled={!ownUrl.trim() || busy}
            className="w-full sm:w-auto px-8 py-3 rounded-xl font-semibold text-sm text-white transition-opacity disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            style={{ background: "linear-gradient(135deg, #059669, #047857)" }}
          >
            {busy ? (
              <>
                <span className="w-4 h-4 border-2 border-white/60 border-t-transparent rounded-full animate-spin" />
                Vergleiche…
              </>
            ) : (
              <>
                Vergleichen
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                  <path
                    d="M5 12H19M19 12L12 5M19 12L12 19"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </>
            )}
          </button>
        </div>

        {/* Loading */}
        {state === "loading" && (
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
            <p className="text-xs text-ink-500 mt-4">
              Das kann 15–25 Sekunden dauern — dein Shop wird voll analysiert, die Konkurrenten
              parallel gescannt.
            </p>
          </div>
        )}

        {/* Error */}
        {state === "error" && (
          <div className="rounded-2xl border border-danger-500/30 bg-danger-500/5 p-6 mb-8 animate-fade-in">
            <div className="flex items-start gap-4">
              <div className="text-2xl">⚠️</div>
              <div>
                <h3 className="font-semibold text-danger-400 mb-1">Benchmark fehlgeschlagen</h3>
                <p className="text-sm text-ink-400">{error}</p>
                <button
                  onClick={() => {
                    setState("idle");
                    setError("");
                  }}
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
            {/* Note */}
            {result.note && (
              <div className="rounded-xl border border-brand-500/25 bg-brand-500/5 px-4 py-3 text-sm text-ink-300 flex items-start gap-2">
                <span className="text-brand-400">ℹ️</span>
                <span>{result.note}</span>
              </div>
            )}

            {result.competitors.length === 0 ? (
              <div className="glass rounded-2xl p-8 text-center">
                <div className="text-3xl mb-3">🔍</div>
                <h3 className="text-lg font-semibold mb-1">Kein Wettbewerber zum Vergleich</h3>
                <p className="text-sm text-ink-400 max-w-md mx-auto">
                  Für „{result.own.shopName || hostOf(result.own.shopUrl)}“ wurden keine
                  Konkurrenten gefunden. Trag oben einfach 1–3 konkurrierende Shops manuell ein
                  und starte den Vergleich erneut.
                </p>
              </div>
            ) : (
              <>
                {/* Comparison table */}
                <div className="glass rounded-2xl p-6">
                  <h3 className="text-sm font-semibold text-ink-300 uppercase tracking-wider mb-4">
                    Direkter Vergleich
                  </h3>
                  <div className="overflow-x-auto scrollbar-thin -mx-2 px-2">
                    <table className="w-full border-collapse text-sm min-w-[640px]">
                      <thead>
                        <tr className="border-b border-ink-700/50">
                          <th className="text-left font-medium text-ink-400 py-3 pr-4 whitespace-nowrap">
                            Kennzahl
                          </th>
                          {shops.map((s, i) => {
                            const own = i === 0;
                            return (
                              <th
                                key={i}
                                className={`py-3 px-3 text-center align-bottom min-w-[120px] ${
                                  own ? "bg-brand-500/[0.07] rounded-t-lg" : ""
                                }`}
                              >
                                <div
                                  className={`font-semibold truncate max-w-[160px] mx-auto ${
                                    own ? "text-brand-300" : "text-ink-100"
                                  }`}
                                  title={s.shopName || hostOf(s.shopUrl)}
                                >
                                  {s.shopName || hostOf(s.shopUrl)}
                                </div>
                                <div className="text-[11px] text-ink-500 truncate max-w-[160px] mx-auto">
                                  {hostOf(s.shopUrl)}
                                </div>
                                {own && (
                                  <span className="inline-block mt-1 text-[10px] font-semibold uppercase tracking-wider text-brand-400 bg-brand-500/15 rounded px-1.5 py-0.5">
                                    Dein Shop
                                  </span>
                                )}
                              </th>
                            );
                          })}
                        </tr>
                      </thead>
                      <tbody>
                        {/* Gesamt-Score */}
                        <tr className="border-b border-ink-800/60">
                          <td className="py-3 pr-4 font-semibold text-ink-200 whitespace-nowrap">
                            Gesamt-Score
                          </td>
                          {shops.map((s, i) => (
                            <td
                              key={i}
                              className={`py-3 px-3 text-center ${i === 0 ? "bg-brand-500/[0.07]" : ""}`}
                            >
                              <span
                                className="text-lg font-bold tabular-nums"
                                style={{ color: scoreColor(s.score) }}
                              >
                                {s.score}
                              </span>
                              <span className="text-[11px] text-ink-500"> /100</span>
                            </td>
                          ))}
                        </tr>

                        {/* Sub-scores */}
                        {subLabels.map((label) => (
                          <tr key={label} className="border-b border-ink-800/40">
                            <td className="py-2.5 pr-4 text-ink-300 whitespace-nowrap">{label}</td>
                            {shops.map((s, i) => {
                              const v = subScoreOf(s, label);
                              return (
                                <td
                                  key={i}
                                  className={`py-2.5 px-3 text-center tabular-nums ${
                                    i === 0 ? "bg-brand-500/[0.07]" : ""
                                  }`}
                                >
                                  {v === null ? (
                                    <span className="text-ink-600">–</span>
                                  ) : (
                                    <span className="font-medium" style={{ color: scoreColor(v) }}>
                                      {v}
                                    </span>
                                  )}
                                </td>
                              );
                            })}
                          </tr>
                        ))}

                        {/* Divider label */}
                        <tr>
                          <td
                            colSpan={shops.length + 1}
                            className="pt-4 pb-1 text-[11px] font-semibold uppercase tracking-wider text-ink-500"
                          >
                            Kern-Checks
                          </td>
                        </tr>

                        {/* Core checks */}
                        {CORE_CHECK_ROWS.map((row) => (
                          <tr key={row.label} className="border-b border-ink-800/40">
                            <td className="py-2.5 pr-4 text-ink-300 whitespace-nowrap">
                              {row.display}
                            </td>
                            {shops.map((s, i) => {
                              const ok = checkOf(s, row.label);
                              return (
                                <td
                                  key={i}
                                  className={`py-2.5 px-3 text-center ${
                                    i === 0 ? "bg-brand-500/[0.07]" : ""
                                  }`}
                                >
                                  {ok === null ? (
                                    <span className="text-ink-600">–</span>
                                  ) : ok ? (
                                    <span className="text-accent-400 font-bold">✓</span>
                                  ) : (
                                    <span className="text-danger-400 font-bold">✕</span>
                                  )}
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Wins / Losses */}
                <div className="grid md:grid-cols-2 gap-6">
                  {/* Wins */}
                  <div className="rounded-2xl border border-accent-500/30 bg-accent-500/5 p-6">
                    <h3 className="text-sm font-semibold text-accent-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                      🏆 Wo du gewinnst
                    </h3>
                    {result.comparison.wins.length > 0 ? (
                      <ul className="space-y-3">
                        {result.comparison.wins.map((w, i) => (
                          <li key={i} className="flex items-start gap-3 text-sm text-ink-200">
                            <span className="flex-shrink-0 mt-0.5 text-accent-400">✓</span>
                            <span>{w}</span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-sm text-ink-400">
                        Noch kein klarer Vorsprung — aber genau das ist deine Chance. Hol dir mit
                        gezielten Optimierungen die Führung zurück.
                      </p>
                    )}
                  </div>

                  {/* Losses */}
                  <div className="rounded-2xl border border-warn-500/30 bg-warn-500/5 p-6">
                    <h3 className="text-sm font-semibold text-warn-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                      ⚠️ Wo Konkurrenten vorne sind
                    </h3>
                    {result.comparison.losses.length > 0 ? (
                      <ul className="space-y-3">
                        {result.comparison.losses.map((l, i) => (
                          <li key={i} className="flex items-start gap-3 text-sm text-ink-200">
                            <span className="flex-shrink-0 mt-0.5 text-warn-400">→</span>
                            <span>{l}</span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-sm text-ink-400">
                        Stark: In keinem Kern-Bereich zieht ein Konkurrent an dir vorbei. Halte
                        den Vorsprung und baue ihn aus.
                      </p>
                    )}
                  </div>
                </div>

                {/* CTA */}
                <div className="glass rounded-2xl p-8 text-center">
                  <h3 className="text-xl font-semibold mb-2">Vorsprung sichern statt aufholen</h3>
                  <p className="text-ink-400 mb-6 max-w-xl mx-auto">
                    Rankwerk schließt genau diese Lücken automatisch — Content, Structured Data,
                    Meta-Tags, Security. Jeden Tag ein Stück näher an Platz 1.
                  </p>
                  <button
                    onClick={() => router.push("/dashboard")}
                    className="px-6 py-3 rounded-xl font-semibold text-sm text-white transition-opacity hover:opacity-90"
                    style={{ background: "linear-gradient(135deg, #059669, #047857)" }}
                  >
                    Vollständiges Audit starten
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {/* Empty state */}
        {state === "idle" && (
          <div className="text-center py-16">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-ink-800/50 mb-4">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" className="text-ink-500">
                <path
                  d="M3 3v18h18M8 17V9M13 17V5M18 17v-6"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-ink-300 mb-1">Bereit für den Vergleich</h3>
            <p className="text-sm text-ink-500 max-w-md mx-auto">
              Gib oben deine Shop-URL ein und klicke auf „Vergleichen“. Konkurrenten findet
              Rankwerk automatisch — oder trag sie selbst ein.
            </p>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
              <span className="text-xs text-ink-500">Beispiel:</span>
              {["bellerei-shop.com", "nooon-cbd.com"].map((ex) => (
                <button
                  key={ex}
                  onClick={() => setOwnUrl(`https://${ex}`)}
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
