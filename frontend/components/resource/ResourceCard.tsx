"use client";

import { useEffect, useState } from "react";
import { ChevronDown } from "lucide-react";

import type { ResourceCard as Card } from "@/lib/types";
import { MarkdownView } from "../cards/MarkdownView";
import { MindmapCard } from "../cards/MindmapCard";

const TYPE_META: Record<string, { label: string; color: string }> = {
  doc: { label: "讲解文档", color: "bg-[#303030]/[0.07] text-[#303030]" },
  quiz: { label: "练习题", color: "bg-[#fff1b8] text-[#746016]" },
  mindmap: { label: "思维导图", color: "bg-white/70 text-[#303030]" },
  code: { label: "代码案例", color: "bg-[#303030] text-white" },
  reading: { label: "拓展阅读", color: "bg-[#e3e5e6] text-[#303030]" },
  video: { label: "多模态视频", color: "bg-[#ffd85f] text-[#303030]" },
  debate: { label: "辩论结论", color: "bg-[#303030]/[0.07] text-[#303030]" },
};

export function ResourceCard({ card }: { card: Card }) {
  const [open, setOpen] = useState(Boolean(card.streaming));
  const meta = TYPE_META[card.type] || {
    label: card.type,
    color: "bg-white/70 text-[#747474]",
  };

  useEffect(() => {
    setOpen(Boolean(card.streaming));
  }, [card.streaming]);

  return (
    <article className="max-w-[680px] overflow-hidden rounded-[10px] bg-white/80 shadow-[0_0_0_1px_rgb(137_137_137/0.16),0_2px_8px_rgb(48_48_48/0.04)]">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex min-h-10 w-full items-center gap-2 px-3 text-left transition hover:bg-white"
        aria-expanded={open}
      >
        <span
          className={`rounded-md px-2 py-0.5 text-[11px] font-medium ${meta.color}`}
        >
          {meta.label}
        </span>
        <span className="min-w-0 flex-1 truncate text-xs text-[#747474]">
          {card.task_id || "学习产物"}
        </span>
        {card.streaming ? (
          <span className="inline-flex items-center gap-1 text-[11px] text-[#898989]">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#ffd85f]" />
            生成中
          </span>
        ) : null}
        <ChevronDown
          size={14}
          className={`text-[#898989] transition-transform duration-200 ${open ? "rotate-180" : ""}`}
          aria-hidden
        />
      </button>
      <div className={`grid transition-[grid-template-rows,opacity] duration-200 ${open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}>
        <div className="min-h-0 overflow-hidden">
          <div className="border-t border-[#898989]/15 px-3 py-3">
            {card.type === "mindmap" ? (
              <MindmapCard content={card.content} />
            ) : (
              <MarkdownView content={card.content} />
            )}
            {card.streaming ? (
              <span className="mt-1 inline-block h-3.5 w-0.5 animate-pulse bg-[#303030] align-middle" />
            ) : null}
          </div>
        </div>
      </div>
    </article>
  );
}
