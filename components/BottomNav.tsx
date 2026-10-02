"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLayoutEffect, useRef, useState } from "react";

export type Tab = { href: string; label: string; icon: string };

export default function BottomNav({ tabs }: { tabs: Tab[] }) {
  const path = usePathname();
  const nav = useRef<HTMLElement>(null);
  const [pill, setPill] = useState({ w: 0, s: 0 });
  const active = tabs.reduce((a, t, i) => (path === t.href || (t.href !== tabs[0].href && path.startsWith(t.href)) ? i : a), 0);

  useLayoutEffect(() => {
    const place = () => {
      const n = nav.current;
      const b = n?.querySelectorAll("a")[active];
      if (!n || !b) return;
      const nr = n.getBoundingClientRect(), r = b.getBoundingClientRect();
      setPill({ w: r.width, s: nr.right - r.right - 1 });
    };
    place();
    window.addEventListener("resize", place);
    return () => window.removeEventListener("resize", place);
  }, [active, tabs]);

  return (
    <nav ref={nav} className="nav glass" aria-label="التنقل الرئيسي">
      <span className="pill" style={{ width: pill.w, insetInlineStart: pill.s }} />
      {tabs.map((t, i) => (
        <Link key={t.href} href={t.href} className={i === active ? "on" : ""} aria-current={i === active ? "page" : undefined}>
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d={t.icon} /></svg>
          {t.label}
        </Link>
      ))}
    </nav>
  );
}
