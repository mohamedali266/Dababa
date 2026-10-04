import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const tabs = [["/admin", "نظرة عامة"], ["/admin/clubs", "النوادي"], ["/admin/users", "المستخدمين"], ["/admin/billing", "الاشتراكات"], ["/admin/settings", "الإعدادات"]] as const;

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  async function logout() {
    "use server";
    const serverSupabase = await createSupabaseServerClient();
    await serverSupabase.auth.signOut();
    redirect("/admin/login");
  }

  return <><main className="app admin-app"><header className="admin-head"><div className="logo"><i>د</i><div><b>دبابة</b><span>لوحة الإدارة العامة</span></div></div><form action={logout}><button className="soft admin-logout">خروج</button></form></header>{children}</main><nav className="glass admin-nav">{tabs.map(([href,label]) => <Link key={href} href={href}>{label}</Link>)}</nav></>;
}
