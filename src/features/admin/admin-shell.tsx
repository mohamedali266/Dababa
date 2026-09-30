"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Activity, BadgeCheck, Building2, ChevronLeft, ChevronRight, Dumbbell, KeyRound, Languages, Search, ShieldCheck, UserCog } from "lucide-react";
import { GlassCard, IconButton } from "@/components/ui/primitives";
import { adminStats } from "@/features/dashboard/mock-data";
import { copy, type Locale } from "@/lib/translations";


const pick = (locale: Locale, ar: string, en: string) => (locale === "ar" ? ar : en);

const gyms = [
  { nameAr: "دبابة التجمع", nameEn: "Dababa New Cairo", owner: "owner@dababa.app", coaches: 6, athletes: 148, statusAr: "نشط", statusEn: "Active" },
  { nameAr: "دبابة مدينة نصر", nameEn: "Dababa Nasr City", owner: "nasr-owner@dababa.app", coaches: 4, athletes: 91, statusAr: "تجهيز", statusEn: "Setup" }
] as const;

const staff = [
  { nameAr: "محمود علي", nameEn: "Mahmoud Ali", email: "owner@dababa.app", roleAr: "صاحب جيم", roleEn: "Gym owner", clubAr: "دبابة التجمع", clubEn: "Dababa New Cairo" },
  { nameAr: "سارة حسن", nameEn: "Sara Hassan", email: "sara@example.com", roleAr: "مدرب", roleEn: "Coach", clubAr: "دبابة التجمع", clubEn: "Dababa New Cairo" },
  { nameAr: "أحمد فتحي", nameEn: "Ahmed Fathy", email: "coach@example.com", roleAr: "مدرب", roleEn: "Coach", clubAr: "دبابة مدينة نصر", clubEn: "Dababa Nasr City" }
] as const;

const athleteCodes = [
  { athleteAr: "عمر عادل", athleteEn: "Omar Adel", code: "A7K92PZQ", statusAr: "تم التسليم", statusEn: "Shared", clubAr: "دبابة التجمع", clubEn: "Dababa New Cairo" },
  { athleteAr: "مروان علي", athleteEn: "Marwan Ali", code: "M2Q8DABA", statusAr: "بانتظار التسجيل", statusEn: "Waiting", clubAr: "دبابة التجمع", clubEn: "Dababa New Cairo" },
  { athleteAr: "ندى كريم", athleteEn: "Nada Karim", code: "N9GYM204", statusAr: "مستخدم", statusEn: "Claimed", clubAr: "دبابة مدينة نصر", clubEn: "Dababa Nasr City" }
] as const;

const audits = [
  { eventAr: "إنشاء كود لاعب جديد", eventEn: "Athlete code created", actor: "coach@example.com", time: "16:42" },
  { eventAr: "إضافة مدرب للنادي", eventEn: "Coach added to gym", actor: "owner@dababa.app", time: "15:18" },
  { eventAr: "تسجيل نادي جديد", eventEn: "New gym registered", actor: "admin@dababa.app", time: "12:05" }
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
            {[ShieldCheck, Building2, UserCog, Dumbbell, KeyRound, Activity].map((Icon, index) => <button className={index === 0 ? "active" : ""} key={index} type="button"><Icon size={18} /><span>{[pick(locale, "نظرة عامة", "Overview"), pick(locale, "الأندية", "Gyms"), pick(locale, "المالكون والمدربون", "Owners & coaches"), pick(locale, "اللاعبون", "Athletes"), pick(locale, "الأكواد", "Codes"), pick(locale, "التدقيق", "Audit")][index]}</span></button>)}
          </nav>
        </aside>

        <section className="admin-main">
          <header className="admin-header">
            <div><span className="live-badge warning"><i /> {pick(locale, "معاينة إدارة", "Admin preview")}</span><h1>{pick(locale, "لوحة تشغيل دبابة", "Dababa operations")}</h1><p>{pick(locale, "إدارة أندية Dababa: الأدمن يسجل النادي والمالك، والمالك أو المدرب يصدر أكواد اللاعبين مرة واحدة.", "Manage Dababa gyms: admins create gyms and owners, then owners or coaches issue one-time athlete codes.")}</p></div>
            <div className="header-actions"><Link className="auth-link" href="/"><BackIcon size={16} />{pick(locale, "التطبيق", "App")}</Link><IconButton aria-label={t.language} onClick={() => setLocale((current) => current === "ar" ? "en" : "ar")}><Languages size={18} /></IconButton></div>
          </header>

          <div className="admin-kpis">
            {adminStats.map(({ icon: Icon, labelAr, labelEn, value }) => <GlassCard as="article" className="admin-kpi" key={labelEn}><Icon size={20} /><span>{pick(locale, labelAr, labelEn)}</span><strong>{value}</strong></GlassCard>)}
          </div>

          <div className="admin-workspace">
            <GlassCard className="admin-table-card">
              <div className="section-heading"><span>{pick(locale, "الأندية المسجلة", "Registered gyms")}</span><button type="button"><Search size={16} />{pick(locale, "بحث", "Search")}</button></div>
              <div className="responsive-table"><table><thead><tr><th>{pick(locale, "النادي", "Gym")}</th><th>{pick(locale, "المالك", "Owner")}</th><th>{pick(locale, "مدربين", "Coaches")}</th><th>{pick(locale, "لاعبين", "Athletes")}</th><th>{pick(locale, "الحالة", "Status")}</th></tr></thead><tbody>{gyms.map((gym) => <tr key={gym.owner}><td><strong>{pick(locale, gym.nameAr, gym.nameEn)}</strong><span>{pick(locale, "نطاق نادي مستقل", "Tenant workspace")}</span></td><td>{gym.owner}</td><td>{gym.coaches}</td><td>{gym.athletes}</td><td><mark>{pick(locale, gym.statusAr, gym.statusEn)}</mark></td></tr>)}</tbody></table></div>
            </GlassCard>

            <GlassCard className="ops-panel ai-panel"><div className="section-heading"><span>{pick(locale, "المالكون والمدربون", "Owners and coaches")}</span><UserCog size={18} /></div>{staff.map((member) => <article key={member.email}><strong>{pick(locale, member.nameAr, member.nameEn)}</strong><span>{pick(locale, member.roleAr, member.roleEn)} · {pick(locale, member.clubAr, member.clubEn)}</span></article>)}</GlassCard>
            <GlassCard className="ops-panel broadcast-panel"><div className="section-heading"><span>{pick(locale, "أكواد اللاعبين", "Athlete codes")}</span><KeyRound size={18} /></div>{athleteCodes.map((item) => <article key={item.code}><strong>{pick(locale, item.athleteAr, item.athleteEn)} · {item.code}</strong><span>{pick(locale, item.statusAr, item.statusEn)} · {pick(locale, item.clubAr, item.clubEn)}</span></article>)}<button className="install-cue" type="button">{pick(locale, "إنشاء كود لاعب", "Create athlete code")}</button></GlassCard>
            <GlassCard className="ops-panel audit-panel"><div className="section-heading"><span>{pick(locale, "سجل التدقيق", "Audit log")}</span><BadgeCheck size={18} /></div>{audits.map((audit) => <article key={audit.time}><strong>{pick(locale, audit.eventAr, audit.eventEn)}</strong><span>{audit.actor} · {audit.time}</span></article>)}</GlassCard>
          </div>
        </section>
      </div>
    </main>
  );
}




