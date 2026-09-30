"use client";

import Image from "next/image";
import Link from "next/link";
import { type FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { Activity, BadgeCheck, Building2, ChevronLeft, ChevronRight, Dumbbell, KeyRound, Languages, Loader2, Palette, Search, ShieldCheck, UserCog } from "lucide-react";
import { GlassCard, IconButton } from "@/components/ui/primitives";
import { copy, type Locale } from "@/lib/translations";

type Branding = {
  appName: string;
  shortName: string;
  iconLetter: string;
  themeColor: string;
  backgroundColor: string;
  iconBackground: string;
  iconForeground: string;
};

type Gym = {
  id: string;
  name: string;
  slug: string;
  owner_email: string | null;
  status: string;
};

type Membership = {
  id: string;
  gym_id: string;
  role: "owner" | "coach" | "athlete";
  status: string;
};

type AthleteCode = {
  id: string;
  gym_id: string;
  athlete_name: string;
  athlete_email: string | null;
  code: string;
  status: "unused" | "claimed" | "revoked";
  claimed_at: string | null;
};

type OperationsPayload = {
  viewer: {
    email: string | null;
    isPlatformAdmin: boolean;
    canBootstrap: boolean;
    staffGymIds: string[];
  };
  branding: Branding;
  gyms: Gym[];
  memberships: Membership[];
  athleteCodes: AthleteCode[];
};

const defaultBranding: Branding = {
  appName: "Dababa",
  shortName: "Dababa",
  iconLetter: "D",
  themeColor: "#050A18",
  backgroundColor: "#050A18",
  iconBackground: "#2F6BFF",
  iconForeground: "#FFFFFF"
};

const pick = (locale: Locale, ar: string, en: string) => (locale === "ar" ? ar : en);
const slugify = (value: string) => value.trim().toLowerCase().replace(/[^a-z0-9\s-]/g, "").replace(/\s+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");

export function AdminShell() {
  const [locale, setLocale] = useState<Locale>("ar");
  const [payload, setPayload] = useState<OperationsPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [gymName, setGymName] = useState("");
  const [gymSlug, setGymSlug] = useState("");
  const [ownerEmail, setOwnerEmail] = useState("");
  const [codeGymId, setCodeGymId] = useState("");
  const [athleteName, setAthleteName] = useState("");
  const [athleteEmail, setAthleteEmail] = useState("");
  const [branding, setBranding] = useState<Branding>(defaultBranding);
  const t = copy[locale];
  const isRtl = locale === "ar";
  const BackIcon = isRtl ? ChevronRight : ChevronLeft;

  useEffect(() => {
    document.documentElement.lang = locale;
    document.documentElement.dir = isRtl ? "rtl" : "ltr";
  }, [isRtl, locale]);

  const loadOperations = useCallback(async () => {
    setLoading(true);
    setMessage(null);
    try {
      const response = await fetch("/api/admin/operations", { cache: "no-store" });
      if (!response.ok) throw new Error(await response.text());
      const data = await response.json() as OperationsPayload;
      setPayload(data);
      setBranding(data.branding);
      if (!codeGymId && data.gyms[0]) setCodeGymId(data.gyms[0].id);
    } catch {
      setPayload(null);
      setMessage(pick(locale, "سجل الدخول بحساب إداري لعرض لوحة التحكم.", "Sign in with an admin account to view operations."));
    } finally {
      setLoading(false);
    }
  }, [codeGymId, locale]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadOperations();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loadOperations]);

  const gymById = useMemo(() => new Map((payload?.gyms ?? []).map((gym) => [gym.id, gym])), [payload?.gyms]);
  const kpis = useMemo(() => {
    const gyms = payload?.gyms.length ?? 0;
    const coaches = payload?.memberships.filter((item) => item.role === "coach").length ?? 0;
    const athletes = payload?.memberships.filter((item) => item.role === "athlete").length ?? 0;
    const openCodes = payload?.athleteCodes.filter((item) => item.status === "unused").length ?? 0;
    return [
      { labelAr: "الأندية", labelEn: "Gyms", value: String(gyms), icon: Building2 },
      { labelAr: "المدربون", labelEn: "Coaches", value: String(coaches), icon: Dumbbell },
      { labelAr: "اللاعبون", labelEn: "Athletes", value: String(athletes), icon: Activity },
      { labelAr: "أكواد مفتوحة", labelEn: "Open codes", value: String(openCodes), icon: KeyRound }
    ];
  }, [payload]);

  async function postAction(action: Record<string, unknown>, busyKey: string) {
    setBusyAction(busyKey);
    setMessage(null);
    try {
      const response = await fetch("/api/admin/operations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(action)
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(String(result.error ?? "request_failed"));
      setMessage(pick(locale, "تم حفظ التغيير بنجاح.", "Change saved successfully."));
      await loadOperations();
      return result;
    } catch (error) {
      setMessage(`${pick(locale, "تعذر تنفيذ العملية", "Could not complete action")}: ${error instanceof Error ? error.message : "unknown"}`);
      return null;
    } finally {
      setBusyAction(null);
    }
  }

  async function handleBootstrap() {
    await postAction({ action: "bootstrapPlatformAdmin" }, "bootstrap");
  }

  async function handleCreateGym(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const slug = gymSlug || slugify(gymName);
    const result = await postAction({ action: "createGym", name: gymName, slug, ownerEmail }, "createGym");
    if (result) {
      setGymName("");
      setGymSlug("");
      setOwnerEmail("");
    }
  }

  async function handleCreateAthleteCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const result = await postAction({ action: "createAthleteCode", gymId: codeGymId, athleteName, athleteEmail }, "createCode");
    if (result?.code?.code) {
      setMessage(pick(locale, `تم إنشاء الكود: ${result.code.code}`, `Created code: ${result.code.code}`));
      setAthleteName("");
      setAthleteEmail("");
    }
  }

  async function handleBranding(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await postAction({ action: "updateBranding", branding }, "branding");
  }

  return (
    <main className="app-shell admin-route">
      <div className="admin-frame">
        <aside className="admin-sidebar">
          <Link className="brand-row" href="/"><span className="brand-mark">D</span><strong>{t.appName}</strong></Link>
          <nav aria-label={pick(locale, "إدارة", "Admin")}>
            {[ShieldCheck, Building2, UserCog, Dumbbell, KeyRound, Palette, Activity].map((Icon, index) => <button className={index === 0 ? "active" : ""} key={index} type="button"><Icon size={18} /><span>{[pick(locale, "نظرة عامة", "Overview"), pick(locale, "الأندية", "Gyms"), pick(locale, "المالكون والمدربون", "Owners & coaches"), pick(locale, "اللاعبون", "Athletes"), pick(locale, "الأكواد", "Codes"), pick(locale, "البراندنج", "Branding"), pick(locale, "التدقيق", "Audit")][index]}</span></button>)}
          </nav>
        </aside>

        <section className="admin-main">
          <header className="admin-header">
            <div><span className="live-badge warning"><i /> {pick(locale, "لوحة إدارة فعلية", "Live admin")}</span><h1>{pick(locale, "تشغيل الأندية والأكواد", "Gym and code operations")}</h1><p>{pick(locale, "أنشئ نادي، اربط المالك، أصدر أكواد اللاعبين، وعدل هوية التطبيق التي تظهر في تبويب الويب وأيقونة التثبيت.", "Create gyms, link owners, issue athlete codes, and control the app identity used for browser tabs and install icons.")}</p></div>
            <div className="header-actions"><Link className="auth-link" href="/"><BackIcon size={16} />{pick(locale, "التطبيق", "App")}</Link><IconButton aria-label={t.language} onClick={() => setLocale((current) => current === "ar" ? "en" : "ar")}><Languages size={18} /></IconButton></div>
          </header>

          {message ? <div className="admin-message">{message}</div> : null}
          {loading ? <div className="admin-message"><Loader2 className="spin" size={17} /> {pick(locale, "جار تحميل لوحة التحكم", "Loading operations")}</div> : null}

          {payload?.viewer.canBootstrap ? <GlassCard className="admin-bootstrap"><div><strong>{pick(locale, "لا يوجد أدمن بعد", "No admin exists yet")}</strong><span>{pick(locale, "اجعل حسابك الحالي أدمن المنصة الأول لفتح أدوات الإدارة.", "Make your current account the first platform admin to unlock operations.")}</span></div><button className="install-cue" disabled={busyAction === "bootstrap"} onClick={handleBootstrap} type="button">{pick(locale, "تفعيل حسابي كأدمن", "Make me admin")}</button></GlassCard> : null}

          <div className="admin-kpis">
            {kpis.map(({ icon: Icon, labelAr, labelEn, value }) => <GlassCard as="article" className="admin-kpi" key={labelEn}><Icon size={20} /><span>{pick(locale, labelAr, labelEn)}</span><strong>{value}</strong></GlassCard>)}
          </div>

          <div className="admin-workspace">
            <GlassCard className="admin-table-card">
              <div className="section-heading"><span>{pick(locale, "الأندية المسجلة", "Registered gyms")}</span><button type="button"><Search size={16} />{pick(locale, "بحث", "Search")}</button></div>
              <div className="responsive-table"><table><thead><tr><th>{pick(locale, "النادي", "Gym")}</th><th>{pick(locale, "المالك", "Owner")}</th><th>{pick(locale, "الرابط", "Slug")}</th><th>{pick(locale, "الحالة", "Status")}</th></tr></thead><tbody>{(payload?.gyms ?? []).map((gym) => <tr key={gym.id}><td><strong>{gym.name}</strong><span>{gym.id.slice(0, 8)}</span></td><td>{gym.owner_email || pick(locale, "لم يحدد", "Not set")}</td><td>{gym.slug}</td><td><mark>{gym.status}</mark></td></tr>)}</tbody></table></div>
            </GlassCard>

            <GlassCard className="ops-panel admin-form-card"><div className="section-heading"><span>{pick(locale, "إنشاء نادي", "Create gym")}</span><Building2 size={18} /></div><form onSubmit={handleCreateGym}><label><span>{pick(locale, "اسم النادي", "Gym name")}</span><input required value={gymName} onChange={(event) => { setGymName(event.target.value); if (!gymSlug) setGymSlug(slugify(event.target.value)); }} placeholder={pick(locale, "دبابة التجمع", "Dababa New Cairo")} /></label><label><span>{pick(locale, "الرابط المختصر", "Slug")}</span><input required value={gymSlug} onChange={(event) => setGymSlug(slugify(event.target.value))} placeholder="dababa-new-cairo" /></label><label><span>{pick(locale, "إيميل المالك", "Owner email")}</span><input inputMode="email" value={ownerEmail} onChange={(event) => setOwnerEmail(event.target.value)} placeholder="owner@example.com" /></label><button className="install-cue" disabled={busyAction === "createGym" || !payload?.viewer.isPlatformAdmin} type="submit">{pick(locale, "حفظ النادي", "Save gym")}</button></form></GlassCard>

            <GlassCard className="ops-panel admin-form-card"><div className="section-heading"><span>{pick(locale, "إنشاء كود لاعب", "Create athlete code")}</span><KeyRound size={18} /></div><form onSubmit={handleCreateAthleteCode}><label><span>{pick(locale, "النادي", "Gym")}</span><select required value={codeGymId} onChange={(event) => setCodeGymId(event.target.value)}>{(payload?.gyms ?? []).map((gym) => <option key={gym.id} value={gym.id}>{gym.name}</option>)}</select></label><label><span>{pick(locale, "اسم اللاعب", "Athlete name")}</span><input required value={athleteName} onChange={(event) => setAthleteName(event.target.value)} placeholder={pick(locale, "عمر عادل", "Omar Adel")} /></label><label><span>{pick(locale, "إيميل اللاعب اختياري", "Athlete email optional")}</span><input inputMode="email" value={athleteEmail} onChange={(event) => setAthleteEmail(event.target.value)} placeholder="athlete@example.com" /></label><button className="install-cue" disabled={busyAction === "createCode" || !codeGymId} type="submit">{pick(locale, "إصدار الكود", "Issue code")}</button></form></GlassCard>

            <GlassCard className="ops-panel broadcast-panel"><div className="section-heading"><span>{pick(locale, "أكواد اللاعبين", "Athlete codes")}</span><KeyRound size={18} /></div>{(payload?.athleteCodes ?? []).slice(0, 8).map((item) => <article key={item.id}><strong>{item.athlete_name} · {item.code}</strong><span>{item.status} · {gymById.get(item.gym_id)?.name ?? "Gym"}</span></article>)}</GlassCard>

            <GlassCard className="ops-panel admin-form-card branding-card"><div className="section-heading"><span>{pick(locale, "هوية التطبيق", "App identity")}</span><Palette size={18} /></div><form onSubmit={handleBranding}><label><span>{pick(locale, "اسم التطبيق", "App name")}</span><input value={branding.appName} onChange={(event) => setBranding((current) => ({ ...current, appName: event.target.value }))} /></label><label><span>{pick(locale, "الاسم المختصر", "Short name")}</span><input value={branding.shortName} onChange={(event) => setBranding((current) => ({ ...current, shortName: event.target.value }))} /></label><label><span>{pick(locale, "حرف الأيقونة", "Icon letter")}</span><input maxLength={2} value={branding.iconLetter} onChange={(event) => setBranding((current) => ({ ...current, iconLetter: event.target.value.toUpperCase() }))} /></label><div className="brand-color-grid"><label><span>{pick(locale, "لون الأيقونة", "Icon color")}</span><input type="color" value={branding.iconBackground} onChange={(event) => setBranding((current) => ({ ...current, iconBackground: event.target.value }))} /></label><label><span>{pick(locale, "لون الحرف", "Letter color")}</span><input type="color" value={branding.iconForeground} onChange={(event) => setBranding((current) => ({ ...current, iconForeground: event.target.value }))} /></label><label><span>{pick(locale, "لون المتصفح", "Theme color")}</span><input type="color" value={branding.themeColor} onChange={(event) => setBranding((current) => ({ ...current, themeColor: event.target.value }))} /></label><label><span>{pick(locale, "خلفية التثبيت", "Install background")}</span><input type="color" value={branding.backgroundColor} onChange={(event) => setBranding((current) => ({ ...current, backgroundColor: event.target.value }))} /></label></div><div className="brand-preview"><Image src="/api/branding/icon" alt="" width={46} height={46} unoptimized /><span>{pick(locale, "معاينة أيقونة التبويب والتثبيت", "Tab and install icon preview")}</span></div><button className="install-cue" disabled={busyAction === "branding" || !payload?.viewer.isPlatformAdmin} type="submit">{pick(locale, "حفظ الهوية", "Save identity")}</button></form></GlassCard>

            <GlassCard className="ops-panel audit-panel"><div className="section-heading"><span>{pick(locale, "سجل سريع", "Quick log")}</span><BadgeCheck size={18} /></div>{(payload?.memberships ?? []).slice(0, 6).map((member) => <article key={member.id}><strong>{member.role}</strong><span>{member.status} · {gymById.get(member.gym_id)?.name ?? member.gym_id}</span></article>)}</GlassCard>
          </div>
        </section>
      </div>
    </main>
  );
}



