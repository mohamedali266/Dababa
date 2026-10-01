import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const ADMIN_USERNAME = process.env.ADMIN_LOGIN_USERNAME;
const ADMIN_EMAIL = process.env.ADMIN_LOGIN_EMAIL;

function assertSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  const host = request.headers.get("host");
  if (!host) return false;
  try { return new URL(origin).host === host; } catch { return false; }
}

export async function POST(request: Request) {
  if (!assertSameOrigin(request)) return NextResponse.json({ error: "bad_origin" }, { status: 403 });
  try {
    const body = await request.json().catch(() => null) as { username?: string; password?: string } | null;
    const username = String(body?.username ?? "").trim().toLowerCase();
    const password = String(body?.password ?? "");

    if (!ADMIN_USERNAME || !ADMIN_EMAIL || username !== ADMIN_USERNAME || password.length < 6) {
      return NextResponse.json({ error: "invalid_credentials" }, { status: 401 });
    }

    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.auth.signInWithPassword({ email: ADMIN_EMAIL, password });
    if (error || !data.user) {
      return NextResponse.json({ error: "invalid_credentials" }, { status: 401 });
    }

    const { data: adminRow, error: roleError } = await supabase.from("platform_admins").select("user_id").eq("user_id", data.user.id).maybeSingle();
    if (roleError || !adminRow) {
      await supabase.auth.signOut();
      return NextResponse.json({ error: "not_authorized" }, { status: 403 });
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "request_failed" }, { status: 400 });
  }
}
