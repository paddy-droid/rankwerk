import { NextRequest, NextResponse } from "next/server";
import { refreshAccessToken, queryAnalytics, type AnalyticsRow } from "@/lib/gsc";

// Runs as a Netlify Function (Node runtime). Pulls the last 28 days vs. the 28
// days before, a click series for the chart, and striking-distance queries.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

// GSC finalizes its data with a delay, so we end the window a couple of days in
// the past — both periods are shifted equally, so the comparison stays fair.
const DATA_LAG_DAYS = 2;
const WINDOW = 28;

// --- date helpers (server runtime → new Date()/Date.now() are fine here) ------

function fmt(d: Date): string {
  return d.toISOString().slice(0, 10); // YYYY-MM-DD (UTC)
}
function daysAgo(n: number): Date {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() - n);
  return d;
}

// --- aggregation --------------------------------------------------------------

interface Totals {
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

function aggregate(rows: AnalyticsRow[]): Totals {
  let clicks = 0;
  let impressions = 0;
  let weightedPos = 0;
  for (const r of rows) {
    clicks += r.clicks;
    impressions += r.impressions;
    weightedPos += r.position * r.impressions;
  }
  return {
    clicks,
    impressions,
    ctr: impressions > 0 ? clicks / impressions : 0,
    position: impressions > 0 ? weightedPos / impressions : 0,
  };
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function pct(cur: number, prev: number): number {
  if (prev <= 0) return cur > 0 ? 100 : 0;
  return round1(((cur - prev) / prev) * 100);
}

export async function POST(req: NextRequest) {
  const refreshToken = req.cookies.get("gsc_rt")?.value;
  if (!refreshToken) {
    return NextResponse.json({ error: "nicht verbunden" }, { status: 401 });
  }

  const raw: unknown = await req.json().catch(() => ({}));
  const rec = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const siteUrl = typeof rec.siteUrl === "string" ? rec.siteUrl.trim() : "";
  if (!siteUrl) {
    return NextResponse.json({ error: "siteUrl erforderlich" }, { status: 400 });
  }

  let accessToken: string;
  try {
    accessToken = await refreshAccessToken(refreshToken);
  } catch {
    // Refresh token revoked/expired → force a reconnect.
    return NextResponse.json({ error: "Verbindung abgelaufen — bitte neu verbinden." }, { status: 401 });
  }

  // Contiguous, non-overlapping 28-day windows.
  const curEnd = daysAgo(DATA_LAG_DAYS);
  const curStart = daysAgo(DATA_LAG_DAYS + WINDOW - 1);
  const prevEnd = daysAgo(DATA_LAG_DAYS + WINDOW);
  const prevStart = daysAgo(DATA_LAG_DAYS + 2 * WINDOW - 1);

  try {
    const [curRows, prevRows, strikingRows] = await Promise.all([
      queryAnalytics(accessToken, siteUrl, {
        startDate: fmt(curStart),
        endDate: fmt(curEnd),
        dimensions: ["date"],
        rowLimit: 1000,
      }),
      queryAnalytics(accessToken, siteUrl, {
        startDate: fmt(prevStart),
        endDate: fmt(prevEnd),
        dimensions: ["date"],
        rowLimit: 1000,
      }),
      // The API can't filter by the `position` metric, so we pull the top
      // queries and keep positions 4–20 (striking distance) in code.
      queryAnalytics(accessToken, siteUrl, {
        startDate: fmt(curStart),
        endDate: fmt(curEnd),
        dimensions: ["query"],
        rowLimit: 500,
      }),
    ]);

    const current = aggregate(curRows);
    const previous = aggregate(prevRows);

    const series = curRows
      .map((r) => ({ date: r.keys?.[0] ?? "", clicks: r.clicks, impressions: r.impressions }))
      .filter((s) => s.date)
      .sort((a, b) => a.date.localeCompare(b.date));

    const striking = strikingRows
      .filter((r) => r.position >= 4 && r.position <= 20 && r.impressions > 0)
      .sort((a, b) => b.impressions - a.impressions)
      .slice(0, 25)
      .map((r) => ({
        query: r.keys?.[0] ?? "",
        impressions: r.impressions,
        position: round1(r.position),
        ctr: r.ctr,
      }));

    return NextResponse.json({
      current: {
        clicks: current.clicks,
        impressions: current.impressions,
        ctr: current.ctr,
        position: round1(current.position),
      },
      previous: {
        clicks: previous.clicks,
        impressions: previous.impressions,
        ctr: previous.ctr,
        position: round1(previous.position),
      },
      deltaPct: {
        clicks: pct(current.clicks, previous.clicks),
        impressions: pct(current.impressions, previous.impressions),
      },
      series,
      striking,
      range: {
        currentStart: fmt(curStart),
        currentEnd: fmt(curEnd),
        previousStart: fmt(prevStart),
        previousEnd: fmt(prevEnd),
      },
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Abfrage fehlgeschlagen";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
