import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const signupSchema = z.object({
  email: z.string().trim().email().max(254),
  password: z.string().min(6).max(128),
  displayName: z.string().trim().min(1).max(80),
  username: z.string().trim().min(2).max(40).regex(/^[\p{L}\p{N}_.-]+$/u)
});

function assertSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  const host = request.headers.get("host");
  if (!host) return false;
  try { return new URL(origin).host === host; } catch { return false; }
}

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

export async function POST(request: Request) {
  if (!assertSameOrigin(request)) return jsonError("bad_origin", 403);

  const parsed = signupSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError("invalid_payload", 400);

  try {
    const adminSupabase = createSupabaseAdminClient();
    const { data: settings } = await adminSupabase.from("site_settings").select("personal_signup_enabled").eq("id", true).maybeSingle();
    if (settings && settings.personal_signup_enabled === false) return jsonError("signup_disabled", 403);

    const email = parsed.data.email.toLowerCase();
    const created = await adminSupabase.auth.admin.createUser({
      email,
      password: parsed.data.password,
      email_confirm: true,
      user_metadata: {
        display_name: parsed.data.displayName,
        username: parsed.data.username
      }
    });

    if (created.error || !created.data.user) {
      return jsonError("signup_failed", 400);
    }

    const profile = await adminSupabase.from("profiles").upsert({
      id: created.data.user.id,
      display_name: parsed.data.displayName,
      full_name: parsed.data.displayName,
      locale: "ar",
      unit_system: "metric",
      theme: "dark",
      status: "active"
    }, { onConflict: "id" });

    if (profile.error) {
      await adminSupabase.auth.admin.deleteUser(created.data.user.id).catch(() => undefined);
      return jsonError("profile_failed", 500);
    }

    try {
      await adminSupabase.rpc("write_audit_log", {
        action_name: "public_signup",
        target_kind: "user",
        target_identifier: created.data.user.id,
        event_details: { method: "email" }
      });
    } catch {
      // Audit logging must not block account creation.
    }

    return NextResponse.json({ ok: true });
  } catch {
    return jsonError("signup_failed", 400);
  }
}
