"use client";

import Image from "next/image";
import Link from "next/link";
import { type CSSProperties, useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Bell,
  Dumbbell,
  Droplets,
  Gauge,
  Home,
  Languages,
  LogOut,
  Moon,
  Plus,
  Salad,
  Settings,
  Shield,
  Sun,
  TimerReset,
  Trophy,
  UserCircle,
  Waves
} from "lucide-react";
import { GlassCard, IconButton, ProgressRing, SemiGauge, Toggle } from "@/components/ui/primitives";
import {
  healthStats,
  meals,
  previousTasks,
  progressRows,
  reminders,
  supplements,
  trackingMetrics,
  workoutExercises
} from "@/features/dashboard/mock-data";
import { copy, type Locale } from "@/lib/translations";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

type ThemeChoice = "dark" | "light" | "system";
type Tab = "home" | "workout" | "tracking" | "nutrition" | "hydration" | "supplements" | "progress" | "settings";

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

const pick = (locale: Locale, ar: string, en: string) => (locale === "ar" ? ar : en);
const formatTrackingValue = (locale: Locale, value: string) => locale === "en" ? value : value.replace("km", "كم").replace("bpm", "نبضة/د");
const formatDose = (locale: Locale, dose: string) => locale === "en" ? dose : dose.replace("mg", "مجم").replace("g", "جم").replace("IU", "وحدة");
const formatMetricValue = (locale: Locale, value: string) => locale === "en" ? value : value.replace("kg", "كجم").replace("cm", "سم");

