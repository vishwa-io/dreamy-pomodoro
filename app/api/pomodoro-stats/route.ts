import { NextRequest, NextResponse } from "next/server";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const TABLE = "pomodoro_stats";

type Row = {
  client_id: string;
  day: string;
  sessions: number;
};

async function supabaseRequest(path: string, init?: RequestInit) {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) return null;

  return fetch(`${SUPABASE_URL}/rest/v1/${TABLE}${path}`, {
    ...init,
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
    cache: "no-store",
  });
}

export async function GET(request: NextRequest) {
  const clientId = request.nextUrl.searchParams.get("clientId");
  const year = request.nextUrl.searchParams.get("year");

  if (!clientId || !year) {
    return NextResponse.json({ counts: {} }, { status: 400 });
  }

  const response = await supabaseRequest(
    `?select=day,sessions&client_id=eq.${encodeURIComponent(clientId)}&day=gte.${year}-01-01&day=lte.${year}-12-31&order=day.asc`
  );

  if (!response) {
    return NextResponse.json({ counts: {} });
  }

  if (!response.ok) {
    return NextResponse.json({ counts: {} }, { status: 502 });
  }

  const rows = (await response.json()) as Row[];
  const counts = rows.reduce<Record<string, number>>((result, row) => {
    result[row.day] = row.sessions;
    return result;
  }, {});

  return NextResponse.json({ counts });
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const clientId = typeof body?.clientId === "string" ? body.clientId : "";
  const day = typeof body?.day === "string" ? body.day : "";

  if (!clientId || !/^\d{4}-\d{2}-\d{2}$/.test(day)) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const response = await supabaseRequest("?on_conflict=client_id,day", {
    method: "POST",
    headers: {
      Prefer: "resolution=merge-duplicates,return=minimal",
    },
    body: JSON.stringify({
      client_id: clientId,
      day,
      sessions: 1,
    }),
  });

  if (!response) {
    return NextResponse.json({ ok: true, backend: false });
  }

  return NextResponse.json(
    { ok: response.ok, backend: response.ok },
    { status: response.ok ? 200 : 502 }
  );
}
