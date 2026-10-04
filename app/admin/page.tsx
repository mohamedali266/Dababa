import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ar } from "@/lib/format";

export default async function AdminOverviewPage() {
  const supabase = await createSupabaseServerClient();
  const [clubs, profiles, memberships, audits] = await Promise.all([
    supabase.from("clubs").select("id,status"),
    supabase.from("profiles").select("id,status"),
    supabase.from("memberships").select("role,status"),
    supabase.from("audit_logs").select("action,created_at").order("created_at", { ascending: false }).limit(6)
  ]);
  const activeUsers = (profiles.data ?? []).filter((p) => p.status === "active").length;
  const activeClubs = (clubs.data ?? []).filter((c) => c.status === "active").length;
  const roles = ["admin", "owner", "trainer", "player"].map((role) => ({ role, count: (memberships.data ?? []).filter((m) => m.role === role).length }));
  return <><div className="admin-stats"><Stat label="النوادي" value={clubs.data?.length ?? 0} /><Stat label="نوادي نشطة" value={activeClubs} /><Stat label="المستخدمين" value={profiles.data?.length ?? 0} /><Stat label="نشطين" value={activeUsers} /></div><section className="glass panel admin-section"><h2>المستخدمين حسب الدور</h2>{roles.map((item) => <div className="admin-row" key={item.role}><span>{roleLabel(item.role)}</span><b>{ar(item.count)}</b></div>)}</section><section className="glass panel admin-section"><h2>سجل العمليات</h2>{audits.data?.length ? audits.data.map((log) => <div className="admin-row" key={`${log.action}-${log.created_at}`}><span>{log.action}</span><small>{new Date(log.created_at).toLocaleString("ar-EG")}</small></div>) : <p className="sub">لا يوجد سجل ظاهر.</p>}</section></>;
}
function Stat({ label, value }: { label: string; value: number }) { return <div className="stat glass"><small>{label}</small><b>{ar(value)}</b></div>; }
function roleLabel(role: string) { return role === "owner" ? "أونر" : role === "trainer" ? "مدرب" : role === "player" ? "لاعب" : "أدمن"; }
