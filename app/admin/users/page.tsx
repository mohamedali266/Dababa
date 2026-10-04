import { createSupabaseServerClient } from "@/lib/supabase/server";

type AdminUserRow = {
  id: string;
  display_name: string | null;
  full_name: string | null;
  status: string | null;
  memberships?: { role?: string | null; status?: string | null; clubs?: { name?: string | null } | { name?: string | null }[] | null }[] | null;
};

export default async function AdminUsersPage() {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.from("profiles").select("id,display_name,full_name,status,memberships(role,status,clubs(name))").order("created_at", { ascending: false }).limit(100);
  const rows = (data ?? []) as AdminUserRow[];
  return <><div className="sec"><h1>المستخدمين</h1><button className="add" disabled>+ دعوة مستخدم</button></div><div className="list">{rows.length ? rows.map((user) => { const membership = user.memberships?.[0]; const club = Array.isArray(membership?.clubs) ? membership?.clubs[0] : membership?.clubs; return <section className="item glass" key={user.id}><div className="pic">{(user.display_name ?? user.full_name ?? "م")[0]}</div><div className="t"><b>{user.display_name ?? user.full_name ?? "مستخدم"}</b><span className="s">{roleLabel(membership?.role)} · {club?.name ?? "بدون نادي"}</span></div><span className={`badge ${user.status === "active" ? "b-ok" : "b-err"}`}>{user.status === "active" ? "نشط" : "موقوف"}</span></section>; }) : <section className="glass empty">لا يوجد مستخدمين ظاهرين.</section>}</div></>;
}
function roleLabel(role?: string | null) { return role === "owner" ? "أونر" : role === "trainer" ? "مدرب" : role === "player" ? "لاعب" : "بدون دور"; }
