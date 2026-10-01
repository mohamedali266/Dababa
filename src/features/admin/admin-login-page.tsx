"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useEffect, useState } from "react";
import { ArrowLeft, ArrowRight, Eye, EyeOff, Languages, Loader2, LockKeyhole, ShieldCheck, UserRound } from "lucide-react";
import { GlassCard } from "@/components/ui/primitives";
import { copy, type Locale } from "@/lib/translations";

const pick = (locale: Locale, ar: string, en: string) => (locale === "ar" ? ar : en);

type ThemeChoice = "dark" | "light" | "system";

export function AdminLoginPage() {
  const router = useRouter();
  const [locale, setLocale] = useState<Locale>("ar");
  const [theme] = useState<ThemeChoice>(() => {
    if (typeof window === "undefined") return "dark";
    return (localStorage.getItem("dababa-theme") as ThemeChoice | null) ?? "dark";
  });
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const t = copy[locale];
  const isRtl = locale === "ar";
  const ArrowIcon = isRtl ? ArrowLeft : ArrowRight;

  useEffect(() => {
    document.documentElement.lang = locale;
    document.documentElement.dir = isRtl ? "rtl" : "ltr";
  }, [isRtl, locale]);

  useEffect(() => {
    const systemTheme = window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
    document.documentElement.dataset.theme = theme === "system" ? systemTheme : theme;
  }, [theme]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: username.trim(), password })
      });
      if (!response.ok) throw new Error("login_failed");
      router.replace("/admin");
    } catch {
      setMessage(pick(locale, "تعذر إتمام العملية. تأكد من بيانات الدخول.", "Could not complete the request. Check your credentials."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="app-shell auth-route admin-login-route">
      <div className="auth-layout admin-login-layout">
        <section className="auth-poster admin-login-poster">
          <Link className="brand-row" href="/"><span className="brand-mark">D</span><strong>{t.appName}</strong></Link>
          <button className="icon-button" aria-label={t.language} onClick={() => setLocale((current) => current === "ar" ? "en" : "ar")} type="button"><Languages size={19} /></button>
          <div className="welcome-copy"><span className="live-badge warning"><i /> {pick(locale, "منطقة إدارة محمية", "Protected admin area")}</span><h1>{pick(locale, "دخول الإدارة فقط", "Admin access only")}</h1><p>{pick(locale, "هذه الصفحة مخصصة لحسابات الإدارة المصرح لها فقط. كل محاولة دخول غير مصرح بها يتم التعامل معها كإنذار أمني.", "This page is only for authorized administration accounts. Unauthorized attempts are treated as a security warning.")}</p></div>
        </section>
        <GlassCard className="auth-panel admin-login-panel">
          <form className="auth-form" onSubmit={handleSubmit}>
            <span className="eyebrow">{pick(locale, "بوابة الإدارة", "Admin portal")}</span>
            <h2>{pick(locale, "تسجيل دخول الأدمن", "Admin sign in")}</h2>
            <div className="auth-field-stack">
              <label className="auth-field"><span>{pick(locale, "اسم المستخدم", "Username")}</span><div className="auth-input-wrap"><UserRound size={18} /><input autoComplete="username" required value={username} onChange={(event) => setUsername(event.target.value)} placeholder={pick(locale, "اسم المستخدم", "Username")} /></div></label>
              <label className="auth-field"><span>{pick(locale, "كلمة المرور", "Password")}</span><div className="auth-input-wrap"><LockKeyhole size={18} /><input autoComplete="current-password" minLength={6} required type={showPassword ? "text" : "password"} value={password} onChange={(event) => setPassword(event.target.value)} placeholder="********" /><button aria-label={pick(locale, showPassword ? "إخفاء كلمة المرور" : "إظهار كلمة المرور", showPassword ? "Hide password" : "Show password")} onClick={() => setShowPassword((value) => !value)} type="button">{showPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button></div></label>
            </div>
            <button className="auth-submit" disabled={busy} type="submit">{busy ? <Loader2 className="spin" size={17} /> : <ShieldCheck size={17} />}{pick(locale, "دخول لوحة التحكم", "Enter console")}</button>
            {message ? <span className="auth-message">{message}</span> : null}
            <Link className="back-link" href="/auth"><ArrowIcon size={16} />{pick(locale, "دخول اللاعبين", "Athlete login")}</Link>
          </form>
        </GlassCard>
      </div>
    </main>
  );
}