export function DashboardShell() {
  const [locale, setLocale] = useState<Locale>("ar");
  const [activeTab, setActiveTab] = useState<Tab>("home");
  const [theme, setTheme] = useState<ThemeChoice>(() => {
    if (typeof window === "undefined") return "dark";
    return (localStorage.getItem("dababa-theme") as ThemeChoice | null) ?? "dark";
  });
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [smartTracking, setSmartTracking] = useState(true);
  const [waterMl, setWaterMl] = useState(1800);
  const [timer, setTimer] = useState(90);
  const [running, setRunning] = useState(false);
  const [checkedSupplements, setCheckedSupplements] = useState<boolean[]>(supplements.map((item) => item.done));
  const [reminderStates, setReminderStates] = useState<boolean[]>(reminders.map((item) => item.enabled));
  const t = copy[locale];
  const isRtl = locale === "ar";

  useEffect(() => {
    const root = document.documentElement;
    root.lang = locale;
    root.dir = isRtl ? "rtl" : "ltr";
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
    if (process.env.NODE_ENV === "production" && "serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => undefined);
    }
  }, []);

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    supabase.auth.getSession().then(({ data }) => setUserEmail(data.session?.user.email ?? null)).catch(() => undefined);
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => setUserEmail(session?.user.email ?? null));
    return () => subscription.unsubscribe();
  }, []);

  async function handleSignOut() {
    const supabase = createSupabaseBrowserClient();
    await supabase.auth.signOut();
    setUserEmail(null);
  }

  const themeIcon = theme === "dark" ? Moon : theme === "light" ? Sun : Waves;
  const ThemeIcon = themeIcon;
  const ArrowIcon = isRtl ? ArrowLeft : ArrowRight;
  const waterPct = Math.min(100, Math.round((waterMl / 2800) * 100));
  const timerLabel = useMemo(() => `${Math.floor(timer / 60)}:${String(timer % 60).padStart(2, "0")}`, [timer]);

  function cycleTheme() {
    setTheme((current) => (current === "dark" ? "light" : current === "light" ? "system" : "dark"));
  }

  return (
    <main className="app-shell dashboard-shell">
      <div className="background-layer" aria-hidden="true">
        <Image src="/images/athletic-backdrop.png" alt="" fill priority sizes="100vw" />
      </div>

      <aside className="side-rail" aria-label={pick(locale, "التنقل الرئيسي", "Primary navigation")}>
        <Link className="brand-mark" href="/" aria-label="Dababa">D</Link>
        {tabs.map(({ id, icon: Icon }) => (
          <button aria-label={t.tabs[id]} className={activeTab === id ? "active" : ""} key={id} onClick={() => setActiveTab(id)} type="button">
            <Icon size={19} />
            <span>{t.tabs[id]}</span>
          </button>
        ))}
        <Link className="rail-link" href="/admin" aria-label={t.tabs.admin}><Shield size={19} /><span>{t.tabs.admin}</span></Link>
      </aside>

      <div className="app-frame">
        <header className="topbar">
          <div>
            <span className="eyebrow">{t.appName} / PWA</span>
            <h1>{t.greeting}</h1>
          </div>
          <div className="header-actions">
            {userEmail ? (
              <div className="user-chip"><UserCircle size={18} /><span>{userEmail}</span><button onClick={handleSignOut} type="button"><LogOut size={15} /></button></div>
            ) : (
              <Link className="auth-link" href="/auth">{t.login}</Link>
            )}
            <IconButton aria-label={t.language} onClick={() => setLocale((current) => (current === "ar" ? "en" : "ar"))}><Languages size={19} /></IconButton>
            <IconButton aria-label={t.theme} onClick={cycleTheme}><ThemeIcon size={19} /></IconButton>
          </div>
        </header>

        <section className="dashboard-hero">
          <div className="welcome-copy">
            <span className="live-badge"><i /> {pick(locale, "وضع تلقائي", "Auto mode")}</span>
            <h2>{pick(locale, "مساحة عمل واحدة للتدريب والتغذية والتعافي", "One command center for training, nutrition, and recovery")}</h2>
            <p>{t.subtitle}</p>
            <div className="cta-row">
              <button className="primary-cta" onClick={() => setActiveTab("workout")} type="button"><span>{t.start}</span><b><ArrowIcon size={18} /></b></button>
              <button className="secondary-cta" onClick={() => setActiveTab("progress")} type="button">{pick(locale, "راجع التقدم", "Review progress")}</button>
            </div>
          </div>
          <GlassCard className="hero-focus-panel">
            <span>{t.sections.active}</span>
            <strong>{pick(locale, "قوة علوية + كور", "Upper strength + core")}</strong>
            <p>{pick(locale, "3 تمارين متبقية، راحة محسوبة، وتوقع رقم شخصي في البنش.", "3 exercises left, timed rest, and a bench PR is in range.")}</p>
            <ProgressRing value={72} label={pick(locale, "تقدم", "Progress")} />
          </GlassCard>
        </section>

        <div className="desktop-tabs" role="tablist" aria-label={pick(locale, "أقسام التطبيق", "App sections")}>
          {tabs.map(({ id, icon: Icon }) => <button aria-selected={activeTab === id} className={activeTab === id ? "active" : ""} key={id} onClick={() => setActiveTab(id)} role="tab" type="button"><Icon size={16} />{t.tabs[id]}</button>)}
        </div>

        <div className="content-grid">
          <section className={activeTab === "home" ? "screen active dashboard-overview" : "screen"}>
            <GlassCard className="health-card">
              <div className="section-heading"><span>{t.sections.health}</span><button onClick={() => setActiveTab("settings")} type="button"><Plus size={16} />{t.quickAdd}</button></div>
              <div className="stat-chip-row">
                {healthStats.map(({ icon: Icon, labelAr, labelEn, value, unitAr, unitEn }) => <article key={labelEn}><Icon size={18} /><strong>{value}</strong><span>{pick(locale, labelAr, labelEn)} · {pick(locale, unitAr, unitEn)}</span></article>)}
              </div>
            </GlassCard>
            <GlassCard className="active-task">
              <div><span className="eyebrow">{t.sections.active}</span><h3>{pick(locale, "جلسة مدتها 52 دقيقة", "52 minute session")}</h3><p>{pick(locale, "الراحة محسوبة تلقائيا، والوزن القادم مقترح من آخر أداء.", "Rest is timed automatically and the next load is based on recent performance.")}</p></div>
              <ProgressRing value={72} label={pick(locale, "جاهز", "Ready")} />
            </GlassCard>
            <div className="task-strip" aria-label={t.sections.previous}>
              {previousTasks.map((task) => <GlassCard as="article" className="mini-task" key={task.labelEn}><ProgressRing value={task.value} label={pick(locale, task.noteAr, task.noteEn)} /><strong>{pick(locale, task.labelAr, task.labelEn)}</strong></GlassCard>)}
            </div>
          </section>

          <section className={activeTab === "workout" ? "screen active" : "screen"}>
            <GlassCard className="workout-card"><div className="section-heading"><span>{t.sections.workout}</span><button onClick={() => setRunning((value) => !value)} type="button"><TimerReset size={16} />{timerLabel}</button></div><div className="exercise-list">{workoutExercises.map((exercise) => <article key={exercise.nameEn} className={exercise.pr ? "pr-row" : ""}><div><strong>{pick(locale, exercise.nameAr, exercise.nameEn)}</strong><span>{exercise.sets} × {exercise.reps} · {exercise.rest} {pick(locale, "ث", "s")}</span></div><label><span>{pick(locale, "كجم", "kg")}</span><input inputMode="decimal" defaultValue={exercise.weight || ""} aria-label={pick(locale, exercise.nameAr, exercise.nameEn)} /></label></article>)}</div></GlassCard>
          </section>

          <section className={activeTab === "tracking" ? "screen active" : "screen"}>
            <GlassCard className="tracking-card"><div className="section-heading"><span>{t.sections.tracking}</span><Toggle checked={smartTracking} onChange={() => setSmartTracking((v) => !v)} label={t.smart} /></div><SemiGauge value={84} label={pick(locale, "مباشر", "LIVE")} ariaLabel={pick(locale, "التتبع", "Tracking")} /><div className="metric-grid">{trackingMetrics.map(({ icon: Icon, labelAr, labelEn, value }) => <article key={labelEn}><Icon size={18} /><span>{pick(locale, labelAr, labelEn)}</span><strong>{formatTrackingValue(locale, value)}</strong></article>)}</div></GlassCard>
          </section>

          <section className={activeTab === "nutrition" ? "screen active" : "screen"}>
            <GlassCard className="nutrition-card"><ProgressRing value={76} label={pick(locale, "سعرات", "Calories")} /><div className="nutrition-main"><span className="eyebrow">{t.sections.nutrition}</span><h3>1,940 / 2,540 {pick(locale, "سعرة", "kcal")}</h3><div className="macro-bars"><span style={{ "--w": "68%" } as CSSProperties}>{pick(locale, "بروتين", "Protein")} 158g</span><span style={{ "--w": "76%" } as CSSProperties}>{pick(locale, "كارب", "Carbs")} 220g</span><span style={{ "--w": "42%" } as CSSProperties}>{pick(locale, "دهون", "Fat")} 61g</span></div></div><div className="meal-log">{meals.map(({ icon: Icon, labelAr, labelEn, kcal, macros }) => <article key={labelEn}><Icon size={18} /><div><strong>{pick(locale, labelAr, labelEn)}</strong><span>{locale === "ar" ? macros.replace("P", "ب").replace("C", "ك").replace("F", "د") : macros}</span></div><b>{kcal} {pick(locale, "سعرة", "kcal")}</b></article>)}</div></GlassCard>
          </section>

          <section className={activeTab === "hydration" ? "screen active" : "screen"}>
            <GlassCard className="hydration-card"><div className="water-visual" style={{ "--fill": `${waterPct}%` } as CSSProperties}><Droplets size={34} /><strong>{waterPct}%</strong></div><div><span className="eyebrow">{t.sections.hydration}</span><h3>{waterMl} / 2800 {pick(locale, "مل", "ml")}</h3><p>{pick(locale, "التذكير القادم 5:30 مساء، مع وقف الإشعارات أثناء الهدوء.", "Next reminder 5:30 PM, quiet hours respected.")}</p><div className="quick-buttons"><button onClick={() => setWaterMl((v) => Math.min(2800, v + 250))} type="button">+250 {pick(locale, "مل", "ml")}</button><button onClick={() => setWaterMl((v) => Math.min(2800, v + 500))} type="button">+500 {pick(locale, "مل", "ml")}</button></div></div></GlassCard>
          </section>

          <section className={activeTab === "supplements" ? "screen active" : "screen"}>
            <GlassCard className="checklist-card"><div className="section-heading"><span>{t.sections.supplements}</span><span className="live-badge"><i /> 2/3</span></div>{supplements.map((item, index) => <button className="check-row" key={item.labelEn} onClick={() => setCheckedSupplements((list) => list.map((v, i) => (i === index ? !v : v)))} type="button"><span data-checked={checkedSupplements[index]} /><div><strong>{pick(locale, item.labelAr, item.labelEn)}</strong><small>{formatDose(locale, item.dose)} · {pick(locale, item.timeAr, item.timeEn)}</small></div></button>)}</GlassCard>
          </section>

          <section className={activeTab === "progress" ? "screen active" : "screen"}>
            <GlassCard className="progress-card"><div className="section-heading"><span>{t.sections.progress}</span><Trophy size={18} /></div>{progressRows.map((row) => <article className="progress-row" key={row.labelEn}><div><strong>{pick(locale, row.labelAr, row.labelEn)}</strong><span>{pick(locale, row.changeAr, row.changeEn)}</span></div><b>{formatMetricValue(locale, row.value)}</b><i style={{ "--w": `${row.valuePct}%` } as CSSProperties} /></article>)}</GlassCard>
          </section>

          <section className={activeTab === "settings" ? "screen active" : "screen"}>
            <GlassCard className="settings-card"><div className="section-heading"><span>{t.sections.settings}</span><button onClick={cycleTheme} type="button">{pick(locale, theme === "dark" ? "داكن" : theme === "light" ? "فاتح" : "النظام", theme === "dark" ? "Dark" : theme === "light" ? "Light" : "System")}</button></div>{reminders.map(({ icon: Icon, labelAr, labelEn }, index) => <div className="setting-row" key={labelEn}><Icon size={18} /><span>{pick(locale, labelAr, labelEn)}</span><Toggle checked={reminderStates[index]} onChange={() => setReminderStates((list) => list.map((value, i) => (i === index ? !value : value)))} label="" /></div>)}<button className="install-cue" type="button">{pick(locale, "تثبيت دبابة على الشاشة الرئيسية", "Install Dababa to home screen")}</button></GlassCard>
          </section>
        </div>
      </div>

      <nav className="bottom-nav" aria-label={pick(locale, "تنقل الهاتف", "Mobile navigation")}>
        {tabs.map(({ id, icon: Icon }) => <button className={activeTab === id ? "active" : ""} key={id} onClick={() => setActiveTab(id)} type="button"><Icon size={19} /><span>{t.tabs[id]}</span></button>)}
      </nav>
    </main>
  );
}



