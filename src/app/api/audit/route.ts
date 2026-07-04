import { NextRequest, NextResponse } from "next/server";
import { runAudit, auditHealth } from "@/lib/audit";

// Route runs as a Netlify Function (Node runtime). No filesystem/env-file reads —
// keys come from process.env (locally via .env.local, on Netlify via the UI env vars).
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

// ---------------------------------------------------------------------------
// GET — health check (no secrets leaked, only booleans)
// ---------------------------------------------------------------------------

export function GET() {
  return NextResponse.json(auditHealth());
}

// Map an audit error message to the right HTTP status:
//   400 → validation / SSRF, 502 → page not loadable, 500 → anything else.
function statusForError(message: string): number {
  if (message.startsWith("Shop konnte nicht geladen werden")) return 502;
  if (
    message === "URL erforderlich" ||
    message === "Ungültige URL" ||
    message === "Nur http/https werden unterstützt" ||
    message === "Interne/private Adressen sind nicht erlaubt."
  ) {
    return 400;
  }
  return 500;
}

// ---------------------------------------------------------------------------
// POST — run the audit (thin wrapper around runAudit)
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const rawUrl = (body as { url?: unknown }).url;
  if (!rawUrl || typeof rawUrl !== "string" || !rawUrl.trim()) {
    return NextResponse.json({ error: "URL erforderlich" }, { status: 400 });
  }

  const r = await runAudit(rawUrl);
  if ("error" in r) {
    return NextResponse.json({ error: r.error }, { status: statusForError(r.error) });
  }
  return NextResponse.json(r);
}
