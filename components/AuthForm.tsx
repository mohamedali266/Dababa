"use client";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { completeOnboarding, getCurrentUserIdentity, previewJoinCode, signInWithEmail, signInWithGoogle, signUpWithEmail } from "@/lib/data";
import type { JoinPreview, OnboardingInput } from "@/types/db";

const G = (
  <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden="true">
    <path fill="#FFC107" d="M43.6 20H42v0H24v8h11.3A12 12 0 1 1 24 12c3 0 5.8 1.1 7.9 3l5.7-5.7A20 20 0 1 0 24 44c11 0 20-8 20-20 0-1.3-.1-2.7-.4-4z" />
    <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8A12 12 0 0 1 24 12c3 0 5.8 1.1 7.9 3l5.7-5.7A20 20 0 0 0 6.3 14.7z" />
    <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2A12 12 0 0 1 12.7 28l-6.5 5C9.5 39.6 16.2 44 24 44z" />
    <path fill="#1976D2" d="M43.6 20H42H24v8h11.3a12 12 0 0 1-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.7-.4-4z" />
  </svg>
);

type Mode = "welcome" | "login" | "method" | "identity" | "goal" | "body" | "level" | "training" | "injuries" | "summary" | "club" | "password" | "loading" | "success";
type Provider = "email" | "google";
type FormState = {
  name: string;
  email: string;
  gender: OnboardingInput["gender"] | "";
  age: number | null;
  heightCm: number | null;
  weightKg: number | null;
  activityLevel: OnboardingInput["activityLevel"] | "";
  trainingDays: string[];
  workoutDurationMinutes: number | null;
  trainingExperience: OnboardingInput["trainingExperience"] | "";
  goal: OnboardingInput["goal"] | "";
  goalDurationWeeks: number | null;
  injuries: string[];
  joinCode: string;
  password: string;
  confirmPassword: string;
};

const STORAGE_KEY = "dababa:onboarding:draft";
const loadingSteps = ["جاري إعداد حسابك", "تم تحديد هدفك", "تم حساب سعراتك", "تم اقتراح جدول تمريني", "تم التجهيز بنجاح"];
const days = ["السبت", "الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة"];
const injuries = ["الظهر", "الركبة", "الكتف", "الرقبة", "الرسغ", "لا يوجد"];
const initialForm: FormState = { name: "", email: "", gender: "", age: null, heightCm: null, weightKg: null, activityLevel: "", trainingDays: [], workoutDurationMinutes: null, trainingExperience: "", goal: "", goalDurationWeeks: null, injuries: [], joinCode: "", password: "", confirmPassword: "" };
const goalCards = [
  { value: "lose_weight", icon: "🔥", title: "خسارة الدهون", desc: "نزول في الوزن مع الحفاظ على العضل" },
  { value: "build_muscle", icon: "💪", title: "بناء العضل", desc: "زيادة الحجم والقوة بشكل تدريجي" },
  { value: "fitness", icon: "🏃", title: "لياقة عامة", desc: "طاقة أعلى وصحة وحركة أفضل" },
  { value: "strength", icon: "🏆", title: "قوة وأداء", desc: "رفع أقوى وتحسين مستواك الرياضي" }
] as const;
const levelCards = [
  { value: "beginner", icon: "🌱", title: "مبتدئ", desc: "أقل من ٦ شهور تدريب منتظم" },
  { value: "intermediate", icon: "⚡", title: "متوسط", desc: "من ٦ شهور إلى سنتين" },
  { value: "advanced", icon: "🚀", title: "متقدم", desc: "أكثر من سنتين بانتظام" }
] as const;

