import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function Home() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth");

  const { data: active } = await supabase.rpc("is_active_user");
  if (!active) redirect("/auth");

  const { data: isAdmin } = await supabase.rpc("is_platform_admin");
  if (isAdmin) redirect("/admin");

  const { data: memberships } = await supabase
    .from("memberships")
    .select("role")
    .eq("user_id", user.id)
    .eq("status", "active");

  if (memberships?.some((item) => item.role === "owner")) redirect("/club");
  if (memberships?.some((item) => item.role === "trainer")) redirect("/trainer");
  redirect("/app");
}