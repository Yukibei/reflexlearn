"use client";

import Link from "next/link";
import { AlertCircle, Check, ExternalLink, Search } from "lucide-react";

import type { ResourceDiscoveryResult } from "@/lib/resourceDiscoveryApi";

export type TutorSearchState =
  | { status: "idle" }
  | { status: "loading"; query: string }
  | { status: "success"; query: string; result: ResourceDiscoveryResult }
  | { status: "error"; query: string; message: string };

const SEARCH_SOURCES = ["B 站", "官方文档", "开放课程"];

export function TutorSearchPanel({ state }: { state: TutorSearchState }) {
  if (state.status === "idle") return null;

  return (
    <section className="max-w-[680px] rounded-[10px] bg-white/80 px-3 py-2.5 shadow-[0_0_0_1px_rgb(137_137_137/0.16),0_2px_8px_rgb(48_48_48/0.04)]">
      <div className="flex items-center gap-2">
        <Search size={14} strokeWidth={1.7} className="text-[#747474]" aria-hidden />
        <p className="min-w-0 flex-1 truncate text-[13px] font-medium text-[#303030]">
          检索“{state.query}”
        </p>
        <SearchStatus state={state} />
      </div>

      {state.status === "loading" ? (
        <div className="mt-2.5 grid gap-1.5 sm:grid-cols-3">
          {SEARCH_SOURCES.map((source, index) => (
            <div
              key={source}
              className="flex items-center gap-2 rounded-md bg-[#303030]/[0.035] px-2.5 py-2 text-xs text-[#747474]"
            >
              <span
                className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#ffd85f]"
                style={{ animationDelay: `${index * 160}ms` }}
              />
              {source}
            </div>
          ))}
        </div>
      ) : null}

      {state.status === "success" ? (
        <div className="mt-2.5 divide-y divide-[#898989]/12 border-t border-[#898989]/12">
          {state.result.items.slice(0, 4).map((item) => (
            <a
              key={item.resource_id}
              href={item.href}
              target="_blank"
              rel="noreferrer"
              className="group grid grid-cols-[minmax(0,1fr)_auto] gap-3 py-2.5 text-left"
            >
              <span className="min-w-0">
                <span className="flex items-center gap-2">
                  <span className="truncate text-[13px] text-[#303030] group-hover:text-[#77621d]">
                    {item.title}
                  </span>
                  <span className="shrink-0 text-[10px] text-[#a1a1a1]">
                    {item.source_label}
                  </span>
                </span>
                <span className="mt-0.5 block truncate text-[11px] text-[#898989]">
                  {item.reason}
                </span>
              </span>
              <ExternalLink
                size={12}
                className="mt-1 text-[#a1a1a1] group-hover:text-[#303030]"
                aria-hidden
              />
            </a>
          ))}
          <div className="flex items-center justify-between pt-2.5 text-[11px] text-[#898989]">
            <span>
              {state.result.degraded.length > 0
                ? `部分来源已降级：${state.result.degraded.join("、")}`
                : `已整理 ${state.result.items.length} 条真实候选`}
            </span>
            <Link href="/resources" className="shrink-0 text-[#303030] hover:text-[#77621d]">
              查看资源页
            </Link>
          </div>
        </div>
      ) : null}

      {state.status === "error" ? (
        <p className="mt-2 flex items-center gap-2 text-xs text-rose-700">
          <AlertCircle size={13} aria-hidden />
          {state.message}
        </p>
      ) : null}
    </section>
  );
}

function SearchStatus({ state }: { state: Exclude<TutorSearchState, { status: "idle" }> }) {
  if (state.status === "loading") {
    return <span className="text-[11px] text-[#898989]">搜索中</span>;
  }
  if (state.status === "error") {
    return <span className="text-[11px] text-rose-700">失败</span>;
  }
  return (
    <span className="inline-flex items-center gap-1 text-[11px] text-emerald-700">
      <Check size={12} aria-hidden />
      已完成
    </span>
  );
}
