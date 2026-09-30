"use client";

import Image from "next/image";
import { type FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Bell,
  ChevronUp,
  Dumbbell,
  Droplets,
  Gauge,
  Home,
  Languages,
  Moon,
  Plus,
  Salad,
  Settings,
  Shield,
  Sun,
  TimerReset,
  Trophy,
  LogOut,
  Waves
} from "lucide-react";
import { GlassCard, IconButton, ProgressRing, SemiGauge, Toggle } from "@/components/ui/primitives";
import {
  adminStats,
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
import type { User } from "@supabase/supabase-js";

type ThemeChoice = "dark" | "light" | "system";
type AuthMode = "signin" | "signup";
type Tab = "home" | "workout" | "tracking" | "nutrition" | "hydration" | "supplements" | "progress" | "settings" | "admin";

const tabs: { id: Tab; icon: typeof Home }[] = [
  { id: "home", icon: Home },
  { id: "workout", icon: Dumbbell },
  { id: "tracking", icon: Gauge },
  { id: "nutrition", icon: Salad },
  { id: "hydration", icon: Droplets },
  { id: "supplements", icon: Bell },
  { id: "progress", icon: Trophy },
  { id: "settings", icon: Settings },
  { id: "admin", icon: Shield }
];

const pick = (locale: Locale, ar: string, en: string) => (locale === "ar" ? ar : en);
const formatTrackingValue = (locale: Locale, value: string) => {
  if (locale === "en") return value;
  return value.replace("km", "كم").replace("bpm", "نبضة/د");
};

const formatDose = (locale: Locale, dose: string) => {
  if (locale === "en") return dose;
  return dose.replace("mg", "مجم").replace("g", "جم").replace("IU", "وحدة");
};

const formatMetricValue = (locale: Locale, value: string) => {
  if (locale === "en") return value;
  return value.replace("kg", "كجم").replace("cm", "سم");
};

export function DababaShell() {
  const [locale, setLocale] = useState<Locale>("ar");
  const [activeTab, setActiveTab] = useState<Tab>("home");
  const [theme, setTheme] = useState<ThemeChoice>("dark");
  const [smartTracking, setSmartTracking] = useState(true);
  const [waterMl, setWaterMl] = useState(1800);
  const [timer, setTimer] = useState(90);
  const [running, setRunning] = useState(false);
  const [checkedSupplements, setCheckedSupplements] = useState<boolean[]>(supplements.map((item) => item.done));
  const [reminderStates, setReminderStates] = useState<boolean[]>(reminders.map((item) => item.enabled));
  const [authMode, setAuthMode] = useState<AuthMode>("signup");
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [assessmentDraftId, setAssessmentDraftId] = useState<string | null>(null);
  const [authMessage, setAuthMessage] = useState<string | null>(null);
  const [authBusy, setAuthBusy] = useState(false);
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

  const ensureUserWorkspace = useCallback(async (user: User) => {
    const supabase = createSupabaseBrowserClient();
    const fallbackName = user.email?.split("@")[0] || "Dababa athlete";
    const safeName = displayName.trim() || fallbackName;

    const profileResult = await supabase.from("profiles").upsert(
      {
        id: user.id,
        display_name: safeName,
        locale,
        unit_system: "metric",
        theme
      },
      { onConflict: "id" }
    );

    if (profileResult.error) throw profileResult.error;

    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "Africa/Cairo";
    const prefsResult = await supabase.from("notification_prefs").upsert(
      {
        user_id: user.id,
        timezone
      },
      { onConflict: "user_id" }
    );

    if (prefsResult.error) throw prefsResult.error;

    const existingDraft = await supabase
      .from("health_assessments")
      .select("id")
      .eq("user_id", user.id)
      .eq("status", "draft")
      .maybeSingle();

    if (existingDraft.error) throw existingDraft.error;

    if (existingDraft.data?.id) {
      setAssessmentDraftId(existingDraft.data.id);
      return;
    }

    const draftResult = await supabase
      .from("health_assessments")
      .insert({
        user_id: user.id,
        status: "draft",
        answers: {
          source: "onboarding_welcome",
          locale,
          preferred_goal: "lean_gain"
        }
      })
      .select("id")
      .single();

    if (draftResult.error) throw draftResult.error;
    setAssessmentDraftId(draftResult.data.id);
  }, [displayName, locale, theme]);

  useEffect(() => {
    let active = true;
    const supabase = createSupabaseBrowserClient();

    supabase.auth
      .getSession()
      .then(async ({ data }) => {
        if (!active) return;
        const currentUser = data.session?.user ?? null;
        setUserEmail(currentUser?.email ?? null);
        if (currentUser) await ensureUserWorkspace(currentUser);
      })
      .catch(() => {
        if (active) setAuthMessage(pick(locale, "تعذر قراءة جلسة الدخول.", "Could not read the auth session."));
      });

    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange((_event, session) => {
      const currentUser = session?.user ?? null;
      setUserEmail(currentUser?.email ?? null);
      if (!currentUser) setAssessmentDraftId(null);
      if (currentUser) {
        ensureUserWorkspace(currentUser).catch(() => {
          setAuthMessage(pick(locale, "تم الدخول، لكن تعذر تجهيز ملفك.", "Signed in, but workspace setup failed."));
        });
      }
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [ensureUserWorkspace, locale]);

  async function handleAuthSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAuthBusy(true);
    setAuthMessage(null);

    try {
      const supabase = createSupabaseBrowserClient();
      const email = authEmail.trim().toLowerCase();
      const password = authPassword;

      const result = authMode === "signup"
        ? await supabase.auth.signUp({
            email,
            password,
            options: {
              data: {
                display_name: displayName.trim() || email.split("@")[0]
              }
            }
          })
        : await supabase.auth.signInWithPassword({ email, password });

      if (result.error) throw result.error;

      if (result.data.session?.user) {
        await ensureUserWorkspace(result.data.session.user);
        setUserEmail(result.data.session.user.email ?? email);
        setAuthMessage(pick(locale, "تم تجهيز حسابك وبدء تقييمك.", "Your account is ready and assessment is started."));
      } else {
        setAuthMessage(pick(locale, "راجع بريدك لتأكيد الحساب ثم سجل الدخول.", "Check your email to confirm the account, then sign in."));
      }
    } catch {
      setAuthMessage(pick(locale, "تعذر إتمام العملية. تأكد من البريد وكلمة المرور.", "Could not complete the request. Check email and password."));
    } finally {
      setAuthBusy(false);
    }
  }

  async function handleSignOut() {
    setAuthBusy(true);
    setAuthMessage(null);

    try {
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      setUserEmail(null);
      setAssessmentDraftId(null);
      setAuthMessage(pick(locale, "تم تسجيل الخروج.", "Signed out."));
    } catch {
      setAuthMessage(pick(locale, "تعذر تسجيل الخروج الآن.", "Could not sign out right now."));
    } finally {
      setAuthBusy(false);
    }
  }
  const themeIcon = theme === "dark" ? Moon : theme === "light" ? Sun : Waves;
  const ThemeIcon = themeIcon;
  const visibleTabs = tabs;
  const waterPct = Math.min(100, Math.round((waterMl / 2800) * 100));
  const caloriesPct = 76;
  const ArrowIcon = isRtl ? ArrowLeft : ArrowRight;
  const timerLabel = useMemo(() => `${Math.floor(timer / 60)}:${String(timer % 60).padStart(2, "0")}`, [timer]);

  function cycleTheme() {
    setTheme((current) => (current === "dark" ? "light" : current === "light" ? "system" : "dark"));
  }

  return (
    <main className="app-shell">
      <div className="background-layer" aria-hidden="true">
        <Image src="/images/athletic-backdrop.png" alt="" fill priority sizes="100vw" />
      </div>
      <aside className="side-rail" aria-label="Primary">
        <div className="brand-mark">D</div>
        {tabs.map(({ id, icon: Icon }) => (
          <button
            aria-label={t.tabs[id]}
            className={activeTab === id ? "active" : ""}
            key={id}
            onClick={() => setActiveTab(id)}
            type="button"
          >
            <Icon size={19} />
            <span>{t.tabs[id]}</span>
          </button>
        ))}
      </aside>

      <div className="app-frame">
        <header className="topbar">
          <div>
            <span className="eyebrow">{t.appName} / PWA</span>
            <h1>{t.greeting}</h1>
          </div>
          <div className="header-actions">
            <IconButton aria-label={t.language} onClick={() => setLocale((current) => (current === "ar" ? "en" : "ar"))}>
              <Languages size={19} />
            </IconButton>
            <IconButton aria-label={t.theme} onClick={cycleTheme}>
              <ThemeIcon size={19} />
            </IconButton>
          </div>
        </header>

        <section className="hero-band">
          <div className="welcome-copy">
            <span className="live-badge"><i /> {pick(locale, "وضع تلقائي", "Auto mode")}</span>
            <h2>{locale === "ar" ? "تدريبك اليوم يبدأ من هنا" : "Your training day starts here"}</h2>
            <p>{t.subtitle}</p>
            <div className="cta-row">
              <button className="primary-cta" onClick={() => setActiveTab("workout")} type="button">
                <span>{t.start}</span>
                <b><ArrowIcon size={18} /></b>
              </button>
              <button className="secondary-cta" onClick={() => setAuthMode("signin")} type="button">{t.login}</button>
            </div>
          </div>
          <GlassCard className="onboarding-sheet auth-sheet">
            <div className="sheet-handle" />
            {userEmail ? (
              <div className="auth-summary">
                <p>{pick(locale, "الحساب متصل", "Account connected")}</p>
                <strong>{userEmail}</strong>
                <span>{assessmentDraftId ? pick(locale, "مسودة التقييم جاهزة", "Assessment draft ready") : pick(locale, "نجهز تقييمك الآن", "Preparing your assessment")}</span>
                <div className="auth-actions">
                  <button onClick={() => setActiveTab("progress")} type="button">
                    {pick(locale, "راجع الخطة", "Review plan")} <ChevronUp size={17} />
                  </button>
                  <button onClick={handleSignOut} type="button" disabled={authBusy}>
                    <LogOut size={16} /> {pick(locale, "خروج", "Sign out")}
                  </button>
                </div>
              </div>
            ) : (
              <form className="auth-form" onSubmit={handleAuthSubmit}>
                <p>{authMode === "signup" ? pick(locale, "ابدأ حسابك", "Start your account") : pick(locale, "ادخل لحسابك", "Sign in")}</p>
                <strong>{pick(locale, "احفظ تقييمك وخطتك على Supabase", "Save your assessment and plan on Supabase")}</strong>
                <div className="auth-mode" role="group" aria-label={pick(locale, "اختيار الدخول", "Auth mode")}> 
                  <button className={authMode === "signup" ? "active" : ""} onClick={() => setAuthMode("signup")} type="button">
                    {pick(locale, "تسجيل جديد", "Sign up")}
                  </button>
                  <button className={authMode === "signin" ? "active" : ""} onClick={() => setAuthMode("signin")} type="button">
                    {pick(locale, "دخول", "Sign in")}
                  </button>
                </div>
                {authMode === "signup" ? (
                  <label>
                    <span>{pick(locale, "الاسم", "Name")}</span>
                    <input autoComplete="name" value={displayName} onChange={(event) => setDisplayName(event.target.value)} placeholder={pick(locale, "اسمك", "Your name")} />
                  </label>
                ) : null}
                <label>
                  <span>{pick(locale, "البريد", "Email")}</span>
                  <input autoComplete="email" inputMode="email" required type="email" value={authEmail} onChange={(event) => setAuthEmail(event.target.value)} placeholder="you@example.com" />
                </label>
                <label>
                  <span>{pick(locale, "كلمة المرور", "Password")}</span>
                  <input autoComplete={authMode === "signup" ? "new-password" : "current-password"} minLength={6} required type="password" value={authPassword} onChange={(event) => setAuthPassword(event.target.value)} placeholder="••••••••" />
                </label>
                <button className="auth-submit" disabled={authBusy} type="submit">
                  {authBusy ? pick(locale, "جار التنفيذ", "Working") : authMode === "signup" ? pick(locale, "إنشاء الحساب", "Create account") : pick(locale, "تسجيل الدخول", "Sign in")}
                </button>
                {authMessage ? <span className="auth-message">{authMessage}</span> : null}
              </form>
            )}
          </GlassCard>
        </section>

        <div className="content-grid">
          <section className={activeTab === "home" ? "screen active" : "screen"}>
            <GlassCard className="health-card">
              <div className="section-heading">
                <span>{t.sections.health}</span>
                <button onClick={() => setActiveTab("settings")} type="button"><Plus size={16} />{t.quickAdd}</button>
              </div>
              <div className="stat-chip-row">
                {healthStats.map(({ icon: Icon, labelAr, labelEn, value, unitAr, unitEn }) => (
                  <article key={labelEn}>
                    <Icon size={18} />
                    <strong>{value}</strong>
                    <span>{pick(locale, labelAr, labelEn)} · {pick(locale, unitAr, unitEn)}</span>
                  </article>
                ))}
              </div>
            </GlassCard>
            <GlassCard className="active-task">
              <div>
                <span className="eyebrow">{t.sections.active}</span>
                <h3>{locale === "ar" ? "قوة علوية + كور" : "Upper strength + core"}</h3>
                <p>{locale === "ar" ? "3 تمارين متبقية، راحة محسوبة، وتوقع PR في البنش." : "3 exercises left, timed rest, and a bench PR is in range."}</p>
              </div>
              <ProgressRing value={72} label={locale === "ar" ? "تقدم" : "Progress"} />
            </GlassCard>
            <div className="task-strip" aria-label={t.sections.previous}>
              {previousTasks.map((task) => (
                <GlassCard as="article" className="mini-task" key={task.labelEn}>
                  <ProgressRing value={task.value} label={pick(locale, task.noteAr, task.noteEn)} />
                  <strong>{pick(locale, task.labelAr, task.labelEn)}</strong>
                </GlassCard>
              ))}
            </div>
          </section>

          <section className={activeTab === "workout" ? "screen active" : "screen"}>
            <GlassCard className="workout-card">
              <div className="section-heading">
                <span>{t.sections.workout}</span>
                <button onClick={() => setRunning((value) => !value)} type="button"><TimerReset size={16} />{timerLabel}</button>
              </div>
              <div className="exercise-list">
                {workoutExercises.map((exercise) => (
                  <article key={exercise.nameEn} className={exercise.pr ? "pr-row" : ""}>
                    <div>
                      <strong>{pick(locale, exercise.nameAr, exercise.nameEn)}</strong>
                      <span>{exercise.sets} × {exercise.reps} · {exercise.rest} {pick(locale, "ث", "s")}</span>
                    </div>
                    <label>
                      <span>{pick(locale, "كجم", "kg")}</span>
                      <input inputMode="decimal" defaultValue={exercise.weight || ""} aria-label={pick(locale, exercise.nameAr, exercise.nameEn)} />
                    </label>
                  </article>
                ))}
              </div>
            </GlassCard>
          </section>

          <section className={activeTab === "tracking" ? "screen active" : "screen"}>
            <GlassCard className="tracking-card">
              <div className="section-heading"><span>{t.sections.tracking}</span><Toggle checked={smartTracking} onChange={() => setSmartTracking((v) => !v)} label={t.smart} /></div>
              <SemiGauge value={84} label={pick(locale, "مباشر", "LIVE")} ariaLabel={pick(locale, "التتبع", "Tracking")} />
              <div className="metric-grid">
                {trackingMetrics.map(({ icon: Icon, labelAr, labelEn, value }) => (
                  <article key={labelEn}><Icon size={18} /><span>{pick(locale, labelAr, labelEn)}</span><strong>{formatTrackingValue(locale, value)}</strong></article>
                ))}
              </div>
            </GlassCard>
          </section>

          <section className={activeTab === "nutrition" ? "screen active" : "screen"}>
            <GlassCard className="nutrition-card">
              <ProgressRing value={caloriesPct} label={locale === "ar" ? "سعرات" : "Calories"} />
              <div className="nutrition-main">
                <span className="eyebrow">{t.sections.nutrition}</span>
                <h3>1,940 / 2,540 {pick(locale, "سعرة", "kcal")}</h3>
                <div className="macro-bars">
                  <span style={{ "--w": "68%" } as React.CSSProperties}>{pick(locale, "بروتين", "Protein")} 158g</span>
                  <span style={{ "--w": "76%" } as React.CSSProperties}>{pick(locale, "كارب", "Carbs")} 220g</span>
                  <span style={{ "--w": "42%" } as React.CSSProperties}>{pick(locale, "دهون", "Fat")} 61g</span>
                </div>
              </div>
              <div className="meal-log">
                {meals.map(({ icon: Icon, labelAr, labelEn, kcal, macros }) => (
                  <article key={labelEn}>
                    <Icon size={18} />
                    <div>
                      <strong>{pick(locale, labelAr, labelEn)}</strong>
                      <span>{locale === "ar" ? macros.replace("P", "ب").replace("C", "ك").replace("F", "د") : macros}</span>
                    </div>
                    <b>{kcal} {pick(locale, "سعرة", "kcal")}</b>
                  </article>
                ))}
              </div>
            </GlassCard>
          </section>

          <section className={activeTab === "hydration" ? "screen active" : "screen"}>
            <GlassCard className="hydration-card">
              <div className="water-visual" style={{ "--fill": `${waterPct}%` } as React.CSSProperties}><Droplets size={34} /><strong>{waterPct}%</strong></div>
              <div>
                <span className="eyebrow">{t.sections.hydration}</span>
                <h3>{waterMl} / 2800 {pick(locale, "مل", "ml")}</h3>
                <p>{locale === "ar" ? "التذكير القادم 5:30 مساء، مع وقف الإشعارات أثناء الهدوء." : "Next reminder 5:30 PM, quiet hours respected."}</p>
                <div className="quick-buttons">
                  <button onClick={() => setWaterMl((v) => Math.min(2800, v + 250))} type="button">+250 {pick(locale, "مل", "ml")}</button>
                  <button onClick={() => setWaterMl((v) => Math.min(2800, v + 500))} type="button">+500 {pick(locale, "مل", "ml")}</button>
                </div>
              </div>
            </GlassCard>
          </section>

          <section className={activeTab === "supplements" ? "screen active" : "screen"}>
            <GlassCard className="checklist-card">
              <div className="section-heading"><span>{t.sections.supplements}</span><span className="live-badge"><i /> 2/3</span></div>
              {supplements.map((item, index) => (
                <button className="check-row" key={item.labelEn} onClick={() => setCheckedSupplements((list) => list.map((v, i) => (i === index ? !v : v)))} type="button">
                  <span data-checked={checkedSupplements[index]} />
                  <div><strong>{pick(locale, item.labelAr, item.labelEn)}</strong><small>{formatDose(locale, item.dose)} · {pick(locale, item.timeAr, item.timeEn)}</small></div>
                </button>
              ))}
            </GlassCard>
          </section>

          <section className={activeTab === "progress" ? "screen active" : "screen"}>
            <GlassCard className="progress-card">
              <div className="section-heading"><span>{t.sections.progress}</span><Trophy size={18} /></div>
              {progressRows.map((row) => (
                <article className="progress-row" key={row.labelEn}>
                  <div><strong>{pick(locale, row.labelAr, row.labelEn)}</strong><span>{pick(locale, row.changeAr, row.changeEn)}</span></div>
                  <b>{formatMetricValue(locale, row.value)}</b>
                  <i style={{ "--w": `${row.valuePct}%` } as React.CSSProperties} />
                </article>
              ))}
            </GlassCard>
          </section>

          <section className={activeTab === "settings" ? "screen active" : "screen"}>
            <GlassCard className="settings-card">
              <div className="section-heading">
                <span>{t.sections.settings}</span>
                <button onClick={cycleTheme} type="button">
                  {pick(
                    locale,
                    theme === "dark" ? "داكن" : theme === "light" ? "فاتح" : "النظام",
                    theme === "dark" ? "Dark" : theme === "light" ? "Light" : "System"
                  )}
                </button>
              </div>
              {reminders.map(({ icon: Icon, labelAr, labelEn }, index) => (
                <div className="setting-row" key={labelEn}>
                  <Icon size={18} />
                  <span>{pick(locale, labelAr, labelEn)}</span>
                  <Toggle
                    checked={reminderStates[index]}
                    onChange={() => setReminderStates((list) => list.map((value, i) => (i === index ? !value : value)))}
                    label=""
                  />
                </div>
              ))}
              <button className="install-cue" type="button">{locale === "ar" ? "تثبيت دبابة على الشاشة الرئيسية" : "Install Dababa to home screen"}</button>
            </GlassCard>
          </section>

          <section className={activeTab === "admin" ? "screen active" : "screen"}>
            <GlassCard className="admin-card">
              <div className="section-heading"><span>{t.sections.admin}</span><span className="eyebrow">{pick(locale, "قراءة فقط", "Read-only")}</span></div>
              <div className="admin-grid">
                {adminStats.map(({ icon: Icon, labelAr, labelEn, value }) => (
                  <article key={labelEn}><Icon size={18} /><span>{pick(locale, labelAr, labelEn)}</span><strong>{value}</strong></article>
                ))}
              </div>
              <table>
                <tbody>
                  <tr>
                    <td>{pick(locale, "حصة الذكاء الاصطناعي", "AI quota")}</td>
                    <td>82%</td>
                    <td>{pick(locale, "طبيعي", "normal")}</td>
                  </tr>
                  <tr>
                    <td>{pick(locale, "طابور الإرسال", "Broadcast queue")}</td>
                    <td>14</td>
                    <td>{pick(locale, "مجدول", "scheduled")}</td>
                  </tr>
                  <tr>
                    <td>{pick(locale, "مراجعة التدقيق", "Audit review")}</td>
                    <td>6</td>
                    <td>{pick(locale, "يحتاج انتباه", "attention")}</td>
                  </tr>
                </tbody>
              </table>
            </GlassCard>
          </section>
        </div>
      </div>

      <nav className="bottom-nav" aria-label="Mobile primary">
        {visibleTabs.map(({ id, icon: Icon }) => (
          <button className={activeTab === id ? "active" : ""} key={id} onClick={() => setActiveTab(id)} type="button">
            <Icon size={19} />
            <span>{t.tabs[id]}</span>
          </button>
        ))}
      </nav>
    </main>
  );
}










