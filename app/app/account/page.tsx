import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AccountPage() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth?next=/app/account");

  const [profile, memberships] = await Promise.all([
    supabase.from("profiles").select("display_name, full_name").eq("id", user.id).maybeSingle(),
    supabase.from("memberships").select("role, status, clubs(name)").eq("user_id", user.id).eq("status", "active")
  ]);
  const name = profile.data?.display_name ?? profile.data?.full_name ?? user.email?.split("@")[0] ?? "لاعب";
  const email = user.email ?? "";
  const clubs = (memberships.data ?? []) as { role: string; status: string; clubs?: { name?: string | null } | null }[];

  async function logout() {
    "use server";
    const serverSupabase = await createSupabaseServerClient();
    await serverSupabase.auth.signOut();
    redirect("/auth");
  }

  return (
    <>
      <h1>حسابي</h1>
      <section className="glass panel account-card">
        <div className="account-avatar" aria-hidden="true">{name.trim()[0] ?? "د"}</div>
        <div>
          <b><bdi>{name}</bdi></b>
          <span dir="ltr">{email}</span>
        </div>
      </section>
      <section className="glass panel account-card vertical">
        <h2>النوادي</h2>
        {clubs.length ? clubs.map((club, index) => <div className="club-line" key={`${club.clubs?.name ?? "club"}-${index}`}><b>{club.clubs?.name ?? "نادي"}</b><span>{roleLabel(club.role)}</span></div>) : <p className="sub">لسه مش مرتبط بنادي.</p>}
      </section>
      <form action={logout} className="glass panel">
        <h2>تسجيل الخروج</h2>
        <p className="sub">سيتم إنهاء الجلسة على هذا الجهاز.</p>
        <button className="primary danger" type="submit">تسجيل الخروج</button>
      </form>
    </>
  );
}

function roleLabel(role: string) {
  if (role === "owner") return "صاحب نادي";
  if (role === "trainer") return "مدرب";
  return "لاعب";
}
