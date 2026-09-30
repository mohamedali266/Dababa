"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Activity, Bell, BrainCircuit, ChevronLeft, ChevronRight, Languages, Megaphone, Search, ShieldAlert, ShieldCheck, Users } from "lucide-react";
import { GlassCard, IconButton } from "@/components/ui/primitives";
import { adminStats } from "@/features/dashboard/mock-data";
import { copy, type Locale } from "@/lib/translations";


const pick = (locale: Locale, ar: string, en: string) => (locale === "ar" ? ar : en);

const users = [
  { nameAr: "عمر عادل", nameEn: "Omar Adel", email: "omar@example.com", statusAr: "نشط", statusEn: "Active", role: "user", lastAr: "منذ 12 دقيقة", lastEn: "12 min ago" },
  { nameAr: "سارة حسن", nameEn: "Sara Hassan", email: "sara@example.com", statusAr: "دعوة", statusEn: "Invited", role: "coach", lastAr: "أمس", lastEn: "Yesterday" },
  { nameAr: "مروان علي", nameEn: "Marwan Ali", email: "marwan@example.com", statusAr: "موقوف", statusEn: "Paused", role: "user", lastAr: "قبل 8 أيام", lastEn: "8 days ago" }
] as const;

const audits = [
  { eventAr: "تحديث قالب إشعار الماء", eventEn: "Water reminder template updated", actor: "admin@dababa.app", time: "16:42" },
  { eventAr: "فشل طلب AI بسبب الحصة", eventEn: "AI request failed on quota", actor: "system", time: "15:18" },
  { eventAr: "تغيير حالة مستخدم", eventEn: "User status changed", actor: "ops@dababa.app", time: "12:05" }
] as const;

export function AdminShell() {
  const [locale, setLocale] = useState<Locale>("ar");
  const t = copy[locale];
  const isRtl = locale === "ar";
  const BackIcon = isRtl ? ChevronRight : ChevronLeft;

  useEffect(() => {
    document.documentElement.lang = locale;
    document.documentElement.dir = isRtl ? "rtl" : "ltr";
  }, [isRtl, locale]);

  return (
    <main className="app-shell admin-route">
      <div className="admin-frame">
        <aside className="admin-sidebar">
          <Link className="brand-row" href="/"><span className="brand-mark">D</span><strong>{t.appName}</strong></Link>
          <nav aria-label={pick(locale, "إدارة", "Admin")}>
            {[ShieldCheck, Users, BrainCircuit, Bell, Megaphone, Activity].map((Icon, index) => <button className={index === 0 ? "active" : ""} key={index} type="button"><Icon size={18} /><span>{[pick(locale, "نظرة عامة", "Overview"), pick(locale, "المستخدمون", "Users"), "AI", pick(locale, "الإشعارات", "Notifications"), pick(locale, "البث", "Broadcasts"), pick(locale, "التدقيق", "Audit")][index]}</span></button>)}
          </nav>
        </aside>

        <section className="admin-main">
          <header className="admin-header">
            <div><span className="live-badge warning"><i /> {pick(locale, "معاينة إدارة", "Admin preview")}</span><h1>{pick(locale, "لوحة تشغيل دبابة", "Dababa operations")}</h1><p>{pick(locale, "واجهة جاهزة للربط بفحص دور خادم لاحقا. البيانات الحالية نماذج تشغيلية فقط.", "Ready for a future server-side role check. Current data is operational mock data only.")}</p></div>
            <div className="header-actions"><Link className="auth-link" href="/"><BackIcon size={16} />{pick(locale, "التطبيق", "App")}</Link><IconButton aria-label={t.language} onClick={() => setLocale((current) => current === "ar" ? "en" : "ar")}><Languages size={18} /></IconButton></div>
          </header>

          <div className="admin-kpis">
            {adminStats.map(({ icon: Icon, labelAr, labelEn, value }) => <GlassCard as="article" className="admin-kpi" key={labelEn}><Icon size={20} /><span>{pick(locale, labelAr, labelEn)}</span><strong>{value}</strong></GlassCard>)}
          </div>

          <div className="admin-workspace">
            <GlassCard className="admin-table-card">
              <div className="section-heading"><span>{pick(locale, "إدارة المستخدمين", "User management")}</span><button type="button"><Search size={16} />{pick(locale, "بحث", "Search")}</button></div>
              <div className="responsive-table"><table><thead><tr><th>{pick(locale, "الاسم", "Name")}</th><th>{pick(locale, "الحالة", "Status")}</th><th>{pick(locale, "الدور", "Role")}</th><th>{pick(locale, "آخر نشاط", "Last active")}</th><th>{pick(locale, "إجراء", "Action")}</th></tr></thead><tbody>{users.map((user) => <tr key={user.email}><td><strong>{pick(locale, user.nameAr, user.nameEn)}</strong><span>{user.email}</span></td><td><mark>{pick(locale, user.statusAr, user.statusEn)}</mark></td><td>{user.role}</td><td>{pick(locale, user.lastAr, user.lastEn)}</td><td><button type="button">{pick(locale, "مراجعة", "Review")}</button></td></tr>)}</tbody></table></div>
            </GlassCard>

            <GlassCard className="ops-panel ai-panel"><div className="section-heading"><span>{pick(locale, "مراقبة الذكاء الاصطناعي", "AI monitoring")}</span><BrainCircuit size={18} /></div><dl><div><dt>{pick(locale, "استخدام الطلبات", "Request usage")}</dt><dd>38.4k / 50k</dd></div><div><dt>{pick(locale, "الإخفاقات", "Failures")}</dt><dd>2.1%</dd></div><div><dt>{pick(locale, "الحصة المتبقية", "Quota left")}</dt><dd>23%</dd></div></dl></GlassCard>
            <GlassCard className="ops-panel broadcast-panel"><div className="section-heading"><span>{pick(locale, "بث الإشعارات", "Notification broadcast")}</span><Megaphone size={18} /></div><p>{pick(locale, "مسودة تستهدف مستخدمي خطة القوة الذين لم يكملوا شرب الماء اليوم.", "Draft targeting strength-plan users who have not completed today's water goal.")}</p><button className="install-cue" type="button">{pick(locale, "تحضير المسودة", "Prepare draft")}</button></GlassCard>
            <GlassCard className="ops-panel audit-panel"><div className="section-heading"><span>{pick(locale, "سجل التدقيق", "Audit log")}</span><ShieldAlert size={18} /></div>{audits.map((audit) => <article key={audit.time}><strong>{pick(locale, audit.eventAr, audit.eventEn)}</strong><span>{audit.actor} · {audit.time}</span></article>)}</GlassCard>
          </div>
        </section>
      </div>
    </main>
  );
}


