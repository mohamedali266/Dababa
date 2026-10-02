const R = [66, 50, 34];
const COLORS = ["var(--blue)", "var(--cyan)", "var(--indigo)"];

export default function Rings({ values }: { values: [number, number, number] }) {
  return (
    <svg viewBox="0 0 150 150" style={{ transform: "rotate(-90deg)" }} aria-hidden="true">
      {R.map((r, i) => {
        const c = 2 * Math.PI * r;
        const v = Math.min(1, Math.max(0, values[i]));
        return (
          <g key={r}>
            <circle className="track" cx="75" cy="75" r={r} fill="none" strokeWidth="11" />
            <circle cx="75" cy="75" r={r} fill="none" stroke={COLORS[i]} strokeWidth="11" strokeLinecap="round"
              strokeDasharray={c} strokeDashoffset={c * (1 - v)} style={{ transition: "stroke-dashoffset .6s ease" }} />
          </g>
        );
      })}
    </svg>
  );
}
