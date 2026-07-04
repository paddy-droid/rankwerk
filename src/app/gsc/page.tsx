"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Logo } from "@/components/Logo";

// ---------------------------------------------------------------------------
// Types (mirror the API responses — no secrets ever reach the client)
// ---------------------------------------------------------------------------

interface GscSite {
  siteUrl: string;
  permissionLevel: string;
}

interface StatusResponse {
  configured: boolean;
  connected: boolean;
  sites?: GscSite[];
  error?: string;
}

interface Totals {
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

interface SeriesPoint {
  date: string;
  clicks: number;
  impressions: number;
}

interface StrikingRow {
  query: string;
  impressions: number;
  position: number;
  ctr: number;
}

interface QueryResponse {
  current: Totals;
  previous: Totals;
  deltaPct: { clicks: number; impressions: number };
  series: SeriesPoint[];
  striking: StrikingRow[];
  range: { currentStart: string; currentEnd: string; previousStart: string; previousEnd: string };
}

type ViewState = "loading" | "not-configured" | "not-connected" | "connected";

// ---------------------------------------------------------------------------
// Formatting helpers
// ---------------------------------------------------------------------------

const nf = new Intl.NumberFormat("de-DE");

function fmtInt(n: number): string {
  return nf.format(Math.round(n));
}
function fmtCtr(ctr: number): string {
  return `${(ctr * 100).toFixed(1).replace(".", ",")} %`;
}
function fmtPos(p: number): string {
  return p.toFixed(1).replace(".", ",");
}
function fmtDate(iso: string): string {
  const [y, m, d] = iso.split("-");
  return d && m && y ? `${d}.${m}.${y}` : iso;
}
function signed(n: number): string {
  const v = Math.round(n * 10) / 10;
  return `${v > 0 ? "+" : ""}${String(v).replace(".", ",")}`;
}

// ---------------------------------------------------------------------------
// Delta badge — higherIsBetter controls the colour semantics
// ---------------------------------------------------------------------------

function DeltaBadge({ value, higherIsBetter = true, suffix = "%" }: { value: number; higherIsBetter?: boolean; suffix?: string }) {
  const rounded = Math.round(value * 10) / 10;
  const neutral = Math.abs(rounded) < 0.05;
  const good = higherIsBetter ? rounded > 0 : rounded < 0;
  const cls = neutral
    ? "bg-ink-800/60 text-ink-400 border-ink-700/50"
    : good
      ? "border-accent-500/30 bg-accent-500/10 text-accent-400"
      : "border-danger-500/30 bg-danger-500/10 text-danger-400";
  const arrow = neutral ? "→" : rounded > 0 ? "▲" : "▼";
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-md border ${cls}`}>
      <span className="text-[10px]">{arrow}</span>
      {signed(rounded)}
      {suffix}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Dependency-free SVG line chart of the click series
// ---------------------------------------------------------------------------

const CHART_W = 720;
const CHART_H = 200;
const CHART_PAD = { top: 16, right: 12, bottom: 24, left: 12 };

function ClicksChart({ series }: { series: SeriesPoint[] }) {
  const W = CHART_W;
  const H = CHART_H;
  const pad = CHART_PAD;

  const { linePath, areaPath, maxClicks, lastPoint } = useMemo(() => {
    if (series.length === 0) {
      return { linePath: "", areaPath: "", maxClicks: 0, lastPoint: null as { x: number; y: number } | null };
    }
    const max = Math.max(1, ...series.map((s) => s.clicks));
    const innerW = W - pad.left - pad.right;
    const innerH = H - pad.top - pad.bottom;
    const stepX = series.length > 1 ? innerW / (series.length - 1) : 0;
    const pts = series.map((s, i) => {
      const x = pad.left + i * stepX;
      const y = pad.top + innerH - (s.clicks / max) * innerH;
      return { x, y };
    });
    const line = pts.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
    const area =
      `M${pts[0].x.toFixed(1)},${(pad.top + innerH).toFixed(1)} ` +
      pts.map((p) => `L${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ") +
      ` L${pts[pts.length - 1].x.toFixed(1)},${(pad.top + innerH).toFixed(1)} Z`;
    return { linePath: line, areaPath: area, maxClicks: max, lastPoint: pts[pts.length - 1] };
  }, [series]);

