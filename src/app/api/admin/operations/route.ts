import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { normalizeBranding } from "@/lib/branding";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type AdminContext = { userId: string; email: string | null; isPlatformAdmin: boolean; staffGymIds: string[] };

const staffRoleNames = ["owner", "coach"];
const accountRoles = ["user", "platform_admin", "gym_owner", "coach", "athlete"] as const;

const createGymSchema = z.object({ action: z.literal("createGym"), name: z.string().trim().min(2).max(120), slug: z.string().trim().toLowerCase().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/), ownerEmail: z.string().trim().email().optional().or(z.literal("")) });
const createAthleteCodeSchema = z.object({ action: z.literal("createAthleteCode"), gymId: z.string().uuid(), athleteName: z.string().trim().min(2).max(120), athleteEmail: z.string().trim().email().optional().or(z.literal("")), expiresAfterDays: z.coerce.number().int().min(1).max(365).optional().nullable() });
const updateBrandingSchema = z.object({ action: z.literal("updateBranding"), branding: z.object({ appName: z.string().trim().min(2).max(72), shortName: z.string().trim().min(2).max(18), iconLetter: z.string().trim().min(1).max(2), themeColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/), backgroundColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/), iconBackground: z.string().regex(/^#[0-9A-Fa-f]{6}$/), iconForeground: z.string().regex(/^#[0-9A-Fa-f]{6}$/) }) });
const createUserSchema = z.object({ action: z.literal("createUser"), email: z.string().trim().email(), password: z.string().min(6).max(128), displayName: z.string().trim().min(1).max(80), role: z.enum(accountRoles).default("user"), comment: z.string().trim().max(500).optional().or(z.literal("")) });
const updateUserSchema = z.object({ action: z.literal("updateUser"), userId: z.string().uuid(), email: z.string().trim().email().optional(), password: z.string().min(6).max(128).optional().or(z.literal("")), displayName: z.string().trim().min(1).max(80).optional(), role: z.enum(accountRoles).optional(), comment: z.string().trim().max(500).optional().or(z.literal("")) });
const deleteUserSchema = z.object({ action: z.literal("deleteUser"), userId: z.string().uuid() });

const actionSchema = z.discriminatedUnion("action", [createGymSchema, createAthleteCodeSchema, updateBrandingSchema, createUserSchema, updateUserSchema, deleteUserSchema]);

function assertSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  const host = request.headers.get("host");
  if (!host) return false;
  try { return new URL(origin).host === host; } catch { return false; }
}

function jsonError(message: string, status: number) { return NextResponse.json({ error: message }, { status }); }

async function getContext(): Promise<AdminContext | null> {
  const serverSupabase = await createSupabaseServerClient();
  const { data: { user }, error } = await serverSupabase.auth.getUser();
  if (error || !user) return null;

  const adminSupabase = createSupabaseAdminClient();
  const [{ data: roles }, { data: staffRows }] = await Promise.all([
    adminSupabase.from("platform_admins").select("user_id").eq("user_id", user.id).maybeSingle(),
    adminSupabase.from("gym_memberships").select("gym_id, role, status").eq("user_id", user.id).eq("status", "active")
  ]);

  const isPlatformAdmin = Boolean(roles);
  const staffGymIds = (staffRows ?? []).filter((row) => staffRoleNames.includes(String(row.role))).map((row) => String(row.gym_id));
  return { userId: user.id, email: user.email ?? null, isPlatformAdmin, staffGymIds };
}

async function findUserIdByEmail(email?: string) {
  if (!email) return null;
  const adminSupabase = createSupabaseAdminClient();
  const { data, error } = await adminSupabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (error) return null;
  return data.users.find((user) => user.email?.toLowerCase() === email.toLowerCase())?.id ?? null;
}

async function listAccountUsers() {
  const adminSupabase = createSupabaseAdminClient();
  const [{ data: authUsers }, { data: profiles }, { data: roles }] = await Promise.all([
    adminSupabase.auth.admin.listUsers({ page: 1, perPage: 1000 }),
    adminSupabase.from("profiles").select("id, display_name, locale, updated_at"),
    adminSupabase.from("user_roles").select("user_id, role")
  ]);

  const profileById = new Map((profiles ?? []).map((profile) => [String(profile.id), profile]));
  const rolesById = new Map<string, string[]>();
  (roles ?? []).forEach((role) => {
    const userId = String(role.user_id);
    rolesById.set(userId, [...(rolesById.get(userId) ?? []), String(role.role)]);
  });

  return (authUsers.users ?? []).map((user) => ({
    id: user.id,
    email: user.email ?? null,
    display_name: profileById.get(user.id)?.display_name ?? String(user.user_metadata?.display_name ?? user.email?.split("@")[0] ?? "User"),
    roles: rolesById.get(user.id) ?? [],
    comment: String(user.app_metadata?.admin_comment ?? ""),
    created_at: user.created_at,
    last_sign_in_at: user.last_sign_in_at ?? null
  }));
}

async function setSingleRole(userId: string, role: (typeof accountRoles)[number]) {
  const adminSupabase = createSupabaseAdminClient();
  await adminSupabase.from("user_roles").delete().eq("user_id", userId);
  const { error } = await adminSupabase.from("user_roles").insert({ user_id: userId, role });
  if (error) throw error;
}

export async function GET() {
  const context = await getContext();
  if (!context) return jsonError("not_authenticated", 401);
  const adminSupabase = createSupabaseAdminClient();
  const allowedGymIds = context.isPlatformAdmin ? null : context.staffGymIds;
  const isAllowed = context.isPlatformAdmin || context.staffGymIds.length > 0;
  if (!isAllowed) return jsonError("not_authorized", 403);

  const gymsQuery = adminSupabase.from("gyms").select("id, name, slug, owner_email, owner_user_id, status, created_at").order("created_at", { ascending: false }).limit(50);
  if (allowedGymIds) gymsQuery.in("id", allowedGymIds.length ? allowedGymIds : ["00000000-0000-0000-0000-000000000000"]);

  const [{ data: gyms }, { data: memberships }, { data: codes }, { data: brandingRow }, accountUsers] = await Promise.all([
    gymsQuery,
    adminSupabase.from("gym_memberships").select("id, gym_id, user_id, role, status, created_at").order("created_at", { ascending: false }).limit(100),
    adminSupabase.from("athlete_access_codes").select("id, gym_id, athlete_name, athlete_email, code, status, created_at, claimed_at").order("created_at", { ascending: false }).limit(100),
    adminSupabase.from("app_settings").select("value").eq("key", "branding").maybeSingle(),
    context.isPlatformAdmin ? listAccountUsers() : Promise.resolve([])
  ]);

  const scopedCodes = allowedGymIds ? (codes ?? []).filter((code) => allowedGymIds.includes(String(code.gym_id))) : (codes ?? []);
  const scopedMemberships = allowedGymIds ? (memberships ?? []).filter((membership) => allowedGymIds.includes(String(membership.gym_id))) : (memberships ?? []);

  return NextResponse.json({ viewer: context, branding: normalizeBranding(brandingRow?.value), gyms: gyms ?? [], memberships: scopedMemberships, athleteCodes: scopedCodes, accountUsers });
}

export async function POST(request: NextRequest) {
  if (!assertSameOrigin(request)) return jsonError("bad_origin", 403);
  const context = await getContext();
  if (!context) return jsonError("not_authenticated", 401);
  const parsed = actionSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError("invalid_payload", 400);

  const adminSupabase = createSupabaseAdminClient();
  const serverSupabase = await createSupabaseServerClient();

  if (["createUser", "updateUser", "deleteUser"].includes(parsed.data.action) && !context.isPlatformAdmin) return jsonError("not_authorized", 403);

  if (parsed.data.action === "createUser") {
    const created = await adminSupabase.auth.admin.createUser({ email: parsed.data.email, password: parsed.data.password, email_confirm: true, user_metadata: { display_name: parsed.data.displayName }, app_metadata: { admin_comment: parsed.data.comment || "" } });
    if (created.error || !created.data.user) return jsonError(created.error?.message ?? "create_failed", 500);
    await adminSupabase.from("profiles").upsert({ id: created.data.user.id, display_name: parsed.data.displayName, locale: "ar", unit_system: "metric", theme: "dark" }, { onConflict: "id" });
    await setSingleRole(created.data.user.id, parsed.data.role);
    if (parsed.data.role === "platform_admin") await adminSupabase.from("platform_admins").upsert({ user_id: created.data.user.id, created_by_user_id: context.userId }, { onConflict: "user_id" });
    await adminSupabase.rpc("write_audit_log", { action_name: "create_user", target_kind: "user", target_identifier: created.data.user.id, event_details: { role: parsed.data.role } });
    return NextResponse.json({ ok: true, user: created.data.user.id });
  }

  if (parsed.data.action === "updateUser") {
    const attributes: { email?: string; password?: string; user_metadata?: Record<string, string>; app_metadata?: Record<string, string> } = {};
    if (parsed.data.email) attributes.email = parsed.data.email;
    if (parsed.data.password) attributes.password = parsed.data.password;
    if (parsed.data.displayName) attributes.user_metadata = { display_name: parsed.data.displayName };
    if (typeof parsed.data.comment === "string") attributes.app_metadata = { admin_comment: parsed.data.comment };
    if (Object.keys(attributes).length) {
      const updated = await adminSupabase.auth.admin.updateUserById(parsed.data.userId, attributes);
      if (updated.error) return jsonError(updated.error.message, 500);
    }
    if (parsed.data.displayName) await adminSupabase.from("profiles").upsert({ id: parsed.data.userId, display_name: parsed.data.displayName, locale: "ar", unit_system: "metric", theme: "dark" }, { onConflict: "id" });
    if (parsed.data.role) {
      await setSingleRole(parsed.data.userId, parsed.data.role);
      if (parsed.data.role === "platform_admin") await adminSupabase.from("platform_admins").upsert({ user_id: parsed.data.userId, created_by_user_id: context.userId }, { onConflict: "user_id" });
      else if (parsed.data.userId !== context.userId) await adminSupabase.from("platform_admins").delete().eq("user_id", parsed.data.userId);
    }
    await adminSupabase.rpc("write_audit_log", { action_name: "update_user", target_kind: "user", target_identifier: parsed.data.userId, event_details: { role: parsed.data.role ?? null } });
    return NextResponse.json({ ok: true });
  }

  if (parsed.data.action === "deleteUser") {
    if (parsed.data.userId === context.userId) return jsonError("cannot_delete_self", 400);
    const { count } = await adminSupabase.from("platform_admins").select("user_id", { count: "exact", head: true });
    const { data: targetAdmin } = await adminSupabase.from("platform_admins").select("user_id").eq("user_id", parsed.data.userId).maybeSingle();
    if (targetAdmin && (count ?? 0) <= 1) return jsonError("cannot_delete_last_admin", 400);
    const { error } = await adminSupabase.auth.admin.deleteUser(parsed.data.userId);
    if (error) return jsonError(error.message, 500);
    await adminSupabase.rpc("write_audit_log", { action_name: "delete_user", target_kind: "user", target_identifier: parsed.data.userId, event_details: {} });
    return NextResponse.json({ ok: true });
  }

  if (parsed.data.action === "updateBranding") {
    if (!context.isPlatformAdmin) return jsonError("not_authorized", 403);
    const branding = normalizeBranding(parsed.data.branding);
    const { error } = await adminSupabase.from("app_settings").upsert({ key: "branding", value: branding, updated_by_user_id: context.userId }, { onConflict: "key" });
    if (error) return jsonError(error.message, 500);
    return NextResponse.json({ ok: true, branding });
  }

  if (parsed.data.action === "createGym") {
    if (!context.isPlatformAdmin) return jsonError("not_authorized", 403);
    const ownerEmail = parsed.data.ownerEmail || null;
    const ownerUserId = await findUserIdByEmail(ownerEmail ?? undefined);
    const { data: gym, error } = await adminSupabase.from("gyms").insert({ name: parsed.data.name, slug: parsed.data.slug, owner_email: ownerEmail, owner_user_id: ownerUserId, created_by_user_id: context.userId }).select("id, name, slug, owner_email, owner_user_id, status, created_at").single();
    if (error) return jsonError(error.message, 500);
    if (ownerUserId) {
      await adminSupabase.from("gym_memberships").upsert({ gym_id: gym.id, user_id: ownerUserId, role: "owner", status: "active", created_by_user_id: context.userId }, { onConflict: "gym_id,user_id,role" });
      await adminSupabase.from("user_roles").upsert({ user_id: ownerUserId, role: "gym_owner" }, { onConflict: "user_id,role" });
    }
    return NextResponse.json({ ok: true, gym });
  }

  if (parsed.data.action === "createAthleteCode") {
    if (!context.isPlatformAdmin && !context.staffGymIds.includes(parsed.data.gymId)) return jsonError("not_authorized", 403);
    const { data, error } = await serverSupabase.rpc("create_athlete_access_code", { target_gym_id: parsed.data.gymId, athlete_display_name: parsed.data.athleteName, athlete_contact_email: parsed.data.athleteEmail || null, expires_after_days: parsed.data.expiresAfterDays ?? null });
    if (error) return jsonError(error.message, 500);
    return NextResponse.json({ ok: true, code: data?.[0] ?? null });
  }

  return jsonError("unsupported_action", 400);
}
