import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import type { SpaceDetail } from "@/lib/types";
import { SpaceGoalActions } from "./SpaceGoalActions";

import { doneStepCount, progressPercent, statusLabel } from "./spaceView";

/* course 字段可能是机器标识（如 seed-demo）：slug 形态不当文案展示 */
function courseLabel(course: string): string {
  if (!course || /^[a-z0-9_-]+$/i.test(course)) return "";
  return `所属课程方向：${course}`;
}

export function SpaceHero({
  detail,
  onRename,
  onDelete,
}: {
  detail: SpaceDetail;
  onRename: (title: string) => Promise<void>;
  onDelete: () => Promise<void>;
}) {
  const pct = progressPercent(detail.progress);
  const finished = doneStepCount(detail.steps);

  return (
    <header className="border-b border-[var(--ws-line)] pb-7">
      <Link
        href="/today"
        className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-[var(--ws-ink)]"
      >
        <ArrowLeft size={14} aria-hidden /> 返回今日学习
      </Link>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_280px] lg:items-end">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--ws-accent)]">
            Learning Space
          </p>
          <h1 className="mt-3 max-w-3xl text-3xl font-medium leading-tight text-[var(--ws-ink)] sm:text-4xl">
            {detail.title}
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-slate-600">
            {courseLabel(detail.course) || "围绕这个学习目标组织路径、资源和复盘节奏。"}
          </p>
          <p className="mt-2 text-sm text-slate-500">
            {statusLabel(detail.status)} · 已完成 {finished}/{detail.steps.length || 0} 个路径节点
          </p>
          <SpaceGoalActions title={detail.title} onRename={onRename} onDelete={onDelete} />
        </div>

        <div className="ws-dashboard-card rounded-3xl p-4">
          <div className="flex items-baseline justify-between">
            <span className="text-sm text-slate-500">当前进度</span>
            <strong className="text-2xl font-medium text-[var(--ws-ink)]">{pct}%</strong>
          </div>
          <div className="mt-4 h-2 overflow-hidden rounded-full bg-[#e7e3da]">
            <div className="h-full rounded-full bg-[#ffd85f]" style={{ width: `${pct}%` }} />
          </div>
          <p className="mt-3 text-xs leading-5 text-slate-500">
            进度来自学习路径节点和当前空间沉淀的学习记录。
          </p>
        </div>
      </div>
    </header>
  );
}
