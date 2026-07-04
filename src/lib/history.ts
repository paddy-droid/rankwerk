// Audit-Verlauf: clientseitige Historie in localStorage.
// KEIN "use client" — das sind reine TS-Helfer. Sie greifen aber auf
// window/localStorage zu, daher guardet JEDE Funktion `typeof window`
// (SSR-sicher: auf dem Server passiert nichts / es kommt [] zurueck).

export type HistoryEntry = {
  url: string;
  shopName: string;
  score: number;
  subScores: { label: string; score: number }[];
  timestamp: string;
};

// Minimaler Ausschnitt eines AuditResult, den saveAudit tatsaechlich liest.
// Bewusst locker getypt, damit der Aufrufer das komplette AuditResult
// (aus src/lib/audit.ts) einfach durchreichen kann.
type AuditInput = {
  shopUrl?: string;
  shopName?: string;
  score?: number;
  subScores?: { label: string; score: number }[];
  generatedAt?: string;
};

const STORAGE_KEY = "rankwerk_history";
const MAX_ENTRIES = 100;

// ---------------------------------------------------------------------------
// Low-level Storage (alle SSR-/JSON-/Quota-sicher)
// ---------------------------------------------------------------------------

function hasStorage(): boolean {
  return typeof window !== "undefined" && !!window.localStorage;
}

function timeOf(entry: HistoryEntry): number {
  const t = Date.parse(entry.timestamp);
  return Number.isNaN(t) ? 0 : t;
}

function sanitizeSubScores(raw: unknown): { label: string; score: number }[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter(
      (s): s is { label: unknown; score: unknown } =>
        !!s && typeof s === "object" && typeof (s as { label?: unknown }).label === "string"
    )
    .map((s) => ({
      label: String(s.label),
      score: Number.isFinite(Number(s.score)) ? Number(s.score) : 0,
    }));
}

function normalizeEntry(raw: unknown): HistoryEntry | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.timestamp !== "string" || typeof r.url !== "string") return null;
  return {
    url: r.url,
    shopName: typeof r.shopName === "string" ? r.shopName : "",
    score: Number.isFinite(Number(r.score)) ? Number(r.score) : 0,
    subScores: sanitizeSubScores(r.subScores),
    timestamp: r.timestamp,
  };
}

function readAll(): HistoryEntry[] {
  if (!hasStorage()) return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map(normalizeEntry)
      .filter((e): e is HistoryEntry => e !== null);
  } catch {
    return [];
  }
}

function writeAll(entries: HistoryEntry[]): void {
  if (!hasStorage()) return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  } catch {
    // Quota ueberschritten oder privater Modus → still ignorieren.
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** Reduziert eine URL auf den blanken Host (ohne Protokoll/www/Pfad) — fuer die
 *  Gruppierung pro Shop-Domain. Robust gegen Muell-Eingaben. */
export function normalizeHost(url: string): string {
  if (!url) return "";
  let raw = String(url).trim();
  if (!raw) return "";
  try {
    if (!/^https?:\/\//i.test(raw)) raw = "https://" + raw;
    return new URL(raw).hostname.replace(/^www\./i, "").toLowerCase();
  } catch {
    return raw
      .replace(/^https?:\/\//i, "")
      .replace(/^www\./i, "")
      .split("/")[0]
      .split("?")[0]
      .toLowerCase();
  }
}

/** Haengt einen Lauf an die Historie an (aeltere werden bei >100 abgeschnitten).
 *  Liest die noetigen AuditResult-Felder; gibt den gespeicherten Eintrag zurueck
 *  (oder null, wenn kein window / kein result). */
export function saveAudit(result: AuditInput): HistoryEntry | null {
  if (!hasStorage() || !result) return null;

  const url = String(result.shopUrl ?? "");
  const entry: HistoryEntry = {
    url,
    shopName: (typeof result.shopName === "string" && result.shopName) || normalizeHost(url),
    score: Number.isFinite(Number(result.score)) ? Number(result.score) : 0,
    subScores: sanitizeSubScores(result.subScores),
    timestamp:
      typeof result.generatedAt === "string" && result.generatedAt
        ? result.generatedAt
        : new Date().toISOString(),
  };

  const all = readAll();
  all.push(entry);
  // Nur die neuesten MAX_ENTRIES behalten (aeltere vom Anfang abschneiden).
  const trimmed = all.length > MAX_ENTRIES ? all.slice(all.length - MAX_ENTRIES) : all;
  writeAll(trimmed);
  return entry;
}

/** Gesamte Historie, neueste zuerst. */
export function getHistory(): HistoryEntry[] {
  return readAll().sort((a, b) => timeOf(b) - timeOf(a));
}

/** Alle Laeufe einer Domain, chronologisch (alt → neu) — fuer die Score-Kurve. */
export function getHistoryForUrl(url: string): HistoryEntry[] {
  const host = normalizeHost(url);
  return readAll()
    .filter((e) => normalizeHost(e.url) === host)
    .sort((a, b) => timeOf(a) - timeOf(b));
}

/** Loescht die komplette Historie. */
export function clearHistory(): void {
  if (!hasStorage()) return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignorieren
  }
}

/** Loescht einen einzelnen Eintrag anhand seines Zeitstempels. */
export function deleteEntry(timestamp: string): void {
  const remaining = readAll().filter((e) => e.timestamp !== timestamp);
  writeAll(remaining);
}
