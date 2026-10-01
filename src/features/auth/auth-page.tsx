"use client";

import Link from "next/link";
import { type FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, CheckCircle2, Dumbbell, Eye, EyeOff, Languages, Loader2, LockKeyhole, Mail, ShieldCheck, Sparkles, UserRound } from "lucide-react";
import type { User } from "@supabase/supabase-js";
import { GlassCard } from "@/components/ui/primitives";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { copy, type Locale } from "@/lib/translations";

type AuthEntry = "welcome" | "signin" | "method" | "signup";
type ThemeChoice = "dark" | "light" | "system";
type SignupStep = 0 | 1 | 2 | 3 | 4;
type SetupStage = 0 | 1 | 2 | 3;

type AthleteSignup = {
  displayName: string;
  email: string;
  gender: string;
  username: string;
  heightCm: string;
  birthDate: string;
  weightKg: string;
  activityLevel: string;
  trainingDays: string;
  workoutDuration: string;
  experience: string;
  goal: string;
  goalDurationWeeks: string;
  clubCode: string;
  notSubscribed: boolean;
  password: string;
  confirmPassword: string;
};

const initialSignup: AthleteSignup = {
  displayName: "",
  email: "",
  gender: "male",
  username: "",
  heightCm: "",
  birthDate: "",
  weightKg: "",
  activityLevel: "moderate",
  trainingDays: "3",
  workoutDuration: "60",
  experience: "beginner",
  goal: "build_muscle",
  goalDurationWeeks: "12",
  clubCode: "",
  notSubscribed: true,
  password: "",
  confirmPassword: ""
};

const pick = (locale: Locale, ar: string, en: string) => (locale === "ar" ? ar : en);
const cleanCode = (value: string) => value.trim().replace(/[^a-zA-Z0-9]/g, "").toUpperCase();

