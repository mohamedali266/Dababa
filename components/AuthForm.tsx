"use client";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { completeOnboarding, getCurrentUserEmail, previewJoinCode, signInWithEmail, signInWithGoogle, signUpWithEmail } from "@/lib/data";
import type { JoinPreview, OnboardingInput } from "@/types/db";

const G = (
  <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden="true">
    <path fill="#FFC107" d="M43.6 20H42v0H24v8h11.3A12 12 0 1 1 24 12c3 0 5.8 1.1 7.9 3l5.7-5.7A20 20 0 1 0 24 44c11 0 20-8 20-20 0-1.3-.1-2.7-.4-4z" />
    <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8A12 12 0 0 1 24 12c3 0 5.8 1.1 7.9 3l5.7-5.7A20 20 0 0 0 6.3 14.7z" />
    <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2A12 12 0 0 1 12.7 28l-6.5 5C9.5 39.6 16.2 44 24 44z" />
    <path fill="#1976D2" d="M43.6 20H42H24v8h11.3a12 12 0 0 1-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.7-.4-4z" />
  </svg>
);

type Mode = "welcome" | "login" | "method" | "identity" | "body" | "training" | "goal" | "club" | "password" | "loading" | "success";
type Provider = "email" | "google";

const loadingSteps = ["جاري إعداد حسابك", "تم تحديد هدفك", "تم حساب سعراتك", "تم اقتراح جدول تمريني", "تم التجهيز بنجاح"];
const initialForm = {
  name: "",
  email: "",
  username: "",
  gender: "male" as OnboardingInput["gender"],
  birthDate: "",
  heightCm: "170",
  weightKg: "75",
  activityLevel: "moderate" as OnboardingInput["activityLevel"],
  trainingDaysPerWeek: "4",
  workoutDurationMinutes: "60",
  trainingExperience: "beginner" as OnboardingInput["trainingExperience"],
  goal: "fitness" as OnboardingInput["goal"],
  goalDurationWeeks: "12",
  joinCode: "",
  password: "",
  confirmPassword: ""
};

