"use client";
import { useEffect, useState } from "react";
import Rings from "@/components/Rings";
import { addWater, getHome } from "@/lib/data";
import { ar } from "@/lib/format";
import type { HomeData } from "@/types/db";

export default function PlayerHome() {
  const [d, setD] = useState<HomeData | null>(null);
  useEffect(() => { getHome().then(setD); }, []);
  if (!d) return <><div className="skel" /><div className="skel" /><div className="skel" /></>;

  const pct = Math.round(((d.rings[0] + d.rings[1] + d.rings[2]) / 3) * 100);
  const add = async (ml: number) => {
    const r = await addWater(ml);
    if (r.ok) setD({ ...d, water: { ...d.water, ml: Math.min(d.water.goal, d.water.ml + ml) }, rings: [d.rings[0], Math.min(1, (d.water.ml + ml) / d.water.goal), d.rings[2]] });
    navigator.vibrate?.(10);
  };
  const w = d.water, wp = Math.min(100, (w.ml / w.goal) * 100);

  return (
    <>
      <h1>صباح الخير يا <bdi>{d.name}</bdi></h1>
      <p className="sub" style={{ marginBottom: 0 }}>{d.workout ? "يومك جاهز، ابدأ بالتمرين." : d.planPending ? "جاري تجهيز خطتك." : "لسه مفيش خطة لليوم."}</p>

      <section className="top glass" aria-label="تقدم اليوم">
        <div className="ringwrap"><Rings values={d.rings} /><div className="center"><b>{ar(pct)}%</b><span>إنجاز اليوم</span></div></div>
        <div className="legend">
          <div><span><i className="dot" style={{ background: "var(--blue)" }} />التمرين</span><b>{ar(d.sessions.done)} / {ar(d.sessions.goal)} جلسة</b></div>
          <div><span><i className="dot" style={{ background: "var(--cyan)" }} />الماء</span><b>{ar(w.ml)} / {ar(w.goal)} مل</b></div>
          <div><span><i className="dot" style={{ background: "var(--indigo)" }} />السعرات</span><b>{ar(d.calories.eaten)} / {ar(d.calories.goal)}</b></div>
        </div>
      </section>

      {d.workout ? (
        <section className="hero">
          <small>تمرين اليوم{d.workout.trainer ? ` · من ${d.workout.trainer}` : ""}</small>
          <h2>{d.workout.title}</h2>
          <div className="meta"><span>{ar(d.workout.exercises)} تمارين</span><span>{ar(d.workout.minutes)} دقيقة</span>{d.workout.kcal > 0 && <span>{ar(d.workout.kcal)} سعرة</span>}</div>
          <button className="go">ابدأ التمرين</button>
        </section>
      ) : d.planPending ? (
        <section className="glass empty"><b>جاري تجهيز خطتك</b><span>بنرتب تمرينك وسعراتك بناءً على التقييم.</span></section>
      ) : (
        <section className="glass empty"><b>مفيش تمرين النهارده</b><span>ابدأ التقييم علشان نجهز خطتك.</span></section>
      )}

      <div className="sec"><h3>تابع يومك</h3></div>
      <div className="row">
        <div className="card glass">
          <h4>الماء</h4>
          <div className="big">{ar(w.ml)} <small>مل</small></div>
          <div className="bar"><i style={{ width: `${wp}%`, background: "var(--cyan)" }} /></div>
          <div className="btns"><button onClick={() => add(250)}>+٢٥٠</button><button onClick={() => add(500)}>+٥٠٠</button></div>
        </div>
        {d.meal && (
          <div className="card glass">
            <h4>الوجبة الجاية · {d.meal.label}</h4>
            <div className="big">{ar(d.meal.kcal)} <small>سعرة</small></div>
            <div className="bar"><i style={{ width: "54%", background: "var(--indigo)" }} /></div>
            <small style={{ color: "var(--muted)", fontSize: 11 }}>بروتين {ar(d.meal.protein)}ج · كارب {ar(d.meal.carbs)}ج · دهون {ar(d.meal.fat)}ج</small>
          </div>
        )}
        {d.supplements.total > 0 ? (
          <div className="card glass">
            <h4>المكملات</h4>
            <div className="big">{ar(d.supplements.taken)} <small>من {ar(d.supplements.total)}</small></div>
            <div className="chips">{d.supplements.items.map((s) => <span key={s.name}>{s.name}{s.done ? " ✓" : ""}</span>)}</div>
          </div>
        ) : (
          <div className="card glass">
            <h4>المكملات</h4>
            <div className="empty mini"><b>مفيش مكملات</b><span>أضفها لاحقًا من خطتك.</span></div>
          </div>
        )}
      </div>
    </>
  );
}
