"use client";
import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

export default function AdminLoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError("");
    const supabase = createSupabaseBrowserClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password });
    setBusy(false);
    if (signInError) { setError("تعذر تسجيل الدخول."); return; }
    router.replace(params.get("next") || "/admin");
  }

  return <form className="glass panel admin-login" onSubmit={submit} noValidate><div className="logo"><i>د</i>دبابة</div><h1>دخول الإدارة</h1><p className="sub">صفحة خاصة بالإدارة فقط. لا يوجد تسجيل جديد هنا.</p><div className="field"><label htmlFor="admin-email">البريد الإلكتروني</label><input id="admin-email" type="email" dir="ltr" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" /></div><div className="field"><label htmlFor="admin-password">كلمة المرور</label><input id="admin-password" type="password" dir="ltr" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" /></div><p className="err" role="alert">{error}</p><button className="primary" disabled={busy}>{busy ? "جاري التحقق…" : "دخول"}</button></form>;
}
