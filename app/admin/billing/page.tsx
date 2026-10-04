import { ar } from "@/lib/format";

export default function AdminBillingPage() {
  return <><div className="sec"><h1>الاشتراكات</h1><button className="add" disabled>+ فاتورة</button></div><section className="glass panel admin-section"><h2>التسعير</h2><div className="admin-row"><span>سعر اللاعب الشهري</span><b>{ar(0)} ج</b></div><p className="sub">إنشاء الفواتير وتسجيل الدفع يحتاج route handlers آمنة بالـ service role وسيتم تفعيله بعد اعتماد schema النهائي.</p></section><section className="glass empty"><b>لا توجد فواتير منشأة من النظام الجديد بعد</b><span>سيتم احتسابها من العضويات النشطة لكل نادي.</span></section></>;
}