export default function AuthForm() {
  const router = useRouter();
  const search = useSearchParams();
  const join = search.get("join") ?? "";
  const draft = getSavedDraft(join);
  const [mode, setMode] = useState<Mode>(draft.mode);
  const [provider, setProvider] = useState<Provider>(draft.provider);
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [loadingIndex, setLoadingIndex] = useState(0);
  const [joinPreview, setJoinPreview] = useState<JoinPreview | null>(null);
  const [form, setForm] = useState<FormState>(draft.form);

  const journeyModes: Mode[] = useMemo(() => provider === "google" ? ["identity", "goal", "body", "level", "training", "injuries", "summary", "club"] : ["identity", "goal", "body", "level", "training", "injuries", "summary", "club", "password"], [provider]);
  const activeIndex = journeyModes.includes(mode) ? journeyModes.indexOf(mode) : 0;
  const progress = journeyModes.includes(mode) ? Math.round(((activeIndex + 1) / journeyModes.length) * 100) : mode === "success" ? 100 : 0;
  const validation = useMemo(() => validateMode(mode, form, provider), [form, mode, provider]);

  useEffect(() => {
    const cookieFlow = document.cookie.split("; ").some((cookie) => cookie === "dababa_oauth_flow=onboarding");
    const queryFlow = search.get("flow") === "onboarding";
    const pending = window.localStorage.getItem("dababa:onboarding");
    if (pending === "google" || queryFlow || cookieFlow) {
      getCurrentUserIdentity().then((identity) => {
        if (!identity.email) return;
        window.localStorage.removeItem("dababa:onboarding");
        document.cookie = "dababa_oauth_flow=; Max-Age=0; path=/";
        setProvider("google");
        setForm((current) => ({ ...current, email: identity.email ?? current.email, name: current.name || identity.name || "" }));
        setMode("identity");
      });
      return;
    }

  }, [search]);

  useEffect(() => {
    if (!journeyModes.includes(mode)) return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ provider, mode, form: { ...form, password: "", confirmPassword: "" } }));
  }, [form, journeyModes, mode, provider]);

  useEffect(() => {
    if (mode !== "loading") return;
    const timers = loadingSteps.map((_, index) => window.setTimeout(() => setLoadingIndex(index), Math.min(index * 12000, 48000)));
    const finish = window.setTimeout(() => setMode("success"), 60000);
    return () => { timers.forEach(window.clearTimeout); window.clearTimeout(finish); };
  }, [mode]);

  function patch(next: Partial<FormState>) {
    setForm((current) => ({ ...current, ...next }));
    setErr("");
  }

  function next() {
    setErr("");
    if (!validation.ok) {
      setErr(validation.error);
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
    if (!r.ok) { window.localStorage.removeItem("dababa:onboarding"); setErr(r.error); }
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
    if (!validation.ok) { setErr(validation.error); return; }
    setBusy(true); setErr("");
    if (provider === "email") {
      const signup = await signUpWithEmail(form.name, form.email, form.password);
      if (!signup.ok) { setBusy(false); setErr(signup.error); return; }
    }

    const payload: OnboardingInput = {
      name: form.name.trim(),
      email: form.email.trim().toLowerCase(),
      gender: form.gender as OnboardingInput["gender"],
      age: form.age as number,
      heightCm: form.heightCm as number,
      weightKg: form.weightKg as number,
      activityLevel: form.activityLevel as OnboardingInput["activityLevel"],
      trainingDays: form.trainingDays,
      workoutDurationMinutes: form.workoutDurationMinutes as number,
      trainingExperience: form.trainingExperience as OnboardingInput["trainingExperience"],
      goal: form.goal as OnboardingInput["goal"],
      goalDurationWeeks: form.goalDurationWeeks as number,
      injuries: form.injuries.filter((item) => item !== "لا يوجد"),
      joinCode: form.joinCode.trim() || undefined
    };
    const saved = await completeOnboarding(payload);
    setBusy(false);
    if (!saved.ok) { setErr(saved.error); return; }
    window.localStorage.removeItem(STORAGE_KEY);
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
          <Field label="كلمة المرور" id="login-pass"><input id="login-pass" type={show ? "text" : "password"} dir="ltr" autoComplete="current-password" value={form.password} onChange={(e) => patch({ password: e.target.value })} /><button type="button" className="eye" onClick={() => setShow(!show)}>{show ? "إخفاء" : "إظهار"}</button></Field>
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
        <section className="glass panel wizard-panel enter">
          <div className="wizard-top"><button type="button" className="back glass" onClick={back} aria-label="رجوع">→</button><div className="progress"><i style={{ width: `${progress}%` }} /></div><span className="step-kicker">{toArabicDigits(activeIndex + 1)}/{toArabicDigits(journeyModes.length)}</span></div>
          {mode === "identity" && <IdentityStep form={form} provider={provider} patch={patch} />}
          {mode === "goal" && <CardStep title="إيه هدفك الأساسي؟" subtitle="هنبني خطتك على الهدف ده. تقدر تغيّره في أي وقت." value={form.goal} cards={goalCards} onPick={(goal) => patch({ goal })} />}
          {mode === "body" && <BodyStep form={form} patch={patch} />}
          {mode === "level" && <CardStep title="مستواك في التمرين؟" subtitle="علشان نختار لك شدة وتمارين مناسبة." value={form.trainingExperience} cards={levelCards} onPick={(trainingExperience) => patch({ trainingExperience })} groupLabel="مستوى التدريب" />}
          {mode === "training" && <TrainingStep form={form} patch={patch} />}
          {mode === "injuries" && <InjuriesStep selected={form.injuries} patch={patch} />}
          {mode === "summary" && <SummaryStep form={form} />}
          {mode === "club" && <ClubStep form={form} patch={patch} joinPreview={joinPreview} checkJoinCode={checkJoinCode} next={next} setJoinPreview={setJoinPreview} />}
          {mode === "password" && <PasswordStep form={form} show={show} setShow={setShow} patch={patch} />}
          <p className="err" role="alert">{err || (!validation.ok ? validation.error : "")}</p>
          <div className="wizard-actions sticky-actions">
            <button type="button" className="soft" onClick={back}>رجوع</button>
            {mode === journeyModes[journeyModes.length - 1]
              ? <button type="button" className="primary" disabled={busy || !validation.ok} onClick={finish}>{busy ? "جاري الحفظ…" : "إنهاء التسجيل"}</button>
              : <button type="button" className="primary" disabled={!validation.ok} onClick={next}>التالي</button>}
          </div>
        </section>
      )}

      {mode === "loading" && <LoadingCard loadingIndex={loadingIndex} />}
      {mode === "success" && <section className="glass panel loading-card enter"><div className="success-mark">✓</div><h1>تم التسجيل بنجاح</h1><p className="sub">حسابك جاهز. ادخل الآن للوحة اللاعب.</p><button className="primary" onClick={() => router.push("/app")}>الدخول إلى حسابي</button></section>}
      {mode !== "loading" && mode !== "success" && mode !== "welcome" && <Link href="/auth/join" className="join-link">معك كود نادي فقط؟ تحقق منه أولًا</Link>}
    </>
  );
}

