"use client";

import Image from "next/image";
import Link from "next/link";
import { type FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { Activity, BadgeCheck, Ban, Building2, ChevronLeft, ChevronRight, Dumbbell, KeyRound, Languages, Loader2, Palette, Plus, Search, ShieldCheck, Trash2, UserCog } from "lucide-react";
import { GlassCard, IconButton } from "@/components/ui/primitives";
import { copy, type Locale } from "@/lib/translations";

type Branding = { appName: string; shortName: string; iconLetter: string; themeColor: string; backgroundColor: string; iconBackground: string; iconForeground: string };
type Gym = { id: string; name: string; slug: string; owner_email: string | null; status: string };
type Membership = { id: string; gym_id: string; role: "owner" | "coach" | "athlete"; status: string };
type AthleteCode = { id: string; gym_id: string; athlete_name: string; athlete_email: string | null; code: string; status: "unused" | "claimed" | "revoked"; claimed_at: string | null };
type AccountUser = { id: string; email: string | null; display_name: string; roles: string[]; comment: string; created_at: string; last_sign_in_at: string | null };
type AdminSection = "overview" | "gyms" | "people" | "accounts" | "codes" | "branding" | "audit";
type OperationsPayload = {
  viewer: { email: string | null; isPlatformAdmin: boolean; staffGymIds: string[] };
  branding: Branding;
  gyms: Gym[];
  memberships: Membership[];
  athleteCodes: AthleteCode[];
  accountUsers: AccountUser[];
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
  const [activeSection, setActiveSection] = useState<AdminSection>("overview");
  const [payload, setPayload] = useState<OperationsPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [accessDenied, setAccessDenied] = useState(false);
  const [gymName, setGymName] = useState("");
  const [gymSlug, setGymSlug] = useState("");
  const [ownerEmail, setOwnerEmail] = useState("");
  const [codeGymId, setCodeGymId] = useState("");
  const [athleteName, setAthleteName] = useState("");
  const [athleteEmail, setAthleteEmail] = useState("");
  const [branding, setBranding] = useState<Branding>(defaultBranding);
  const [accountEmail, setAccountEmail] = useState("");
  const [accountPassword, setAccountPassword] = useState("");
  const [accountName, setAccountName] = useState("");
  const [accountRole, setAccountRole] = useState("user");
  const [accountComment, setAccountComment] = useState("");
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
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
      if (response.status === 401 || response.status === 403) {
        setAccessDenied(true);
        setPayload(null);
        return;
      }
      if (!response.ok) throw new Error(await response.text());
      const data = await response.json() as OperationsPayload;
      setAccessDenied(false);
      setPayload(data);
      setBranding(data.branding);
      if (!codeGymId && data.gyms[0]) setCodeGymId(data.gyms[0].id);
    } catch {
      setPayload(null);
      setMessage(pick(locale, "تعذر تحميل لوحة التحكم الآن.", "Could not load the admin console right now."));
    } finally {
      setLoading(false);
    }
  }, [codeGymId, locale]);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadOperations(), 0);
    return () => window.clearTimeout(timer);
  }, [loadOperations]);

  const gymById = useMemo(() => new Map((payload?.gyms ?? []).map((gym) => [gym.id, gym])), [payload?.gyms]);
  const coaches = payload?.memberships.filter((item) => item.role === "coach") ?? [];
  const athletes = payload?.memberships.filter((item) => item.role === "athlete") ?? [];
  const openCodes = payload?.athleteCodes.filter((item) => item.status === "unused") ?? [];
  const claimedCodes = payload?.athleteCodes.filter((item) => item.status === "claimed") ?? [];

  const kpis = [
    { labelAr: "الأندية", labelEn: "Gyms", value: String(payload?.gyms.length ?? 0), icon: Building2 },
    { labelAr: "المدربون", labelEn: "Coaches", value: String(coaches.length), icon: Dumbbell },
    { labelAr: "اللاعبون", labelEn: "Athletes", value: String(athletes.length), icon: Activity },
    { labelAr: "أكواد متاحة", labelEn: "Open codes", value: String(openCodes.length), icon: KeyRound }
  ];

  const sections: { id: AdminSection; icon: typeof ShieldCheck; ar: string; en: string }[] = [
    { id: "overview", icon: ShieldCheck, ar: "نظرة عامة", en: "Overview" },
    { id: "gyms", icon: Building2, ar: "الأندية", en: "Gyms" },
    { id: "people", icon: UserCog, ar: "الفرق", en: "Teams" },
    { id: "accounts", icon: UserCog, ar: "الحسابات", en: "Accounts" },
    { id: "codes", icon: KeyRound, ar: "الأكواد", en: "Codes" },
    { id: "branding", icon: Palette, ar: "البراندنج", en: "Branding" },
    { id: "audit", icon: BadgeCheck, ar: "السجل", en: "Audit" }
  ];

  async function postAction(action: Record<string, unknown>, busyKey: string) {
    setBusyAction(busyKey);
    setMessage(null);
    try {
      const response = await fetch("/api/admin/operations", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(action) });
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

  async function handleCreateGym(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const result = await postAction({ action: "createGym", name: gymName, slug: gymSlug || slugify(gymName), ownerEmail }, "createGym");
    if (result) { setGymName(""); setGymSlug(""); setOwnerEmail(""); }
  }

  async function handleCreateAthleteCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const result = await postAction({ action: "createAthleteCode", gymId: codeGymId, athleteName, athleteEmail }, "createCode");
    if (result?.code?.code) { setMessage(pick(locale, `تم إنشاء الكود: ${result.code.code}`, `Created code: ${result.code.code}`)); setAthleteName(""); setAthleteEmail(""); }
  }

  async function handleBranding(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await postAction({ action: "updateBranding", branding }, "branding");
  }

  async function handleCreateAccount(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const result = await postAction({ action: "createUser", email: accountEmail, password: accountPassword, displayName: accountName, role: accountRole, comment: accountComment }, "createUser");
    if (result) { setAccountEmail(""); setAccountPassword(""); setAccountName(""); setAccountRole("user"); setAccountComment(""); }
  }

  async function handleUpdateAccount(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedAccountId) return;
    const payload: Record<string, unknown> = { action: "updateUser", userId: selectedAccountId, displayName: accountName, role: accountRole, comment: accountComment };
    if (accountEmail) payload.email = accountEmail;
    if (accountPassword) payload.password = accountPassword;
    const result = await postAction(payload, "updateUser");
    if (result) { setSelectedAccountId(null); setAccountEmail(""); setAccountPassword(""); setAccountName(""); setAccountRole("user"); setAccountComment(""); }
  }

  async function handleDeleteAccount(userId: string) {
    if (!window.confirm(pick(locale, "حذف الحساب نهائيًا؟", "Delete this account permanently?"))) return;
    await postAction({ action: "deleteUser", userId }, "deleteUser");
  }

  function editAccount(account: AccountUser) {
    setSelectedAccountId(account.id);
    setAccountEmail(account.email ?? "");
    setAccountPassword("");
    setAccountName(account.display_name);
    setAccountRole(account.roles[0] ?? "user");
    setAccountComment(account.comment ?? "");
    setActiveSection("accounts");
  }

  if (accessDenied && !loading) {
    return (
      <main className="app-shell admin-route admin-denied-route">
        <div className="admin-denied-card">
          <span className="live-badge warning"><i /> {pick(locale, "منطقة محمية", "Protected area")}</span>
          <Ban size={44} />
          <h1>{pick(locale, "غير مصرح بدخول لوحة الإدارة", "Admin access denied")}</h1>
          <p>{pick(locale, "هذه صفحة إدارة محمية. محاولة الدخول بدون صلاحية قد تؤدي إلى حظر الحساب أو الجهاز.", "This is a protected administration page. Unauthorized access attempts may lead to account or device restrictions.")}</p>
          <div className="auth-actions">
            <Link className="primary-cta" href="/admin/login"><span>{pick(locale, "دخول الأدمن", "Admin login")}</span><b><ShieldCheck size={18} /></b></Link>
            <Link className="secondary-cta" href="/">{pick(locale, "العودة للتطبيق", "Back to app")}</Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="app-shell admin-route">
      <div className="admin-frame">
        <aside className="admin-sidebar">
          <Link className="brand-row" href="/"><span className="brand-mark">D</span><strong>{t.appName}</strong></Link>
          <nav aria-label={pick(locale, "إدارة", "Admin")}>
            {sections.map(({ id, icon: Icon, ar, en }) => <button className={activeSection === id ? "active" : ""} key={id} onClick={() => setActiveSection(id)} type="button"><Icon size={18} /><span>{pick(locale, ar, en)}</span></button>)}
          </nav>
        </aside>

        <section className="admin-main">
          <header className="admin-header">
            <div><span className="live-badge warning"><i /> {pick(locale, "لوحة إدارة", "Admin console")}</span><h1>{pick(locale, "تشغيل الأندية والأكواد", "Gym and code operations")}</h1><p>{pick(locale, "كل قسم منفصل حسب المهمة: إدارة الأندية، الفرق، الأكواد، وهوية التطبيق.", "Each section is separated by workflow: gyms, teams, codes, and app identity.")}</p></div>
            <div className="header-actions"><Link className="auth-link" href="/"><BackIcon size={16} />{pick(locale, "التطبيق", "App")}</Link><IconButton aria-label={t.language} onClick={() => setLocale((current) => current === "ar" ? "en" : "ar")}><Languages size={18} /></IconButton></div>
          </header>

          {message ? <div className="admin-message">{message}</div> : null}
          {loading ? <div className="admin-message"><Loader2 className="spin" size={17} /> {pick(locale, "جار تحميل لوحة التحكم", "Loading operations")}</div> : null}

          {activeSection === "overview" ? <section className="admin-section"><div className="admin-kpis">{kpis.map(({ icon: Icon, labelAr, labelEn, value }) => <GlassCard as="article" className="admin-kpi" key={labelEn}><Icon size={20} /><span>{pick(locale, labelAr, labelEn)}</span><strong>{value}</strong></GlassCard>)}</div><div className="admin-two-column"><GlassCard className="ops-panel"><div className="section-heading"><span>{pick(locale, "آخر الأندية", "Recent gyms")}</span><Building2 size={18} /></div>{(payload?.gyms ?? []).slice(0, 5).map((gym) => <article key={gym.id}><strong>{gym.name}</strong><span>{gym.owner_email || pick(locale, "بدون مالك", "No owner")} · {gym.slug}</span></article>)}</GlassCard><GlassCard className="ops-panel"><div className="section-heading"><span>{pick(locale, "الأكواد النشطة", "Active codes")}</span><KeyRound size={18} /></div>{openCodes.slice(0, 5).map((item) => <article key={item.id}><strong>{item.athlete_name} · {item.code}</strong><span>{gymById.get(item.gym_id)?.name ?? "Gym"}</span></article>)}</GlassCard></div></section> : null}

          {activeSection === "gyms" ? <section className="admin-section admin-two-column wide-left"><GlassCard className="admin-table-card"><div className="section-heading"><span>{pick(locale, "الأندية المسجلة", "Registered gyms")}</span><Search size={16} /></div><div className="responsive-table"><table><thead><tr><th>{pick(locale, "النادي", "Gym")}</th><th>{pick(locale, "المالك", "Owner")}</th><th>{pick(locale, "الرابط", "Slug")}</th><th>{pick(locale, "الحالة", "Status")}</th></tr></thead><tbody>{(payload?.gyms ?? []).map((gym) => <tr key={gym.id}><td><strong>{gym.name}</strong><span>{gym.id.slice(0, 8)}</span></td><td>{gym.owner_email || pick(locale, "لم يحدد", "Not set")}</td><td>{gym.slug}</td><td><mark>{gym.status}</mark></td></tr>)}</tbody></table></div></GlassCard><GlassCard className="ops-panel admin-form-card"><div className="section-heading"><span>{pick(locale, "إنشاء نادي", "Create gym")}</span><Plus size={18} /></div><form onSubmit={handleCreateGym}><label><span>{pick(locale, "اسم النادي", "Gym name")}</span><input required value={gymName} onChange={(event) => { setGymName(event.target.value); if (!gymSlug) setGymSlug(slugify(event.target.value)); }} /></label><label><span>{pick(locale, "الرابط المختصر", "Slug")}</span><input required value={gymSlug} onChange={(event) => setGymSlug(slugify(event.target.value))} /></label><label><span>{pick(locale, "إيميل المالك", "Owner email")}</span><input inputMode="email" value={ownerEmail} onChange={(event) => setOwnerEmail(event.target.value)} /></label><button className="install-cue" disabled={busyAction === "createGym" || !payload?.viewer.isPlatformAdmin} type="submit">{pick(locale, "حفظ النادي", "Save gym")}</button></form></GlassCard></section> : null}

          {activeSection === "people" ? <section className="admin-section admin-two-column"><GlassCard className="ops-panel"><div className="section-heading"><span>{pick(locale, "المدربون والمالكون", "Owners and coaches")}</span><UserCog size={18} /></div>{(payload?.memberships ?? []).filter((item) => item.role !== "athlete").map((member) => <article key={member.id}><strong>{member.role}</strong><span>{member.status} · {gymById.get(member.gym_id)?.name ?? member.gym_id}</span></article>)}</GlassCard><GlassCard className="ops-panel"><div className="section-heading"><span>{pick(locale, "اللاعبون", "Athletes")}</span><Activity size={18} /></div>{athletes.map((member) => <article key={member.id}><strong>{pick(locale, "لاعب", "Athlete")}</strong><span>{member.status} · {gymById.get(member.gym_id)?.name ?? member.gym_id}</span></article>)}</GlassCard></section> : null}


          {activeSection === "accounts" ? <section className="admin-section admin-two-column wide-left"><GlassCard className="admin-table-card"><div className="section-heading"><span>{pick(locale, "حسابات المستخدمين", "User accounts")}</span><UserCog size={18} /></div><div className="responsive-table"><table><thead><tr><th>{pick(locale, "المستخدم", "User")}</th><th>{pick(locale, "الدور", "Role")}</th><th>{pick(locale, "تعليق", "Comment")}</th><th>{pick(locale, "آخر دخول", "Last sign in")}</th><th>{pick(locale, "تحكم", "Actions")}</th></tr></thead><tbody>{(payload?.accountUsers ?? []).map((account) => <tr key={account.id}><td><strong>{account.display_name}</strong><span>{account.email ?? "-"}</span></td><td><mark>{account.roles[0] ?? "user"}</mark></td><td>{account.comment || "-"}</td><td>{account.last_sign_in_at ? new Date(account.last_sign_in_at).toLocaleDateString(locale === "ar" ? "ar-EG" : "en-US") : "-"}</td><td><div className="table-actions"><button onClick={() => editAccount(account)} type="button">{pick(locale, "تعديل", "Edit")}</button><button className="danger-action" onClick={() => handleDeleteAccount(account.id)} type="button"><Trash2 size={15} /></button></div></td></tr>)}</tbody></table></div></GlassCard><GlassCard className="ops-panel admin-form-card"><div className="section-heading"><span>{selectedAccountId ? pick(locale, "تعديل حساب", "Edit account") : pick(locale, "إضافة حساب", "Add account")}</span><Plus size={18} /></div><form onSubmit={selectedAccountId ? handleUpdateAccount : handleCreateAccount}><label><span>{pick(locale, "الاسم", "Name")}</span><input required value={accountName} onChange={(event) => setAccountName(event.target.value)} /></label><label><span>{pick(locale, "البريد", "Email")}</span><input inputMode="email" required value={accountEmail} onChange={(event) => setAccountEmail(event.target.value)} /></label><label><span>{pick(locale, selectedAccountId ? "كلمة مرور جديدة اختيارية" : "كلمة المرور", selectedAccountId ? "New password optional" : "Password")}</span><input minLength={6} required={!selectedAccountId} type="password" value={accountPassword} onChange={(event) => setAccountPassword(event.target.value)} /></label><label><span>{pick(locale, "الدور", "Role")}</span><select value={accountRole} onChange={(event) => setAccountRole(event.target.value)}><option value="user">user</option><option value="athlete">athlete</option><option value="coach">coach</option><option value="gym_owner">gym_owner</option><option value="platform_admin">platform_admin</option></select></label><label><span>{pick(locale, "تعليق إداري", "Admin comment")}</span><textarea value={accountComment} onChange={(event) => setAccountComment(event.target.value)} maxLength={500} /></label><button className="install-cue" disabled={busyAction === "createUser" || busyAction === "updateUser" || !payload?.viewer.isPlatformAdmin} type="submit">{selectedAccountId ? pick(locale, "حفظ التعديل", "Save changes") : pick(locale, "إنشاء الحساب", "Create account")}</button>{selectedAccountId ? <button className="secondary-cta" onClick={() => { setSelectedAccountId(null); setAccountEmail(""); setAccountPassword(""); setAccountName(""); setAccountRole("user"); setAccountComment(""); }} type="button">{pick(locale, "إلغاء", "Cancel")}</button> : null}</form></GlassCard></section> : null}

          {activeSection === "codes" ? <section className="admin-section admin-two-column wide-left"><GlassCard className="admin-table-card"><div className="section-heading"><span>{pick(locale, "أكواد اللاعبين", "Athlete codes")}</span><KeyRound size={18} /></div><div className="responsive-table"><table><thead><tr><th>{pick(locale, "اللاعب", "Athlete")}</th><th>{pick(locale, "الكود", "Code")}</th><th>{pick(locale, "النادي", "Gym")}</th><th>{pick(locale, "الحالة", "Status")}</th></tr></thead><tbody>{(payload?.athleteCodes ?? []).map((item) => <tr key={item.id}><td><strong>{item.athlete_name}</strong><span>{item.athlete_email || "-"}</span></td><td>{item.code}</td><td>{gymById.get(item.gym_id)?.name ?? "Gym"}</td><td><mark>{item.status}</mark></td></tr>)}</tbody></table></div></GlassCard><GlassCard className="ops-panel admin-form-card"><div className="section-heading"><span>{pick(locale, "إصدار كود", "Issue code")}</span><Plus size={18} /></div><form onSubmit={handleCreateAthleteCode}><label><span>{pick(locale, "النادي", "Gym")}</span><select required value={codeGymId} onChange={(event) => setCodeGymId(event.target.value)}>{(payload?.gyms ?? []).map((gym) => <option key={gym.id} value={gym.id}>{gym.name}</option>)}</select></label><label><span>{pick(locale, "اسم اللاعب", "Athlete name")}</span><input required value={athleteName} onChange={(event) => setAthleteName(event.target.value)} /></label><label><span>{pick(locale, "إيميل اللاعب اختياري", "Athlete email optional")}</span><input inputMode="email" value={athleteEmail} onChange={(event) => setAthleteEmail(event.target.value)} /></label><button className="install-cue" disabled={busyAction === "createCode" || !codeGymId} type="submit">{pick(locale, "إصدار الكود", "Issue code")}</button></form></GlassCard></section> : null}

          {activeSection === "branding" ? <section className="admin-section"><GlassCard className="ops-panel admin-form-card branding-card"><div className="section-heading"><span>{pick(locale, "هوية التطبيق", "App identity")}</span><Palette size={18} /></div><form onSubmit={handleBranding}><div className="brand-editor-grid"><label><span>{pick(locale, "اسم التطبيق", "App name")}</span><input value={branding.appName} onChange={(event) => setBranding((current) => ({ ...current, appName: event.target.value }))} /></label><label><span>{pick(locale, "الاسم المختصر", "Short name")}</span><input value={branding.shortName} onChange={(event) => setBranding((current) => ({ ...current, shortName: event.target.value }))} /></label><label><span>{pick(locale, "حرف الأيقونة", "Icon letter")}</span><input maxLength={2} value={branding.iconLetter} onChange={(event) => setBranding((current) => ({ ...current, iconLetter: event.target.value.toUpperCase() }))} /></label></div><div className="brand-color-grid"><label><span>{pick(locale, "لون الأيقونة", "Icon color")}</span><input type="color" value={branding.iconBackground} onChange={(event) => setBranding((current) => ({ ...current, iconBackground: event.target.value }))} /></label><label><span>{pick(locale, "لون الحرف", "Letter color")}</span><input type="color" value={branding.iconForeground} onChange={(event) => setBranding((current) => ({ ...current, iconForeground: event.target.value }))} /></label><label><span>{pick(locale, "لون المتصفح", "Theme color")}</span><input type="color" value={branding.themeColor} onChange={(event) => setBranding((current) => ({ ...current, themeColor: event.target.value }))} /></label><label><span>{pick(locale, "خلفية التثبيت", "Install background")}</span><input type="color" value={branding.backgroundColor} onChange={(event) => setBranding((current) => ({ ...current, backgroundColor: event.target.value }))} /></label></div><div className="brand-preview"><Image src="/api/branding/icon" alt="" width={46} height={46} unoptimized /><span>{pick(locale, "معاينة أيقونة التبويب والتثبيت", "Tab and install icon preview")}</span></div><button className="install-cue" disabled={busyAction === "branding" || !payload?.viewer.isPlatformAdmin} type="submit">{pick(locale, "حفظ الهوية", "Save identity")}</button></form></GlassCard></section> : null}

          {activeSection === "audit" ? <section className="admin-section admin-two-column"><GlassCard className="ops-panel"><div className="section-heading"><span>{pick(locale, "آخر العضويات", "Latest memberships")}</span><BadgeCheck size={18} /></div>{(payload?.memberships ?? []).slice(0, 10).map((member) => <article key={member.id}><strong>{member.role}</strong><span>{member.status} · {gymById.get(member.gym_id)?.name ?? member.gym_id}</span></article>)}</GlassCard><GlassCard className="ops-panel"><div className="section-heading"><span>{pick(locale, "ملخص الأكواد", "Code summary")}</span><KeyRound size={18} /></div><article><strong>{openCodes.length}</strong><span>{pick(locale, "أكواد متاحة", "Open codes")}</span></article><article><strong>{claimedCodes.length}</strong><span>{pick(locale, "أكواد مستخدمة", "Claimed codes")}</span></article></GlassCard></section> : null}
        </section>
      </div>
    </main>
  );
}

