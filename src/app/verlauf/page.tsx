"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Logo } from "@/components/Logo";
import { ScoreSparkline } from "@/components/ScoreSparkline";
import {
  getHistory,
  clearHistory,
  deleteEntry,
  normalizeHost,
  type HistoryEntry,
} from "@/lib/history";

// --------------------------------------------------------------------------
// Helpers
// --------------------------------------------------------------------------

function scoreColor(score: number): string {
  return score >= 70 ? "#10b981" : score >= 40 ? "#f59e0b" : "#ef4444";
}

function safeTime(ts: string): number {
  const t = Date.parse(ts);
  return Number.isNaN(t) ? 0 : t;
}

function fmtDate(ts: string): string {
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("de-DE", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

type Group = {
  host: string;
  shopName: string;
  entries: HistoryEntry[]; // alt → neu
  current: number;
  delta: number | null;
  runs: number;
  lastRun: string;
};

function buildGroups(all: HistoryEntry[]): Group[] {
  const map = new Map<string, HistoryEntry[]>();
  for (const e of all) {
    const host = normalizeHost(e.url) || e.url || "unbekannt";
    const arr = map.get(host);
    if (arr) arr.push(e);
    else map.set(host, [e]);
  }

  const groups: Group[] = [];
  map.forEach((entries, host) => {
    const sorted = [...entries].sort((a, b) => safeTime(a.timestamp) - safeTime(b.timestamp));
    const current = sorted[sorted.length - 1];
    const previous = sorted.length >= 2 ? sorted[sorted.length - 2] : null;
    groups.push({
      host,
      shopName: current.shopName || host,
      entries: sorted,
      current: current.score,
      delta: previous ? current.score - previous.score : null,
      runs: sorted.length,
      lastRun: current.timestamp,
    });
  });

  return groups.sort((a, b) => safeTime(b.lastRun) - safeTime(a.lastRun));
}

type SubSeries = { label: string; values: number[]; current: number; delta: number | null };

function subScoreSeries(entries: HistoryEntry[]): SubSeries[] {
  const labels: string[] = [];
  for (const e of entries) {
    for (const s of e.subScores) {
      if (!labels.includes(s.label)) labels.push(s.label);
    }
  }
  return labels.map((label) => {
    const values = entries
      .map((e) => e.subScores.find((s) => s.label === label))
      .filter((s): s is { label: string; score: number } => !!s)
      .map((s) => s.score);
    const current = values.length ? values[values.length - 1] : 0;
    const delta = values.length >= 2 ? current - values[values.length - 2] : null;
    return { label, values, current, delta };
  });
}

// --------------------------------------------------------------------------
// Kleine UI-Bausteine
// --------------------------------------------------------------------------

function ScoreRing({ score, size = 74 }: { score: number; size?: number }) {
  const stroke = 6;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const cx = size / 2;
  return (
    <div className="relative flex-shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        <circle cx={cx} cy={cx} r={r} stroke="rgb(45 53 69)" strokeWidth={stroke} fill="none" />
        <circle
          cx={cx}
          cy={cx}
          r={r}
          stroke={scoreColor(score)}
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${(clampScore(score) / 100) * c} ${c}`}
          className="transition-all duration-700"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-xl font-bold leading-none">{score}</span>
        <span className="text-[10px] text-ink-500 mt-0.5">/ 100</span>
      </div>
    </div>
  );
}

function clampScore(v: number): number {
  return Math.max(0, Math.min(100, v));
}

function DeltaBadge({ delta, size = "md" }: { delta: number | null; size?: "sm" | "md" }) {
  const pad = size === "sm" ? "px-1.5 py-0.5 text-[11px]" : "px-2.5 py-1 text-xs";
  if (delta === null) {
    return (
      <span className={`inline-flex items-center rounded-md bg-ink-800/60 text-ink-400 font-medium ${pad}`}>
        Erster Lauf
      </span>
    );
  }
  if (delta === 0) {
    return (
      <span className={`inline-flex items-center gap-1 rounded-md bg-ink-800/60 text-ink-300 font-medium ${pad}`}>
        ±0
      </span>
    );
  }
  const up = delta > 0;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md font-semibold ${pad} ${
        up
          ? "bg-accent-500/10 text-accent-400 border border-accent-500/30"
          : "bg-danger-500/10 text-danger-400 border border-danger-500/30"
      }`}
    >
      <span aria-hidden>{up ? "▲" : "▼"}</span>
      {up ? "+" : ""}
      {delta} {Math.abs(delta) === 1 ? "Punkt" : "Punkte"}
    </span>
  );
}

// --------------------------------------------------------------------------
// Seite
// --------------------------------------------------------------------------

export default function VerlaufPage() {
  const [hydrated, setHydrated] = useState(false);
  const [entries, setEntries] = useState<HistoryEntry[]>([]);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [confirmClear, setConfirmClear] = useState(false);

  useEffect(() => {
    setEntries(getHistory());
    setHydrated(true);
  }, []);

  const groups = useMemo(() => buildGroups(entries), [entries]);
  const totalRuns = entries.length;

  function refresh() {
    setEntries(getHistory());
  }

  function toggle(host: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(host)) next.delete(host);
      else next.add(host);
      return next;
    });
  }

  function handleClearAll() {
    clearHistory();
    setConfirmClear(false);
    refresh();
  }

  function handleDelete(timestamp: string) {
    deleteEntry(timestamp);
    refresh();
  }

  return (
    <div className="min-h-screen bg-ink-950">
      {/* Top-Nav */}
      <nav className="border-b border-ink-800/50 bg-ink-950/80 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-8">
            <Link href="/">
              <Logo />
            </Link>
            <div className="hidden md:flex items-center gap-1 text-sm">
              <span className="px-3 py-1.5 rounded-lg bg-ink-800/50 text-ink-200 font-medium">
                Verlauf
              </span>
            </div>
          </div>
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-ink-700 text-ink-200 text-sm font-medium hover:border-brand-500/50 hover:text-white transition-colors"
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
            Zurück zum Dashboard
          </Link>
        </div>
      </nav>

      <div className="max-w-5xl mx-auto px-6 py-12">
        {/* Header */}
        <div className="mb-10 flex flex-col md:flex-row md:items-end md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold mb-2">Audit-Verlauf</h1>
            <p className="text-ink-400">
              Alle deine Audits — pro Shop gruppiert, mit Score-Kurve über die Zeit. Läuft komplett
              lokal in deinem Browser.
            </p>
          </div>
          {hydrated && groups.length > 0 && (
            <div className="flex items-center gap-3 text-sm text-ink-400 flex-shrink-0">
              <span>
                <span className="text-ink-100 font-semibold">{groups.length}</span>{" "}
                {groups.length === 1 ? "Shop" : "Shops"}
              </span>
              <span className="w-1 h-1 rounded-full bg-ink-600" />
              <span>
                <span className="text-ink-100 font-semibold">{totalRuns}</span>{" "}
                {totalRuns === 1 ? "Lauf" : "Läufe"}
              </span>
            </div>
          )}
        </div>

        {/* Ladezustand (vor Hydration) */}
        {!hydrated && (
          <div className="flex items-center justify-center py-24">
            <span className="w-6 h-6 border-2 border-ink-600 border-t-brand-400 rounded-full animate-spin" />
          </div>
        )}

        {/* Leer-Zustand */}
        {hydrated && groups.length === 0 && (
          <div className="glass rounded-2xl p-12 text-center animate-fade-in">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-ink-800/50 mb-4">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" className="text-ink-500">
                <path
                  d="M3 3v18h18M7 15l3-3 3 3 5-6"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-ink-200 mb-1">Noch keine Audits</h3>
            <p className="text-sm text-ink-500 max-w-md mx-auto mb-6">
              Sobald du dein erstes Shop-Audit startest, sammeln wir hier die Ergebnisse und zeigen
              dir, wie sich dein Score über die Zeit entwickelt.
            </p>
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-white text-ink-950 font-semibold text-sm hover:bg-ink-100 transition-colors"
            >
              Starte dein erstes Audit
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
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
        )}

        {/* Inhalt */}
        {hydrated && groups.length > 0 && (
          <div className="space-y-5 animate-fade-in">
            {/* Aktionsleiste */}
            <div className="flex items-center justify-end">
              {!confirmClear ? (
                <button
                  onClick={() => setConfirmClear(true)}
                  className="inline-flex items-center gap-2 text-sm text-ink-400 hover:text-danger-400 transition-colors"
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
                    <path
                      d="M4 7h16M10 11v6M14 11v6M5 7l1 13a2 2 0 002 2h8a2 2 0 002-2l1-13M9 7V4a1 1 0 011-1h4a1 1 0 011 1v3"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                  Verlauf löschen
                </button>
              ) : (
                <div className="flex items-center gap-3 text-sm">
                  <span className="text-ink-300">Gesamten Verlauf wirklich löschen?</span>
                  <button
                    onClick={handleClearAll}
                    className="px-3 py-1.5 rounded-lg bg-danger-500/15 text-danger-400 border border-danger-500/30 font-medium hover:bg-danger-500/25 transition-colors"
                  >
                    Ja, alles löschen
                  </button>
                  <button
                    onClick={() => setConfirmClear(false)}
                    className="px-3 py-1.5 rounded-lg border border-ink-700 text-ink-300 hover:border-ink-500 transition-colors"
                  >
                    Abbrechen
                  </button>
                </div>
              )}
            </div>

            {/* Shop-Karten */}
            {groups.map((g) => {
              const isOpen = expanded.has(g.host);
              const series = isOpen ? subScoreSeries(g.entries) : [];
              const runsDesc = [...g.entries].reverse();
              return (
                <div key={g.host} className="glass rounded-2xl p-6 relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-56 h-56 bg-brand-600/5 rounded-full blur-[60px] pointer-events-none" />

                  {/* Kopf */}
                  <div className="relative flex flex-col sm:flex-row sm:items-center gap-5">
                    <ScoreRing score={g.current} />

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <h2 className="text-lg font-bold truncate">{g.shopName}</h2>
                        <DeltaBadge delta={g.delta} />
                      </div>
                      <div className="flex items-center gap-2 text-sm text-ink-400 flex-wrap">
                        <span className="truncate">{g.host}</span>
                        <span className="w-1 h-1 rounded-full bg-ink-600" />
                        <span>
                          {g.runs} {g.runs === 1 ? "Lauf" : "Läufe"}
                        </span>
                        <span className="w-1 h-1 rounded-full bg-ink-600" />
                        <span>Letzter: {fmtDate(g.lastRun)}</span>
                      </div>
                    </div>

                    {/* Sparkline */}
                    <div className="flex-shrink-0 overflow-x-auto -mx-1 px-1">
                      <ScoreSparkline values={g.entries.map((e) => e.score)} width={300} height={64} />
                    </div>
                  </div>

                  {/* Expand-Zeile */}
                  <div className="relative mt-4 pt-4 border-t border-ink-800/60 flex items-center justify-between">
                    <button
                      onClick={() => toggle(g.host)}
                      className="inline-flex items-center gap-2 text-sm text-brand-400 hover:text-brand-300 transition-colors"
                    >
                      <svg
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        className={`transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
                      >
                        <path
                          d="M6 9l6 6 6-6"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                      {isOpen ? "Details ausblenden" : "Sub-Scores & Läufe anzeigen"}
                    </button>
                  </div>

                  {/* Expand-Inhalt */}
                  {isOpen && (
                    <div className="relative mt-4 space-y-6 animate-fade-in">
                      {/* Sub-Score-Entwicklung */}
                      {series.length > 0 && (
                        <div>
                          <h3 className="text-xs font-semibold text-ink-400 uppercase tracking-wider mb-3">
                            Sub-Score-Entwicklung
                          </h3>
                          <div className="grid sm:grid-cols-2 gap-3">
                            {series.map((s) => (
                              <div
                                key={s.label}
                                className="rounded-xl bg-ink-900/40 border border-ink-800/60 p-3"
                              >
                                <div className="flex items-center justify-between gap-2 mb-1.5">
                                  <span className="text-sm text-ink-200 truncate">{s.label}</span>
                                  <span
                                    className="text-sm font-mono font-semibold"
                                    style={{ color: scoreColor(s.current) }}
                                  >
                                    {s.current}
                                  </span>
                                </div>
                                <div className="flex items-center gap-3">
                                  <div className="flex-1 overflow-x-auto">
                                    <ScoreSparkline
                                      values={s.values}
                                      width={200}
                                      height={36}
                                      strokeWidth={1.75}
                                      showArea={false}
                                    />
                                  </div>
                                  <DeltaBadge delta={s.delta} size="sm" />
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Einzelne Läufe */}
                      <div>
                        <h3 className="text-xs font-semibold text-ink-400 uppercase tracking-wider mb-3">
                          Einzelne Läufe ({g.runs})
                        </h3>
                        <div className="space-y-1.5">
                          {runsDesc.map((e) => (
                            <div
                              key={e.timestamp}
                              className="flex items-center gap-3 py-2 px-3 rounded-lg bg-ink-900/40 border border-ink-800/40"
                            >
                              <span
                                className="w-9 text-sm font-mono font-semibold flex-shrink-0"
                                style={{ color: scoreColor(e.score) }}
                              >
                                {e.score}
                              </span>
                              <span className="text-sm text-ink-400 flex-1 truncate">
                                {fmtDate(e.timestamp)}
                              </span>
                              <button
                                onClick={() => handleDelete(e.timestamp)}
                                title="Diesen Lauf löschen"
                                aria-label="Diesen Lauf löschen"
                                className="flex-shrink-0 p-1.5 rounded-md text-ink-500 hover:text-danger-400 hover:bg-danger-500/10 transition-colors"
                              >
                                <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
                                  <path
                                    d="M4 7h16M10 11v6M14 11v6M5 7l1 13a2 2 0 002 2h8a2 2 0 002-2l1-13M9 7V4a1 1 0 011-1h4a1 1 0 011 1v3"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                  />
                                </svg>
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
