"use client";

import { useEffect, useState } from "react";

/* 数字滚动：prefers-reduced-motion 时直接落到目标值（globals 只压 CSS 动画，rAF 需自理） */
export function useCountUp(target: number, durationMs = 900): number {
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setValue(target);
      return;
    }
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs);
      const eased = 1 - Math.pow(1 - t, 3);
      setValue(Math.round(target * eased));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, durationMs]);
  return value;
}

/* mount 下一帧置 true，触发 CSS transition 从零值生长 */
function useArmed(): boolean {
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    const raf = requestAnimationFrame(() => setArmed(true));
    return () => cancelAnimationFrame(raf);
  }, []);
  return armed;
}

const RING_RADIUS = 52;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

export function ProgressRing({
  percent,
  label = "整体推进",
}: {
  percent: number;
  label?: string;
}) {
  const clamped = Math.min(100, Math.max(0, Math.round(percent)));
  const armed = useArmed();
  const counted = useCountUp(clamped, 1100);
  const offset = RING_CIRCUMFERENCE * (1 - (armed ? clamped : 0) / 100);

  return (
    <figure
      className="relative flex h-36 w-36 shrink-0 items-center justify-center"
      role="img"
      aria-label={`${label} ${clamped}%`}
    >
      <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90">
        <circle
          cx="60"
          cy="60"
          r={RING_RADIUS}
          fill="none"
          stroke="rgb(5 26 36 / 0.08)"
          strokeWidth="7"
        />
        <circle
          cx="60"
          cy="60"
          r={RING_RADIUS}
          fill="none"
          stroke="var(--ws-navy)"
          strokeWidth="7"
          strokeLinecap="round"
          strokeDasharray={RING_CIRCUMFERENCE}
          strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset 1.1s cubic-bezier(0.22, 1, 0.36, 1)" }}
        />
      </svg>
      <figcaption className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="ws-serif text-4xl leading-none text-[var(--ws-ink)]">
          {counted}
          <span className="text-xl">%</span>
        </span>
        <span className="mt-1.5 text-[11px] tracking-wide text-slate-500">{label}</span>
      </figcaption>
    </figure>
  );
}

/* 知识掌握度：印刷尺刻度条，依次延迟生长 */
export function MasteryMeter({
  name,
  score,
  delayMs = 0,
}: {
  name: string;
  score: number;
  delayMs?: number;
}) {
  const percent = Math.min(100, Math.max(0, Math.round(score * 100)));
  const armed = useArmed();

  return (
    <div className="group">
      <div className="flex items-baseline justify-between gap-3 text-sm">
        <span className="font-medium text-[var(--ws-ink)]">{name}</span>
        <span className="ws-serif text-base text-slate-500 transition-colors group-hover:text-[var(--ws-navy)]">
          {percent}%
        </span>
      </div>
      <div
        className="ws-ticks mt-2 h-3.5"
        role="meter"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
        aria-label={`${name} 掌握度 ${percent}%`}
      >
        <div
          className="h-full bg-[var(--ws-navy)]"
          style={{
            width: armed ? `${percent}%` : "0%",
            transition: `width 1s cubic-bezier(0.22, 1, 0.36, 1) ${delayMs}ms`,
          }}
        />
      </div>
    </div>
  );
}

/* 档案条目式统计：大号 serif 数字滚动 */
export function DossierStat({
  label,
  value,
  hint,
}: {
  label: string;
  value: number;
  hint: string;
}) {
  const counted = useCountUp(value);
  return (
    <div className="ws-dashboard-card p-4">
      <p className="text-xs tracking-wide text-slate-500">{label}</p>
      <p className="ws-serif mt-2 text-4xl leading-none text-[var(--ws-ink)]">{counted}</p>
      <p className="mt-2 border-t border-dashed border-[var(--ws-line-strong)] pt-2 text-xs leading-5 text-slate-500">
        {hint}
      </p>
    </div>
  );
}
