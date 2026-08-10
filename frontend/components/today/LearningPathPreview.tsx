import Link from "next/link";
import { ArrowUpRight, Check, CircleDot, MoveRight } from "lucide-react";

import type { LearningPathNode } from "./types";

type LearningPathPreviewProps = {
  phase: string;
  progress: number;
  nodes: LearningPathNode[];
  recommendation: string;
};

const STATUS_META: Record<LearningPathNode["status"], { label: string; height: string }> = {
  done: { label: "已完成", height: "92%" },
  current: { label: "进行中", height: "68%" },
  next: { label: "下一步", height: "40%" },
};

export function LearningPathPreview({
  phase,
  progress,
  nodes,
  recommendation,
}: LearningPathPreviewProps) {
  return (
    <section className="ws-dashboard-card flex min-h-[390px] flex-col p-5 lg:h-full lg:min-h-0">
      <header className="relative flex items-start justify-center gap-3 text-center">
        <div>
          <p className="text-xs text-[#747474]">学习路径</p>
          <h2 className="mt-1 text-lg font-medium text-[#303030]">{phase}</h2>
        </div>
        <Link
          href="/plan"
          aria-label="打开完整学习路径"
          title="打开完整学习路径"
          className="ws-icon-button absolute right-0 top-0 h-8 w-8"
        >
          <ArrowUpRight size={15} aria-hidden />
        </Link>
      </header>

      <div className="mt-3 flex items-end justify-center gap-2 text-center">
        <strong className="text-4xl font-medium leading-none tabular-nums text-[#303030]">
          {progress}%
        </strong>
        <span className="pb-0.5 text-xs leading-4 text-[#747474]">主线完成度<br />动态更新</span>
      </div>

      {nodes.length > 0 ? (
        <div className="ws-scroll mt-4 grid min-h-0 flex-1 grid-cols-3 gap-2">
          {nodes.slice(0, 3).map((node) => {
            const meta = STATUS_META[node.status];
            const Icon = node.status === "done" ? Check : node.status === "current" ? CircleDot : MoveRight;
            return (
              <Link
                key={node.id}
                href="/plan"
                aria-label={`查看路径节点：${node.title}`}
                className="group flex min-w-0 flex-col justify-end rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#303030]/30"
              >
                <div className="relative min-h-28 flex-1 overflow-hidden rounded-2xl bg-[#898989]/10">
                  <div
                    className={`absolute inset-x-0 bottom-0 rounded-2xl transition-transform duration-200 group-hover:-translate-y-1 ${
                      node.status === "current" ? "bg-[#ffd85f]" : "bg-[#303030]"
                    }`}
                    style={{ height: meta.height }}
                  />
                  <span className="absolute left-2.5 top-2.5 inline-flex h-7 w-7 items-center justify-center rounded-full bg-white/[0.82] text-[#303030]">
                    <Icon size={14} aria-hidden />
                  </span>
                </div>
                <p className="mt-2 truncate text-center text-xs text-[#747474]">{meta.label}</p>
                <h3 className="mt-0.5 truncate text-center text-sm font-medium text-[#303030]" title={node.title}>
                  {node.title}
                </h3>
              </Link>
            );
          })}
        </div>
      ) : (
        <div className="mt-4 flex min-h-36 flex-1 items-center justify-center rounded-2xl border border-dashed border-[#898989]/30 px-4 text-center text-sm text-[#747474]">
          完成一次目标规划后，这里会出现学习节点。
        </div>
      )}

      <p className="mt-4 line-clamp-2 text-xs leading-5 text-[#747474]" title={recommendation}>
        {recommendation}
      </p>
    </section>
  );
}
