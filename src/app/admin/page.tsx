import { redirect } from "next/navigation";
import { AdminShell } from "@/features/admin/admin-shell";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function Page() {
  const supabase = await createSupabaseServerClient();
  const { data: { user }, error } = await supabase.auth.getUser();

  if (error || !user) {
    redirect("/?security=admin_required");
  }

  const adminSupabase = createSupabaseAdminClient();
  const { data: adminRow, error: roleError } = await adminSupabase.from("platform_admins").select("user_id").eq("user_id", user.id).maybeSingle();
  const isAdmin = !roleError && Boolean(adminRow);

  if (!isAdmin) {
    await supabase.auth.signOut();
    redirect("/?security=admin_denied");
  }

  return <AdminShell />;
}
