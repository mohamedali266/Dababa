import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function AdminSettingsPage() {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.from("site_settings").select("site_name,brand_color,google_login_enabled,personal_signup_enabled,maintenance_mode,join_code_expiry_days").eq("id", true).maybeSingle();
  return <><h1>الإعدادات</h1><section className="glass panel admin-section"><h2>هوية الموقع</h2><div className="admin-row"><span>اسم الموقع</span><b>{data?.site_name ?? "دبابة"}</b></div><div className="admin-row"><span>لون العلامة</span><b dir="ltr">{data?.brand_color ?? "#2F6BFF"}</b></div><button className="soft" disabled>رفع اللوجو قريبًا</button></section><section className="glass panel admin-section"><h2>التسجيل والنظام</h2><div className="admin-row"><span>Google login</span><b>{data?.google_login_enabled === false ? "مغلق" : "مفعل"}</b></div><div className="admin-row"><span>التسجيل الشخصي</span><b>{data?.personal_signup_enabled === false ? "مغلق" : "مفعل"}</b></div><div className="admin-row"><span>وضع الصيانة</span><b>{data?.maintenance_mode ? "مفعل" : "مغلق"}</b></div><div className="admin-row"><span>صلاحية كود الانضمام</span><b>{data?.join_code_expiry_days ?? 7} أيام</b></div></section></>;
}