function getSavedDraft(join: string): { provider: Provider; mode: Mode; form: FormState } {
  if (typeof window === "undefined") return { provider: "email", mode: "welcome", form: { ...initialForm, joinCode: join } };
  const saved = window.localStorage.getItem(STORAGE_KEY);
  if (!saved) return { provider: "email", mode: "welcome", form: { ...initialForm, joinCode: join } };
  try {
    const draft = JSON.parse(saved) as { provider?: Provider; mode?: Mode; form?: Partial<FormState> };
    return {
      provider: draft.provider ?? "email",
      mode: draft.mode ?? "welcome",
      form: { ...initialForm, ...draft.form, password: "", confirmPassword: "", joinCode: join || draft.form?.joinCode || "" }
    };
  } catch {
    window.localStorage.removeItem(STORAGE_KEY);
    return { provider: "email", mode: "welcome", form: { ...initialForm, joinCode: join } };
  }
}
function IdentityStep({ form, provider, patch }: { form: FormState; provider: Provider; patch: (next: Partial<FormState>) => void }) {
  return <><h1>بياناتك الأساسية</h1><p className="sub">الاسم والبريد اللي هيظهروا داخل حسابك.</p><Field label="الاسم" id="name"><input id="name" autoComplete="name" value={form.name} onChange={(e) => patch({ name: e.target.value })} placeholder="اكتب اسمك" /></Field><Field label="البريد الإلكتروني" id="email"><input id="email" type="email" dir="ltr" autoComplete="email" readOnly={provider === "google" && Boolean(form.email)} value={form.email} onChange={(e) => patch({ email: e.target.value })} placeholder="name@email.com" /></Field></>;
}

