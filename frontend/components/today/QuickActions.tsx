"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ClipboardList,
  FileQuestion,
  Flag,
  Pause,
  Play,
  RotateCcw,
  UploadCloud,
  type LucideIcon,
} from "lucide-react";

import type { QuickAction } from "./types";

const INITIAL_SECONDS = 155;
const TOTAL_SECONDS = 221;
const RADIUS = 64;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
const ACTION_ICONS: Record<QuickAction["icon"], LucideIcon> = {
  upload: UploadCloud,
  mistake: FileQuestion,
  practice: ClipboardList,
  goal: Flag,
};

type QuickActionsProps = {
  actions: QuickAction[];
};

function formatTime(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(rest).padStart(2, "0")}`;
}

export function QuickActions({ actions }: QuickActionsProps) {
  const [seconds, setSeconds] = useState(INITIAL_SECONDS);
  const [running, setRunning] = useState(false);
  const progress = seconds / TOTAL_SECONDS;
  const ticks = useMemo(() => Array.from({ length: 60 }, (_, index) => index), []);

  useEffect(() => {
    if (!running) return;
    const timer = window.setInterval(() => {
      setSeconds((current) => {
        if (current <= 1) {
          setRunning(false);
          return 0;
        }
        return current - 1;
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [running]);

  function reset(): void {
    setRunning(false);
    setSeconds(INITIAL_SECONDS);
  }

  return (
    <section className="ws-dashboard-card flex min-h-[390px] flex-col p-5 lg:h-full lg:min-h-0">
      <header className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs text-[#747474]">专注计时</p>
          <h2 className="mt-1 text-lg font-medium text-[#303030]">Deep focus</h2>
        </div>
        <span className="rounded-full bg-[#ffd85f] px-3 py-1 text-xs text-[#303030]">
          今日任务
        </span>
      </header>

      <div className="flex min-h-0 flex-1 items-center justify-center py-2">
        <svg viewBox="0 0 180 180" className="h-[170px] w-[170px]" aria-label={`剩余 ${formatTime(seconds)}`}>
          <circle cx="90" cy="90" r={RADIUS} fill="none" stroke="rgb(137 137 137 / 0.12)" strokeWidth="10" />
          <circle
            cx="90"
            cy="90"
            r={RADIUS}
            fill="none"
            stroke="#ffd85f"
            strokeWidth="10"
            strokeLinecap="round"
            strokeDasharray={CIRCUMFERENCE}
            strokeDashoffset={CIRCUMFERENCE * (1 - progress)}
            transform="rotate(-90 90 90)"
          />
          {ticks.map((index) => {
            if (index / ticks.length < progress) return null;
            const angle = (index / ticks.length) * Math.PI * 2 - Math.PI / 2;
            const inner = RADIUS + 8;
            const outer = RADIUS + 14;
            return (
              <line
                key={index}
                x1={90 + Math.cos(angle) * inner}
                y1={90 + Math.sin(angle) * inner}
                x2={90 + Math.cos(angle) * outer}
                y2={90 + Math.sin(angle) * outer}
                stroke="#898989"
                strokeOpacity="0.9"
                strokeWidth="1.2"
                strokeLinecap="round"
              />
            );
          })}
          <text x="90" y="88" textAnchor="middle" fill="#303030" fontSize="22" className="tabular-nums">
            {formatTime(seconds)}
          </text>
          <text x="90" y="106" textAnchor="middle" fill="#747474" fontSize="10">
            {running ? "专注中" : seconds === 0 ? "已完成" : "准备开始"}
          </text>
        </svg>
      </div>

      <div className="flex items-center justify-center gap-5">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setRunning(true)}
            disabled={running || seconds === 0}
            aria-label="开始计时"
            title="开始计时"
            className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-white text-[#303030] shadow-sm transition-transform hover:scale-105 active:scale-95 disabled:opacity-40"
          >
            <Play size={14} fill="currentColor" aria-hidden />
          </button>
          <button
            onClick={() => setRunning(false)}
            disabled={!running}
            aria-label="暂停计时"
            title="暂停计时"
            className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-white text-[#303030] shadow-sm transition-transform hover:scale-105 active:scale-95 disabled:opacity-40"
          >
            <Pause size={14} fill="currentColor" aria-hidden />
          </button>
        </div>
        <button
          onClick={reset}
          aria-label="重置计时"
          title="重置计时"
          className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-[#303030] text-white transition-transform hover:scale-105 active:scale-95"
        >
          <RotateCcw size={14} aria-hidden />
        </button>
      </div>

      <div className="mt-4 grid grid-cols-4 gap-1.5 border-t border-[#898989]/15 pt-3">
        {actions.slice(0, 4).map((action) => {
          const Icon = ACTION_ICONS[action.icon];
          return (
            <Link
              key={action.id}
              href={action.href}
              title={`${action.label}：${action.description}`}
              className="flex min-w-0 flex-col items-center gap-1 rounded-xl px-1 py-2 text-[#747474] transition-colors hover:bg-white/55 hover:text-[#303030] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#303030]/30"
            >
              <Icon size={15} aria-hidden />
              <span className="w-full truncate text-center text-[10px]">{action.label}</span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
