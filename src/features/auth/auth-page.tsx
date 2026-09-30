"use client";

import Link from "next/link";
import { type FormEvent, useCallback, useEffect, useState } from "react";
import { ArrowLeft, ArrowRight, Languages, Loader2, ShieldCheck } from "lucide-react";
import type { User } from "@supabase/supabase-js";
import { GlassCard } from "@/components/ui/primitives";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { copy, type Locale } from "@/lib/translations";

type AuthMode = "signin" | "signup";
type ThemeChoice = "dark" | "light" | "system";

const pick = (locale: Locale, ar: string, en: string) => (locale === "ar" ? ar : en);

export function AuthPage() {
  const [locale, setLocale] = useState<Locale>("ar");
  const [theme] = useState<ThemeChoice>(() => {
    if (typeof window === "undefined") return "dark";
    return (localStorage.getItem("dababa-theme") as ThemeChoice | null) ?? "dark";
  });
  const [authMode, setAuthMode] = useState<AuthMode>("signup");
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [assessmentDraftId, setAssessmentDraftId] = useState<string | null>(null);
  const [authMessage, setAuthMessage] = useState<string | null>(null);
  const [authBusy, setAuthBusy] = useState(false);
  const [checkingAccess, setCheckingAccess] = useState(false);
  const [needsAthleteCode, setNeedsAthleteCode] = useState(false);
  const [athleteCode, setAthleteCode] = useState("");
  const [codeBusy, setCodeBusy] = useState(false);
  const t = copy[locale];
  const isRtl = locale === "ar";
  const ArrowIcon = isRtl ? ArrowLeft : ArrowRight;

  useEffect(() => {
    const root = document.documentElement;
    root.lang = locale;
    root.dir = isRtl ? "rtl" : "ltr";
  }, [isRtl, locale]);

  useEffect(() => {
    const systemTheme = window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
    document.documentElement.dataset.theme = theme === "system" ? systemTheme : theme;
  }, [theme]);

  const ensureUserWorkspace = useCallback(async (user: User) => {
    const supabase = createSupabaseBrowserClient();
    const fallbackName = user.email?.split("@")[0] || "Dababa athlete";
    const safeName = displayName.trim() || fallbackName;

    const profileResult = await supabase.from("profiles").upsert({ id: user.id, display_name: safeName, locale, unit_system: "metric", theme }, { onConflict: "id" });
    if (profileResult.error) throw profileResult.error;

    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "Africa/Cairo";
    const prefsResult = await supabase.from("notification_prefs").upsert({ user_id: user.id, timezone }, { onConflict: "user_id" });
    if (prefsResult.error) throw prefsResult.error;

    const existingDraft = await supabase.from("health_assessments").select("id").eq("user_id", user.id).eq("status", "draft").maybeSingle();
    if (existingDraft.error) throw existingDraft.error;
    if (existingDraft.data?.id) {
      setAssessmentDraftId(existingDraft.data.id);
      return;
    }

    const draftResult = await supabase.from("health_assessments").insert({ user_id: user.id, status: "draft", answers: { source: "auth_page", locale, preferred_goal: "lean_gain" } }).select("id").single();
    if (draftResult.error) throw draftResult.error;
    setAssessmentDraftId(draftResult.data.id);
  }, [displayName, locale, theme]);

  useEffect(() => {
    let active = true;
    const supabase = createSupabaseBrowserClient();

    async function refreshAccessState() {
      setCheckingAccess(true);
      try {
        const [{ data: memberships, error: membershipsError }, { data: roles, error: rolesError }] = await Promise.all([
          supabase.from("gym_memberships").select("id").eq("status", "active").limit(1),
          supabase.from("user_roles").select("role").in("role", ["admin", "super_admin", "platform_admin", "gym_owner", "coach"])
        ]);

        if (membershipsError) throw membershipsError;
        if (rolesError) throw rolesError;

        const hasMembership = Boolean(memberships?.length);
        const hasStaffRole = Boolean(roles?.length);
        setNeedsAthleteCode(!hasMembership && !hasStaffRole);
      } catch {
        setNeedsAthleteCode(false);
        setAuthMessage(pick(locale, "تم الدخول، لكن تعذر فحص عضوية النادي.", "Signed in, but gym access could not be checked."));
      } finally {
        setCheckingAccess(false);
      }
    }

    async function prepareSignedInUser(user: User, successMessage?: string) {
      if (!active) return;
      setUserEmail(user.email ?? null);

      try {
        await ensureUserWorkspace(user);
        await refreshAccessState();
        if (active && successMessage) setAuthMessage(successMessage);
      } catch {
        if (active) setAuthMessage(pick(locale, "تم الدخول، لكن تعذر تجهيز ملفك.", "Signed in, but workspace setup failed."));
      }
    }

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
          await prepareSignedInUser(
            currentUser,
            authStatus === "google_connected" ? pick(locale, "تم تسجيل الدخول عبر Google.", "Google sign-in completed.") : undefined
          );
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
      if (!currentUser) {
        setUserEmail(null);
        setAssessmentDraftId(null);
        return;
      }

      setAuthBusy(false);
      prepareSignedInUser(currentUser).catch(() => undefined);
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
      const loginId = authEmail.trim().toLowerCase();
      const email = loginId === "admin" ? "admin@dababa.local" : loginId;
      const password = authPassword;
      const result = authMode === "signup"
        ? await supabase.auth.signUp({ email, password, options: { data: { display_name: displayName.trim() || email.split("@")[0] } } })
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

  async function handleClaimAthleteCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCodeBusy(true);
    setAuthMessage(null);

    try {
      const supabase = createSupabaseBrowserClient();
      const normalizedCode = athleteCode.trim().replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
      const { error } = await supabase.rpc("claim_athlete_access_code", { raw_code: normalizedCode });
      if (error) throw error;
      setAthleteCode("");
      setNeedsAthleteCode(false);
      setAuthMessage(pick(locale, "تم ربط حسابك بالنادي. يمكنك الدخول للبرنامج الآن.", "Your account is linked to the gym. You can enter the app now."));
    } catch {
      setAuthMessage(pick(locale, "الكود غير صحيح أو تم استخدامه من قبل.", "The code is invalid or already used."));
    } finally {
      setCodeBusy(false);
    }
  }

  async function handleSignOut() {
    setAuthBusy(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      setUserEmail(null);
      setAssessmentDraftId(null);
      setNeedsAthleteCode(false);
      setAthleteCode("");
      setAuthMessage(pick(locale, "تم تسجيل الخروج.", "Signed out."));
    } catch {
      setAuthMessage(pick(locale, "تعذر تسجيل الخروج الآن.", "Could not sign out right now."));
    } finally {
      setAuthBusy(false);
    }
  }

  return (
    <main className="app-shell auth-route">
      <div className="auth-layout">
        <section className="auth-poster">
          <Link className="brand-row" href="/"><span className="brand-mark">D</span><strong>{t.appName}</strong></Link>
          <button className="icon-button" aria-label={t.language} onClick={() => setLocale((current) => current === "ar" ? "en" : "ar")} type="button"><Languages size={19} /></button>
          <div className="welcome-copy"><span className="live-badge"><i /> {pick(locale, "تقييم آمن", "Secure assessment")}</span><h1>{pick(locale, "سجل دخولك لتبدأ خطة تدريبك الشخصية", "Sign in to start your personal training plan")}</h1><p>{pick(locale, "نجهز ملفك، تفضيلات الإشعارات، ومسودة التقييم داخل حدود Supabase الآمنة دون مفاتيح إدارية على المتصفح.", "We prepare your profile, notification preferences, and assessment draft through Supabase client auth without admin keys in the browser.")}</p></div>
        </section>

        <GlassCard className="auth-panel">
          {userEmail ? (
            needsAthleteCode ? (
              <form className="auth-form" onSubmit={handleClaimAthleteCode}>
                <span className="eyebrow">{pick(locale, "كود اللاعب", "Athlete code")}</span>
                <h2>{pick(locale, "اربط حسابك بناديك", "Link your account to your gym")}</h2>
                <p>{pick(locale, "اطلب الكود الخاص بك من صاحب الجيم أو المدرب. ستحتاجه أول مرة فقط.", "Ask the gym owner or coach for your private code. You only need it once.")}</p>
                <label><span>{pick(locale, "الكود", "Code")}</span><input autoCapitalize="characters" autoComplete="one-time-code" inputMode="text" required value={athleteCode} onChange={(event) => setAthleteCode(event.target.value.toUpperCase())} placeholder="DABABA2026" /></label>
                <button className="auth-submit" disabled={codeBusy || checkingAccess} type="submit">{codeBusy ? <Loader2 className="spin" size={17} /> : null}{codeBusy ? pick(locale, "جار التحقق", "Checking") : pick(locale, "تأكيد الكود", "Confirm code")}</button>
                {authMessage ? <span className="auth-message">{authMessage}</span> : null}
                <button className="back-link" onClick={handleSignOut} type="button">{pick(locale, "تسجيل الخروج", "Sign out")}</button>
              </form>
            ) : (
              <div className="auth-summary"><ShieldCheck size={32} /><p>{pick(locale, "الحساب متصل", "Account connected")}</p><strong>{userEmail}</strong><span>{checkingAccess ? pick(locale, "نفحص عضوية النادي", "Checking gym access") : assessmentDraftId ? pick(locale, "مسودة التقييم جاهزة", "Assessment draft ready") : pick(locale, "نجهز تقييمك الآن", "Preparing your assessment")}</span><div className="auth-actions"><Link className="primary-cta" href="/"><span>{pick(locale, "اذهب للتطبيق", "Go to app")}</span><b><ArrowIcon size={18} /></b></Link><button onClick={handleSignOut} type="button" disabled={authBusy}>{pick(locale, "خروج", "Sign out")}</button></div>{authMessage ? <span className="auth-message">{authMessage}</span> : null}</div>
            )
          ) : (
            <form className="auth-form" onSubmit={handleAuthSubmit}>
              <span className="eyebrow">{pick(locale, "دخول دبابة", "Dababa auth")}</span>
              <h2>{authMode === "signup" ? pick(locale, "ابدأ حسابك", "Start your account") : pick(locale, "ادخل لحسابك", "Sign in")}</h2>
              <div className="auth-mode" role="group" aria-label={pick(locale, "اختيار الدخول", "Auth mode")}><button className={authMode === "signup" ? "active" : ""} onClick={() => setAuthMode("signup")} type="button">{pick(locale, "تسجيل جديد", "Sign up")}</button><button className={authMode === "signin" ? "active" : ""} onClick={() => setAuthMode("signin")} type="button">{pick(locale, "دخول", "Sign in")}</button></div>
              {authMode === "signup" ? <label><span>{pick(locale, "الاسم", "Name")}</span><input autoComplete="name" value={displayName} onChange={(event) => setDisplayName(event.target.value)} placeholder={pick(locale, "اسمك", "Your name")} /></label> : null}
              <label><span>{pick(locale, "البريد أو اسم المستخدم", "Email or username")}</span><input autoComplete="username" inputMode="email" required type="text" value={authEmail} onChange={(event) => setAuthEmail(event.target.value)} placeholder="admin أو you@example.com" /></label>
              <label><span>{pick(locale, "كلمة المرور", "Password")}</span><input autoComplete={authMode === "signup" ? "new-password" : "current-password"} minLength={6} required type="password" value={authPassword} onChange={(event) => setAuthPassword(event.target.value)} placeholder="********" /></label>
              <button className="auth-submit" disabled={authBusy} type="submit">{authBusy ? <Loader2 className="spin" size={17} /> : null}{authBusy ? pick(locale, "جار التنفيذ", "Working") : authMode === "signup" ? pick(locale, "إنشاء الحساب", "Create account") : pick(locale, "تسجيل الدخول", "Sign in")}</button>
              <button className="google-button" disabled={authBusy} onClick={handleGoogleAuth} type="button"><span>G</span>{pick(locale, "المتابعة باستخدام Google", "Continue with Google")}</button>
              {authMessage ? <span className="auth-message">{authMessage}</span> : null}
              <Link className="back-link" href="/">{pick(locale, "العودة للتطبيق", "Back to product")}</Link>
            </form>
          )}
        </GlassCard>
      </div>
    </main>
  );
}