export function AuthPage() {
  const [locale, setLocale] = useState<Locale>("ar");
  const [theme] = useState<ThemeChoice>(() => {
    if (typeof window === "undefined") return "dark";
    return (localStorage.getItem("dababa-theme") as ThemeChoice | null) ?? "dark";
  });
  const [entryStep, setEntryStep] = useState<AuthEntry>("welcome");
  const [signinEmail, setSigninEmail] = useState("");
  const [signinPassword, setSigninPassword] = useState("");
  const [signup, setSignup] = useState<AthleteSignup>(initialSignup);
  const [signupStep, setSignupStep] = useState<SignupStep>(0);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [authMessage, setAuthMessage] = useState<string | null>(null);
  const [authBusy, setAuthBusy] = useState(false);
  const [setupLoading, setSetupLoading] = useState(false);
  const [setupStage, setSetupStage] = useState<SetupStage>(0);
  const [setupSuccess, setSetupSuccess] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [googleUser, setGoogleUser] = useState<User | null>(null);
  const [assessmentDraftId, setAssessmentDraftId] = useState<string | null>(null);
  const t = copy[locale];
  const isRtl = locale === "ar";
  const ArrowIcon = isRtl ? ArrowLeft : ArrowRight;

  const steps = useMemo(() => [
    pick(locale, "الأساسيات", "Basics"),
    pick(locale, "القياسات", "Body"),
    pick(locale, "التدريب", "Training"),
    pick(locale, "النادي", "Gym"),
    pick(locale, googleUser ? "التأكيد" : "الأمان", googleUser ? "Confirm" : "Security")
  ], [googleUser, locale]);

  const setupStages = useMemo(() => [
    pick(locale, "جاري إعداد حسابك", "Preparing your account"),
    pick(locale, "تم تحديد هدفك", "Your goal is selected"),
    pick(locale, "تم حساب سعراتك", "Your calories are calculated"),
    pick(locale, "تم اقتراح جدول تمريني", "Your training schedule is suggested")
  ], [locale]);

  useEffect(() => {
    document.documentElement.lang = locale;
    document.documentElement.dir = isRtl ? "rtl" : "ltr";
  }, [isRtl, locale]);

  useEffect(() => {
    const systemTheme = window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
    document.documentElement.dataset.theme = theme === "system" ? systemTheme : theme;
  }, [theme]);

  const updateSignup = (field: keyof AthleteSignup, value: string | boolean) => {
    setSignup((current) => ({ ...current, [field]: value }));
  };

  const ensureUserWorkspace = useCallback(async (user: User, data: AthleteSignup) => {
    const supabase = createSupabaseBrowserClient();
    const fallbackName = user.email?.split("@")[0] || "Dababa athlete";
    const safeName = data.displayName.trim() || fallbackName;

    const profileResult = await supabase.from("profiles").upsert({ id: user.id, display_name: safeName, locale, unit_system: "metric", theme }, { onConflict: "id" });
    if (profileResult.error) throw profileResult.error;

    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "Africa/Cairo";
    const prefsResult = await supabase.from("notification_prefs").upsert({ user_id: user.id, timezone }, { onConflict: "user_id" });
    if (prefsResult.error) throw prefsResult.error;

    const answers = {
      source: "athlete_onboarding",
      locale,
      identity: {
        name: safeName,
        email: user.email ?? data.email.trim().toLowerCase(),
        gender: data.gender,
        username: data.username.trim()
      },
      body: {
        height_cm: Number(data.heightCm) || null,
        birth_date: data.birthDate || null,
        weight_kg: Number(data.weightKg) || null
      },
      training: {
        activity_level: data.activityLevel,
        training_days_per_week: Number(data.trainingDays) || null,
        workout_duration_minutes: Number(data.workoutDuration) || null,
        experience: data.experience,
        goal: data.goal,
        goal_duration_weeks: Number(data.goalDurationWeeks) || null
      },
      gym: {
        has_subscription_code: !data.notSubscribed && Boolean(cleanCode(data.clubCode)),
        not_subscribed: data.notSubscribed
      }
    };

    const existingDraft = await supabase.from("health_assessments").select("id").eq("user_id", user.id).eq("status", "draft").maybeSingle();
    if (existingDraft.error) throw existingDraft.error;

    if (existingDraft.data?.id) {
      const updateDraft = await supabase.from("health_assessments").update({ answers }).eq("id", existingDraft.data.id);
      if (updateDraft.error) throw updateDraft.error;
      setAssessmentDraftId(existingDraft.data.id);
    } else {
      const draftResult = await supabase.from("health_assessments").insert({ user_id: user.id, status: "draft", answers }).select("id").single();
      if (draftResult.error) throw draftResult.error;
      setAssessmentDraftId(draftResult.data.id);
    }

    if (!data.notSubscribed && cleanCode(data.clubCode)) {
      const claimResult = await supabase.rpc("claim_athlete_access_code", { raw_code: cleanCode(data.clubCode) });
      if (claimResult.error) throw claimResult.error;
    }
  }, [locale, theme]);

  useEffect(() => {
    let active = true;
    const supabase = createSupabaseBrowserClient();

    async function syncAuthSession() {
      const currentUrl = new URL(window.location.href);
      const authStatus = currentUrl.searchParams.get("auth_status");
      const authError = currentUrl.searchParams.get("auth_error") || currentUrl.searchParams.get("error_description") || currentUrl.searchParams.get("error");

      if (authError) {
        setAuthMessage(pick(locale, "تعذر إكمال الدخول عبر Google. راجع إعدادات Callback ثم جرّب مرة أخرى.", "Could not complete Google sign-in. Check the callback settings and try again."));
        window.history.replaceState({}, "", "/auth");
        return;
      }

      try {
        const { data, error } = await supabase.auth.getSession();
        if (error) throw error;
        if (!active) return;
        const currentUser = data.session?.user ?? null;
        if (currentUser) {
          setGoogleUser(currentUser);
          setUserEmail(currentUser.email ?? null);
          setSignup((current) => ({
            ...current,
            email: currentUser.email ?? current.email,
            displayName: current.displayName || String(currentUser.user_metadata?.display_name ?? currentUser.user_metadata?.full_name ?? "")
          }));
          setEntryStep("signup");
          if (authStatus === "google_connected") setAuthMessage(pick(locale, "الحساب متصل. كمّل بيانات اللاعب.", "Account connected. Complete the athlete profile."));
        }
        if (authStatus) window.history.replaceState({}, "", "/auth");
      } catch {
        if (active) setAuthMessage(pick(locale, "تعذر قراءة جلسة الدخول.", "Could not read the auth session."));
      } finally {
        if (active) setAuthBusy(false);
      }
    }

    syncAuthSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const currentUser = session?.user ?? null;
      setGoogleUser(currentUser);
      setUserEmail(currentUser?.email ?? null);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [locale]);

  function validateCurrentStep() {
    if (signupStep === 0) return Boolean(signup.displayName.trim() && signup.email.trim().includes("@") && signup.username.trim());
    if (signupStep === 1) return Boolean(signup.heightCm && signup.birthDate && signup.weightKg);
    if (signupStep === 2) return Boolean(signup.activityLevel && signup.trainingDays && signup.workoutDuration && signup.experience && signup.goal && signup.goalDurationWeeks);
    if (signupStep === 3) return signup.notSubscribed || cleanCode(signup.clubCode).length >= 6;
    if (googleUser) return true;
    return signup.password.length >= 6 && signup.password === signup.confirmPassword;
  }

  function goNext() {
    setAuthMessage(null);
    if (!validateCurrentStep()) {
      setAuthMessage(pick(locale, "كمّل بيانات المرحلة الحالية بشكل صحيح.", "Complete this step correctly first."));
      return;
    }
    setSignupStep((current) => Math.min(4, current + 1) as SignupStep);
  }

  function runSetupAnimation() {
    setSetupLoading(true);
    setSetupSuccess(false);
    setSetupStage(0);
    [1, 2, 3].forEach((stage) => {
      window.setTimeout(() => setSetupStage(stage as SetupStage), stage * 15000);
    });
    return new Promise<void>((resolve) => {
      window.setTimeout(() => {
        setSetupLoading(false);
        setSetupSuccess(true);
        resolve();
      }, 60000);
    });
  }

  async function finishSignup(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    setAuthMessage(null);
    if (!validateCurrentStep()) {
      setAuthMessage(pick(locale, googleUser ? "راجع بياناتك قبل التأكيد." : "كلمة المرور غير متطابقة أو أقل من 6 أحرف.", googleUser ? "Review your details before confirming." : "Password does not match or is shorter than 6 characters."));
      return;
    }

    setAuthBusy(true);
    try {
      const supabase = createSupabaseBrowserClient();
      let user = googleUser;

      if (!user) {
        const email = signup.email.trim().toLowerCase();
        const signupResult = await fetch("/api/auth/signup", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email,
            password: signup.password,
            displayName: signup.displayName.trim(),
            username: signup.username.trim()
          })
        });
        if (!signupResult.ok) throw new Error("signup_failed");

        const signinResult = await supabase.auth.signInWithPassword({ email, password: signup.password });
        if (signinResult.error) throw signinResult.error;
        user = signinResult.data.user ?? null;
      }

      if (!user) throw new Error("missing_user");
      const safeSignup = !cleanCode(signup.clubCode) ? { ...signup, notSubscribed: true } : signup;
      await ensureUserWorkspace(user, safeSignup);
      setUserEmail(user.email ?? signup.email.trim().toLowerCase());
      await runSetupAnimation();
    } catch {
      setAuthMessage(pick(locale, "تعذر إتمام التسجيل. راجع البيانات أو كود النادي وحاول مرة أخرى.", "Could not complete signup. Check your data or gym code and try again."));
    } finally {
      setAuthBusy(false);
    }
  }

  async function handleSignin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAuthBusy(true);
    setAuthMessage(null);
    try {
      const supabase = createSupabaseBrowserClient();
      const email = signinEmail.trim().toLowerCase();
      if (!email.includes("@")) throw new Error("email_required");
      const result = await supabase.auth.signInWithPassword({ email, password: signinPassword });
      if (result.error) throw result.error;
      setUserEmail(result.data.user.email ?? email);
      setSetupSuccess(true);
      setAuthMessage(pick(locale, "تم تسجيل الدخول بنجاح.", "Signed in successfully."));
    } catch {
      setAuthMessage(pick(locale, "تعذر إتمام العملية. تأكد من البريد وكلمة المرور.", "Could not complete the request. Check email and password."));
    } finally {
      setAuthBusy(false);
    }
  }

  async function handleGoogleAuth() {
    setAuthBusy(true);
    setAuthMessage(null);
    try {
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo: `${window.location.origin}/auth/callback?next=/auth` } });
      if (error) throw error;
    } catch {
      setAuthBusy(false);
      setAuthMessage(pick(locale, "تعذر بدء الدخول عبر Google.", "Could not start Google sign-in."));
    }
  }

  async function handleSignOut() {
    setAuthBusy(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      setGoogleUser(null);
      setUserEmail(null);
      setSetupSuccess(false);
      setAssessmentDraftId(null);
      setSignup(initialSignup);
      setSignupStep(0);
      setAuthMessage(pick(locale, "تم تسجيل الخروج.", "Signed out."));
    } catch {
      setAuthMessage(pick(locale, "تعذر تسجيل الخروج الآن.", "Could not sign out right now."));
    } finally {
      setAuthBusy(false);
    }
  }

  const progress = Math.round(((signupStep + 1) / steps.length) * 100);
  const currentStepLabel = steps[signupStep];

  return (
    <main className="app-shell auth-route">
      <div className="auth-layout athlete-auth-layout">
        <section className="auth-poster">
          <Link className="brand-row" href="/"><span className="brand-mark">D</span><strong>{t.appName}</strong></Link>
          <button className="icon-button" aria-label={t.language} onClick={() => setLocale((current) => current === "ar" ? "en" : "ar")} type="button"><Languages size={19} /></button>
          <div className="welcome-copy"><span className="live-badge"><i /> {pick(locale, "رحلة لاعب", "Athlete journey")}</span><h1>{pick(locale, "تسجيل يبني تجربة تدريب مناسبة لك", "Signup that builds a training experience for you")}</h1><p>{pick(locale, "ندخل بياناتك على مراحل واضحة، ثم نجهز الحساب ونربطه بالنادي إذا كان معك كود اشتراك.", "We collect your details in clear steps, prepare your account, and link it to your gym if you have a subscription code.")}</p></div>
        </section>

        <GlassCard className="auth-panel athlete-auth-panel">
          {setupLoading ? (
            <div className="setup-loader" aria-live="polite">
              <Loader2 className="spin" size={34} />
              <h2>{setupStages[setupStage]}</h2>
              <div className="setup-timeline">{setupStages.map((stage, index) => <span className={index <= setupStage ? "active" : ""} key={stage}>{stage}</span>)}</div>
              <p>{pick(locale, "التحميل يستغرق دقيقة كاملة لإعداد حسابك وتجربتك.", "This takes one full minute to prepare your account and experience.")}</p>
            </div>
          ) : setupSuccess ? (
            <div className="auth-summary success-summary"><CheckCircle2 size={48} /><p>{pick(locale, "تم التسجيل بنجاح", "Signup completed")}</p><strong>{userEmail}</strong><span>{assessmentDraftId ? pick(locale, "تم حفظ تقييمك الأول وربط بياناتك.", "Your first assessment and profile data are saved.") : pick(locale, "حسابك جاهز للدخول.", "Your account is ready.")}</span><div className="auth-actions"><Link className="primary-cta" href="/"><span>{pick(locale, "اذهب للتطبيق", "Go to app")}</span><b><ArrowIcon size={18} /></b></Link><button onClick={handleSignOut} type="button" disabled={authBusy}>{pick(locale, "خروج", "Sign out")}</button></div>{authMessage ? <span className="auth-message">{authMessage}</span> : null}</div>
          ) : entryStep === "welcome" ? (
            <div className="auth-summary auth-welcome-step"><span className="live-badge"><i /> {pick(locale, "ابدأ بذكاء", "Start smart")}</span><h2>{pick(locale, "أهلًا بك في Dababa", "Welcome to Dababa")}</h2><p>{pick(locale, "سنجهز تجربة تدريب وتغذية مبنية على بياناتك، خطوة بخطوة بدون زحمة على الشاشة.", "We will build a training and nutrition experience from your data, one calm step at a time.")}</p><div className="auth-actions"><button className="primary-cta" onClick={() => setEntryStep("method")} type="button"><span>{pick(locale, "ابدأ الآن", "Start now")}</span><b><ArrowIcon size={18} /></b></button><button onClick={() => { setEntryStep("signin"); }} type="button">{pick(locale, "تسجيل دخول", "Sign in")}</button></div></div>
          ) : entryStep === "method" ? (
            <div className="auth-summary auth-method-step"><span className="eyebrow">{pick(locale, "طريقة التسجيل", "Signup method")}</span><h2>{pick(locale, "اختر طريقة إنشاء الحساب", "Choose how to create your account")}</h2><div className="signup-method-grid"><button onClick={() => { setEntryStep("signup"); }} type="button"><Mail size={20} /><strong>{pick(locale, "البريد وكلمة المرور", "Email and password")}</strong><span>{pick(locale, "تدخل بياناتك ثم ننشئ الحساب في آخر خطوة.", "Enter your details, then create the account at the final step.")}</span></button><button onClick={handleGoogleAuth} type="button"><span className="google-dot">G</span><strong>{pick(locale, "Google", "Google")}</strong><span>{pick(locale, "نتخطى البريد وكلمة المرور ونكمل بيانات اللاعب.", "Skip email and password, then complete athlete details.")}</span></button></div><button className="back-link" onClick={() => setEntryStep("welcome")} type="button">{pick(locale, "رجوع", "Back")}</button>{authMessage ? <span className="auth-message">{authMessage}</span> : null}</div>
          ) : entryStep === "signin" ? (
            <form className="auth-form" onSubmit={handleSignin}>
              <span className="eyebrow">{pick(locale, "دخول اللاعب", "Athlete sign in")}</span>
              <h2>{pick(locale, "ادخل لحسابك", "Sign in")}</h2>
              <div className="auth-mode" role="group" aria-label={pick(locale, "اختيار الدخول", "Auth mode")}><button onClick={() => setEntryStep("method")} type="button">{pick(locale, "تسجيل جديد", "Sign up")}</button><button className="active" type="button">{pick(locale, "دخول", "Sign in")}</button></div>
              <div className="auth-field-stack">
                <label className="auth-field"><span>{pick(locale, "البريد الإلكتروني", "Email")}</span><div className="auth-input-wrap"><Mail size={18} /><input autoComplete="email" inputMode="email" required type="email" value={signinEmail} onChange={(event) => setSigninEmail(event.target.value)} placeholder="you@example.com" /></div></label>
                <label className="auth-field"><span>{pick(locale, "كلمة المرور", "Password")}</span><div className="auth-input-wrap"><LockKeyhole size={18} /><input autoComplete="current-password" minLength={6} required type={showPassword ? "text" : "password"} value={signinPassword} onChange={(event) => setSigninPassword(event.target.value)} placeholder="********" /><button aria-label={pick(locale, showPassword ? "إخفاء كلمة المرور" : "إظهار كلمة المرور", showPassword ? "Hide password" : "Show password")} onClick={() => setShowPassword((value) => !value)} type="button">{showPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button></div></label>
              </div>
              <button className="auth-submit" disabled={authBusy} type="submit">{authBusy ? <Loader2 className="spin" size={17} /> : null}{pick(locale, "تسجيل الدخول", "Sign in")}</button>
              <button className="google-button" disabled={authBusy} onClick={handleGoogleAuth} type="button"><span>G</span>{pick(locale, "الدخول باستخدام Google", "Continue with Google")}</button>
              {authMessage ? <span className="auth-message">{authMessage}</span> : null}
              <Link className="back-link" href="/">{pick(locale, "العودة للتطبيق", "Back to product")}</Link>
            </form>
          ) : (
            <form className="auth-form onboarding-form" onSubmit={finishSignup}>
              <span className="eyebrow">{pick(locale, "تسجيل لاعب", "Athlete signup")}</span>
              <h2>{steps[signupStep]}</h2>
              <div className="onboarding-step-head"><span>{pick(locale, "المرحلة الحالية", "Current step")}</span><strong>{currentStepLabel}</strong></div><button className="back-link" onClick={() => { setEntryStep("signin"); }} type="button">{pick(locale, "لدي حساب بالفعل", "I already have an account")}</button>
              <div className="signup-progress"><div><span>{progress}%</span><strong>{pick(locale, "رحلة إعداد حسابك", "Account setup journey")}</strong></div><i style={{ ["--w" as string]: `${progress}%` }} /></div>
              <div className="step-tabs compact-step-tabs"><span className="active">{currentStepLabel}</span><span>{signupStep + 1} / {steps.length}</span></div>

              {signupStep === 0 ? <div key="step-0" className="auth-field-stack two-col-fields wizard-step-card"><label className="auth-field"><span>{pick(locale, "الاسم", "Name")}</span><div className="auth-input-wrap"><UserRound size={18} /><input autoComplete="name" required value={signup.displayName} onChange={(event) => updateSignup("displayName", event.target.value)} placeholder={pick(locale, "اسمك الكامل", "Full name")} /></div></label><label className="auth-field"><span>{pick(locale, "البريد", "Email")}</span><div className="auth-input-wrap"><Mail size={18} /><input autoComplete="email" disabled={Boolean(googleUser)} inputMode="email" required type="email" value={signup.email} onChange={(event) => updateSignup("email", event.target.value)} placeholder="you@example.com" /></div></label><label className="auth-field"><span>{pick(locale, "النوع", "Gender")}</span><select value={signup.gender} onChange={(event) => updateSignup("gender", event.target.value)}><option value="male">{pick(locale, "ذكر", "Male")}</option><option value="female">{pick(locale, "أنثى", "Female")}</option><option value="prefer_not_to_say">{pick(locale, "لا أفضل الإفصاح", "Prefer not to say")}</option></select></label><label className="auth-field"><span>{pick(locale, "اسم المستخدم", "Username")}</span><div className="auth-input-wrap"><Sparkles size={18} /><input autoComplete="username" required value={signup.username} onChange={(event) => updateSignup("username", event.target.value)} placeholder={pick(locale, "اسم يظهر داخل التطبيق", "App username")} /></div></label></div> : null}

              {signupStep === 1 ? <div key="step-1" className="auth-field-stack three-col-fields wizard-step-card"><label className="auth-field"><span>{pick(locale, "الطول سم", "Height cm")}</span><input inputMode="numeric" required value={signup.heightCm} onChange={(event) => updateSignup("heightCm", event.target.value)} placeholder="175" /></label><label className="auth-field"><span>{pick(locale, "تاريخ الميلاد", "Birth date")}</span><input required type="date" value={signup.birthDate} onChange={(event) => updateSignup("birthDate", event.target.value)} /></label><label className="auth-field"><span>{pick(locale, "الوزن كجم", "Weight kg")}</span><input inputMode="decimal" required value={signup.weightKg} onChange={(event) => updateSignup("weightKg", event.target.value)} placeholder="80" /></label></div> : null}

              {signupStep === 2 ? <div key="step-2" className="auth-field-stack two-col-fields wizard-step-card"><label className="auth-field"><span>{pick(locale, "معدل النشاط", "Activity level")}</span><select value={signup.activityLevel} onChange={(event) => updateSignup("activityLevel", event.target.value)}><option value="low">{pick(locale, "قليل", "Low")}</option><option value="moderate">{pick(locale, "متوسط", "Moderate")}</option><option value="high">{pick(locale, "عال", "High")}</option></select></label><label className="auth-field"><span>{pick(locale, "أيام التدريب أسبوعيًا", "Training days")}</span><input inputMode="numeric" required value={signup.trainingDays} onChange={(event) => updateSignup("trainingDays", event.target.value)} placeholder="3" /></label><label className="auth-field"><span>{pick(locale, "مدة التمرين بالدقائق", "Workout minutes")}</span><input inputMode="numeric" required value={signup.workoutDuration} onChange={(event) => updateSignup("workoutDuration", event.target.value)} placeholder="60" /></label><label className="auth-field"><span>{pick(locale, "الخبرة السابقة", "Experience")}</span><select value={signup.experience} onChange={(event) => updateSignup("experience", event.target.value)}><option value="beginner">{pick(locale, "مبتدئ", "Beginner")}</option><option value="intermediate">{pick(locale, "متوسط", "Intermediate")}</option><option value="advanced">{pick(locale, "متقدم", "Advanced")}</option></select></label><label className="auth-field"><span>{pick(locale, "الهدف", "Goal")}</span><select value={signup.goal} onChange={(event) => updateSignup("goal", event.target.value)}><option value="build_muscle">{pick(locale, "زيادة عضل", "Build muscle")}</option><option value="fat_loss">{pick(locale, "خسارة دهون", "Fat loss")}</option><option value="strength">{pick(locale, "قوة", "Strength")}</option><option value="fitness">{pick(locale, "لياقة", "Fitness")}</option></select></label><label className="auth-field"><span>{pick(locale, "مدة الهدف بالأسابيع", "Goal duration weeks")}</span><input inputMode="numeric" required value={signup.goalDurationWeeks} onChange={(event) => updateSignup("goalDurationWeeks", event.target.value)} placeholder="12" /></label></div> : null}

              {signupStep === 3 ? <div key="step-3" className="auth-field-stack wizard-step-card"><label className="auth-field"><span>{pick(locale, "كود اشتراك النادي", "Gym subscription code")}</span><div className="auth-input-wrap"><Dumbbell size={18} /><input autoCapitalize="characters" disabled={signup.notSubscribed} value={signup.clubCode} onChange={(event) => updateSignup("clubCode", event.target.value.toUpperCase())} placeholder="DABABA2026" /></div></label><button className={signup.notSubscribed ? "choice-card active" : "choice-card"} onClick={() => updateSignup("notSubscribed", !signup.notSubscribed)} type="button"><CheckCircle2 size={18} />{pick(locale, "لست مشتركًا في نادٍ الآن", "I am not subscribed to a gym now")}</button></div> : null}

              {signupStep === 4 ? <div key="step-4" className="auth-field-stack wizard-step-card"><div className="final-review"><ShieldCheck size={22} /><strong>{googleUser ? pick(locale, "سيتم استخدام حساب Google وتخطي كلمة المرور.", "Google is connected, so password setup is skipped.") : pick(locale, "آخر خطوة: أنشئ كلمة مرور قوية.", "Final step: create a secure password.")}</strong></div>{!googleUser ? <><label className="auth-field"><span>{pick(locale, "كلمة المرور", "Password")}</span><div className="auth-input-wrap"><LockKeyhole size={18} /><input autoComplete="new-password" minLength={6} required type={showPassword ? "text" : "password"} value={signup.password} onChange={(event) => updateSignup("password", event.target.value)} placeholder="********" /><button aria-label={pick(locale, showPassword ? "إخفاء كلمة المرور" : "إظهار كلمة المرور", showPassword ? "Hide password" : "Show password")} onClick={() => setShowPassword((value) => !value)} type="button">{showPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button></div></label><label className="auth-field"><span>{pick(locale, "تأكيد كلمة المرور", "Confirm password")}</span><div className="auth-input-wrap"><LockKeyhole size={18} /><input autoComplete="new-password" minLength={6} required type={showConfirmPassword ? "text" : "password"} value={signup.confirmPassword} onChange={(event) => updateSignup("confirmPassword", event.target.value)} placeholder="********" /><button aria-label={pick(locale, showConfirmPassword ? "إخفاء كلمة المرور" : "إظهار كلمة المرور", showConfirmPassword ? "Hide password" : "Show password")} onClick={() => setShowConfirmPassword((value) => !value)} type="button">{showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button></div></label></> : null}</div> : null}

              <div className="wizard-actions"><button className="secondary-cta" disabled={signupStep === 0 || authBusy} onClick={() => setSignupStep((current) => Math.max(0, current - 1) as SignupStep)} type="button">{pick(locale, "السابق", "Back")}</button>{signupStep < 4 ? <button className="auth-submit" disabled={authBusy} onClick={goNext} type="button">{pick(locale, "التالي", "Next")}</button> : <button className="auth-submit" disabled={authBusy} type="submit">{authBusy ? <Loader2 className="spin" size={17} /> : null}{pick(locale, "إنهاء التسجيل", "Finish signup")}</button>}</div>
              <button className="google-button" disabled={authBusy || Boolean(googleUser)} onClick={handleGoogleAuth} type="button"><span>G</span>{googleUser ? pick(locale, "Google متصل", "Google connected") : pick(locale, "التسجيل باستخدام Google", "Sign up with Google")}</button>
              {authMessage ? <span className="auth-message">{authMessage}</span> : null}
              <Link className="back-link" href="/">{pick(locale, "العودة للتطبيق", "Back to product")}</Link>
            </form>
          )}
        </GlassCard>
      </div>
    </main>
  );
}