  if (series.length === 0) {
    return <div className="text-sm text-ink-500 py-8 text-center">Keine Serien-Daten im Zeitraum.</div>;
  }

  return (
    <div className="w-full overflow-x-auto">
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} preserveAspectRatio="none" role="img" aria-label="Klicks-Verlauf">
        <defs>
          <linearGradient id="gscArea" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgb(12 133 235)" stopOpacity="0.35" />
            <stop offset="100%" stopColor="rgb(12 133 235)" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="gscLine" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="rgb(12 133 235)" />
            <stop offset="100%" stopColor="rgb(16 185 129)" />
          </linearGradient>
        </defs>
        {/* baseline */}
        <line x1={pad.left} y1={H - pad.bottom} x2={W - pad.right} y2={H - pad.bottom} stroke="rgb(45 53 69)" strokeWidth="1" />
        <path d={areaPath} fill="url(#gscArea)" />
        <path d={linePath} fill="none" stroke="url(#gscLine)" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
        {lastPoint && <circle cx={lastPoint.x} cy={lastPoint.y} r="4" fill="rgb(16 185 129)" stroke="rgb(8 11 17)" strokeWidth="2" />}
      </svg>
      <div className="flex items-center justify-between text-xs text-ink-500 mt-1 px-1">
        <span>{fmtDate(series[0].date)}</span>
        <span className="text-ink-400">max. {fmtInt(maxClicks)} Klicks/Tag</span>
        <span>{fmtDate(series[series.length - 1].date)}</span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function GscPage() {
  const [view, setView] = useState<ViewState>("loading");
  const [status, setStatus] = useState<StatusResponse | null>(null);
  const [notice, setNotice] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  const [selectedSite, setSelectedSite] = useState("");
  const [loadingData, setLoadingData] = useState(false);
  const [data, setData] = useState<QueryResponse | null>(null);
  const [dataError, setDataError] = useState("");

  // Read ?connected / ?error from the callback (client-only, avoids Suspense).
  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    if (sp.get("connected") === "1") {
      setNotice({ kind: "ok", text: "Google Search Console verbunden. Wähle eine Property und lade die Daten." });
    } else if (sp.get("error")) {
      setNotice({ kind: "err", text: `Verbindung fehlgeschlagen: ${sp.get("error")}` });
    }
    if (sp.get("connected") || sp.get("error")) {
      window.history.replaceState({}, "", "/gsc");
    }
  }, []);

  // Load connection status on mount.
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch("/api/gsc/status");
        const json: StatusResponse = await res.json();
        if (!alive) return;
        setStatus(json);
        if (!json.configured) setView("not-configured");
        else if (!json.connected) setView("not-connected");
        else {
          setView("connected");
          if (json.sites && json.sites.length > 0) setSelectedSite(json.sites[0].siteUrl);
        }
      } catch {
        if (!alive) return;
        setStatus({ configured: false, connected: false });
        setView("not-configured");
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  async function loadData() {
    if (!selectedSite) return;
    setLoadingData(true);
    setDataError("");
    setData(null);
    try {
      const res = await fetch("/api/gsc/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ siteUrl: selectedSite }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`);
      setData(json as QueryResponse);
    } catch (e: unknown) {
      setDataError(e instanceof Error ? e.message : "Daten konnten nicht geladen werden");
    } finally {
      setLoadingData(false);
    }
  }

  const ctrDeltaPp = useMemo(() => {
    if (!data) return 0;
    return (data.current.ctr - data.previous.ctr) * 100;
  }, [data]);

  const posDelta = useMemo(() => {
    if (!data) return 0;
    return data.current.position - data.previous.position;
  }, [data]);

  return (
    <div className="min-h-screen bg-ink-950">
      {/* Top Bar */}
      <nav className="border-b border-ink-800/50 bg-ink-950/80 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-8">
            <Link href="/">
              <Logo />
            </Link>
            <div className="hidden md:flex items-center gap-1 text-sm">
              <span className="px-3 py-1.5 rounded-lg bg-ink-800/50 text-ink-200 font-medium">Search Console</span>
            </div>
          </div>
          <Link
            href="/dashboard"
            className="text-sm text-ink-400 hover:text-white transition-colors flex items-center gap-2"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path d="M19 12H5M5 12L12 19M5 12L12 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Zurück zum Dashboard
          </Link>
        </div>
      </nav>

      <div className="max-w-5xl mx-auto px-6 py-12">
        {/* Header */}
        <div className="mb-10">
          <h1 className="text-3xl font-bold mb-2">Google Search Console</h1>
          <p className="text-ink-400 max-w-2xl">
            Verbinde deine Property und beweise die Wirkung schwarz auf weiß: Klicks, Impressionen und Rankings der
            letzten 28 Tage gegen die Vorperiode — plus die Suchbegriffe, bei denen du kurz vor Seite 1 stehst.
          </p>
        </div>

        {/* Notice from callback */}
        {notice && (
          <div
            className={`rounded-2xl border p-4 mb-8 animate-fade-in flex items-start gap-3 ${
              notice.kind === "ok"
                ? "border-accent-500/30 bg-accent-500/5 text-accent-400"
                : "border-danger-500/30 bg-danger-500/5 text-danger-400"
            }`}
          >
            <span className="text-lg">{notice.kind === "ok" ? "✅" : "⚠️"}</span>
            <span className="text-sm">{notice.text}</span>
          </div>
        )}

        {/* Loading */}
        {view === "loading" && (
          <div className="glass rounded-2xl p-10 flex items-center gap-3 text-ink-300">
            <span className="w-5 h-5 border-2 border-brand-400 border-t-transparent rounded-full animate-spin" />
            Verbindungsstatus wird geprüft…
          </div>
        )}

        {/* Not configured */}
        {view === "not-configured" && (
          <div className="glass rounded-2xl p-8 animate-fade-in">
            <div className="flex items-start gap-4">
              <div className="text-3xl">🔧</div>
              <div>
                <h2 className="text-xl font-semibold mb-2">GSC-Setup nötig</h2>
                <p className="text-ink-400 mb-4 max-w-2xl">
                  Die Google-Search-Console-Anbindung ist noch nicht konfiguriert. Sie ist schnell eingerichtet:
                </p>
                <ol className="space-y-2 text-sm text-ink-300 list-decimal list-inside mb-5">
                  <li>
                    In der <span className="text-ink-100">Google Cloud Console</span> einen OAuth-Client (Typ:
                    „Webanwendung") anlegen.
                  </li>
                  <li>
                    Als autorisierte Redirect-URI{" "}
                    <code className="px-1.5 py-0.5 rounded bg-ink-800 text-brand-300 text-xs">/api/gsc/callback</code>{" "}
                    (auf der Live-Domain) eintragen.
                  </li>
                  <li>
                    <code className="px-1.5 py-0.5 rounded bg-ink-800 text-brand-300 text-xs">GSC_CLIENT_ID</code> und{" "}
                    <code className="px-1.5 py-0.5 rounded bg-ink-800 text-brand-300 text-xs">GSC_CLIENT_SECRET</code> in
                    den Netlify-Umgebungsvariablen hinterlegen.
                  </li>
                </ol>
                <p className="text-xs text-ink-500">
                  Details siehe <span className="text-ink-300">DEPLOY.md</span> und{" "}
                  <span className="text-ink-300">.env.example</span>. Scope:{" "}
                  <code className="text-ink-400">webmasters.readonly</code> (nur Lesezugriff).
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Configured, not connected */}
        {view === "not-connected" && (
          <div className="glass rounded-2xl p-10 text-center animate-fade-in">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-brand-500/10 mb-5">
              <svg width="34" height="34" viewBox="0 0 24 24" fill="none" className="text-brand-400">
                <path d="M21 21L16.5 16.5M19 10.5A8.5 8.5 0 112 10.5a8.5 8.5 0 0117 0Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold mb-2">Search Console verbinden</h2>
            <p className="text-ink-400 max-w-lg mx-auto mb-6">
              Ein Klick, Google-Login, fertig. Rankwerk erhält ausschließlich Lesezugriff auf deine Search-Console-Daten
              und zeigt dir die Wirkung deiner Optimierungen.
            </p>
            <a
              href="/api/gsc/auth"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-semibold text-sm text-white transition-transform hover:scale-[1.02]"
              style={{ background: "linear-gradient(135deg,#059669,#047857)" }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 11v2h5.5c-.2 1.2-1.6 3.6-5.5 3.6A5.6 5.6 0 116.4 12 5.6 5.6 0 0112 6.4a5 5 0 013.6 1.4l1.8-1.8A8 8 0 0012 4a8 8 0 100 16c4.6 0 7.7-3.2 7.7-7.8 0-.5 0-.9-.1-1.2H12Z" />
              </svg>
              Google Search Console verbinden
            </a>
            <p className="text-xs text-ink-600 mt-4">Zugriff jederzeit im Google-Konto widerrufbar.</p>
          </div>
        )}

        {/* Connected */}
        {view === "connected" && status && (
          <div className="space-y-6 animate-fade-in">
            {/* Property picker */}
            <div className="glass rounded-2xl p-6">
              <div className="flex flex-col sm:flex-row sm:items-end gap-4">
                <div className="flex-1">
                  <label className="block text-xs text-ink-400 uppercase tracking-wider mb-2">Property</label>
                  {status.sites && status.sites.length > 0 ? (
                    <select
                      value={selectedSite}
                      onChange={(e) => setSelectedSite(e.target.value)}
                      className="w-full bg-ink-900 border border-ink-700 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-brand-500/60"
                    >
                      {status.sites.map((s) => (
                        <option key={s.siteUrl} value={s.siteUrl}>
                          {s.siteUrl}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <div className="text-sm text-ink-400 bg-ink-900/60 border border-ink-700/50 rounded-xl px-4 py-3">
                      {status.error
                        ? `Properties konnten nicht geladen werden: ${status.error}`
                        : "Keine Properties gefunden. Ist dieses Google-Konto in der Search Console verifiziert?"}
                    </div>
                  )}
                </div>
                <button
                  onClick={loadData}
                  disabled={!selectedSite || loadingData}
                  className="px-6 py-3 rounded-xl font-semibold text-sm text-white transition-transform hover:scale-[1.02] disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:scale-100 whitespace-nowrap"
                  style={{ background: "linear-gradient(135deg,#059669,#047857)" }}
                >
                  {loadingData ? (
                    <span className="flex items-center gap-2">
                      <span className="w-4 h-4 border-2 border-white/70 border-t-transparent rounded-full animate-spin" />
                      Lade Daten…
                    </span>
                  ) : (
                    "Daten laden"
                  )}
                </button>
              </div>
            </div>

            {/* Data error */}
            {dataError && (
              <div className="rounded-2xl border border-danger-500/30 bg-danger-500/5 p-5 text-sm text-danger-400">
                <strong className="font-semibold">Abfrage fehlgeschlagen:</strong> {dataError}
                {dataError.toLowerCase().includes("verbindung") && (
                  <a href="/api/gsc/auth" className="ml-2 text-brand-400 hover:underline">
                    Neu verbinden
                  </a>
                )}
              </div>
            )}

            {/* Results */}
            {data && (
              <>
                {/* Sales-forward proof banner */}
                {data.deltaPct.clicks > 0 && (
                  <div className="rounded-2xl border border-accent-500/30 bg-gradient-to-r from-accent-500/10 to-brand-500/5 p-6">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">📈</span>
                      <p className="text-lg font-semibold text-white">
                        Beweis: {signed(data.deltaPct.clicks)}% Klicks aus der Google-Suche gegenüber der Vorperiode.
                      </p>
                    </div>
                  </div>
                )}

                {/* KPI cards */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="glass rounded-2xl p-5">
                    <div className="text-xs text-ink-400 uppercase tracking-wider mb-2">Klicks</div>
                    <div className="text-3xl font-bold mb-2">{fmtInt(data.current.clicks)}</div>
                    <DeltaBadge value={data.deltaPct.clicks} />
                    <div className="text-xs text-ink-600 mt-2">Vorher {fmtInt(data.previous.clicks)}</div>
                  </div>
                  <div className="glass rounded-2xl p-5">
                    <div className="text-xs text-ink-400 uppercase tracking-wider mb-2">Impressionen</div>
                    <div className="text-3xl font-bold mb-2">{fmtInt(data.current.impressions)}</div>
                    <DeltaBadge value={data.deltaPct.impressions} />
                    <div className="text-xs text-ink-600 mt-2">Vorher {fmtInt(data.previous.impressions)}</div>
                  </div>
                  <div className="glass rounded-2xl p-5">
                    <div className="text-xs text-ink-400 uppercase tracking-wider mb-2">CTR</div>
                    <div className="text-3xl font-bold mb-2">{fmtCtr(data.current.ctr)}</div>
                    <DeltaBadge value={ctrDeltaPp} suffix=" pp" />
                    <div className="text-xs text-ink-600 mt-2">Vorher {fmtCtr(data.previous.ctr)}</div>
                  </div>
                  <div className="glass rounded-2xl p-5">
                    <div className="text-xs text-ink-400 uppercase tracking-wider mb-2">Ø-Position</div>
                    <div className="text-3xl font-bold mb-2">{fmtPos(data.current.position)}</div>
                    {/* lower position number = better ranking */}
                    <DeltaBadge value={posDelta} higherIsBetter={false} suffix="" />
                    <div className="text-xs text-ink-600 mt-2">Vorher {fmtPos(data.previous.position)}</div>
                  </div>
                </div>

                {/* Chart */}
                <div className="glass rounded-2xl p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-semibold text-ink-300 uppercase tracking-wider">Klicks-Verlauf (28 Tage)</h3>
                    <span className="text-xs text-ink-500">
                      {fmtDate(data.range.currentStart)} – {fmtDate(data.range.currentEnd)}
                    </span>
                  </div>
                  <ClicksChart series={data.series} />
                </div>

                {/* Striking distance */}
                <div className="glass rounded-2xl p-6">
                  <h3 className="text-sm font-semibold text-ink-300 uppercase tracking-wider mb-1 flex items-center gap-2">
                    🎯 Striking Distance — schnelle Gewinne
                  </h3>
                  <p className="text-xs text-ink-500 mb-4">
                    Suchbegriffe auf Position 4–20. Kleine On-Page-Optimierungen holen sie auf Seite 1 — dort beginnt der
                    echte Traffic.
                  </p>
                  {data.striking.length === 0 ? (
                    <div className="text-sm text-ink-500 py-4">Keine Begriffe auf Position 4–20 im Zeitraum.</div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="text-left text-xs text-ink-500 uppercase tracking-wider border-b border-ink-800">
                            <th className="py-2 pr-4 font-medium">Suchbegriff</th>
                            <th className="py-2 px-2 font-medium text-right">Impressionen</th>
                            <th className="py-2 px-2 font-medium text-right">Ø-Position</th>
                            <th className="py-2 pl-2 font-medium text-right">CTR</th>
                          </tr>
                        </thead>
                        <tbody>
                          {data.striking.map((r, i) => (
                            <tr key={i} className="border-b border-ink-900/70 hover:bg-ink-900/40">
                              <td className="py-2.5 pr-4 text-ink-100 max-w-[280px] truncate" title={r.query}>
                                {r.query}
                              </td>
                              <td className="py-2.5 px-2 text-right text-ink-300 tabular-nums">{fmtInt(r.impressions)}</td>
                              <td className="py-2.5 px-2 text-right tabular-nums">
                                <span
                                  className={`inline-block px-2 py-0.5 rounded-md text-xs font-semibold ${
                                    r.position <= 10
                                      ? "bg-warn-500/10 text-warn-400 border border-warn-500/30"
                                      : "bg-ink-800/60 text-ink-300 border border-ink-700/50"
                                  }`}
                                >
                                  {fmtPos(r.position)}
                                </span>
                              </td>
                              <td className="py-2.5 pl-2 text-right text-ink-300 tabular-nums">{fmtCtr(r.ctr)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                <p className="text-xs text-ink-600 text-center">
                  Vergleich: {fmtDate(data.range.currentStart)}–{fmtDate(data.range.currentEnd)} gegen{" "}
                  {fmtDate(data.range.previousStart)}–{fmtDate(data.range.previousEnd)}. Daten aus Google Search Console.
                </p>
              </>
            )}

            {/* Empty state before first load */}
            {!data && !dataError && !loadingData && (
              <div className="text-center py-14 text-ink-500">
                <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-ink-800/50 mb-3 text-2xl">📊</div>
                <p className="text-sm">Property wählen und „Daten laden" klicken.</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
