import { clsx } from "clsx";
import type { ButtonHTMLAttributes, ReactNode } from "react";

export function GlassCard({
  children,
  className = "",
  as = "section"
}: {
  children: ReactNode;
  className?: string;
  as?: "section" | "article" | "div";
}) {
  const Comp = as;
  return <Comp className={clsx("glass-card", className)}>{children}</Comp>;
}

export function IconButton({ className = "", ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button className={clsx("icon-button", className)} type="button" {...props} />;
}

export function Toggle({
  checked,
  onChange,
  label
}: {
  checked: boolean;
  onChange: () => void;
  label: string;
}) {
  return (
    <button aria-pressed={checked} className="toggle" onClick={onChange} type="button">
      <span>{label}</span>
      <span className="toggle-track" data-state={checked ? "on" : "off"}>
        <span />
      </span>
    </button>
  );
}

export function ProgressRing({ value, label }: { value: number; label: string }) {
  const clamped = Math.max(0, Math.min(100, value));
  return (
    <div className="progress-ring" style={{ "--value": clamped } as React.CSSProperties} aria-label={`${label} ${clamped}%`}>
      <svg viewBox="0 0 120 120" role="img">
        <circle className="ring-track" cx="60" cy="60" r="48" />
        <circle className="ring-value" cx="60" cy="60" r="48" pathLength="100" />
      </svg>
      <strong>{clamped}%</strong>
      <span>{label}</span>
    </div>
  );
}

export function SemiGauge({ value, label = "Live", ariaLabel = "Tracking" }: { value: number; label?: string; ariaLabel?: string }) {
  const ticks = Array.from({ length: 25 }, (_, index) => index);
  const active = Math.round((Math.max(0, Math.min(100, value)) / 100) * ticks.length);
  return (
    <div className="semi-gauge" aria-label={`${ariaLabel} ${value}%`}>
      <div className="gauge-ticks">
        {ticks.map((tick) => (
          <span key={tick} className={tick < active ? "active" : ""} style={{ "--i": tick } as React.CSSProperties} />
        ))}
      </div>
      <div className="gauge-core">
        <span>{label}</span>
        <strong>{value}%</strong>
      </div>
    </div>
  );
}
