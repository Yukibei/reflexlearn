"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowUpRight, CalendarClock, ChevronDown, ChevronUp } from "lucide-react";

import type { ProfileSignal, ReviewItem } from "./types";

export function ProfileSignals({ signals }: { signals: ProfileSignal[] }) {
  const [openLabel, setOpenLabel] = useState(signals[0]?.label ?? "");

  return (
    <section className="ws-dashboard-card flex h-full min-h-[320px] flex-col overflow-hidden lg:min-h-0">
      <Link
        href="/profile"
        aria-label="打开完整学习画像"
        className="group flex shrink-0 items-end justify-between gap-3 px-5 pb-4 pt-5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#303030]/25"
      >
        <div>
          <p className="text-xs text-[#747474]">学习画像</p>
          <h2 className="mt-1 text-lg font-medium text-[#303030]">系统已掌握的线索</h2>
        </div>
        <span className="flex items-center gap-2 text-[#303030]">
          <span className="text-3xl font-medium tabular-nums">{signals.length}</span>
          <ArrowUpRight size={16} className="transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" aria-hidden />
        </span>
      </Link>

      {signals.length > 0 ? (
        <div className="ws-scroll min-h-0 flex-1 border-t border-[#898989]/15">
          {signals.map((signal) => {
            const open = openLabel === signal.label;
            return (
              <div key={signal.label} className="border-b border-[#898989]/15 last:border-b-0">
                <button
                  type="button"
                  onClick={() => setOpenLabel(open ? "" : signal.label)}
                  aria-expanded={open}
                  className="flex w-full items-center justify-between gap-3 px-5 py-3.5 text-left text-sm text-[#303030] transition-colors hover:bg-white/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#303030]/25"
                >
                  <span>{signal.label}</span>
                  {open ? <ChevronUp size={15} className="text-[#747474]" aria-hidden /> : <ChevronDown size={15} className="text-[#747474]" aria-hidden />}
                </button>
                {open ? (
                  <p className="border-t border-[#898989]/[0.12] px-5 py-3 text-sm leading-6 text-[#747474]">
                    {signal.value}
                  </p>
                ) : null}
              </div>
            );
          })}
        </div>
      ) : (
        <p className="px-5 pb-5 text-sm leading-6 text-[#747474]">
          完成一次对话诊断后，系统会在这里整理学习偏好与薄弱点。
        </p>
      )}
    </section>
  );
}

export function ReviewQueue({ items }: { items: ReviewItem[] }) {
  return (
    <section className="flex min-h-[310px] flex-1 flex-col rounded-3xl bg-[#303030] p-5 text-white shadow-[0_2px_20px_rgb(0_0_0/0.10)]">
      <header className="flex items-end justify-between gap-3">
        <div>
          <p className="text-xs text-white/45">复习队列</p>
          <h2 className="mt-1 text-lg font-medium">待处理知识点</h2>
        </div>
        <span className="text-base text-white/45">{items.length} 项</span>
      </header>

      {items.length > 0 ? (
        <ol className="ws-scroll mt-4 max-h-[360px] flex-1">
          {items.map((item) => (
            <li key={item.topic} className="border-b border-white/[0.08] last:border-b-0">
              <Link
                href={`/mistakes?topic=${encodeURIComponent(item.topic)}`}
                aria-label={`复习：${item.topic}`}
                className="flex items-center gap-3 rounded-2xl py-3 transition-colors hover:bg-white/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
              >
                <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/10 text-white/60">
                  <CalendarClock size={14} aria-hidden />
                </span>
                <div className="min-w-0 flex-1">
                  <h3 className="truncate text-sm font-medium">{item.topic}</h3>
                  <p className="mt-0.5 truncate text-xs text-white/35" title={item.reason}>
                    {item.reason}
                  </p>
                </div>
                <span className="shrink-0 text-xs text-[#ffd85f]">{item.dueLabel}</span>
                <span className="h-5 w-5 shrink-0 rounded-full border border-white/22" aria-hidden />
              </Link>
            </li>
          ))}
        </ol>
      ) : (
        <div className="mt-4 flex flex-1 items-center justify-center rounded-2xl border border-dashed border-white/18 px-4 text-center text-sm text-white/45">
          当前没有待复习内容。
        </div>
      )}
    </section>
  );
}
