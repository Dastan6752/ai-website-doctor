import { useEffect, useState } from "react";

interface Props {
  score: number | null;
  size?: number;
  stroke?: number;
  label?: string;
  color?: string;
  delay?: number;
}

export function scoreColor(score: number | null): string {
  if (score === null) return "#94a3b8";
  if (score >= 85) return "#16a34a";
  if (score >= 65) return "#ca8a04";
  if (score >= 40) return "#ea580c";
  return "#dc2626";
}

export function scoreWord(score: number | null): string {
  if (score === null) return "Not scored";
  if (score >= 85) return "Healthy";
  if (score >= 65) return "Needs attention";
  if (score >= 40) return "Several problems";
  return "Serious problems";
}

export default function ScoreRing({ score, size = 132, stroke = 11, label, color, delay = 150 }: Props) {
  const [shown, setShown] = useState(0);
  const [count, setCount] = useState(0);
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const pct = score === null ? 0 : Math.max(0, Math.min(100, score));
  const ringColor = color ?? scoreColor(score);

  useEffect(() => {
    const t = setTimeout(() => setShown(pct), delay);
    return () => clearTimeout(t);
  }, [pct, delay]);

  useEffect(() => {
    if (score === null) return;
    let raf = 0;
    const start = performance.now();
    const duration = 900;
    const tick = (now: number) => {
      const p = Math.min(1, (now - start - delay) / duration);
      if (p > 0) setCount(Math.round(p * pct));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [pct, score, delay]);

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#e2e8f0" strokeWidth={stroke} />
        <circle
          className="ring-progress"
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={ringColor}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference - (shown / 100) * circumference}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        {score === null ? (
          <span className="px-2 text-center text-[11px] font-medium leading-tight text-slate-500">
            Not enough
            <br />
            data
          </span>
        ) : (
          <>
            <span className="text-[1.75rem] font-semibold tabular-nums leading-none" style={{ color: ringColor }}>
              {count}
            </span>
            {label && <span className="mt-1 text-[10px] font-medium uppercase tracking-wide text-slate-500">{label}</span>}
          </>
        )}
      </div>
    </div>
  );
}
