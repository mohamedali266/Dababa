import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ar } from "@/lib/format";

export default async function AdminClubsPage() {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.from("clubs").select("id,name,city,plan,status,memberships(id)").order("created_at", { ascending: false });
  return <><div className="sec"><h1>النوادي</h1><button className="add" disabled>+ نادي جديد</button></div><div className="list">{data?.length ? data.map((club) => <section className="item glass" key={club.id}><div className="pic">{club.name?.[0] ?? "ن"}</div><div className="t"><b>{club.name}</b><span className="s">{club.city ?? "بدون مدينة"} · {club.plan ?? "basic"} · {ar(club.memberships?.length ?? 0)} عضوية</span></div><span className={`badge ${club.status === "active" ? "b-ok" : "b-err"}`}>{club.status === "active" ? "نشط" : "موقوف"}</span></section>) : <section className="glass empty">لا توجد نوادي.</section>}</div></>;
}
