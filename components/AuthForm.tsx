"use client";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { redeemJoinCode, signInWithEmail, signInWithGoogle, signUpWithEmail } from "@/lib/data";

const G = (
  <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden="true">
    <path fill="#FFC107" d="M43.6 20H42v0H24v8h11.3A12 12 0 1 1 24 12c3 0 5.8 1.1 7.9 3l5.7-5.7A20 20 0 1 0 24 44c11 0 20-8 20-20 0-1.3-.1-2.7-.4-4z" />
    <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8A12 12 0 0 1 24 12c3 0 5.8 1.1 7.9 3l5.7-5.7A20 20 0 0 0 6.3 14.7z" />
    <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2A12 12 0 0 1 12.7 28l-6.5 5C9.5 39.6 16.2 44 24 44z" />
    <path fill="#1976D2" d="M43.6 20H42H24v8h11.3a12 12 0 0 1-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.7-.4-4z" />
  </svg>
);

export default function AuthForm() {
  const router = useRouter();
  const join = useSearchParams().get("join");
  const [up, setUp] = useState(false);
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [f, setF] = useState({ name: "", email: "", password: "" });

  async function done() {
    if (join) await redeemJoinCode(join);
    router.push("/app");
  }
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!/^\S+@\S+\.\S+$/.test(f.email) || f.password.length < 8 || (up && !f.name.trim())) {
      setErr("اكتب إيميل صحيح وكلمة مرور ٨ أحرف على الأقل" + (up ? " والاسم." : "."));
      return;
    }
    setBusy(true); setErr("");
    const r = up ? await signUpWithEmail(f.name.trim(), f.email, f.password) : await signInWithEmail(f.email, f.password);
    setBusy(false);
    if (r.ok) await done(); else setErr(r.error);
  }
  async function google() {
    setBusy(true);
    const r = await signInWithGoogle();
    setBusy(false);
    if (r.ok) await done(); else setErr(r.error);
  }

  return (
    <>
      <div className="logo"><i>د</i>دبابة</div>
      <h1>{up ? "ابدأ رحلتك" : "أهلًا بعودتك"}</h1>
      <p className="sub">{up ? "أنشئ حسابك في دقيقة، وتقدر تضيف كود ناديك بعدها." : "سجّل دخولك وكمّل خطتك من حيث وقفت."}</p>
      <form className="glass panel" onSubmit={submit} noValidate>
        <div className="seg" role="tablist">
          <button type="button" role="tab" aria-selected={!up} className={!up ? "on" : ""} onClick={() => setUp(false)}>دخول</button>
          <button type="button" role="tab" aria-selected={up} className={up ? "on" : ""} onClick={() => setUp(true)}>حساب جديد</button>
        </div>
        <button type="button" className="google" onClick={google} disabled={busy}>{G}المتابعة بحساب جوجل</button>
        <div className="or">أو بالإيميل</div>
        {up && <div className="field"><label htmlFor="n">الاسم</label><input id="n" autoComplete="name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="اسمك كما يظهر لمدربك" /></div>}
        <div className="field"><label htmlFor="e">الإيميل</label><input id="e" type="email" dir="ltr" autoComplete="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} placeholder="name@email.com" /></div>
        <div className="field">
          <label htmlFor="p">كلمة المرور</label>
          <input id="p" type={show ? "text" : "password"} dir="ltr" autoComplete={up ? "new-password" : "current-password"} value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} placeholder="٨ أحرف على الأقل" />
          <button type="button" className="eye" onClick={() => setShow(!show)} aria-label="إظهار أو إخفاء كلمة المرور">{show ? "إخفاء" : "إظهار"}</button>
        </div>
        <p className="err" role="alert">{err}</p>
        <button className="primary" disabled={busy}>{busy ? "لحظة…" : up ? "إنشاء حساب" : "دخول"}</button>
      </form>
      {!join && (
        <Link href="/auth/join" className="glass codebtn">
          <div className="av" aria-hidden="true">🏋️</div>
          <div><b>عندك كود من ناديك؟</b><span>انضم لنادي مدربك وفعّل اشتراكك</span></div>
        </Link>
      )}
    </>
  );
}
