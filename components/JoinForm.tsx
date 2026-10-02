"use client";
import Link from "next/link";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ar } from "@/lib/format";
import { previewJoinCode } from "@/lib/data";
import type { JoinPreview } from "@/types/db";

export default function JoinForm() {
  const router = useRouter();
  const seq = useRef(0);
  const [code, setCode] = useState("");
  const [p, setP] = useState<JoinPreview | null>(null);
  const [err, setErr] = useState("");

  async function change(v: string) {
    let c = v.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8);
    if (c.length > 3) c = c.slice(0, 3) + "-" + c.slice(3);
    setCode(c); setP(null); setErr("");
    const id = ++seq.current;
    if (c.length === 9) {
      const r = await previewJoinCode(c);
      if (id !== seq.current) return;
      if (r.ok) setP(r.data); else setErr(r.error);
    }
  }
  return (
    <>
      <Link href="/auth" className="sub" style={{ display: "inline-block", minHeight: 44 }}>→ رجوع</Link>
      <h1>أدخل كود النادي</h1>
      <p className="sub">الكود وصلك من النادي أو المدرب، وبيُستخدم مرة واحدة فقط.</p>
      <div className="glass panel">
        <div className="field">
          <label htmlFor="c">كود الانضمام</label>
          <input id="c" className="code" dir="ltr" value={code} maxLength={9} placeholder="XXX-XXXXX" autoComplete="off" autoCapitalize="characters" onChange={(e) => change(e.target.value)} />
        </div>
        <p className="err" role="alert">{err}</p>
        {p && (
          <div className="club glass">
            <div className="r">
              <div className="av">{p.clubName.replace("نادي ", "")[0]}</div>
              <div><b>{p.clubName}</b><small>{p.trainerName ? `المدرب: ${p.trainerName}` : "بدون مدرب بعد"}</small></div>
            </div>
            <small style={{ marginTop: 12 }}>الاشتراك: {ar(p.planDays)} يوم من التفعيل</small>
          </div>
        )}
        <button className="primary" disabled={!p} onClick={() => router.push(`/auth?join=${encodeURIComponent(code)}`)}>أكمل الانضمام</button>
      </div>
      <p className="sub" style={{ textAlign: "center", marginTop: 14, fontSize: 13 }}>جرّب الكود التجريبي: DBB-7K4M2</p>
    </>
  );
}
