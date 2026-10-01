import { redirect } from "next/navigation";
import { AdminShell } from "@/features/admin/admin-shell";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const adminRoles = ["admin", "super_admin", "platform_admin"];

export default async function Page() {
  const supabase = await createSupabaseServerClient();
  const { data: { user }, error } = await supabase.auth.getUser();

  if (error || !user) {
    redirect("/?security=admin_required");
  }

  const adminSupabase = createSupabaseAdminClient();
  const { data: roles, error: roleError } = await adminSupabase.from("user_roles").select("role").eq("user_id", user.id);
  const isAdmin = !roleError && Boolean(roles?.some((row) => adminRoles.includes(String(row.role))));

  if (!isAdmin) {
    await supabase.auth.signOut();
    redirect("/?security=admin_denied");
  }

  return <AdminShell />;
}