function BodyStep({ form, patch }: { form: FormState; patch: (next: Partial<FormState>) => void }) {
  return <><h1>عرّفنا على جسمك</h1><p className="sub">بنحسب بيهم سعراتك واحتياج الماء. مفيش قيم افتراضية هنا.</p><div className="lbl">النوع</div><div className="seg clean-seg"><button className={form.gender === "male" ? "sel" : ""} onClick={() => patch({ gender: "male" })}>ذكر</button><button className={form.gender === "female" ? "sel" : ""} onClick={() => patch({ gender: "female" })}>أنثى</button><button className={form.gender === "prefer_not_to_say" ? "sel" : ""} onClick={() => patch({ gender: "prefer_not_to_say" })}>عدم تحديد</button></div><Stepper label="السن" value={form.age} unit="سنة" min={12} max={80} onChange={(age) => patch({ age })} /><Stepper label="الطول" value={form.heightCm} unit="سم" min={120} max={220} onChange={(heightCm) => patch({ heightCm })} /><Stepper label="الوزن" value={form.weightKg} unit="كجم" min={30} max={250} onChange={(weightKg) => patch({ weightKg })} /></>;
}

function TrainingStep({ form, patch }: { form: FormState; patch: (next: Partial<FormState>) => void }) {
  return <><h1>أسبوعك التدريبي</h1><p className="sub">اختار أيامك ومستوى النشاط اليومي بوضوح.</p><div className="lbl">معدل النشاط اليومي</div><div className="option-grid"><Choice label="قليل" active={form.activityLevel === "low"} onClick={() => patch({ activityLevel: "low" })} /><Choice label="متوسط النشاط" active={form.activityLevel === "moderate"} onClick={() => patch({ activityLevel: "moderate" })} /><Choice label="عالٍ" active={form.activityLevel === "high"} onClick={() => patch({ activityLevel: "high" })} /></div><div className="lbl">أيام التدريب</div><div className="chips">{days.map((day) => <button key={day} type="button" className={`chip ${form.trainingDays.includes(day) ? "sel" : ""}`} onClick={() => patch({ trainingDays: toggle(form.trainingDays, day) })}>{day}</button>)}</div><div className="lbl">مدة التمرين</div><div className="chips">{[30, 45, 60, 75, 90].map((minutes) => <button key={minutes} type="button" className={`chip ${form.workoutDurationMinutes === minutes ? "sel" : ""}`} onClick={() => patch({ workoutDurationMinutes: minutes })}>{toArabicDigits(minutes)} دقيقة</button>)}</div></>;
}

function InjuriesStep({ selected, patch }: { selected: string[]; patch: (next: Partial<FormState>) => void }) {
  return <><h1>عندك إصابات أو ألم؟</h1><p className="sub">اختياري. اختيار “لا يوجد” يلغي باقي الاختيارات.</p><div className="chips">{injuries.map((injury) => <button key={injury} type="button" className={`chip ${selected.includes(injury) ? "sel" : ""}`} onClick={() => patch({ injuries: toggleInjury(selected, injury) })}>{injury}</button>)}</div></>;
}

