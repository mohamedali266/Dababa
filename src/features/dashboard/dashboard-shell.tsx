"use client";

import Image from "next/image";
import Link from "next/link";
import { type CSSProperties, useEffect, useMemo, useState } from "react";
import { Activity, ArrowLeft, ArrowRight, Bell, Dumbbell, Droplets, Gauge, Home, Languages, Loader2, LogOut, Moon, Plus, Salad, Settings, Shield, Sun, TimerReset, Trophy, UserCircle, Waves } from "lucide-react";
import { GlassCard, IconButton, ProgressRing, SemiGauge, Toggle } from "@/components/ui/primitives";
import { reminders, supplements, trackingMetrics } from "@/features/dashboard/mock-data";
import { copy, type Locale } from "@/lib/translations";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

type ThemeChoice = "dark" | "light" | "system";
type Tab = "home" | "workout" | "tracking" | "nutrition" | "hydration" | "supplements" | "progress" | "settings";
type SecurityAlert = "admin_required" | "admin_denied" | string | null;

type AssessmentAnswers = {
  identity?: { name?: string; username?: string };
  body?: { height_cm?: number | null; weight_kg?: number | null; birth_date?: string | null };
  training?: { goal?: string; training_days_per_week?: number | null; workout_duration_minutes?: number | null; activity_level?: string; experience?: string; goal_duration_weeks?: number | null };
  gym?: { not_subscribed?: boolean };
};

type DashboardData = {
  loading: boolean;
  displayName: string | null;
  email: string | null;
  assessment: AssessmentAnswers | null;
  membershipCount: number;
  workoutCount: number;
  latestWeightKg: number | null;
  calories: number | null;
  proteinG: number | null;
  carbsG: number | null;
  fatG: number | null;
};

const tabs: { id: Tab; icon: typeof Home }[] = [
  { id: "home", icon: Home },
  { id: "workout", icon: Dumbbell },
  { id: "tracking", icon: Gauge },
  { id: "nutrition", icon: Salad },
  { id: "hydration", icon: Droplets },
  { id: "supplements", icon: Bell },
  { id: "progress", icon: Trophy },
  { id: "settings", icon: Settings }
];

const emptyData: DashboardData = { loading: true, displayName: null, email: null, assessment: null, membershipCount: 0, workoutCount: 0, latestWeightKg: null, calories: null, proteinG: null, carbsG: null, fatG: null };
const pick = (locale: Locale, ar: string, en: string) => (locale === "ar" ? ar : en);
const goalLabel = (locale: Locale, goal?: string) => {
  const labels: Record<string, [string, string]> = { build_muscle: ["زيادة عضل", "Build muscle"], fat_loss: ["خسارة دهون", "Fat loss"], strength: ["قوة", "Strength"], fitness: ["لياقة", "Fitness"] };
  const value = labels[goal ?? ""] ?? ["هدف غير محدد", "Goal not set"];
  return pick(locale, value[0], value[1]);
};
const formatTrackingValue = (locale: Locale, value: string) => locale === "en" ? value : value.replace("km", "كم").replace("bpm", "نبضة/د");
const formatDose = (locale: Locale, dose: string) => locale === "en" ? dose : dose.replace("mg", "مجم").replace("g", "جم").replace("IU", "وحدة");

