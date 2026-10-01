import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const ADMIN_USERNAME = process.env.ADMIN_LOGIN_USERNAME;
const ADMIN_EMAIL = process.env.ADMIN_LOGIN_EMAIL;

export async function POST(request: Request) {
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

    const { data: roles, error: roleError } = await supabase.from("user_roles").select("role").eq("user_id", data.user.id).in("role", ["admin", "super_admin", "platform_admin"]);
    if (roleError || !roles?.length) {
      await supabase.auth.signOut();
      return NextResponse.json({ error: "not_authorized" }, { status: 403 });
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "request_failed" }, { status: 400 });
  }
}