function SummaryStep({ form }: { form: FormState }) {
  const chips = [labelGoal(form.goal), labelLevel(form.trainingExperience), form.age ? `${toArabicDigits(form.age)} سنة` : "", form.heightCm ? `${toArabicDigits(form.heightCm)} سم` : "", form.weightKg ? `${toArabicDigits(form.weightKg)} كجم` : "", `${toArabicDigits(form.trainingDays.length)} أيام`, form.workoutDurationMinutes ? `${toArabicDigits(form.workoutDurationMinutes)} دقيقة` : "", ...form.injuries.filter((item) => item !== "لا يوجد")].filter(Boolean);
  return <><h1>ملخص تقييمك</h1><p className="sub">راجع اختياراتك قبل كود النادي وكلمة المرور.</p><div className="sum glass"><h3>بيانات الخطة</h3><div className="chips">{chips.map((chip) => <span key={chip}>{chip}</span>)}</div></div></>;
}

function ClubStep({ form, patch, joinPreview, checkJoinCode, next, setJoinPreview }: { form: FormState; patch: (next: Partial<FormState>) => void; joinPreview: JoinPreview | null; checkJoinCode: (value: string) => Promise<void>; next: () => void; setJoinPreview: (value: JoinPreview | null) => void }) {
  return <><h1>كود اشتراك النادي</h1><p className="sub">لو معاك كود من النادي أو المدرب اكتبه الآن. ممكن تكمل بدون نادي وتربطه لاحقًا.</p><Field label="كود النادي" id="join-code"><input id="join-code" className="code" dir="ltr" value={form.joinCode} maxLength={9} placeholder="XXX-XXXXX" autoComplete="off" onChange={(e) => checkJoinCode(e.target.value)} /></Field>{joinPreview && <div className="club glass"><b>{joinPreview.clubName}</b><small>{joinPreview.trainerName ? `المدرب: ${joinPreview.trainerName}` : "بدون مدرب بعد"}</small></div>}<button type="button" className="soft" onClick={() => { patch({ joinCode: "" }); setJoinPreview(null); next(); }}>لست مشتركًا في نادي</button></>;
}

function PasswordStep({ form, show, setShow, patch }: { form: FormState; show: boolean; setShow: (value: boolean) => void; patch: (next: Partial<FormState>) => void }) {
  return <><h1>تأمين الحساب</h1><p className="sub">اختر كلمة مرور قوية. لن نعرضها أو نخزنها داخل قاعدة بيانات الموقع.</p><Field label="كلمة المرور" id="pass"><input id="pass" type={show ? "text" : "password"} dir="ltr" autoComplete="new-password" value={form.password} onChange={(e) => patch({ password: e.target.value })} placeholder="٨ أحرف على الأقل" /><button type="button" className="eye" onClick={() => setShow(!show)}>{show ? "إخفاء" : "إظهار"}</button></Field><Field label="تأكيد كلمة المرور" id="confirm"><input id="confirm" type={show ? "text" : "password"} dir="ltr" autoComplete="new-password" value={form.confirmPassword} onChange={(e) => patch({ confirmPassword: e.target.value })} placeholder="أعد كتابة كلمة المرور" /></Field></>;
}

function LoadingCard({ loadingIndex }: { loadingIndex: number }) {
  return <section className="glass panel loading-card enter" aria-live="polite"><div className="loader-ring" /><h1>{loadingSteps[loadingIndex]}</h1><p className="sub">نجهز تجربتك الخاصة. سيستغرق هذا دقيقة واحدة.</p><div className="progress"><i style={{ width: `${Math.min(100, ((loadingIndex + 1) / loadingSteps.length) * 100)}%` }} /></div></section>;
}

function CardStep<T extends string>({ title, subtitle, value, cards, onPick, groupLabel }: { title: string; subtitle: string; value: T | ""; cards: readonly { value: T; icon: string; title: string; desc: string }[]; onPick: (value: T) => void; groupLabel?: string }) {
  return <><h1>{title}</h1><p className="sub">{subtitle}</p>{groupLabel && <div className="lbl">{groupLabel}</div>}<div className="opts">{cards.map((card) => <button key={card.value} type="button" className={`opt glass ${value === card.value ? "sel" : ""}`} onClick={() => onPick(card.value)}><i>{card.icon}</i><div><b>{card.title}</b><span>{card.desc}</span></div><em className="ck">✓</em></button>)}</div></>;
}