export function DashboardShell({ securityAlert = null }: { securityAlert?: SecurityAlert }) {
  const [locale, setLocale] = useState<Locale>("ar");
  const [activeTab, setActiveTab] = useState<Tab>("home");
  const [theme, setTheme] = useState<ThemeChoice>(() => {
    if (typeof window === "undefined") return "system";
    return (localStorage.getItem("dababa-theme") as ThemeChoice | null) ?? "system";
  });
  const [data, setData] = useState<DashboardData>(emptyData);
  const [smartTracking, setSmartTracking] = useState(true);
  const [waterMl, setWaterMl] = useState(0);
  const [timer, setTimer] = useState(90);
  const [running, setRunning] = useState(false);
  const [checkedSupplements, setCheckedSupplements] = useState<boolean[]>(supplements.map((item) => item.done));
  const [reminderStates, setReminderStates] = useState<boolean[]>(reminders.map((item) => item.enabled));
  const t = copy[locale];
  const isRtl = locale === "ar";

  useEffect(() => {
    document.documentElement.lang = locale;
    document.documentElement.dir = isRtl ? "rtl" : "ltr";
  }, [isRtl, locale]);

  useEffect(() => {
    const apply = () => {
      const systemTheme = window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
      document.documentElement.dataset.theme = theme === "system" ? systemTheme : theme;
      localStorage.setItem("dababa-theme", theme);
    };
    apply();
    const media = window.matchMedia("(prefers-color-scheme: light)");
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, [theme]);

  useEffect(() => {
    if (!running) return;
    const interval = window.setInterval(() => setTimer((value) => (value > 0 ? value - 1 : 90)), 1000);
    return () => window.clearInterval(interval);
  }, [running]);

  useEffect(() => {
    if (process.env.NODE_ENV === "production" && "serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => undefined);
  }, []);

  async function loadDashboard() {
    const supabase = createSupabaseBrowserClient();
    const { data: sessionData } = await supabase.auth.getSession();
    const user = sessionData.session?.user ?? null;
    if (!user) {
      setData({ ...emptyData, loading: false });
      return;
    }

    const [{ data: profile }, { data: assessment }, { data: memberships }, { data: bodyMetrics }, { data: nutrition }, { data: workouts }] = await Promise.all([
      supabase.from("profiles").select("display_name").eq("id", user.id).maybeSingle(),
      supabase.from("health_assessments").select("answers, updated_at").eq("user_id", user.id).order("updated_at", { ascending: false }).limit(1).maybeSingle(),
      supabase.from("gym_memberships").select("id").eq("user_id", user.id).eq("status", "active"),
      supabase.from("body_metrics").select("weight_kg, measured_on").eq("user_id", user.id).order("measured_on", { ascending: false }).limit(1).maybeSingle(),
      supabase.from("nutrition_plans").select("calories, protein_g, carbs_g, fat_g, created_at").eq("user_id", user.id).order("created_at", { ascending: false }).limit(1).maybeSingle(),
      supabase.from("workout_logs").select("id").eq("user_id", user.id).limit(100)
    ]);

    setData({
      loading: false,
      displayName: profile?.display_name ?? null,
      email: user.email ?? null,
      assessment: (assessment?.answers as AssessmentAnswers | null) ?? null,
      membershipCount: memberships?.length ?? 0,
      workoutCount: workouts?.length ?? 0,
      latestWeightKg: Number(bodyMetrics?.weight_kg ?? assessment?.answers?.body?.weight_kg ?? 0) || null,
      calories: nutrition?.calories ?? null,
      proteinG: nutrition?.protein_g ?? null,
      carbsG: nutrition?.carbs_g ?? null,
      fatG: nutrition?.fat_g ?? null
    });
  }

  useEffect(() => {
    const timerId = window.setTimeout(() => void loadDashboard(), 0);
    const supabase = createSupabaseBrowserClient();
    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => void loadDashboard());
    return () => {
      window.clearTimeout(timerId);
      subscription.unsubscribe();
    };
  }, []);

  async function handleSignOut() {
    const supabase = createSupabaseBrowserClient();
    await supabase.auth.signOut();
    setData({ ...emptyData, loading: false });
  }

  function cycleTheme() {
    setTheme((current) => (current === "dark" ? "light" : current === "light" ? "system" : "dark"));
  }

  const themeIcon = theme === "dark" ? Moon : theme === "light" ? Sun : Waves;
  const ThemeIcon = themeIcon;
  const ArrowIcon = isRtl ? ArrowLeft : ArrowRight;
  const timerLabel = useMemo(() => `${Math.floor(timer / 60)}:${String(timer % 60).padStart(2, "0")}`, [timer]);
  const isAuthed = Boolean(data.email);
  const name = data.displayName ?? data.assessment?.identity?.name ?? data.email?.split("@")[0] ?? pick(locale, "لاعب دبابة", "Dababa athlete");
  const targetCalories = data.calories ?? (data.latestWeightKg ? Math.round(data.latestWeightKg * 32) : null);
  const waterTarget = data.latestWeightKg ? Math.round(data.latestWeightKg * 35) : 2800;
  const waterPct = Math.min(100, Math.round((waterMl / waterTarget) * 100));
  const progressPct = data.assessment ? Math.min(100, 30 + (data.membershipCount ? 20 : 0) + (data.workoutCount ? 25 : 0) + (data.calories ? 25 : 0)) : 0;
  const securityMessage = securityAlert === "admin_denied"
    ? pick(locale, "تم منع محاولة دخول لوحة الإدارة. الدخول بدون صلاحية قد يؤدي إلى حظر الحساب نهائيًا.", "Admin access was blocked. Unauthorized attempts may permanently restrict the account.")
    : securityAlert === "admin_required"
      ? pick(locale, "يجب تسجيل دخول الأدمن قبل فتح لوحة الإدارة.", "Admin sign-in is required before opening the console.")
      : null;

  return (
    <main className="app-shell dashboard-shell">
      <div className="background-layer" aria-hidden="true"><Image src="/images/athletic-backdrop.png" alt="" fill priority sizes="100vw" /></div>
      <aside className="side-rail" aria-label={pick(locale, "التنقل الرئيسي", "Primary navigation")}>
        <Link className="brand-mark" href="/" aria-label="Dababa">D</Link>
        {tabs.map(({ id, icon: Icon }) => <button aria-label={t.tabs[id]} className={activeTab === id ? "active" : ""} key={id} onClick={() => setActiveTab(id)} type="button"><Icon size={19} /><span>{t.tabs[id]}</span></button>)}
        <Link className="rail-link" href="/admin/login" aria-label={pick(locale, "دخول الإدارة", "Admin sign in")}><Shield size={19} /><span>{pick(locale, "إدارة", "Admin")}</span></Link>
      </aside>

      <div className="app-frame">
        <header className="topbar">
          <div><span className="eyebrow">{t.appName} / PWA</span><h1>{isAuthed ? pick(locale, `أهلًا ${name}`, `Welcome ${name}`) : t.greeting}</h1></div>
          <div className="header-actions">
            {data.loading ? <span className="user-chip"><Loader2 className="spin" size={16} />{pick(locale, "تحميل", "Loading")}</span> : isAuthed ? <div className="user-chip"><UserCircle size={18} /><span>{data.email}</span><button onClick={handleSignOut} type="button"><LogOut size={15} /></button></div> : <Link className="auth-link" href="/auth">{t.login}</Link>}
            <IconButton aria-label={t.language} onClick={() => setLocale((current) => (current === "ar" ? "en" : "ar"))}><Languages size={19} /></IconButton>
            <IconButton aria-label={t.theme} onClick={cycleTheme}><ThemeIcon size={19} /></IconButton>
          </div>
        </header>

        {securityMessage ? <div className="security-alert"><Shield size={18} />{securityMessage}</div> : null}

        <section className="dashboard-hero">
          <div className="welcome-copy">
            <span className="live-badge"><i /> {isAuthed ? pick(locale, "بيانات حسابك", "Your account data") : pick(locale, "ابدأ الرحلة", "Start journey")}</span>
            <h2>{isAuthed ? pick(locale, "لوحة مبنية على تقييمك وبياناتك الفعلية", "A dashboard built from your real profile") : pick(locale, "سجل حسابك لعرض خطتك الفعلية", "Create an account to see your real plan")}</h2>
            <p>{isAuthed ? pick(locale, "أي رقم هنا مصدره تقييمك، خططك، أو سجلاتك داخل Supabase. البيانات الناقصة تظهر كمهام مطلوبة بدل أرقام وهمية.", "Every number here comes from your assessment, plans, or logs in Supabase. Missing data appears as next actions instead of fake metrics.") : t.subtitle}</p>
            <div className="cta-row">{isAuthed ? <button className="primary-cta" onClick={() => setActiveTab("workout")} type="button"><span>{t.start}</span><b><ArrowIcon size={18} /></b></button> : <Link className="primary-cta" href="/auth"><span>{pick(locale, "ابدأ الآن", "Start now")}</span><b><ArrowIcon size={18} /></b></Link>}<button className="secondary-cta" onClick={() => setActiveTab("progress")} type="button">{pick(locale, "راجع التقدم", "Review progress")}</button></div>
          </div>
          <GlassCard className="hero-focus-panel"><span>{t.sections.active}</span><strong>{goalLabel(locale, data.assessment?.training?.goal)}</strong><p>{isAuthed ? pick(locale, `${data.assessment?.training?.training_days_per_week ?? 0} أيام تدريب أسبوعيًا · ${data.assessment?.training?.workout_duration_minutes ?? 0} دقيقة للتمرين`, `${data.assessment?.training?.training_days_per_week ?? 0} training days/week · ${data.assessment?.training?.workout_duration_minutes ?? 0} min/session`) : pick(locale, "لن نعرض أرقامًا افتراضية قبل تسجيلك.", "No sample numbers before you sign in.")}</p><ProgressRing value={progressPct} label={pick(locale, "اكتمال", "Complete")} /></GlassCard>
        </section>

        <div className="desktop-tabs" role="tablist" aria-label={pick(locale, "أقسام التطبيق", "App sections")}>{tabs.map(({ id, icon: Icon }) => <button aria-selected={activeTab === id} className={activeTab === id ? "active" : ""} key={id} onClick={() => setActiveTab(id)} role="tab" type="button"><Icon size={16} />{t.tabs[id]}</button>)}</div>

        <div className="content-grid">
          <section className={activeTab === "home" ? "screen active dashboard-overview" : "screen"}>
            <GlassCard className="health-card"><div className="section-heading"><span>{t.sections.health}</span><button onClick={() => setActiveTab("settings")} type="button"><Plus size={16} />{t.quickAdd}</button></div><div className="stat-chip-row"><article><Activity size={18} /><strong>{data.assessment ? goalLabel(locale, data.assessment.training?.goal) : "--"}</strong><span>{pick(locale, "الهدف", "Goal")}</span></article><article><Dumbbell size={18} /><strong>{data.assessment?.training?.training_days_per_week ?? "--"}</strong><span>{pick(locale, "أيام التدريب", "Training days")}</span></article><article><Gauge size={18} /><strong>{data.latestWeightKg ? `${data.latestWeightKg}` : "--"}</strong><span>{pick(locale, "الوزن كجم", "Weight kg")}</span></article><article><Shield size={18} /><strong>{data.membershipCount ? pick(locale, "مرتبط", "Linked") : pick(locale, "بدون", "None")}</strong><span>{pick(locale, "النادي", "Gym")}</span></article></div></GlassCard>
            <GlassCard className="active-task"><div><span className="eyebrow">{t.sections.active}</span><h3>{isAuthed ? pick(locale, "خطة اليوم حسب تقييمك", "Today from your assessment") : pick(locale, "سجل الدخول لبدء الخطة", "Sign in to start")}</h3><p>{isAuthed ? pick(locale, "سنملأ التمارين الفعلية بمجرد إنشاء خطة تدريب أو تسجيل أول تمرين.", "Real exercises appear once a training plan or workout log exists.") : pick(locale, "بعد التسجيل ستظهر هنا الخطة والتغذية والماء من حسابك.", "After signup, your plan, nutrition, and hydration appear here.")}</p></div><ProgressRing value={progressPct} label={pick(locale, "جاهزية", "Ready")} /></GlassCard>
            <div className="task-strip"><GlassCard as="article" className="mini-task"><ProgressRing value={data.workoutCount ? 100 : 0} label={pick(locale, "تمارين", "Workouts")} /><strong>{data.workoutCount}</strong></GlassCard><GlassCard as="article" className="mini-task"><ProgressRing value={data.calories ? 100 : 0} label={pick(locale, "تغذية", "Nutrition")} /><strong>{targetCalories ?? "--"}</strong></GlassCard><GlassCard as="article" className="mini-task"><ProgressRing value={data.membershipCount ? 100 : 0} label={pick(locale, "نادي", "Gym")} /><strong>{data.membershipCount}</strong></GlassCard></div>
          </section>

          <section className={activeTab === "workout" ? "screen active" : "screen"}><GlassCard className="workout-card"><div className="section-heading"><span>{t.sections.workout}</span><button onClick={() => setRunning((value) => !value)} type="button"><TimerReset size={16} />{timerLabel}</button></div><div className="empty-state"><Dumbbell size={28} /><strong>{pick(locale, "لا توجد خطة تمرين فعلية بعد", "No real workout plan yet")}</strong><span>{pick(locale, "بعد إنشاء خطة من تقييمك ستظهر التمارين هنا بدل أي بيانات تجريبية.", "Once a plan is generated from your assessment, exercises will appear here instead of sample data.")}</span></div></GlassCard></section>
          <section className={activeTab === "tracking" ? "screen active" : "screen"}><GlassCard className="tracking-card"><div className="section-heading"><span>{t.sections.tracking}</span><Toggle checked={smartTracking} onChange={() => setSmartTracking((v) => !v)} label={t.smart} /></div><SemiGauge value={progressPct} label={pick(locale, "فعلي", "REAL")} ariaLabel={pick(locale, "التتبع", "Tracking")} /><div className="metric-grid">{trackingMetrics.map(({ icon: Icon, labelAr, labelEn, value }) => <article key={labelEn}><Icon size={18} /><span>{pick(locale, labelAr, labelEn)}</span><strong>{isAuthed ? formatTrackingValue(locale, value) : "--"}</strong></article>)}</div></GlassCard></section>
          <section className={activeTab === "nutrition" ? "screen active" : "screen"}><GlassCard className="nutrition-card"><ProgressRing value={targetCalories ? 100 : 0} label={pick(locale, "سعرات", "Calories")} /><div className="nutrition-main"><span className="eyebrow">{t.sections.nutrition}</span><h3>{targetCalories ? `${targetCalories} ${pick(locale, "سعرة", "kcal")}` : pick(locale, "لم تُنشأ خطة تغذية", "No nutrition plan")}</h3><div className="macro-bars"><span style={{ "--w": data.proteinG ? "100%" : "0%" } as CSSProperties}>{pick(locale, "بروتين", "Protein")} {data.proteinG ?? "--"}g</span><span style={{ "--w": data.carbsG ? "100%" : "0%" } as CSSProperties}>{pick(locale, "كارب", "Carbs")} {data.carbsG ?? "--"}g</span><span style={{ "--w": data.fatG ? "100%" : "0%" } as CSSProperties}>{pick(locale, "دهون", "Fat")} {data.fatG ?? "--"}g</span></div></div></GlassCard></section>
          <section className={activeTab === "hydration" ? "screen active" : "screen"}><GlassCard className="hydration-card"><div className="water-visual" style={{ "--fill": `${waterPct}%` } as CSSProperties}><Droplets size={34} /><strong>{waterPct}%</strong></div><div><span className="eyebrow">{t.sections.hydration}</span><h3>{waterMl} / {waterTarget} {pick(locale, "مل", "ml")}</h3><p>{pick(locale, "هدف الماء محسوب من وزنك إن وجد.", "Water target is calculated from your weight when available.")}</p><div className="quick-buttons"><button onClick={() => setWaterMl((v) => Math.min(waterTarget, v + 250))} type="button">+250 {pick(locale, "مل", "ml")}</button><button onClick={() => setWaterMl((v) => Math.min(waterTarget, v + 500))} type="button">+500 {pick(locale, "مل", "ml")}</button></div></div></GlassCard></section>
          <section className={activeTab === "supplements" ? "screen active" : "screen"}><GlassCard className="checklist-card"><div className="section-heading"><span>{t.sections.supplements}</span><span className="live-badge"><i /> {checkedSupplements.filter(Boolean).length}/{supplements.length}</span></div>{supplements.map((item, index) => <button className="check-row" key={item.labelEn} onClick={() => setCheckedSupplements((list) => list.map((v, i) => (i === index ? !v : v)))} type="button"><span data-checked={checkedSupplements[index]} /><div><strong>{pick(locale, item.labelAr, item.labelEn)}</strong><small>{formatDose(locale, item.dose)} · {pick(locale, item.timeAr, item.timeEn)}</small></div></button>)}</GlassCard></section>
          <section className={activeTab === "progress" ? "screen active" : "screen"}><GlassCard className="progress-card"><div className="section-heading"><span>{t.sections.progress}</span><Trophy size={18} /></div><article className="progress-row"><div><strong>{pick(locale, "اكتمال الملف", "Profile completion")}</strong><span>{pick(locale, "محسوب من بياناتك الفعلية", "Calculated from your real data")}</span></div><b>{progressPct}%</b><i style={{ "--w": `${progressPct}%` } as CSSProperties} /></article><article className="progress-row"><div><strong>{pick(locale, "سجلات التمرين", "Workout logs")}</strong><span>{pick(locale, "عدد السجلات المحفوظة", "Saved logs count")}</span></div><b>{data.workoutCount}</b><i style={{ "--w": `${Math.min(100, data.workoutCount * 10)}%` } as CSSProperties} /></article></GlassCard></section>
          <section className={activeTab === "settings" ? "screen active" : "screen"}><GlassCard className="settings-card"><div className="section-heading"><span>{t.sections.settings}</span><button onClick={cycleTheme} type="button">{pick(locale, theme === "dark" ? "داكن" : theme === "light" ? "فاتح" : "النظام", theme === "dark" ? "Dark" : theme === "light" ? "Light" : "System")}</button></div>{reminders.map(({ icon: Icon, labelAr, labelEn }, index) => <div className="setting-row" key={labelEn}><Icon size={18} /><span>{pick(locale, labelAr, labelEn)}</span><Toggle checked={reminderStates[index]} onChange={() => setReminderStates((list) => list.map((value, i) => (i === index ? !value : value)))} label="" /></div>)}<button className="install-cue" type="button">{pick(locale, "تثبيت دبابة على الشاشة الرئيسية", "Install Dababa to home screen")}</button></GlassCard></section>
        </div>
      </div>
      <nav className="bottom-nav" aria-label={pick(locale, "تنقل الهاتف", "Mobile navigation")}>{tabs.map(({ id, icon: Icon }) => <button className={activeTab === id ? "active" : ""} key={id} onClick={() => setActiveTab(id)} type="button"><Icon size={19} /><span>{t.tabs[id]}</span></button>)}</nav>
    </main>
  );
}
