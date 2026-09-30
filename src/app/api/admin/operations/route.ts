import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { normalizeBranding } from "@/lib/branding";

type AdminContext = {
  userId: string;
  email: string | null;
  isPlatformAdmin: boolean;
  staffGymIds: string[];
};

const roleNames = ["super_admin", "admin", "platform_admin"];
const staffRoleNames = ["owner", "coach"];

const createGymSchema = z.object({
  action: z.literal("createGym"),
  name: z.string().trim().min(2).max(120),
  slug: z.string().trim().toLowerCase().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  ownerEmail: z.string().trim().email().optional().or(z.literal(""))
});
const createAthleteCodeSchema = z.object({
  action: z.literal("createAthleteCode"),
  gymId: z.string().uuid(),
  athleteName: z.string().trim().min(2).max(120),
  athleteEmail: z.string().trim().email().optional().or(z.literal("")),
  expiresAfterDays: z.coerce.number().int().min(1).max(365).optional().nullable()
});
const updateBrandingSchema = z.object({
  action: z.literal("updateBranding"),
  branding: z.object({
    appName: z.string().trim().min(2).max(72),
    shortName: z.string().trim().min(2).max(18),
    iconLetter: z.string().trim().min(1).max(2),
    themeColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
    backgroundColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
    iconBackground: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
    iconForeground: z.string().regex(/^#[0-9A-Fa-f]{6}$/)
  })
});

const actionSchema = z.discriminatedUnion("action", [createGymSchema, createAthleteCodeSchema, updateBrandingSchema]);

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

async function getContext(): Promise<AdminContext | null> {
  const serverSupabase = await createSupabaseServerClient();
  const { data: { user }, error } = await serverSupabase.auth.getUser();
  if (error || !user) return null;

  const adminSupabase = createSupabaseAdminClient();
  const [{ data: roles }, { data: staffRows }] = await Promise.all([
    adminSupabase.from("user_roles").select("role").eq("user_id", user.id),
    adminSupabase.from("gym_memberships").select("gym_id, role, status").eq("user_id", user.id).eq("status", "active"),
  ]);

  const isPlatformAdmin = Boolean(roles?.some((row) => roleNames.includes(String(row.role))));
  const staffGymIds = (staffRows ?? [])
    .filter((row) => staffRoleNames.includes(String(row.role)))
    .map((row) => String(row.gym_id));

  return {
    userId: user.id,
    email: user.email ?? null,
    isPlatformAdmin,
    staffGymIds
  };
}

async function findUserIdByEmail(email?: string) {
  if (!email) return null;
  const adminSupabase = createSupabaseAdminClient();
  const { data, error } = await adminSupabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (error) return null;
  return data.users.find((user) => user.email?.toLowerCase() === email.toLowerCase())?.id ?? null;
}

export async function GET() {
  const context = await getContext();
  if (!context) return jsonError("not_authenticated", 401);

  const adminSupabase = createSupabaseAdminClient();
  const allowedGymIds = context.isPlatformAdmin ? null : context.staffGymIds;
  const isAllowed = context.isPlatformAdmin || context.staffGymIds.length > 0;
  if (!isAllowed) return jsonError("not_authorized", 403);

  const gymsQuery = adminSupabase
    .from("gyms")
    .select("id, name, slug, owner_email, owner_user_id, status, created_at")
    .order("created_at", { ascending: false })
    .limit(50);

  if (allowedGymIds) gymsQuery.in("id", allowedGymIds.length ? allowedGymIds : ["00000000-0000-0000-0000-000000000000"]);

  const [{ data: gyms }, { data: memberships }, { data: codes }, { data: brandingRow }] = await Promise.all([
    gymsQuery,
    adminSupabase.from("gym_memberships").select("id, gym_id, user_id, role, status, created_at").order("created_at", { ascending: false }).limit(100),
    adminSupabase.from("athlete_access_codes").select("id, gym_id, athlete_name, athlete_email, code, status, created_at, claimed_at").order("created_at", { ascending: false }).limit(100),
    adminSupabase.from("app_settings").select("value").eq("key", "branding").maybeSingle()
  ]);

  const scopedCodes = allowedGymIds ? (codes ?? []).filter((code) => allowedGymIds.includes(String(code.gym_id))) : (codes ?? []);
  const scopedMemberships = allowedGymIds ? (memberships ?? []).filter((membership) => allowedGymIds.includes(String(membership.gym_id))) : (memberships ?? []);

  return NextResponse.json({
    viewer: context,
    branding: normalizeBranding(brandingRow?.value),
    gyms: gyms ?? [],
    memberships: scopedMemberships,
    athleteCodes: scopedCodes
  });
}

export async function POST(request: NextRequest) {
  const context = await getContext();
  if (!context) return jsonError("not_authenticated", 401);

  const parsed = actionSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError("invalid_payload", 400);

  const adminSupabase = createSupabaseAdminClient();
  const serverSupabase = await createSupabaseServerClient();


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
    const { data: gym, error } = await adminSupabase.from("gyms").insert({
      name: parsed.data.name,
      slug: parsed.data.slug,
      owner_email: ownerEmail,
      owner_user_id: ownerUserId,
      created_by_user_id: context.userId
    }).select("id, name, slug, owner_email, owner_user_id, status, created_at").single();
    if (error) return jsonError(error.message, 500);

    if (ownerUserId) {
      await adminSupabase.from("gym_memberships").upsert({ gym_id: gym.id, user_id: ownerUserId, role: "owner", status: "active", created_by_user_id: context.userId }, { onConflict: "gym_id,user_id,role" });
      await adminSupabase.from("user_roles").upsert({ user_id: ownerUserId, role: "gym_owner" }, { onConflict: "user_id,role" });
    }

    return NextResponse.json({ ok: true, gym });
  }

  if (parsed.data.action === "createAthleteCode") {
    if (!context.isPlatformAdmin && !context.staffGymIds.includes(parsed.data.gymId)) return jsonError("not_authorized", 403);
    const { data, error } = await serverSupabase.rpc("create_athlete_access_code", {
      target_gym_id: parsed.data.gymId,
      athlete_display_name: parsed.data.athleteName,
      athlete_contact_email: parsed.data.athleteEmail || null,
      expires_after_days: parsed.data.expiresAfterDays ?? null
    });
    if (error) return jsonError(error.message, 500);
    return NextResponse.json({ ok: true, code: data?.[0] ?? null });
  }

  return jsonError("unsupported_action", 400);
}