function Stepper({ label, value, unit, min, max, onChange }: { label: string; value: number | null; unit: string; min: number; max: number; onChange: (value: number) => void }) {
  const display = value === null ? "—" : `${toArabicDigits(value)} ${unit}`;
  return <div className="stp glass"><label>{label}</label><div className="v"><button type="button" aria-label={`${label} أقل`} onClick={() => onChange(clamp((value ?? min + 1) - 1, min, max))}>−</button><b>{display}</b><button type="button" aria-label={`${label} أكثر`} onClick={() => onChange(clamp((value ?? min - 1) + 1, min, max))}>+</button></div></div>;
}

function Field({ label, id, children }: { label: string; id: string; children: React.ReactNode }) { return <div className="field"><label htmlFor={id}>{label}</label>{children}</div>; }
function Choice({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) { return <button type="button" className={`choice ${active ? "active" : ""}`} onClick={onClick}>{label}</button>; }
function formatCode(value: string) { let c = value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8); if (c.length > 3) c = `${c.slice(0, 3)}-${c.slice(3)}`; return c; }
function toggle(list: string[], item: string) { return list.includes(item) ? list.filter((value) => value !== item) : [...list, item]; }
function toggleInjury(list: string[], item: string) { if (item === "لا يوجد") return list.includes(item) ? [] : [item]; const next = toggle(list.filter((value) => value !== "لا يوجد"), item); return next; }
function clamp(value: number, min: number, max: number) { return Math.max(min, Math.min(max, value)); }
function toArabicDigits(value: number | string) { return String(value).replace(/\d/g, (digit) => "٠١٢٣٤٥٦٧٨٩"[Number(digit)]); }
function labelGoal(goal: FormState["goal"]) { return goalCards.find((card) => card.value === goal)?.title ?? ""; }
function labelLevel(level: FormState["trainingExperience"]) { return levelCards.find((card) => card.value === level)?.title ?? ""; }
function validNumber(value: number | null, min: number, max: number) { return typeof value === "number" && Number.isFinite(value) && value >= min && value <= max; }
function validateMode(mode: Mode, form: FormState, provider: Provider): { ok: boolean; error: string } {
  if (mode === "identity") {
    if (form.name.trim().length < 2) return { ok: false, error: "اكتب الاسم أولًا." };
    if (!/^\S+@\S+\.\S+$/.test(form.email)) return { ok: false, error: provider === "google" ? "تعذر قراءة بريد Google. جرّب الدخول مرة أخرى." : "اكتب بريدًا إلكترونيًا صحيحًا." };
  }
  if (mode === "goal" && !form.goal) return { ok: false, error: "اختار هدفك الأساسي." };
  if (mode === "body") {
    if (!form.gender) return { ok: false, error: "اختار النوع." };
    if (!validNumber(form.age, 12, 80)) return { ok: false, error: "السن يجب أن يكون بين ١٢ و٨٠ سنة." };
    if (!validNumber(form.heightCm, 120, 220)) return { ok: false, error: "الطول يجب أن يكون بين ١٢٠ و٢٢٠ سم." };
    if (!validNumber(form.weightKg, 30, 250)) return { ok: false, error: "الوزن يجب أن يكون بين ٣٠ و٢٥٠ كجم." };
  }
  if (mode === "level" && !form.trainingExperience) return { ok: false, error: "اختار مستوى التدريب." };
  if (mode === "training") {
    if (!form.activityLevel) return { ok: false, error: "اختار معدل النشاط اليومي." };
    if (form.trainingDays.length < 2) return { ok: false, error: "اختار يومين تدريب على الأقل." };
    if (!form.workoutDurationMinutes) return { ok: false, error: "اختار مدة التمرين." };
  }
  if (mode === "password" && (form.password.length < 8 || form.password !== form.confirmPassword)) return { ok: false, error: "كلمة المرور ٨ أحرف على الأقل ويجب أن تتطابق مع التأكيد." };
  return { ok: true, error: "" };
}