export default function AuthForm() {
  const router = useRouter();
  const search = useSearchParams();
  const join = search.get("join") ?? "";
  const [mode, setMode] = useState<Mode>("welcome");
  const [provider, setProvider] = useState<Provider>("email");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [loadingIndex, setLoadingIndex] = useState(0);
  const [joinPreview, setJoinPreview] = useState<JoinPreview | null>(null);
  const [form, setForm] = useState({ ...initialForm, joinCode: join });

  const journeyModes: Mode[] = provider === "google" ? ["identity", "body", "training", "goal", "club"] : ["identity", "body", "training", "goal", "club", "password"];
  const activeIndex = journeyModes.includes(mode) ? journeyModes.indexOf(mode) : mode === "success" ? journeyModes.length : 0;
  const progress = journeyModes.includes(mode) ? Math.round(((activeIndex + 1) / journeyModes.length) * 100) : mode === "success" ? 100 : 0;

  useEffect(() => {
    const cookieFlow = document.cookie.split("; ").some((cookie) => cookie === "dababa_oauth_flow=onboarding");
    const queryFlow = search.get("flow") === "onboarding";
    const pending = window.localStorage.getItem("dababa:onboarding");
    if (pending === "google" || queryFlow || cookieFlow) {
      getCurrentUserEmail().then((email) => {
        if (!email) return;
        window.localStorage.removeItem("dababa:onboarding");
        document.cookie = "dababa_oauth_flow=; Max-Age=0; path=/";
        setProvider("google");
        setForm((current) => ({ ...current, email, username: current.username || email.split("@")[0].replace(/[^a-zA-Z0-9_]/g, "").slice(0, 24) }));
        setMode("identity");
      });
    }
  }, [search]);

  useEffect(() => {
    if (mode !== "loading") return;
    const timers = loadingSteps.map((_, index) => window.setTimeout(() => setLoadingIndex(index), Math.min(index * 12000, 48000)));
    const finish = window.setTimeout(() => setMode("success"), 60000);
    return () => {
      timers.forEach(window.clearTimeout);
      window.clearTimeout(finish);
    };
  }, [mode]);

  const canGoNext = useMemo(() => {
    if (mode === "identity") return form.name.trim().length >= 2 && form.username.trim().length >= 3 && (provider === "google" || /^\S+@\S+\.\S+$/.test(form.email));
    if (mode === "body") return Boolean(form.birthDate) && Number(form.heightCm) >= 80 && Number(form.weightKg) >= 20;
    if (mode === "training") return Number(form.trainingDaysPerWeek) >= 1 && Number(form.workoutDurationMinutes) >= 15;
    if (mode === "goal") return Number(form.goalDurationWeeks) >= 4;
    if (mode === "password") return form.password.length >= 8 && form.password === form.confirmPassword;
    return true;
  }, [form, mode, provider]);

  function patch(next: Partial<typeof form>) {
    setForm((current) => ({ ...current, ...next }));
    setErr("");
  }

  function next() {
    setErr("");
    if (!canGoNext) {
      setErr("راجع بيانات المرحلة الحالية قبل المتابعة.");
      return;
    }
    const current = journeyModes.indexOf(mode);
    if (current >= 0 && current < journeyModes.length - 1) setMode(journeyModes[current + 1]);
  }

  function back() {
    setErr("");
    const current = journeyModes.indexOf(mode);
    if (current > 0) setMode(journeyModes[current - 1]);
    else setMode("method");
  }

  async function login(e: React.FormEvent) {
    e.preventDefault();
    if (!/^\S+@\S+\.\S+$/.test(form.email) || form.password.length < 8) {
      setErr("اكتب البريد وكلمة المرور بشكل صحيح.");
      return;
    }
    setBusy(true); setErr("");
    const r = await signInWithEmail(form.email, form.password);
    setBusy(false);
    if (r.ok) router.push("/app"); else setErr(r.error);
  }

  async function googleSignup() {
    setBusy(true); setErr("");
    window.localStorage.setItem("dababa:onboarding", "google");
    const r = await signInWithGoogle("/auth", "onboarding");
    setBusy(false);
    if (!r.ok) {
      window.localStorage.removeItem("dababa:onboarding");
      setErr(r.error);
    }
  }

  async function googleLogin() {
    setBusy(true); setErr("");
    const r = await signInWithGoogle("/app");
    setBusy(false);
    if (!r.ok) setErr(r.error);
  }

  async function checkJoinCode(value: string) {
    const cleaned = formatCode(value);
    patch({ joinCode: cleaned });
    setJoinPreview(null);
    if (cleaned.length !== 9) return;
    const preview = await previewJoinCode(cleaned);
    if (preview.ok) setJoinPreview(preview.data); else setErr(preview.error);
  }

  async function finish() {
    if (!canGoNext) {
      setErr("كلمة المرور ٨ أحرف على الأقل ويجب أن تتطابق مع التأكيد.");
      return;
    }
    setBusy(true); setErr("");
    if (provider === "email") {
      const signup = await signUpWithEmail(form.name, form.email, form.password);
      if (!signup.ok) {
        setBusy(false);
        setErr(signup.error);
        return;
      }
    }

    const payload: OnboardingInput = {
      name: form.name.trim(),
      email: form.email.trim().toLowerCase(),
      username: form.username.trim().toLowerCase(),
      gender: form.gender,
      birthDate: form.birthDate,
      heightCm: Number(form.heightCm),
      weightKg: Number(form.weightKg),
      activityLevel: form.activityLevel,
      trainingDaysPerWeek: Number(form.trainingDaysPerWeek),
      workoutDurationMinutes: Number(form.workoutDurationMinutes),
      trainingExperience: form.trainingExperience,
      goal: form.goal,
      goalDurationWeeks: Number(form.goalDurationWeeks),
      joinCode: form.joinCode.trim() || undefined
    };
    const saved = await completeOnboarding(payload);
    setBusy(false);
    if (!saved.ok) {
      setErr(saved.error);
      return;
    }
    setLoadingIndex(0);
    setMode("loading");
  }

  return (
    <>
      <div className="logo"><i>د</i>دبابة</div>
      {mode === "welcome" && (
        <section className="auth-hero glass enter">
          <span className="step-kicker">ابدأ تجربة شخصية</span>
          <h1>جاهز نبني حسابك الرياضي؟</h1>
          <p className="sub">هنجمع بياناتك على مراحل قصيرة، نحسب هدفك، ونجهز لك بداية مناسبة سواء مع ناديك أو بشكل شخصي.</p>
          <button className="primary" onClick={() => setMode("method")}>ابدأ الآن</button>
          <button className="soft" onClick={() => setMode("login")}>تسجيل دخول</button>
        </section>
      )}

      {mode === "login" && (
        <form className="glass panel enter" onSubmit={login} noValidate>
          <h1>تسجيل الدخول</h1>
          <p className="sub">ادخل بحسابك الحالي أو استخدم Google.</p>
          <button type="button" className="google" onClick={googleLogin} disabled={busy}>{G}الدخول بحساب Google</button>
          <div className="or">أو بالبريد</div>
          <Field label="البريد الإلكتروني" id="login-email"><input id="login-email" type="email" dir="ltr" autoComplete="email" value={form.email} onChange={(e) => patch({ email: e.target.value })} /></Field>
          <Field label="كلمة المرور" id="login-pass">
            <input id="login-pass" type={show ? "text" : "password"} dir="ltr" autoComplete="current-password" value={form.password} onChange={(e) => patch({ password: e.target.value })} />
            <button type="button" className="eye" onClick={() => setShow(!show)}>{show ? "إخفاء" : "إظهار"}</button>
          </Field>
          <p className="err" role="alert">{err}</p>
          <button className="primary" disabled={busy}>{busy ? "لحظة…" : "دخول"}</button>
          <button type="button" className="soft" onClick={() => setMode("method")}>إنشاء حساب جديد</button>
        </form>
      )}

      {mode === "method" && (
        <section className="glass panel enter">
          <h1>طريقة إنشاء الحساب</h1>
          <p className="sub">اختار البداية المناسبة، وبعدها هنكمل باقي بيانات التقييم.</p>
          <button type="button" className="google" onClick={googleSignup} disabled={busy}>{G}التسجيل باستخدام Google</button>
          <button type="button" className="choice" onClick={() => { setProvider("email"); setMode("identity"); }}>التسجيل بالبريد وكلمة مرور</button>
          <button type="button" className="soft" onClick={() => setMode("welcome")}>رجوع</button>
          <p className="err" role="alert">{err}</p>
        </section>
      )}

      {journeyModes.includes(mode) && (
        <section className="glass panel enter">
          <div className="progress"><i style={{ width: `${progress}%` }} /></div>
          <span className="step-kicker">المرحلة {activeIndex + 1} من {journeyModes.length}</span>
          {mode === "identity" && (
            <>
              <h1>بياناتك الأساسية</h1>
              <p className="sub">اكتب البيانات التي ستظهر للمدرب وداخل حسابك.</p>
              <Field label="الاسم" id="name"><input id="name" autoComplete="name" value={form.name} onChange={(e) => patch({ name: e.target.value })} /></Field>
              {provider === "email" && <Field label="البريد الإلكتروني" id="email"><input id="email" type="email" dir="ltr" autoComplete="email" value={form.email} onChange={(e) => patch({ email: e.target.value })} /></Field>}
              <Field label="اسم المستخدم" id="username"><input id="username" dir="ltr" autoComplete="username" value={form.username} onChange={(e) => patch({ username: e.target.value.replace(/[^a-zA-Z0-9_]/g, "") })} /></Field>
              <div className="option-grid">
                <Choice label="ذكر" active={form.gender === "male"} onClick={() => patch({ gender: "male" })} />
                <Choice label="أنثى" active={form.gender === "female"} onClick={() => patch({ gender: "female" })} />
                <Choice label="أفضل عدم التحديد" active={form.gender === "prefer_not_to_say"} onClick={() => patch({ gender: "prefer_not_to_say" })} />
              </div>
            </>
          )}

          {mode === "body" && (
            <>
              <h1>قياسات الجسم</h1>
              <p className="sub">البيانات دي بتساعدنا نحسب بداية السعرات والماء بشكل منطقي.</p>
              <Field label="تاريخ الميلاد" id="birth"><input id="birth" type="date" value={form.birthDate} onChange={(e) => patch({ birthDate: e.target.value })} /></Field>
              <div className="split">
                <Field label="الطول سم" id="height"><input id="height" type="number" inputMode="decimal" value={form.heightCm} onChange={(e) => patch({ heightCm: e.target.value })} /></Field>
                <Field label="الوزن كجم" id="weight"><input id="weight" type="number" inputMode="decimal" value={form.weightKg} onChange={(e) => patch({ weightKg: e.target.value })} /></Field>
              </div>
            </>
          )}

          {mode === "training" && (
            <>
              <h1>نشاطك وتدريبك</h1>
              <p className="sub">خلينا نفهم أسبوعك الحالي عشان الخطة تطلع قابلة للتنفيذ.</p>
              <div className="option-grid">
                <Choice label="نشاط قليل" active={form.activityLevel === "low"} onClick={() => patch({ activityLevel: "low" })} />
                <Choice label="متوسط" active={form.activityLevel === "moderate"} onClick={() => patch({ activityLevel: "moderate" })} />
                <Choice label="عالٍ" active={form.activityLevel === "high"} onClick={() => patch({ activityLevel: "high" })} />
              </div>
              <div className="split">
                <Field label="أيام التدريب أسبوعيًا" id="days"><input id="days" type="number" min="1" max="7" value={form.trainingDaysPerWeek} onChange={(e) => patch({ trainingDaysPerWeek: e.target.value })} /></Field>
                <Field label="مدة التمرين بالدقائق" id="duration"><input id="duration" type="number" min="15" max="240" value={form.workoutDurationMinutes} onChange={(e) => patch({ workoutDurationMinutes: e.target.value })} /></Field>
              </div>
              <div className="option-grid">
                <Choice label="مبتدئ" active={form.trainingExperience === "beginner"} onClick={() => patch({ trainingExperience: "beginner" })} />
                <Choice label="متوسط" active={form.trainingExperience === "intermediate"} onClick={() => patch({ trainingExperience: "intermediate" })} />
                <Choice label="متقدم" active={form.trainingExperience === "advanced"} onClick={() => patch({ trainingExperience: "advanced" })} />
              </div>
            </>
          )}

          {mode === "goal" && (
            <>
              <h1>هدفك</h1>
              <p className="sub">حدد الاتجاه الأساسي ومدة الهدف، وبعدها نربطه بخطتك.</p>
              <div className="option-grid two">
                <Choice label="خسارة وزن" active={form.goal === "lose_weight"} onClick={() => patch({ goal: "lose_weight" })} />
                <Choice label="زيادة عضل" active={form.goal === "build_muscle"} onClick={() => patch({ goal: "build_muscle" })} />
                <Choice label="إعادة تشكيل" active={form.goal === "recomposition"} onClick={() => patch({ goal: "recomposition" })} />
                <Choice label="لياقة عامة" active={form.goal === "fitness"} onClick={() => patch({ goal: "fitness" })} />
              </div>
              <Field label="مدة الهدف بالأسابيع" id="weeks"><input id="weeks" type="number" min="4" max="104" value={form.goalDurationWeeks} onChange={(e) => patch({ goalDurationWeeks: e.target.value })} /></Field>
            </>
          )}

          {mode === "club" && (
            <>
              <h1>كود اشتراك النادي</h1>
              <p className="sub">لو معاك كود من النادي أو المدرب اكتبه الآن. ممكن تكمل بدون نادي وتربطه لاحقًا.</p>
              <Field label="كود النادي" id="join-code"><input id="join-code" className="code" dir="ltr" value={form.joinCode} maxLength={9} placeholder="XXX-XXXXX" autoComplete="off" onChange={(e) => checkJoinCode(e.target.value)} /></Field>
              {joinPreview && <div className="club glass"><b>{joinPreview.clubName}</b><small>{joinPreview.trainerName ? `المدرب: ${joinPreview.trainerName}` : "بدون مدرب بعد"}</small></div>}
              <button type="button" className="soft" onClick={() => { patch({ joinCode: "" }); setJoinPreview(null); next(); }}>لست مشتركًا في نادي</button>
            </>
          )}

          {mode === "password" && (
            <>
              <h1>تأمين الحساب</h1>
              <p className="sub">اختر كلمة مرور قوية. لن نعرضها أو نخزنها داخل قاعدة بيانات الموقع.</p>
              <Field label="كلمة المرور" id="pass"><input id="pass" type={show ? "text" : "password"} dir="ltr" autoComplete="new-password" value={form.password} onChange={(e) => patch({ password: e.target.value })} /><button type="button" className="eye" onClick={() => setShow(!show)}>{show ? "إخفاء" : "إظهار"}</button></Field>
              <Field label="تأكيد كلمة المرور" id="confirm"><input id="confirm" type={show ? "text" : "password"} dir="ltr" autoComplete="new-password" value={form.confirmPassword} onChange={(e) => patch({ confirmPassword: e.target.value })} /></Field>
            </>
          )}

          <p className="err" role="alert">{err}</p>
          <div className="wizard-actions">
            <button type="button" className="soft" onClick={back}>رجوع</button>
            {mode === journeyModes[journeyModes.length - 1]
              ? <button type="button" className="primary" disabled={busy} onClick={finish}>{busy ? "جاري الحفظ…" : "إنهاء التسجيل"}</button>
              : <button type="button" className="primary" onClick={next}>التالي</button>}
          </div>
        </section>
      )}

      {mode === "loading" && (
        <section className="glass panel loading-card enter" aria-live="polite">
          <div className="loader-ring" />
          <h1>{loadingSteps[loadingIndex]}</h1>
          <p className="sub">نجهز تجربتك الخاصة. سيستغرق هذا دقيقة واحدة.</p>
          <div className="progress"><i style={{ width: `${Math.min(100, ((loadingIndex + 1) / loadingSteps.length) * 100)}%` }} /></div>
        </section>
      )}

      {mode === "success" && (
        <section className="glass panel loading-card enter">
          <div className="success-mark">✓</div>
          <h1>تم التسجيل بنجاح</h1>
          <p className="sub">حسابك جاهز. ادخل الآن للوحة اللاعب.</p>
          <button className="primary" onClick={() => router.push("/app")}>الدخول إلى حسابي</button>
        </section>
      )}

      {mode !== "loading" && mode !== "success" && mode !== "welcome" && <Link href="/auth/join" className="join-link">معك كود نادي فقط؟ تحقق منه أولًا</Link>}
    </>
  );
}

function Field({ label, id, children }: { label: string; id: string; children: React.ReactNode }) {
  return <div className="field"><label htmlFor={id}>{label}</label>{children}</div>;
}

function Choice({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return <button type="button" className={`choice ${active ? "active" : ""}`} onClick={onClick}>{label}</button>;
}

function formatCode(value: string) {
  let c = value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8);
  if (c.length > 3) c = `${c.slice(0, 3)}-${c.slice(3)}`;
  return c;
}




